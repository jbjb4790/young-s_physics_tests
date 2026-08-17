(function(){
 class YPAPIError extends Error{
  constructor(message,code,data){super(message||"서버 요청 실패");this.name="YPAPIError";this.code=code||"SERVER_ERROR";this.data=data||null}
 }
 class WeeklyAPI{
  constructor(){
   this.apiUrl="";this.demo=true;this.lastBootstrap=null;this.serverInstanceId="";
   this.bridgeFrame=null;this.bridgeReadyPromise=null;this.bridgeReady=false;
   this.bridgeChannel="";this.bridgeSeq=0;this.bridgePending=new Map();
   this.bridgeMessageHandler=e=>this._handleBridgeMessage(e);
   window.addEventListener("message",this.bridgeMessageHandler);
   this.refreshConfig();
  }
  refreshConfig(){
   const next=String(YP.config.apiUrl||"").trim();
   if(this.apiUrl&&this.apiUrl!==next)this._destroyBridge("API URL changed");
   this.apiUrl=next;this.demo=!this.apiUrl;
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
  _newBridgeChannel(){
   const raw=crypto.randomUUID?crypto.randomUUID()+crypto.randomUUID():Date.now()+"-"+Math.random()+"-"+Math.random();
   return String(raw).replace(/[^A-Za-z0-9_-]/g,"").slice(0,96).padEnd(24,"0");
  }
  _destroyBridge(reason){
   if(this.bridgeFrame?.parentNode)this.bridgeFrame.parentNode.removeChild(this.bridgeFrame);
   this.bridgeFrame=null;this.bridgeReady=false;this.bridgeReadyPromise=null;this.bridgeChannel="";
   for(const [id,p] of this.bridgePending){clearTimeout(p.timer);p.reject(new YPAPIError("Apps Script 통신 브리지가 초기화되었습니다.","BRIDGE_RESET",{id,reason}))}
   this.bridgePending.clear();
  }
  _bridgeParentOrigin(){
   const origin=String(location.origin||"").replace(/\/$/,"");
   if(!origin||origin==="null")throw new YPAPIError("GitHub Pages 주소에서 사이트를 열어야 Apps Script 자동 연결을 사용할 수 있습니다.","BRIDGE_ORIGIN_INVALID",{origin});
   return origin;
  }
  _handleBridgeMessage(event){
   if(!this.bridgeFrame||event.source!==this.bridgeFrame.contentWindow)return;
   const message=event.data||{};
   if(message.channel!==this.bridgeChannel)return;
   if(message.type==="YP_API_BRIDGE_READY"){
    this.bridgeReady=true;
    if(this._bridgeReadyResolve)this._bridgeReadyResolve(message);
    return;
   }
   if(message.type!=="YP_API_BRIDGE_RESPONSE"||!message.id)return;
   const pending=this.bridgePending.get(String(message.id));if(!pending)return;
   this.bridgePending.delete(String(message.id));clearTimeout(pending.timer);
   try{pending.resolve(this._validateApiData(message.result,pending.action))}catch(e){pending.reject(e)}
  }
  _validateApiData(data,context){
   if(!data||typeof data!=="object")throw new YPAPIError("Apps Script 브리지 응답 형식이 올바르지 않습니다.","INVALID_RESPONSE",{context,data});
   if(data.serverInstanceId)this.serverInstanceId=String(data.serverInstanceId);
   if(!data.ok){
    const code=data.code||"SERVER_ERROR";
    if(["AUTH_REQUIRED","AUTH_INVALID","AUTH_EXPIRED","AUTH_REVOKED"].includes(code))this.clearSession();
    throw new YPAPIError(data.error||"서버 요청 실패",code,data.data||data)
   }
   return data;
  }
  async _fetchWithTimeout(url,init={},timeoutMs=15000){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
   try{return await fetch(url,{...init,signal:controller.signal})}
   catch(e){if(e&&e.name==="AbortError")throw new YPAPIError("Apps Script 서버 응답 시간이 초과되었습니다.","FETCH_TIMEOUT",{url:String(url)});throw e}
   finally{clearTimeout(timer)}
  }
  _looksLikeLogin(res,text){
   const finalUrl=String(res?.url||"");
   return /accounts\.google\.com|ServiceLogin|signin/i.test(finalUrl)||/<title>\s*(Sign in|로그인)/i.test(String(text||""))||/accounts\.google\.com\/ServiceLogin/i.test(String(text||""));
  }
  async _probePublicGet(){
   try{
    const url=new URL(this.apiUrl);url.searchParams.set("action","ping");url.searchParams.set("_",String(Date.now()));
    const res=await this._fetchWithTimeout(url.toString(),{method:"GET",redirect:"follow",credentials:"omit",cache:"no-store",referrerPolicy:"no-referrer"},12000);
    const text=await res.text(),loginRequired=this._looksLikeLogin(res,text);let json=null;try{json=JSON.parse(text)}catch(e){}
    return {reachable:true,status:res.status,url:res.url,loginRequired,json,text:text.slice(0,240)}
   }catch(e){return {reachable:false,error:String(e&&e.message||e),code:String(e&&e.code||"")}}
  }
  async _bridgeDiagnostic(action,cause){
   const probe=await this._probePublicGet();
   if(probe.loginRequired){
    throw new YPAPIError("PIN 확인 전에 Apps Script 웹 앱 접근이 차단되었습니다. 배포를 ‘실행 사용자: 나’, ‘액세스 권한: 로그인 없이 모든 사용자’로 새 버전 배포하세요.","DEPLOYMENT_ACCESS",{action,cause,probe,apiUrl:this.apiUrl});
   }
   if(probe.reachable&&probe.json?.ok){
    throw new YPAPIError("Apps Script GET 연결은 정상이나 통신 브리지를 열지 못했습니다. Code.gs를 v3.2.3으로 교체하고 새 버전 배포했는지 확인한 뒤 브라우저를 강력 새로고침하세요.","BRIDGE_NOT_DEPLOYED",{action,cause,probe,apiUrl:this.apiUrl});
   }
   throw new YPAPIError("Apps Script 서버에 연결하지 못했습니다. GitHub의 YP_API_URL이 최신 /exec 주소인지, 웹 앱이 익명 접근으로 배포되었는지 확인하세요.","FETCH_FAILED",{action,cause,probe,apiUrl:this.apiUrl});
  }
  async _ensureBridge(){
   this.refreshConfig();
   if(this.demo)return null;
   if(this.bridgeReady&&this.bridgeFrame)return {ready:true};
   if(this.bridgeReadyPromise)return this.bridgeReadyPromise;
   const parentOrigin=this._bridgeParentOrigin();
   this.bridgeChannel=this._newBridgeChannel();
   const src=new URL(this.apiUrl);src.searchParams.set("action","bridge");src.searchParams.set("origin",parentOrigin);src.searchParams.set("channel",this.bridgeChannel);src.searchParams.set("v",String(YP.config.buildVersion||Date.now()));
   const frame=document.createElement("iframe");
   frame.setAttribute("aria-hidden","true");frame.tabIndex=-1;frame.title="Young's Physics Apps Script bridge";
   frame.style.cssText="position:fixed!important;width:1px!important;height:1px!important;left:-10000px!important;top:-10000px!important;border:0!important;opacity:0!important;pointer-events:none!important";
   this.bridgeFrame=frame;
   this.bridgeReadyPromise=new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{
     if(settled)return;settled=true;this._bridgeReadyResolve=null;
     reject(new YPAPIError("Apps Script 통신 브리지 준비 시간이 초과되었습니다.","BRIDGE_LOAD_TIMEOUT",{src:src.toString()}));
    },20000);
    this._bridgeReadyResolve=message=>{if(settled)return;settled=true;clearTimeout(timer);this._bridgeReadyResolve=null;resolve(message)};
    frame.onerror=()=>{if(settled)return;settled=true;clearTimeout(timer);this._bridgeReadyResolve=null;reject(new YPAPIError("Apps Script 통신 브리지 페이지를 불러오지 못했습니다.","BRIDGE_LOAD_FAILED",{src:src.toString()}))};
   });
   frame.src=src.toString();document.body.appendChild(frame);
   try{return await this.bridgeReadyPromise}catch(e){this._destroyBridge("bridge-load-failed");throw e}
  }
  async _bridgeRequest(action,body){
   try{await this._ensureBridge()}catch(e){return this._bridgeDiagnostic(action,{code:e.code||"",message:e.message||String(e)})}
   const id=`yp-${Date.now()}-${++this.bridgeSeq}`,timeoutMs=action==="saveBatch"?330000:action==="syncCatalog"?120000:60000;
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{
     this.bridgePending.delete(id);
     reject(new YPAPIError("Apps Script 작업 응답이 지연되고 있습니다. 저장 작업이었다면 Google Sheets를 먼저 확인한 뒤 중복 실행하지 마세요.","BRIDGE_RESPONSE_TIMEOUT",{action,id,timeoutMs}));
    },timeoutMs);
    this.bridgePending.set(id,{resolve,reject,timer,action});
    try{this.bridgeFrame.contentWindow.postMessage({type:"YP_API_BRIDGE_REQUEST",channel:this.bridgeChannel,id,body},"*")}
    catch(e){clearTimeout(timer);this.bridgePending.delete(id);reject(new YPAPIError("Apps Script 통신 브리지로 요청을 보내지 못했습니다.","BRIDGE_SEND_FAILED",{action,message:String(e&&e.message||e)}))}
   });
  }
  async request(action,payload={},options={}){
   this.refreshConfig();
   if(this.demo)return this.demoRequest(action,payload,options);
   const body={action,...payload};
   if(options.auth){const token=this.getSession().token;if(token)body.sessionToken=token}
   return this._bridgeRequest(action,body);
  }
  async getReport(token,fp){return this.request("getReport",{token,fp})}
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
    if(action==="bootstrap")return {ok:true,demo:true,apiVersion:"demo",serverInstanceId:"demo-local",authMode:"demo",teacherPinConfigured:true,sessionTtlDays:999};
    if(action==="teacherLogin"||action==="claimDevice")return {ok:true,demo:true,authenticated:true,sessionToken:"demo-session",expiresAt:"2999-12-31T00:00:00.000Z",role:"teacher"};
    if(action==="sessionStatus")return {ok:true,demo:true,authenticated:true,expiresAt:"2999-12-31T00:00:00.000Z",role:"teacher"};
    if(action==="createDeviceSetupToken")return {ok:true,demo:true,setupToken:"demo-setup-token",expiresAt:new Date(Date.now()+600000).toISOString(),oneTime:true};
    if(action==="ping")return {ok:true,demo:true,message:"데모 저장소 연결 정상",serverInstanceId:"demo-local"};
    if(action==="syncCatalog")return {ok:true,demo:true,courses:YP.catalog.courses.length,exams:YP.catalog.exams.length,questions:YP.readyExams().reduce((a,e)=>a+(e.questions?.length||0),0)};
    if(action==="listReports"){const list=rows.map(r=>this._normalize(r)).filter(r=>(!payload.examId||r.examId===payload.examId)&&(!payload.courseId||r.courseId===payload.courseId));return {ok:true,reports:list.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))),serverInstanceId:"demo-local"}}
    if(action==="saveReport"){
      const input=payload.record||{},exam=YP.getExam(input.examId);if(!exam||exam.status!=="ready")throw new YPAPIError("등록되지 않았거나 준비 중인 시험입니다.","EXAM_NOT_READY");const calc=YP.calculateResult(exam,input.resultInputs||[],input.partialModes||[]);if(!calc.valid)throw new YPAPIError("점수 입력 오류가 있습니다.","INVALID_SCORE");
      let existing=input.token?rows.find(r=>r.token===input.token):null,name=String(input.name||"").trim(),school=YP.normalizeSchool(input.school);if(!name)throw new YPAPIError("학생 이름을 입력하세요.","NAME_REQUIRED");
      if(!existing&&input.importMode==="upsert"){const key=[input.examId,YP.normalizeIdentity(school),YP.normalizeIdentity(name)].join("|");existing=rows.find(r=>[r.examId,YP.normalizeIdentity(YP.normalizeSchool(r.school)),YP.normalizeIdentity(r.name)].join("|")===key)||null}
      const wasExisting=!!existing;
      if(!existing){const base=name;let n=1,names=new Set(rows.filter(r=>r.examId===input.examId&&YP.normalizeIdentity(YP.normalizeSchool(r.school))===YP.normalizeIdentity(school)).map(r=>r.name));while(names.has(name)){n++;name=base+n}}
      const token=existing?.token||this._newToken(),fp=existing?.fingerprint||await this._fp(token,input.examId,school,name),now=new Date().toISOString(),studentKey=YP.studentKey(exam.courseId,school,name),row={...existing,...input,token,fingerprint:fp,name,school,studentKey,courseId:exam.courseId,createdAt:existing?.createdAt||now,updatedAt:now};
      if(existing)rows=rows.map(r=>r.token===token?row:r);else rows.push(row);this._saveDemo(rows);const record=this._normalize(row),same=rows.map(r=>this._normalize(r)).filter(r=>r.examId===exam.examId),stats=YP.computeStats(exam,same),historyRecords=YP.getLinkedHistory(exam,record,rows);return {ok:true,record,stats,historyRecords,token,fp,displayName:name,created:!wasExisting,updated:wasExisting,serverInstanceId:"demo-local"};
    }
    if(action==="saveBatch"){
      const saved=[],failed=[];let createdCount=0,updatedCount=0;
      for(const r of payload.records||[]){try{const d=await this.demoRequest("saveReport",{record:{...r,importMode:r.importMode||"upsert"}});saved.push(d.record);if(d.updated)updatedCount++;else createdCount++}catch(e){failed.push({name:r?.name||"",error:e.message})}}
      return {ok:true,saved,savedCount:saved.length,createdCount,updatedCount,failed,serverInstanceId:"demo-local"};
    }
    if(action==="deleteReport"){const before=rows.length;rows=rows.filter(r=>r.token!==payload.token);this._saveDemo(rows);return {ok:true,deleted:before-rows.length}}
    if(action==="getReport"){
      const row=rows.find(r=>r.token===payload.token);if(!row)throw new YPAPIError("성적표 토큰을 찾을 수 없습니다.","REPORT_NOT_FOUND");if(row.fingerprint!==payload.fp)throw new YPAPIError("요청한 학생과 서버에서 불러온 학생 정보가 일치하지 않습니다. 교사에게 새 결과 링크를 요청해 주세요.","FINGERPRINT_MISMATCH");const record=this._normalize(row),exam=YP.getExam(record.examId),seeded=row.token.startsWith("demo-");if(!seeded){const recomputed=await this._fp(row.token,row.examId,row.school||"미기입",row.name);if(recomputed!==row.fingerprint)throw new YPAPIError("학생 지문 재검증에 실패했습니다.","FINGERPRINT_MISMATCH")}const same=rows.map(r=>this._normalize(r)).filter(r=>r.examId===record.examId),stats=YP.computeStats(exam,same),historyRecords=YP.getLinkedHistory(exam,record,rows);return {ok:true,record,stats,historyRecords,serverInstanceId:"demo-local",integrity:{tokenMatch:true,fingerprintMatch:true,identityMatch:true},demo:true};
    }
    if(action==="getExamStats"){const exam=YP.getExam(payload.examId),same=rows.map(r=>this._normalize(r)).filter(r=>r.examId===payload.examId);return {ok:true,stats:YP.computeStats(exam,same)}}
    if(action==="checkIntegrity")return {ok:true,checked:rows.length,issues:[]};
    throw new YPAPIError("지원하지 않는 데모 작업: "+action,"UNSUPPORTED_ACTION");
  }
 }
 window.YPAPIError=YPAPIError;
 window.YP_API=new WeeklyAPI();
})();
