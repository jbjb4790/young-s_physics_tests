import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex');
const objectHash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const deep=o=>JSON.parse(JSON.stringify(o));
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const original=JSON.parse(read('tests/fixtures/r02-basic-baseline-v3714.json'));
const asset=JSON.parse(read('docs/validation/physics2-basic-r02-original-assets.json'));
const exam=catalog.exams.find(e=>e.examId==='physics2-basic-r02');
const c={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,URL,TextEncoder,TextDecoder,Blob,setTimeout,clearTimeout,navigator:{},document:{}};
vm.createContext(c);vm.runInContext(read('site/assets/core.js'),c);const YP=c.window.YP;
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('원래 비활성 물리2 2회 ID를 그대로 ready로 활성화, 10문항 각10점·100점',()=>{
 assert.equal(exam.examId,'physics2-basic-r02');assert.equal(exam.courseId,'physics2-basic');assert.equal(exam.round,2);assert.equal(exam.assessmentType,'weekly');
 assert.equal(exam.status,'ready');assert.equal(exam.questionCount,10);assert.equal(exam.maxScore,100);
 assert.deepEqual(exam.questions.map(q=>q.no),Array.from({length:10},(_,i)=>i+1));
 assert.deepEqual(exam.questions.map(q=>q.maxPoints),Array(10).fill(10));
 assert.equal(catalog.exams.filter(e=>e.examId===exam.examId).length,1);
});
test('기존 46시험 정의·독립 질문 JSON·학생 영구링크·코어 코드 바이트 불변',()=>{
 assert.equal(Object.keys(original.examHashes).length,47);
 for(const [id,expected] of Object.entries(original.examHashes)){
  if(id==='physics2-basic-r02')continue;
  const e=catalog.exams.find(x=>x.examId===id);assert.ok(e,id);assert.equal(objectHash(e),expected,id);
 }
 for(const [f,expected] of Object.entries(original.existingBankHashes)) assert.equal(hash(f),expected,f);
 for(const [f,expected] of Object.entries(original.protectedSha))assert.equal(hash(f),expected,f);
});
test('전체 47시험, 준비31시험, 318문항 및 물리2 역학 총괄 history에 r02 연결 유지',()=>{
 assert.equal(catalog.courses.length,4);assert.equal(catalog.exams.length,47);assert.equal(catalog.exams.filter(e=>e.status==='ready').length,31);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,318);
 const total=catalog.exams.find(e=>e.examId==='physics2-basic-total-mechanics');assert.equal(total.status,'ready');
 assert.ok(total.historyExamIds.includes(exam.examId));assert.deepEqual(catalog.operatingPolicy.weeklyRounds['physics2-basic'],[1,2,3,4,5,6,7,8,9,11,12,13,14,15]);
});
test('공식 출처 문제지와 해답지는 실제 바이트 그대로·SHA256 동일',()=>{
 assert.equal(exam.assetProvenance.redrawn,false);assert.equal(exam.assetProvenance.retypedQuestionText,false);
 for(const [f,m] of [[`site/${exam.pdf}`,asset.questionPdf],[`site/${exam.solutionPdf}`,asset.solutionPdf]]){
  const b=fs.readFileSync(path.join(ROOT,f));assert.equal(b.subarray(0,4).toString(),'%PDF');
  assert.equal(b.length,m.size);assert.equal(hash(f),m.sha256);
 }
 assert.equal(exam.pdf.endsWith('/r02-original.pdf'),true);assert.equal(exam.solutionPdf.endsWith('/r02-original-solution.pdf'),true);
});
test('원본 2쪽 PNG 1653×2337과 10문항 크롭 좌표·이미지 페이지 연결',()=>{
 assert.equal(exam.pages.length,2);
 for(const p of exam.pages){const b=fs.readFileSync(path.join(ROOT,'site',p));assert.equal(b.toString('ascii',1,4),'PNG');assert.deepEqual([b.readUInt32BE(16),b.readUInt32BE(20)],[1653,2337]);assert.equal(hash('site/'+p),asset.pages[p].sha256)}
 for(const q of exam.questions){const m=asset.crops[q.no];assert.deepEqual(q.image,{page:m.page,crop:m.crop});const [x,y,w,h]=q.image.crop;assert.ok(x>=0&&y>=0&&w>500&&h>150&&x+w<=1653&&y+h<=2337);}
 // 6번은 보기 ㄱ/ㄴ/ㄷ과 ①~⑤ 선택지까지 한 이미지에 포함해야 합니다.
 assert.ok(exam.questions[5].image.crop[3]>940);
});
test('독립 문항은행 JSON·catalog.js·catalog.json 동일 및 캐시 버전 반영',()=>{
 assert.deepEqual(JSON.parse(read('site/assets/data/questions/physics2-basic-r02.json')),exam);
 const cc={window:{}};vm.createContext(cc);vm.runInContext(read('site/assets/data/catalog.js'),cc);
 assert.deepEqual(deep(cc.window.YP_CATALOG),catalog);
 assert.equal(JSON.parse(read('package.json')).version,'3.7.15');assert.equal(catalog.featureVersion,'3.7.15-physics2-basic-r02');
 for(const page of ['index.html','report.html','portal.html'])assert.match(read('site/'+page),/catalog\.js\?v=3\.7\.15/);
});
test('교사 채점 규칙과 부분점수·공란, 학생식별자·성적 링크 불변',()=>{
 assert.equal(YP.calculateResult(exam,Array(10).fill('1')).score,100);
 assert.equal(YP.calculateResult(exam,Array(10).fill('0')).score,0);
 const r=YP.calculateResult(exam,['1','0','P1','4','1','7.5','0','5','','1']);assert.equal(r.valid,true);assert.equal(r.score,10+1+4+10+7.5+5+10);assert.equal(r.counts.ungraded,1);
 assert.equal(YP.parseQuestionInput('10.1',exam.questions[0]).valid,false);
 const record=YP.normalizeRecord({examId:exam.examId,courseId:exam.courseId,studentId:'synthetic-stable',token:'synthetic-token',fingerprint:'synthetic-fp',name:'가상학생',school:'가상학교',resultInputs:Array(10).fill('1'),partialModes:Array(10).fill(false)});
 assert.equal(record.score,100);
 for(const [k,v] of [['studentId','synthetic-stable'],['token','synthetic-token'],['fingerprint','synthetic-fp']])assert.equal(record[k],v);
});
test('문항별 부분점수와 원문·새 동형 10+10개, 4지 유일한 정답',()=>{
 for(const q of exam.questions){assert.equal(q.type,'subjective');assert.equal(q.inputMode,'achievement');assert.equal(q.rubric.reduce((a,x)=>a+x.points,0),10);assert.ok(q.explanation.length>=3);assert.ok(q.commonMistakes.length>=2);
  for(const key of ['originalRetry','similarProblem']){const t=q[key];assert.equal(t.inputMode,'choice');assert.equal(t.choices.length,4);assert.equal(new Set(t.choices).size,4);assert.equal(t.answer,t.choices[t.correctChoice-1]);for(let i=1;i<=4;i++)assert.equal(YP.checkChoiceAnswer(String(i),t),i===t.correctChoice)}
 }
});
test('1번 (5,12)→r13, tanθ=12/5; 2번 A+B−C=(0,0)',()=>{
 approx(Math.hypot(5,12),13);approx(Math.tan(Math.atan2(12,5)),12/5);
 assert.match(exam.questions[0].answer,/r=13/);assert.match(exam.questions[1].answer,/\(0,0\)/);
});
test('3번 내적 0·6과 4번 외적 −6ŷ·−4ẑ 부호 확인',()=>{
 assert.match(exam.questions[2].answer,/\(1\) 0.*\(2\) 6/);
 assert.match(exam.questions[3].answer,/−6ŷ.*−4ẑ/);
});
test('5번 6초 후 B/A 상대속도(−10,−6), 크기 2√34',()=>{
 assert.deepEqual([-10,-6],[0-10,-6-0]);approx(Math.hypot(10,6),2*Math.sqrt(34));assert.match(exam.questions[4].answer,/−10,−6/);
});
test('6번 ㄱ·ㄷ (④), 0~20초 가속도0.5·25초A속도22·20~30초220m',()=>{
 approx((2+8)/20,.5);approx(20+2,22);approx((20+2)*10,220);
 assert.match(exam.questions[5].answer,/④/);assert.equal(exam.questions[5].originalRetry.correctChoice,4);
});
test('7번 상대운동 최소 거리6m·t=8/5s, 8번 기차 2~5s',()=>{
 const t=8/5;approx(Math.hypot(10-4*t,3*t),6);
 assert.match(exam.questions[6].answer,/6 m.*8\/5 s/);
 assert.equal(2*2-7*2+10,0);assert.equal(5*5-7*5+10,0);
 assert.match(exam.questions[7].answer,/2초부터 5초/);
});
test('9번 원본 해답의 기준 혼동·벡터 부호 오류를 분리 주석으로 명시하고 사이트 정답 교정',()=>{
 const q=exam.questions[8];assert.equal(q.reviewStatus,'corrected');assert.match(q.answer,/\(1\).*2 m\/s.*\(2\).*2√2 m\/s/);
 assert.match(q.correctionNote,/원본 PDF는 보존/);
 assert.match(q.explanation.join(' '),/v_배\/둑=\(0,2\)/);
 approx(Math.hypot(2,2),2*Math.sqrt(2));assert.deepEqual([2-2,2+0],[0,2]);
});
test('10번 느끼는 북동풍 √2v + 사람 동쪽v → 실제 북풍 속력v',()=>{
 assert.match(exam.questions[9].answer,/북풍.*속력 v/);
 assert.deepEqual([-1+1,-1],[0,-1]);
});
test('기존 포털 총괄성적표·물리1/심화4회 버전 분리·물리2심화6회 유지',()=>{
 assert.match(read('site/assets/portal.js'),/성적표 바로 보기/);
 const r16=catalog.exams.find(e=>e.examId==='physics1-basic-r16-v2');assert.equal(r16.replacesExamId,'physics1-basic-r16');assert.equal(r16.questions[3].answer,'2 m');
 assert.equal(catalog.exams.find(e=>e.examId==='physics2-advanced-r04-v2').replacesExamId,'physics2-advanced-r04');
 assert.equal(catalog.exams.find(e=>e.examId==='physics2-advanced-r06').questionCount,7);
});
