import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const clone=x=>JSON.parse(JSON.stringify(x)),examId='physics2-basic-r03',archiveId='physics2-basic-r03-concept16-archive';
function environment(withApp=false){
 const storage=new Map(),nodes=new Map(),messages=[],downloads=[];
 function node(id){if(!nodes.has(id)){const classes=new Set();nodes.set(id,{value:'',innerHTML:'',textContent:'',disabled:false,style:{setProperty(){}},handlers:{},classList:{add(x){classes.add(x)},remove(x){classes.delete(x)},contains:x=>classes.has(x),toggle(x,on){if(on===undefined)on=!classes.has(x);on?classes.add(x):classes.delete(x)}},focus(){},scrollIntoView(){},addEventListener(type,fn){this.handlers[type]=fn},querySelectorAll(){return []}})}return nodes.get(id)}
 const c={window:{YP_CATALOG:clone(catalog),YP_CONFIG:{apiUrl:'',cachePrefix:'test-',catalogSyncStorage:'catalog-sync',reportPage:'report.html'},addEventListener(){}},document:{getElementById:node,querySelectorAll:()=>[],addEventListener(){},hidden:false},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},location:{href:'https://example.test/index.html',origin:'https://example.test',hash:''},navigator:{},URL,URLSearchParams,TextEncoder,TextDecoder,Blob,crypto:webcrypto,btoa:s=>Buffer.from(s,'binary').toString('base64'),setTimeout:()=>0,clearTimeout,console,confirm:()=>true};
 vm.createContext(c);vm.runInContext(read('site/assets/core.js'),c);c.YP=c.window.YP;c.YP.toast=(message)=>messages.push(message);c.YP.downloadBlob=(blob,name)=>downloads.push({blob,name});
 vm.runInContext(read('site/assets/api.js'),c);c.YP_API=c.window.YP_API;
 if(withApp){const exports='state,loadExam,renderExamOptions,handleReportAction,cancelEdit,makeRecord,downloadTemplate,findExistingBatchRecord,applyPaste,rejectArchivedBatchShape,collectAnswerEditorQuestions';vm.runInContext(read('site/assets/app.js').replace('document.addEventListener("DOMContentLoaded",init);',`window.__r03={${exports}};`),c)}
 return {c,YP:c.YP,api:c.YP_API,h:c.window.__r03,node,storage,messages,downloads};
}
function record(env,count,options={}){
 const ex=env.YP.getExam(count===16?archiveId:examId),inputs=Array(count).fill('1'),calc=env.YP.calculateResult(ex,inputs);
 return {examId,courseId:ex.courseId,name:'보존학생',school:'검증고',studentId:'stable-student',token:count===16?'demo-old16':'demo-current8',fingerprint:count===16?'stable-fp16':'stable-fp8',resultInputs:inputs,partialModes:Array(count).fill(false),scoring:clone(calc.scoring),score:calc.score,maxScore:calc.maxScore,percent:calc.percent,counts:clone(calc.counts),createdAt:'2026-11-01T00:00:00Z',updatedAt:count===16?'2026-11-22T00:00:00Z':'2026-11-20T00:00:00Z',...options};
}
function questionRows(env,ex){return ex.questions.map(q=>env.api._questionToRow(ex.resolvedExamId||ex.examId,q))}
function detail(env,raw){const r=env.YP.normalizeRecord(raw),ex=env.YP.getExamForRecord(r);return {record:r,questions:questionRows(env,ex),stats:env.YP.computeStats(ex,[r]),recordVariantsSupported:true,questionSourceExamId:ex.resolvedExamId||ex.examId}}

