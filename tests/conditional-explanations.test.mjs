import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const cases={
 'physics1-basic-r03':7,
 'physics1-basic-r05':6,
 'physics1-basic-r13':7,
 'physics2-basic-r11':8
};
function question(id){return catalog.exams.find(e=>e.examId===id).questions.find(q=>q.no===cases[id])}
test('4개 확인 필요 문항은 원문에 추가 조건을 표시해 corrected 상태로 등록',()=>{
 for(const id of Object.keys(cases)){
  const e=catalog.exams.find(e=>e.examId===id),q=question(id);
  assert.equal(q.reviewStatus,'corrected',id);
  assert.equal(e.reviewStatus,'corrected',id);
  assert.match(q.correctionNote,/^추가 풀이 조건\(원문 미기재\)/,id);
  assert.ok(q.explanation.length>=3,id);
  assert.match(q.correctionNote,/원문/,id);
 }
});
test('물리1 3회 7번은 질적 개형만 도출하며 등가속도 단정을 하지 않음',()=>{
 const q=question('physics1-basic-r03');
 assert.match(q.answer,/v>0/);assert.match(q.answer,/v=0/);assert.match(q.answer,/v<0/);
 assert.match(q.correctionNote,/일정한 가속도 여부는 확정하지 않는다/);
});
test('물리1 5회 6번은 12N 왼쪽 가정하에 10N·18N을 도출하고 다른 방향 결과 설명',()=>{
 const q=question('physics1-basic-r05');
 assert.match(q.correctionNote,/왼쪽 방향/);assert.match(q.answer,/10 N/);assert.match(q.answer,/18 N/);assert.match(q.answer,/2 N/);
 assert.equal(q.originalRetry.correctChoice,2);
});
test('물리1 13회 7번은 A쪽 반시계 전류일 때 A=N, B=S를 표시하고 원문의 한계도 고지',()=>{
 const q=question('physics1-basic-r13');
 assert.match(q.correctionNote,/A를 마주보고/);assert.match(q.correctionNote,/반시계/);
 assert.match(q.answer,/A가 N극/);assert.match(q.answer,/원문 그림만으로는/);
 assert.equal(q.originalRetry.correctChoice,1);
});
test('물리2 11회 8번은 q>0·무마찰, N=0 접촉한계와 수평 오른쪽 E를 설명',()=>{
 const q=question('physics2-basic-r11');
 assert.match(q.correctionNote,/q>0/);assert.match(q.correctionNote,/마찰/);
 assert.match(q.answer,/N=0/);assert.match(q.answer,/mg\/\(√3 q\)/);
 assert.ok(q.explanation.some(x=>x.includes('N=2mg/√3')));
});
test('모든 준비 완료 시험의 flagged 문항은 학습 조건을 확인한 상태이고 미래 flagged는 보호',()=>{
 const flagged=[];
 for(const e of catalog.exams.filter(e=>e.status==='ready'))for(const q of e.questions||[])if(['needs-review','ambiguous'].includes(q.reviewStatus))flagged.push(`${e.examId} Q${q.no}`);
 assert.deepEqual(flagged,[]);
 for(const f of ['report.js','portal.js']){
  const html=read(`site/assets/${f}`);
  assert.match(html,/\["ambiguous","needs-review"\]\.includes\(q\.reviewStatus\)/);
  assert.match(html,/원문 보충 조건 · 검수 안내/);
  assert.match(html,/solution-reveal hidden/);
 }
});
test('원문 재도전·동형 문제의 객관식 정답 단일성 및 루브릭 배점 검증',()=>{
 for(const id of Object.keys(cases)){
  const q=question(id);assert.equal(q.rubric.reduce((a,r)=>a+Number(r.points),0),q.maxPoints);
  for(const k of ['originalRetry','similarProblem']){
   const c=q[k];assert.equal(c.inputMode,'choice');assert.ok([4,5].includes(c.choices.length));
   assert.equal(c.answer,c.choices[c.correctChoice-1]);assert.equal(new Set(c.choices).size,c.choices.length);
  }
 }
});
test('동기화 원본 JSON과 카탈로그 데이터, JS 배포 형식 일치',()=>{
 for(const id of Object.keys(cases))assert.equal(JSON.stringify(JSON.parse(read(`site/assets/data/questions/${id}.json`))),JSON.stringify(catalog.exams.find(e=>e.examId===id)));
 const context={window:{}};vm.createContext(context);vm.runInContext(read('site/assets/data/catalog.js'),context);
 assert.equal(JSON.stringify(context.window.YP_CATALOG),JSON.stringify(catalog));
 for(const page of ['index.html','report.html','portal.html'])assert.match(read(`site/${page}`),/assets\/data\/catalog\.js\?v=3\.6\.9/);
});
test('기존 Apps Script 인증/Google Sheets/학부모 링크 코드를 교체하지 않음',()=>{
 const gs=read('apps-script/Code.gs');assert.match(gs,/getStudentPortal_/);assert.match(gs,/function syncCatalog_/);
 assert.match(read('site/assets/vendor/docx-export.bundle.js'),/원문 보충 조건 · 검수 안내/);
});
