import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {bootstrapDataset, REPORT_HEADERS} from './fixtures/roster-server-harness.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const catalog=JSON.parse(fs.readFileSync(new URL('../site/assets/data/catalog.json',import.meta.url),'utf8'));
const SOURCE='physics2-basic-r03', ARCHIVE='physics2-basic-r03-concept16-archive';
const normal=clone(catalog.exams.find(ex=>ex.examId===SOURCE));
const archived=clone(catalog.exams.find(ex=>ex.examId===ARCHIVE));
const other={examId:'fixture-ordinary',courseId:'physics2-basic',round:98,title:'일반 시험',status:'ready',questionCount:2,maxScore:100,questions:[1,2].map(no=>({no,type:'subjective',inputMode:'achievement',maxPoints:50,unit:'일반',topic:'검증'}))};
const comprehensive={...clone(other),examId:'fixture-comprehensive',assessmentType:'comprehensive',historyExamIds:[SOURCE],title:'총괄 검증'};
const config={courses:[{courseId:'physics2-basic',courseName:'물리2'}],exams:[normal,archived,other,comprehensive]};
const errorCode=(fn,code)=>assert.throws(fn,error=>error.code===code,code);

function setup({old16=false}={}) {
  const d=bootstrapDataset(),Sheet=d.sheets.get('Students').constructor;
  Sheet.prototype.autoResizeColumns=function(){return this};
  Sheet.prototype.clearContents=function(){this.cells=[];return this};
  Sheet.prototype.deleteRow=function(row){this.cells.splice(row-1,1);return this};
  d.sheets.get('Reports').cells=[REPORT_HEADERS.slice()];
  d.sheets.get('Exams').cells=[[]];
  d.props.setProperty('STUDENT_PORTAL_MIGRATION_COMPLETE','1');
  d.ctx.syncCatalog_(clone(old16?{...config,exams:[{...archived,examId:SOURCE,status:'ready',recordOnly:undefined,inputProfile:{}},other,comprehensive]}:config));
  const headers=clone(vm.runInContext('HEADERS',d.ctx));
  function add({token='saved-'+d.rows('Reports').length,studentId='stu_a',variant='',inputs,scoringCount,examId=SOURCE}={}) {
    const definition=examId===SOURCE?(variant==='concept16'?archived:normal):other;
    const values=inputs||Array(definition.questionCount).fill('1');
    const scoring=definition.questions.map((q,i)=>({raw:String(values[i]??''),valid:true,status:values[i]==='0'?'wrong':values[i]===''?'ungraded':'full',score:values[i]==='0'?0:values[i]===''?null:q.maxPoints,questionNo:q.no,maxPoints:q.maxPoints,unit:q.unit,topic:q.topic,inputMode:q.inputMode||'achievement'}));
    const seed='seed-'+token,school='가고',name='홍길동',courseId='physics2-basic';
    const score=scoring.reduce((sum,item)=>sum+Number(item.score||0),0),counts={full:0,partial:0,wrong:0,ungraded:0};
    scoring.forEach(item=>counts[item.status]++);
    const record={token,fingerprint:d.ctx.makeFingerprint_(token,seed),studentId,studentKey:d.ctx.makeStudentKey_(courseId,school,name),examId,courseId,school,name,grade:'2',classNo:studentId==='stu_a'?'1반 2번':'1반 3번',teacherMemo:'보존할 메모',resultInputs:values,partialModes:Array(values.length).fill(false),scoring:scoringCount===0?[]:scoring,score,maxScore:100,percent:score,counts,createdAt:'2026-11-21T10:00:00Z',updatedAt:'2026-11-21T10:00:00Z'};
    const row=[token,record.fingerprint,seed,d.ctx.makeIdentityDigest_(examId,courseId,school,name),record.studentKey,examId,courseId,school,name,'2',record.classNo,JSON.stringify(values),JSON.stringify(record.partialModes),JSON.stringify(record.scoring),JSON.stringify(record),record.createdAt,record.updatedAt,studentId];
    d.sheets.get('Reports').cells.push(row);
    return {record:clone(record),row:clone(row)};
  }
  function request({count=8,token,studentId='stu_a',examId=SOURCE,inputs,...extra}={}) {
    return {examId,studentId,token,name:'홍길동',school:'가고',grade:'2',classNo:studentId==='stu_a'?'1반 2번':'1반 3번',resultInputs:inputs||Array(count).fill('1'),partialModes:Array(count).fill(false),...extra};
  }
  const row=token=>clone(d.rows('Reports').find(item=>item[0]===token));
  const dataRows=name=>clone(d.rows(name));
  return {...d,headers,add,request,row,dataRows};
}

