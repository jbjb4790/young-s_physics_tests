import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {bootstrapDataset} from './fixtures/roster-server-harness.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bytes=f=>fs.readFileSync(path.join(root,f));
const read=f=>bytes(f).toString('utf8');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const objectSha=o=>sha(JSON.stringify(o));
const clone=o=>JSON.parse(JSON.stringify(o));
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const baseline=JSON.parse(read('tests/fixtures/r07-baseline-v3717.json'));
const ID='physics2-advanced-r07';
const exam=catalog.exams.find(e=>e.examId===ID);
const points=[10,15,15,10,15,15,20];
const sourceRubrics=[[5,5],[5,5,5],[5,10],[10],[5,5,5],[5,5,5],[10,10]];
const c={window:{YP_CATALOG:clone(catalog),YP_CONFIG:{}},console,setTimeout,clearTimeout};
vm.createContext(c);vm.runInContext(read('site/assets/core.js'),c);const YP=c.window.YP;

test('심화7회 신규 ID 한 개, 큰 번호1~7 및 원문 소문항 배점 합계100점',()=>{
 assert.ok(exam);assert.equal(catalog.exams.filter(e=>e.examId===ID).length,1);
 assert.equal(exam.courseId,'physics2-advanced');assert.equal(exam.round,7);assert.equal(exam.assessmentType,'weekly');assert.equal(exam.section,'mechanics');assert.equal(exam.status,'ready');
 assert.equal(exam.questionCount,7);assert.equal(exam.maxScore,100);assert.equal(exam.configVersion,'2026.11.22-r07-v3.7.18');
 assert.deepEqual(exam.questions.map(q=>q.no),[1,2,3,4,5,6,7]);assert.deepEqual(exam.questions.map(q=>q.maxPoints),points);
 assert.deepEqual(exam.questions.map(q=>q.rubric.map(r=>r.points)),sourceRubrics);
 for(const q of exam.questions){assert.equal(q.type,'subjective');assert.equal(q.inputMode,'achievement');assert.equal(q.rubric.reduce((s,r)=>s+r.points,0),q.maxPoints);}
 assert.equal(exam.questions.reduce((s,q)=>s+q.maxPoints,0),100);
 assert.deepEqual(catalog.operatingPolicy.weeklyRounds['physics2-advanced'],[2,3,4,5,6,7]);
 assert.equal(catalog.exams.find(e=>e.examId==='physics2-advanced-total').historyExamIds.filter(id=>id===ID).length,1);
 assert.equal(YP.readyExams().some(e=>e.examId===ID),true);
});

test('첨부 문제·해설 PDF의 실제 SHA256 보존, 원본4쪽과7개 문항 크롭 경계',()=>{
 const originals=[
  ['pdf','assets/documents/physics2-advanced/r07-original.pdf',128302,'3da6917352cb398768fa34c1d3b5f38f110ee5b09c4cc0a6da51332c4cd0fa1f'],
  ['solutionPdf','assets/documents/physics2-advanced/r07-original-solution.pdf',143979,'02c6250f5e57c03ad14a1b537e10d38ec9033d1a7a0f576b95596e26a26c7df2']
 ];
 for(const [field,file,size,expected] of originals){assert.equal(exam[field],file);const b=bytes('site/'+file);assert.equal(b.subarray(0,4).toString(),'%PDF');assert.equal(b.length,size);assert.equal(sha(b),expected);}
 assert.equal(exam.assetProvenance.redrawn,false);assert.equal(exam.assetProvenance.retypedQuestionText,false);assert.equal(exam.assetProvenance.renderDpi,200);
 assert.deepEqual(exam.pages,Array.from({length:4},(_,i)=>`assets/pages/physics2-advanced/r07-original-p${i+1}.png`));
 const sizes=exam.pages.map(file=>{const b=bytes('site/'+file);assert.deepEqual(b.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));const size=[b.readUInt32BE(16),b.readUInt32BE(20)];assert.deepEqual(size,[1653,2337]);return size;});
 for(const q of exam.questions){assert.ok(Number.isInteger(q.image.page)&&q.image.page>=1&&q.image.page<=4);const [x,y,w,h]=q.image.crop;assert.ok([x,y,w,h].every(Number.isInteger));const [pageWidth,pageHeight]=sizes[q.image.page-1];assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=pageWidth&&y+h<=pageHeight,`${q.no}번 crop 경계`);}
 assert.deepEqual(exam.questions.map(q=>q.image.page),[1,1,2,2,3,3,4]);
 assert.equal(exam.reviewedSolutionPdf,'assets/documents/physics2-advanced/r07-reviewed-solution.pdf');assert.equal(bytes('site/'+exam.reviewedSolutionPdf).subarray(0,4).toString(),'%PDF');
});

