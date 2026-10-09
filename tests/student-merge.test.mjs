import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const source=fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url),'utf8');
const STUDENT_HEADERS=['StudentId','PortalToken','PortalFingerprint','IdentitySeed','IdentityDigest','IdentityKey','School','Name','Grade','ClassNo','ExternalId','CreatedAt','UpdatedAt','Active'];
const REPORT_HEADERS=['Token','Fingerprint','IdentitySeed','IdentityDigest','StudentKey','ExamId','CourseId','School','Name','Grade','ClassNo','ResultInputsJSON','PartialModesJSON','ScoringJSON','RecordJSON','CreatedAt','UpdatedAt','StudentId'];
const CLASS_HEADERS=['ClassId','ClassName','SortOrder','CreatedAt','UpdatedAt','Active'];
const MEMBER_HEADERS=['ClassId','StudentId','AddedAt','SortOrder','Active'];

class MockSheet {
  constructor(name,header=[],rows=[]){this.name=name;this.cells=[header.slice(),...rows.map(r=>r.slice())];this.failNextWrite=false;}
  getName(){return this.name}
  getLastRow(){for(let i=this.cells.length-1;i>=0;i--)if((this.cells[i]||[]).some(x=>x!==''&&x!==null&&x!==undefined))return i+1;return 0}
  getLastColumn(){return this.cells[0]?.length||0}
  getMaxRows(){return Math.max(this.cells.length,200)}
  insertRowsAfter(){return this}
  setFrozenRows(){return this}
  getRange(r,c,h=1,w=1){const sh=this;return {
    getValues(){return Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>sh.cells[r+i-1]?.[c+j-1]??''))},
    getDisplayValues(){return this.getValues().map(row=>row.map(String))},
    setValues(rows){if(sh.failNextWrite){sh.failNextWrite=false;throw new Error('simulated sheet failure')};assert.equal(rows.length,h);for(let i=0;i<h;i++){assert.equal(rows[i].length,w);if(!sh.cells[r+i-1])sh.cells[r+i-1]=[];for(let j=0;j<w;j++)sh.cells[r+i-1][c+j-1]=rows[i][j];}return this},
    clearContent(){for(let i=0;i<h;i++)for(let j=0;j<w;j++){if(sh.cells[r+i-1])sh.cells[r+i-1][c+j-1]='';}return this},
    setValue(v){return this.setValues([[v]])},
    setFontWeight(){return this},setBackground(){return this},setFontColor(){return this}
  }}
}
function bootstrapDataset(opts={}){
  const p=new Map();const sheets=new Map();
  const ss={getSheetByName(name){return sheets.get(name)||null},insertSheet(name){const sh=new MockSheet(name);sheets.set(name,sh);return sh},getId(){return 'test-db-id'},getName(){return 'Test'},toast(){}};
  const props={getProperty(key){return p.get(key)||null},setProperty(key,v){p.set(key,String(v))},deleteProperty(key){p.delete(key)},setProperties(obj){for(const [k,v] of Object.entries(obj))p.set(k,String(v))}};
  p.set('FINGERPRINT_SECRET','secret-for-tests');p.set('SPREADSHEET_ID','test-db-id');p.set('STUDENT_PORTAL_SCHEMA_VERSION','1');
  const toBytes=buffer=>Array.from(Buffer.from(buffer));
  let tokenCounter=0;
  const Utilities={DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
    computeDigest(alg,input){return toBytes(crypto.createHash('sha256').update(input).digest())},
    computeHmacSha256Signature(text,key){return toBytes(crypto.createHmac('sha256',key).update(text).digest())},
    base64EncodeWebSafe(bytes){return Buffer.from(bytes).toString('base64url')},
    getUuid(){return '12345678-1234-1234-1234-'+(++tokenCounter).toString().padStart(12,'0')},
  };
  const ctx={console,Utilities,PropertiesService:{getScriptProperties(){return props}},SpreadsheetApp:{getActiveSpreadsheet(){return ss},openById(){return ss}},LockService:{getScriptLock(){return {tryLock(){return true},releaseLock(){}}}}};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  const createStudent=(id,name,school='미기입',grade='2',classNo='2반 3번')=>{
    const portalToken='sp_'+id,seed='seed_'+id;
    const input=[id,portalToken,ctx.makeStudentPortalFingerprint_(portalToken,seed),seed,ctx.makeStudentProfileDigest_(id,school,name,grade,classNo,''),ctx.makeStudentProfileIdentityKey_(school,name,grade,classNo,''),school,name,grade,classNo,'','2026-01-01','2026-10-09',true];
    return input;
  };
  const src=createStudent('stu_a','홍길동','가고','2','1반 2번'),dst=createStudent('stu_b','홍길동','가고','2','1반 3번');
  const makeRecord=(token,id,name,school,examId,score,updated='2026-10-09')=>{
    const seed='seed_'+token,examCourse='physics1-basic',maxScore=100;
    const record={token,fingerprint:ctx.makeFingerprint_(token,seed),studentId:id,studentKey:ctx.makeStudentKey_(examCourse,school,name),examId,courseId:examCourse,school,name,grade:'2',classNo:id==='stu_a'?'1반 2번':'1반 3번',score,maxScore,percent:score,counts:{full:1},scoring:[{score,status:'full'}],resultInputs:[1],partialModes:[],createdAt:'2026-10-01',updatedAt:updated};
    return [token,record.fingerprint,seed,ctx.makeIdentityDigest_(examId,examCourse,school,name),record.studentKey,examId,examCourse,school,name,'2',record.classNo,JSON.stringify([1]),JSON.stringify([]),JSON.stringify(record.scoring),JSON.stringify(record),'2026-10-01',updated,id];
  };
  const reports=[makeRecord('tok_a1','stu_a','홍길동','가고','exam1',75),makeRecord('tok_a2','stu_a','홍길동','가고','exam2',80),makeRecord('tok_b1','stu_b','홍길동','가고','exam1',93),makeRecord('tok_b3','stu_b','홍길동','가고','exam3',91)];
  const members=[['cls_1','stu_a','2026-01-01',1,true],['cls_1','stu_b','2026-01-03',1,true],['cls_2','stu_a','2026-01-02',2,true]];
  sheets.set('Students',new MockSheet('Students',STUDENT_HEADERS,[src,dst]));
  sheets.set('Reports',new MockSheet('Reports',REPORT_HEADERS,reports));
  sheets.set('ClassMembers',new MockSheet('ClassMembers',MEMBER_HEADERS,members));
  sheets.set('Classes',new MockSheet('Classes',CLASS_HEADERS,[['cls_1','반1',1,'','',true],['cls_2','반2',2,'','',true]]));
  sheets.set('Exams',new MockSheet('Exams',['ExamId','Title'],[['exam1','1회'],['exam2','2회'],['exam3','3회']]));
  const named=name=>sheets.get(name),rows=name=>named(name).cells.slice(1).filter(r=>r.some(x=>x!==''));
  return {ctx,sheets,props,rows,makeRecord,createStudent};
}
const errorCode=(fn,code)=>assert.throws(fn,e=>e.code===code,`should throw ${code}`);