test('서버 계약: 8문항 원 ID와 보관용 16문항 정의를 동일 시트 구조로 동기화',()=>{
  const d=setup();
  assert.equal(normal.questionCount,8);assert.equal(archived.questionCount,16);
  assert.equal(d.ctx.getQuestionRows_(SOURCE).length,8);assert.equal(d.ctx.getQuestionRows_(ARCHIVE).length,16);
  assert.equal(d.ctx.getRowBy_('Exams','ExamId',ARCHIVE).Status,'archived');
  assert.deepEqual(clone(d.headers.Reports),REPORT_HEADERS);
  d.ctx.assertTeacherAuth_=()=>{};
  const response=d.ctx.dispatchApiRequest_({action:'getQuestions',examId:SOURCE});
  assert.equal(response.recordVariantsSupported,true);assert.equal(response.questionSourceExamId,SOURCE);
  assert.equal(response.questions.length,8);
});

test('서버 판별: 저장 scoring 우선, 없으면 입력 길이; 모순은 표시하되 데이터 무변경',()=>{
  const d=setup();
  assert.equal(d.ctx.r03RecordVariantInfo_({examId:SOURCE,scoring:Array(16),resultInputs:Array(16)}).recordVariant,'concept16');
  assert.equal(d.ctx.r03RecordVariantInfo_({examId:SOURCE,resultInputs:Array(16)}).recordVariant,'concept16');
  const conflict=d.ctx.r03RecordVariantInfo_({examId:SOURCE,scoring:Array(16),resultInputs:Array(8)});
  assert.equal(conflict.recordVariant,'concept16');assert.equal(conflict.recordVariantConflict,true);
  assert.equal(d.ctx.r03RecordVariantInfo_({examId:SOURCE,scoring:Array(8),resultInputs:Array(16)}).recordVariantConflict,true);
  assert.equal(d.ctx.r03RecordVariantInfo_({examId:'other',scoring:Array(16),resultInputs:Array(8)}).recordVariantConflict,false);
});

test('실제 getReport: 기존 8/16 링크·성적·ExamId 불변이며 각 문항과 통계만 연결',()=>{
  const d=setup();
  const a=d.add({token:'normal',inputs:['0',...Array(7).fill('1')]}),b=d.add({token:'legacy',variant:'concept16',inputs:['0',...Array(15).fill('1')]});
  const before=d.dataRows('Reports');
  const current=d.ctx.getReport_(a.record.token,a.record.fingerprint),legacy=d.ctx.getReport_(b.record.token,b.record.fingerprint);
  assert.equal(current.record.score,80);assert.equal(current.questions.length,8);assert.equal(current.stats.count,1);
  assert.equal(legacy.record.score,95);assert.equal(legacy.questions.length,16);assert.equal(legacy.stats.count,1);
  assert.equal(legacy.record.examId,SOURCE);assert.equal(legacy.record.resolvedExamId,ARCHIVE);assert.equal(legacy.questionSourceExamId,ARCHIVE);
  assert.equal(legacy.record.fingerprint,b.record.fingerprint);assert.equal(legacy.record.recordVariant,'concept16');
  assert.deepEqual(d.dataRows('Reports'),before);
});

