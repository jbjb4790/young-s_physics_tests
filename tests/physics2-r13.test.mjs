import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const exam=catalog.exams.find(e=>e.examId==='physics2-basic-r13');
const bank=JSON.parse(read('site/assets/data/questions/physics2-basic-r13.json'));
const context={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,TextEncoder,TextDecoder,URL,Blob,crypto:globalThis.crypto,navigator:{},document:{},setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(read('site/assets/core.js'),context);
const YP=context.window.YP;
const exists=p=>fs.existsSync(path.join(ROOT,p));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
const arr=[20,10,15,25,10,10,10];

test('물리2 일반 13회 기존 placeholder만 ready 활성화 (7문항, 100점)',()=>{
 assert.ok(exam);assert.equal(catalog.exams.filter(x=>x.examId===exam.examId).length,1);
 assert.equal(exam.courseId,'physics2-basic');assert.equal(exam.round,13);
 assert.equal(exam.status,'ready');assert.equal(exam.assessmentType,'weekly');
 assert.equal(exam.questionCount,7);assert.equal(exam.questions.length,7);assert.equal(exam.maxScore,100);
 assert.deepEqual(exam.questions.map(x=>x.maxPoints),arr);
 assert.equal(new Set(catalog.exams.map(e=>e.examId)).size,42);
 assert.equal(catalog.courses.length,4);assert.equal(catalog.exams.length,42);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').length,22);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,230);
});

test('기존 11·12회, 심화2·3회, 물리1 6회 4번과 총괄 연결 보존',()=>{
 for(const id of ['physics2-basic-r11','physics2-basic-r12','physics2-advanced-r02','physics2-advanced-r03','physics1-basic-r06']){
  assert.equal(YP.getExam(id).status,'ready');
 }
 const t=YP.getExam('physics2-basic-total-electromagnetism');
 assert.equal(t.status,'coming-soon');
 assert.ok(t.historyExamIds.includes('physics2-basic-r13'));
 assert.deepEqual(catalog.operatingPolicy.weeklyRounds['physics2-basic'],[1,2,3,4,5,6,7,8,9,11,12,13,14,15]);
 assert.equal(YP.getExam('physics1-basic-r06').questions[3].originalRetry.answer,'0.2 m');
 assert.equal(YP.getExam('physics2-advanced-r03').questions[7].originalRetry.answer,'3번 계단');
});

test('전원문항 7개 점수/분할루브릭 100점, 재도전 4지 선택 14문항',()=>{
 for(const q of exam.questions){
  assert.equal(q.type,'subjective');assert.equal(q.inputMode,'achievement');
  assert.equal(q.rubric.reduce((s,x)=>s+x.points,0),q.maxPoints);
  assert.ok(q.explanation.length>=3);assert.ok(q.formulas.length>=2);assert.ok(q.commonMistakes.length>=2);
  assert.ok(q.answer.length>3);assert.ok(q.image);
  for(const k of ['originalRetry','similarProblem']){
   const c=q[k];assert.equal(c.inputMode,'choice');assert.equal(c.displayMode,'choice-card');
   assert.equal(c.choices.length,4);assert.equal(new Set(c.choices).size,4);assert.equal(c.answer,c.choices[c.correctChoice-1]);
   assert.equal(YP.checkChoiceAnswer(String(c.correctChoice),c),true);
   assert.equal(YP.checkChoiceAnswer(String(c.correctChoice%4+1),c),false);
   assert.ok(c.prompt.length>20);
  }
 }
 assert.deepEqual(exam.questions[0].rubric.map(r=>r.points),[5,5,5,5]);
 assert.deepEqual(exam.questions[3].rubric.slice(0,3).map(r=>r.points),[4,3,3]);
});

test('교사 성적 1/0/P1/실수/공란 입력·부분점수 100점 검증',()=>{
 const ex=YP.getExam(exam.examId);
 assert.equal(YP.calculateResult(ex,Array(7).fill('1')).score,100);
 assert.equal(YP.calculateResult(ex,Array(7).fill('0')).score,0);
 assert.equal(YP.parseQuestionInput('1',ex.questions[0]).score,20);
 assert.equal(YP.parseQuestionInput('1',ex.questions[3]).score,25);
 assert.equal(YP.parseQuestionInput('P1',ex.questions[3]).score,1);
 assert.equal(YP.parseQuestionInput('12.5',ex.questions[3]).score,12.5);
 assert.equal(YP.parseQuestionInput('25.01',ex.questions[3]).valid,false);
 assert.equal(YP.parseQuestionInput('-1',ex.questions[3]).valid,false);
 const res=YP.calculateResult(ex,['1','5','0','12.5','1','P1','']);
 assert.equal(res.score,20+5+0+12.5+10+1);assert.equal(res.counts.ungraded,1);
});

test('문항1: 전지9V 저항3Ω, 무충전 축전기 닫은직후 3A 0V, 장시간 0A 9V',()=>{
 assert.match(exam.questions[0].answer,/3 A.*0 V.*0 A.*9 V/);
 assert.match(exam.questions[0].correctionNote,/무충전/);
 assert.equal(9/3,3);
});

test('문항2: 실측 그래프 ε1.8V 내부저항1Ω',()=>{
 assert.match(exam.questions[1].answer,/1\.8 V.*1 Ω/);
 const r=(1.6-1.4)/(.4-.2),e=1.6+r*.2;
 assert.ok(Math.abs(r-1)<1e-12&&Math.abs(e-1.8)<1e-12);
});

test('문항3: 정상상태 Rx=R/2면 Q=CV/6, Rx=3R이면 V/4',()=>{
 const [a1,a2]=[(.5)/(1+.5),3/(1+3)];
 assert.ok(Math.abs(Math.abs(a1-.5)-1/6)<1e-12);
 assert.ok(Math.abs(Math.abs(a2-.5)-1/4)<1e-12);
 assert.match(exam.questions[2].answer,/CV\/6.*V\/4/);
 assert.match(exam.questions[2].correctionNote,/정상상태/);
});

test('문항4: 회로 전원극성 고려 R1=3A R3=0 R5=3A, 전위차 크기6V, 0W',()=>{
 const q=exam.questions[3];
 assert.match(q.answer,/3 A.*0 A.*3 A.*6 V.*0 W/);
 assert.match(q.correctionNote,/V_a−V_b.*−6 V/);
 assert.equal(24/(4*2),3);assert.equal(3*2,6);assert.equal(0*0*2,0);
});

test('문항5: 1.5V 두 전지 내부저항 포함하면 0.5A, 전구2.8V',()=>{
 assert.equal((1.5+1.5)/(5.6+.2+.2),.5);
 assert.equal(.5*5.6,2.8);
 assert.match(exam.questions[4].answer,/0\.5 A.*2\.8 V/);
});

test('문항6: 4개 동일 전지의 병렬2+직렬2 합성은3E,2.5r, I6A',()=>{
 assert.equal(3*25/(10+2.5*1),6);
 assert.match(exam.questions[5].answer,/6 A/);
 assert.match(exam.questions[5].correctionNote,/네 전지를 모두 동일/);
});

test('문항7: KVL로 I1=2A, I2=1A, 중간 저항 1A 아래',()=>{
 const i1=2,i2=1;
 assert.equal(4*i1-2*i2,6);assert.equal(-2*i1+3*i2,-1);
 assert.match(exam.questions[6].answer,/I₁=2 A, I₂=1 A.*1 A/);
 assert.match(exam.questions[6].answer,/아래 방향/);
});

test('원본3p PDF, 교정3p PDF, 원본 HWP 보존과 3개 페이지 이미지 규격 확인',()=>{
 const pdfs=[exam.pdf,exam.solutionPdf];
 for(const rel of pdfs){const b=fs.readFileSync(path.join(ROOT,'site',rel));assert.equal(b.subarray(0,4).toString(),'%PDF');assert.ok(b.length>20000);}
 const ole=fs.readFileSync(path.join(ROOT,'site','assets/documents/physics2/r13-original-solution.hwp'));
 assert.equal(ole.subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1');
 assert.equal(hash('site/assets/documents/physics2/r13-original-solution.hwp'),hash('docs/물리2_13회차_원본해설_숙제노트.hwp'));
 assert.equal(exam.pages.length,3);
 for(const rel of exam.pages){const b=fs.readFileSync(path.join(ROOT,'site',rel));assert.equal(b.toString('ascii',1,4),'PNG');assert.equal(b.readUInt32BE(16),1240);assert.equal(b.readUInt32BE(20),1753);}
});

test('각 7개 원문 이미지 crop은 페이지 내이고 최소 크기 확보',()=>{
 assert.deepEqual(exam.questions.map(q=>q.image.page),[1,1,1,2,2,3,3]);
 for(const q of exam.questions){
  const [x,y,w,h]=q.image.crop;
  assert.ok(x>=0&&y>=0&&w>=500&&h>=600&&x+w<=1240&&y+h<=1753,'Q'+q.no);
 }
});

test('독립 문항 JSON, catalog.json, catalog.js 객체 일치',()=>{
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(read('site/assets/data/catalog.js'),ctx);
 assert.equal(JSON.stringify(ctx.window.YP_CATALOG),JSON.stringify(catalog));
 assert.equal(JSON.stringify(bank),JSON.stringify(exam));
});

test('v3.7.4 클라이언트 캐시 무효화, 기존 API 및 보안 설정 존재',()=>{
 assert.equal(JSON.parse(read('package.json')).version,'3.7.4');
 assert.equal(catalog.featureVersion,'3.7.4-physics2-basic-r13-reviewed');
 for(const f of ['index.html','report.html','portal.html'])assert.match(read('site/'+f),/assets\/data\/catalog\.js\?v=3\.7\.4/);
 for(const name of ['.github/workflows/pages.yml','apps-script/Code.gs','apps-script/appsscript.json','cloudflare-worker/index.mjs','site/assets/runtime-config.js','site/assets/share-config.js'])assert.ok(exists(name));
 assert.match(read('apps-script/Code.gs'),/function syncCatalog_\(/);
 assert.match(read('apps-script/Code.gs'),/function getStudentPortal_\(/);
});