test('병합 미리보기: 이관할 시험·중복 시험·반·유지 링크 및 경고',()=>{
  const d=bootstrapDataset();const p=d.ctx.previewStudentMerge_('stu_a','stu_b');
  assert.equal(p.sourceCount,2);assert.equal(p.targetCount,2);
  assert.equal(p.conflicts.length,1);assert.equal(p.conflicts[0].examId,'exam1');
  assert.equal(p.conflicts[0].choices.length,2);assert.equal(p.nonConflictingTransferCount,1);assert.equal(p.sourceClassCount,2);
  assert.equal(p.source.portalToken,'sp_stu_a');assert.equal(p.target.portalToken,'sp_stu_b');
  assert.equal(d.rows('Reports').length,4);assert.equal(d.rows('Students').filter(r=>r[13]===true).length,2);
});

test('병합 미리보기: 서로 다른 ID 필수, 미존재 학생·동일 인물 검사',()=>{
  const d=bootstrapDataset();errorCode(()=>d.ctx.previewStudentMerge_('stu_a','stu_a'),'STUDENT_MERGE_SAME');
  errorCode(()=>d.ctx.previewStudentMerge_('stu_bad','stu_b'),'STUDENT_NOT_FOUND');
});

test('병합 미리보기: 학생 ID 없는 과거 시험 기록이 있으면 교사 확인 전 중단',()=>{
  const d=bootstrapDataset();const sh=d.sheets.get('Reports'),row=d.makeRecord('old-legacy','', '홍길동','가고','exam4',100);row[17]='';sh.cells.push(row);
  errorCode(()=>d.ctx.previewStudentMerge_('stu_a','stu_b'),'STUDENT_MERGE_UNLINKED');
});

