(function(){
 const YP={};
 YP.catalog=window.YP_CATALOG;
 YP.config=window.YP_CONFIG;
 YP.getCourse=id=>YP.catalog.courses.find(c=>c.courseId===id);
 YP.getExam=id=>YP.catalog.exams.find(e=>e.examId===id);
 YP.readyExams=()=>YP.catalog.exams.filter(e=>e.status==="ready");
 YP.isComprehensive=ex=>ex?.assessmentType==="comprehensive";
 YP.parseQuestionRange=value=>{
   const m=String(value||"").trim().match(/^(\d+)\s*(?:-|~|–|—)\s*(\d+)$/);
   if(!m)return null;
   const start=Number(m[1]),end=Number(m[2]);
   return Number.isInteger(start)&&Number.isInteger(end)&&start>0&&end>=start?{start,end}:null;
 };
 YP.objectiveChoiceRange=ex=>{
   if(!YP.isComprehensive(ex))return null;
   const profile=ex?.inputProfile||{};
   if(String(profile.objectiveMode||"")!=="choice-number")return null;
   return YP.parseQuestionRange(profile.objectiveRange);
 };
 YP.usesObjectiveChoiceNumbers=ex=>!!YP.objectiveChoiceRange(ex);
 YP.choiceLabel=n=>["","①","②","③","④","⑤"][Number(n)]||String(n??"");
 YP.applyExamInputPolicy=function(exam){
   if(!exam||!Array.isArray(exam.questions))return exam;
   const range=YP.objectiveChoiceRange(exam);
   if(range){
     exam.inputProfile={...(exam.inputProfile||{}),objectiveMode:"choice-number"};
     exam.questions.forEach(q=>{
       const no=Number(q?.no);
       if(Number.isInteger(no)&&no>=range.start&&no<=range.end){q.inputMode="objective-choice";q.type="objective"}
     });
   }
   return exam;
 };
 YP.roundLabel=ex=>YP.isComprehensive(ex)?`${YP.getCourse(ex.courseId)?.courseName||ex.courseId} · ${ex.shortTitle||ex.title}`:`${YP.getCourse(ex.courseId)?.courseName||ex.courseId} ${ex.round}회`;
 YP.escapeHTML=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
 YP.formatNumber=(n,d=1)=>Number(n||0).toLocaleString("ko-KR",{maximumFractionDigits:d,minimumFractionDigits:Number.isInteger(Number(n))?0:Math.min(d,1)});
 YP.statusLabel=s=>({full:"만점",partial:"부분점수",wrong:"0점",ungraded:"미입력",invalid:"오류"}[s]||s);
 YP.reviewLabel=s=>({verified:"검증 완료",corrected:"교정 적용",ambiguous:"확인 필요","needs-review":"확인 필요","not-uploaded":"자료 준비 중"}[s]||s);
 YP.normalizeIdentity=s=>String(s??"").trim().toLowerCase().replace(/\s+/g,"").replace(/[()\[\]{}\-_.]/g,"");
 YP.normalizeSchool=s=>{const v=String(s??"").trim();return !v||v==="미입력"||v==="미기입"?"미기입":v};
 YP.studentKey=(courseId,school,name)=>[courseId,YP.normalizeIdentity(YP.normalizeSchool(school)),YP.normalizeIdentity(name)].join("|");
 YP.safeJSON=function(value,fallback){if(value&&typeof value==="object")return value;try{return JSON.parse(String(value||""))}catch(e){return fallback}};
 YP.clone=function(value){return value==null?value:JSON.parse(JSON.stringify(value))};
 /** Google Sheets Questions 행을 정적 카탈로그 문항 형식으로 변환한다. 빈 JSON은 정적 기본값을 보존한다. */
 YP.questionRowToClient=function(row,fallback={}){
   if(!row||typeof row!=="object")return YP.clone(fallback);
   const answer=YP.safeJSON(row.AnswerJSON,{}),rubric=YP.safeJSON(row.RubricJSON,null),explain=YP.safeJSON(row.ExplanationJSON,{}),original=YP.safeJSON(row.OriginalRetryJSON,null),similar=YP.safeJSON(row.SimilarProblemJSON,null),image=YP.safeJSON(row.ImageJSON,null);
   const q={...YP.clone(fallback)};
   const number=Number(row.QuestionNo??row.no);if(Number.isFinite(number)&&number>0)q.no=number;
   if(row.Type)q.type=String(row.Type);if(row.InputMode)q.inputMode=String(row.InputMode);
   if(row.MaxPoints!==""&&row.MaxPoints!=null&&Number.isFinite(Number(row.MaxPoints)))q.maxPoints=Number(row.MaxPoints);
   if(row.Unit)q.unit=String(row.Unit);if(row.Topic)q.topic=String(row.Topic);if(row.Difficulty)q.difficulty=String(row.Difficulty);
   if(answer&&Object.keys(answer).length){if(answer.display!==undefined)q.answer=answer.display;if(answer.answerKey!==undefined&&answer.answerKey!==null&&answer.answerKey!=="")q.answerKey=Number(answer.answerKey);if(Array.isArray(answer.acceptableAnswers))q.acceptableAnswers=answer.acceptableAnswers}
   if(Array.isArray(rubric))q.rubric=rubric;
   if(explain&&Object.keys(explain).length){if(Array.isArray(explain.steps))q.explanation=explain.steps;if(Array.isArray(explain.formulas))q.formulas=explain.formulas;if(Array.isArray(explain.commonMistakes))q.commonMistakes=explain.commonMistakes}
   if(original&&Object.keys(original).length)q.originalRetry=original;
   if(similar&&Object.keys(similar).length)q.similarProblem=similar;
   if(image&&Object.keys(image).length)q.image=image;
   if(row.ReviewStatus)q.reviewStatus=String(row.ReviewStatus);if(row.CorrectionNote!==undefined&&row.CorrectionNote!=="")q.correctionNote=String(row.CorrectionNote);
   if(row.OverrideUpdatedAt)q.answerOverrideUpdatedAt=String(row.OverrideUpdatedAt);
   return q;
 };
 YP.mergeExamQuestions=function(exam,rows){
   const out=YP.clone(exam);if(!out||!Array.isArray(out.questions)||!Array.isArray(rows)||!rows.length)return out;
   const byNo=new Map(rows.map(r=>[Number(r.QuestionNo??r.no),r]));
   out.questions=out.questions.map(q=>YP.questionRowToClient(byNo.get(Number(q.no)),q));
   out.questionCount=out.questions.length;out.maxScore=out.questions.reduce((a,q)=>a+Number(q.maxPoints||0),0);return YP.applyExamInputPolicy(out);
 };
 YP.checkChoiceAnswer=function(input,config){const value=Number(String(input??"").trim()),correct=Number(config?.correctChoice||config?.answer||0);return Number.isFinite(value)&&Number.isFinite(correct)&&value>0&&correct>0?value===correct:null};

 YP.parseScoreInput=function(raw,maxPoints,partialMode=false){
   const original=raw==null?"":String(raw),value=original.trim();
   if(value==="")return {raw:original,status:"ungraded",score:null,valid:true,message:"미입력"};
   if(/^p\s*1$/i.test(value)||value==="1점")return maxPoints>=1?{raw:original,status:maxPoints===1?"full":"partial",score:1,valid:true,message:maxPoints===1?"만점":"1점 부분점수"}:{raw:original,status:"invalid",score:null,valid:false,message:"배점 오류"};
   const n=Number(value.replace(/,/g,""));
   if(!Number.isFinite(n))return {raw:original,status:"invalid",score:null,valid:false,message:"숫자, 0, 1 또는 P1을 입력하세요."};
   if(n<0)return {raw:original,status:"invalid",score:null,valid:false,message:"음수는 입력할 수 없습니다."};
   if(n>maxPoints+1e-9)return {raw:original,status:"invalid",score:null,valid:false,message:`최대 배점 ${maxPoints}점을 초과했습니다.`};
   if(n===0)return {raw:original,status:"wrong",score:0,valid:true,message:"오답·0점"};
   if(n===1&&!partialMode)return {raw:original,status:"full",score:maxPoints,valid:true,message:`정답·${maxPoints}점`};
   if(Math.abs(n-maxPoints)<1e-9)return {raw:original,status:"full",score:maxPoints,valid:true,message:`만점·${maxPoints}점`};
   return {raw:original,status:"partial",score:n,valid:true,message:`부분점수 ${n}점`};
 };
 YP.parseQuestionInput=function(raw,q,partialMode=false){
   const original=raw==null?"":String(raw),value=original.trim(),mode=q.inputMode||"achievement";
   if(mode==="achievement")return YP.parseScoreInput(raw,q.maxPoints,partialMode);
   if(value==="")return {raw:original,status:"ungraded",score:null,valid:true,message:"미입력"};
   if(mode==="objective-choice"){
     const marker=value.toLowerCase().replace(/\s+/g,"");
     if(["o","○","⭕","맞음","정답","correct","true"].includes(marker))return {raw:original,status:"full",score:q.maxPoints,valid:true,message:`구형 정오표 · 정답 · ${q.maxPoints}점`,answerKey:Number(q.answerKey)||null,legacyMarker:"O"};
     if(["x","×","✕","틀림","오답","wrong","false","0"].includes(marker))return {raw:original,status:"wrong",score:0,valid:true,message:"구형 정오표 · 오답 · 0점",answerKey:Number(q.answerKey)||null,legacyMarker:"X"};
     const selected=Number(value.replace(/,/g,"")),answerKey=Number(q.answerKey);
     if(!Number.isInteger(selected)||selected<1||selected>5)return {raw:original,status:"invalid",score:null,valid:false,message:"객관식 선택 번호는 1~5 중 하나여야 합니다."};
     if(!Number.isInteger(answerKey)||answerKey<1||answerKey>5)return {raw:original,status:"invalid",score:null,valid:false,message:"이 문항의 공식 정답 번호를 찾지 못했습니다."};
     const correct=selected===answerKey;
     return {raw:original,status:correct?"full":"wrong",score:correct?q.maxPoints:0,valid:true,message:correct?`선택 ${YP.choiceLabel(selected)} · 정답 · ${q.maxPoints}점`:`선택 ${YP.choiceLabel(selected)} · 오답 (정답 ${YP.choiceLabel(answerKey)})`,selectedChoice:selected,answerKey};
   }
   const n=Number(value.replace(/,/g,""));
   if(!Number.isFinite(n))return {raw:original,status:"invalid",score:null,valid:false,message:mode==="binary"?"객관식은 0 또는 1만 입력하세요.":`0~${q.maxPoints}점 숫자를 입력하세요.`};
   if(mode==="binary"){
     if(n===0)return {raw:original,status:"wrong",score:0,valid:true,message:"오답·0점"};
     if(n===1)return {raw:original,status:"full",score:q.maxPoints,valid:true,message:`정답·${q.maxPoints}점`};
     return {raw:original,status:"invalid",score:null,valid:false,message:"객관식 1~20번은 0(오답) 또는 1(정답)만 입력하세요."};
   }
   if(n<0||n>q.maxPoints)return {raw:original,status:"invalid",score:null,valid:false,message:`서술형 점수는 0~${q.maxPoints}점이어야 합니다.`};
   if(n===0)return {raw:original,status:"wrong",score:0,valid:true,message:"0점"};
   if(Math.abs(n-q.maxPoints)<1e-9)return {raw:original,status:"full",score:q.maxPoints,valid:true,message:`만점·${q.maxPoints}점`};
   return {raw:original,status:"partial",score:n,valid:true,message:`부분점수 ${n}점`};
 };
 YP.calculateResult=function(exam,rawInputs,partialModes=[]){
   exam=YP.applyExamInputPolicy(exam);
   const scoring=exam.questions.map((q,i)=>({...YP.parseQuestionInput(rawInputs[i],q,!!partialModes[i]),questionNo:q.no,maxPoints:q.maxPoints,unit:q.unit,topic:q.topic,inputMode:q.inputMode||"achievement"}));
   const valid=scoring.every(x=>x.valid),score=scoring.reduce((a,x)=>a+(x.score??0),0),counts={full:0,partial:0,wrong:0,ungraded:0,invalid:0};
   scoring.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);
   return {valid,score,maxScore:exam.maxScore,percent:exam.maxScore?score/exam.maxScore*100:0,counts,scoring,rawInputs:[...rawInputs],partialModes:[...partialModes]};
 };

 YP.parseDelimited=function(text){const t=String(text??"").replace(/\r/g,"");if(t.includes("\t"))return t.split(/\t|\n/);if(t.includes(","))return t.split(",");return t.split("\n")};
 YP.csvParse=function(text){const rows=[];let row=[],field="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quoted&&n==='"'){field+='"';i++;continue}if(c==='"'){quoted=!quoted;continue}if(c===","&&!quoted){row.push(field);field="";continue}if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&n==="\n")i++;row.push(field);field="";if(row.some(v=>v!==""))rows.push(row);row=[];continue}field+=c}row.push(field);if(row.some(v=>v!==""))rows.push(row);return rows};
 YP.csvEscape=v=>{const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
 YP.downloadBlob=function(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)};
 YP.copyText=async function(text){try{await navigator.clipboard.writeText(text);return true}catch(e){const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();const ok=document.execCommand("copy");ta.remove();return ok}};
 YP.toast=function(message,ms=3000){const el=document.getElementById("toast");if(!el)return;el.textContent=message;el.classList.remove("hidden");clearTimeout(YP._toastTimer);YP._toastTimer=setTimeout(()=>el.classList.add("hidden"),ms)};

 YP.normalizeRecord=function(record){
   const exam=YP.applyExamInputPolicy(YP.getExam(record.examId)),school=YP.normalizeSchool(record.school);if(!exam)return {...record,school};
   const inputs=[...(record.resultInputs||[])];
   if(YP.usesObjectiveChoiceNumbers(exam)&&(record.inputEncoding==="legacy-binary"||(!record.inputEncoding&&Array.isArray(record.scoring)&&record.scoring.length))){
     exam.questions.forEach((q,i)=>{if(q.inputMode!=="objective-choice")return;const score=record.scoring?.[i];if(score&&["full","wrong"].includes(score.status)&&["0","1"].includes(String(inputs[i]??"").trim()))inputs[i]=score.status==="full"?"O":"X"});
   }
   const result=YP.calculateResult(exam,inputs,record.partialModes||[]);return {...record,school,courseId:exam.courseId,score:result.score,maxScore:exam.maxScore,percent:result.percent,scoring:result.scoring,counts:result.counts,studentKey:YP.studentKey(exam.courseId,school,record.name)}
 };
 YP.computeStats=function(exam,records){
   const valid=(records||[]).map(YP.normalizeRecord).filter(r=>r.examId===exam.examId&&r.scoring&&Number.isFinite(Number(r.score))),n=valid.length;
   const scores=valid.map(r=>Number(r.score)).sort((a,b)=>a-b),average=n?scores.reduce((a,b)=>a+b,0)/n:0,median=n?(n%2?scores[(n-1)/2]:(scores[n/2-1]+scores[n/2])/2):0;
   const perQuestion=exam.questions.map((q,i)=>{const vals=valid.map(r=>Number(r.scoring[i]?.score??0)),states=valid.map(r=>r.scoring[i]?.status);return {questionNo:q.no,average:n?vals.reduce((a,b)=>a+b,0)/n:0,maxPoints:q.maxPoints,fullRate:n?states.filter(s=>s==="full").length/n*100:0,wrongRate:n?states.filter(s=>s==="wrong").length/n*100:0,partialRate:n?states.filter(s=>s==="partial").length/n*100:0}});
   const units=[...new Set(exam.questions.map(q=>q.unit))].map(unit=>{const idx=exam.questions.map((q,i)=>q.unit===unit?i:-1).filter(i=>i>=0),max=idx.reduce((a,i)=>a+exam.questions[i].maxPoints,0),avg=n?valid.reduce((sum,r)=>sum+idx.reduce((a,i)=>a+Number(r.scoring[i]?.score??0),0),0)/n:0;return {unit,maxPoints:max,averageScore:avg,averagePercent:max?avg/max*100:0}});
   return {count:n,average,averagePercent:exam.maxScore?average/exam.maxScore*100:0,median,highest:n?Math.max(...scores):0,lowest:n?Math.min(...scores):0,scoreList:scores,perQuestion,units};
 };
 /**
  * 동일 평가 내 상위 비율을 계산한다.
  * 동점자는 자신보다 높은 점수의 학생 수를 기준으로 같은 경쟁 순위를 적용한다.
  * 상위 비율 = 공동 석차 ÷ 동일 평가 응시 인원 × 100이다.
  */
 YP.computeTopStanding=function(studentScore,statsOrScores){
   const score=Number(studentScore),source=Array.isArray(statsOrScores)?statsOrScores:(Array.isArray(statsOrScores?.scoreList)?statsOrScores.scoreList:[]);
   let scores=source.map(Number).filter(Number.isFinite),count=scores.length;
   if(!Number.isFinite(score)||!count)return null;
   const epsilon=1e-9;let tied=scores.filter(v=>Math.abs(v-score)<=epsilon).length;
   // 저장 직후 통계 갱신이 지연되어 현재 학생이 목록에 없으면 한 번만 보완한다.
   if(!tied){scores=[...scores,score];count=scores.length;tied=1}
   const higher=scores.filter(v=>v>score+epsilon).length,rank=higher+1,exactPercent=rank/count*100,topPercent=Math.round(exactPercent*10)/10;
   return {eligible:count>=2&&exactPercent<=50+epsilon,count,total:count,higher,tied,rank,exactPercent,topPercent,label:`상위 ${YP.formatNumber(topPercent)}%`};
 };
 YP.computeStudentUnits=function(exam,record,stats){return [...new Set(exam.questions.map(q=>q.unit))].map(unit=>{const idx=exam.questions.map((q,i)=>q.unit===unit?i:-1).filter(i=>i>=0),max=idx.reduce((a,i)=>a+exam.questions[i].maxPoints,0),score=idx.reduce((a,i)=>a+Number(record.scoring[i]?.score??0),0),avg=stats?.units?.find(u=>u.unit===unit)?.averagePercent??0,percent=max?score/max*100:0;return {unit,score,maxPoints:max,percent,averagePercent:avg,questionCount:idx.length,level:percent>=85?"강점":percent>=65?"안정":percent>=45?"보완":"우선 보완"}})};
 YP.getLinkedHistory=function(exam,record,records){if(!YP.isComprehensive(exam)||!exam.historyExamIds?.length)return [];const key=YP.studentKey(exam.courseId,record.school,record.name);return (records||[]).map(YP.normalizeRecord).filter(r=>exam.historyExamIds.includes(r.examId)&&YP.studentKey(r.courseId,r.school,r.name)===key).sort((a,b)=>{const ea=YP.getExam(a.examId),eb=YP.getExam(b.examId);return (ea?.round||0)-(eb?.round||0)})};
 YP.computeHistorySummary=function(exam,record,records){
   const linked=YP.getLinkedHistory(exam,record,records);let earned=0,max=0;const unitMap=new Map();
   linked.forEach(r=>{earned+=Number(r.score||0);max+=Number(r.maxScore||0);const ex=YP.getExam(r.examId);(ex?.questions||[]).forEach((q,i)=>{const u=unitMap.get(q.unit)||{unit:q.unit,score:0,maxPoints:0,questionCount:0};u.score+=Number(r.scoring?.[i]?.score??0);u.maxPoints+=q.maxPoints;u.questionCount++;unitMap.set(q.unit,u)})});
   const units=[...unitMap.values()].map(u=>({...u,percent:u.maxPoints?u.score/u.maxPoints*100:0,level:(u.maxPoints?u.score/u.maxPoints*100:0)>=85?"강점":(u.maxPoints?u.score/u.maxPoints*100:0)>=65?"안정":(u.maxPoints?u.score/u.maxPoints*100:0)>=45?"보완":"우선 보완"})).sort((a,b)=>b.percent-a.percent);
   const trend=linked.map(r=>({examId:r.examId,label:`${YP.getExam(r.examId)?.round||""}회`,percent:r.percent,score:r.score,maxScore:r.maxScore}));
   return {records:linked,count:linked.length,score:earned,maxScore:max,percent:max?earned/max*100:0,units,trend,expectedCount:exam.historyExamIds?.length||0,coverage:exam.historyExamIds?.length?linked.length/exam.historyExamIds.length*100:0};
 };
 YP.buildComment=function(exam,record,stats,history){
   const units=YP.computeStudentUnits(exam,record,stats).sort((a,b)=>b.percent-a.percent),best=units[0],weak=[...units].sort((a,b)=>a.percent-b.percent)[0],partial=record.scoring.filter(x=>x.status==="partial").map(x=>x.questionNo),wrong=record.scoring.filter(x=>x.status==="wrong").map(x=>x.questionNo),avgDiff=record.percent-(stats?.averagePercent||0);
   let lead=avgDiff>=10?"총괄평가에서 전체 평균보다 높은 성취를 보였습니다.":avgDiff>=-5?"총괄평가 성취가 전체 평균과 비슷한 범위입니다.":"총괄평가 성취가 전체 평균보다 낮아 핵심 개념부터 순서대로 보완하는 것이 좋습니다.";
   let historyText="";if(history?.count){const gap=record.percent-history.percent;historyText=`연결된 복습 테스트 ${history.count}회의 평균 성취율은 ${YP.formatNumber(history.percent)}%이며, 총괄평가는 이에 비해 ${gap>=0?"높은":"낮은"} ${YP.formatNumber(Math.abs(gap))}%p입니다. `}else if(YP.isComprehensive(exam))historyText=`연결 대상 복습 테스트(${exam.historyLabel})의 동일 학생 기록이 아직 없어 현재 총괄평가만으로 분석했습니다. `;
   return `${lead} ${historyText}${best?`${best.unit} 영역은 ${YP.formatNumber(best.percent)}%로 가장 안정적입니다. `:""}${weak&&weak!==best?`${weak.unit} 영역은 ${YP.formatNumber(weak.percent)}%로 우선 복습이 필요합니다. `:""}${wrong.length?`먼저 ${wrong.slice(0,6).join(", ")}번 오답을 원문 재도전한 뒤 풀이를 확인하세요. `:"0점 문항 없이 풀이를 마쳤습니다. "}${partial.length?`${partial.slice(0,5).join(", ")}번 서술형은 부분점수 기준에서 빠진 단계를 채우는 연습이 필요합니다.`:""}`;
 };

 YP.normalizeAnswer=s=>String(s??"").toLowerCase().replace(/\s+/g,"").replace(/[㎨²^]/g,"").replace(/m\/s2|m\/s²/g,"").replace(/n|j|w|kg|m\/s|cm|m|s/g,"");
 YP.checkSimilarAnswer=function(input,similar){if(similar?.inputMode==="choice"&&similar?.correctChoice)return {mode:"choice",correct:YP.checkChoiceAnswer(input,similar)};if(!similar?.acceptableAnswers?.length)return {mode:"self",correct:null};const n=YP.normalizeAnswer(input);return {mode:"auto",correct:similar.acceptableAnswers.some(a=>{const x=YP.normalizeAnswer(a);return x&&n&&(x===n||n.includes(x)||x.includes(n))})}};
 YP.loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src});
 YP.drawQuestionCrop=async function(canvas,exam,q,maxWidth=1000){const src=exam.pages[q.image.page-1];if(!src)throw new Error(`문항 ${q.no} 페이지 이미지가 없습니다.`);const img=await YP.loadImage(src),[x,y,w,h]=q.image.crop,scale=Math.min(1,maxWidth/w);canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);canvas.getContext("2d").drawImage(img,x,y,w,h,0,0,canvas.width,canvas.height);return canvas};
 YP.cropDataURL=async function(exam,q,scale=1){const src=exam.pages[q.image.page-1];if(!src)throw new Error(`문항 ${q.no} 페이지 이미지가 없습니다.`);const img=await YP.loadImage(src),[x,y,w,h]=q.image.crop,c=document.createElement("canvas");c.width=Math.round(w*scale);c.height=Math.round(h*scale);c.getContext("2d").drawImage(img,x,y,w,h,0,0,c.width,c.height);return c.toDataURL("image/png")};
 YP.dataURLToUint8=function(dataURL){const b=atob(dataURL.split(",")[1]),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a};
 YP.drawBarChart=function(canvas,labels,values,colors,options={}){const dpr=Math.min(window.devicePixelRatio||1,2),cssW=canvas.clientWidth||520,cssH=canvas.clientHeight||240;canvas.width=cssW*dpr;canvas.height=cssH*dpr;const c=canvas.getContext("2d");c.scale(dpr,dpr);c.clearRect(0,0,cssW,cssH);const pad={l:45,r:15,t:20,b:55},W=cssW-pad.l-pad.r,H=cssH-pad.t-pad.b,max=options.max||Math.max(100,...values,1);c.strokeStyle="#d8e2ee";c.lineWidth=1;c.font="12px Malgun Gothic";c.fillStyle="#667085";for(let i=0;i<=4;i++){const y=pad.t+H-H*i/4;c.beginPath();c.moveTo(pad.l,y);c.lineTo(cssW-pad.r,y);c.stroke();c.fillText(YP.formatNumber(max*i/4,0),5,y+4)}const gap=10,bw=Math.max(18,(W-gap*(values.length+1))/Math.max(values.length,1));values.forEach((v,i)=>{const x=pad.l+gap+i*(bw+gap),h=H*(max?Number(v||0)/max:0),y=pad.t+H-h;c.fillStyle=colors[i]||"#1976d2";c.fillRect(x,y,bw,h);c.fillStyle="#172033";c.textAlign="center";c.fillText(YP.formatNumber(v,1),x+bw/2,y-5);c.save();c.translate(x+bw/2,pad.t+H+16);c.rotate(labels[i].length>7?-.35:0);c.fillText(labels[i],0,0);c.restore()});c.textAlign="left";return canvas.toDataURL("image/png")};
 YP.drawDistribution=function(canvas,scores,student,maxScore){const bins=10,counts=Array(bins).fill(0);(scores||[]).forEach(s=>counts[Math.min(bins-1,Math.max(0,Math.floor((s/maxScore)*bins)))]++);const labels=counts.map((_,i)=>`${i*10}~`),colors=counts.map((_,i)=>student/maxScore*100>=i*10&&student/maxScore*100<(i+1)*10?"#d9780d":"#5aa4e6");return YP.drawBarChart(canvas,labels,counts,colors,{max:Math.max(...counts,1)})};
 YP.drawRadarChart=function(canvas,labels,studentValues,averageValues,options={}){
   const clean=(labels||[]).slice(0,10),n=clean.length;if(n<3)return YP.drawBarChart(canvas,["학생","전체 평균"],[Number(studentValues?.[0]||0),Number(averageValues?.[0]||0)],["#0866e5","#9aaec4"],{max:options.max||100});
   const dpr=Math.min(window.devicePixelRatio||1,2),cssW=canvas.clientWidth||520,cssH=canvas.clientHeight||285;canvas.width=cssW*dpr;canvas.height=cssH*dpr;const c=canvas.getContext("2d");c.scale(dpr,dpr);c.clearRect(0,0,cssW,cssH);
   const cx=cssW/2,cy=cssH/2+5,r=Math.min(cssW*.31,cssH*.34),max=options.max||100,angle=i=>-Math.PI/2+i*2*Math.PI/n,point=(ratio,i,extra=0)=>[cx+(r*ratio+extra)*Math.cos(angle(i)),cy+(r*ratio+extra)*Math.sin(angle(i))];
   c.lineJoin="round";c.font="11px Malgun Gothic";c.textBaseline="middle";
   for(let level=1;level<=5;level++){const ratio=level/5;c.beginPath();for(let i=0;i<n;i++){const [x,y]=point(ratio,i);i?c.lineTo(x,y):c.moveTo(x,y)}c.closePath();c.strokeStyle=level===5?"#bfd2e7":"#e2ebf4";c.lineWidth=1;c.stroke()}
   for(let i=0;i<n;i++){const [x,y]=point(1,i);c.beginPath();c.moveTo(cx,cy);c.lineTo(x,y);c.strokeStyle="#e1eaf3";c.stroke();const [tx,ty]=point(1,i,24),cos=Math.cos(angle(i));c.fillStyle="#425773";c.textAlign=cos>.25?"left":cos<-.25?"right":"center";const label=String(clean[i]||"");c.fillText(label.length>9?label.slice(0,9)+"…":label,tx,ty)}
   function polygon(values,stroke,fill,dashed){c.save();c.setLineDash(dashed?[5,4]:[]);c.beginPath();for(let i=0;i<n;i++){const v=Math.max(0,Math.min(max,Number(values?.[i]||0)))/max,[x,y]=point(v,i);i?c.lineTo(x,y):c.moveTo(x,y)}c.closePath();c.strokeStyle=stroke;c.lineWidth=dashed?2:2.5;c.stroke();if(fill){c.fillStyle=fill;c.fill()}c.restore()}
   polygon(averageValues,"#93a8bf",null,true);polygon(studentValues,"#0866e5","rgba(8,102,229,.18)",false);
   for(let i=0;i<n;i++){const v=Math.max(0,Math.min(max,Number(studentValues?.[i]||0)))/max,[x,y]=point(v,i);c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fillStyle="#0866e5";c.fill()}
   return canvas.toDataURL("image/png")
 };
 window.YP=YP;
})();