test('8문항 신규 시험만 ready 목록에 있고 보관16은 기존 기록으로 해석한다',()=>{
 const e=environment(),old=record(e,16),current=record(e,8);
 assert.equal(e.YP.getExam(examId).questions.length,8);assert.equal(e.YP.readyExams().some(x=>x.examId===archiveId),false);
 const ex=e.YP.getExamForRecord(old);assert.equal(ex.examId,examId);assert.equal(ex.resolvedExamId,archiveId);assert.equal(ex.recordVariant,'concept16');assert.equal(ex.questions.length,16);assert.equal(ex.recordOnly,true);
 assert.equal(e.YP.getExamForRecord(current).questions.length,8);assert.equal(e.YP.getExamForRecord(current).recordVariant,'');
});
test('scoring 길이가 우선이며 입력 길이 모순은 저장된 점수·신원·16개 배열을 보존한다',()=>{
 const e=environment(),raw=record(e,16,{resultInputs:Array(8).fill('0'),score:73,percent:73});
 const ex=e.YP.getExamForRecord(raw),normalized=e.YP.normalizeRecord(raw);
 assert.equal(ex.questions.length,16);assert.equal(ex.recordVariantConflict,true);assert.equal(normalized.score,73);assert.equal(normalized.percent,73);assert.equal(normalized.scoring.length,16);
 for(const k of ['examId','studentId','token','fingerprint'])assert.equal(normalized[k],raw[k]);
 assert.deepEqual(clone(normalized.resultInputs),raw.resultInputs);assert.deepEqual(clone(normalized.scoring),raw.scoring);
});
test('scoring이 없으면 입력 개수, 요약에는 명시 variant로 보관 정의를 찾는다',()=>{
 const e=environment(),raw=record(e,16);delete raw.scoring;
 assert.equal(e.YP.getExamForRecord(raw).questions.length,16);
 assert.equal(e.YP.getExamForRecord({examId,recordVariant:'concept16',resolvedExamId:archiveId}).questions.length,16);
 assert.equal(e.YP.getExamForRecord({...raw,resultInputs:Array(11).fill('1')}).recordVariantConflict,true);
});
test('입력값이 없는 16문항 채점 스냅샷은 빈 입력으로 재채점하지 않는다',()=>{
 const e=environment(),raw=record(e,16,{score:83,percent:83});delete raw.resultInputs;
 const r=e.YP.normalizeRecord(raw);assert.equal(r.score,83);assert.equal(r.scoring.length,16);assert.deepEqual(clone(r.scoring),raw.scoring);
});
test('8문항과16문항은 같은 ExamId여도 평균·문항별 통계를 분리한다',()=>{
 const e=environment(),old=record(e,16),current=record(e,8,{resultInputs:Array(8).fill('0')});
 const oldStats=e.YP.computeStats(e.YP.getExamForRecord(old),[old,current]),newStats=e.YP.computeStats(e.YP.getExam(examId),[old,current]);
 assert.equal(oldStats.count,1);assert.equal(oldStats.average,100);assert.equal(oldStats.perQuestion.length,16);
 assert.equal(newStats.count,1);assert.equal(newStats.average,0);assert.equal(newStats.perQuestion.length,8);
});
test('총괄 누적은 실제8문항3회만 연결하고 개념정리는 별도 포털 기록으로 유지한다',()=>{
 const e=environment(),old=record(e,16),current=record(e,8),total={assessmentType:'comprehensive',courseId:'physics2-basic',historyExamIds:[examId]};
 const linked=e.YP.getLinkedHistory(total,current,[old,current]);assert.equal(linked.length,1);assert.equal(linked[0].token,current.token);
 const onlyOld=e.YP.computeHistorySummary(total,current,[old]);assert.equal(onlyOld.count,0);
 const portal=e.YP.computeStudentPortalCumulative([old,current]);assert.equal(portal.reports.length,2);assert.equal(portal.cumulative.testCount,2);
 const archive=portal.reports.find(r=>r.reportToken===old.token);assert.equal(archive.recordVariant,'concept16');assert.equal(archive.resolvedExamId,archiveId);assert.match(archive.title,/개념정리/);
 assert.equal(portal.reports.find(r=>r.reportToken===current.token).recordVariant,'');
});
test('길이 충돌 기록은 포털 목록에 원점수를 남기되 누적·평균에서 제외한다',()=>{
 const e=environment(),broken=record(e,16,{resultInputs:Array(8).fill('0'),score:71,percent:71}),current=record(e,8);
 const portal=e.YP.computeStudentPortalCumulative([broken,current]);assert.equal(portal.reports.length,2);assert.equal(portal.cumulative.testCount,1);assert.equal(portal.cumulative.averagePercent,100);
 const retained=portal.reports.find(r=>r.reportToken===broken.token);assert.equal(retained.score,71);assert.equal(retained.recordVariantConflict,true);
});
test('서버8행과보관16 또는 서버16행과신규8은 병합하지 않는다',()=>{
 const e=environment(),normal=e.YP.getExam(examId),old=e.YP.getExamForRecord(record(e,16)),newRows=questionRows(e,normal),oldRows=questionRows(e,old);
 assert.throws(()=>e.YP.mergeExamQuestions(normal,oldRows),x=>x.code==='RECORD_VARIANT_QUESTIONS_MISMATCH');
 assert.throws(()=>e.YP.mergeExamQuestions(old,newRows),x=>x.code==='RECORD_VARIANT_QUESTIONS_MISMATCH');
 assert.equal(e.YP.mergeExamQuestions(old,oldRows).questions.length,16);
 assert.throws(()=>e.YP.mergeExamQuestions(normal,[...newRows.slice(1),newRows[1]]),x=>x.code==='RECORD_VARIANT_QUESTIONS_MISMATCH');
});
test('리포트·포털 공통 상세 해석은 서버 지원·문항 소스·통계 개수를 검증한다',()=>{
 const e=environment(),d=detail(e,record(e,16));assert.equal(e.YP.resolveRecordDetail(d).exam.questions.length,16);
 assert.equal(e.YP.resolveRecordDetail(d).record.examId,examId);
 assert.throws(()=>e.YP.resolveRecordDetail({...d,recordVariantsSupported:false}),/Apps Script/);
 assert.throws(()=>e.YP.resolveRecordDetail({...d,questionSourceExamId:examId}),/문항 구성/);
 assert.throws(()=>e.YP.resolveRecordDetail({...d,stats:{perQuestion:Array(8).fill({})}}),/문항 구성/);
});
test('R03 포함 포털의 첫 화면도 구서버 누적요약을 표시하지 않으며 다른 학생은 그대로 연다',()=>{
 const e=environment(),data={reports:[{examId}]};
 assert.throws(()=>e.YP.requirePortalVariantSupport(data),x=>x.code==='RECORD_VARIANTS_SERVER_UPDATE_REQUIRED');
 assert.doesNotThrow(()=>e.YP.requirePortalVariantSupport({...data,recordVariantsSupported:true}));
 assert.doesNotThrow(()=>e.YP.requirePortalVariantSupport({reports:[{examId:'physics2-basic-r02'}]}));
});
test('데모 신규8 upsert는 같은 학생의 기존16 토큰·점수·지문을 덮지 않는다',async()=>{
 const e=environment(),old=record(e,16),before=JSON.stringify(old);e.api._saveDemo([old]);
 const input={...record(e,8),token:undefined,scoring:undefined,importMode:'upsert'};
 const saved=await e.api.saveReport(input),rows=e.api._loadDemo();assert.equal(rows.length,2);assert.equal(saved.created,true);assert.equal(saved.updated,false);assert.equal(saved.record.name,old.name);assert.notEqual(saved.record.token,old.token);
 assert.equal(JSON.stringify(rows.find(r=>r.token===old.token)),before);assert.equal(saved.record.studentId,old.studentId);
 const next=await e.api.saveReport({...input,resultInputs:Array(8).fill('0')});assert.equal(next.updated,true);assert.equal(next.record.token,saved.record.token);assert.equal(e.api._loadDemo().length,2);
});
test('데모16기록 수정은16배점과영구 식별자를 유지하며8입력으로수정·신규16생성은거절한다',async()=>{
 const e=environment(),old=record(e,16);e.api._saveDemo([old]);
 const changed=Array(16).fill('1');changed[0]='0';const saved=await e.api.saveReport({examId,token:old.token,name:old.name,school:old.school,studentId:old.studentId,resultInputs:changed,partialModes:Array(16).fill(false),recordVariant:'concept16'});
 assert.equal(saved.record.score,100-e.YP.getExam(archiveId).questions[0].maxPoints);assert.equal(saved.record.scoring.length,16);
 for(const k of ['examId','studentId','token','fingerprint'])assert.equal(saved.record[k],old[k]);
 const snapshot=JSON.stringify(e.api._loadDemo());
 await assert.rejects(()=>e.api.saveReport({examId,token:old.token,name:old.name,school:old.school,resultInputs:Array(8).fill('1')}),x=>x.code==='RECORD_VARIANT_CONFLICT');
 await assert.rejects(()=>e.api.saveReport({examId,name:old.name,school:old.school,resultInputs:Array(16).fill('1')}),x=>x.code==='RECORD_VARIANT_NEW_RECORD_FORBIDDEN');
 assert.equal(JSON.stringify(e.api._loadDemo()),snapshot);
});
test('데모16 정답 수정본을8에 적용하지 않고 보관 상세에서만 사용한다',async()=>{
 const e=environment(),old=record(e,16);e.api._saveDemo([old]);e.api._saveQuestionOverrides({[examId]:{'1':{answer:'기존16개념정리 답',updatedAt:'old'}}});
 const current=await e.api.getQuestions(examId),archived=await e.api.getReport(old.token,old.fingerprint);
 assert.notEqual(JSON.parse(current.questions[0].AnswerJSON).display,'기존16개념정리 답');assert.equal(JSON.parse(archived.questions[0].AnswerJSON).display,'기존16개념정리 답');
 assert.equal(archived.questionSourceExamId,archiveId);assert.equal(archived.questions.length,16);assert.equal(archived.stats.count,1);
 await assert.rejects(()=>e.api.saveQuestionAnswers(archiveId,[]),x=>x.code==='ARCHIVED_QUESTION_EDIT_FORBIDDEN');
});
test('구서버는 카탈로그 동기화 전에 차단하여 기존 정답을 보존한다',async()=>{
 const e=environment(),calls=[];e.api.demo=false;e.api.request=async action=>{calls.push(action);return {ok:true,recordVariantsSupported:false}};
 await assert.rejects(()=>e.api.syncCatalog(),x=>x.code==='RECORD_VARIANTS_SERVER_UPDATE_REQUIRED');assert.deepEqual(calls,['bootstrap']);
});
test('지원표식 또는8행 동기화가 없으면단일·일괄·정답 저장API를전송하지않는다',async()=>{
 const e=environment(),calls=[],input={examId,name:'검증',school:'검증고',resultInputs:Array(8).fill('1')};e.api.demo=false;e.api.lastBootstrap={recordVariantsSupported:true};
 e.api.request=async action=>{calls.push(action);return {ok:true,recordVariantsSupported:false,questions:questionRows(e,e.YP.getExam(examId))}};
 await assert.rejects(()=>e.api.saveReport(input),x=>x.code==='RECORD_VARIANTS_SERVER_UPDATE_REQUIRED');
 await assert.rejects(()=>e.api.saveBatch([input]),x=>x.code==='RECORD_VARIANTS_SERVER_UPDATE_REQUIRED');
 await assert.rejects(()=>e.api.saveQuestionAnswers(examId,[]),x=>x.code==='RECORD_VARIANTS_SERVER_UPDATE_REQUIRED');
 await assert.rejects(()=>e.api.clearQuestionAnswerOverrides(examId),x=>x.code==='RECORD_VARIANTS_SERVER_UPDATE_REQUIRED');
 assert.ok(calls.every(x=>x==='getQuestions'));
 e.api.request=async action=>{calls.push(action);return {ok:true,recordVariantsSupported:true,questions:questionRows(e,e.YP.getExam(archiveId))}};
 await assert.rejects(()=>e.api.saveReport(input),x=>x.code==='RECORD_VARIANT_QUESTIONS_MISMATCH');assert.ok(calls.every(x=>x==='getQuestions'));
});
test('정상지원서버에는8형태확인후 저장하며일반시험은기존API경로유지',async()=>{
 const e=environment(),calls=[];e.api.demo=false;e.api.request=async(action,payload)=>{calls.push(action);return action==='getQuestions'?{ok:true,recordVariantsSupported:true,questions:questionRows(e,e.YP.getExam(examId))}:{ok:true,record:payload.record}};
 await e.api.saveReport({examId,name:'검증',resultInputs:Array(8).fill('1')});assert.deepEqual(calls,['getQuestions','saveReport']);calls.length=0;
 const ex=e.YP.getExam('physics2-basic-r02');await e.api.saveReport({examId:ex.examId,name:'일반',resultInputs:Array(ex.questions.length).fill('1')});assert.deepEqual(calls,['saveReport']);
});
test('R03 정답 저장·초기화는8문항 편집 표식을 보내고 일반 시험 요청은 유지한다',async()=>{
 const e=environment(),calls=[];e.api.demo=false;e.api.request=async(action,payload)=>{calls.push({action,payload});return action==='getQuestions'?{ok:true,recordVariantsSupported:true,questions:questionRows(e,e.YP.getExam(examId))}:{ok:true}};
 await e.api.saveQuestionAnswers(examId,[{no:1,answer:'3'}]);await e.api.clearQuestionAnswerOverrides(examId,[1]);
 const writes=calls.filter(x=>x.action!=='getQuestions');assert.equal(writes.length,2);assert.ok(writes.every(x=>x.payload.expectedQuestionCount===8));
 calls.length=0;await e.api.saveQuestionAnswers('physics2-basic-r02',[{no:1,answer:'3'}]);await e.api.clearQuestionAnswerOverrides('physics2-basic-r02',[1]);assert.equal(calls.length,2);assert.ok(calls.every(x=>!('expectedQuestionCount' in x.payload)));
});
test('교사16기록 수정화면은16개를유지하고정답편집·CSV신규입력은차단한다',async()=>{
 const e=environment(true),old=record(e,16);e.api._saveDemo([old]);e.h.state.reports=[old];e.node('courseSelect').value='physics2-basic';
 await e.h.handleReportAction('edit',old.token,'',[old]);assert.equal(e.h.state.exam.questions.length,16);assert.equal(e.h.state.inputs.length,16);assert.equal(e.h.state.editToken,old.token);
 const payload=e.h.makeRecord();assert.equal(payload.examId,examId);assert.equal(payload.recordVariant,'concept16');assert.equal(payload.resultInputs.length,16);assert.equal(payload.token,old.token);
 assert.equal(e.node('saveAnswerEditorBtn').disabled,true);assert.throws(()=>e.h.collectAnswerEditorQuestions(),/보관/);
 e.h.downloadTemplate();assert.equal(e.downloads.length,0);assert.match(e.messages.at(-1),/8문항/);
 await e.h.loadExam({preserveInputs:true,resetBatch:false});assert.equal(e.h.state.exam.questions.length,16);assert.equal(e.h.state.inputs.length,16);
});
test('수정취소후8문항폼·CSV로돌아가고보관시험을새선택목록에노출하지않는다',async()=>{
 const e=environment(true),old=record(e,16);e.api._saveDemo([old]);e.node('courseSelect').value='physics2-basic';
 await e.h.handleReportAction('edit',old.token,'',[old]);e.h.cancelEdit();await Promise.resolve();await Promise.resolve();
 assert.equal(e.h.state.exam.questions.length,8);assert.equal(e.h.state.editToken,null);assert.equal(e.node('examSelect').value,examId);assert.doesNotMatch(e.node('examSelect').innerHTML,/concept16-archive/);
 e.h.downloadTemplate();assert.equal(e.downloads.length,1);const text=await e.downloads[0].blob.text();assert.match(text,/Q8/);assert.doesNotMatch(text,/Q9|Q16/);
});
test('교사일괄입력의기존기록탐색은16을제외하고초과붙여넣기를자르지않는다',async()=>{
 const e=environment(true),old=record(e,16),current=record(e,8);e.h.state.reports=[old];e.h.state.exam=e.YP.getExam(examId);e.h.state.inputs=Array(8).fill('0');
 assert.equal(e.h.findExistingBatchRecord(current),null);e.h.state.reports.push(current);assert.equal(e.h.findExistingBatchRecord(current).token,current.token);
 e.node('pasteValues').value=Array(16).fill('1').join('\t');e.h.applyPaste();assert.deepEqual(clone(e.h.state.inputs),Array(8).fill('0'));assert.match(e.messages.at(-1),/초과/);
 await assert.rejects(()=>e.h.rejectArchivedBatchShape({}, {importAssessment:async()=>({students:[{inputs:Array(16).fill('1')}]})}),/16문항/);
});
test('일반시험의정규화·평균·수정키는기존값을유지한다',()=>{
 const e=environment(),ex=e.YP.getExam('physics2-basic-r02'),r={examId:ex.examId,courseId:ex.courseId,name:'일반',school:'검증고',resultInputs:Array(ex.questions.length).fill('1'),token:'stable-other',fingerprint:'fp-other',studentId:'other-student'};
 const n=e.YP.normalizeRecord(r);assert.equal(n.score,100);assert.equal(n.scoring.length,ex.questions.length);assert.equal(n.token,r.token);assert.equal(n.fingerprint,r.fingerprint);assert.equal(n.studentId,r.studentId);assert.equal(e.YP.computeStats(ex,[r]).count,1);assert.equal('recordVariant' in n,false);
});