test('보안: 교사 인증 전 병합 미리보기 및 실제 병합 API 요청은 거절',()=>{
  const d=bootstrapDataset();errorCode(()=>d.ctx.dispatchApiRequest_({action:'previewStudentMerge',sourceStudentId:'stu_a',targetStudentId:'stu_b'}),'AUTH_REQUIRED');
  errorCode(()=>d.ctx.dispatchApiRequest_({action:'mergeStudentProfiles',sourceStudentId:'stu_a',targetStudentId:'stu_b'}),'AUTH_REQUIRED');
});

test('병합 실행: 미리보기, 명시적 중복 선택, 서명된 확인이 필수',()=>{
  const d=bootstrapDataset(),p=d.ctx.previewStudentMerge_('stu_a','stu_b');const base={sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:p.revision,confirmed:true,confirmTargetName:'홍길동'};
  errorCode(()=>d.ctx.mergeStudentProfiles_(base),'STUDENT_MERGE_RESOLUTION_REQUIRED');
  errorCode(()=>d.ctx.mergeStudentProfiles_({...base,resolutions:[{examId:'exam1',keepToken:'wrong'}]}),'STUDENT_MERGE_BAD_RESOLUTION');
  errorCode(()=>d.ctx.mergeStudentProfiles_({...base,confirmed:false,resolutions:[{examId:'exam1',keepToken:'tok_b1'}]}),'STUDENT_MERGE_CONFIRM_REQUIRED');
  errorCode(()=>d.ctx.mergeStudentProfiles_({...base,confirmTargetName:'다른 이름',resolutions:[{examId:'exam1',keepToken:'tok_b1'}]}),'STUDENT_MERGE_CONFIRM_REQUIRED');
  assert.equal(d.rows('Reports').length,4);
});

test('병합 실행: 이전 미리보기 이후 시험 점수가 바뀌면 다시 확인해야 함',()=>{
  const d=bootstrapDataset(),p=d.ctx.previewStudentMerge_('stu_a','stu_b');const reports=d.sheets.get('Reports');reports.cells[1][16]='2026-10-10';
  errorCode(()=>d.ctx.mergeStudentProfiles_({sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:p.revision,confirmTargetName:'홍길동',confirmed:true,resolutions:[{examId:'exam1',keepToken:'tok_b1'}]}),'STUDENT_MERGE_PREVIEW_STALE');
  assert.equal(d.rows('Reports').length,4);
});

