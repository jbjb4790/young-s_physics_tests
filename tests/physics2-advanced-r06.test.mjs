import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const objectSha=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const clone=o=>JSON.parse(JSON.stringify(o));
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const exam=catalog.exams.find(e=>e.examId==='physics2-advanced-r06');
const base=JSON.parse(read('tests/fixtures/r06-baseline-v3713.json'));
const asset=JSON.parse(read('docs/validation/r06-final-original-assets.json'));
const c={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(read('site/assets/core.js'),c);
const YP=c.window.YP;
const approx=(a,b,rel=1e-10)=>assert.ok(Math.abs(a-b)<=rel*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);

test('6회 신규 고유 ID·만점100 및 원문 소문항 배점 10/10/20/15/20/15/10',()=>{
 assert.ok(exam);assert.equal(exam.courseId,'physics2-advanced');assert.equal(exam.status,'ready');assert.equal(exam.round,6);assert.equal(exam.assessmentType,'weekly');
 assert.equal(exam.questionCount,7);assert.deepEqual(exam.questions.map(q=>q.no),[1,2,3,4,5,6,7]);assert.deepEqual(exam.questions.map(q=>q.maxPoints),[10,10,20,15,20,15,10]);
 assert.equal(exam.questions.reduce((s,q)=>s+q.maxPoints,0),100);assert.equal(catalog.exams.filter(x=>x.examId===exam.examId).length,1);
 assert.deepEqual(exam.questions.map(q=>q.rubric.map(x=>x.points)),[[5,5],[5,5],[5,10,5],[5,5,5],[5,10,5],[5,5,5],[3,4,3]]);
});

test('기존 46개 시험 내용 불변: 물리2심화 총괄에 6회 링크만 추가',()=>{
 assert.equal(Object.keys(base.catalogExamHashes).length,46);
 for(const [id,expected] of Object.entries(base.catalogExamHashes)){
  if(id==='physics2-basic-r02'||id==='physics2-basic-r03')continue; // R02 activated in v3.7.15, R03 in v3.7.16; each has dedicated preservation tests.
  const e=clone(catalog.exams.find(e=>e.examId===id));assert.ok(e,id);
  if(id==='physics2-advanced-total')e.historyExamIds=e.historyExamIds.filter(x=>x!=='physics2-advanced-r06');
  assert.equal(objectSha(e),expected,id);
 }
});

test('기존 29개 독립 문항은행 JSON과 서버·로고·학생링크 등 22개 보호 파일 바이트 불변',()=>{
 assert.equal(Object.keys(base.oldQuestionFileSha).length,29);
 for(const [f,expected] of Object.entries(base.oldQuestionFileSha))assert.equal(sha(f),expected,f);
 for(const [f,expected] of Object.entries(base.protectedSha))assert.equal(sha(f),expected,f);
});

test('기존 3개 HTML은 카탈로그 캐시쿼리만 갱신, 기능 UI·인증코드 그대로',()=>{
 for(const [f,expected] of Object.entries(base.htmlBaseline)){
  const modified=read(f).replace(/catalog\.js\?v=3\.7\.16/g,'catalog.js?v=3.7.12');
  assert.equal(crypto.createHash('sha256').update(modified).digest('hex'),expected,f);
 }
});

test('심화 총괄 연결범위 2,3,4구형/개정,5,6 및 16회 신구 분리 보존',()=>{
 assert.deepEqual(catalog.operatingPolicy.weeklyRounds['physics2-advanced'],[2,3,4,5,6]);
 const total=YP.getExam('physics2-advanced-total');assert.deepEqual(total.historyExamIds.slice(-2),['physics2-advanced-r05','physics2-advanced-r06']);assert.equal(total.status,'coming-soon');
 assert.equal(YP.getExam('physics2-advanced-r04-v2').replacesExamId,'physics2-advanced-r04');
 assert.equal(YP.getExam('physics1-basic-r16-v2').replacesExamId,'physics1-basic-r16');
 assert.equal(YP.getExam('physics2-basic-total-electromagnetism').status,'ready');
});

test('최종 재첨부 원본 문제·해답 PDF를 바이트 그대로 보존',()=>{
 assert.match(exam.pdf,/r06-original\.pdf$/);assert.match(exam.solutionPdf,/r06-original-solution\.pdf$/);
 assert.equal(exam.assetProvenance.originalPdfIncluded,true);assert.equal(exam.assetProvenance.originalAnswerPdfIncluded,true);
 assert.equal(exam.assetProvenance.redrawn,false);assert.equal(exam.assetProvenance.retypedQuestionText,false);
 for(const [f,meta] of [[`site/${exam.pdf}`,asset.questionPdf],[`site/${exam.solutionPdf}`,asset.solutionPdf]]){
  const b=fs.readFileSync(path.join(root,f));assert.equal(b.subarray(0,4).toString(),'%PDF');assert.equal(b.length,meta.size);assert.equal(sha(f),meta.sha256)
 }
 assert.equal(exam.assetProvenance.sourceQuestionFile,'물리2심화 Quiz 6회 v2(2).pdf');
 assert.equal(exam.assetProvenance.sourceSolutionFile,'물리2심화 Quiz 6회 v2 해설(1).pdf');
 assert.notEqual(asset.questionPdf.sha256,asset.solutionPdf.sha256);
});

test('200dpi 원본 4개 페이지 PNG, 7개 크롭 경계·페이지 연결',()=>{
 assert.equal(exam.pages.length,4);
 for(const f of exam.pages){const p=fs.readFileSync(path.join(root,'site',f));assert.equal(p.subarray(1,4).toString(),'PNG');assert.equal(p.readUInt32BE(16),1653);assert.equal(p.readUInt32BE(20),2337);assert.equal(sha('site/'+f),asset.pages[f].sha256)}
 for(const q of exam.questions){const [x,y,w,h]=q.image.crop;assert.ok(w>=600&&h>=500&&x>=0&&y>=0&&x+w<=1653&&y+h<=2337,q.no);assert.deepEqual(q.image, {page:asset.crops[q.no].page,crop:asset.crops[q.no].crop});}
});

test('원문/새동형 각각 7개 4지선다·객관식 정답 제출 및 해설',()=>{
 for(const q of exam.questions){assert.equal(q.type,'subjective');assert.equal(q.inputMode,'achievement');assert.equal(q.rubric.reduce((a,r)=>a+r.points,0),q.maxPoints);assert.ok(q.explanation.length>=3);assert.ok(q.formulas.length>=3);
  for(const key of ['originalRetry','similarProblem']){const obj=q[key];assert.equal(obj.choices.length,4);assert.equal(new Set(obj.choices).size,4);assert.equal(obj.choices[obj.correctChoice-1],obj.answer);assert.match(obj.prompt,key==='originalRetry'?/^원문/:/^동형 \(새 작성\)/);for(let idx=1;idx<=4;idx++)assert.equal(YP.checkChoiceAnswer(String(idx),obj),idx===obj.correctChoice)}
 }
});

test('기존 주간채점 규칙(0·1만점·P1·실수·공란), 학생 ID/토큰/지문 그대로',()=>{
 assert.equal(YP.calculateResult(exam,Array(7).fill('1')).score,100);assert.equal(YP.calculateResult(exam,Array(7).fill('0')).score,0);
 const v=YP.calculateResult(exam,['1','P1','10','5','','7.5','0']);assert.equal(v.score,33.5);assert.equal(v.counts.ungraded,1);assert.equal(v.valid,true);
 assert.equal(YP.parseQuestionInput('21',exam.questions[2]).valid,false);
 const fake={examId:exam.examId,courseId:exam.courseId,studentId:'synthetic_r06',token:'synthetic_token',fingerprint:'synthetic_fp',name:'가상학생',school:'가상학교',resultInputs:Array(7).fill('1')};
 const out=YP.normalizeRecord(fake);for(const key of ['examId','courseId','studentId','token','fingerprint'])assert.equal(out[key],fake[key]);
});

test('Q1 중심거리4R/9R, 주기비27/8',()=>{approx((9/4)**1.5,27/8);approx(Math.sqrt(1/4),.5);assert.match(exam.questions[0].answer,/27\/8/)});
test('Q2 쌍성 질량중심·ω²=2GM/(9R³)',()=>{const G=2,M=7,R=3,ma=4*M,mb=2*M;approx(ma*R,mb*2*R);const omega2=G*(ma+mb)/(3*R)**3;approx(omega2,2*G*M/(9*R**3));const t=2*Math.PI/Math.sqrt(omega2);approx(t,6*Math.PI*Math.sqrt(R**3/(2*G*M)))});
test('Q3 장반지름2R, 에너지−GMm/4R, A/B 속력비3, ΔU=2GMm/(3R)',()=>{const G=2,M=7,m=3,R=5;const va=Math.sqrt(G*M*(2/R-1/(2*R))),vb=Math.sqrt(G*M*(2/(3*R)-1/(2*R)));approx(va/vb,3);approx(-G*M*m/(2*2*R),-G*M*m/(4*R));approx((-G*M*m/(3*R))-(-G*M*m/R),2*G*M*m/(3*R))});
test('Q4 수직 발사 최고점 2R, 4R 도달 속력 √(3GM/2R)',()=>{const G=2,M=7,R=4,m=3,v=Math.sqrt(G*M/R);const E=.5*m*v*v-G*M*m/R;approx(E,-G*M*m/(2*R));approx(-G*M*m/E,2*R);const u=Math.sqrt(3*G*M/(2*R));approx(.5*m*u*u-G*M*m/R,-G*M*m/(4*R))});
test('Q5 A근일 R 원일3R, v2/v1=√(3/2), v3=v2/3',()=>{const G=2,M=11,R=3,v1=Math.sqrt(G*M/R),v2=Math.sqrt(3*G*M/(2*R)),v3=Math.sqrt(G*M/(6*R));approx(v2/v1,Math.sqrt(1.5));approx(v3/v2,1/3);approx(R*v2,3*R*v3)});
test('Q6 접선속력 √(3GM/2R), E−GMm/4R, 장반지름2R, 원일3R',()=>{const G=2,M=11,R=4,m=3,v=Math.sqrt(3*G*M/(2*R)),E=.5*m*v*v-G*M*m/R;approx(E,-G*M*m/(4*R));const a=-G*M*m/(2*E);approx(a,2*R);approx(2*a-R,3*R)});
test('Q7 네 위성 인접 두 개+정반대 한 개의 구심 방향 성분 모두 합산',()=>{const G=3,M=11,m=5,r=7,center=G*M*m/r**2,opp=G*m*m/(4*r**2),neighbors=G*m*m/(Math.SQRT2*r**2);const omega2=(center+opp+neighbors)/(m*r),fromEffective=G*(M+m*(1/4+1/Math.SQRT2))/r**3;approx(omega2,fromEffective);approx(2*Math.PI/Math.sqrt(omega2),2*Math.PI*Math.sqrt(r**3/(G*(M+m*(1/4+1/Math.SQRT2)))));assert.match(exam.questions[6].answer,/1\/√2/);assert.match(exam.questions[6].answer,/r³/);assert.doesNotMatch(exam.questions[6].answer,/R³/)});

test('47시험·30준비완료·308문항, 독립 문제은행과 catalog.js 일치',()=>{
 assert.equal(catalog.exams.length,47);assert.equal(catalog.exams.filter(e=>e.status==='ready').length,32);assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,334);
 const js={window:{}};vm.createContext(js);vm.runInContext(read('site/assets/data/catalog.js'),js);
 assert.deepEqual(clone(js.window.YP_CATALOG),catalog);assert.deepEqual(JSON.parse(read('site/assets/data/questions/physics2-advanced-r06.json')),exam);
 assert.equal(JSON.parse(read('package.json')).version,'3.7.16');assert.equal(catalog.featureVersion,'3.7.16-physics2-basic-r03');
 for(const p of ['index.html','report.html','portal.html'])assert.match(read('site/'+p),/catalog\.js\?v=3\.7\.16/);
});


test('문제지 7번 r과 해답지 R 상이: 문제지 r로 저장하고 원본 해답을 변경하지 않음',()=>{
 const q=exam.questions[6];assert.match(q.answer,/r³/);assert.match(q.correctionNote,/문제지의 궤도 반지름은 r/);assert.match(q.correctionNote,/해설지는 R/);
 assert.match(q.sourceText,/r/);assert.match(q.formulas.join(' ')+q.answer,/r³/);
 assert.equal(exam.assetProvenance.originalAnswerPdfIncluded,true);
});
test('4번 (2) 해답10점 대 문제지5점 불일치: 문제지총15점 적용',()=>{
 assert.deepEqual(exam.questions[3].rubric.map(x=>x.points),[5,5,5]);
 assert.match(exam.questions[3].correctionNote,/문제지 4번 \(2\)는 5점/);
 assert.match(exam.questions[3].correctionNote,/해설은 10점/);
});
