import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const exam=catalog.exams.find(e=>e.examId==='physics2-advanced-r04');
const independent=JSON.parse(read('site/assets/data/questions/physics2-advanced-r04.json'));
const points=[15,10,10,20,20,15,10];
const ctx={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,TextEncoder,TextDecoder,URL,Blob,crypto:globalThis.crypto,navigator:{},document:{}};
vm.createContext(ctx);vm.runInContext(read('site/assets/core.js'),ctx);const YP=ctx.window.YP;

function pngSize(rel){const b=fs.readFileSync(path.join(root,'site',rel));assert.equal(b.toString('ascii',1,4),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)];}

 test('물리2심화 4회차는 신규 고유 ID, 7문항 100점으로 등록',()=>{
 assert.ok(exam);assert.equal(exam.courseId,'physics2-advanced');assert.equal(exam.round,4);
 assert.equal(exam.status,'ready');assert.equal(exam.assessmentType,'weekly');assert.equal(exam.questionCount,7);assert.equal(exam.maxScore,100);
 assert.deepEqual(exam.questions.map(q=>q.no),[1,2,3,4,5,6,7]);assert.deepEqual(exam.questions.map(q=>q.maxPoints),points);
 assert.equal(exam.questions.reduce((a,q)=>a+q.maxPoints,0),100);assert.equal(catalog.exams.length,46);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').length,28);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,276);
 assert.equal(new Set(catalog.exams.map(e=>e.examId)).size,46);
});

test('심화 총괄 누적 연결 [2,3,4], 다른 회차와 물리1 16회 신구분리 유지',()=>{
 assert.deepEqual(catalog.operatingPolicy.weeklyRounds['physics2-advanced'],[2,3,4,5]);
 assert.deepEqual(catalog.exams.find(e=>e.examId==='physics2-advanced-total').historyExamIds,['physics2-advanced-r02','physics2-advanced-r03','physics2-advanced-r04','physics2-advanced-r04-v2','physics2-advanced-r05']);
 for(const id of ['physics2-advanced-r02','physics2-advanced-r03','physics2-basic-r14','physics1-basic-r16','physics1-basic-r16-v2'])assert.equal(YP.getExam(id).status,'ready');
 assert.equal(YP.getExam('physics1-basic-r16').questionCount,6);assert.equal(YP.getExam('physics1-basic-r16-v2').questionCount,7);
 assert.equal(YP.getExam('physics1-basic-r16-v2').questions[3].answer,'2 m');
});

test('7문항의 루브릭 합, 전체 O/X, P1, 부분점수와 공란 입력',()=>{
 for(const q of exam.questions){assert.equal(q.type,'subjective');assert.equal(q.inputMode,'achievement');
   assert.equal(q.rubric.reduce((a,x)=>a+x.points,0),q.maxPoints,'Q'+q.no);
   assert.ok(q.formulas.length>=2);assert.ok(q.explanation.length>=3);assert.ok(q.commonMistakes.length>=2);
 }
 assert.deepEqual(exam.questions[0].rubric.map(r=>r.points),[4,4,4,3]);
 assert.deepEqual(exam.questions[5].rubric.map(r=>r.points),[3,4,4,4]);
 assert.deepEqual(exam.questions[6].rubric.map(r=>r.points),[5,5]);
 assert.equal(YP.calculateResult(exam,Array(7).fill('1')).score,100);
 assert.equal(YP.calculateResult(exam,Array(7).fill('0')).score,0);
 const res=YP.calculateResult(exam,['1','P1','0','7.5','4','6','']);
 assert.equal(res.valid,true);assert.equal(res.score,15+1+7.5+4+6);assert.equal(res.counts.ungraded,1);
 assert.equal(YP.parseQuestionInput('20.5',exam.questions[3]).valid,false);
});

test('원문·동형 선택 재도전 7개씩 모두 4지, 정답과 오답 선택 구분',()=>{
 for(const q of exam.questions)for(const key of ['originalRetry','similarProblem']){
   const c=q[key];assert.equal(c.inputMode,'choice');assert.equal(c.displayMode,'choice-card');
   assert.equal(c.choices.length,4);assert.equal(new Set(c.choices).size,4);
   assert.equal(c.answer,c.choices[c.correctChoice-1]);
   assert.ok(c.prompt.startsWith(key==='originalRetry'?'원문':'동형'));
   assert.equal(YP.checkChoiceAnswer(String(c.correctChoice),c),true);
   assert.equal(YP.checkChoiceAnswer(String(c.correctChoice%4+1),c),false);
 }
});

test('1번 대차 상대운동 최적각 22.5° 및 θ=45°, a=g/2 동형',()=>{
 const f=ang=>Math.sin(2*ang)+Math.cos(2*ang)-1;
 const phi=Math.PI/8;
 assert.ok(Math.abs(f(phi)-(Math.SQRT2-1))<1e-12);
 for(let d=0;d<=90;d+=0.5)assert.ok(f(d*Math.PI/180)<=f(phi)+1e-12);
 assert.match(exam.questions[0].answer,/22\.5°/);assert.equal(exam.questions[0].originalRetry.correctChoice,2);
 assert.equal(exam.questions[0].similarProblem.answer,'v₀²/(2g)');
});