test('병합 완료: 대상 시험 보존, 출처 고유 시험 이동, 기록 토큰·FP 무결성, 반 배정 합집합',()=>{
  const d=bootstrapDataset(),p=d.ctx.previewStudentMerge_('stu_a','stu_b');
  const oldTargetFp=d.rows('Students')[1][2],oldTargetPortal=d.rows('Students')[1][1];
  const oldSourceExamFp=d.rows('Reports')[1][1];
  const result=d.ctx.mergeStudentProfiles_({sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:p.revision,confirmTargetName:'홍길동',confirmed:true,resolutions:[{examId:'exam1',keepToken:'tok_b1'}]});
  assert.equal(result.ok,true);assert.equal(result.transferredReports,1);assert.equal(result.removedDuplicateReports,1);assert.equal(result.rotatedSourceReportLinks,1);assert.equal(result.classesTransferred,1);
  assert.equal(result.targetStudent.portalToken,oldTargetPortal);
  assert.equal(d.rows('Reports').length,3);
  const m=d.rows('Reports').find(r=>r[5]==='exam2');assert.equal(m[17],'stu_b');assert.notEqual(m[0],'tok_a2');assert.notEqual(m[1],oldSourceExamFp);
  assert.equal(d.ctx.makeFingerprint_(m[0],m[2]),m[1]);
  assert.equal(d.ctx.makeIdentityDigest_('exam2','physics1-basic','가고','홍길동'),m[3]);
  assert.equal(JSON.parse(m[14]).studentId,'stu_b');
  assert.equal(d.rows('Reports').filter(r=>r[0]==='tok_b1'||r[0]==='tok_b3').length,2);
  assert.equal(d.ctx.findReportRowByToken_('tok_a2'),null);
  const profiles=d.rows('Students');assert.equal(profiles[0][13],false);assert.equal(profiles[1][13],true);assert.equal(profiles[1][2],oldTargetFp);
  const members=d.rows('ClassMembers').filter(r=>r[1]==='stu_b'&&r[4]===true);assert.equal(new Set(members.map(r=>r[0])).size,2);
  assert.equal(d.rows('StudentMerges')[0][3],'COMPLETED');assert.ok(d.rows('StudentMergeArchives').length>=8);
  errorCode(()=>d.ctx.findStudentProfileByPortal_('sp_stu_a',profiles[0][2]),'STUDENT_PORTAL_DISABLED');
  assert.equal(d.ctx.findStudentProfileByPortal_('sp_stu_b',oldTargetFp).StudentId,'stu_b');
  errorCode(()=>d.ctx.mergeStudentProfiles_({sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:p.revision,confirmTargetName:'홍길동',confirmed:true,resolutions:[{examId:'exam1',keepToken:'tok_b1'}]}),'STUDENT_MERGE_INACTIVE');
  errorCode(()=>d.ctx.resolveStudentProfileInStore_(d.ctx.loadStudentStore_(),{studentId:'stu_a',school:'가고',name:'홍길동',grade:'2',classNo:'1반 2번'},'stu_a'),'STUDENT_PROFILE_INACTIVE');
});

test('중복 시험에서 흡수 학생의 성적을 선택하면 대상 학생 기존 기록만 백업 제외',()=>{
  const d=bootstrapDataset(),p=d.ctx.previewStudentMerge_('stu_a','stu_b');
  const result=d.ctx.mergeStudentProfiles_({sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:p.revision,confirmTargetName:'홍길동',confirmed:true,resolutions:[{examId:'exam1',keepToken:'tok_a1'}]});
  const tokens=d.rows('Reports').map(r=>r[0]);assert.ok(!tokens.includes('tok_a1'));assert.ok(!tokens.includes('tok_b1'));
  assert.equal(d.rows('Reports').find(r=>r[5]==='exam1')[17],'stu_b');assert.equal(result.removedDuplicateReports,1);
});

test('반 배정 쓰기 실패 시 Reports, ClassMembers, Students 원복하고 병합 이력을 남김',()=>{
  const d=bootstrapDataset(),p=d.ctx.previewStudentMerge_('stu_a','stu_b');
  const beforeReports=JSON.stringify(d.rows('Reports')),beforeMembers=JSON.stringify(d.rows('ClassMembers')),beforeProfiles=JSON.stringify(d.rows('Students'));
  d.sheets.get('ClassMembers').failNextWrite=true;
  assert.throws(()=>d.ctx.mergeStudentProfiles_({sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:p.revision,confirmTargetName:'홍길동',confirmed:true,resolutions:[{examId:'exam1',keepToken:'tok_b1'}]}),/simulated sheet failure/);
  assert.equal(JSON.stringify(d.rows('Reports')),beforeReports);assert.equal(JSON.stringify(d.rows('ClassMembers')),beforeMembers);assert.equal(JSON.stringify(d.rows('Students')),beforeProfiles);
  assert.equal(d.rows('StudentMerges')[0][3],'ROLLED_BACK');assert.ok(d.rows('StudentMergeArchives').length>0);
});

