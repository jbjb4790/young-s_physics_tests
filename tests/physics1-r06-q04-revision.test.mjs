import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const data=JSON.parse(read('site/assets/data/catalog.json'));
const bank=JSON.parse(read('site/assets/data/questions/physics1-basic-r06.json'));
const exam=data.exams.find(e=>e.examId==='physics1-basic-r06');
const q4=exam?.questions.find(q=>q.no===4);
const context={window:{YP_CATALOG:data,YP_CONFIG:{}},console,TextEncoder,TextDecoder,URL,Blob,crypto:globalThis.crypto,navigator:{},document:{},setTimeout,clearTimeout};
vm.createContext(context);
vm.runInContext(read('site/assets/core.js'),context);
const YP=context.window.YP;
const sha=(buffer)=>crypto.createHash('sha256').update(buffer).digest('hex');
const hashUnchanged=(q)=>{
  // JSON objects are encoded in stable insertion order by this project: the image crop of Q5/6 is the only sanctioned exception.
  const clone=JSON.parse(JSON.stringify(q));
  if([5,6].includes(clone.no))delete clone.image;
  const sorted=(x)=>Array.isArray(x)?x.map(sorted):x && typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
  return sha(Buffer.from(JSON.stringify(sorted(clone)),'utf8'));
};
const keptHashes={
  1:'ebdf786ef8497d9097e0c112e8506d50326808175dc5dbb9dda0e7a107f1ba55',
  2:'51021b4d31f22db177f966e2afebd178f703cbe5da0398d1cb6ae6dff7b43e02',
  3:'15edbc7847c2110dff85b43ccda040efe12f02704759e8e1e6a572e8d463543e',
  5:'75de864d823166e11dc262c2cbffc436c69dc7bf9ceab4ca14588c49b1134217',
  6:'ab9fb704c4b7a7b9f1df6ae371c762df06fd8f4d467b900962923a90bbbab880'
};

test('4번 개정 시험은 기존 ID, 6문항, 100점 총점, 10점 배점을 유지',()=>{
  assert.ok(exam);assert.equal(exam.status,'ready');assert.equal(exam.courseId,'physics1-basic');
  assert.equal(exam.questionCount,6);assert.equal(exam.maxScore,100);
  assert.deepEqual(exam.questions.map(q=>q.maxPoints),[10,10,20,10,20,30]);
  assert.deepEqual(exam.questions.map(q=>q.no),[1,2,3,4,5,6]);
  assert.equal(q4.maxPoints,10);
});

test('문항 4는 요람 문제가 아닌 양쪽에서 당기는 Hooke 법칙의 용수철 문제',()=>{
  assert.match(q4.topic,/용수철/);
  assert.match(q4.answer,/50 N\/m/);assert.match(q4.answer,/10 N/);assert.match(q4.answer,/0\.2 m/);
  assert.match(q4.formulas.join(' '),/F=kx/);
  assert.equal(q4.type,'subjective');
  assert.doesNotMatch(JSON.stringify([q4.topic,q4.answer,q4.explanation,q4.formulas,q4.similarProblem,q4.originalRetry]),/요람|동일한 금속구|튀어나오는 구/);
});

test('숙제노트 2페이지 공식 풀이대로 힘의 합 20N이 아닌 장력 10N을 사용',()=>{
  assert.equal(10/50,0.2);assert.equal(12/80,0.15);
  assert.match(q4.explanation.join(' '),/장력은 10 N/);
  assert.match(q4.commonMistakes.join(' '),/20 N/);
  assert.match(q4.answer,/20 cm/);
  assert.match(exam.sourceNote,/숙제노트 2쪽/);
});

test('10점 서술형 채점 루브릭과 주간 교사 성적 입력 규칙이 유지',()=>{
  assert.equal(q4.rubric.reduce((s,r)=>s+r.points,0),10);
  assert.deepEqual(q4.rubric.map(r=>r.points),[3,4,3]);
  const e=YP.getExam('physics1-basic-r06');
  assert.equal(YP.parseQuestionInput('1',e.questions[3]).score,10);
  assert.equal(YP.parseQuestionInput('P1',e.questions[3]).score,1);
  assert.equal(YP.parseQuestionInput('0',e.questions[3]).score,0);
  assert.equal(YP.parseQuestionInput('11',e.questions[3]).valid,false);
  assert.equal(YP.calculateResult(e,Array(6).fill('1')).score,100);
});

