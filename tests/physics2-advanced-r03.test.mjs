import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const exam=catalog.exams.find(e=>e.examId==='physics2-advanced-r03');
const bank=JSON.parse(read('site/assets/data/questions/physics2-advanced-r03.json'));
const ctx={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,TextEncoder,TextDecoder,URL,Blob,crypto:globalThis.crypto,navigator:{},document:{},setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(read('site/assets/core.js'),ctx);
const YP=ctx.window.YP;
const pts=[10,15,15,10,10,15,15,10];
const hash=(rel)=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,rel))).digest('hex');
const exists=(rel)=>fs.existsSync(path.join(ROOT,rel));

function firstTread(vSquaredOverGH){
 // g=h=1 ⇒ y=-x²/(2 v²); n번째 디딤면 y=-n, 2(n-1)≤x≤2n
 for(let n=1;n<=100;n++){
  const x=Math.sqrt(2*vSquaredOverGH*n);
  if(x>=2*(n-1)-1e-9 && x<=2*n+1e-9) return {step:n,x};
 }
 throw new Error('no collision');
}

test('물리2심화 3회차 신규 고유 ID, 8문항 100점, 기존 과정·카탈로그 수량',()=>{
 assert.ok(exam);assert.equal(exam.courseId,'physics2-advanced');assert.equal(exam.round,3);
 assert.equal(exam.status,'ready');assert.equal(exam.assessmentType,'weekly');assert.equal(exam.questionCount,8);
 assert.equal(exam.maxScore,100);assert.deepEqual(exam.questions.map(x=>x.no),[1,2,3,4,5,6,7,8]);
 assert.deepEqual(exam.questions.map(x=>x.maxPoints),pts);
 assert.equal(catalog.courses.length,4);assert.equal(catalog.exams.length,43);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').length,24);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,246);
 assert.equal(new Set(catalog.exams.map(e=>e.examId)).size,43);
});

test('심화 주간 운영 회차 [2,3] 및 총괄 누적 연결 [2,3] 정확히 반영',()=>{
 assert.deepEqual(catalog.operatingPolicy.weeklyRounds['physics2-advanced'],[2,3]);
 assert.deepEqual(catalog.exams.find(e=>e.examId==='physics2-advanced-total').historyExamIds,['physics2-advanced-r02','physics2-advanced-r03']);
 assert.equal(YP.getExam('physics2-advanced-total').status,'coming-soon');
 assert.equal(YP.getExam('physics2-advanced-r02').status,'ready');
 assert.equal(YP.getExam('physics1-basic-r06').questions[3].originalRetry.answer,'0.2 m');
 assert.equal(YP.getExam('physics2-basic-r12').status,'ready');
});

test('교사 성적 입력 1/0/P1/실수 부분점수와 공란, 100점 만점',()=>{
 const ex=YP.getExam(exam.examId);
 assert.equal(YP.calculateResult(ex,Array(8).fill('1')).score,100);
 assert.equal(YP.calculateResult(ex,Array(8).fill('0')).score,0);
 const r=YP.calculateResult(ex,['1','P1','0','4.5','5','15','7.5','']);
 assert.equal(r.valid,true);assert.equal(r.score,10+1+0+4.5+5+15+7.5);
 assert.equal(r.counts.ungraded,1);
 assert.equal(YP.parseQuestionInput('1',ex.questions[6]).score,15);
 assert.equal(YP.parseQuestionInput('P1',ex.questions[6]).score,1);
 assert.equal(YP.parseQuestionInput('7.5',ex.questions[6]).score,7.5);
 assert.equal(YP.parseQuestionInput('15.1',ex.questions[6]).valid,false);
});

test('서술형 8문항별 부분점수 루브릭의 합과 7번 7.5점×2',()=>{
 for(const q of exam.questions){
  assert.equal(q.inputMode,'achievement');assert.equal(q.type,'subjective');
  assert.equal(q.rubric.reduce((a,x)=>a+x.points,0),q.maxPoints,`Q${q.no}`);
  assert.ok(q.formulas.length>=2);assert.ok(q.explanation.length>=3);assert.ok(q.commonMistakes.length>=2);
 }
 assert.deepEqual(exam.questions[1].rubric.map(x=>x.points),[5,3,4,3]);
 assert.deepEqual(exam.questions[2].rubric.map(x=>x.points),[5,5,5]);
 assert.deepEqual(exam.questions[5].rubric.map(x=>x.points),[5,5,5]);
 assert.deepEqual(exam.questions[6].rubric.map(x=>x.points),[7.5,7.5]);
});

test('원문 재도전 8개·동형 문제 8개 모두 보기 네 개이며 정답 검사 정상',()=>{
 for(const q of exam.questions){
  for(const key of ['originalRetry','similarProblem']){
   const r=q[key];assert.equal(r.inputMode,'choice');assert.equal(r.displayMode,'choice-card');
   assert.equal(r.choices.length,4);assert.equal(new Set(r.choices).size,4);
   assert.equal(r.answer,r.choices[r.correctChoice-1]);
   assert.equal(YP.checkChoiceAnswer(String(r.correctChoice),r),true);
   assert.equal(YP.checkChoiceAnswer(String(r.correctChoice%4+1),r),false);
   assert.ok(r.prompt.includes(key==='originalRetry'?'원문':'동형'));
  }
 }
});

