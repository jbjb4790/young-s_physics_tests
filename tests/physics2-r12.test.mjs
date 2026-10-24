import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const exam=catalog.exams.find(x=>x.examId==='physics2-basic-r12');
const bank=JSON.parse(read('site/assets/data/questions/physics2-basic-r12.json'));
const context={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,TextEncoder,TextDecoder,URL,Blob,crypto:globalThis.crypto,navigator:{},document:{},setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(read('site/assets/core.js'),context);
const YP=context.window.YP;
function pngSize(rel){const b=fs.readFileSync(path.join(ROOT,'site',rel));assert.equal(b.toString('ascii',1,4),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)];}

test('물리2 12회차 기존 placeholder를 준비 완료로 변경하고 8문항 100점 입력',()=>{
 assert.ok(exam);assert.equal(exam.status,'ready');assert.equal(exam.courseId,'physics2-basic');assert.equal(exam.round,12);
 assert.equal(exam.questionCount,8);assert.equal(exam.maxScore,100);assert.equal(exam.questions.length,8);
 assert.deepEqual(exam.questions.map(x=>x.maxPoints),[15,15,10,20,10,10,10,10]);
});
test('11회 전기장과 12회 전위·축전기는 별도 시험으로 보존되며 총괄 평가 역사에 포함',()=>{
 assert.equal(catalog.exams.some(x=>x.examId==='physics2-basic-r10'),false);
 const ele=catalog.exams.find(x=>x.examId==='physics2-basic-total-electromagnetism');
 assert.ok(ele.historyExamIds.includes('physics2-basic-r11'));assert.ok(ele.historyExamIds.includes('physics2-basic-r12'));
 assert.equal(catalog.exams.find(x=>x.examId==='physics2-basic-r11').status,'ready');
});
test('8문항 이미지와 PDF는 모두 실제 존재하며 원본은 1240×1753에 맞게 추출',()=>{
 assert.equal(exam.pages.length,2);
 exam.pages.forEach(p=>assert.deepEqual(pngSize(p),[1240,1753]));
 for(const q of exam.questions){const {page,crop}=q.image;assert.ok([1,2].includes(page));const [x,y,w,h]=crop;assert.ok(x>=0&&y>=0&&w>200&&h>150&&x+w<=1240&&y+h<=1753,q.no)}
 for(const rel of [exam.pdf,exam.solutionPdf]){const p=path.join(ROOT,'site',rel);assert.ok(fs.existsSync(p));assert.equal(fs.readFileSync(p).subarray(0,4).toString(),'%PDF')}
});
test('1·2번 답은 전지 연결 여부에 따라 달라지고 15점 루브릭을 제공',()=>{
 assert.match(exam.questions[0].answer,/C 증가.*V 일정.*Q 증가/);
 assert.match(exam.questions[1].answer,/C 증가.*V 감소.*Q 일정/);
 assert.equal(exam.questions[0].rubric.reduce((a,r)=>a+r.points,0),15);
 assert.deepEqual(exam.questions[1].rubric.map(x=>x.points),[5,5,5]);
});
test('3번 전위차 60V와 2μC로부터 1.2×10⁻⁴J를 올바르게 계산',()=>{
 assert.match(exam.questions[2].answer,/1\.2×10⁻⁴ J/);
 assert.match(exam.questions[2].explanation.join(' '),/2\.0×10⁻⁶.*80−20/);
});
test('4번 4V, 4√2m/s 검증 및 20점 루브릭 유지',()=>{
 assert.match(exam.questions[3].answer,/4\.0 V.*4√2 m\/s/);
 assert.equal(exam.questions[3].rubric.reduce((a,r)=>a+r.points,0),20);
});
test('5번 원문 조건 부족은 충분한 거리의 금속구 근사로 명시하고 공식 정답 보존',()=>{
 const q=exam.questions[4];assert.equal(q.reviewStatus,'corrected');assert.match(q.correctionNote,/충분히 떨어져/);
 assert.match(q.answer,/2Q.*8Q/);assert.match(q.explanation.join(' '),/상호.*영향|상호 유도|상호 정전/);
});
test('6번 공식 해설 전하량의 단위 오류를 V에서 C로 교정',()=>{
 const q=exam.questions[5];assert.equal(q.reviewStatus,'corrected');
 assert.match(q.correctionNote,/단위.*V.*C/);assert.match(q.answer,/Q₁=36\/5 C.*Q₂=12\/5 C.*Q₃=24\/5 C/);
 assert.ok(q.explanation.some(x=>x.includes('C₂=1 F')&&x.includes('C₃=2 F')));
});
test('7번 면적 분할은 병렬 합성 공식 및 8번 두께 분할은 직렬 합성 공식',()=>{
 assert.match(exam.questions[6].answer,/A\(k₁\+3k₂\)\/\(4d\)/);
 assert.match(exam.questions[7].answer,/3A k₁k₂\/\[d\(2k₂\+k₁\)\]/);
 assert.ok(exam.questions[7].explanation.some(x=>x.includes('(2d/3)')));
});
test('8개 모든 문항은 서술형 교사 채점과 4지 객관식 오답학습·동형문제 제공',()=>{
 for(const q of exam.questions){assert.equal(q.type,'subjective');assert.equal(q.inputMode,'achievement');
  for(const key of ['originalRetry','similarProblem']){const c=q[key];assert.equal(c.inputMode,'choice');assert.equal(c.choices.length,4);assert.equal(new Set(c.choices).size,4);assert.equal(c.answer,c.choices[c.correctChoice-1]);}
  assert.ok(q.explanation.length>=3);assert.ok(q.formulas.length>=2);assert.ok(q.commonMistakes.length>=2);
  assert.equal(q.rubric.reduce((a,r)=>a+r.points,0),q.maxPoints);
 }
});
test('1은 문항 만점 P1은 정확히 1점 부분점수, 0은 0점',()=>{
 const ex=YP.getExam(exam.examId);assert.equal(ex.status,'ready');
 assert.equal(YP.parseQuestionInput('1',ex.questions[0]).score,15);
 assert.equal(YP.parseQuestionInput('1',ex.questions[3]).score,20);
 assert.equal(YP.parseQuestionInput('P1',ex.questions[3]).score,1);
 assert.equal(YP.parseQuestionInput('0',ex.questions[3]).score,0);
 assert.equal(YP.calculateResult(ex,Array(8).fill('1')).score,100);
});
test('동형 3·4·6·8번은 별도 계산·공식 값과 일치',()=>{
 for(const [i,v] of [[2,'1.8×10⁻⁴ J'],[3,'전위차 6 V, 속력 3 m/s'],[5,'Q₁=15 C, Q₂=10 C, Q₃=5 C'],[7,'C_eq=4A k₁k₂/[d(k₂+3k₁)]']]){
  assert.equal(exam.questions[i].similarProblem.answer,v);
 }
});
test('Questions 원본 JSON과 catalog.js의 등록 데이터는 완전히 같다',()=>{
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(read('site/assets/data/catalog.js'),ctx);
 assert.deepEqual(JSON.stringify(bank),JSON.stringify(exam));
 assert.deepEqual(JSON.stringify(ctx.window.YP_CATALOG.exams.find(x=>x.examId===exam.examId)),JSON.stringify(exam));
});
test('교사용·학부모 페이지가 새 카탈로그 캐시버전 3.7.3을 참조',()=>{
 for(const f of ['index.html','report.html','portal.html'])assert.match(read('site/'+f),/assets\/data\/catalog\.js\?v=3\.7\.4/);
});
test('Server Code.gs 및 인증·기존 학생 링크는 수정 없이 사이트 서버 동기화로 적용 가능',()=>{
 const gs=read('apps-script/Code.gs');assert.match(gs,/function syncCatalog_\(/);
 assert.match(gs,/function saveReport_\(/);assert.match(gs,/function getStudentPortal_\(/);
 assert.equal(catalog.exams.length,42);
});