test('기존48개 정의와33개 문제은행 및 R03 복구·학생링크·서버 코드가 그대로 유지됨',()=>{
 assert.equal(Object.keys(baseline.examHashes).length,48);
 for(const [id,expected] of Object.entries(baseline.examHashes)){const old=clone(catalog.exams.find(e=>e.examId===id));assert.ok(old,id);if(id==='physics2-advanced-total')old.historyExamIds=old.historyExamIds.filter(id=>id!==ID);assert.equal(objectSha(old),expected,id);}
 for(const [file,expected] of Object.entries(baseline.existingBankHashes))assert.equal(sha(bytes(file)),expected,file);
 for(const [file,expected] of Object.entries(baseline.protectedFiles))assert.equal(sha(bytes(file)),expected,file);
 for(const [file,expected] of Object.entries(baseline.htmlHashes)){const html=read(file);assert.match(html,/catalog\.js\?v=3\.7\.18-r07/);assert.equal(sha(html.replace('catalog.js?v=3.7.18-r07','catalog.js?v=3.7.17-r03-fix')),expected,file);}
 assert.deepEqual(catalog.courses,baseline.courses);const policy=clone(catalog.operatingPolicy);policy.weeklyRounds['physics2-advanced']=policy.weeklyRounds['physics2-advanced'].filter(r=>r!==7);assert.deepEqual(policy,baseline.operatingPolicy);
 const normal=YP.getExam('physics2-basic-r03'),archive=YP.getExam('physics2-basic-r03-concept16-archive');assert.equal(normal.questionCount,8);assert.equal(archive.questionCount,16);assert.equal(archive.recordOnly,true);
 for(const count of [8,16]){const record={examId:normal.examId,studentId:'synthetic-r07-check',token:'unchanged-token',fingerprint:'unchanged-fingerprint',scoring:Array(count),resultInputs:Array(count).fill('1')};const resolved=YP.getExamForRecord(record);assert.equal(resolved.questions.length,count);assert.equal(resolved.examId,normal.examId);assert.equal(record.token,'unchanged-token');assert.equal(record.fingerprint,'unchanged-fingerprint');}
});

test('7개 교사 입력에서1은각문항만점·P1은1점·공란은미입력이며 초과점수거부',()=>{
 assert.equal(YP.calculateResult(exam,Array(7).fill('1')).score,100);assert.equal(YP.calculateResult(exam,Array(7).fill('0')).score,0);
 const values=['P1','1','7.5','1','0','','10'],result=YP.calculateResult(exam,values);assert.equal(result.valid,true);assert.equal(result.score,43.5);assert.equal(result.counts.ungraded,1);assert.equal(result.scoring.length,7);
 assert.equal(YP.parseQuestionInput('11',exam.questions[0]).valid,false);assert.equal(YP.parseQuestionInput('21',exam.questions[6]).valid,false);
 const identity={examId:ID,courseId:'physics2-advanced',studentId:'synthetic-r07-student',token:'synthetic-r07-token',fingerprint:'synthetic-r07-fingerprint',name:'가상학생',school:'가상학교'};
 const record=YP.normalizeRecord({...identity,resultInputs:values});for(const key of ['examId','courseId','studentId','token','fingerprint'])assert.equal(record[key],identity[key]);assert.equal(record.score,43.5);
});

