import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const hashFile=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const hashObject=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const snap=JSON.parse(read('tests/fixtures/r04-v2-baseline-v379.json'));
const OLD='physics2-advanced-r04',NEW='physics2-advanced-r04-v2',TOTAL='physics2-advanced-total';
const old=catalog.exams.find(e=>e.examId===OLD),revised=catalog.exams.find(e=>e.examId===NEW);
const context={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(read('site/assets/core.js'),context);const YP=context.window.YP;
const clean=x=>JSON.parse(JSON.stringify(x));
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function record(ex,inputs=Array(7).fill('1')){return YP.normalizeRecord({examId:ex.examId,courseId:ex.courseId,name:'가상학생',school:'검증학교',studentId:'synthetic-student',token:'synthetic-'+ex.examId,fingerprint:'synthetic-fp-'+ex.examId,resultInputs:inputs,partialModes:Array(7).fill(false),createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'})}
function uiHarness(){
 // Execute the actual app closure without DOMContentLoaded; only a test-time export is added in memory.
 const nodes=new Map(),messages=[];
 function node(id){if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',disabled:false,placeholder:'',classList:{add(){},remove(){},toggle(){}},focus(){},scrollIntoView(){},addEventListener(){},querySelectorAll(){return []}});return nodes.get(id)}
 const c={window:{YP_CATALOG:clean(catalog),YP_CONFIG:{},addEventListener(){}},document:{getElementById:node,addEventListener(){},hidden:false},console,setTimeout,clearTimeout,confirm:()=>true};
 vm.createContext(c);vm.runInContext(read('site/assets/core.js'),c);c.YP=c.window.YP;c.YP.toast=(...m)=>messages.push(m);c.YP_API={demo:true};
 let code=read('site/assets/app.js');
 code=code.replace('document.addEventListener("DOMContentLoaded",init);',`window.__test={state,renderExamOptions,switchLegacyExamToCurrent,saveCurrent,saveBatch,handleBatchFile,findExistingBatchRecord,batchRecordFromImportedStudent,makeRecord,cancelEdit,startNewStudent,selectRosterStudent,handleReportAction,handleStudentPortalAction,bind,replaceLoadExam:fn=>{loadExam=fn},replaceRefreshReports:fn=>{refreshReports=fn},replaceShowLinkModal:fn=>{showLinkModal=fn}};`);
 vm.runInContext(code,c);const h=c.window.__test;
 h.replaceLoadExam(async()=>{const e=c.YP.getExam(node('examSelect').value);h.state.exam=e;h.state.editToken=null;h.state.inputs=Array(e.questionCount).fill('');h.state.partialModes=Array(e.questionCount).fill(false);h.state.batchRows=[]});
 node('courseSelect').value='physics2-advanced';h.state.exam=c.YP.getExam(OLD);
 return {c,h,node,messages};
}
test('4회 개정판은 별도 ID와 replacesExamId, 7문항 100점 유지',()=>{
 assert.equal(revised.replacesExamId,OLD);assert.equal(revised.round,4);assert.equal(revised.status,'ready');assert.equal(revised.assessmentType,'weekly');
 assert.equal(revised.courseId,old.courseId);assert.equal(revised.questionCount,7);assert.equal(revised.maxScore,100);
 assert.deepEqual(revised.questions.map(q=>q.maxPoints),[15,10,10,20,20,15,10]);
 assert.equal(catalog.exams.filter(e=>e.examId===NEW).length,1);
});
test('기존 모든 44시험 정의 보존: 심화 총괄 history에 개정 ID만 추가',()=>{
 for(const [id,sha] of Object.entries(snap.examHashes)){if(id==='physics2-basic-total-electromagnetism')continue;
  const e=clean(catalog.exams.find(e=>e.examId===id));if(id===TOTAL)e.historyExamIds=e.historyExamIds.filter(x=>x!==NEW&&x!=='physics2-advanced-r05');
  assert.equal(hashObject(e),sha,id);
 }
 assert.equal(hashObject(old),snap.examHashes[OLD]);
});
test('구형 문제 JSON·PDF·PNG·기존 해설 파일 전부 바이트 보존',()=>{for(const [f,sha] of Object.entries(snap.legacyFiles))assert.equal(hashFile(f),sha,f)});
test('서버·포털·코어·링크·테마 보호 (보고서 표시 확장 별도 검사)',()=>{assert.equal(Object.keys(snap.protectedFiles).length,20);for(const [f,sha] of Object.entries(snap.protectedFiles))if(f!=='site/assets/report.js')assert.equal(hashFile(f),sha,f)});
test('새 시험 원본 문제·해설 PDF는 첨부 원본 해시 그대로',()=>{for(const [f,sha] of Object.entries(snap.originalPdfHashes))assert.equal(hashFile(f),sha,f)});
test('변경하지 않은 1·2·3·6·7번은 이미지 crop 외 모든 내용 동일',()=>{
 for(const no of [1,2,3,6,7]){const a=clean(old.questions[no-1]),b=clean(revised.questions[no-1]);delete a.image;delete b.image;assert.deepEqual(b,a,`Q${no}`)}
});
test('원문 4번 정답 d5m/t1s, 수평 기준 60도와 소문항 10+10 명시',()=>{
 const q=revised.questions[3];assert.equal(q.answer,'(1) d=5 m  (2) t=1 s');assert.match(q.correctionNote,/수평선 기준/);
 assert.match(q.correctionNote,/원본 PDF 자체는 수정하지 않/);assert.deepEqual(q.rubric.map(x=>x.points),[10,10]);
 const v=5*Math.sqrt(3),th=Math.PI/3,ph=Math.PI/6,t=1;
 const x=v*Math.cos(th)*t,y=v*Math.sin(th)*t-5*t*t;
 approx(y,x*Math.tan(ph));approx(x/Math.cos(ph),5);
 assert.equal(q.originalRetry.answer,'d=5 m, t=1 s');
});
test('4번 새 동형은 속력을 2배로 변경해 t2s/d20m',()=>{
 const v=10*Math.sqrt(3),t=2,x=v*.5*t,y=v*Math.sqrt(3)/2*t-5*t*t;
 approx(y,x/Math.sqrt(3));approx(x/Math.cos(Math.PI/6),20);
 assert.equal(revised.questions[3].similarProblem.answer,'d=20 m, t=2 s');
});
test('원문 5번 t2s/s10m, 궤적의 +10 누락을 별도 보충으로 구분',()=>{
 const q=revised.questions[4];assert.equal(q.answer,'(1) t=2 s  (2) s=10 m');assert.deepEqual(q.rubric.map(x=>x.points),[10,10]);
 assert.match(q.correctionNote,/원문 해설/);assert.match(q.correctionNote,/\+10/);assert.match(q.formulas.join(' '),/y=10\+√3x/);
 const t=2,x=5*Math.sqrt(3)/2*t,y=10+7.5*t-5*t*t;
 approx(y,x/Math.sqrt(3));approx(10+Math.sqrt(3)*x-4/15*x*x,y);approx(x/Math.cos(Math.PI/6),10);
});
test('5번 새 동형 높이30m 양의 해3s와 빗면거리15m',()=>{
 const t=3,x=5*Math.sqrt(3)/2*t;approx(30+7.5*t-5*t*t,x/Math.sqrt(3));approx(x/Math.cos(Math.PI/6),15);
 assert.equal(revised.questions[4].similarProblem.answer,'t=3 s, s=15 m');
});
test('신구 원문·동형 각각 7개가 분리되고 선택 정답이 유일',()=>{
 for(const ex of [old,revised])for(const q of ex.questions)for(const key of ['originalRetry','similarProblem']){
  const c=q[key];assert.equal(c.choices.length,4);assert.equal(new Set(c.choices).size,4);assert.equal(c.answer,c.choices[c.correctChoice-1]);
  for(let n=1;n<=4;n++)assert.equal(YP.checkChoiceAnswer(String(n),c),n===c.correctChoice);
 }
 for(const i of [3,4])assert.notDeepEqual(old.questions[i].similarProblem,revised.questions[i].similarProblem);
});
test('양 버전의 점수·P1·부분점수·공란 입력 규칙과 루브릭 합 유지',()=>{
 for(const ex of [old,revised]){
  assert.equal(YP.calculateResult(ex,Array(7).fill('1')).score,100);assert.equal(YP.calculateResult(ex,Array(7).fill('0')).score,0);
  const r=YP.calculateResult(ex,['1','P1','0','7.5','4','6','']);assert.equal(r.score,33.5);assert.equal(r.counts.ungraded,1);assert.equal(r.valid,true);
  for(const q of ex.questions)assert.equal(q.rubric.reduce((s,r)=>s+r.points,0),q.maxPoints);
 }
});
test('학생 ID·시험 ID·개별 토큰·지문은 정규화와 재채점에서 불변',()=>{
 for(const ex of [old,revised]){const r=record(ex);assert.equal(r.studentId,'synthetic-student');assert.equal(r.examId,ex.examId);assert.equal(r.token,'synthetic-'+ex.examId);assert.equal(r.fingerprint,'synthetic-fp-'+ex.examId);assert.equal(r.score,100)}
});
test('기존 기록은 기존4·5번 분석 유지, 신판은 수치형 분석 사용',()=>{
 const a=record(old,['1','1','1','0','0','1','1']),b=record(revised,['1','1','1','0','0','1','1']);assert.equal(a.score,60);assert.equal(b.score,60);
 assert.equal(a.scoring[3].topic,old.questions[3].topic);assert.equal(a.scoring[4].topic,old.questions[4].topic);
 assert.match(b.scoring[3].topic,/수치형/);assert.match(b.scoring[4].topic,/높이 10 m/);
 const portal=YP.computeStudentPortalCumulative([a,b]);assert.equal(portal.reports.length,2);assert.equal(portal.cumulative.weakItems.filter(x=>x.examId===OLD).length,2);assert.equal(portal.cumulative.weakItems.filter(x=>x.examId===NEW).length,2);
});
test('시험별 평균은 같은 회차라도 버전별로 분리',()=>{
 const a=record(old,['1','1','1','0','0','1','1']),b=record(revised);assert.equal(YP.computeStats(old,[a,b]).average,60);assert.equal(YP.computeStats(revised,[a,b]).average,100);assert.equal(YP.computeStats(revised,[a,b]).count,1);
});
test('총괄 연결에서 양 버전4회는 한 회차로 집계, 구형만 있으면 구형 유지',()=>{
 const total=YP.getExam(TOTAL),a=record(old),b=record(revised);
 assert.ok(total.historyExamIds.includes(OLD));assert.ok(total.historyExamIds.includes(NEW));
 assert.equal(YP.computeHistorySummary(total,a,[a]).count,1);assert.equal(YP.getLinkedHistory(total,a,[a])[0].examId,OLD);
 assert.equal(YP.computeHistorySummary(total,b,[a,b]).count,1);assert.equal(YP.computeHistorySummary(total,b,[a,b]).expectedCount,4);assert.equal(YP.getLinkedHistory(total,b,[a,b])[0].examId,NEW);
});
test('교사 시험 선택에는 구형4회가 숨겨지고 개정판 노출',()=>{
 const {h,node}=uiHarness();h.renderExamOptions({selectExamId:NEW,load:false});const html=node('examSelect').innerHTML;
 assert.ok(!html.includes(`value="${OLD}"`));assert.ok(html.includes(`value="${NEW}"`));assert.equal(node('examSelect').value,NEW);
});
test('구형 기록 수정은 구형시험을 명시적으로 선택 가능',()=>{
 const {h,node}=uiHarness();h.renderExamOptions({selectExamId:OLD,load:false});assert.ok(node('examSelect').innerHTML.includes(`value="${OLD}"`));assert.match(node('examSelect').innerHTML,/기존 성적 수정 전용/);assert.equal(node('examSelect').value,OLD);
});
test('수정 중에는 구형 유지, 취소 또는 신규 모드는 개정판으로 전환',()=>{
 const {h,node}=uiHarness();node('examSelect').value=OLD;h.state.editToken='synthetic-token';h.switchLegacyExamToCurrent();assert.equal(h.state.exam.examId,OLD);
 h.state.editToken=null;h.switchLegacyExamToCurrent();assert.equal(node('examSelect').value,NEW);assert.equal(h.state.exam.examId,NEW);
});
test('구형으로 신규 단건 저장을 시도하면 서버 호출 없이 전환',async()=>{
 const {h,node,c,messages}=uiHarness();node('examSelect').value=OLD;h.state.editToken=null;let saves=0;c.YP_API.saveReport=()=>saves++;
 await h.saveCurrent();assert.equal(saves,0);assert.equal(h.state.exam.examId,NEW);assert.match(messages.at(-1)[0],/개정/);assert.doesNotMatch(messages.at(-1)[0],/16회/);
});
test('일괄 저장은 구형 편집 토큰 존재 여부와 무관하게 차단',async()=>{
 for(const token of [null,'synthetic-token']){const {h,c,messages}=uiHarness();h.state.editToken=token;h.state.batchRows=[{saveable:true,record:{examId:OLD}}];let saves=0;c.YP_API.saveBatch=()=>saves++;await h.saveBatch();assert.equal(saves,0);assert.match(messages.at(-1)[0],/구형 시험으로 일괄 입력할 수 없습니다/)}
});
test('구형 편집 중 파일을 가져오면 파싱 전 개정판 전환·재선택 요구',async()=>{
 const {h,c,node,messages}=uiHarness();h.state.editToken='synthetic-token';h.state.batchRows=[{saveable:true,record:{examId:OLD}}];let parsed=0;c.YP_CSV={importAssessment:()=>parsed++};
 await h.handleBatchFile({name:'synthetic.csv'});assert.equal(parsed,0);assert.equal(h.state.exam.examId,NEW);assert.equal(h.state.editToken,null);assert.equal(h.state.batchRows.length,0);assert.match(messages.at(-1)[0],/다시 선택/);
});
test('CSV 일괄 신규 레코드는 현재 개정 ID 사용, 구형기록 upsert 대상으로 잡지 않음',()=>{
 const {h}=uiHarness();h.state.exam=revised;h.state.reports=[record(old)];
 const s={name:'가상학생',school:'검증학교',inputs:Array(7).fill('1'),partialModes:Array(7).fill(false)};
 const r=h.batchRecordFromImportedStudent({fileName:'synthetic.csv'},s);assert.equal(r.examId,NEW);assert.equal(h.findExistingBatchRecord(r),null);
});
test('구형 수정 저장용 makeRecord는 editToken·구형 ID를 유지',()=>{
 const {h,node}=uiHarness();h.state.exam=old;h.state.editToken='synthetic-old-token';h.state.selectedStudentId='synthetic-student';h.state.inputs=Array(7).fill('1');h.state.partialModes=Array(7).fill(false);node('studentName').value='가상학생';node('school').value='검증학교';
 const r=h.makeRecord();assert.equal(r.examId,OLD);assert.equal(r.token,'synthetic-old-token');assert.equal(r.studentId,'synthetic-student');
});
test('학생 변경·새학생·취소 전환 기존 보호 경로가 유지',()=>{
 const s=read('site/assets/app.js');assert.match(s,/selectRosterStudent[\s\S]*?resetScoreEntryForStudentSwitch\(\);switchLegacyExamToCurrent\(\)/);assert.match(s,/startNewStudent\(\)[\s\S]*?switchLegacyExamToCurrent\(\)/);assert.match(s,/function cancelEdit\(\)[\s\S]*?switchLegacyExamToCurrent/);assert.match(s,/selectExamId:r\.examId,load:false/);
});
test('코어/학생 포털 코드 동일, 성적표 표시 확장 별도 검증, 총괄 CTA 유지',()=>{for(const f of ['site/assets/core.js','site/assets/portal.js'])assert.equal(hashFile(f),snap.protectedFiles[f]);assert.match(read('site/assets/portal.js'),/성적표 바로 보기/)});
test('새 자료 경로는 구형과 분리, 내용 있는4쪽의 문항 crop가 유효',()=>{
 assert.notEqual(old.pdf,revised.pdf);assert.notEqual(old.solutionPdf,revised.solutionPdf);assert.equal(revised.pages.length,4);
 for(const f of revised.pages){assert.ok(!old.pages.includes(f));const b=fs.readFileSync(path.join(root,'site',f));assert.equal(b.readUInt32BE(16),1240);assert.equal(b.readUInt32BE(20),1753)}
 for(const q of revised.questions){const [x,y,w,h]=q.image.crop;assert.ok(q.image.page>=1&&q.image.page<=4);assert.ok(x>=0&&y>=0&&x+w<=1240&&y+h<=1753);assert.ok(w>500&&h>400)}
 for(const f of [revised.pdf,revised.solutionPdf,revised.sourceSolutionPdf])assert.equal(fs.readFileSync(path.join(root,'site',f)).subarray(0,4).toString(),'%PDF');
});
test('카탈로그 JS·JSON·독립 개정문항 JSON이 완전 동일',()=>{
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(read('site/assets/data/catalog.js'),ctx);assert.equal(JSON.stringify(ctx.window.YP_CATALOG),JSON.stringify(catalog));assert.deepEqual(JSON.parse(read('site/assets/data/questions/'+NEW+'.json')),revised);
});
test('v3.7.12 카탈로그 46시험/29ready/301문항, 물리215회 및 물리116회 보존',()=>{
 assert.equal(catalog.exams.length,46);assert.equal(catalog.exams.filter(e=>e.status==='ready').length,29);assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,301);
 assert.equal(YP.getExam('physics2-basic-r15').questionCount,9);assert.equal(YP.getExam('physics1-basic-r16').questionCount,6);assert.equal(YP.getExam('physics1-basic-r16-v2').questions[3].answer,'2 m');
 assert.equal(JSON.parse(read('package.json')).version,'3.7.12');assert.equal(catalog.featureVersion,'3.7.12-physics2-emw-total');
 for(const f of ['index.html','report.html','portal.html'])assert.match(read('site/'+f),/catalog\.js\?v=3\.7\.12/);
 assert.match(read('site/index.html'),/app\.js\?v=3\.7\.12/);
});