test('실제 학생 포털: 두 형식의 제목·문항별 배점을 따로 보존하고 원 행을 수정하지 않음',()=>{
  const d=setup();d.add({token:'normal',inputs:['0',...Array(7).fill('1')]});d.add({token:'legacy',variant:'concept16',inputs:['0',...Array(15).fill('1')]});
  const before=d.dataRows('Reports'),profile=d.ctx.loadStudentStore_().byId.stu_a;
  const portal=d.ctx.buildStudentPortalData_(profile);
  assert.equal(portal.recordVariantsSupported,true);
  assert.equal(portal.reports.length,2);
  assert.equal(portal.reports.find(r=>r.reportToken==='legacy').title,archived.title);
  assert.equal(portal.reports.find(r=>r.reportToken==='normal').recordVariant,'');
  assert.equal(portal.cumulative.units.reduce((sum,u)=>sum+u.questionCount,0),24);
  assert.equal(portal.cumulative.weakItems.find(q=>q.reportToken==='normal').maxPoints,20);
  assert.equal(portal.cumulative.weakItems.find(q=>q.reportToken==='legacy').maxPoints,5);
  assert.deepEqual(d.dataRows('Reports'),before);
});

test('실제 평균/문항 통계: 정상8 그룹과 개념16 그룹은 동일 ExamId라도 섞지 않음',()=>{
  const d=setup();d.add({inputs:['0',...Array(7).fill('1')]});d.add({studentId:'stu_b'});d.add({variant:'concept16',inputs:['0',...Array(15).fill('1')]});
  const normalStats=d.ctx.getExamStats_(SOURCE),legacyStats=d.ctx.getExamStats_(SOURCE,'concept16');
  assert.equal(normalStats.count,2);assert.equal(normalStats.average,90);assert.equal(normalStats.perQuestion.length,8);
  assert.equal(legacyStats.count,1);assert.equal(legacyStats.average,95);assert.equal(legacyStats.perQuestion.length,16);
});

test('정상8 신규 저장: 같은 학생의16행을 보존하고 이름변경 없이 새8행을 만든 뒤 그8행만 upsert',()=>{
  const d=setup(),legacy=d.add({token:'legacy',variant:'concept16'}),students=d.dataRows('Students');
  const created=d.ctx.saveReport_(d.request({inputs:['0',...Array(7).fill('1')]}));
  assert.equal(created.created,true);assert.notEqual(created.token,'legacy');assert.equal(created.record.name,'홍길동');assert.equal(created.record.studentId,'stu_a');
  assert.equal(created.record.score,80);assert.equal(d.rows('Reports').length,2);assert.deepEqual(d.row('legacy'),legacy.row);
  const updated=d.ctx.saveReport_(d.request());
  assert.equal(updated.updated,true);assert.equal(updated.token,created.token);assert.equal(updated.fp,created.fp);
  assert.equal(updated.record.score,100);assert.deepEqual(d.row('legacy'),legacy.row);
  for(const [i,row] of d.dataRows('Students').entries())assert.deepEqual(row.slice(0,4),students[i].slice(0,4));
});

test('기존 정상8 성적 수정은 같은 token/fp/ExamId를 유지',()=>{
  const d=setup(),old=d.add({token:'normal'});
  const result=d.ctx.saveReport_(d.request({token:'normal',inputs:['0',...Array(7).fill('1')]}));
  assert.equal(result.token,old.record.token);assert.equal(result.fp,old.record.fingerprint);assert.equal(result.record.examId,SOURCE);assert.equal(result.record.score,80);assert.equal(d.rows('Reports').length,1);
});

test('명시 token16 수정은 보관용 배점으로 계산하며 token/fp/ExamId 유지',()=>{
  const d=setup(),old=d.add({token:'legacy',variant:'concept16'});
  const result=d.ctx.saveReport_(d.request({count:16,token:'legacy',inputs:['0',...Array(15).fill('1')]}));
  assert.equal(result.record.score,95);assert.equal(result.record.scoring.length,16);assert.equal(result.record.examId,SOURCE);
  assert.equal(result.token,old.record.token);assert.equal(result.fp,old.record.fingerprint);assert.equal(result.record.recordVariant,'concept16');
});

