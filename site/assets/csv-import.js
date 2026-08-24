(function(global){
  "use strict";

  const YP_CSV={};
  const NAME_HEADERS=["이름","성명","학생명","학생이름","학생성명","수강생명","수험자명","응시자명","학생","name","studentname","student"];
  const SCHOOL_HEADERS=["학교","학교명","school"];
  const GRADE_HEADERS=["학년","grade"];
  const CLASS_HEADERS=["반번호","반·번호","반","classno","class"];
  const TOTAL_HEADERS=["총점","점수","합계","total","score"];

  function cleanText(value){return String(value==null?"":value).replace(/^\uFEFF/,"").replace(/[\u200B-\u200D\u2060]/g,"").replace(/\u0000/g,"").trim()}
  function normalizeHeader(value){return cleanText(value).toLowerCase().replace(/[\s_\-./·()\[\]{}:]+/g,"")}
  function aliasIndex(row,aliases){const wanted=new Set(aliases.map(normalizeHeader));for(let i=0;i<row.length;i++)if(wanted.has(normalizeHeader(row[i])))return i;return -1}
  function nameHeaderIndex(row){
    const exact=aliasIndex(row,NAME_HEADERS);if(exact>=0)return exact;
    for(let i=0;i<row.length;i++){
      const h=normalizeHeader(row[i]);if(!h)continue;
      if(["교사","담당","강사","보호자","학부모"].some(x=>h.includes(x)))continue;
      if(h.includes("학생이름")||h.includes("학생성명")||h.includes("수강생명")||h.includes("수험자명")||h.includes("응시자명")||h.includes("studentname"))return i;
      if((h.includes("이름")||h.includes("성명"))&&h.length<=12)return i;
    }
    return -1;
  }
  function questionNoFromHeader(value){
    const h=normalizeHeader(value);if(!h)return null;
    let m=h.match(/^(?:q|question|문항|문제|객관식|답안)?0*(\d+)(?:번)?$/i);
    if(!m)m=h.match(/^(\d+)$/);
    if(!m)return null;const n=Number(m[1]);return Number.isInteger(n)&&n>0?n:null;
  }
  function indicator(value){
    if(value===true)return "O";if(value===false)return "X";
    const s=normalizeHeader(value);
    if(["o","○","⭕","맞음","정답","true","correct"].includes(s))return "O";
    if(["x","×","✕","틀림","오답","false","wrong"].includes(s))return "X";
    return null;
  }
  function displayValue(value){if(value==null)return "";if(typeof value==="number"&&Number.isFinite(value))return Number.isInteger(value)?String(value):String(Number(value.toFixed(10)));return cleanText(value)}
  function parseGrade(value){const s=cleanText(value),m=s.match(/(?:^|\D)([123])(?:학년)?(?:$|\D)/);return m?m[1]:s}
  function parseClass(value){const s=cleanText(value);return s==="0"?"":s}

  function countUnquoted(line,delimiter){let quoted=false,count=0;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&quoted&&line[i+1]==='"'){i++;continue}if(c==='"'){quoted=!quoted;continue}if(c===delimiter&&!quoted)count++}return count}
  function detectDelimiter(text){
    const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim()).slice(0,25),candidates=[",","\t",";"];
    let best=",",bestScore=-1;
    for(const d of candidates){const counts=lines.map(l=>countUnquoted(l,d)).filter(n=>n>0);if(!counts.length)continue;const freq={};counts.forEach(n=>freq[n]=(freq[n]||0)+1);const consistency=Math.max(...Object.values(freq)),max=Math.max(...counts),score=consistency*100+counts.length*10+max;if(score>bestScore){bestScore=score;best=d}}
    return best;
  }
  function parseDelimited(text,delimiter){
    const rows=[];let row=[],field="",quoted=false;const src=String(text||"").replace(/^\uFEFF/,"");
    for(let i=0;i<src.length;i++){
      const c=src[i],n=src[i+1];
      if(c==='"'&&quoted&&n==='"'){field+='"';i++;continue}
      if(c==='"'){quoted=!quoted;continue}
      if(c===delimiter&&!quoted){row.push(field);field="";continue}
      if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(field);field="";if(row.some(v=>cleanText(v)!==""))rows.push(row);row=[];continue}
      field+=c;
    }
    row.push(field);if(row.some(v=>cleanText(v)!==""))rows.push(row);return rows;
  }
  function decodeScore(text){
    const s=String(text||""),replacement=(s.match(/�/g)||[]).length,keywords=["이름","성명","학생","학교","학년","총점","q1","문항1","문제1"].reduce((n,k)=>n+(s.toLowerCase().includes(k)?1:0),0),delim=detectDelimiter(s),lines=s.split(/\r?\n/).slice(0,20),structured=lines.reduce((n,l)=>n+(countUnquoted(l,delim)>2?1:0),0);return keywords*250+structured*20-replacement*200;
  }
  function decodeBuffer(buffer){
    const bytes=new Uint8Array(buffer);
    if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xfe)return {text:new TextDecoder("utf-16le").decode(bytes),encoding:"UTF-16LE"};
    if(bytes.length>=2&&bytes[0]===0xfe&&bytes[1]===0xff)return {text:new TextDecoder("utf-16be").decode(bytes),encoding:"UTF-16BE"};
    const candidates=[];
    for(const [label,name] of [["utf-8","UTF-8"],["euc-kr","CP949/EUC-KR"]]){
      try{const text=new TextDecoder(label).decode(bytes);candidates.push({text,encoding:name,score:decodeScore(text)})}catch(e){}
    }
    if(!candidates.length)throw new Error("CSV 문자 인코딩을 읽을 수 없습니다.");
    candidates.sort((a,b)=>b.score-a.score);return candidates[0];
  }

  function qHeaderMap(row,questionCount){const map={};for(let c=0;c<row.length;c++){const n=questionNoFromHeader(row[c]);if(n&&n<=questionCount&&!Object.prototype.hasOwnProperty.call(map,n))map[n]=c}return map}
  function allQuestionColumns(map,count){const cols=[];for(let i=1;i<=count;i++){if(!Number.isInteger(map[i]))return null;cols.push(map[i])}return cols}
  function findHeaderLayout(rows,exam){
    const maxScan=Math.min(rows.length,35),count=exam.questionCount;
    for(let r=0;r<maxScan;r++){
      const nameCol=nameHeaderIndex(rows[r]),map=qHeaderMap(rows[r],count),questionCols=allQuestionColumns(map,count);
      if(nameCol>=0&&questionCols)return {format:"q-header",headerRow:r,nameCol,questionCols,schoolCol:aliasIndex(rows[r],SCHOOL_HEADERS),gradeCol:aliasIndex(rows[r],GRADE_HEADERS),classCol:aliasIndex(rows[r],CLASS_HEADERS),totalCol:aliasIndex(rows[r],TOTAL_HEADERS),dataStart:r+1};
    }
    // 구형 결과표를 CSV로 내보내면 문제번호 행과 이름 헤더 행이 분리될 수 있다.
    for(let qr=0;qr<maxScan;qr++){
      const map=qHeaderMap(rows[qr],count),questionCols=allQuestionColumns(map,count);if(!questionCols)continue;
      for(let hr=Math.max(0,qr-2);hr<=Math.min(maxScan-1,qr+3);hr++){
        const nameCol=nameHeaderIndex(rows[hr]);if(nameCol<0)continue;
        return {format:"split-header",headerRow:hr,questionRow:qr,nameCol,questionCols,schoolCol:aliasIndex(rows[hr],SCHOOL_HEADERS),gradeCol:aliasIndex(rows[hr],GRADE_HEADERS),classCol:aliasIndex(rows[hr],CLASS_HEADERS),totalCol:aliasIndex(rows[hr],TOTAL_HEADERS),dataStart:Math.max(hr,qr)+1};
      }
    }
    // Q1~Qn 헤더는 있는데 이름 헤더만 없는 파일을 학생 데이터로 오인하지 않는다.
    const structuredQuestionHeader=rows.slice(0,12).some(row=>Object.keys(qHeaderMap(row,count)).length>=Math.max(5,Math.floor(count*.7)));
    // 헤더가 완전히 없는 단순 CSV만 제한적으로 허용한다.
    if(!structuredQuestionHeader)for(let r=0;r<Math.min(rows.length,12);r++)for(let nameCol=0;nameCol<Math.min(8,rows[r].length);nameCol++){
      const name=cleanText(rows[r][nameCol]),h=normalizeHeader(name);if(!name||/^[-+]?\d+(?:\.\d+)?$/.test(name)||[...NAME_HEADERS,...SCHOOL_HEADERS,...GRADE_HEADERS,...CLASS_HEADERS,...TOTAL_HEADERS].map(normalizeHeader).includes(h))continue;
      const qCols=Array.from({length:count},(_,i)=>nameCol+1+i);const populated=qCols.reduce((n,c)=>n+(cleanText(rows[r][c])!==""?1:0),0);
      if(populated>=Math.max(5,Math.floor(count*.7)))return {format:"headerless",headerRow:-1,nameCol,questionCols:qCols,schoolCol:-1,gradeCol:-1,classCol:-1,totalCol:-1,dataStart:r};
    }
    const sample=(rows[0]||[]).slice(0,12).map(cleanText).filter(Boolean).join(" | ");
    throw new Error(`CSV에서 학생 이름 열과 Q1~Q${count} 문항 열을 찾지 못했습니다. 이름 헤더는 ‘이름’, ‘성명’, ‘학생명’, ‘학생 이름’, ‘학생 성명’ 또는 ‘Name’을 사용할 수 있습니다.${sample?` 감지된 첫 행: ${sample}`:""}`);
  }
  function studentRows(rows,layout){
    const out=[];let gaps=0,started=false;
    for(let r=layout.dataStart;r<rows.length;r++){
      const name=cleanText(rows[r]?.[layout.nameCol]),filled=layout.questionCols.reduce((n,c)=>n+(cleanText(rows[r]?.[c])!==""?1:0),0);
      if(name&&filled){out.push(r);gaps=0;started=true}else if(started){gaps++;if(gaps>=8)break}
    }
    return out;
  }
  function isObjectiveChoice(q){return (q.inputMode||"")==="objective-choice"}
  function detectInputMode(rows,rowNos,layout,exam){
    const objectiveIndexes=[];exam.questions.forEach((q,i)=>{if(isObjectiveChoice(q)||q.inputMode==="binary")objectiveIndexes.push(i)});
    let legacySignals=0,higherChoices=0,ones=0;
    for(const r of rowNos.slice(0,60))for(const i of objectiveIndexes){const raw=rows[r]?.[layout.questionCols[i]],mark=indicator(raw),s=displayValue(raw);if(mark){legacySignals++;continue}const n=Number(s);if(!Number.isFinite(n))continue;if(n===0){legacySignals++;continue}if(Number.isInteger(n)&&n>=2&&n<=5){higherChoices++;continue}if(n===1)ones++;}
    if(higherChoices>0)return "raw-choice";
    if(legacySignals>0)return "legacy-binary";
    return ones>0?"raw-choice":"raw-choice";
  }
  function convertInput(raw,q,inputMode){
    const mark=indicator(raw),s=displayValue(raw);if(s===""||s==="-"||normalizeHeader(s)==="미응시")return {value:"",error:""};
    const n=Number(String(s).replace(/,/g,""));
    if(q.inputMode==="points"){
      if(!Number.isFinite(n))return {value:"",error:`${q.no}번 서술형 점수가 숫자가 아닙니다.`};
      return {value:displayValue(n),error:""};
    }
    if(isObjectiveChoice(q)){
      if(inputMode==="legacy-binary"){
        if(mark)return {value:mark,error:""};if(n===0)return {value:"X",error:""};if(n===1)return {value:"O",error:""};
        return {value:"",error:`${q.no}번 구형 정오표는 0/1 또는 O/X여야 합니다.`};
      }
      if(mark)return {value:mark,error:""};
      if(Number.isInteger(n)&&n>=1&&n<=5)return {value:String(n),error:""};
      return {value:"",error:`${q.no}번 객관식 선택 번호는 1~5여야 합니다.`};
    }
    if(q.inputMode==="binary"){
      if(mark)return {value:mark==="O"?"1":"0",error:""};
      if(n===0||n===1)return {value:String(n),error:""};
      const key=Number(q.answerKey);if(Number.isInteger(n)&&n>=1&&n<=5&&Number.isFinite(key))return {value:n===key?"1":"0",error:""};
      return {value:"",error:`${q.no}번 객관식 정오표는 0/1 또는 O/X여야 합니다.`};
    }
    return {value:s,error:""};
  }
  function buildImport(text,fileName,exam,encoding){
    const delimiter=detectDelimiter(text),rows=parseDelimited(text,delimiter);if(rows.length<1)throw new Error("CSV 데이터 행이 없습니다.");
    const layout=findHeaderLayout(rows,exam),rowNos=studentRows(rows,layout);if(!rowNos.length)throw new Error("CSV에서 학생 데이터 행을 찾지 못했습니다.");
    const inputMode=detectInputMode(rows,rowNos,layout,exam),students=[];
    for(const r of rowNos){
      const row=rows[r]||[],name=cleanText(row[layout.nameCol]);if(!name)continue;
      const school=layout.schoolCol>=0?cleanText(row[layout.schoolCol]):"",grade=layout.gradeCol>=0?parseGrade(row[layout.gradeCol]):"",classNo=layout.classCol>=0?parseClass(row[layout.classCol]):"",inputs=[],errors=[];
      exam.questions.forEach((q,i)=>{const parsed=convertInput(row[layout.questionCols[i]],q,inputMode);inputs.push(parsed.value);if(parsed.error)errors.push(parsed.error)});
      let sourceTotal=null;if(layout.totalCol>=0){const n=Number(String(row[layout.totalCol]??"").replace(/,/g,""));if(Number.isFinite(n))sourceTotal=n}
      students.push({sourceRow:r+1,name,school:school||"미기입",grade,classNo,inputs,partialModes:Array(exam.questionCount).fill(false),errors,sourceTotal});
    }
    return {fileName:fileName||"학생기록.csv",sheetName:"CSV",format:layout.format,inputMode,encoding,delimiter:delimiter==="\t"?"TAB":delimiter,headerRow:layout.headerRow+1,students,missingSchool:students.filter(s=>s.school==="미기입").length};
  }

  YP_CSV.importAssessment=async function(file,exam){
    if(!file)throw new Error("CSV 파일을 선택하세요.");if(!exam||!Array.isArray(exam.questions)||!exam.questions.length)throw new Error("가져오기 전에 준비 완료된 시험을 선택하세요.");
    const decoded=decodeBuffer(await file.arrayBuffer());return buildImport(decoded.text,file.name||"학생기록.csv",exam,decoded.encoding);
  };
  YP_CSV.importText=function(text,exam,options={}){return buildImport(String(text||""),options.fileName||"학생기록.csv",exam,options.encoding||"UTF-8")};
  YP_CSV._test={cleanText,normalizeHeader,nameHeaderIndex,detectDelimiter,parseDelimited,decodeBuffer,questionNoFromHeader,findHeaderLayout,detectInputMode,convertInput,buildImport};
  global.YP_CSV=YP_CSV;
})(typeof window!=="undefined"?window:globalThis);
