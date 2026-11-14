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
const hashText=t=>crypto.createHash('sha256').update(t).digest('hex');
const hashObject=o=>hashText(JSON.stringify(o));
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const ID='physics2-basic-total-electromagnetism';
const exam=catalog.exams.find(e=>e.examId===ID);
const snap=JSON.parse(read('tests/fixtures/emw-baseline-v3710.json'));
const assets=JSON.parse(read('tests/fixtures/emw-original-assets.json'));
const ext=JSON.parse(read('tests/fixtures/emw-report-extension.json'));
const ctx={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(read('site/assets/core.js'),ctx);const YP=ctx.window.YP;
const clean=x=>JSON.parse(JSON.stringify(x));
const keys=[3,2,2,3,2,5,3,1,1,3,3,5,2,4,5,1,2,1,5,4];
const perfect=[...keys.map(String),...'44444'];
const record=values=>YP.normalizeRecord({examId:ID,courseId:'physics2-basic',studentId:'synthetic-emw',name:'합성검증학생',school:'검증학교',token:'synthetic-emw-token',fingerprint:'synthetic-emw-fp',resultInputs:values,inputEncoding:'objective-choice-v1'});

test('EMW 기존 시험ID 활성화, 20객관+5서술 각4점100점',()=>{
 assert.equal(exam.status,'ready');assert.equal(exam.assessmentType,'comprehensive');assert.equal(exam.courseId,'physics2-basic');
 assert.equal(catalog.exams.filter(e=>e.examId===ID).length,1);assert.equal(exam.questionCount,25);assert.equal(exam.maxScore,100);
 assert.deepEqual(exam.questions.map(q=>q.no),Array.from({length:25},(_,i)=>i+1));assert.ok(exam.questions.every(q=>q.maxPoints===4));
 assert.deepEqual(exam.questions.slice(0,20).map(q=>q.answerKey),keys);
 assert.ok(exam.questions.slice(0,20).every(q=>q.inputMode==='objective-choice'));assert.ok(exam.questions.slice(20).every(q=>q.inputMode==='points'));
});
test('첨부 공식 정답표 보존, 확인메모와 정답교정 구분',()=>{
 assert.equal(exam.reviewStatus,'공식해답기준');
 assert.deepEqual(exam.questions.filter(q=>q.requiresTeacherReview).map(q=>q.no),[3,5,6,13,15,24]);
 assert.equal(exam.questions[2].answerKey,2);assert.equal(exam.questions[12].answerKey,2);assert.equal(exam.questions[14].answerKey,5);
 for(const q of exam.questions.filter(q=>q.requiresTeacherReview)){assert.ok(q.sourceReviewNote);assert.match(q.correctionNote,/답 제출 후/);assert.doesNotMatch(q.correctionNote,/정답은 [①②③④⑤]|공식 정답 [①②③④⑤]/)}
});
test('25입력 채점100점, 객관1은선택번호/서술1은1점',()=>{
 assert.equal(YP.calculateResult(exam,perfect).score,100);
 assert.equal(YP.parseQuestionInput('1',exam.questions[0]).score,0);
 assert.equal(YP.parseQuestionInput('3',exam.questions[0]).score,4);
 assert.equal(YP.parseQuestionInput('1',exam.questions[20]).score,1);
 assert.equal(YP.calculateResult(exam,[...keys.map(String),'1','2','3','4','0']).score,90);
});
test('오답·부분점수·공란·범위초과·소수점 검증',()=>{
 assert.equal(YP.parseQuestionInput('6',exam.questions[0]).valid,false);
 assert.equal(YP.parseQuestionInput('2.5',exam.questions[0]).valid,false);
 assert.equal(YP.parseQuestionInput('4.1',exam.questions[20]).valid,false);
 assert.equal(YP.parseQuestionInput('2.5',exam.questions[20]).score,2.5);
 assert.equal(YP.parseQuestionInput('',exam.questions[0]).status,'ungraded');
});
test('StudentId·token·fingerprint와 기존 객체 불변',()=>{
 const r=record(perfect);for(const [k,v] of Object.entries({studentId:'synthetic-emw',token:'synthetic-emw-token',fingerprint:'synthetic-emw-fp'}))assert.equal(r[k],v);
 const old=record(perfect);const before=JSON.stringify(old);const other=record([...keys.map(String),...'00000']);assert.equal(JSON.stringify(old),before);assert.equal(other.score,80);
});
test('일반물리2 11~15회 누적 연결과 총괄 분류 유지',()=>{
 assert.deepEqual(exam.historyExamIds,[11,12,13,14,15].map(r=>'physics2-basic-r'+r));
 assert.ok(YP.readyExams().some(e=>e.examId===ID));assert.match(read('site/assets/portal.js'),/성적표 바로 보기/);
 assert.match(read('site/assets/portal.js'),/getStudentExamDetail/);
});
test('25원문 재도전 및25동형: 유일한보기와단일선택채점',()=>{
 for(const q of exam.questions)for(const k of ['originalRetry','similarProblem']){
   const c=q[k];assert.ok([4,5].includes(c.choices.length));assert.equal(new Set(c.choices).size,c.choices.length);
   assert.equal(c.answer,c.choices[c.correctChoice-1]);assert.equal(YP.normalizeChoiceChallenge(c).valid,true);
   for(let i=1;i<=c.choices.length;i++)assert.equal(YP.checkChoiceAnswer(String(i),c),i===c.correctChoice);
 }
 assert.ok(exam.questions.every(q=>q.similarProblem.prompt.startsWith('동형 (새 작성)')));
});
test('25문항 텍스트와 원문해설링크, 원문정답수동채점루브릭',()=>{
 for(const q of exam.questions){assert.ok(q.explanation.length>=2);assert.ok(q.formulas.length>=1);assert.ok(q.commonMistakes.length>=2);
 assert.equal(q.rubric.reduce((s,r)=>s+r.points,0),4);assert.match(q.sourceSolution.pdf,new RegExp('#page='+(q.no+1)+'$'));
 assert.ok(fs.existsSync(path.join(root,'site',q.sourceSolution.image)));
 }
 assert.equal(exam.questions[20].answer,'6kq²/a');assert.match(exam.questions[23].answer,/11λ\/4/);
});
test('원본2PDF와17페이지 및25해설이미지SHA256일치',()=>{
 for(const [f,h] of Object.entries(assets.originalPDFs))assert.equal(hash('site/'+f),h);
 assert.equal(assets.questionPages.length,17);assert.equal(assets.solutionCrops.length,25);
 for(const a of [...assets.questionPages,...assets.solutionCrops])assert.equal(hash('site/'+a.path),a.sha256);
});
test('25문항 crop좌표는 원본추출매니페스트의 [x,y,width,height] 변환과 동일',()=>{
 for(const q of exam.questions){const a=assets.questionCrops[q.no-1],[x0,y0,x1,y1]=a.crop_px;
 assert.deepEqual(q.image,{page:a.source_page,crop:[x0,y0,x1-x0,y1-y0]});
 const p=assets.questionPages[q.image.page-1];assert.ok(x0>=0&&y0>=0&&x1<=p.width&&y1<=p.height);
 }
});
test('카탈로그 JS/JSON과 독립시험JSON이 동일',()=>{
 assert.equal(JSON.stringify(JSON.parse(read(`site/assets/data/questions/${ID}.json`))),JSON.stringify(exam));
 const c={window:{}};vm.createContext(c);vm.runInContext(read('site/assets/data/catalog.js'),c);
 assert.equal(JSON.stringify(c.window.YP_CATALOG),JSON.stringify(catalog));
});
test('기존45시험 불변: EMW활성화·심화총괄r05연결만 예외',()=>{
 for(const [id,h] of Object.entries(snap.examHashes)){if(id===ID)continue;const e=clean(catalog.exams.find(e=>e.examId===id));
 if(id==='physics2-advanced-total')e.historyExamIds=e.historyExamIds.filter(x=>x!=='physics2-advanced-r05');
 assert.equal(hashObject(e),h,id);}
});
test('기존 문항JSON 보존: 활성화한 EMW 하나만 예외',()=>{for(const [f,h] of Object.entries(snap.existingQuestionFiles)){if(f.endsWith('/'+ID+'.json')||f.endsWith('/physics2-advanced-total.json'))continue;assert.equal(hash(f),h,f)}});
test('기존 모든 문제PDF·이미지 바이트보존',()=>{for(const [f,h] of Object.entries(snap.existingAssets))assert.equal(hash(f),h,f)});
test('20보호파일 SHA256 동일: 서버·코어·API·배포·포털·로고·학생관리',()=>{assert.equal(Object.keys(snap.protectedFiles).length,20);for(const [f,h] of Object.entries(snap.protectedFiles))if(!['site/assets/app.js','site/assets/styles.css'].includes(f))assert.equal(hash(f),h,f)});
test('보고서 확장 3표시치환+안전해설렌더만: 역치환시 이전 코드SHA 동일',()=>{
 let t=read('site/assets/report.js');assert.equal(hashText(t),ext.targetSha256);
 t=t.replace(ext.insertedFunction,'')
 .replace('${YP.escapeHTML(exam.reviewSummary||"원문 시험지와 공식 해설지를 문항별로 재계산하고, 조건·정답·수식·단위를 검수한 데이터입니다.")}','원문 시험지와 공식 해설지를 문항별로 재계산하고, 조건·정답·수식·단위를 검수한 데이터입니다.')
 .replace('<h4>${YP.escapeHTML(q.answerHeading||"검수된 정답·모범답안")}</h4>','<h4>검수된 정답·모범답안</h4>')
 .replace('function solutionHTML(q){return `${sourceSolutionHTML(q)}<div class="explain-grid">','function solutionHTML(q){return `<div class="explain-grid">');
 assert.equal(hashText(t),ext.baselineSha256);
});
test('원문해설은 제출후 공개영역 내부, 외부URL·경로탈출 방지',()=>{
 const t=read('site/assets/report.js');assert.match(t,/solution-reveal hidden/);assert.match(t,/sourceSolutionHTML\(q\)/);
 assert.match(t,/s\.image\.includes\("\.\."\)/);assert.match(t,/rel="noopener"/);
});
test('서버문항 merge 후 새해설메타·공식키·교사수정 우선순위 유지',()=>{
 const rows=[{QuestionNo:1,AnswerJSON:JSON.stringify({answerKey:4,display:'교사수정'}),ReviewStatus:'verified'}];
 const merged=YP.mergeExamQuestions(exam,rows);
 assert.equal(merged.questions[0].answerKey,4);assert.equal(merged.questions[0].sourceSolution.pdf,exam.questions[0].sourceSolution.pdf);
 assert.equal(exam.questions[0].answerKey,3);
});
test('R16 구형6/개정7과심화4회신구분리·심화5회원본동시보존',()=>{
 assert.equal(YP.getExam('physics1-basic-r16').questionCount,6);assert.equal(YP.getExam('physics1-basic-r16-v2').questionCount,7);
 assert.equal(YP.getExam('physics2-advanced-r04-v2').replacesExamId,'physics2-advanced-r04');
 const r=YP.getExam('physics2-advanced-r05');assert.equal(r.questionCount,7);assert.match(r.pdf,/r05-original.pdf$/);
});
test('누적패키지3.7.12:46시험29ready301문항',()=>{
 assert.equal(JSON.parse(read('package.json')).version,'3.7.13');
 assert.equal(catalog.exams.length,46);assert.equal(catalog.exams.filter(e=>e.status==='ready').length,29);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,301);
});

test('새 동형 수치·비례식 독립 계산 (원본 정답 변경 없음)',()=>{
 const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10);
 close(9/3,3);close(2*30/(2+4),10);close((12*4-6*2)/(6*4-2*2)*4,7.2);
 close(18/(6+3),2);close((1-1/5)/(1+1/5),2/3);close(3*12/6,6);
 close(6/(2),3);close(1e-6*2*Math.sin(Math.PI/3)/(5*2e-6),Math.sqrt(3)/10);
 close(2*Math.cos(Math.PI/3)*2*Math.PI*1e-6/(5*2e-6),Math.PI/5);
 close(Math.sqrt(1+Math.sin(Math.PI/6)**2),Math.sqrt(5)/2);
 close((3+.5)/2,7/4);close(Math.sqrt(3)*Math.sqrt(3),3);
 const rel=(1-Math.cos(Math.PI))/2;close(rel,1);
});
