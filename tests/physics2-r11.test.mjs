import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const bank=JSON.parse(read('site/assets/data/questions/physics2-basic-r11.json'));
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const e=catalog.exams.find(x=>x.examId==='physics2-basic-r11');
function pngSize(f){const b=fs.readFileSync(f);assert.equal(b.toString('ascii',1,4),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)]}
const context={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,TextEncoder,TextDecoder,URL,Blob,crypto:globalThis.crypto,navigator:{},document:{},setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(read('site/assets/core.js'),context);
const YP=context.window.YP;

// New public quiz and Google Sheets server synchronization semantics.
test('물리2 11회차 시험 ID는 기존 준비 중 placeholder를 대체하고 100점, 8문항이다',()=>{
 assert.ok(e);assert.equal(e.status,'ready');assert.equal(e.courseId,'physics2-basic');assert.equal(e.round,11);
 assert.equal(e.questionCount,8);assert.equal(e.maxScore,100);
 assert.deepEqual(Array.from(e.questions.map(q=>q.maxPoints)),[20,10,10,10,10,10,20,10]);
 assert.equal(e.questions.reduce((sum,q)=>sum+q.maxPoints,0),100);
});
test('물리2 10회는 계속 제외하고 11회는 전자기 총괄의 누적 범위에 포함된다',()=>{
 assert.equal(catalog.exams.some(x=>x.examId==='physics2-basic-r10'),false);
 assert.ok(catalog.exams.find(x=>x.examId==='physics2-basic-total-electromagnetism').historyExamIds.includes('physics2-basic-r11'));
});
test('검수 해설은 Quiz 원문 PDF와 숙제노트 2~4페이지를 근거로 연결한다',()=>{
 for(const f of [e.pdf,e.solutionPdf])assert.ok(fs.existsSync(path.join(ROOT,'site',f)),f);
 assert.equal(e.solutionPdf,'assets/documents/physics2/r11-conditional-solution-v3.6.9.pdf');
 const bytes=fs.readFileSync(path.join(ROOT,'site',e.solutionPdf));const ascii=bytes.toString('latin1');assert.ok(ascii.startsWith('%PDF'));
 assert.match(e.sourceTitle,/숙제노트.*2~4페이지/);
});
test('각 문항의 원문 그림 crop이 기존 페이지 이미지 1240×1753 이내로 위치한다',()=>{
 assert.equal(e.pages.length,3);
 e.pages.forEach(f=>assert.deepEqual(pngSize(path.join(ROOT,'site',f)),[1240,1753]));
 e.questions.forEach(q=>{assert.ok(q.image&&q.image.crop);const {page,crop}=q.image;assert.ok(page>=1&&page<=3);const [x,y,w,h]=crop;const [W,H]=pngSize(path.join(ROOT,'site',e.pages[page-1]));assert.ok(x>=0&&y>=0&&w>200&&h>150&&x+w<=W&&y+h<=H)});
});
test('문항 1~8 모두 객관식 원문 재도전과 새 객관식 동형 문제를 가진다',()=>{
 for(const q of e.questions)for(const type of ['originalRetry','similarProblem']){
  const c=q[type];assert.equal(c.inputMode,'choice');assert.ok([4,5].includes(c.choices.length));
  assert.ok(c.correctChoice>=1&&c.correctChoice<=c.choices.length);
  assert.equal(c.answer,c.choices[c.correctChoice-1]);assert.equal(new Set(c.choices).size,c.choices.length);
  if(type==='similarProblem')assert.ok(c.prompt&&c.explanation);
 }
});
test('학생 점수 입력 규칙 1=20점/10점 만점, P1=1점 부분점수를 유지한다',()=>{
 const ex=YP.getExam('physics2-basic-r11');
 assert.equal(YP.parseQuestionInput('1',ex.questions[0]).score,20);
 assert.equal(YP.parseQuestionInput('1',ex.questions[1]).score,10);
 assert.equal(YP.parseQuestionInput('P1',ex.questions[0]).score,1);
 assert.equal(YP.parseQuestionInput('0',ex.questions[0]).score,0);
 assert.equal(YP.calculateResult(ex,Array(8).fill('1')).score,100);
});
test('제공 공식 정답 Q1~Q6을 원문 그대로 대조하여 등록한다',()=>{
 for(const [no,pattern] of [[1,/6\.0×10⁻² N.*1\.0×10⁴/],[2,/1\.0×10⁻³ m/],[3,/x=d/],[4,/2\.7×10¹⁰ N/],[5,/kQ\/\(√2 a²\).*위쪽/],[6,/kQ\/\(√2 a²\).*오른쪽/]])assert.match(e.questions[no-1].answer,pattern);
});
test('7번 잘못된 주기식은 g_eff=2g/√3으로 교정했고 원문 해설 오류를 기록한다',()=>{
 const q=e.questions[6];assert.equal(q.reviewStatus,'corrected');assert.match(q.correctionNote,/g_eff=.*2\/√3/);
 assert.match(q.answer,/√3 l\/\(2g\)/);assert.ok(q.explanation.some(x=>x.includes('g_eff=√(g²+(qE/m)²)=2g/√3')));
 assert.ok(q.rubric.some(x=>x.points===5));
});
test('8번은 q>0·무마찰 조건을 먼저 명시하고 조건부 정답을 공개한다',()=>{
 const q=e.questions[7];assert.equal(q.reviewStatus,'corrected');assert.match(q.correctionNote,/q>0/);assert.match(q.correctionNote,/마찰/);
 assert.match(q.answer,/mg\/q/);assert.match(q.answer,/N=0/);assert.equal(q.originalRetry.inputMode,'choice');
 const report=read('site/assets/report.js');assert.match(report,/\["ambiguous","needs-review"\]\.includes\(q\.reviewStatus\)/);
});
test('원본 보너스 그림 2점은 공식 100점 범위에 추가하지 않는다',()=>{
 assert.equal(e.maxScore,100);assert.equal(e.questions.length,8);assert.match(e.sourceNote,/초파 2점은 시험 공식 만점 100점에서 제외/);
});
test('기존 Apps Script 통신 규격을 교체하지 않고 서버 카탈로그 동기화가 가능하다',()=>{
 const src=read('apps-script/Code.gs');assert.match(src,/function syncCatalog_\(/);assert.match(src,/q\.maxPoints/);
 assert.match(read('site/index.html'),/시험 설정 서버 동기화/);
});
test('catalog.js와 JSON의 변경된 11회차 데이터를 정확히 같은 내용으로 제공한다',()=>{
 const context={window:{}};vm.createContext(context);vm.runInContext(read('site/assets/data/catalog.js'),context);
 assert.deepEqual(JSON.stringify(context.window.YP_CATALOG.exams.find(x=>x.examId===e.examId)),JSON.stringify(e));
 assert.equal(JSON.stringify(bank),JSON.stringify(e));
});
test('교사·학부모 HTML 모두 catalog.js의 최신 배포 캐시 버전을 참조한다',()=>{
 for(const page of ['index.html','portal.html','report.html'])assert.match(read('site/'+page),/assets\/data\/catalog\.js\?v=3\.6\.9/);
});
test('답안 검수 상태 및 문항별 루브릭의 배점 합이 원문 점수와 일치한다',()=>{
 for(const q of e.questions){assert.equal(q.rubric.reduce((a,r)=>a+r.points,0),q.maxPoints);assert.ok(['verified','corrected','ambiguous','needs-review'].includes(q.reviewStatus));assert.ok(q.explanation.length>=2);assert.ok(q.commonMistakes.length>=2)}
});
test('사이트 코드는 총괄·주간 학생별 영구 포털 통합 구조를 유지한다',()=>{
 assert.match(read('site/assets/portal.js'),/getStudentPortal/);
 assert.match(read('site/assets/core.js'),/computeStudentUnits/);
 assert.match(read('apps-script/Code.gs'),/getStudentExamDetail/);
});