test('원문재풀이7개·새동형7개 모두 유효한 단일정답이며7번은(1)만 명시하여 평가',()=>{
 for(const q of exam.questions){for(const kind of ['originalRetry','similarProblem']){const cfg=q[kind],normalized=YP.normalizeChoiceChallenge(cfg);assert.equal(normalized.valid,true,`${q.no} ${kind}`);assert.equal(cfg.answer,cfg.choices[cfg.correctChoice-1]);assert.equal(new Set(cfg.choices).size,cfg.choices.length);assert.equal(cfg.choices.map((_,i)=>YP.checkChoiceAnswer(String(i+1),cfg)).filter(Boolean).length,1);}
  assert.match(q.similarProblem.prompt,/동형.*새 작성/);assert.ok(q.similarProblem.explanation?.trim());}
 const q=exam.questions[6];assert.equal(q.reviewStatus,'corrected');assert.match(q.correctionNote,/\(1\)|소문항/);assert.match(q.correctionNote,/재풀이|재도전/);
 assert.ok(q.originalRetry.choices.every(choice=>choice.includes('(1)')),'prompt 미표시 UI에서도 각 보기 자체가 평가 범위를 드러내야 함');
 assert.match(q.originalRetry.answer,/5L\s*\/\s*9/);assert.doesNotMatch(q.originalRetry.choices.join(' '),/cos|θ/);
 assert.match(q.similarProblem.prompt,/작|소각도/);assert.doesNotMatch(q.similarProblem.prompt,/한 바퀴|완전.*원운동/);
 const explanation=[q.correctionNote,q.answer,...q.explanation].join(' ');assert.match(explanation,/조건/);assert.match(explanation,/소각도|작은\s*(각도|진폭)|작은.*진동/);assert.match(explanation,/별도|별개|독립/);assert.match(explanation,/동시에|함께.*성립|충돌|모순/);
 assert.match(q.answer,/\(1\)/);assert.match(q.answer,/\(2\)/);assert.match(q.answer,/조건|별도|별개/);
});

test('실제 서버동기화는새7행추가·R03의8/16정의유지·기존학생성적행불변',()=>{
 const d=bootstrapDataset(),Sheet=d.sheets.get('Students').constructor;Sheet.prototype.autoResizeColumns=function(){return this};Sheet.prototype.clearContents=function(){this.cells=[];return this};
 const beforeStudents=clone(d.rows('Students')),beforeReports=clone(d.rows('Reports'));
 const first=d.ctx.syncCatalog_(clone(catalog)),second=d.ctx.syncCatalog_(clone(catalog));assert.equal(first.recordVariantsSupported,true);assert.equal(second.questions,first.questions);
 assert.deepEqual(clone(d.rows('Students')),beforeStudents);assert.deepEqual(clone(d.rows('Reports')),beforeReports);
 const rows=clone(d.ctx.getQuestionRows_(ID));assert.equal(rows.length,7);assert.deepEqual(rows.map(r=>Number(r.QuestionNo)),[1,2,3,4,5,6,7]);assert.deepEqual(rows.map(r=>Number(r.MaxPoints)),points);
 assert.equal(d.ctx.getQuestionRows_('physics2-basic-r03').length,8);assert.equal(d.ctx.getQuestionRows_('physics2-basic-r03-concept16-archive').length,16);
 d.props.setProperty('STUDENT_PORTAL_MIGRATION_COMPLETE','1');
 const request={examId:ID,studentId:'stu_a',name:'홍길동',school:'가고',grade:'2',classNo:'1반 2번',resultInputs:Array(7).fill('1'),partialModes:Array(7).fill(false)};
 const created=d.ctx.saveReport_(request);assert.equal(created.created,true);assert.equal(created.record.score,100);assert.equal(created.record.studentId,'stu_a');assert.equal(created.record.examId,ID);
 const updated=d.ctx.saveReport_({...request,token:created.token,resultInputs:['0',...Array(6).fill('1')]});assert.equal(updated.record.score,90);assert.equal(updated.token,created.token);assert.equal(updated.fp,created.fp);
 const detail=d.ctx.getReport_(updated.token,updated.fp);assert.equal(detail.questions.length,7);assert.equal(detail.stats.perQuestion.length,7);assert.equal(detail.record.score,90);
 for(const row of beforeReports){assert.deepEqual(clone(d.rows('Reports').find(r=>r[0]===row[0])),row);}
 for(const row of beforeStudents){assert.deepEqual(clone(d.rows('Students').find(r=>r[0]===row[0])).slice(0,4),row.slice(0,4));}
});

test('배포 카탈로그와 독립문항 JSON이 일치하고 최신버전은49정의·33ready·333문항',()=>{
 const js={window:{}};vm.createContext(js);vm.runInContext(read('site/assets/data/catalog.js'),js);assert.deepEqual(clone(js.window.YP_CATALOG),catalog);
 assert.deepEqual(JSON.parse(read(`site/assets/data/questions/${ID}.json`)),exam);
 assert.equal(catalog.exams.length,49);assert.equal(catalog.exams.filter(e=>e.status==='ready').length,33);assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,333);
 assert.equal(JSON.parse(read('package.json')).version,'3.7.18');assert.equal(catalog.featureVersion,'3.7.18-physics2-advanced-r07');
});
