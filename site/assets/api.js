(function(){
 class WeeklyAPI{
  constructor(){this.refreshConfig()}
  refreshConfig(){this.apiUrl=localStorage.getItem(YP.config.apiUrlStorage)||YP.config.apiUrl||"";this.demo=!this.apiUrl;YP.config.apiUrl=this.apiUrl;YP.config.demoMode=this.demo}
  getWriteKey(){return localStorage.getItem(YP.config.writeKeyStorage)||""}
  setSettings(url,key){url=String(url||"").trim();if(url)localStorage.setItem(YP.config.apiUrlStorage,url);else localStorage.removeItem(YP.config.apiUrlStorage);if(key)localStorage.setItem(YP.config.writeKeyStorage,key);this.refreshConfig()}
  clearKey(){localStorage.removeItem(YP.config.writeKeyStorage)}
  async request(action,payload={},writeKey){this.refreshConfig();if(this.demo)return this.demoRequest(action,payload,writeKey);const body={action,...payload};if(writeKey!==undefined)body.writeKey=writeKey;const res=await fetch(this.apiUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body),redirect:"follow"}),text=await res.text();let data;try{data=JSON.parse(text)}catch(e){throw new Error("서버 응답이 JSON이 아닙니다. Apps Script 배포 URL과 권한을 확인하세요.")}if(!data.ok)throw new Error(data.error||"서버 요청 실패");return data}
  async getReport(token,fp){this.refreshConfig();if(this.demo)return this.demoRequest("getReport",{token,fp});const url=new URL(this.apiUrl);url.searchParams.set("action","getReport");url.searchParams.set("token",token);url.searchParams.set("fp",fp);const res=await fetch(url.toString(),{redirect:"follow"}),text=await res.text();let data;try{data=JSON.parse(text)}catch(e){throw new Error("성적표 서버 응답을 읽지 못했습니다.")}if(!data.ok)throw new Error(data.error||"성적표를 불러오지 못했습니다.");return data}
  ping(key){return this.request("ping",{},key)}
  listReports(filters={},key=this.getWriteKey()){return this.request("listReports",filters,key)}
  saveReport(record,key=this.getWriteKey()){return this.request("saveReport",{record},key)}
  saveBatch(records,key=this.getWriteKey()){return this.request("saveBatch",{records},key)}
  deleteReport(token,key=this.getWriteKey()){return this.request("deleteReport",{token},key)}
  syncCatalog(key=this.getWriteKey()){return this.request("syncCatalog",{catalog:YP.catalog},key)}
  getExamStats(examId){return this.request("getExamStats",{examId})}
  checkIntegrity(key=this.getWriteKey()){return this.request("checkIntegrity",{},key)}
  _demoKey(){return YP.config.cachePrefix+"demo_reports_v2"}
  _loadDemo(){let rows;try{rows=JSON.parse(localStorage.getItem(this._demoKey())||"null")}catch(e){}if(!Array.isArray(rows)){rows=JSON.parse(JSON.stringify(window.YP_DEMO_DATA?.reports||[]));localStorage.setItem(this._demoKey(),JSON.stringify(rows))}return rows}
  _saveDemo(rows){localStorage.setItem(this._demoKey(),JSON.stringify(rows))}
  _normalize(r){return YP.normalizeRecord(r)}
  async _fp(token,examId,school,name){const data=new TextEncoder().encode([token,examId,school,name,"youngs-demo-v2"].join("|"));if(crypto.subtle){const hash=await crypto.subtle.digest("SHA-256",data);return Array.from(new Uint8Array(hash)).slice(0,12).map(x=>x.toString(16).padStart(2,"0")).join("")}return btoa(String.fromCharCode(...data)).replace(/[^a-z0-9]/gi,"").slice(0,24)}
  _newToken(){return (crypto.randomUUID?crypto.randomUUID():"t-"+Date.now()+"-"+Math.random().toString(36).slice(2)).replace(/-/g,"")}
  async demoRequest(action,payload={}){
    let rows=this._loadDemo();
    if(action==="ping")return {ok:true,demo:true,message:"데모 저장소 연결 정상"};
    if(action==="syncCatalog")return {ok:true,demo:true,courses:YP.catalog.courses.length,exams:YP.catalog.exams.length,questions:YP.readyExams().reduce((a,e)=>a+(e.questions?.length||0),0)};
    if(action==="listReports"){const list=rows.map(r=>this._normalize(r)).filter(r=>(!payload.examId||r.examId===payload.examId)&&(!payload.courseId||r.courseId===payload.courseId));return {ok:true,reports:list.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))}}
    if(action==="saveReport"){
      const input=payload.record||{},exam=YP.getExam(input.examId);if(!exam||exam.status!=="ready")throw new Error("등록되지 않았거나 준비 중인 시험입니다.");const calc=YP.calculateResult(exam,input.resultInputs||[],input.partialModes||[]);if(!calc.valid)throw new Error("점수 입력 오류가 있습니다.");
      let existing=input.token?rows.find(r=>r.token===input.token):null,name=String(input.name||"").trim(),school=String(input.school||"").trim()||"미입력";if(!name)throw new Error("학생 이름을 입력하세요.");
      if(!existing){const base=name;let n=1,names=new Set(rows.filter(r=>r.examId===input.examId&&(r.school||"미입력")===school).map(r=>r.name));while(names.has(name)){n++;name=base+n}}
      const token=existing?.token||this._newToken(),fp=existing?.fingerprint||await this._fp(token,input.examId,school,name),now=new Date().toISOString(),studentKey=YP.studentKey(exam.courseId,school,name),row={...existing,...input,token,fingerprint:fp,name,school,studentKey,courseId:exam.courseId,createdAt:existing?.createdAt||now,updatedAt:now};
      if(existing)rows=rows.map(r=>r.token===token?row:r);else rows.push(row);this._saveDemo(rows);const record=this._normalize(row),same=rows.map(r=>this._normalize(r)).filter(r=>r.examId===exam.examId),stats=YP.computeStats(exam,same),historyRecords=YP.getLinkedHistory(exam,record,rows);return {ok:true,record,stats,historyRecords,token,fp,displayName:name};
    }
    if(action==="saveBatch"){const saved=[];for(const r of payload.records||[])saved.push((await this.demoRequest("saveReport",{record:r})).record);return {ok:true,saved}}
    if(action==="deleteReport"){const before=rows.length;rows=rows.filter(r=>r.token!==payload.token);this._saveDemo(rows);return {ok:true,deleted:before-rows.length}}
    if(action==="getReport"){
      const row=rows.find(r=>r.token===payload.token);if(!row)throw new Error("성적표 토큰을 찾을 수 없습니다.");if(row.fingerprint!==payload.fp)throw new Error("요청한 학생과 서버에서 불러온 학생 정보가 일치하지 않습니다. 교사에게 새 결과 링크를 요청해 주세요.");const record=this._normalize(row),exam=YP.getExam(record.examId),seeded=row.token.startsWith("demo-");if(!seeded){const recomputed=await this._fp(row.token,row.examId,row.school||"미입력",row.name);if(recomputed!==row.fingerprint)throw new Error("학생 지문 재검증에 실패했습니다.")}const same=rows.map(r=>this._normalize(r)).filter(r=>r.examId===record.examId),stats=YP.computeStats(exam,same),historyRecords=YP.getLinkedHistory(exam,record,rows);return {ok:true,record,stats,historyRecords,integrity:{tokenMatch:true,fingerprintMatch:true,identityMatch:true},demo:true};
    }
    if(action==="getExamStats"){const exam=YP.getExam(payload.examId),same=rows.map(r=>this._normalize(r)).filter(r=>r.examId===payload.examId);return {ok:true,stats:YP.computeStats(exam,same)}}
    if(action==="checkIntegrity")return {ok:true,checked:rows.length,issues:[]};
    throw new Error("지원하지 않는 데모 작업: "+action);
  }
 }
 window.YP_API=new WeeklyAPI();
})();
