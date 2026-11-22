import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const bytes=f=>fs.readFileSync(path.join(ROOT,f));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const clone=v=>JSON.parse(JSON.stringify(v));
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const baseline=JSON.parse(read('tests/fixtures/r03-basic-baseline-v3715.json'));
const ID='physics2-basic-r03';
const exam=catalog.exams.find(e=>e.examId===ID);
const context={window:{YP_CATALOG:clone(catalog),YP_CONFIG:{}},console,URL,TextEncoder,TextDecoder,Blob,setTimeout,clearTimeout,navigator:{},document:{}};
vm.createContext(context);
vm.runInContext(read('site/assets/core.js'),context);
vm.runInContext(read('site/assets/csv-import.js'),context);
const YP=context.window.YP;
const points=[5,5,5,5,5,5,5,5,5,5,10,5,10,10,10,5];
const mixedInputs=()=>{
 const v=Array(16).fill('1');v[1]='P1';v[10]='5';v[11]='0';v[15]='';return v;
};
const record=(id,inputs,token)=>YP.normalizeRecord({examId:id,courseId:'physics2-basic',studentId:'r03-synthetic-student',token,fingerprint:'r03-synthetic-fingerprint',school:'검증용가상학교',name:'검증용가상학생',resultInputs:inputs,partialModes:Array(inputs.length).fill(false),createdAt:'2026-11-22T01:00:00Z'});

test('일반 물리2 기존 3회차 ID만 활성화: 16문항 20답란 환산100점',()=>{
 assert.ok(exam);assert.equal(exam.courseId,'physics2-basic');assert.equal(exam.round,3);
 assert.equal(exam.status,'ready');assert.equal(exam.assessmentType,'weekly');assert.equal(exam.section,'mechanics');
 assert.equal(exam.questionCount,16);assert.equal(exam.maxScore,100);
 assert.deepEqual(exam.questions.map(q=>q.no),Array.from({length:16},(_,i)=>i+1));
 assert.deepEqual(exam.questions.map(q=>q.maxPoints),points);assert.equal(points.reduce((a,b)=>a+b,0),100);
 assert.equal(catalog.exams.filter(e=>e.examId===ID).length,1);
 assert.equal(catalog.exams.length,47);assert.equal(catalog.courses.length,4);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').length,32);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,334);
 assert.equal(exam.reviewStatus,'verified');
});

test('v3.7.15의 다른 46시험 정의와 기존31개 문항은행 원본 바이트 보존',()=>{
 assert.equal(baseline.sourceVersion,'3.7.15');assert.equal(Object.keys(baseline.examHashes).length,47);
 for(const [id,expected] of Object.entries(baseline.examHashes)){
  if(id===ID)continue;
  const old=catalog.exams.find(e=>e.examId===id);assert.ok(old,id);assert.equal(hash(JSON.stringify(old)),expected,id);
 }
 assert.equal(Object.keys(baseline.existingBankHashes).length,31);
 for(const [f,expected] of Object.entries(baseline.existingBankHashes))assert.equal(hash(bytes(f)),expected,f);
});