test('8↔16 token 덮어쓰기 및 보관용 ID/16 신규 입력을 실제 서버가 거절',()=>{
  const d=setup();d.add({token:'normal'});d.add({token:'legacy',variant:'concept16'});
  const reports=d.dataRows('Reports'),students=d.dataRows('Students');
  errorCode(()=>d.ctx.saveReport_(d.request({token:'legacy'})),'R03_RECORD_VARIANT_MISMATCH');
  errorCode(()=>d.ctx.saveReport_(d.request({count:16,token:'normal'})),'R03_RECORD_VARIANT_MISMATCH');
  errorCode(()=>d.ctx.saveReport_(d.request({count:16})),'R03_ARCHIVE_READ_ONLY');
  assert.throws(()=>d.ctx.saveReport_(d.request({count:16,examId:ARCHIVE})),/준비 중/);
  assert.deepEqual(d.dataRows('Reports'),reports);assert.deepEqual(d.dataRows('Students'),students);
});

test('모순 기록은 원점수 조회만 보존하고 통계·총괄 누적·저장에서 제외',()=>{
  const d=setup(),bad=d.add({token:'conflict',variant:'concept16'}),sh=d.sheets.get('Reports');
  sh.cells[1][11]=JSON.stringify(Array(8).fill('1'));
  const before=d.dataRows('Reports'),response=d.ctx.getReport_(bad.record.token,bad.record.fingerprint);
  assert.equal(response.record.score,100);assert.equal(response.record.scoring.length,16);assert.equal(response.record.recordVariantConflict,true);
  assert.equal(d.ctx.getExamStats_(SOURCE,'concept16').count,0);
  errorCode(()=>d.ctx.saveReport_(d.request({count:16,token:'conflict'})),'R03_RECORD_VARIANT_MISMATCH');
  errorCode(()=>d.ctx.saveReport_(d.request({token:'conflict'})),'R03_RECORD_VARIANT_MISMATCH');
  assert.deepEqual(d.dataRows('Reports'),before);
});

test('CSV 일괄 upsert:16행을 덮지 않고8행만 생성/재수정; 잘못된 token16 입력은 실패 목록',()=>{
  const d=setup(),old=d.add({token:'legacy',variant:'concept16'});
  const created=d.ctx.saveBatch_([d.request({inputs:['0',...Array(7).fill('1')]})]);
  assert.equal(created.createdCount,1);assert.equal(created.updatedCount,0);assert.deepEqual(d.row('legacy'),old.row);
  const newToken=created.saved[0].token;
  const again=d.ctx.saveBatch_([d.request(),d.request({token:'legacy'})]);
  assert.equal(again.updatedCount,1);assert.equal(again.failed.length,1);assert.equal(again.saved[0].token,newToken);assert.deepEqual(d.row('legacy'),old.row);
  const legacyUpdate=d.ctx.saveBatch_([d.request({token:'legacy',count:16,inputs:['0',...Array(15).fill('1')]})]);
  assert.equal(legacyUpdate.updatedCount,1);assert.equal(legacyUpdate.saved[0].score,95);assert.equal(legacyUpdate.saved[0].recordVariant,'concept16');
});

test('일괄 create에서도16보관기록 때문에 정상8 학생 이름에 숫자를 붙이지 않음',()=>{
  const d=setup();d.add({variant:'concept16'});
  const result=d.ctx.saveBatch_([d.request({importMode:'create'})]);
  assert.equal(result.savedCount,1);assert.equal(result.saved[0].name,'홍길동');assert.equal(result.saved[0].studentId,'stu_a');
});