test('문항 1·2 수치, 정지·운동마찰 물리식을 정답과 일치시키고 조건 주석 보존',()=>{
 const [q1,q2]=exam.questions;
 assert.match(q1.answer,/80 N/);assert.match(q1.correctionNote,/바닥 마찰/);
 assert.match(q2.answer,/8 N/);assert.match(q2.answer,/8 m\/s²/);assert.match(q2.answer,/2\/3 m\/s²/);
 assert.match(q2.correctionNote,/g=10/);
 assert.equal((2+6)*1*10,80);
 assert.equal((2+6)*(.3*2*10/6),8);
 assert.equal((20-.2*2*10)/2,8);
 assert.equal((.2*2*10)/6,2/3);
});

test('문항 3·4·5 공식 정답과 주석 검산',()=>{
 assert.match(exam.questions[2].answer,/N=mg\/2/);
 assert.match(exam.questions[2].answer,/a=g\/2−μg/);
 assert.match(exam.questions[3].answer,/2mg\/3/);
 assert.match(exam.questions[4].answer,/11Mg\/8/);
 assert.equal((5/2+1)/2,7/4);
 assert.equal((7/4+1)/2,11/8);
});

test('문항 6·7 최고점 시간·높이·사거리와 링 통과 초기속력',()=>{
 assert.match(exam.questions[5].answer,/√3:1/);assert.match(exam.questions[5].answer,/3:1/);
 assert.match(exam.questions[5].answer,/1:1/);
 assert.match(exam.questions[6].answer,/tanθ=2h\/d/);
 assert.match(exam.questions[6].answer,/g\(d²\+4h²\)\/\(2h\)/);
 // 동형 d=12,h=3,g=10 => v²=300
 assert.equal(10*(12**2+4*3**2)/(2*3),300);
});

test('8번 원문 정답: 폭2h를 적용하면 최초 충돌은 계단3, 공식 해설5는 오답',()=>{
 const q8=exam.questions[7];assert.equal(q8.reviewStatus,'corrected');
 assert.match(q8.answer,/3번 계단/);assert.match(q8.correctionNote,/5번 계단/);
 const {step,x}=firstTread(5);
 assert.equal(step,3);assert.ok(x>4&&x<6);assert.ok(Math.abs(x-Math.sqrt(30))<1e-12);
 assert.equal(q8.originalRetry.answer,'3번 계단');
 assert.notEqual(q8.originalRetry.answer,'5번 계단');
});

test('8번 동형 √(9gh)일 때 실제 최초 충돌은 5번 계단',()=>{
 const {step,x}=firstTread(9);assert.equal(step,5);assert.ok(x>8&&x<10);
 assert.equal(exam.questions[7].similarProblem.answer,'5번');
});

test('그림 PDF·원본 해설 PDF·검수 PDF가 각각 3페이지로 존재, 페이지 이미지 1240x1753',()=>{
 assert.equal(exam.pages.length,3);
 for(const rel of [exam.pdf,exam.solutionPdf,'assets/documents/physics2-advanced/r03-original-solution.pdf']){
  assert.ok(exists('site/'+rel),rel);
  const buf=fs.readFileSync(path.join(ROOT,'site',rel));assert.equal(buf.subarray(0,4).toString(),'%PDF');
 }
 for(const rel of exam.pages){
  const buf=fs.readFileSync(path.join(ROOT,'site',rel));assert.equal(buf.toString('ascii',1,4),'PNG');
  assert.deepEqual([buf.readUInt32BE(16),buf.readUInt32BE(20)],[1240,1753]);
 }
});

test('8개 원문 이미지 crop 박스는 원본 페이지 바깥으로 나가지 않고 서로 겹치지 않음',()=>{
 const expectPage=[1,1,1,2,2,2,3,3];
 for(let i=0;i<8;i++){
  const {page,crop}=exam.questions[i].image;assert.equal(page,expectPage[i]);
  const [x,y,w,h]=crop;assert.ok(x>=0&&y>=0&&w>350&&h>330&&x+w<=1240&&y+h<=1753,`Q${i+1}`);
 }
});

test('별도 문항 JSON과 내장 카탈로그 JS와 JSON은 동일',()=>{
 const a={window:{}};vm.createContext(a);vm.runInContext(read('site/assets/data/catalog.js'),a);
 assert.deepEqual(bank,exam);
 assert.equal(JSON.stringify(a.window.YP_CATALOG),JSON.stringify(catalog));
});

test('v3.7.3 HTML 캐시 버전 / package / 기존 v3.7.2 시험 ID와 정답 보존',()=>{
 assert.equal(JSON.parse(read('package.json')).version,'3.7.6');
 assert.equal(catalog.featureVersion,'3.7.6-physics2-r14-reviewed');
 for(const f of ['index.html','portal.html','report.html'])assert.match(read('site/'+f),/catalog\.js\?v=3\.7\.6/);
 assert.equal(catalog.exams.filter(e=>e.examId==='physics1-basic-r06').length,1);
 assert.equal(catalog.exams.filter(e=>e.examId==='physics2-advanced-r02').length,1);
 assert.equal(catalog.exams.filter(e=>e.examId==='physics2-basic-r12').length,1);
});

test('학생 링크·서버 권한 및 배포 보호 파일은 존재하고 기존 API 구조 유지',()=>{
 const critical=['.github/workflows/pages.yml','apps-script/Code.gs','apps-script/appsscript.json','cloudflare-worker/index.mjs','site/assets/runtime-config.js','site/assets/share-config.js'];
 for(const file of critical)assert.ok(exists(file));
 assert.match(read('apps-script/Code.gs'),/function getStudentPortal_\(/);
 assert.match(read('apps-script/Code.gs'),/function syncCatalog_\(/);
});
