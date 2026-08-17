(function(){
 class YPAPIError extends Error{
  constructor(message,code,data){super(message||"서버 요청 실패");this.name="YPAPIError";this.code=code||"SERVER_ERROR";this.data=data||null}
 }
 class WeeklyAPI{
  constructor(){this.refreshConfig();this.lastBootstrap=null}
  refreshConfig(){
   this.apiUrl=String(YP.config.apiUrl||"").trim();
   this.demo=!this.apiUrl;
   YP.config.apiUrl=this.apiUrl;YP.config.demoMode=this.demo;
  }
  deviceLabel(){return [navigator.platform||"",navigator.userAgent||""].join(" | ").slice(0,120)}
  getSession(){
   if(this.demo)return {token:"demo-session",expiresAt:"2999-12-31T00:00:00.000Z",role:"teacher"};
   let meta={};try{meta=JSON.parse(localStorage.getItem(YP.config.sessionMetaStorage)||"{}")||{}}catch(e){}
   const token=localStorage.getItem(YP.config.sessionStorage)||"";
   return {token,expiresAt:meta.expiresAt||"",role:meta.role||""};
  }
  setSession(data){
   if(!data?.sessionToken)return;
   localStorage.setItem(YP.config.sessionStorage,String(data.sessionToken));
   localStorage.setItem(YP.config.sessionMetaStorage,JSON.stringify({expiresAt:data.expiresAt||"",role:data.role||"teacher",savedAt:new Date().toISOString()}));
  }
  clearSession(){localStorage.removeItem(YP.config.sessionStorage);localStorage.removeItem(YP.config.sessionMetaStorage)}
  isAuthenticated(){
   if(this.demo)return true;
   const s=this.getSession();if(!s.token)return false;
   if(s.expiresAt&&Date.parse(s.expiresAt)<=Date.now()){this.clearSession();return false}
   return true;
  }
  sessionExpiry(){return this.getSession().expiresAt||""}
  async request(action,payload={},options={}){
   this.refreshConfig();
   if(this.demo)return this.demoRequest(action,payload,options);
   const body={action,...payload};
   if(options.auth){const token=this.getSession().token;if(token)body.sessionToken=token}
   const res=await fetch(this.apiUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body),redirect:"follow"});
   const text=await res.text();let data;
   try{data=JSON.parse(text)}catch(e){throw new YPAPIError("서버 응답이 JSON이 아닙니다. Apps Script가 웹 앱으로 배포되었고 /exec URL이 맞는지 확인하세요.","INVALID_RESPONSE",{status:res.status,text:text.slice(0,300)})}
   if(!data.ok){
    const code=data.code||"SERVER_ERROR";
    if(["AUTH_REQUIRED","AUTH_INVALID","AUTH_EXPIRED","AUTH_REVOKED"].includes(code))this.clearSession();
    throw new YPAPIError(data.error||"서버 요청 실패",code,data)
   }
   return data;
  }
  async getReport(token,fp){
   this.refreshConfig();if(this.demo)return this.demoRequest("getReport",{token,fp});
   const url=new URL(this.apiUrl);url.searchParams.set("action","getReport");url.searchParams.set("token",token);url.searchParams.set("fp",fp);
   const res=await fetch(url.toString(),{redirect:"follow"}),text=await res.text();let data;
   try{data=JSON.parse(text)}catch(e){throw new YPAPIError("성적표 서버 응답을 읽지 못했습니다.","INVALID_RESPONSE")}
   if(!data.ok)throw new YPAPIError(data.error||"성적표를 불러오지 못했습니다.",data.code||"SERVER_ERROR",data);return data
  }
  bootstrap(){return this.request("bootstrap").then(d=>(this.lastBootstrap=d,d))}
  ping(){return this.request("ping",{},this.isAuthenticated()?{auth:true}:{})}
  async login(pin){const d=await this.request("teacherLogin",{teacherPin:String(pin||""),deviceLabel:this.deviceLabel()});this.setSession(d);return d}
  async claimDevice(setupToken){const d=await this.request("claimDevice",{setupToken:String(setupToken||""),deviceLabel:this.deviceLabel()});this.setSession(d);return d}
  async sessionStatus(){const d=await this.request("sessionStatus",{sessionToken:this.getSession().token});return d}
  createDeviceSetupToken(){return this.request("createDeviceSetupToken",{},{auth:true})}
  listReports(filters={}){return this.request("listReports",filters,{auth:true})}
  saveReport(record){return this.request("saveReport",{record},{auth:true})}
  saveBatch(records){return this.request("saveBatch",{records},{auth:true})}
  deleteReport(token){return this.request("deleteReport",{token},{auth:true})}
  syncCatalog(){return this.request("syncCatalog",{catalog:YP.catalog},{auth:true})}
  getExamStats(examId){return this.request("getExamStats",{examId})}
  checkIntegrity(){return this.request("checkIntegrity",{},{auth:true})}
  _demoKey(){return YP.config.cachePrefix+"demo_reports_v2"}
  _loadDemo(){let rows;try{rows=JSON.parse(localStorage.getItem(this._demoKey())||"null")}catch(e){}if(!Array.isArray(rows)){rows=JSON.parse(JSON.stringify(window.YP_DEMO_DATA?.reports||[]));localStorage.setItem(this._demoKey(),JSON.stringify(rows))}return rows}
  _saveDemo(rows){localStorage.setItem(this._demoKey(),JSON.stringify(rows))}
  _normalize(r){return YP.normalizeRecord(r)}
  async _fp(token,examId,school,name){const data=new TextEncoder().encode([token,examId,school,name,"youngs-demo-v2"].join("|"));if(crypto.subtle){const hash=await crypto.subtle.digest("SHA-256",data);return Array.from(new Uint8Array(hash)).slice(0,12).map(x=>x.toString(16).padStart(2,"0")).join("")}return btoa(String.fromCharCode(...data)).replace(/[^a-z0-9]/gi,"").slice(0,24)}
  _newToken(){return (crypto.randomUUID?crypto.randomUUID():"t-"+Date.now()+"-"+Math.random().toString(36).slice(2)).replace(/-/g,"")}
  async demoRequest(action,payload={}){
    let rows=this._loadDemo();
    if(action==="bootstrap")return {ok:true,demo:true,apiVersion:"demo",authMode:"demo",teacherPinConfigured:true,sessionTtlDays:999};
    if(action==="teacherLogin"||action==="claimDevice")return {ok:true,demo:true,authenticated:true,sessionToken:"demo-session",expiresAt:"2999-12-31T00:00:00.000Z",role:"teacher"};
    if(action==="sessionStatus")return {ok:true,demo:true,authenticated:true,expiresAt:"2999-12-31T00:00:00.000Z",role:"teacher"};
    if(action==="createDeviceSetupToken")return {ok:true,demo:true,setupToken:"demo-setup-token",expiresAt:new Date(Date.now()+600000).toISOString(),oneTime:true};
    if(action==="ping")return {ok:true,demo:true,message:"데모 저장소 연결 정상"};
    if(action==="syncCatalog")return {ok:true,demo:true,courses:YP.catalog.courses.length,exams:YP.catalog.exams.length,questions:YP.readyExams().reduce((a,e)=>a+(e.questions?.length||0),0)};
    if(action==="listReports"){const list=rows.map(r=>this._normalize(r)).filter(r=>(!payload.examId||r.examId===payload.examId)&&(!payload.courseId||r.courseId===payload.courseId));return {ok:true,reports:list.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))}}
    if(action==="saveReport"){
      const input=payload.record||{},exam=YP.getExam(input.examId);if(!exam||exam.status!=="ready")throw new YPAPIError("등록되지 않았거나 준비 중인 시험입니다.","EXAM_NOT_READY");const calc=YP.calculateResult(exam,input.resultInputs||[],input.partialModes||[]);if(!calc.valid)throw new YPAPIError("점수 입력 오류가 있습니다.","INVALID_SCORE");
      let existing=input.token?rows.find(r=>r.token===input.token):null,name=String(input.name||"").trim(),school=YP.normalizeSchool(input.school);if(!name)throw new YPAPIError("학생 이름을 입력하세요.","NAME_REQUIRED");
      if(!existing&&input.importMode==="upsert"){const key=[input.examId,YP.normalizeIdentity(school),YP.normalizeIdentity(name)].join("|");existing=rows.find(r=>[r.examId,YP.normalizeIdentity(YP.normalizeSchool(r.school)),YP.normalizeIdentity(r.name)].join("|")===key)||null}
      const wasExisting=!!existing;
      if(!existing){const base=name;let n=1,names=new Set(rows.filter(r=>r.examId===input.examId&&YP.normalizeIdentity(YP.normalizeSchool(r.school))===YP.normalizeIdentity(school)).map(r=>r.name));while(names.has(name)){n++;name=base+n}}
      const token=existing?.token||this._newToken(),fp=existing?.fingerprint||await this._fp(token,input.examId,school,name),now=new Date().toISOString(),studentKey=YP.studentKey(exam.courseId,school,name),row={...existing,...input,token,fingerprint:fp,name,school,studentKey,courseId:exam.courseId,createdAt:existing?.createdAt||now,updatedAt:now};
      if(existing)rows=rows.map(r=>r.token===token?row:r);else rows.push(row);this._saveDemo(rows);const record=this._normalize(row),same=rows.map(r=>this._normalize(r)).filter(r=>r.examId===exam.examId),stats=YP.computeStats(exam,same),historyRecords=YP.getLinkedHistory(exam,record,rows);return {ok:true,record,stats,historyRecords,token,fp,displayName:name,created:!wasExisting,updated:wasExisting};
    }
    if(action==="saveBatch"){
      const saved=[],failed=[];let createdCount=0,updatedCount=0;
      for(const r of payload.records||[]){try{const d=await this.demoRequest("saveReport",{record:{...r,importMode:r.importMode||"upsert"}});saved.push(d.record);if(d.updated)updatedCount++;else createdCount++}catch(e){failed.push({name:r?.name||"",error:e.message})}}
      return {ok:true,saved,savedCount:saved.length,createdCount,updatedCount,failed};
    }
    if(action==="deleteReport"){const before=rows.length;rows=rows.filter(r=>r.token!==payload.token);this._saveDemo(rows);return {ok:true,deleted:before-rows.length}}
    if(action==="getReport"){
      const row=rows.find(r=>r.token===payload.token);if(!row)throw new YPAPIError("성적표 토큰을 찾을 수 없습니다.","REPORT_NOT_FOUND");if(row.fingerprint!==payload.fp)throw new YPAPIError("요청한 학생과 서버에서 불러온 학생 정보가 일치하지 않습니다. 교사에게 새 결과 링크를 요청해 주세요.","FINGERPRINT_MISMATCH");const record=this._normalize(row),exam=YP.getExam(record.examId),seeded=row.token.startsWith("demo-");if(!seeded){const recomputed=await this._fp(row.token,row.examId,row.school||"미기입",row.name);if(recomputed!==row.fingerprint)throw new YPAPIError("학생 지문 재검증에 실패했습니다.","FINGERPRINT_MISMATCH")}const same=rows.map(r=>this._normalize(r)).filter(r=>r.examId===record.examId),stats=YP.computeStats(exam,same),historyRecords=YP.getLinkedHistory(exam,record,rows);return {ok:true,record,stats,historyRecords,integrity:{tokenMatch:true,fingerprintMatch:true,identityMatch:true},demo:true};
    }
    if(action==="getExamStats"){const exam=YP.getExam(payload.examId),same=rows.map(r=>this._normalize(r)).filter(r=>r.examId===payload.examId);return {ok:true,stats:YP.computeStats(exam,same)}}
    if(action==="checkIntegrity")return {ok:true,checked:rows.length,issues:[]};
    throw new YPAPIError("지원하지 않는 데모 작업: "+action,"UNSUPPORTED_ACTION");
  }
 }
 window.YPAPIError=YPAPIError;
 window.YP_API=new WeeklyAPI();
})();
