import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const hashObject=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const exam=catalog.exams.find(e=>e.examId==='physics2-advanced-r05');
const base=JSON.parse(read('tests/fixtures/r05-baseline-v3710.json'));
const ctx={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(read('site/assets/core.js'),ctx);const YP=ctx.window.YP;
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const clean=o=>JSON.parse(JSON.stringify(o));

test('심화5회 신규 ID 하나, 7문항·100점·문제지 배점 등록',()=>{
 assert.ok(exam);assert.equal(exam.status,'ready');assert.equal(exam.courseId,'physics2-advanced');assert.equal(exam.round,5);assert.equal(exam.assessmentType,'weekly');
 assert.equal(catalog.exams.filter(e=>e.examId===exam.examId).length,1);assert.equal(exam.questionCount,7);assert.equal(exam.maxScore,100);
 assert.deepEqual(exam.questions.map(q=>q.no),[1,2,3,4,5,6,7]);assert.deepEqual(exam.questions.map(q=>q.maxPoints),[15,15,15,15,15,15,10]);
 assert.equal(exam.questions.reduce((s,q)=>s+q.maxPoints,0),100);
});
test('기존45시험 전체 정의 유지: 심화 총괄 연결목록에 r05만 추가',()=>{
 assert.equal(Object.keys(base.examHashes).length,45);
 for(const [id,sha] of Object.entries(base.examHashes)){if(id==='physics2-basic-total-electromagnetism')continue;const e=clean(catalog.exams.find(e=>e.examId===id));if(id==='physics2-advanced-total')e.historyExamIds=e.historyExamIds.filter(x=>x!==exam.examId);assert.equal(hashObject(e),sha,id)}
});
test('기존 독립 문제 JSON 전부 바이트 보존',()=>{for(const [f,sha] of Object.entries(base.existingQuestionFiles))assert.equal(hash(f),sha,f)});
test('보고서 원문해설 표시 확장 외 20개 보호파일 SHA256 동일',()=>{assert.equal(Object.keys(base.protectedFiles).length,21);for(const [f,sha] of Object.entries(base.protectedFiles))if(f!=='site/assets/report.js')assert.equal(hash(f),sha,f)});
test('총괄 연결2·3·4·5, 4회 구형·개정 ID와 현재입력 분리 유지',()=>{
 assert.deepEqual(catalog.operatingPolicy.weeklyRounds['physics2-advanced'],[2,3,4,5]);
 const t=YP.getExam('physics2-advanced-total');assert.ok(t.historyExamIds.includes(exam.examId));assert.equal(t.status,'coming-soon');
 assert.equal(YP.getExam('physics2-advanced-r04-v2').replacesExamId,'physics2-advanced-r04');
 assert.equal(YP.getExam('physics1-basic-r16-v2').replacesExamId,'physics1-basic-r16');assert.equal(YP.getExam('physics2-basic-r15').questionCount,9);
});
test('6번 원문 문제지15점(10+5) 우선, 해답지20점 불일치 표시',()=>{
 const q=exam.questions[5];assert.equal(q.maxPoints,15);assert.deepEqual(q.rubric.map(x=>x.points),[10,5]);
 assert.match(q.correctionNote,/문제지는 총15점/);assert.match(q.correctionNote,/해답지는 총20점/);assert.match(exam.sourceNote,/초파/);
});
test('7문항 루브릭·개념·풀이·원문 및 새 동형 각각7개',()=>{
 for(const q of exam.questions){assert.equal(q.type,'subjective');assert.equal(q.inputMode,'achievement');assert.equal(q.rubric.reduce((a,r)=>a+r.points,0),q.maxPoints);assert.ok(q.explanation.length>=3);assert.ok(q.formulas.length>=3);assert.ok(q.commonMistakes.length>=2);
  for(const key of ['originalRetry','similarProblem']){const c=q[key];assert.equal(c.choices.length,4);assert.equal(new Set(c.choices).size,4);assert.equal(c.answer,c.choices[c.correctChoice-1]);assert.equal(c.displayMode,'choice-card');assert.match(c.prompt,key==='originalRetry'?/^원문/:/^동형 \(새 작성\)/);for(let i=1;i<=4;i++)assert.equal(YP.checkChoiceAnswer(String(i),c),i===c.correctChoice)}
 }
});
test('정오답·실제1점·부분점수·미채점·범위초과 기존 규칙',()=>{
 assert.equal(YP.calculateResult(exam,Array(7).fill('1')).score,100);assert.equal(YP.calculateResult(exam,Array(7).fill('0')).score,0);
 const r=YP.calculateResult(exam,['1','P1','7.5','0','','5','10']);assert.equal(r.score,38.5);assert.equal(r.counts.ungraded,1);assert.equal(r.valid,true);
 assert.equal(YP.parseQuestionInput('15.5',exam.questions[5]).valid,false);assert.equal(YP.parseQuestionInput('10.5',exam.questions[6]).valid,false);
});
test('기존학생 새5회 입력 정규화에서 StudentId·token·fingerprint 유지',()=>{
 const input={examId:exam.examId,courseId:exam.courseId,studentId:'synthetic-student',token:'synthetic-report-r05',fingerprint:'synthetic-fp-r05',name:'가상검증학생',school:'검증학교',resultInputs:Array(7).fill('1')};
 const before=JSON.stringify(input),r=YP.normalizeRecord(input);
 for(const k of ['studentId','token','fingerprint','examId','courseId'])assert.equal(r[k],input[k]);assert.equal(JSON.stringify(input),before);assert.equal(r.resultInputs.length,7);
});
test('1번 운동량·에너지·상대속도 및 최고높이4h 검산',()=>{
 const u=5,a=2*u,b=0;approx(3*u-u,3*b+a);approx(3*u*u+u*u,3*b*b+a*a);approx(a-b,2*u);approx(a*a/(u*u),4);
 assert.match(exam.questions[0].answer,/2√\(2gh\)/);assert.match(exam.questions[0].answer,/4h/);assert.equal(exam.questions[0].similarProblem.answer,'16h');assert.match(exam.questions[0].correctionNote,/충돌하는 높이/);
});
test('2번 비탄성충돌 v/4와 진자cos식·동형 질량비 검산',()=>{
 const v=8,g=10,L=2,V=v/4,cos=1-v*v/(32*g*L);approx(v,4*V);approx(.5*4*V*V,4*g*L*(1-cos));
 assert.match(exam.questions[1].answer,/cosθ=1−v²\/\(32gL\)/);assert.match(exam.questions[1].similarProblem.answer,/1−v²\/\(8gL\)/);
});
test('3번 구심력·탄성력 두 상태와 동형 반지름6r/5',()=>{
 const m=2,w=3,r=4,k=3*m*w*w;approx(k*(1.5*r-r),m*1.5*r*w*w);approx(k*(3*r-r),m*3*r*2*w*w);approx(k*(1.2*r-r),m*1.2*r*w*w/2);
 assert.equal(exam.questions[2].similarProblem.answer,'6r/5');assert.match(exam.questions[2].answer,/k=3mω²/);
});
test('4번 접촉 한계 및 마찰 구간L2R, 동형4R',()=>{
 const g=10,R=2;approx(6*g*R/2-g*(2*R)/4,5*g*R/2);approx(7*g*R/2-g*(4*R)/4,5*g*R/2);
 assert.equal(exam.questions[3].answer,'(1) √(gR)  (2) L_max=2R');assert.equal(exam.questions[3].similarProblem.answer,'4R');
 // At limiting energy v_bottom²=5gR, the normal force is 3mg(1+cosφ)>=0 throughout.
 for(let deg=0;deg<=360;deg++)assert.ok(3*(1+Math.cos(deg*Math.PI/180))>=-1e-12);
});
test('5번 수직항력2mg와 중력을 분리해 H=R/2',()=>{
 const g=10,R=4;approx(2*g-g,g*R/R);approx(g*R/2,(g*R)/2);assert.equal(exam.questions[4].answer,'(1) √(gR)  (2) H=R/2');assert.equal(exam.questions[4].similarProblem.answer,'√(2gR), R');
});
test('6번 공은 오른쪽v/4이나 상자상대 왼쪽v/2; 탈출3L/2',()=>{
 const v=8,L=6,b=v/4,V=3*v/4,t=L/(V-b);approx(v,b+V);approx((V-b)/v,.5);assert.ok(b>0&&V>0);approx(V*t,1.5*L);
 const e=1/3,b2=(1-e)*v/2,V2=(1+e)*v/2;approx(V2*L/(V2-b2),2*L);assert.match(exam.questions[5].correctionNote,/상자가 정지/);
});
test('7번 움직이는 빗면 운동량·에너지와 M3m 동형',()=>{
 const m=2,M=6,v=8,g=10,V=m*v/(m+M),h=M*v*v/(2*g*(M+m));approx(m*v,(M+m)*V);approx(.5*m*v*v,.5*(m+M)*V*V+m*g*h);approx(h,3*v*v/(8*g));
 assert.equal(exam.questions[6].similarProblem.answer,'3v₀²/(8g)');assert.match(exam.questions[6].correctionNote,/총10점/);
});
test('업로드 원본 문제·해답 PDF 바이트 보존 및 4쪽 이미지 원문추출',()=>{
 const proof=JSON.parse(read('tests/fixtures/r05-original-assets.json'));
 assert.equal(exam.assetProvenance.originalPdfIncluded,true);assert.equal(exam.assetProvenance.redrawn,false);assert.equal(exam.assetProvenance.retypedQuestionText,false);
 assert.equal(exam.assetProvenance.kind,'original-pdf-render-crop');
 for(const [f,meta] of Object.entries(proof.sourceFiles)){const b=fs.readFileSync(path.join(root,'site',f));assert.equal(b.subarray(0,4).toString(),'%PDF');assert.equal(b.length,meta.size);assert.equal(hash('site/'+f),meta.sha256)}
 assert.equal(exam.pages.length,4);for(const f of exam.pages){const b=fs.readFileSync(path.join(root,'site',f));assert.equal(b.toString('ascii',1,4),'PNG');assert.equal(b.readUInt32BE(16),1653);assert.equal(b.readUInt32BE(20),2337);assert.equal(hash('site/'+f),proof.pageRenders[f].sha256)}
 for(const q of exam.questions){const {page,crop:[x,y,w,h]}=q.image;assert.ok(page>=1&&page<=4);assert.ok(x>=0&&y>=0&&x+w<=1653&&y+h<=2337);assert.deepEqual(q.image.crop,proof.crops[q.no].cropPx)}
});
test('catalogJS·JSON·독립 문제은행 동기화 및 버전·총수 일치',()=>{
 const c={window:{}};vm.createContext(c);vm.runInContext(read('site/assets/data/catalog.js'),c);assert.equal(JSON.stringify(c.window.YP_CATALOG),JSON.stringify(catalog));assert.deepEqual(JSON.parse(read('site/assets/data/questions/physics2-advanced-r05.json')),exam);
 assert.equal(catalog.courses.length,4);assert.equal(catalog.exams.length,46);assert.equal(catalog.exams.filter(e=>e.status==='ready').length,29);assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,301);
 assert.equal(JSON.parse(read('package.json')).version,'3.7.12');assert.equal(catalog.featureVersion,'3.7.12-physics2-emw-total');for(const p of ['index.html','portal.html','report.html'])assert.match(read('site/'+p),/catalog\.js\?v=3\.7\.12/);
});

