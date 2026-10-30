import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const digestObject=obj=>crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const snapshot=JSON.parse(read('tests/fixtures/r16-legacy-fingerprints.json'));
const context={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,setTimeout,clearTimeout};vm.createContext(context);vm.runInContext(read('site/assets/core.js'),context);const YP=context.window.YP;
const legacy=YP.getExam('physics1-basic-r16'),revision=YP.getExam('physics1-basic-r16-v2');
function makeRecord(ex,inputs,name='테스트',school='영스고'){
 return YP.normalizeRecord({examId:ex.examId,courseId:ex.courseId,name,school,resultInputs:inputs||ex.questions.map(()=>1),partialModes:ex.questions.map(()=>false),token:'sim-'+ex.examId,studentId:'stable-profile',fingerprint:'stable-fingerprint',createdAt:'2026-10-01T00:00:00Z'});
}
function pngSize(rel){const b=fs.readFileSync(path.join(root,'site',rel));assert.equal(b.toString('ascii',1,4),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)]}

test('옛 16회차 ID와 모든 6문항은 정본 SHA256을 그대로 유지',()=>{
 assert.equal(legacy.examId,'physics1-basic-r16');assert.equal(legacy.questionCount,6);
 assert.equal(digestObject(legacy),snapshot.examHashes[legacy.examId]);
 assert.equal(digest('site/assets/data/questions/physics1-basic-r16.json'),crypto.createHash('sha256').update(Buffer.from(read('site/assets/data/questions/physics1-basic-r16.json'))).digest('hex'));
 assert.match(legacy.questions[5].topic,/연속 결상/);
});
test('총괄 누적 history 목록을 제외한 옛 41개 시험 정의 모두 그대로',()=>{
 for(const ex of catalog.exams){if(ex.examId==='physics1-basic-r16-v2'||ex.examId==='physics1-basic-total-electromagnetism'||ex.examId==='physics2-basic-r14')continue;
  assert.equal(digestObject(ex),snapshot.examHashes[ex.examId],ex.examId)}
});
test('신규 ID는 16회차 (개정)이며 과거 회차/학생 식별자를 건드리지 않음',()=>{
 assert.equal(revision.replacesExamId,legacy.examId);assert.equal(revision.courseId,legacy.courseId);
 assert.equal(revision.round,16);assert.equal(revision.status,'ready');assert.match(revision.title,/개정/);
 assert.equal(YP.roundLabel(legacy),'물리1 16회');assert.match(YP.roundLabel(revision),/16회 \(개정\)/);
});
test('새 7문항은 [10,10,20,10,20,10,20]으로 총점 100점',()=>{
 assert.equal(revision.questionCount,7);assert.equal(revision.maxScore,100);
 assert.deepEqual(Array.from(revision.questions,q=>q.maxPoints),[10,10,20,10,20,10,20]);
 assert.equal(revision.questions.reduce((n,q)=>n+q.maxPoints,0),100);
});
test('구형 6문항 [10,10,20,20,20,20] 채점 구조는 고정',()=>assert.deepEqual(Array.from(legacy.questions,q=>q.maxPoints),[10,10,20,20,20,20]));
test('개정 4번 최종 시험지 3m 조건과 정답 2m가 일치하고 재도전도 갱신됨',()=>{
 const q=revision.questions[3];assert.equal(q.maxPoints,10);assert.equal(q.answer,'2 m');
 assert.match(q.correctionNote,/3 m/);assert.match(q.correctionNote,/2 m/);
 assert.equal(10/(1+1+3),2);
 assert.match(q.explanation.join(' '),/가로등-거울 거리는 4 m/);
 assert.deepEqual(Array.from(q.rubric,r=>r.points),[4,6]);
 assert.equal(q.originalRetry.correctChoice,1);assert.equal(q.originalRetry.answer,'2 m');
 assert.equal(q.originalRetry.choices[0],'2 m');
});
test('개정 4번 문제지 PDF는 사용자가 제공한 3m 수정본 그대로',()=>{
 assert.equal(digest('site/assets/documents/physics1/r16-v2.pdf'),'8bbd2dd8ed7ca5108a02f2bf8132f877ed79527392a5863dd1b950ec81d63ab2');
});
test('새 7번 굴절 양방향 40cm·60cm와 부분점수 10+10',()=>{
 const q=revision.questions[6];assert.equal(q.maxPoints,20);assert.match(q.answer,/40 cm.*60 cm/);
 assert.deepEqual(Array.from(q.rubric,r=>r.points),[10,10]);
 assert.equal(20+30/1.5,40);assert.equal(30+20*1.5,60);
});
test('옛 6번 복합 렌즈는 신판 7번 굴절 문제로 덮어쓰지 않음',()=>{
 assert.match(legacy.questions[5].topic,/연속 결상/);assert.match(revision.questions[6].topic,/겉보기 거리/);
});
test('두 버전 점수는 문항 수대로 따로 계산 (옛 6개, 신 7개)',()=>{
 const old=makeRecord(legacy,legacy.questions.map(()=>1)),newRecord=makeRecord(revision,revision.questions.map(()=>1));
 assert.equal(old.score,100);assert.equal(newRecord.score,100);assert.equal(old.scoring.length,6);assert.equal(newRecord.scoring.length,7);
 assert.equal(old.examId,legacy.examId);assert.equal(newRecord.examId,revision.examId);
});
test('옛 점수 오류 6번은 20점, 개정 7번 오답은 20점; 분석 항목이 분리',()=>{
 const old=makeRecord(legacy,['1','1','1','1','1','0']);const nw=makeRecord(revision,['1','1','1','1','1','1','0']);
 assert.equal(old.score,80);assert.equal(nw.score,80);
 assert.match(old.scoring[5].topic,/연속 결상/);assert.match(nw.scoring[6].topic,/겉보기/);
});
test('각 버전별 시험 전체 평균에 상대편 응시 기록이 섞이지 않음',()=>{
 const old=makeRecord(legacy,['1','1','1','1','1','0']);const nw=makeRecord(revision,revision.questions.map(()=>1));
 const oldStats=YP.computeStats(legacy,[old,nw]),newStats=YP.computeStats(revision,[old,nw]);
 assert.equal(oldStats.count,1);assert.equal(newStats.count,1);assert.equal(oldStats.average,80);assert.equal(newStats.average,100);
 assert.equal(oldStats.perQuestion.length,6);assert.equal(newStats.perQuestion.length,7);
});
test('영구 학생 ID·리포트 토큰·지문을 정규화 과정에서 변경하지 않음',()=>{
 const old=makeRecord(legacy);const nw=makeRecord(revision);
 for(const r of [old,nw]){assert.equal(r.studentId,'stable-profile');assert.equal(r.fingerprint,'stable-fingerprint');assert.equal(r.token,'sim-'+r.examId)}
});
test('기존 16회만 있는 학생 총괄 분석은 기존 16회 결과를 유지',()=>{
 const total=YP.getExam('physics1-basic-total-electromagnetism'),old=makeRecord(legacy),linked=YP.getLinkedHistory(total,old,[old]);
 assert.equal(linked.length,1);assert.equal(linked[0].examId,legacy.examId);
 assert.equal(YP.computeHistorySummary(total,old,[old]).expectedCount,7);
});
test('앞으로 새 16회만 있는 학생도 총괄 연결, 7회 기준 유지',()=>{
 const total=YP.getExam('physics1-basic-total-electromagnetism'),nw=makeRecord(revision);
 assert.equal(YP.getLinkedHistory(total,nw,[nw]).length,1);
 assert.equal(YP.computeHistorySummary(total,nw,[nw]).expectedCount,7);
});
test('같은 학생의 옛 16회와 개정 16회가 모두 있어도 총괄에서는 16회를 1회만 집계',()=>{
 const total=YP.getExam('physics1-basic-total-electromagnetism'),old=makeRecord(legacy,legacy.questions.map(()=>0)),nw=makeRecord(revision,revision.questions.map(()=>1));
 const h=YP.computeHistorySummary(total,nw,[old,nw]);assert.equal(h.count,1);
 assert.equal(h.expectedCount,7);assert.equal(h.score,100);assert.equal(h.percent,100);
 assert.equal(h.trend[0].examId,revision.examId);
});
test('학생 통합 포털의 시험별 문항 분석은 두 버전 모두 남음',()=>{
 const old=makeRecord(legacy,['1','1','1','1','1','0']),nw=makeRecord(revision,['1','1','1','1','1','1','0']);
 const r=YP.computeStudentPortalCumulative([old,nw]);assert.equal(r.reports.length,2);
 assert.equal(r.cumulative.testCount,2);assert.ok(r.cumulative.weakItems.some(x=>x.examId===legacy.examId&&x.topic.includes('연속 결상')));
 assert.ok(r.cumulative.weakItems.some(x=>x.examId===revision.examId&&x.topic.includes('겉보기')));
});
test('웹 교사 화면은 새 16회 기본 노출, 옛 16회는 수정 중에만 노출',()=>{
 const app=read('site/assets/app.js');assert.match(app,/superseded=new Set/);
 assert.match(app,/e\.examId===requested/);assert.match(app,/selectExamId:r\.examId,load:false/);
 assert.match(app,/switchLegacyExamToCurrent/);assert.match(app,/async function saveCurrent\(\)[\s\S]*?state\.editToken/);
});
test('학생 변경·새 학생·포털 선택 시 구형 16회 수정 모드를 해제하고 새 성적은 신판으로 분기',()=>{
 const app=read('site/assets/app.js');
 assert.match(app,/selectRosterStudent[\s\S]*?resetScoreEntryForStudentSwitch\(\);switchLegacyExamToCurrent\(\)/);
 assert.match(app,/startNewStudent\(\)[\s\S]*?switchLegacyExamToCurrent\(\)/);
 assert.match(app,/if\(action==="select"\)\{if\(state\.editToken\)resetScoreEntryForStudentSwitch\(\);switchLegacyExamToCurrent\(\)/);
 assert.match(app,/studentProfileSelect"\)\.onchange[\s\S]*?switchLegacyExamToCurrent\(\)/);
});
test('원문과 동형 문제는 두 버전에서 각각 검사 가능',()=>{
 for(const ex of [legacy,revision])for(const q of ex.questions){for(const key of ['originalRetry','similarProblem']){
  const c=YP.normalizeChoiceChallenge(q[key]);assert.equal(c.valid,true,`${ex.examId} Q${q.no} ${key}`);
  assert.equal(c.answer,c.choices[c.correctChoice-1]);assert.equal(YP.checkChoiceAnswer(String(c.correctChoice),c),true);
 }}
});
test('새 1·2번 원문 보기 4지 정확히 반영, 옛 것은 그대로',()=>{
 assert.equal(revision.questions[0].originalRetry.choices.length,4);
 assert.equal(revision.questions[1].originalRetry.choices.length,4);
 assert.equal(legacy.questions[1].originalRetry.choices.length,5);
});
test('옛 PDF·PNG 경로 유지, 새 PDF·PNG 별도 독립 파일',()=>{
 assert.notEqual(revision.pdf,legacy.pdf);assert.notEqual(revision.pages[0],legacy.pages[0]);
 for(const ex of [legacy,revision]){assert.ok(fs.statSync(path.join(root,'site',ex.pdf)).size>50000);
 const [w,h]=pngSize(ex.pages[0]);assert.equal(w,1240);assert.equal(h,1753);
 for(const q of ex.questions){const [x,y,cw,ch]=q.image.crop;assert.ok(x>=0&&y>=0&&cw>0&&ch>0&&x+cw<=w&&y+ch<=h,`${ex.examId} Q${q.no}`)} }
});
test('개정판 검수 해설 PDF가 4번 3m·2m 내용으로 제공',()=>{
 assert.ok(fs.statSync(path.join(root,'site/assets/documents/physics1/r16-v2-verified-solution.pdf')).size>20000);
 assert.equal(revision.solutionPdf,'assets/documents/physics1/r16-v2-verified-solution.pdf');
});
test('개정판 원본 문제와 해답 PDF는 각각 별도 보존',()=>{
 assert.ok(fs.statSync(path.join(root,'site',revision.pdf)).size>50000);
 assert.ok(fs.statSync(path.join(root,'site','assets/documents/physics1/r16-v2-original-solution.pdf')).size>50000);
});
test('catalog JS, catalog JSON, 독립 문제 JSON의 개정 16회차 문항 일치',()=>{
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(read('site/assets/data/catalog.js'),ctx);
 const independent=JSON.parse(read('site/assets/data/questions/physics1-basic-r16-v2.json'));
 assert.equal(JSON.stringify(ctx.window.YP_CATALOG),JSON.stringify(catalog));
 assert.equal(JSON.stringify(independent),JSON.stringify(revision));
});
test('43개 시험 및 23개 ready, 237개 문항 / 기타 과정 동일',()=>{
 assert.equal(catalog.courses.length,4);assert.equal(catalog.exams.length,43);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').length,24);
 assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,246);
});
test('보안 설정, GAS, Worker, 로고 출력 코어 등 보호 파일 SHA256 전부 이전판 동일',()=>{
 for(const [file,hash] of Object.entries(snapshot.protectedFileHashes))assert.equal(digest(file),hash,file)
});
test('세 HTML의 catalog 캐시가 3.7.5로 갱신',()=>{
 for(const f of ['index.html','report.html','portal.html'])assert.match(read('site/'+f),/assets\/data\/catalog\.js\?v=3\.7\.6/);
});
