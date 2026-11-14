import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const source=fs.readFileSync(new URL('../../apps-script/Code.gs', import.meta.url),'utf8');
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
  const ctx={console,Utilities,PropertiesService:{getScriptProperties(){return props}},SpreadsheetApp:{getActiveSpreadsheet(){return ss},openById(){return ss}},LockService:{getScriptLock(){return {tryLock(){return true},waitLock(){},releaseLock(){}}}}};
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

export { bootstrapDataset, STUDENT_HEADERS, REPORT_HEADERS, MEMBER_HEADERS };