test('총괄 history에는 정상8만 연결하고16기록과 링크는 포털에 그대로 보존',()=>{
  const d=setup();d.add({token:'normal'});d.add({token:'legacy',variant:'concept16'});
  const history=d.ctx.getLinkedHistoryRecords_({examId:comprehensive.examId,courseId:'physics2-basic',studentId:'stu_a',name:'홍길동',school:'가고'});
  assert.deepEqual(clone(history.map(record=>record.token)),['normal']);assert.equal(d.rows('Reports').length,2);
});

test('정상8 시험 재채점은16기록을 보존하며 다른 일반시험 채점은 기존과 동일',()=>{
  const d=setup(),legacy=d.add({token:'legacy',variant:'concept16'});d.add({token:'normal'});
  const recalculated=d.ctx.recalculateExam_(SOURCE);
  assert.equal(recalculated.updated,1);assert.equal(recalculated.skippedPreservedRecords,1);assert.deepEqual(d.row('legacy'),legacy.row);
  const ordinary=d.ctx.saveReport_(d.request({examId:other.examId,count:2,inputs:['1','0']}));
  assert.equal(ordinary.record.score,50);assert.equal(ordinary.record.scoring.length,2);assert.equal('recordVariant' in ordinary.record,false);
});

function addOverride(d,examId,answer='교사 수정 정답') {
  d.ctx.upsertQuestionOverride_({ExamId:examId,QuestionNo:1,AnswerJSON:JSON.stringify({display:answer}),OriginalRetryJSON:'',SimilarProblemJSON:'',RevisionNote:'수정 메모 보존',UpdatedAt:'2026-11-21T13:00:00Z'});
}

test('16→8 동기화는 기존 정답 수정본을 보관용으로 옮기고 Reports를 변경하지 않으며 재실행 가능',()=>{
  const d=setup({old16:true});d.add({token:'legacy',variant:'concept16'});addOverride(d,SOURCE);addOverride(d,other.examId,'타시험 정답');
  const before=d.dataRows('Reports');
  const sync=d.ctx.syncCatalog_(clone(config));
  assert.equal(sync.archivedR03Overrides,1);assert.equal(sync.recordVariantsSupported,true);
  assert.equal(d.ctx.getQuestionOverrideRows_(SOURCE).length,0);
  const preserved=d.ctx.getQuestionOverrideRows_(ARCHIVE)[0];
  assert.equal(preserved.RevisionNote,'수정 메모 보존');assert.equal(preserved.UpdatedAt,'2026-11-21T13:00:00Z');
  assert.equal(JSON.parse(d.ctx.getQuestionRows_(ARCHIVE)[0].AnswerJSON).display,'교사 수정 정답');
  assert.notEqual(JSON.parse(d.ctx.getQuestionRows_(SOURCE)[0].AnswerJSON).display,'교사 수정 정답');
  assert.equal(d.ctx.getQuestionOverrideRows_(other.examId).length,1);assert.deepEqual(d.dataRows('Reports'),before);
  const overrides=d.dataRows('QuestionOverrides');assert.equal(d.ctx.syncCatalog_(clone(config)).archivedR03Overrides,0);assert.deepEqual(d.dataRows('QuestionOverrides'),overrides);
});

test('기존 정상8 정답 수정본은 카탈로그 재동기화 후에도 원 ID에 남음',()=>{
  const d=setup();addOverride(d,SOURCE,'정상8 교사 정답');
  const before=d.dataRows('QuestionOverrides');d.ctx.syncCatalog_(clone(config));
  assert.deepEqual(d.dataRows('QuestionOverrides'),before);
  assert.equal(JSON.parse(d.ctx.getQuestionRows_(SOURCE)[0].AnswerJSON).display,'정상8 교사 정답');
});