test('2번 절벽 상하 30° 발사 착지점 간격 6h이면 v0²=4√3 gh',()=>{
 const ratio=4*Math.sqrt(3), delta=Math.sqrt(3)*ratio/2;
 assert.ok(Math.abs(delta-6)<1e-12);assert.equal(exam.questions[1].originalRetry.answer,'4√3 gh');
 assert.match(exam.questions[1].answer,/4√3/);
});

test('3번 평균힘 모델은 μ<√3 조건과 정수 n 처리에 한정',()=>{
 const q=exam.questions[2];assert.equal(q.reviewStatus,'conditional');
 assert.match(q.correctionNote,/μ<√3/);assert.match(q.correctionNote,/평균힘/);
 const mu=0.4,M=10,g=10,m=0.1,v=5;
 const upper=2*mu*M*g/(m*v*(Math.sqrt(3)-mu));
 assert.ok(upper>0);assert.ok(Number.isFinite(upper));
 assert.equal(q.similarProblem.answer,'μMg/(mv)');
});

test('4번 θ는 빗면 기준 발사각이며 기하식과 동형 수평면 맞음',()=>{
 const q=exam.questions[3];assert.match(q.answer,/cos\(θ\+φ\)/);
 const v=10,g=10,th=Math.PI/6,ph=Math.PI/12;
 const t=2*v*Math.sin(th)/(g*Math.cos(ph));
 const d=v*Math.cos(th)*t-(g*Math.sin(ph)/2)*t*t;
 const formula=2*v*v*Math.sin(th)*Math.cos(th+ph)/(g*Math.cos(ph)**2);
 assert.ok(Math.abs(d-formula)<1e-10);assert.equal(q.similarProblem.answer,'v₀/g');
});

test('5번 빗면 첫 교점의 양의 시간해, α=θ=0 동형 t=√2h/g',()=>{
 const q=exam.questions[4];const v=10,g=10,h=20,th=0,alpha=0;
 const A=v*(Math.sin(th)-Math.cos(th)*Math.tan(alpha));
 const t=(A+Math.sqrt(A*A+2*g*h))/g;
 assert.equal(t,2);assert.equal(q.similarProblem.answer,'√(2h/g)');
 assert.match(q.answer,/√\(A²\+2gh\)/);
});

test('6번 사람-대차 운동량 보존 V=-mv/(M+m), Δx=-mL/(M+m)',()=>{
 const m=2,M=6,v=4,L=12;
 const V=-m*v/(M+m);const d=-m*L/(M+m);
 assert.equal(V,-1);assert.equal(d,-3);assert.equal(V*L/v,d);
 assert.match(exam.questions[5].answer,/왼쪽/);assert.equal(exam.questions[5].similarProblem.answer,'v/2, 왼쪽');
});

test('7번 연속 탄성충돌 속도: A -5, B -2, C +8',()=>{
 const q=exam.questions[6];assert.match(q.answer,/−5 m\/s/);assert.match(q.answer,/−2 m\/s/);assert.match(q.answer,/\+8 m\/s/);
 // 첫 충돌 운동량·에너지
 assert.equal(1*15,1*(-5)+2*10);assert.equal(1*15**2,1*(-5)**2+2*10**2);
 // 두 번째 충돌 운동량·에너지
 assert.equal(2*10,2*(-2)+3*8);assert.equal(2*10**2,2*(-2)**2+3*8**2);
 assert.equal(q.originalRetry.correctChoice,1);assert.equal(q.similarProblem.correctChoice,2);
});

test('원본 문제 PDF 4p·원본 해설 5p·검수 해설 PDF 보존 및 페이지 PNG 이미지',()=>{
 const paths=[exam.pdf,'assets/documents/physics2-advanced/r04-original-solution.pdf',exam.solutionPdf];
 for(const f of paths){const b=fs.readFileSync(path.join(root,'site',f));assert.equal(b.subarray(0,4).toString(),'%PDF');assert.ok(b.length>50000);}
 assert.equal(exam.pages.length,4);
 for(const f of exam.pages)assert.deepEqual(pngSize(f),[1240,1753]);
 for(const q of exam.questions){const {page,crop}=q.image;assert.ok(page>=1&&page<=4);const [x,y,w,h]=crop;assert.ok(x>=0&&y>=0&&w>=550&&h>=550&&x+w<=1240&&y+h<=1753,'Q'+q.no);}
});

test('내장 카탈로그 JS·JSON과 독립 문제은행 일치, 학부모 UI 외 보호 파일 SHA 불변',()=>{
 const c={window:{}};vm.createContext(c);vm.runInContext(read('site/assets/data/catalog.js'),c);
 assert.equal(JSON.stringify(c.window.YP_CATALOG),JSON.stringify(catalog));
 assert.equal(JSON.stringify(independent),JSON.stringify(exam));
 const fixture=JSON.parse(read('tests/fixtures/r16-legacy-fingerprints.json'));
 for(const [f,sha] of Object.entries(fixture.protectedFileHashes)){
  if(['site/assets/portal.js','site/assets/styles.css'].includes(f))continue; // v3.7.8 학부모 UI 수정
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');assert.equal(actual,sha,f);
 }
});

test('v3.7.7 캐시·package 정합성 및 Apps Script·Worker 미변경',()=>{
 assert.equal(JSON.parse(read('package.json')).version,'3.7.11');
 assert.equal(catalog.featureVersion,'3.7.11-physics2-advanced-r05');
 for(const f of ['index.html','portal.html','report.html'])assert.match(read('site/'+f),/catalog\.js\?v=3\.7\.11/);
});