test('유지 학생 포털에 3개의 서로 다른 시험만 나타나고 흡수 학생의 개별 성적 링크는 폐기',()=>{
  const d=bootstrapDataset(),preview=d.ctx.previewStudentMerge_('stu_a','stu_b'),beforeSourceExamFp=d.rows('Reports').find(r=>r[0]==='tok_a2')[1];
  d.ctx.mergeStudentProfiles_({sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:preview.revision,confirmTargetName:'홍길동',confirmed:true,resolutions:[{examId:'exam1',keepToken:'tok_b1'}]});
  const t=d.rows('Students')[1],portal=d.ctx.getStudentPortal_(t[1],t[2]);
  assert.equal(portal.ok,true);assert.equal(portal.cumulative.testCount,3);
  assert.deepEqual(portal.reports.map(r=>r.examId).sort(),['exam1','exam2','exam3']);
  errorCode(()=>d.ctx.getReport_('tok_a2',beforeSourceExamFp),'REPORT_NOT_FOUND');
  const moved=d.rows('Reports').find(r=>r[5]==='exam2');
  assert.equal(d.ctx.getStudentExamDetail_(t[1],t[2],moved[0]).record.studentId,'stu_b');
});

test('서로 다른 이름·학교 학생도 명시적으로 병합할 수 있으나 사전 경고, 통합 후 모든 시험의 대상 신원 반영',()=>{
  const d=bootstrapDataset();
  // 입력 원본과 연결된 두 번째 학생을 다르게 만드는 대신 첫 번째 학생 이름/학교만 수정하고 다이제스트를 맞춘다.
  const dst=d.sheets.get('Students').cells[2];dst[6]='나고';dst[7]='김민수';dst[5]=d.ctx.makeStudentProfileIdentityKey_('나고','김민수','2','1반 3번','');dst[4]=d.ctx.makeStudentProfileDigest_('stu_b','나고','김민수','2','1반 3번','');
  const preview=d.ctx.previewStudentMerge_('stu_a','stu_b');assert.equal(preview.warnings.length,2);
  d.ctx.mergeStudentProfiles_({sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:preview.revision,confirmTargetName:'김민수',confirmed:true,resolutions:[{examId:'exam1',keepToken:'tok_b1'}]});
  const moved=d.rows('Reports').find(r=>r[5]==='exam2');assert.equal(moved[7],'나고');assert.equal(moved[8],'김민수');
  assert.equal(d.ctx.makeIdentityDigest_('exam2','physics1-basic','나고','김민수'),moved[3]);
});

test('흡수 학생의 시험이 없더라도 학생 프로필·반 명단만 정상 병합',()=>{
  const d=bootstrapDataset(),sh=d.sheets.get('Reports');
  sh.cells=sh.cells.filter(r=>r[17]!=='stu_a');
  const preview=d.ctx.previewStudentMerge_('stu_a','stu_b');assert.equal(preview.sourceCount,0);assert.equal(preview.conflicts.length,0);
  const result=d.ctx.mergeStudentProfiles_({sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:preview.revision,confirmed:true,confirmTargetName:'홍길동',resolutions:[]});
  assert.equal(result.transferredReports,0);assert.equal(result.removedDuplicateReports,0);assert.equal(d.rows('Reports').length,2);assert.equal(result.classesTransferred,1);
});

test('같은 서버 토큰이 중복된 기록이 있으면 병합을 거절하고 원본을 보존',()=>{
  const d=bootstrapDataset();const target=d.sheets.get('Reports').cells[3];target[0]='tok_a1';
  const p=d.ctx.previewStudentMerge_('stu_a','stu_b');
  errorCode(()=>d.ctx.mergeStudentProfiles_({sourceStudentId:'stu_a',targetStudentId:'stu_b',previewRevision:p.revision,confirmed:true,confirmTargetName:'홍길동',resolutions:[{examId:'exam1',keepToken:'tok_a1'}]}),'STUDENT_MERGE_DUPLICATE_TOKEN');
  assert.equal(d.rows('Reports').length,4);
});
