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
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const exam=catalog.exams.find(e=>e.examId==='physics2-basic-r14');
const independent=JSON.parse(read('site/assets/data/questions/physics2-basic-r14.json'));
const ctx={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,URL,TextEncoder,TextDecoder,Blob,crypto:globalThis.crypto,setTimeout,clearTimeout,navigator:{},document:{}};
vm.createContext(ctx);vm.runInContext(read('site/assets/core.js'),ctx);const YP=ctx.window.YP;
const points=[10,10,10,10,10,10,10,20,10];

function sizePng(f){const b=fs.readFileSync(path.join(root,'site',f));assert.equal(b.toString('ascii',1,4),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)];}

test('물리2 14회 기존 비활성 시험 ID 그대로 활성화, 9문항 100점',()=>{
 assert.ok(exam);assert.equal(exam.courseId,'physics2-basic');assert.equal(exam.round,14);assert.equal(exam.status,'ready');
 assert.equal(exam.assessmentType,'weekly');assert.equal(exam.questionCount,9);assert.equal(exam.maxScore,100);
 assert.deepEqual(exam.questions.map(q=>q.maxPoints),points);assert.deepEqual(exam.questions.map(q=>q.no),[1,2,3,4,5,6,7,8,9]);
 assert.equal(catalog.exams.filter(e=>e.examId===exam.examId).length,1);
 assert.equal(catalog.courses.length,4);assert.equal(catalog.exams.length,43);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').length,24);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,246);
});

test('기존 13회 및 물리1 16회 신구 분리 등록 유지',()=>{
 const e13=YP.getExam('physics2-basic-r13');assert.equal(e13.status,'ready');assert.equal(e13.questionCount,7);
 const old=YP.getExam('physics1-basic-r16'),nw=YP.getExam('physics1-basic-r16-v2');
 assert.equal(old.questionCount,6);assert.equal(nw.questionCount,7);assert.equal(nw.questions[3].answer,'2 m');
 assert.equal(exam.examId,'physics2-basic-r14');
 const comp=YP.getExam('physics2-basic-total-electromagnetism');
 assert.ok(comp.historyExamIds.includes('physics2-basic-r14'));
});

test('9문항에 대한 개별 점수/루브릭 검증, 재도전 9+9 선택 정답 일치',()=>{
 for(const q of exam.questions){
  assert.equal(q.type,'subjective');assert.equal(q.inputMode,'achievement');
  assert.equal(q.rubric.reduce((s,r)=>s+r.points,0),q.maxPoints,`Q${q.no}`);
  assert.ok(q.answer.length>3);assert.ok(q.explanation.length>=3);assert.ok(q.formulas.length>=2);assert.ok(q.commonMistakes.length>=2);
  for(const prop of ['originalRetry','similarProblem']){
   const c=q[prop];assert.equal(c.inputMode,'choice');assert.equal(c.displayMode,'choice-card');
   assert.equal(c.choices.length,4);assert.equal(new Set(c.choices).size,4);
   assert.equal(c.answer,c.choices[c.correctChoice-1]);assert.equal(YP.checkChoiceAnswer(String(c.correctChoice),c),true);
   assert.equal(YP.checkChoiceAnswer(String(c.correctChoice%4+1),c),false);
  }
 }
 assert.deepEqual(exam.questions[7].rubric.map(x=>x.points),[7,7,6]);
});

test('교사 채점: 전체 O·X, P1, 실제 부분점수 및 공란',()=>{
 assert.equal(YP.calculateResult(exam,Array(9).fill('1')).score,100);
 assert.equal(YP.calculateResult(exam,Array(9).fill('0')).score,0);
 const res=YP.calculateResult(exam,['1','0','P1','5','3','4','5','7','']);
 assert.equal(res.valid,true);assert.equal(res.score,10+0+1+5+3+4+5+7);
 assert.equal(res.counts.ungraded,1);
 assert.equal(YP.parseQuestionInput('20',exam.questions[7]).score,20);
 assert.equal(YP.parseQuestionInput('20.5',exam.questions[7]).valid,false);
});

test('1번 휘트스톤 6Ω·3A, 2번 평행도선 인력 2.4×10⁻⁵N',()=>{
 assert.match(exam.questions[0].answer,/6 Ω/);assert.match(exam.questions[0].answer,/3 A/);
 assert.equal(10/5+10/10,3);
 assert.match(exam.questions[1].answer,/인력/);assert.match(exam.questions[1].answer,/2\.4×10⁻⁵/);
 assert.ok(Math.abs(2e-7*2*3*2/.1-2.4e-5)<1e-15);
});

