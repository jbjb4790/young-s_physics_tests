import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const objectHash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const exam=catalog.exams.find(e=>e.examId==='physics2-basic-r15');
const baseline=JSON.parse(read('tests/fixtures/r15-baseline-v378.json'));
const ctx={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,URL,TextEncoder,TextDecoder,Blob,setTimeout,clearTimeout,navigator:{},document:{}};
vm.createContext(ctx);vm.runInContext(read('site/assets/core.js'),ctx);const YP=ctx.window.YP;
const approx=(x,y)=>assert.ok(Math.abs(x-y)<1e-10,`${x} != ${y}`);
function pngSize(f){const b=fs.readFileSync(path.join(root,'site',f));assert.equal(b.toString('ascii',1,4),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)]}

test('15회차 기존 ID를 중복 없이 ready로 활성화, 9문항·100점',()=>{
 assert.equal(catalog.exams.filter(e=>e.examId===exam.examId).length,1);
 assert.equal(exam.courseId,'physics2-basic');assert.equal(exam.round,15);assert.equal(exam.assessmentType,'weekly');assert.equal(exam.status,'ready');
 assert.equal(exam.questionCount,9);assert.equal(exam.maxScore,100);
 assert.deepEqual(exam.questions.map(q=>q.no),[1,2,3,4,5,6,7,8,9]);
 assert.deepEqual(exam.questions.map(q=>q.maxPoints),[10,10,10,10,10,15,15,10,10]);
 assert.equal(catalog.exams.length,46);assert.equal(catalog.courses.length,4);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').length,29);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,301);
});
test('다른 43개 시험 정의는 v3.7.8 기준 SHA256과 완전 동일',()=>{
 assert.equal(Object.keys(baseline.examHashes).length,43);
 for(const [id,sha] of Object.entries(baseline.examHashes)){if(id==='physics2-basic-total-electromagnetism')continue;const e=JSON.parse(JSON.stringify(catalog.exams.find(e=>e.examId===id)));if(id==='physics2-advanced-total')e.historyExamIds=e.historyExamIds.filter(x=>x!=='physics2-advanced-r04-v2'&&x!=='physics2-advanced-r05');assert.equal(objectHash(e),sha,id);}
});
test('Apps Script·Worker·포털 CTA·학생 링크 보호 (표시 확장 별도 검사)',()=>{
 assert.equal(Object.keys(baseline.fileHashes).length,21);
 for(const [f,sha] of Object.entries(baseline.fileHashes)){if(['site/assets/app.js','site/assets/report.js','site/assets/styles.css'].includes(f))continue;/* v3.7.10 approved revision guards tested separately */assert.equal(hash(f),sha,f);}
});
test('9+9 원문·동형 객관식의 정답 유일성과 루브릭 합계',()=>{
 for(const q of exam.questions){
  assert.equal(q.type,'subjective');assert.equal(q.inputMode,'achievement');
  assert.equal(q.rubric.reduce((s,r)=>s+r.points,0),q.maxPoints,`Q${q.no}`);
  assert.ok(q.explanation.length>=3);assert.ok(q.formulas.length>=2);assert.ok(q.commonMistakes.length>=2);
  for(const key of ['originalRetry','similarProblem']){
   const c=q[key];assert.equal(c.inputMode,'choice');assert.equal(c.displayMode,'choice-card');
   assert.equal(c.choices.length,4);assert.equal(new Set(c.choices).size,4);assert.equal(c.answer,c.choices[c.correctChoice-1]);
   assert.equal(YP.checkChoiceAnswer(String(c.correctChoice),c),true);
   for(let i=1;i<=4;i++)if(i!==c.correctChoice)assert.equal(YP.checkChoiceAnswer(String(i),c),false);
  }
 }
});
test('교사 입력 1=만점, 0=0점, P1=1점, 부분점수·공란 보존',()=>{
 assert.equal(YP.calculateResult(exam,Array(9).fill('1')).score,100);
 assert.equal(YP.calculateResult(exam,Array(9).fill('0')).score,0);
 const r=YP.calculateResult(exam,['1','0','P1','5','1','7','10','0','']);
 assert.equal(r.valid,true);assert.equal(r.score,43);assert.equal(r.counts.ungraded,1);
 assert.equal(YP.parseQuestionInput('15',exam.questions[5]).score,15);
 assert.equal(YP.parseQuestionInput('15.5',exam.questions[5]).valid,false);
 assert.equal(YP.parseQuestionInput('7.5',exam.questions[5]).score,7.5);
});
test('1번 100μH·20000A/s → 2V; 동형 250μH·12000A/s → 3V',()=>{
 approx(100e-6*20000,2);assert.equal(exam.questions[0].answer,'2 V');
 approx(250e-6*12000,3);assert.equal(exam.questions[0].similarProblem.answer,'3 V');
});
test('2번 변화량 6A/1.5s와 12V → 3H; 동형 1H',()=>{
 approx(12/((8-2)/1.5),3);assert.equal(exam.questions[1].answer,'3 H');
 approx(8/((5-1)/.5),1);assert.equal(exam.questions[1].similarProblem.answer,'1 H');
});
test('3번 초기 전류 0 전제와 I=0A/VL=12V를 구분',()=>{
 const q=exam.questions[2];assert.match(q.correctionNote,/초기 전류가 0/);
 assert.equal(q.answer,'I=0 A, V_L=12 V');assert.match(q.similarProblem.answer,/I=0 A, V_L=20 V/);
});
test('4번 과도상태 VR=8V/VL=4V, 동형 15V/5V',()=>{
 assert.equal(2*4,8);assert.equal(12-2*4,4);assert.equal(exam.questions[3].answer,'V_R=8 V, V_L=4 V');
 assert.equal(3*5,15);assert.equal(20-15,5);assert.equal(exam.questions[3].similarProblem.answer,'V_R=15 V, V_L=5 V');
});
test('5번 정상상태 3A/0V, 실제 코일의 저항 가정과 구분',()=>{
 assert.equal(12/4,3);assert.equal(exam.questions[4].answer,'I=3 A, V_L=0 V');
 assert.match(exam.questions[4].correctionNote,/내부저항 무시/);assert.equal(18/6,3);
});
test('6번 전체 전류 2A→3A 및 원문 7+8점 배점 보존',()=>{
 assert.equal(18/9,2);assert.equal(18/6,3);assert.equal(exam.questions[5].answer,'(1) 2 A  (2) 3 A');
 assert.deepEqual(exam.questions[5].rubric.map(r=>r.points),[7,8]);
 assert.equal(24/(4+8),2);assert.equal(24/4,6);assert.equal(exam.questions[5].similarProblem.answer,'직후 2 A, 이후 6 A');
});
test('7번 sin임계각=3/4·60도 전반사·10+5점, 동형 n=2에서 45도 전반사',()=>{
 approx(1/(4/3),.75);assert.ok(Math.sin(Math.PI/3)>.75);
 assert.deepEqual(exam.questions[6].rubric.map(r=>r.points),[10,5]);
 assert.equal(exam.questions[6].answer,'(1) sinθ_c=3/4  (2) 전반사');
 assert.ok(Math.sin(Math.PI/4)>1/2);
});
test('8번 B→A와 이유를 함께 요구하고 이유 누락 0점 유지',()=>{
 const q=exam.questions[7];assert.match(q.answer,/B → A/);assert.match(q.answer,/n_B>n_A/);
 assert.equal(q.rubric.length,1);assert.equal(q.rubric[0].points,10);assert.match(q.rubric[0].criterion,/이유 없으면 0점/);
 assert.match(q.originalRetry.prompt,/이유/);assert.match(q.originalRetry.answer,/n_B>n_A/);
 assert.ok(3e8/1.5e8>3e8/2e8);assert.ok(3e8/2e8>3e8/2.4e8);
});
test('9번 원문 경계값 2/√3 보존, 실제 전반사 >조건·임계각 등호 구분',()=>{
 const q=exam.questions[8];assert.equal(q.reviewStatus,'conditional');
 assert.match(q.answer,/n_c=2\/√3/);assert.match(q.answer,/n>2\/√3/);assert.match(q.correctionNote,/원문 답을 임의로 오답 처리하지 않/);
 approx((2/Math.sqrt(3))*Math.sin(Math.PI/3),1);
 assert.ok(1.2*Math.sin(Math.PI/3)>1);assert.ok(1.1*Math.sin(Math.PI/3)<1);
 approx(Math.SQRT2*Math.sin(Math.PI/4),1);
 assert.equal(q.similarProblem.answer,'n_c=√2, n>√2');
});
test('원본 문제·해설 PDF는 사용자 첨부와 해시 동일, 별도 검수 해설 PDF 제공',()=>{
 for(const [name,sha] of Object.entries(baseline.originalPdfHashes))assert.equal(hash('site/assets/documents/physics2/'+name),sha);
 for(const f of [exam.pdf,'assets/documents/physics2/r15-original-solution.pdf',exam.solutionPdf]){
  const b=fs.readFileSync(path.join(root,'site',f));assert.equal(b.subarray(0,4).toString(),'%PDF');assert.ok(b.length>25000);
 }
});
test('원문 2쪽 이미지와 4·5번 공통회로 보조이미지, 모든 crop 경계 유효',()=>{
 assert.equal(exam.pages.length,3);for(const f of exam.pages)assert.deepEqual(pngSize(f),[1240,1753]);
 for(const q of exam.questions){const [x,y,w,h]=q.image.crop;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1240&&y+h<=1753,`Q${q.no}`);}
 for(const no of [4,5]){const q=exam.questions[no-1];assert.equal(q.image.page,3);assert.equal(q.sourcePage,1);assert.match(q.imageNote,/공통 회로/);}
});
test('catalog JSON·JS·개별 문항 JSON 일치',()=>{
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(read('site/assets/data/catalog.js'),ctx);
 assert.equal(JSON.stringify(ctx.window.YP_CATALOG),JSON.stringify(catalog));
 assert.deepEqual(JSON.parse(read('site/assets/data/questions/physics2-basic-r15.json')),exam);
});
test('15회차 성적 저장·누적 분석의 학생 식별자와 시험 기준 보존',()=>{
 const record=YP.normalizeRecord({examId:exam.examId,courseId:exam.courseId,name:'검증학생',school:'검증학교',studentId:'synthetic-student-id',token:'synthetic-record-token',fingerprint:'synthetic-fingerprint',resultInputs:['1','1','1','1','1','1','1','0','0'],partialModes:Array(9).fill(false)});
 assert.equal(record.score,80);assert.equal(record.studentId,'synthetic-student-id');assert.equal(record.token,'synthetic-record-token');assert.equal(record.fingerprint,'synthetic-fingerprint');
 assert.equal(record.scoring.length,9);assert.match(record.scoring[8].topic,/임계 굴절률/);
 const total=YP.getExam('physics2-basic-total-electromagnetism');assert.ok(total.historyExamIds.includes(exam.examId));
 const portal=YP.computeStudentPortalCumulative([record]);assert.equal(portal.cumulative.testCount,1);assert.ok(portal.cumulative.weakItems.some(x=>x.examId===exam.examId));
});
test('총괄 CTA·구형/개정 16회차·14회차·심화4회 보존',()=>{
 assert.match(read('site/assets/portal.js'),/성적표 바로 보기/);
 assert.equal(YP.getExam('physics1-basic-r16').questionCount,6);assert.equal(YP.getExam('physics1-basic-r16-v2').questionCount,7);
 assert.equal(YP.getExam('physics1-basic-r16-v2').questions[3].answer,'2 m');
 assert.equal(YP.getExam('physics2-basic-r14').questionCount,9);assert.equal(YP.getExam('physics2-advanced-r04').questionCount,7);
});
test('v3.7.9 패키지·카탈로그 캐시만 갱신하고 v3.7.8 포털 JS/CSS 유지',()=>{
 assert.equal(JSON.parse(read('package.json')).version,'3.7.13');assert.equal(catalog.featureVersion,'3.7.12-physics2-emw-total');
 for(const page of ['index.html','portal.html','report.html'])assert.match(read('site/'+page),/catalog\.js\?v=3\.7\.12/);
 assert.match(read('site/portal.html'),/portal\.js\?v=3\.7\.8/);assert.match(read('site/portal.html'),/styles\.css\?v=3\.7\.8/);
});
