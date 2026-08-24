
(function(){
 const TE=new TextEncoder();
 function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
 function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
 function u16(n){return new Uint8Array([n&255,(n>>>8)&255])}
 function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
 function concat(parts){const len=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(len);let p=0;for(const b of parts){out.set(b,p);p+=b.length}return out}
 function dosDateTime(d=new Date()){let time=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();return {time,date}}
 function makeZip(files){
   const locals=[],centrals=[];let offset=0;const dt=dosDateTime();
   for(const f of files){
     const name=TE.encode(f.name),data=f.data instanceof Uint8Array?f.data:TE.encode(f.data),crc=crc32(data);
     const local=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
     locals.push(local);
     const central=concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
     centrals.push(central);offset+=local.length;
   }
   const central=concat(centrals),eocd=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(central.length),u32(offset),u16(0)]);
   return new Blob([...locals,central,eocd],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
 }
 function p(text,style="",opts={}){
   const pr=[style?`<w:pStyle w:val="${style}"/>`:"",opts.pageBreakBefore?`<w:pageBreakBefore/>`:"",opts.align?`<w:jc w:val="${opts.align}"/>`:""].join("");
   const rpr=[opts.bold?"<w:b/>":"",opts.color?`<w:color w:val="${opts.color}"/>`:"",opts.size?`<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>`:""].join("");
   const lines=String(text??"").split("\n");
   const runs=lines.map((line,i)=>`${i?'<w:r><w:br/></w:r>':""}<w:r>${rpr?`<w:rPr>${rpr}</w:rPr>`:""}<w:t xml:space="preserve">${esc(line)}</w:t></w:r>`).join("");
   return `<w:p>${pr?`<w:pPr>${pr}</w:pPr>`:""}${runs}</w:p>`;
 }
 function cell(content,width,opts={}){
   const body=Array.isArray(content)?content.join(""):(String(content??"").trim().startsWith("<w:")?String(content):p(content));
   const fill=opts.fill?`<w:shd w:val="clear" w:color="auto" w:fill="${opts.fill}"/>`:"",vAlign=opts.vAlign?`<w:vAlign w:val="${opts.vAlign}"/>`:"",span=opts.gridSpan?`<w:gridSpan w:val="${opts.gridSpan}"/>`:"";
   return `<w:tc><w:tcPr>${width?`<w:tcW w:w="${width}" w:type="dxa"/>`:""}${fill}${vAlign}${span}<w:tcMar><w:top w:w="${opts.padY||100}" w:type="dxa"/><w:left w:w="${opts.padX||130}" w:type="dxa"/><w:bottom w:w="${opts.padY||100}" w:type="dxa"/><w:right w:w="${opts.padX||130}" w:type="dxa"/></w:tcMar></w:tcPr>${body}</w:tc>`;
 }
 function table(rows,widths=[],opts={}){
   const noBorders=opts.noBorders?`<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>`:"";
   return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/>${noBorders}</w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.map(r=>`<w:tr>${r.map((c,i)=>{const obj=c&&typeof c==="object"&&!Array.isArray(c)&&Object.prototype.hasOwnProperty.call(c,"content")?c:{content:c};return cell(obj.content,widths[i],obj)}).join("")}</w:tr>`).join("")}</w:tbl>`;
 }
 async function fetchBytes(url){const r=await fetch(url);if(!r.ok)throw new Error("이미지를 읽지 못했습니다: "+url);return new Uint8Array(await r.arrayBuffer())}
 function dataBytes(url){return YP.dataURLToUint8(url)}
 function imageDrawing(rid,id,widthPx,heightPx,alt,maxInches=6.25,maxHeightInches=7.2){
   const maxCx=maxInches*914400,maxCy=maxHeightInches*914400,rawCx=widthPx*9525,rawCy=heightPx*9525,scale=Math.min(1,maxCx/rawCx,maxCy/rawCy),cx=Math.round(rawCx*scale),cy=Math.round(rawCy*scale);
   return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}" descr="${esc(alt)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
 }
 async function exportReport(ctx){
   const {exam,record,stats}=ctx,history=ctx.history||(YP.computeHistorySummary?YP.computeHistorySummary(exam,record,ctx.historyRecords||[]):null),files=[],rels=[`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>`],body=[];let imgNo=0,relNo=3;
   async function addImage(bytes,w,h,alt,maxInches=6.25,maxHeightInches=7.2){
     imgNo++;const rid=`rId${relNo++}`,name=`image${imgNo}.png`;files.push({name:`word/media/${name}`,data:bytes});rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);return imageDrawing(rid,imgNo,w,h,alt,maxInches,maxHeightInches);
   }
   function choiceTable(config){
     const normalized=YP.normalizeChoiceChallenge?YP.normalizeChoiceChallenge(config||{}):config||{},choices=Array.isArray(normalized.choices)?normalized.choices:[];
     if(!normalized.valid||choices.length<4)return null;
     return table([[p("보기","",{bold:true}),p("내용","",{bold:true})],...choices.map((choice,i)=>[p(YP.choiceLabel?YP.choiceLabel(i+1):String(i+1)),p(choice)])],[900,7100]);
   }
   const logo=await YP.loadImage("assets/images/logo.png"),logoDrawing=await addImage(await fetchBytes("assets/images/logo.png"),logo.naturalWidth,logo.naturalHeight,"Young's Physics 로고",1.85,0.9),isTotal=YP.isComprehensive&&YP.isComprehensive(exam),avgGap=record.percent-(stats.averagePercent||0),standing=YP.computeTopStanding?YP.computeTopStanding(record.score,stats):null,showStanding=!!(isTotal&&standing&&standing.eligible),scoreMessage=record.percent>=90?"개념 이해와 문제 적용력이 매우 안정적입니다.":record.percent>=80?"핵심 개념이 탄탄하며 일부 취약 문항을 보완하면 좋습니다.":record.percent>=65?"기본 개념은 형성되어 있으며 우선 단원 복습이 필요합니다.":"핵심 개념부터 순서대로 다시 연결하는 학습이 필요합니다.";
   body.push(table([[
     {content:logoDrawing,vAlign:"center",padX:90,padY:60},
     {content:[p("YOUNG'S PHYSICS PERFORMANCE REPORT","",{bold:true,color:"0866E5",size:16}),p(isTotal?"복습·총괄 통합 성적 리포트":"주간 기본 복습 테스트 성적 분석 리포트","",{bold:true,color:"06265D",size:34}),p(exam.title,"",{bold:true,color:"0866E5",size:23})],vAlign:"center",padX:150,padY:80}
   ]],[3000,6200],{noBorders:true}));
   body.push(p("데이터 기반 맞춤 분석으로, 정확히 이해하고 확실히 성장합니다.","",{align:"center",color:"66758E",size:18}));
   body.push(table([
     [{content:p("학생","",{bold:true,color:"06265D"}),fill:"F0F6FD"},p(record.name),{content:p("학교","",{bold:true,color:"06265D"}),fill:"F0F6FD"},p((YP.normalizeSchool?YP.normalizeSchool(record.school):(record.school||"미기입")))],
     [{content:p("과정·회차","",{bold:true,color:"06265D"}),fill:"F0F6FD"},p(YP.roundLabel(exam)),{content:p("학년·반","",{bold:true,color:"06265D"}),fill:"F0F6FD"},p(`${record.grade||"-"}학년 ${record.classNo||""}`)]
   ],[1300,3000,1500,3000]));
   body.push(table([[
     {content:[p("종합 점수","",{bold:true,color:"DCEBFF",size:20}),p(`${YP.formatNumber(record.score)} / ${exam.maxScore}`,"",{bold:true,color:"FFFFFF",size:46}),p(scoreMessage,"",{color:"EAF4FF",size:18})],fill:"0866E5",vAlign:"center",padX:220,padY:180},
     {content:[p("성취율","",{bold:true,color:"CFE5FF",size:17}),p(`${record.percent.toFixed(1)}%`,"",{bold:true,color:"FFFFFF",size:31}),p("전체 평균 대비","",{bold:true,color:"CFE5FF",size:17}),p(`${avgGap>=0?"+":""}${YP.formatNumber(avgGap)}%p`,"",{bold:true,color:"FFFFFF",size:27}),...(showStanding?[p("동일 평가 내 위치","",{bold:true,color:"FFE9A6",size:16}),p(standing.label,"",{bold:true,color:"FFF6D4",size:27}),p(`${standing.total}명 기준${standing.tied>1?` · 공동 ${standing.tied}명`:""}`,"",{color:"F6E9BE",size:14})]:[]),p(`전체 평균 ${YP.formatNumber(stats.average)}점 · ${stats.count}명`,"",{color:"DCEBFF",size:16})],fill:"063B8C",vAlign:"center",padX:180,padY:150}
   ]],[5100,3100],{noBorders:true}));
   body.push(p(isTotal?"총괄평가 종합 분석":"종합 분석","Heading1"));body.push(p(YP.buildComment(exam,record,stats,history),"Quote"));
   const scoreCanvas=document.getElementById("scoreChart"),distCanvas=document.getElementById("distChart");
   if(scoreCanvas)body.push(await addImage(dataBytes(scoreCanvas.toDataURL("image/png")),scoreCanvas.width,scoreCanvas.height,"점수 비교 그래프"));
   if(distCanvas)body.push(await addImage(dataBytes(distCanvas.toDataURL("image/png")),distCanvas.width,distCanvas.height,"점수 분포 그래프"));
   if(YP.isComprehensive&&YP.isComprehensive(exam)){
     body.push(p("기존 복습 테스트와 총괄평가 통합 분석","Heading1"));
     if(history&&history.count){
       const gap=record.percent-history.percent;
       body.push(p(`${exam.historyLabel||"연결 복습 테스트"} 중 ${history.count}/${history.expectedCount||history.count}회가 같은 과정·학교·학생 이름으로 연결되었습니다.`,"Quote"));
       body.push(table([
         [p("복습 누적","",{bold:true}),p(`${YP.formatNumber(history.score)} / ${history.maxScore}점 (${YP.formatNumber(history.percent)}%)`),p("총괄평가","",{bold:true}),p(`${YP.formatNumber(record.score)} / ${exam.maxScore}점 (${record.percent.toFixed(1)}%)`)],
         [p("총괄-복습 차이","",{bold:true}),p(`${gap>=0?"+":""}${YP.formatNumber(gap)}%p`),p("연결 회차","",{bold:true}),p(`${history.count}회`)]
       ],[1600,2700,1600,2700]));
       const historyCanvas=document.getElementById("historyTrendChart");
       if(historyCanvas)body.push(await addImage(dataBytes(historyCanvas.toDataURL("image/png")),historyCanvas.width,historyCanvas.height,"복습 테스트와 총괄평가 성취율 흐름"));
       body.push(p("연결 회차별 성취율","Heading2"));
       body.push(table([[p("회차","",{bold:true}),p("점수","",{bold:true}),p("성취율","",{bold:true})],...history.trend.map(t=>[p(t.label),p(`${YP.formatNumber(t.score)} / ${t.maxScore}`),p(`${YP.formatNumber(t.percent)}%`)])],[2600,2800,2200]));
       if(history.units&&history.units.length){
         body.push(p("복습 테스트 누적 강점·보완","Heading2"));
         body.push(table([[p("단원","",{bold:true}),p("누적 점수","",{bold:true}),p("성취율","",{bold:true}),p("판정","",{bold:true})],...history.units.slice(0,10).map(u=>[p(u.unit),p(`${YP.formatNumber(u.score)} / ${u.maxPoints}`),p(`${YP.formatNumber(u.percent)}%`),p(u.level)])],[3100,2100,1600,1500]));
       }
     }else{
       body.push(p(`${exam.historyLabel||"연결 대상 복습 테스트"}에 같은 학교·이름으로 저장된 기록이 아직 없어 현재 총괄평가만으로 분석했습니다. 이후 복습 결과가 저장되면 학생 링크에서 자동으로 누적 분석됩니다.`,"Quote"));
     }
   }
   body.push(p(YP.isComprehensive&&YP.isComprehensive(exam)?"총괄평가 단원별 분석":"단원별 분석","Heading1"));
   const units=YP.computeStudentUnits(exam,record,stats);
   body.push(table([[p("단원","",{bold:true}),p("학생","",{bold:true}),p("전체 평균","",{bold:true}),p("판정","",{bold:true})],...units.map(u=>[p(u.unit),p(`${u.percent.toFixed(1)}% (${YP.formatNumber(u.score)}/${u.maxPoints})`),p(`${u.averagePercent.toFixed(1)}%`),p(u.level)])],[2700,2300,2300,1500]));
   const unitRadar=document.getElementById("unitRadarChart");if(unitRadar)body.push(await addImage(dataBytes(unitRadar.toDataURL("image/png")),unitRadar.width,unitRadar.height,"단원별 성취도 레이더 그래프",5.7));
   body.push(p("문항별 분석","Heading1"));
   body.push(table([[p("문항","",{bold:true}),p("단원·개념","",{bold:true}),p("배점","",{bold:true}),p("학생","",{bold:true}),p("상태","",{bold:true}),p("전체 평균","",{bold:true})],
     ...exam.questions.map((q,i)=>{const s=record.scoring[i],a=stats.perQuestion?.[i]?.average??0;return [p(String(q.no)),p(`${q.unit} · ${q.topic}`),p(String(q.maxPoints)),p(s.score==null?"-":YP.formatNumber(s.score)),p(YP.statusLabel(s.status)),p(YP.formatNumber(a))]})
   ],[700,3200,800,900,1200,1200]));
   const targets=exam.questions.map((q,i)=>({q,s:record.scoring[i]})).filter(x=>["wrong","partial"].includes(x.s.status));
   if(targets.length)body.push(p("오답·부분점수 보완 학습","Heading1",{pageBreakBefore:true}));
   for(const {q,s} of targets){
     body.push(p(`${q.no}번 · ${q.unit} / ${q.topic}`,"Heading2"));
     body.push(p(`학생 획득: ${YP.formatNumber(s.score||0)} / ${q.maxPoints}점 · ${YP.statusLabel(s.status)}`));
     const dataURL=await YP.cropDataURL(exam,q,1),tmp=await YP.loadImage(dataURL);body.push(await addImage(dataBytes(dataURL),tmp.naturalWidth,tmp.naturalHeight,`${q.no}번 원문 문제`,5.8,4.4));
     if(q.correctionNote)body.push(p(`검수 메모: ${q.correctionNote}`,"Quote"));
     if(["ambiguous","needs-review"].includes(q.reviewStatus)){body.push(p("확인 필요: 원문 조건 부족 또는 복수 해석 가능성으로 공식 정답·해설 자동 공개를 보류했습니다."));continue}
     const originalChoices=choiceTable(q.originalRetry);if(originalChoices){body.push(p("원문 문제 객관식 재도전 보기","Heading3"));body.push(originalChoices);body.push(p("※ 학생 링크에서는 보기를 선택해 제출한 뒤 정답과 해설이 공개됩니다.","Quote"))}
     body.push(p("검수된 정답·모범답안","Heading3"));body.push(p(q.answer));
     body.push(p("풀이","Heading3"));q.explanation.forEach((x,i)=>body.push(p(`${i+1}. ${x}`)));
     body.push(p("필요한 공식","Heading3"));q.formulas.forEach(x=>body.push(p(`• ${x}`)));
     body.push(p("자주 하는 실수","Heading3"));q.commonMistakes.forEach(x=>body.push(p(`• ${x}`)));
     body.push(p("부분점수 기준","Heading3"));body.push(table([[p("평가 요소","",{bold:true}),p("점수","",{bold:true})],...q.rubric.map(r=>[p(r.criterion),p(`${r.points}점`)])],[6500,1500]));
     body.push(p("새 동형 문제","Heading3"));body.push(p(q.similarProblem.prompt));const similarChoices=choiceTable(q.similarProblem);if(similarChoices)body.push(similarChoices);body.push(p("※ 동형 문제도 객관식 보기를 선택해 제출한 뒤 정답과 해설을 확인합니다.","Quote"));
   }
   body.push(p("회차 핵심 개념·공식","Heading1"));body.push(p(exam.coreNote.summary));
   [["반드시 알아야 할 개념",exam.coreNote.concepts],["핵심 공식",exam.coreNote.formulas],["자주 하는 실수",exam.coreNote.mistakes],["시험 전 5분 체크",exam.coreNote.checklist]].forEach(([t,items])=>{body.push(p(t,"Heading2"));items.forEach(x=>body.push(p(`• ${x}`)))});
   body.push(p("검수 정보","Heading1"));body.push(p(`${YP.reviewLabel(exam.reviewStatus)} · 원문 시험지의 조건, 그림, 수식, 정답과 배점을 검수한 데이터입니다.`));
   body.push(`<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="850" w:bottom="900" w:left="850" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>`);
   const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join("")}</w:body></w:document>`;
   const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
   <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:eastAsia="Malgun Gothic" w:hAnsi="Aptos"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="280" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
   <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:color w:val="14213D"/></w:rPr></w:style>
   <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="100"/></w:pPr><w:rPr><w:b/><w:color w:val="06265D"/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr></w:style>
   <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="0866E5"/><w:sz w:val="25"/><w:szCs w:val="25"/></w:rPr></w:style>
   <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="130"/><w:pBdr><w:bottom w:val="single" w:sz="14" w:space="5" w:color="D7E8FA"/></w:pBdr></w:pPr><w:rPr><w:b/><w:color w:val="06265D"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
   <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="90"/></w:pPr><w:rPr><w:b/><w:color w:val="0866E5"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
   <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="70"/></w:pPr><w:rPr><w:b/><w:color w:val="344054"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>
   <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="220" w:right="120"/><w:spacing w:before="80" w:after="120"/><w:shd w:fill="EEF7FF"/><w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="0866E5"/></w:pBdr></w:pPr><w:rPr><w:color w:val="334B68"/></w:rPr></w:style>
   <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="C7D6E8"/><w:left w:val="single" w:sz="4" w:color="C7D6E8"/><w:bottom w:val="single" w:sz="4" w:color="C7D6E8"/><w:right w:val="single" w:sz="4" w:color="C7D6E8"/><w:insideH w:val="single" w:sz="4" w:color="DCE6F2"/><w:insideV w:val="single" w:sz="4" w:color="DCE6F2"/></w:tblBorders></w:tblPr></w:style></w:styles>`;
   const relsXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`;
   const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
   const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
   const core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(exam.title)} - ${esc(record.name)}</dc:title><dc:creator>Young's Physics</dc:creator><cp:lastModifiedBy>Young's Physics</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`;
   const app=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Young's Physics Weekly Review</Application></Properties>`;
   files.push({name:"[Content_Types].xml",data:contentTypes},{name:"_rels/.rels",data:rootRels},{name:"word/document.xml",data:documentXml},{name:"word/styles.xml",data:styles},{name:"word/settings.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="90"/><w:defaultTabStop w:val="720"/></w:settings>`},{name:"word/_rels/document.xml.rels",data:relsXml},{name:"docProps/core.xml",data:core},{name:"docProps/app.xml",data:app});
   const blob=makeZip(files);YP.downloadBlob(blob,`${record.name}_${YP.roundLabel(exam).replace(/\s/g,"_")}_성적리포트.docx`);
 }
 window.YoungsDocx={exportReport};
})();