test('3번 A 아래 I, C의 합력 오른쪽, B/D 인력, 원문 ④',()=>{
 const q=exam.questions[2];assert.match(q.answer,/④ ㄱ, ㄷ/);assert.match(q.answer,/오른쪽/);
 assert.equal(q.originalRetry.correctChoice,4);
 // At P, B out/in coefficient: -2, C:+1, D:+1/2, A:+1/2 (downwards).
 assert.equal(-2+1+.5+.5,0);
 // Force on C: B left 1, D right 1, A repels right 1/3.
 assert.ok(-1+1+1/3>0);
});

test('4번 정사각형 고리 알짜힘 왼쪽, 가까운 쪽 인력이 더 큼',()=>{
 const q=exam.questions[3];assert.match(q.answer,/왼쪽/);assert.match(q.answer,/I²a²\/\[d\(d\+a\)\]/);
 assert.ok(1/2-1/5>0);
});

test('5번 양전하 오른쪽+자기장 안쪽 = 위쪽, F=0.03N',()=>{
 assert.match(exam.questions[4].answer,/위쪽/);assert.match(exam.questions[4].answer,/3×10⁻² N/);
 assert.equal(.5*3e4*2e-6,.03);
});

test('6번 제공 해답의 누락된 반지름 보충 및 과도한 반원 그림 주의',()=>{
 const q=exam.questions[5];assert.equal(q.reviewStatus,'conditional');
 assert.match(q.answer,/3×10¹⁰ m/);assert.match(q.correctionNote,/반원/);
 assert.equal(1*3e4/(2e-6*.5),3e10);
 assert.equal(q.originalRetry.correctChoice,3);
});

test('7번 r은 2배, 비상대론 주기 그대로',()=>{
 const q=exam.questions[6];assert.match(q.answer,/2배/);assert.match(q.answer,/1배/);
 assert.equal(q.similarProblem.correctChoice,3);
});

test('8번 α 오른쪽/β 왼쪽/γ 직진, 각 7·7·6점, 곡률 비 조건 미정',()=>{
 const q=exam.questions[7];assert.match(q.answer,/α선: 오른쪽/);assert.match(q.answer,/β선.*왼쪽/);assert.match(q.answer,/γ선: 직진/);
 assert.match(q.correctionNote,/운동량·속력/);assert.equal(q.similarProblem.correctChoice,4);
});

test('9번 속도 선택기 v=E/B 및 동형 E=60,B=0.2 ⇒ 300m/s',()=>{
 const q=exam.questions[8];assert.equal(q.answer,'v=E/B');assert.equal(60/.2,300);
 assert.equal(q.similarProblem.answer,'300 m/s');
});

test('시험 원본 PDF/원본해설 PDF/검수해설 PDF 3개 분리 및 PNG 크기',()=>{
 for(const f of [exam.pdf,'assets/documents/physics2/r14-original-solution.pdf',exam.solutionPdf]){
  const b=fs.readFileSync(path.join(root,'site',f));assert.equal(b.subarray(0,4).toString(),'%PDF');assert.ok(b.length>25000);
 }
 assert.equal(exam.pages.length,3);for(const f of exam.pages)assert.deepEqual(sizePng(f),[1240,1753]);
 for(const q of exam.questions){
  const [x,y,w,h]=q.image.crop;assert.ok(x>=0&&y>=0&&w>450&&h>230&&x+w<=1240&&y+h<=1753,`Q${q.no}`);
 }
});

test('catalog.js, catalog.json, 분리된 question.json 내용 동일',()=>{
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(read('site/assets/data/catalog.js'),ctx);
 assert.equal(JSON.stringify(ctx.window.YP_CATALOG),JSON.stringify(catalog));
 assert.equal(JSON.stringify(independent),JSON.stringify(exam));
});

test('Apps Script, Worker, 영구 링크/서버 토큰 관련 보호 파일 무변경',()=>{
 const fixture=JSON.parse(read('tests/fixtures/r16-legacy-fingerprints.json'));
 for(const [name,sha] of Object.entries(fixture.protectedFileHashes))assert.equal(hash(name),sha,`${name} SHA mismatch`);
});

test('캐시와 package 버전은 3.7.6, 기존 핵심 JS 로직은 불변',()=>{
 assert.equal(JSON.parse(read('package.json')).version,'3.7.6');
 assert.equal(catalog.featureVersion,'3.7.6-physics2-r14-reviewed');
 for(const f of ['index.html','report.html','portal.html'])assert.match(read('site/'+f),/catalog\.js\?v=3\.7\.6/);
});