test('서로 다른 기존 보관 수정본이 있으면 동기화를 중단하고 양쪽 수정본/Reports/Questions 보존',()=>{
  const d=setup({old16:true});addOverride(d,SOURCE,'최근16 수정');addOverride(d,ARCHIVE,'다른 보관 수정');
  const originals={overrides:d.dataRows('QuestionOverrides'),questions:d.dataRows('Questions'),reports:d.dataRows('Reports')};
  errorCode(()=>d.ctx.syncCatalog_(clone(config)),'R03_OVERRIDE_ARCHIVE_CONFLICT');
  assert.deepEqual(d.dataRows('QuestionOverrides'),originals.overrides);assert.deepEqual(d.dataRows('Questions'),originals.questions);assert.deepEqual(d.dataRows('Reports'),originals.reports);
});

test('백엔드만 갱신되고 아직16Questions인 동안 신규8 저장 차단; 기존16 링크 조회 보존',()=>{
  const d=setup({old16:true}),old=d.add({token:'legacy',variant:'concept16'}),before=d.dataRows('Reports');
  errorCode(()=>d.ctx.saveReport_(d.request()),'R03_CATALOG_NOT_SYNCED');
  assert.equal(d.ctx.getReport_(old.record.token,old.record.fingerprint).questions.length,16);
  assert.deepEqual(d.dataRows('Reports'),before);
});

test('정답 보관 복사 쓰기가 실패하면 원본 수정본을 지우지 않으며 재시도로 복구',()=>{
  const d=setup({old16:true});addOverride(d,SOURCE);
  const questions=d.dataRows('Questions'),overrides=d.dataRows('QuestionOverrides');
  d.sheets.get('QuestionOverrides').failNextWrite=true;
  assert.throws(()=>d.ctx.syncCatalog_(clone(config)),/simulated sheet failure/);
  assert.deepEqual(d.dataRows('QuestionOverrides'),overrides);assert.deepEqual(d.dataRows('Questions'),questions);
  assert.equal(d.ctx.syncCatalog_(clone(config)).archivedR03Overrides,1);
  assert.equal(d.ctx.getQuestionOverrideRows_(ARCHIVE).length,1);assert.equal(d.ctx.getQuestionOverrideRows_(SOURCE).length,0);
});

test('학생 병합은 정상8과개념16을 중복으로 삭제하지 않으며 각각의 기록을 유지',()=>{
  const d=setup();d.add({token:'source8',studentId:'stu_a'});d.add({token:'target16',studentId:'stu_b',variant:'concept16'});
  const preview=d.ctx.previewStudentMerge_('stu_a','stu_b');
  assert.equal(preview.conflicts.length,0);assert.equal(preview.nonConflictingTransferCount,1);
  d.ctx.mergeStudentProfiles_({sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:preview.revision,confirmed:true,confirmTargetName:'홍길동',resolutions:[]});
  const reports=d.dataRows('Reports');assert.equal(reports.length,2);
  assert.ok(reports.every(row=>row[5]===SOURCE&&row[17]==='stu_b'));
  assert.deepEqual(reports.map(row=>JSON.parse(row[13]).length).sort((a,b)=>a-b),[8,16]);
});

test('학생 병합에서 실제 같은 형식의 중복만 분리 선택하며 표시명과 원 ExamId 보존',()=>{
  const d=setup();
  d.add({token:'source8',studentId:'stu_a'});d.add({token:'source16',studentId:'stu_a',variant:'concept16'});
  d.add({token:'target8',studentId:'stu_b'});d.add({token:'target16',studentId:'stu_b',variant:'concept16'});
  const preview=d.ctx.previewStudentMerge_('stu_a','stu_b');assert.equal(preview.conflicts.length,2);
  assert.equal(preview.conflicts.find(item=>item.examId.includes('|recordVariant:')).examTitle,archived.title);
  const resolutions=preview.conflicts.map(item=>({examId:item.examId,keepToken:item.choices.find(choice=>choice.owner==='target').token}));
  d.ctx.mergeStudentProfiles_({sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:preview.revision,confirmed:true,confirmTargetName:'홍길동',resolutions});
  assert.deepEqual(d.dataRows('Reports').map(row=>row[0]).sort(),['target16','target8']);
  assert.ok(d.rows('Reports').every(row=>row[5]===SOURCE));
});

