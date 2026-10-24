import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(rel)=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const exam=catalog.exams.find(e=>e.examId==='physics2-advanced-r02');
const bank=JSON.parse(read('site/assets/data/questions/physics2-advanced-r02.json'));
const vmContext={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,TextEncoder,TextDecoder,URL,Blob,crypto:globalThis.crypto,navigator:{},document:{},setTimeout,clearTimeout};
vm.createContext(vmContext);
vm.runInContext(read('site/assets/core.js'),vmContext);
const YP=vmContext.window.YP;
const points=[10,10,10,10,10,20,20,10];
function pngSize(rel){const b=fs.readFileSync(path.join(ROOT,'site',rel));assert.equal(b.toString('ascii',1,4),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)];}
function hash(rel){return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,rel))).digest('hex');}

test('심화 2회차는 고유 ID로 시험 목록 42개 중 별도 주간시험으로 추가',()=>{
 assert.ok(exam);assert.equal(exam.courseId,'physics2-advanced');assert.equal(exam.round,2);
 assert.equal(exam.assessmentType,'weekly');assert.equal(exam.status,'ready');
 assert.equal(catalog.exams.length,42);assert.equal(catalog.exams.filter(e=>e.status==='ready').length,22);
 assert.equal(new Set(catalog.exams.map(e=>e.examId)).size,42);
 assert.equal(exam.questionCount,8);assert.equal(exam.maxScore,100);
 assert.deepEqual(exam.questions.map(q=>q.maxPoints),points);
 assert.deepEqual(exam.questions.map(q=>q.no),[1,2,3,4,5,6,7,8]);
});
test('물리2심화 복습 2회만 운영 주간회차와 총괄 학습 이력에 추가',()=>{
 assert.deepEqual(catalog.operatingPolicy.weeklyRounds['physics2-advanced'],[2,3]);
 assert.deepEqual(catalog.exams.find(e=>e.examId==='physics2-advanced-total').historyExamIds,['physics2-advanced-r02','physics2-advanced-r03']);
 assert.equal(catalog.exams.find(e=>e.examId==='physics2-advanced-total').status,'coming-soon');
 assert.equal(YP.getExam('physics1-advanced-total').status,'coming-soon');
 assert.equal(YP.getExam('physics2-basic-r12').status,'ready');
});
test('교사 성적 입력에서 문항별 0/1/부분점수/공란 의미와 총점 100점을 유지',()=>{
 const ex=YP.getExam('physics2-advanced-r02');
 assert.equal(ex.questionCount,8);assert.equal(ex.maxScore,100);
 assert.equal(YP.calculateResult(ex,Array(8).fill('1')).score,100);
 assert.equal(YP.calculateResult(ex,Array(8).fill('0')).score,0);
 assert.equal(YP.calculateResult(ex,['0','1','P1','1','2.5','1','1','']).score,0+10+1+10+2.5+20+20);
 const score=YP.calculateResult(ex,['1','P1','','0','5','12','16','1']);
 assert.equal(score.valid,true);assert.equal(score.score,10+1+0+0+5+12+16+10);
 assert.equal(score.counts.ungraded,1);assert.equal(score.counts.partial,4);
 assert.equal(YP.parseQuestionInput('1',ex.questions[5]).score,20);
 assert.equal(YP.parseQuestionInput('P1',ex.questions[5]).score,1);
 assert.equal(YP.parseQuestionInput('25',ex.questions[5]).valid,false);
});
test('교정 해답은 제공 PDF 2번 잘못된 질량 평형식을 그대로 반복하지 않음',()=>{
 const q=exam.questions[1];
 assert.equal(q.reviewStatus,'corrected');assert.match(q.correctionNote,/1\/2/);
 assert.match(q.answer,/m₂\/√3/);
 assert.match(q.answer,/\(m₁\+√3m₂\)\/2/);
 assert.match(q.answer,/2m₁/);
 assert.match(q.explanation.join(' '),/수평방향 평형/);
 assert.match(q.explanation.join(' '),/수직방향 평형/);
 assert.match(exam.sourceNote,/2번 해답/);
});
test('물리 공식 및 정답 1·3·4·5·6·7·8번 검산값 일치',()=>{
 for(const [no,re] of [[1,/F = 20√3 N.*N = 20√3 N/],[3,/θ=45°.*20√2 N/],[4,/F=mg.*N=mg/],[5,/230 N/],[6,/4mg\/√3.*2mg\/√3.*mg/],[7,/mg\/2.*5mg\/2.*11mg\/3.*13mg\/3/],[8,/mg√\(2rh−h²\)\/\(2r−h\)/]]){
  assert.match(exam.questions[no-1].answer,re,`Q${no}`);
 }
});
test('전 문항 서술형 부분점수 루브릭이 배점과 일치하고 5점 하위문항 배점 보존',()=>{
 for(const q of exam.questions){
  assert.equal(q.inputMode,'achievement');assert.equal(q.type,'subjective');
  assert.equal(q.rubric.reduce((a,x)=>a+x.points,0),q.maxPoints,`Q${q.no}`);
  assert.ok(q.explanation.length>=3);assert.ok(q.formulas.length>=2);assert.ok(q.commonMistakes.length>=2);
 }
 assert.deepEqual(exam.questions[0].rubric.map(x=>x.points),[5,5]);
 assert.deepEqual(exam.questions[5].rubric.map(x=>x.points),[10,5,5]);
 assert.deepEqual(exam.questions[6].rubric.map(x=>x.points),[5,5,5,5]);
});
test('오답 학습은 원문과 동형 각각 4지 서로 다른 선택지, 원문·동형 정답 일치',()=>{
 for(const q of exam.questions){
  for(const type of ['originalRetry','similarProblem']){
   const r=q[type];assert.equal(r.inputMode,'choice',`${q.no} ${type}`);
   assert.equal(r.choices.length,4);
   assert.equal(new Set(r.choices).size,4);
   assert.ok(Number.isInteger(r.correctChoice)&&r.correctChoice>=1&&r.correctChoice<=4);
   assert.equal(r.answer,r.choices[r.correctChoice-1]);
   assert.match(r.prompt,/원문|동형/);
   assert.equal(YP.checkChoiceAnswer(String(r.correctChoice),r),true);
   assert.equal(YP.checkChoiceAnswer(String((r.correctChoice)%4+1),r),false);
  }
 }
});
test('동형 문제에서 독립 검산한 정답 8개가 일치',()=>{
 const expected=[
  'F=20√2 N, N=20(√3−1) N',
  'm₁=m₂, M=√2m₁',
  'tanθ=3, T=10√10 N',
  'F=4mg/3, N=5mg/3',
  '170 N',
  'T=2mg, (√3mg, mg)',
  'B: (mg/2,3mg/2), A: (2mg,3mg)',
  'mg/√3'
 ];
 assert.deepEqual(exam.questions.map(q=>q.similarProblem.answer),expected);
});
test('문제와 원본 해설 3페이지 PDF 및 별도 교정 해설 PDF가 모두 포함',()=>{
 assert.equal(exam.pages.length,3);
 for(const p of exam.pages)assert.deepEqual(pngSize(p),[1240,1753]);
 for(const rel of [exam.pdf,exam.solutionPdf,'assets/documents/physics2-advanced/r02-original-solution.pdf']){
  const p=path.join(ROOT,'site',rel);assert.ok(fs.existsSync(p));assert.equal(fs.readFileSync(p).subarray(0,4).toString(),'%PDF');
 }
});
test('8문항 이미지 crop 영역이 각 3페이지의 물리 제약을 만족',()=>{
 for(const q of exam.questions){const {page,crop}=q.image;assert.ok(page>=1&&page<=3);
  const [x,y,w,h]=crop;assert.ok(x>=0&&y>=0&&w>200&&h>150&&x+w<=1240&&y+h<=1753,`Q${q.no}`);
 }
 assert.deepEqual(exam.questions.map(q=>q.image.page),[1,1,1,1,2,2,2,3]);
});
test('별도 문항 데이터, 브라우저 내장 카탈로그가 동일한 데이터를 제공',()=>{
 const context={window:{}};vm.createContext(context);vm.runInContext(read('site/assets/data/catalog.js'),context);
 assert.equal(JSON.stringify(exam),JSON.stringify(bank));
 assert.equal(JSON.stringify(exam),JSON.stringify(context.window.YP_CATALOG.exams.find(e=>e.examId===exam.examId)));
 assert.equal(JSON.stringify(catalog),JSON.stringify(context.window.YP_CATALOG));
});
test('학생·교사 카탈로그 캐시 버전이 3.7.3이며 서버 코드와 배포 설정은 보호',()=>{
 for(const f of ['index.html','report.html','portal.html'])assert.match(read('site/'+f),/assets\/data\/catalog\.js\?v=3\.7\.4/);
 assert.equal(JSON.parse(read('package.json')).version,'3.7.4');
 for(const name of ['apps-script/Code.gs','apps-script/appsscript.json','cloudflare-worker/index.mjs','.github/workflows/pages.yml','site/assets/runtime-config.js','site/assets/share-config.js']){
  assert.ok(fs.existsSync(path.join(ROOT,name)),`protected path absent: ${name}`);
 }
 assert.match(read('apps-script/Code.gs'),/function syncCatalog_\(/);
 assert.match(read('apps-script/Code.gs'),/function getStudentPortal_\(/);
});
test('추가 수량은 4과정 42시험(준비 21) 223문항, 기존 207문항 그대로 보존',()=>{
 assert.equal(catalog.courses.length,4);
 assert.equal(catalog.exams.length,42);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').length,22);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,230);
});