test('교사·성적표·학생포털·인증·영구링크·배포 설정20파일 보존, HTML은 catalog쿼리만 갱신',()=>{
 assert.equal(Object.keys(baseline.protectedSha).length,20);
 for(const [f,expected] of Object.entries(baseline.protectedSha))assert.equal(hash(bytes(f)),expected,f);
 for(const [f,expected] of Object.entries(baseline.htmlBaseline)){
  assert.match(read(f),/catalog\.js\?v=3\.7\.16/);
  assert.equal(hash(read(f).replace(/catalog\.js\?v=[^"']+/g,'catalog.js?v=VERSION')),expected,f);
 }
});

test('3.7.16 캐시/패키지 버전, catalog 두형식과 독립 문항JSON 일치',()=>{
 assert.equal(JSON.parse(read('package.json')).version,'3.7.16');
 assert.equal(catalog.featureVersion,'3.7.16-physics2-basic-r03');
 assert.deepEqual(JSON.parse(read('site/assets/data/questions/'+ID+'.json')),exam);
 const c={window:{}};vm.createContext(c);vm.runInContext(read('site/assets/data/catalog.js'),c);
 assert.deepEqual(clone(c.window.YP_CATALOG),catalog);
});

test('이번 첨부 문제/해설 PDF는 원본 SHA256 및 크기 그대로 포함',()=>{
 const specs=[
  [exam.pdf,'assets/documents/physics2/r03-original.pdf',71756,'3104076262c424ffeb361e9dd33f7ed153437c1497207bcbc628557de88879b5'],
  [exam.solutionPdf,'assets/documents/physics2/r03-original-solution.pdf',72922,'4ec0fa52cf087929b9297cc67544cc4df097c4d440d70c81b839863dd79b9cb9']
 ];
 for(const [file,expected,size,sha] of specs){assert.equal(file,expected);const b=bytes('site/'+file);assert.equal(b.subarray(0,4).toString(),'%PDF');assert.equal(b.length,size);assert.equal(hash(b),sha);}
});

test('원본 한쪽 200dpi 페이지와16문항 크롭은 모두 이미지 범위 안에 존재',()=>{
 assert.deepEqual(exam.pages,['assets/pages/physics2/r03-original-p1.png']);
 const b=bytes('site/'+exam.pages[0]);assert.equal(b.toString('ascii',1,4),'PNG');
 const width=b.readUInt32BE(16),height=b.readUInt32BE(20);assert.deepEqual([width,height],[1653,2337]);
 for(const q of exam.questions){assert.equal(q.image.page,1);assert.equal(q.image.crop.length,4);const [x,y,w,h]=q.image.crop;assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height,`Q${q.no} crop`);}
});

test('성취입력1=각문항만점, P1=1점, 10점문항5=부분점수, 공란미채점',()=>{
 assert.equal(YP.calculateResult(exam,Array(16).fill('1')).score,100);
 assert.equal(YP.calculateResult(exam,Array(16).fill('0')).score,0);
 assert.equal(YP.calculateResult(exam,Array(16).fill('')).counts.ungraded,16);
 const r=YP.calculateResult(exam,mixedInputs());assert.equal(r.valid,true);assert.equal(r.score,81);
 assert.deepEqual(clone(r.counts),{full:12,partial:2,wrong:1,ungraded:1,invalid:0});
 assert.equal(YP.parseQuestionInput('5.01',exam.questions[0]).valid,false);
 assert.equal(YP.parseQuestionInput('10.01',exam.questions[10]).valid,false);
 assert.equal(YP.parseQuestionInput('1',exam.questions[0],true).score,1);
 assert.equal(YP.parseQuestionInput('2.5',exam.questions[0]).score,2.5);
 assert.equal(YP.parseQuestionInput('O',exam.questions[4]).valid,false);
});

test('16문항 정규화 후 학생ID·시험토큰·지문 유지 및 입력객체 비변경',()=>{
 const input={examId:ID,courseId:'physics2-basic',studentId:'stable-student',token:'stable-report-token',fingerprint:'stable-report-fp',school:'가상학교',name:'가상학생',resultInputs:mixedInputs(),partialModes:Array(16).fill(false)};
 const before=JSON.stringify(input),r=YP.normalizeRecord(input);
 assert.equal(JSON.stringify(input),before);assert.equal(r.score,81);assert.equal(r.resultInputs.length,16);
 for(const k of ['studentId','token','fingerprint','examId','courseId'])assert.equal(r[k],input[k],k);
});

test('원문복습16개/동형16개는 4지선다 유일선택, 모든 문항 환산루브릭 합계 일치',()=>{
 for(const q of exam.questions){
  assert.equal(q.type,'subjective');assert.equal(q.inputMode,'achievement');
  assert.ok(Array.isArray(q.explanation)&&q.explanation.length);assert.ok(Array.isArray(q.formulas)&&q.formulas.length);assert.ok(Array.isArray(q.commonMistakes)&&q.commonMistakes.length);
  assert.equal(q.rubric.reduce((n,r)=>n+r.points,0),q.maxPoints,`Q${q.no} rubric`);
  for(const key of ['originalRetry','similarProblem']){
   const cfg=q[key];assert.equal(cfg.choices.length,4);assert.equal(new Set(cfg.choices.map(s=>s.trim().toLowerCase())).size,4);
   assert.equal(cfg.answer,cfg.choices[cfg.correctChoice-1]);assert.equal(YP.normalizeChoiceChallenge(cfg).valid,true);
   for(let i=1;i<=4;i++)assert.equal(YP.checkChoiceAnswer(String(i),cfg),i===cfg.correctChoice,`Q${q.no} ${key} ${i}`);
  }
  assert.ok(q.similarProblem.explanation);assert.ok(q.similarProblem.provenance);
 }
});

test('Q1~Q16 CSV는 이질배점·부분점수·공란을 그대로 전달해81점 계산',()=>{
 const headings=['학교','이름',...Array.from({length:16},(_,i)=>'Q'+(i+1))];
 const values=['검증용가상학교','검증용가상학생',...mixedInputs()];
 const csv='\ufeff'+headings.join(',')+'\n'+values.join(',')+'\n';
 const imported=context.window.YP_CSV.importText(csv,exam,{fileName:'r03-synthetic.csv'});
 assert.equal(imported.students.length,1);const s=imported.students[0];
 assert.deepEqual(clone(s.inputs),mixedInputs());assert.equal(s.errors.length,0);assert.equal(s.partialModes.length,16);
 assert.equal(YP.calculateResult(exam,s.inputs,s.partialModes).score,81);
});

test('3회 성적은 기존 영구포털과 물리2 역학총괄 누적분석으로 자동 연결',()=>{
 const r2=record('physics2-basic-r02',Array(10).fill('1'),'old-r02-report');
 const r3=record(ID,Array(16).fill('1'),'new-r03-report');
 const total=YP.getExam('physics2-basic-total-mechanics');
 assert.deepEqual(clone(total.historyExamIds),['physics2-basic-r02','physics2-basic-r03','physics2-basic-r04','physics2-basic-r05','physics2-basic-r06','physics2-basic-r07','physics2-basic-r08','physics2-basic-r09']);
 const history=YP.computeHistorySummary(total,r3,[r2,r3]);
 assert.equal(history.count,2);assert.equal(history.expectedCount,8);assert.equal(history.score,200);assert.equal(history.maxScore,200);assert.equal(history.percent,100);
 const portal=YP.computeStudentPortalCumulative([r2,r3]);assert.equal(portal.reports.length,2);assert.equal(portal.cumulative.weeklyCount,2);assert.equal(portal.cumulative.averagePercent,100);
 assert.equal(portal.reports.find(r=>r.examId===ID).reportToken,'new-r03-report');
});