test('최신 동기화 이후 구캐시8/16 카탈로그가 보관 정의를 지우는 재동기화를 변경 전에 차단',()=>{
  const d=setup();d.add({variant:'concept16'});addOverride(d,SOURCE,'정상8 수정본');
  const before={exams:d.dataRows('Exams'),questions:d.dataRows('Questions'),overrides:d.dataRows('QuestionOverrides'),reports:d.dataRows('Reports')};
  for(const previousDefinition of [normal,archived]){
    const old=clone(previousDefinition);old.examId=SOURCE;old.status='ready';delete old.inputProfile;delete old.recordOnly;
    errorCode(()=>d.ctx.syncCatalog_({courses:config.courses,exams:[old,other]}),'R03_CATALOG_VARIANTS_REQUIRED');
  }
  assert.deepEqual(d.dataRows('Exams'),before.exams);assert.deepEqual(d.dataRows('Questions'),before.questions);
  assert.deepEqual(d.dataRows('QuestionOverrides'),before.overrides);assert.deepEqual(d.dataRows('Reports'),before.reports);
});

test('최초16→8 전환도 보관정의 없는 구카탈로그로는 정답/기성적을 훼손할 수 없음',()=>{
  const d=setup({old16:true});addOverride(d,SOURCE);const before=d.dataRows('QuestionOverrides'),old=clone(normal);delete old.inputProfile;
  errorCode(()=>d.ctx.syncCatalog_({courses:config.courses,exams:[old,other]}),'R03_CATALOG_VARIANTS_REQUIRED');
  assert.deepEqual(d.dataRows('QuestionOverrides'),before);assert.equal(d.ctx.getQuestionRows_(SOURCE).length,16);
});

test('길이 충돌 기록은 포털 목록의 원점수만 보존하고 누적 평균·단원·오답에서 제외',()=>{
  const d=setup();d.add({token:'normal',inputs:['0',...Array(7).fill('1')]});d.add({token:'conflict',variant:'concept16'});
  d.sheets.get('Reports').cells[2][11]=JSON.stringify(Array(8).fill('1'));
  const before=d.dataRows('Reports'),portal=d.ctx.buildStudentPortalData_(d.ctx.loadStudentStore_().byId.stu_a);
  assert.equal(portal.reports.length,2);assert.equal(portal.reports.find(r=>r.reportToken==='conflict').score,100);
  assert.equal(portal.cumulative.testCount,1);assert.equal(portal.cumulative.averagePercent,80);
  assert.equal(portal.cumulative.units.reduce((sum,u)=>sum+u.questionCount,0),8);
  assert.equal(portal.cumulative.trend.length,1);assert.ok(portal.cumulative.weakItems.every(q=>q.reportToken==='normal'));
  assert.deepEqual(d.dataRows('Reports'),before);
});

test('구 UI의 부분 정답 저장·전체 초기화는 버전 표식 없이는 거절하고 새8 UI 요청은 처리',()=>{
  const d=setup();addOverride(d,SOURCE,'현재8 수정본');
  const before=d.dataRows('QuestionOverrides'),q=normal.questions[0],item={...clone(q),answer:'검수된8 정답'};
  errorCode(()=>d.ctx.saveQuestionAnswers_(SOURCE,[item],'구화면'),'R03_QUESTION_VERSION_REQUIRED');
  errorCode(()=>d.ctx.clearQuestionAnswerOverrides_(SOURCE,[]),'R03_QUESTION_VERSION_REQUIRED');
  assert.deepEqual(d.dataRows('QuestionOverrides'),before);
  assert.equal(d.ctx.saveQuestionAnswers_(SOURCE,[item],'신규8',8).count,1);
  assert.equal(JSON.parse(d.ctx.getQuestionRows_(SOURCE)[0].AnswerJSON).display,'검수된8 정답');
  assert.equal(d.ctx.clearQuestionAnswerOverrides_(SOURCE,[],8).deleted,1);
});