test('원문 4지 재도전의 정답은 0.2m이며 기존 요람 답안이 남지 않음',()=>{
  const r=q4.originalRetry;
  assert.equal(r.inputMode,'choice');assert.equal(r.choices.length,4);
  assert.equal(new Set(r.choices).size,4);
  assert.equal(r.correctChoice,2);assert.equal(r.answer,r.choices[r.correctChoice-1]);
  assert.equal(r.answer,'0.2 m');
  assert.equal(YP.checkChoiceAnswer('2',r),true);
  assert.equal(YP.checkChoiceAnswer('3',r),false);
  assert.doesNotMatch(r.choices.join(' '),/개/);
});

test('동형 4지 재도전은 k=80 N/m, 좌우 12 N일 때 0.15 m로 독립 검산',()=>{
  const r=q4.similarProblem;
  assert.match(r.prompt,/80 N\/m/);assert.match(r.prompt,/12 N/);
  assert.equal(r.inputMode,'choice');assert.equal(r.choices.length,4);
  assert.equal(new Set(r.choices).size,4);
  assert.equal(r.correctChoice,2);assert.equal(r.answer,'0.15 m');
  assert.equal(r.answer,r.choices[r.correctChoice-1]);
  assert.equal(YP.checkChoiceAnswer('2',r),true);
  assert.equal(YP.checkChoiceAnswer('1',r),false);
});

test('다른 1~3·5~6번 문항 내용은 v3.7.1 정본과 동일(5·6 이미지 좌표 변경만 예외)',()=>{
  for(const [no,hash] of Object.entries(keptHashes)){
    const q=exam.questions.find(q=>q.no===Number(no));
    assert.equal(hashUnchanged(q),hash,`문항 ${no} 기존 데이터 변형`);
  }
});

test('원본 PDF는 최신 사용자가 올린 시험지이며 PNG는 1488x2103',()=>{
  const pdf=fs.readFileSync(path.join(root,'site/assets/documents/physics1/r06.pdf'));
  assert.equal(pdf.toString('ascii',0,4),'%PDF');
  assert.equal(sha(pdf),'586348ef2387a3ffbab794eb6a2dddfdde02d6c9c6cded0f394a027816274388');
  const png=fs.readFileSync(path.join(root,'site/assets/pages/physics1/r06-p1.png'));
  assert.equal(png.toString('ascii',1,4),'PNG');
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1488,2103]);
  const src=fs.readFileSync(path.join(root,'docs/물리1_6회차_숙제노트_2쪽_해설원본.pdf'));
  assert.equal(src.toString('ascii',0,4),'%PDF');
  assert.equal(exam.solutionPdf,undefined); // do not reveal official answer PDF to student before retry submission
});

test('개정 PDF의 페이지 1 문항 4·5·6 이미지 자르기 영역은 서로 겹치지 않으며 온전함',()=>{
  const qs=exam.questions.slice(3);
  for(const q of qs){const [x,y,w,h]=q.image.crop;
    assert.equal(q.image.page,1);
    assert.ok(x>=0&&y>=0&&w>=600&&h>=220&&x+w<=1488&&y+h<=2103);
  }
  assert.ok(qs[0].image.crop[1]+qs[0].image.crop[3]<=qs[1].image.crop[1]);
  assert.ok(qs[1].image.crop[1]+qs[1].image.crop[3]<=qs[2].image.crop[1]);
});

test('개별 JSON, 내장 카탈로그, catalog.json의 4번이 완전히 동일',()=>{
  const ctx={window:{}};vm.createContext(ctx);vm.runInContext(read('site/assets/data/catalog.js'),ctx);
  assert.equal(JSON.stringify(bank),JSON.stringify(exam));
  assert.equal(JSON.stringify(ctx.window.YP_CATALOG),JSON.stringify(data));
  assert.equal(JSON.stringify(ctx.window.YP_CATALOG.exams.find(e=>e.examId===exam.examId)),JSON.stringify(exam));
});

test('카탈로그 버전 3.7.3와 교사·학생 페이지의 캐시 무효화',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'3.7.6');
  assert.equal(data.featureVersion,'3.7.6-physics2-r14-reviewed');
  for(const f of ['index.html','report.html','portal.html']){
    assert.match(read('site/'+f),/assets\/data\/catalog\.js\?v=3\.7\.6/);
  }
});

test('직전 물리2심화 2회 및 물리2 12회 포함 전체 카탈로그와 누적 연결 보존',()=>{
  assert.equal(data.exams.length,43);
  assert.equal(data.exams.filter(e=>e.status==='ready').length,24);
  assert.equal(data.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,246);
  assert.equal(data.courses.length,4);
  assert.equal(data.exams.find(e=>e.examId==='physics2-advanced-r02').status,'ready');
  assert.equal(data.exams.find(e=>e.examId==='physics2-basic-r12').status,'ready');
  assert.ok(data.exams.find(e=>e.examId==='physics1-basic-total-mechanics').historyExamIds.includes('physics1-basic-r06'));
});
