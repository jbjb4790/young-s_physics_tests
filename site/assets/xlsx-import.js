(function(global){
  "use strict";

  const YP_XLSX={};
  const UTF8=new TextDecoder("utf-8");
  const ZIP_LOCAL=0x04034b50,ZIP_CENTRAL=0x02014b50,ZIP_EOCD=0x06054b50;

  function u16(view,off){return view.getUint16(off,true)}
  function u32(view,off){return view.getUint32(off,true)}
  function xmlUnescape(value){
    return String(value==null?"":value)
      .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)))
      .replace(/&#([0-9]+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10)))
      .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"')
      .replace(/&apos;/g,"'").replace(/&amp;/g,"&");
  }
  function attrs(text){
    const out={};
    String(text||"").replace(/([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g,(_,k,_q,v)=>{out[k]=xmlUnescape(v);return _});
    return out;
  }
  function normalizePath(base,target){
    if(!target)return "";
    if(target.startsWith("/"))return target.replace(/^\/+/,"");
    const parts=(base+target).split("/"),out=[];
    for(const p of parts){if(!p||p===".")continue;if(p==="..")out.pop();else out.push(p)}
    return out.join("/");
  }
  function cellRefToCol(ref){
    const m=String(ref||"").match(/^([A-Z]+)/i);if(!m)return -1;
    let n=0;for(const ch of m[1].toUpperCase())n=n*26+ch.charCodeAt(0)-64;return n-1;
  }
  function cellRefToRow(ref){const m=String(ref||"").match(/(\d+)$/);return m?Number(m[1])-1:-1}
  function cleanText(v){return String(v==null?"":v).replace(/\u0000/g,"").trim()}
  function normalizedHeader(v){return cleanText(v).toLowerCase().replace(/[\s_\-./·()\[\]{}:]+/g,"")}
  function numberOrText(v){
    if(typeof v==="number")return v;
    const s=cleanText(v).replace(/,/g,"");
    if(s!==""&&/^[-+]?\d+(?:\.\d+)?$/.test(s)){const n=Number(s);if(Number.isFinite(n))return n}
    return cleanText(v);
  }
  function displayValue(v){if(v===null||v===undefined)return "";if(typeof v==="number"&&Number.isFinite(v))return Number.isInteger(v)?String(v):String(Number(v.toFixed(10)));return cleanText(v)}

  function findEocd(bytes){
    const min=Math.max(0,bytes.length-0xffff-22);
    for(let i=bytes.length-22;i>=min;i--){if(bytes[i]===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===0x05&&bytes[i+3]===0x06)return i}
    throw new Error("Excel ZIP 중앙 디렉터리를 찾지 못했습니다. .xlsx 파일인지 확인하세요.");
  }
  function readZipDirectory(buffer){
    const bytes=new Uint8Array(buffer),view=new DataView(buffer),eocd=findEocd(bytes);
    const entryCount=u16(view,eocd+10),centralOffset=u32(view,eocd+16),entries=new Map();
    let pos=centralOffset;
    for(let i=0;i<entryCount;i++){
      if(u32(view,pos)!==ZIP_CENTRAL)throw new Error("Excel ZIP 중앙 디렉터리가 손상되었습니다.");
      const flags=u16(view,pos+8),method=u16(view,pos+10),compressedSize=u32(view,pos+20),uncompressedSize=u32(view,pos+24);
      const fileNameLength=u16(view,pos+28),extraLength=u16(view,pos+30),commentLength=u16(view,pos+32),localOffset=u32(view,pos+42);
      const fileName=UTF8.decode(bytes.subarray(pos+46,pos+46+fileNameLength));
      entries.set(fileName,{fileName,flags,method,compressedSize,uncompressedSize,localOffset});
      pos+=46+fileNameLength+extraLength+commentLength;
    }
    async function getBytes(name){
      const entry=entries.get(name);if(!entry)throw new Error(`Excel 내부 파일을 찾지 못했습니다: ${name}`);
      if(entry.flags&1)throw new Error("암호화된 Excel 파일은 가져올 수 없습니다.");
      const off=entry.localOffset;if(u32(view,off)!==ZIP_LOCAL)throw new Error("Excel ZIP 로컬 헤더가 손상되었습니다.");
      const fileNameLength=u16(view,off+26),extraLength=u16(view,off+28),start=off+30+fileNameLength+extraLength;
      const compressed=bytes.subarray(start,start+entry.compressedSize);
      if(entry.method===0)return new Uint8Array(compressed);
      if(entry.method!==8)throw new Error(`지원하지 않는 Excel 압축 방식입니다: ${entry.method}`);
      if(typeof DecompressionStream!=="function")throw new Error("이 브라우저는 Excel 압축 해제를 지원하지 않습니다. 최신 Chrome, Edge, Safari 또는 Firefox를 사용하세요.");
      const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    async function getText(name){return UTF8.decode(await getBytes(name))}
    return {entries,getBytes,getText};
  }

  function parseRelationships(xml,base){
    const map={};
    String(xml||"").replace(/<Relationship\b([^>]*)\/?\s*>/gi,(_,a)=>{const at=attrs(a);if(at.Id&&at.Target)map[at.Id]=normalizePath(base,at.Target);return _});
    return map;
  }
  function parseWorkbookSheets(xml,relationships){
    const out=[];
    String(xml||"").replace(/<sheet\b([^>]*)\/?\s*>/gi,(_,a)=>{const at=attrs(a),rid=at["r:id"]||at.id;if(at.name&&rid&&relationships[rid])out.push({name:at.name,path:relationships[rid]});return _});
    return out;
  }
  function parseSharedStrings(xml){
    const out=[];
    const sis=String(xml||"").match(/<si\b[\s\S]*?<\/si>/gi)||[];
    for(const si of sis){
      let text="";String(si).replace(/<t\b[^>]*>([\s\S]*?)<\/t>/gi,(_,v)=>{text+=xmlUnescape(v);return _});out.push(text);
    }
    return out;
  }
  function parseWorksheet(xml,sharedStrings){
    const rows=[],cells=[];let maxRow=-1,maxCol=-1;
    const cellRegex=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;let match;
    while((match=cellRegex.exec(String(xml||"")))){
      const at=attrs(match[1]),body=match[2]||"",ref=at.r||"",row=cellRefToRow(ref),col=cellRefToCol(ref);if(row<0||col<0)continue;
      const t=at.t||"",vMatch=body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i),fMatch=body.match(/<f\b[^>]*>([\s\S]*?)<\/f>/i);
      let value="";
      if(t==="inlineStr"){
        String(body).replace(/<t\b[^>]*>([\s\S]*?)<\/t>/gi,(_,v)=>{value+=xmlUnescape(v);return _});
      }else if(vMatch){
        const raw=xmlUnescape(vMatch[1]);
        if(t==="s")value=sharedStrings[Number(raw)]??"";
        else if(t==="b")value=raw==="1";
        else if(t==="str"||t==="e")value=raw;
        else value=numberOrText(raw);
      }
      if(!rows[row])rows[row]=[];
      const cell={value,formula:fMatch?xmlUnescape(fMatch[1]):"",ref,row,col,type:t};
      rows[row][col]=cell;cells.push(cell);maxRow=Math.max(maxRow,row);maxCol=Math.max(maxCol,col);
    }
    return {rows,cells,maxRow,maxCol};
  }

  async function readWorkbook(file){
    const buffer=await file.arrayBuffer(),zip=readZipDirectory(buffer),workbookXml=await zip.getText("xl/workbook.xml"),relsXml=await zip.getText("xl/_rels/workbook.xml.rels");
    const rels=parseRelationships(relsXml,"xl/"),sheetDefs=parseWorkbookSheets(workbookXml,rels);
    let shared=[];if(zip.entries.has("xl/sharedStrings.xml"))shared=parseSharedStrings(await zip.getText("xl/sharedStrings.xml"));
    const sheets=[];
    for(const def of sheetDefs){if(!zip.entries.has(def.path))continue;const parsed=parseWorksheet(await zip.getText(def.path),shared);sheets.push({...def,...parsed})}
    if(!sheets.length)throw new Error("Excel 파일에서 읽을 수 있는 워크시트를 찾지 못했습니다.");
    return {fileName:file.name||"첨부.xlsx",sheets};
  }

  function valueAt(sheet,row,col){return sheet.rows[row]?.[col]?.value??""}
  function cellAt(sheet,row,col){return sheet.rows[row]?.[col]||null}
  function rowValues(sheet,row){const out=[];for(let c=0;c<=sheet.maxCol;c++)out[c]=valueAt(sheet,row,c);return out}
  function findHeaderColumn(sheet,row,names){
    const wanted=new Set(names.map(normalizedHeader));
    for(let c=0;c<=sheet.maxCol;c++)if(wanted.has(normalizedHeader(valueAt(sheet,row,c))))return c;
    return -1;
  }
  function findQuestionSequence(sheet,questionCount){
    const maxScan=Math.min(sheet.maxRow,40);
    for(let r=0;r<=maxScan;r++){
      for(let c=0;c<=Math.max(0,sheet.maxCol-questionCount+1);c++){
        let ok=true;for(let i=0;i<questionCount;i++){if(Number(valueAt(sheet,r,c+i))!==i+1){ok=false;break}}
        if(ok)return {row:r,startCol:c};
      }
    }
    return null;
  }
  function findQHeader(sheet,questionCount){
    const maxScan=Math.min(sheet.maxRow,40);
    for(let r=0;r<=maxScan;r++){
      const map={};for(let c=0;c<=sheet.maxCol;c++){const h=normalizedHeader(valueAt(sheet,r,c)),m=h.match(/^q(?:uestion)?0*(\d+)$/);if(m)map[Number(m[1])]=c}
      if(Array.from({length:questionCount},(_,i)=>map[i+1]).every(c=>Number.isInteger(c)))return {row:r,cols:Array.from({length:questionCount},(_,i)=>map[i+1])};
    }
    return null;
  }
  function parseGrade(v){const s=cleanText(v),m=s.match(/(?:^|\D)([123])(?:학년)?(?:$|\D)/);return m?m[1]:""}
  function parseClass(v){const s=cleanText(v);return s==="0"?"":s}
  function indicator(v){
    const s=normalizedHeader(v);
    if(["o","○","⭕","맞음","정답","true","correct"].includes(s))return "O";
    if(["x","×","✕","틀림","오답","false","wrong"].includes(s))return "X";
    if(v===true)return "O";if(v===false)return "X";return null;
  }
  function scoreInputFromRaw(raw,q,verifiedKey,sheetKey,mode){
    const direct=indicator(raw),s=displayValue(raw);if(s===""||s==="-"||s==="미응시")return {value:"",error:""};
    const n=Number(String(s).replace(/,/g,"")),inputMode=String(q.inputMode||"");
    if(inputMode==="points"){
      if(!Number.isFinite(n))return {value:"",error:`${q.no}번 서술형 점수가 숫자가 아닙니다.`};
      return {value:displayValue(n),error:""};
    }
    if(inputMode==="objective-choice"){
      if(mode==="legacy-binary"){
        if(direct)return {value:direct,error:""};
        if(n===0)return {value:"X",error:""};if(n===1)return {value:"O",error:""};
        return {value:"",error:`${q.no}번 구형 객관식 정오표는 0/1 또는 O/X여야 합니다.`};
      }
      if(direct)return {value:direct,error:""};
      if(Number.isInteger(n)&&n>=1&&n<=5)return {value:String(n),error:""};
      return {value:"",error:`${q.no}번 객관식 선택 번호는 1~5여야 합니다.`};
    }
    if(inputMode==="binary"){
      if(direct)return {value:direct==="O"?"1":"0",error:""};
      if(mode==="legacy-binary"&&(n===0||n===1))return {value:String(n),error:""};
      if(!Number.isFinite(n))return {value:"",error:`${q.no}번 객관식 답안을 읽을 수 없습니다.`};
      const key=Number(verifiedKey||sheetKey);if(!Number.isFinite(key))return {value:"",error:`${q.no}번 검증 정답을 찾지 못했습니다.`};
      return {value:Number(n)===key?"1":"0",error:""};
    }
    return {value:s,error:""};
  }
  function detectInputMode(sheet,dataRows,questionCols,objectiveCount){
    let legacySignals=0,higherChoices=0,ones=0,other=0;
    for(const r of dataRows.slice(0,60))for(let i=0;i<objectiveCount;i++){
      const v=valueAt(sheet,r,questionCols[i]),direct=indicator(v);if(direct!==null){legacySignals++;continue}
      const n=Number(displayValue(v));if(!Number.isFinite(n))continue;if(n===0)legacySignals++;else if(n>=2&&n<=5&&Number.isInteger(n))higherChoices++;else if(n===1)ones++;else other++;
    }
    if(higherChoices>0)return "raw-choice";if(legacySignals>0&&other===0)return "legacy-binary";return "raw-choice";
  }
  function candidateStudentRows(sheet,startRow,nameCol,questionCols){
    const rows=[];let gap=0,started=false;
    for(let r=startRow;r<=sheet.maxRow;r++){
      const name=cleanText(valueAt(sheet,r,nameCol)),nameCell=cellAt(sheet,r,nameCol);
      const qCount=questionCols.reduce((n,c)=>n+(displayValue(valueAt(sheet,r,c))!==""?1:0),0);
      const valid=name&&qCount>=Math.max(3,Math.min(10,Math.floor(questionCols.length*.4)))&&!nameCell?.formula;
      if(valid){rows.push(r);gap=0;started=true}else if(started){gap++;if(gap>=5)break}
    }
    return rows;
  }
  function findLegacyLayout(sheet,exam){
    const seq=findQuestionSequence(sheet,exam.questionCount);if(!seq)return null;
    let headerRow=-1,nameCol=-1,schoolCol=-1,gradeCol=-1,classCol=-1,totalCol=-1;
    for(let r=seq.row;r<=Math.min(seq.row+3,sheet.maxRow);r++){
      const n=findHeaderColumn(sheet,r,["이름","성명","학생명"]);if(n>=0){headerRow=r;nameCol=n;schoolCol=findHeaderColumn(sheet,r,["학교","학교명"]);gradeCol=findHeaderColumn(sheet,r,["학년"]);classCol=findHeaderColumn(sheet,r,["반","반번호","반·번호"]);totalCol=findHeaderColumn(sheet,r,["총점","점수"]);break}
    }
    if(headerRow<0)return null;
    const questionCols=Array.from({length:exam.questionCount},(_,i)=>seq.startCol+i),studentRows=candidateStudentRows(sheet,headerRow+1,nameCol,questionCols);
    if(!studentRows.length)return null;
    const sheetKey=questionCols.map(c=>numberOrText(valueAt(sheet,headerRow,c)));
    return {format:"youngs-legacy",sheet,questionRow:seq.row,headerRow,nameCol,schoolCol,gradeCol,classCol,totalCol,questionCols,studentRows,sheetKey};
  }
  function findStandardLayout(sheet,exam){
    const q=findQHeader(sheet,exam.questionCount);if(!q)return null;
    const headerRow=q.row,nameCol=findHeaderColumn(sheet,headerRow,["이름","성명","학생명"]);if(nameCol<0)return null;
    const schoolCol=findHeaderColumn(sheet,headerRow,["학교","학교명"]),gradeCol=findHeaderColumn(sheet,headerRow,["학년"]),classCol=findHeaderColumn(sheet,headerRow,["반","반번호","반·번호"]),totalCol=findHeaderColumn(sheet,headerRow,["총점","점수"]);
    const studentRows=candidateStudentRows(sheet,headerRow+1,nameCol,q.cols);if(!studentRows.length)return null;
    return {format:"q-header",sheet,questionRow:headerRow,headerRow,nameCol,schoolCol,gradeCol,classCol,totalCol,questionCols:q.cols,studentRows,sheetKey:[]};
  }
  function layoutScore(layout,exam){
    let score=layout.studentRows.length*10;
    const name=normalizedHeader(layout.sheet.name),title=normalizedHeader(exam.shortTitle||exam.title||"");
    if(name.includes("결과")||name.includes("입력"))score+=200;if(name===normalizedHeader(String(exam.round||""))+"회")score+=80;if(title&&name.includes(title))score+=100;
    if(layout.format==="youngs-legacy")score+=50;return score;
  }
  function chooseLayout(workbook,exam){
    const layouts=[];for(const sheet of workbook.sheets){const a=findLegacyLayout(sheet,exam),b=findStandardLayout(sheet,exam);if(a)layouts.push(a);if(b)layouts.push(b)}
    if(!layouts.length)throw new Error("학생 이름과 Q1~Qn 또는 문제번호 1~n이 있는 결과 입력 시트를 찾지 못했습니다.");
    layouts.sort((a,b)=>layoutScore(b,exam)-layoutScore(a,exam));return layouts[0];
  }
  function validateAnswerKey(layout,exam){
    const mismatches=[];for(let i=0;i<exam.questions.length;i++){
      const q=exam.questions[i];if(String(q?.inputMode||"")!=="objective-choice")continue;
      const site=Number(q?.answerKey),sheet=Number(layout.sheetKey[i]);if(Number.isFinite(site)&&Number.isFinite(sheet)&&site!==sheet)mismatches.push(Number(q.no)||i+1);
    }
    if(mismatches.length>=4)throw new Error(`첨부 파일의 객관식 정답표가 현재 선택한 시험과 일치하지 않습니다. 불일치 문항: ${mismatches.join(", ")}번`);
    return mismatches;
  }
  function buildImport(workbook,layout,exam){
    const objectiveCount=exam.questions.filter(q=>["binary","objective-choice"].includes(q.inputMode||"")).length||Math.min(20,exam.questionCount),mode=detectInputMode(layout.sheet,layout.studentRows,layout.questionCols,objectiveCount),keyMismatches=validateAnswerKey(layout,exam);
    const students=[];let missingSchool=0,scoreMismatch=0;
    for(const row of layout.studentRows){
      const name=cleanText(valueAt(layout.sheet,row,layout.nameCol));if(!name)continue;
      const school=layout.schoolCol>=0?cleanText(valueAt(layout.sheet,row,layout.schoolCol)):"",grade=layout.gradeCol>=0?parseGrade(valueAt(layout.sheet,row,layout.gradeCol)):"",classNo=layout.classCol>=0?parseClass(valueAt(layout.sheet,row,layout.classCol)):"";
      if(!school)missingSchool++;
      const inputs=[],errors=[];
      exam.questions.forEach((q,i)=>{const parsed=scoreInputFromRaw(valueAt(layout.sheet,row,layout.questionCols[i]),q,q.answerKey,layout.sheetKey[i],mode);inputs.push(parsed.value);if(parsed.error)errors.push(parsed.error)});
      let sourceTotal=null;if(layout.totalCol>=0){const n=Number(valueAt(layout.sheet,row,layout.totalCol));if(Number.isFinite(n))sourceTotal=n}
      students.push({sourceRow:row+1,name,school:school||"미기입",grade,classNo,inputs,partialModes:Array(exam.questionCount).fill(false),errors,sourceTotal});
    }
    return {fileName:workbook.fileName,sheetName:layout.sheet.name,format:layout.format,inputMode:mode,answerKeyMismatchQuestions:keyMismatches,students,missingSchool,scoreMismatch};
  }

  YP_XLSX.readWorkbook=readWorkbook;
  YP_XLSX.importAssessment=async function(file,exam){
    if(!file)throw new Error("Excel 파일을 선택하세요.");
    if(!/\.xlsx$/i.test(file.name||""))throw new Error("현재 Excel 자동 가져오기는 .xlsx 형식을 지원합니다.");
    if(!exam||!Array.isArray(exam.questions)||!exam.questions.length)throw new Error("가져오기 전에 준비 완료된 시험을 선택하세요.");
    const workbook=await readWorkbook(file),layout=chooseLayout(workbook,exam);return buildImport(workbook,layout,exam);
  };
  YP_XLSX._test={xmlUnescape,attrs,cellRefToCol,parseWorksheet,parseSharedStrings,findQuestionSequence,findLegacyLayout,findStandardLayout,validateAnswerKey,buildImport,readZipDirectory};
  global.YP_XLSX=YP_XLSX;
})(typeof window!=="undefined"?window:globalThis);