test('교사·성적표·포털·코어 코드 v3.7.10과 모두 동일',()=>{
 for(const f of ['site/assets/app.js','site/assets/portal.js','site/assets/core.js'])assert.equal(hash(f),base.protectedFiles[f]);
});
test('문제·해답 분리 경로, 재구성본 연결 없음, 문제지에는 해답지 이미지가 없음',()=>{
 assert.notEqual(exam.pdf,exam.solutionPdf);assert.match(exam.pdf,/r05-original\.pdf$/);assert.match(exam.solutionPdf,/r05-original-solution\.pdf$/);
 assert.equal(fs.existsSync(path.join(root,'site/assets/documents/physics2-advanced/r05-web-reconstructed.pdf')),false);
 assert.doesNotMatch(JSON.stringify(exam),/source-based-reconstruction|web-reconstructed/);
 for(const q of exam.questions)assert.doesNotMatch(q.correctionNote,/웹용 재구성본|원본 PDF 이미지가 아니다/);
});
test('원문7번 총10점 유지: 미제공 소문항배점을 임의로 쪼개지 않음',()=>{assert.deepEqual(exam.questions[6].rubric.map(r=>r.points),[10])});
test('제출 전 노출되는 새 검수 메모에 1·2번 정답을 넣지 않음',()=>{
 assert.doesNotMatch(exam.questions[0].correctionNote,/2√|4h/);
 assert.doesNotMatch(exam.questions[1].correctionNote,/32gL|cosθ=/);
});
