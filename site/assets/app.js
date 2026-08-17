(function(){
 const state={exam:null,inputs:[],partialModes:[],editToken:null,batchRows:[],batchMeta:null,reports:[],serverInstanceId:""};
 const $=id=>document.getElementById(id);
 const AUTH_ERROR_CODES=new Set(["AUTH_REQUIRED","AUTH_INVALID","AUTH_EXPIRED","AUTH_REVOKED"]);
 function showDemo(){$("demoBanner").classList.toggle("hidden",!YP_API.demo)}
 function isAuthError(e){return AUTH_ERROR_CODES.has(String(e&&e.code||""))}
 function catalogVersion(){return [YP.catalog.schemaVersion||"",YP.catalog.generatedAt||"",YP.catalog.exams.length,YP.readyExams().reduce((a,e)=>a+(e.questions?.length||0),0)].join("|")}
 function formatExpiry(iso){if(!iso)return "";const d=new Date(iso);return isNaN(d)?"":d.toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
 function updateConnectionUI(){
   const btn=$("settingsBtn"),txt=$("settingsBtnText");if(!btn||!txt)return;
   btn.classList.remove("connection-online","connection-offline","connection-demo");
   if(YP_API.demo){txt.textContent="서버 자동 연결 미설정";btn.classList.add("connection-demo")}
   else if(YP_API.isAuthenticated()){txt.textContent="교사 연결됨";btn.classList.add("connection-online")}
   else{txt.textContent="교사 인증";btn.classList.add("connection-offline")}
 }
 function setAuthModalState(message){
   const authenticated=!YP_API.demo&&YP_API.isAuthenticated();
   $("loginPanel").classList.toggle("hidden",authenticated||YP_API.demo);
   $("authenticatedPanel").classList.toggle("hidden",!authenticated);
   const icon=$("connectionStateIcon"),title=$("connectionStateTitle"),desc=$("connectionStateDescription");
   if(YP_API.demo){icon.textContent="!";title.textContent="Apps Script 자동 연결 주소가 없습니다.";desc.textContent="GitHub 저장소 변수 YP_API_URL에 /exec 주소를 등록한 뒤 Pages를 다시 배포하세요."}
   else if(authenticated){icon.textContent="✓";title.textContent="Google Sheets 교사 연결 완료";desc.textContent="이 컴퓨터에서 바로 학생 성적을 저장하고 다른 컴퓨터와 동기화할 수 있습니다.";const exp=formatExpiry(YP_API.sessionExpiry());$("sessionExpiryText").textContent=exp?`교사 세션 만료 예정: ${exp}`:"이 브라우저에서 학생 점수 입력과 Google Sheets 저장을 사용할 수 있습니다."}
   else{icon.textContent="🔐";title.textContent="Apps Script 서버는 자동 연결되었습니다.";desc.textContent="교사 PIN을 한 번 입력하면 이 컴퓨터에서 바로 학생 성적을 입력할 수 있습니다."}
   if(message)$("settingsStatus").textContent=message;
   updateConnectionUI();
 }
 function getSetupTokenFromHash(){try{return new URLSearchParams(location.hash.replace(/^#/,"")).get("teacher-setup")||""}catch(e){return ""}}
 function clearSetupTokenHash(){if(getSetupTokenFromHash())history.replaceState(null,"",location.pathname+location.search)}
 async function autoSyncCatalog(force=false){
   if(YP_API.demo||!YP_API.isAuthenticated())return null;
   const v=catalogVersion();if(!force&&localStorage.getItem(YP.config.catalogSyncStorage)===v)return null;
   const d=await YP_API.syncCatalog();localStorage.setItem(YP.config.catalogSyncStorage,v);return d;
 }
 async function initializeServerConnection(){
   showDemo();updateConnectionUI();
   if(YP_API.demo){setAuthModalState();await refreshReports();return}
   try{
     const boot=await YP_API.bootstrap();
     const setupToken=getSetupTokenFromHash();
     if(setupToken){
       $("settingsStatus").textContent="새 컴퓨터 자동 연결 중...";
       await YP_API.claimDevice(setupToken);clearSetupTokenHash();YP.toast("이 컴퓨터가 교사용으로 자동 연결되었습니다.",5000);
     }
     if(YP_API.isAuthenticated()){try{await YP_API.sessionStatus()}catch(e){if(!isAuthError(e))throw e}}
     updateConnectionUI();setAuthModalState();
     if(YP_API.isAuthenticated()){await autoSyncCatalog(false);await refreshReports()}
     else{await refreshReports();setTimeout(openSettings,350)}
     if(!boot.teacherPinConfigured){openSettings();$("settingsStatus").textContent="Apps Script에서 installYoungsPhysics()를 실행해 교사 PIN을 먼저 생성하세요."}
   }catch(e){
     updateConnectionUI();setAuthModalState(e.message);$("reportsBody").innerHTML=`<tr><td colspan="6">Apps Script 자동 연결 실패: ${YP.escapeHTML(e.message)}</td></tr>`;setTimeout(openSettings,350)
   }
 }
 function handleAuthFailure(e){if(isAuthError(e)){YP_API.clearSession();updateConnectionUI();setAuthModalState(e.message);openSettings();return true}return false}
 function initCourses(){
   $("courseSelect").innerHTML=YP.catalog.courses.filter(c=>c.active).map(c=>`<option value="${c.courseId}">${YP.escapeHTML(c.courseName)}</option>`).join("");
   $("courseSelect").value="physics1-basic";renderExamOptions();
 }
 function renderExamOptions(){
   const cid=$("courseSelect").value,list=YP.catalog.exams.filter(e=>e.courseId===cid);
   const weekly=list.filter(e=>!YP.isComprehensive(e)).sort((a,b)=>a.round-b.round),totals=list.filter(YP.isComprehensive).sort((a,b)=>(a.displayOrder||0)-(b.displayOrder||0));
   const opts=(title,arr)=>arr.length?`<optgroup label="${title}">${arr.map(e=>`<option value="${e.examId}" ${e.status!=="ready"?"disabled":""}>${YP.escapeHTML(YP.isComprehensive(e)?e.shortTitle:`${e.round}회 복습 테스트`)}${e.status==="ready"?"":" · 준비 중"}</option>`).join("")}</optgroup>`:"";
   $("examSelect").innerHTML=opts("주간 복습 테스트",weekly)+opts("파트 종료 총괄평가",totals);
   const preferred=totals.find(e=>e.status==="ready")||weekly.find(e=>e.status==="ready");if(preferred)$("examSelect").value=preferred.examId;loadExam();
 }
 function resetBatchPreview(clearFile=true){
   state.batchRows=[];state.batchMeta=null;
   const preview=$("csvPreview"),summary=$("batchImportSummary"),button=$("saveBatchBtn"),file=$("csvFile");
   if(preview){preview.classList.add("hidden");preview.innerHTML=""}
   if(summary){summary.classList.add("hidden");summary.innerHTML=""}
   if(button){button.classList.add("hidden");button.disabled=false;button.textContent="검증된 학생 기록 일괄 저장"}
   if(clearFile&&file)file.value="";
 }
 function loadExam(){
   state.exam=YP.getExam($("examSelect").value);state.inputs=Array(state.exam?.questionCount||0).fill("");state.partialModes=Array(state.exam?.questionCount||0).fill(false);state.editToken=null;
   resetBatchPreview();renderExamNotice();renderQuestions();updateScore();$("cancelEditBtn").classList.add("hidden");
 }
 function renderExamNotice(){
   const e=state.exam;if(!e)return;
   const badge=`<span class="badge ${e.reviewStatus}">${YP.reviewLabel(e.reviewStatus)}</span>`;
   let note=`${badge} <b>${YP.escapeHTML(e.title)}</b> · ${e.questionCount}문항 · ${e.maxScore}점`;
   if(e.pdf)note+=` · <a href="${e.pdf}" target="_blank">원문 시험지</a>`;
   if(e.solutionPdf)note+=` · <a href="${e.solutionPdf}" target="_blank">검수 기준 해설지</a>`;
   if(YP.isComprehensive(e))note+=`<br><b>입력:</b> 1~20번 정오표(0=틀림, 1=맞음) · 21~25번 실제 서술형 점수(0~4점)<br><b>통합 분석:</b> ${YP.escapeHTML(e.historyLabel)}와 같은 학교·이름의 학생 기록을 자동 연결합니다.`;
   else note+=`<br>0=오답, 1=문항 만점, 그 밖의 숫자=부분점수, P1=정확히 1점`;
   if(e.sourceNote)note+=`<br>${YP.escapeHTML(e.sourceNote)}`;
   const issues=(e.questions||[]).filter(q=>["needs-review","ambiguous"].includes(q.reviewStatus)).map(q=>q.no);if(issues.length)note+=`<br><b>자동 공개 보류:</b> ${issues.join(", ")}번`;
   $("examNotice").innerHTML=note;
   if($("stickyExamName"))$("stickyExamName").textContent=YP.roundLabel(e);
   $("pasteValues").placeholder=YP.isComprehensive(e)?"예: 1\t1\t0\t... (20개) \t4\t3\t2\t4\t1":"예: 1\t1\t0\t2.5\tP1\t1";
 }
 function qInputHTML(q,i){
   if((q.inputMode||"achievement")==="binary")return `<div class="binary-control"><button type="button" class="binary-btn correct" data-i="${i}" data-v="1">O · 맞음</button><button type="button" class="binary-btn wrong" data-i="${i}" data-v="0">X · 틀림</button><input class="score-input compact" id="qInput${i}" data-i="${i}" inputmode="numeric" autocomplete="off" placeholder="0 / 1" maxlength="1"></div>`;
   if(q.inputMode==="points")return `<div class="score-row"><input class="score-input" id="qInput${i}" data-i="${i}" type="number" min="0" max="${q.maxPoints}" step="0.5" inputmode="decimal" autocomplete="off" placeholder="0~${q.maxPoints}점"><div class="score-result ungraded" id="qResult${i}">미입력</div></div><div class="quick-points">${[0,1,2,3,4].filter(v=>v<=q.maxPoints).map(v=>`<button type="button" data-point-i="${i}" data-v="${v}">${v}점</button>`).join("")}</div>`;
   return `<div class="score-row"><input class="score-input" id="qInput${i}" data-i="${i}" inputmode="decimal" autocomplete="off" placeholder="0 / 1 / 부분점수"><div class="score-result ungraded" id="qResult${i}">미입력</div></div>${q.maxPoints>1?`<label class="partial-toggle"><input type="checkbox" id="partial${i}" data-i="${i}"> '1'을 만점이 아닌 1점 부분점수로 처리</label>`:""}`;
 }
 function renderQuestions(){
   const e=state.exam;if(!e){$("questionGrid").innerHTML="";return}
   $("questionGrid").classList.toggle("total-grid",YP.isComprehensive(e));
   $("questionGrid").innerHTML=e.questions.map((q,i)=>`<div class="question-input-card ungraded ${q.inputMode||"achievement"}" id="qCard${i}"><div class="q-head"><div><div class="q-title">${q.no}번</div><div class="q-meta">${q.no<=20&&YP.isComprehensive(e)?"객관식 정오":"서술형 점수"} · ${q.maxPoints}점 · ${YP.escapeHTML(q.unit)}</div></div><span class="badge ${q.reviewStatus}">${YP.reviewLabel(q.reviewStatus)}</span></div>${qInputHTML(q,i)}${q.inputMode==="binary"?`<div class="score-result ungraded binary-result" id="qResult${i}">미입력</div>`:""}</div>`).join("");
   e.questions.forEach((q,i)=>{
     const inp=$(`qInput${i}`);inp.addEventListener("input",()=>{state.inputs[i]=inp.value;updateQuestion(i);updateScore()});
     inp.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key==="ArrowDown"){ev.preventDefault();$(`qInput${Math.min(i+1,e.questions.length-1)}`)?.focus()}if(ev.key==="ArrowUp"){ev.preventDefault();$(`qInput${Math.max(i-1,0)}`)?.focus()}if(ev.key==="Backspace"&&!inp.value&&i>0){ev.preventDefault();$(`qInput${i-1}`)?.focus()}});
     const cb=$(`partial${i}`);if(cb)cb.addEventListener("change",()=>{state.partialModes[i]=cb.checked;updateQuestion(i);updateScore()});
   });
   document.querySelectorAll(".binary-btn").forEach(b=>b.onclick=()=>setValue(Number(b.dataset.i),b.dataset.v));
   document.querySelectorAll("button[data-point-i]").forEach(b=>b.onclick=()=>setValue(Number(b.dataset.pointI),b.dataset.v));
 }
 function setValue(i,v){state.inputs[i]=String(v);$(`qInput${i}`).value=String(v);updateQuestion(i);updateScore();$(`qInput${Math.min(i+1,state.exam.questions.length-1)}`)?.focus()}
 function updateQuestion(i){
   const q=state.exam.questions[i],p=YP.parseQuestionInput(state.inputs[i],q,state.partialModes[i]),card=$(`qCard${i}`),res=$(`qResult${i}`);
   card.className=`question-input-card ${q.inputMode||"achievement"} ${p.status}`;res.className=`score-result ${q.inputMode==="binary"?"binary-result ":""}${p.status}`;res.textContent=p.valid?(p.status==="full"?`${p.score}/${q.maxPoints}`:p.status==="partial"?`${YP.formatNumber(p.score)}/${q.maxPoints}`:YP.statusLabel(p.status)):"입력 오류";res.title=p.message;
   card.querySelectorAll(".binary-btn").forEach(b=>b.classList.toggle("selected",String(b.dataset.v)===String(state.inputs[i]).trim()));
 }
 function updateScore(){
   if(!state.exam)return;const r=YP.calculateResult(state.exam,state.inputs,state.partialModes);$("scoreValue").textContent=`${YP.formatNumber(r.score)} / ${state.exam.maxScore}`;$("scorePercent").textContent=`${r.percent.toFixed(1)}%`;$("scoreProgress").style.width=`${Math.min(100,r.percent)}%`;if($("scoreRing"))$("scoreRing").style.setProperty("--score-angle",`${Math.min(100,Math.max(0,r.percent))*3.6}deg`);["full","partial","wrong","ungraded"].forEach(k=>$(`${k}Count`).textContent=r.counts[k]||0);$("completionText").textContent=`${state.exam.questionCount-r.counts.ungraded} / ${state.exam.questionCount} 문항 입력${r.counts.invalid?` · 오류 ${r.counts.invalid}`:""}`;return r;
 }
 function applyPaste(){const vals=YP.parseDelimited($("pasteValues").value),n=state.exam.questionCount;for(let i=0;i<n;i++){state.inputs[i]=vals[i]??"";$(`qInput${i}`).value=state.inputs[i];updateQuestion(i)}updateScore();$("pasteMessage").textContent=vals.length===n?`${n}개 값을 적용했습니다.`:`${vals.length}개 값을 읽었습니다. ${vals.length<n?"뒤쪽은 미입력으로 유지":"초과 값은 적용하지 않음"}했습니다.`}
 function fillSample(){state.exam.questions.forEach((q,i)=>{let v;if(q.inputMode==="binary")v=i%6===2||i%9===5?"0":"1";else if(q.inputMode==="points")v=[4,3,2,4,1][i-20]??"3";else v=i%5===2?"0":i%4===1?(q.maxPoints>2?String(Math.max(2,Math.round(q.maxPoints*.6))):"P1"):"1";state.inputs[i]=v;$(`qInput${i}`).value=v;updateQuestion(i)});updateScore();$("studentName").value="김물리";$("school").value="영스고";$("grade").value="2";YP.toast("예시 입력을 채웠습니다.")}
 function clearAll(){if(!confirm("현재 입력을 모두 지울까요?"))return;state.inputs.fill("");state.partialModes.fill(false);state.editToken=null;state.exam.questions.forEach((q,i)=>{$(`qInput${i}`).value="";if($(`partial${i}`))$(`partial${i}`).checked=false;updateQuestion(i)});updateScore();$("cancelEditBtn").classList.add("hidden")}
 function makeRecord(extra={}){const school=YP.normalizeSchool($("school").value),name=$("studentName").value.trim();return {token:state.editToken||undefined,examId:state.exam.examId,courseId:state.exam.courseId,school,name,studentKey:YP.studentKey(state.exam.courseId,school,name),grade:$("grade").value,classNo:$("classNo").value.trim(),teacherMemo:$("teacherMemo").value.trim(),resultInputs:[...state.inputs],partialModes:[...state.partialModes],...extra}}
 function reportURL(token,fp,serverInstanceId=state.serverInstanceId){
   const u=new URL(YP.config.reportPage,location.href),params=new URLSearchParams();
   params.set("id",String(token||""));params.set("fp",String(fp||""));
   const api=String(YP_API.apiUrl||YP.config.apiUrl||"").trim();
   if(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(api))params.set("api",api);
   if(serverInstanceId)params.set("sid",String(serverInstanceId));
   u.hash=params.toString();return u.toString();
 }
 function showLinkModal(data,url){const back=document.createElement("div");back.className="modal-backdrop";back.innerHTML=`<div class="modal"><div class="modal-success">✓</div><h2>저장·통합 성적표 생성 완료</h2><p><b>${YP.escapeHTML(data.record.name)}</b> · ${YP.escapeHTML(YP.roundLabel(YP.getExam(data.record.examId)))} · ${YP.formatNumber(data.record.score)} / ${data.record.maxScore}점</p><div class="field"><label>학부모 전달용 학생 결과 링크</label><input id="generatedLink" readonly value="${YP.escapeHTML(url)}"></div><div class="notice">Google Sheets 저장, 통계 재계산, 기존 복습 테스트 연결, 성적표 생성과 링크 복사가 한 번에 완료되었습니다.</div><div class="modal-actions"><button class="btn btn-light" id="closeGenerated">닫기</button><a class="btn btn-primary" target="_blank" href="${url}">통합 성적표 열기</a></div></div>`;document.body.appendChild(back);back.querySelector("#closeGenerated").onclick=()=>back.remove()}
 async function saveCurrent(){const result=updateScore();if(!state.exam||!$("studentName").value.trim())return YP.toast("학생 이름을 입력하세요.");if(!result.valid)return YP.toast("입력 오류 문항을 먼저 수정하세요.");if(result.counts.ungraded&&!confirm(`${result.counts.ungraded}개 문항이 미입력입니다. 미채점 상태로 저장할까요?`))return;if(!YP_API.demo&&!YP_API.isAuthenticated()){openSettings();return YP.toast("교사 PIN으로 이 컴퓨터를 먼저 연결하세요.",5000)}const btn=$("saveReportBtn");btn.disabled=true;btn.textContent="저장·분석·링크 생성 중...";try{const data=await YP_API.saveReport(makeRecord());state.editToken=data.record.token;state.serverInstanceId=String(data.serverInstanceId||state.serverInstanceId||"");const url=reportURL(data.record.token,data.record.fingerprint,state.serverInstanceId);await YP.copyText(url);showLinkModal(data,url);await refreshReports();$("cancelEditBtn").classList.remove("hidden")}catch(e){handleAuthFailure(e);YP.toast(e.message,6000)}finally{btn.disabled=false;btn.textContent="저장·성적 분석·링크 복사"}}
 async function refreshReports(){
   const tbody=$("reportsBody");
   if(!YP_API.demo&&!YP_API.isAuthenticated()){
     state.reports=[];tbody.innerHTML=`<tr><td colspan="6" class="muted">교사 PIN으로 연결하면 다른 컴퓨터에서 저장한 학생 기록도 자동으로 표시됩니다.</td></tr>`;return;
   }
   try{
     const data=await YP_API.listReports({});state.reports=data.reports||[];state.serverInstanceId=String(data.serverInstanceId||state.serverInstanceId||"");
     tbody.innerHTML=state.reports.length?state.reports.map(r=>{const ex=YP.getExam(r.examId),school=YP.normalizeSchool(r.school);return `<tr><td>${YP.escapeHTML(ex?YP.roundLabel(ex):r.examId)}</td><td>${YP.escapeHTML(school)}</td><td>${YP.escapeHTML(r.name)}</td><td>${YP.formatNumber(r.score)} / ${r.maxScore}</td><td>${YP.escapeHTML(String(r.updatedAt||"").replace("T"," ").slice(0,16))}</td><td><div class="report-list-actions"><button class="btn btn-light" data-action="edit" data-token="${r.token}">수정</button><button class="btn btn-primary" data-action="copy" data-token="${r.token}" data-fp="${r.fingerprint}">링크 복사</button><a class="btn btn-light" target="_blank" href="${reportURL(r.token,r.fingerprint)}">열기</a><button class="btn btn-danger" data-action="delete" data-token="${r.token}">삭제</button></div></td></tr>`}).join(""):`<tr><td colspan="6" class="muted">저장된 기록이 없습니다.</td></tr>`;
     tbody.querySelectorAll("button[data-action]").forEach(b=>b.onclick=()=>handleReportAction(b.dataset.action,b.dataset.token,b.dataset.fp,state.reports));
   }catch(e){handleAuthFailure(e);state.reports=[];tbody.innerHTML=`<tr><td colspan="6">${YP.escapeHTML(e.message)}</td></tr>`}
 }
 async function handleReportAction(action,token,fp,reports){if(action==="copy"){await YP.copyText(reportURL(token,fp));return YP.toast("학부모 전달용 학생 링크를 복사했습니다.")}if(action==="delete"){if(!confirm("이 학생 기록을 삭제할까요?"))return;try{await YP_API.deleteReport(token);await refreshReports();YP.toast("삭제했습니다.")}catch(e){YP.toast(e.message,5000)}return}if(action==="edit"){const r=reports.find(x=>x.token===token);if(!r)return;$("courseSelect").value=r.courseId||YP.getExam(r.examId).courseId;renderExamOptions();$("examSelect").value=r.examId;loadExam();$("studentName").value=r.name;$("school").value=YP.normalizeSchool(r.school)==="미기입"?"":r.school;$("grade").value=r.grade||"";$("classNo").value=r.classNo||"";$("teacherMemo").value=r.teacherMemo||"";state.inputs=[...(r.resultInputs||[])];state.partialModes=[...(r.partialModes||[])];state.editToken=r.token;state.exam.questions.forEach((q,i)=>{$(`qInput${i}`).value=state.inputs[i]??"";if($(`partial${i}`))$(`partial${i}`).checked=!!state.partialModes[i];updateQuestion(i)});updateScore();$("cancelEditBtn").classList.remove("hidden");scrollTo({top:0,behavior:"smooth"});YP.toast("수정 모드: 저장하면 기존 링크가 유지됩니다.")}}
 function cancelEdit(){state.editToken=null;$("cancelEditBtn").classList.add("hidden");YP.toast("수정 모드를 종료했습니다.")}
 function downloadTemplate(){
   if(!state.exam)return YP.toast("시험을 먼저 선택하세요.");
   const headers=["과정","시험","학교","이름","학년","반번호",...state.exam.questions.map(q=>"Q"+q.no)],example=[YP.getCourse(state.exam.courseId).courseName,state.exam.shortTitle||state.exam.round+"회","","홍길동","2","",...state.exam.questions.map(q=>q.inputMode==="points"?q.maxPoints:"1")],csv="\ufeff"+[headers,example].map(r=>r.map(YP.csvEscape).join(",")).join("\n");
   YP.downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`${state.exam.examId}_입력템플릿.csv`);
 }
 function batchIdentityKey(record){return [record.examId,YP.normalizeIdentity(YP.normalizeSchool(record.school)),YP.normalizeIdentity(record.name)].join("|")}
 function findExistingBatchRecord(record){const key=batchIdentityKey(record);return state.reports.find(r=>batchIdentityKey({...r,school:YP.normalizeSchool(r.school)})===key)||null}
 function renderBatchPreview(meta,rows){
   state.batchMeta=meta;state.batchRows=rows;
   const validRows=rows.filter(x=>x.saveable),missingSchool=rows.filter(x=>YP.normalizeSchool(x.record.school)==="미기입").length,updates=validRows.filter(x=>x.existing).length,errors=rows.length-validRows.length;
   const summary=$("batchImportSummary");summary.classList.remove("hidden");
   summary.innerHTML=`
    <div class="batch-summary-card"><span>첨부 파일·시트</span><b>${YP.escapeHTML(meta.fileName||"-")}<br>${YP.escapeHTML(meta.sheetName||"CSV")}</b></div>
    <div class="batch-summary-card ok"><span>읽은 학생</span><b>${rows.length}명</b></div>
    <div class="batch-summary-card ${missingSchool?"warn":""}"><span>학교 미기입</span><b>${missingSchool}명 → 미기입</b></div>
    <div class="batch-summary-card"><span>입력 해석</span><b>${YP.escapeHTML(meta.inputModeLabel||"정오표·부분점수")}</b></div>
    <div class="batch-summary-card ${errors?"warn":"ok"}"><span>저장 예상</span><b>신규 ${Math.max(0,validRows.length-updates)} · 수정 ${updates}${errors?` · 오류 ${errors}`:""}</b></div>`;
   const preview=$("csvPreview");preview.classList.remove("hidden");
   preview.innerHTML=`<table><thead><tr><th>원본 행</th><th>학교</th><th>학생</th><th>재계산 점수</th><th>원본 총점</th><th>처리 상태</th></tr></thead><tbody>${rows.map(x=>{
     const source=x.sourceTotal===null||x.sourceTotal===undefined||x.sourceTotal===""?"—":YP.formatNumber(x.sourceTotal),match=x.sourceTotal===null||x.sourceTotal===undefined||x.sourceTotal===""||!Number.isFinite(Number(x.sourceTotal))||Math.abs(Number(x.sourceTotal)-Number(x.calc.score))<1e-9;
     const status=!x.saveable?`<span class="batch-status error">${YP.escapeHTML(x.errorMessage||"오류")}</span>`:x.existing?`<span class="batch-status update">기존 기록 수정</span>`:`<span class="batch-status ready">신규 저장</span>`;
     return `<tr><td>${x.rowNo}</td><td>${YP.escapeHTML(YP.normalizeSchool(x.record.school))}</td><td class="batch-preview-name">${YP.escapeHTML(x.record.name||"(이름 없음)")}</td><td>${YP.formatNumber(x.calc.score)} / ${state.exam.maxScore}</td><td class="${match?"batch-score-match":"batch-score-mismatch"}">${source}${match?"":" · 불일치"}</td><td>${status}</td></tr>`
   }).join("")}</tbody></table>`;
   const button=$("saveBatchBtn");button.classList.toggle("hidden",!validRows.length);button.textContent=`검증된 학생 ${validRows.length}명 일괄 저장`;
 }
 function normalizeCsvHeader(v){return String(v||"").trim().toLowerCase().replace(/[\s_\-./·()\[\]{}:]+/g,"")}
 function previewCsv(text,fileName="학생기록.csv"){
   const rows=YP.csvParse(text);if(rows.length<2)throw new Error("CSV 데이터 행이 없습니다.");
   const header=rows[0].map(normalizeCsvHeader),findIndex=(...names)=>{for(const n of names){const i=header.indexOf(normalizeCsvHeader(n));if(i>=0)return i}return -1},nameIdx=findIndex("이름","성명","학생명");
   if(nameIdx<0)throw new Error("CSV에 이름 열이 필요합니다.");
   const qIdx=state.exam.questions.map(q=>findIndex("Q"+q.no,"문항"+q.no));if(qIdx.some(i=>i<0))throw new Error("현재 시험의 Q1~Qn 헤더가 모두 필요합니다.");
   const schoolIdx=findIndex("학교","학교명"),gradeIdx=findIndex("학년"),classIdx=findIndex("반번호","반·번호","반"),totalIdx=findIndex("총점","점수");
   const parsed=rows.slice(1).map((row,k)=>{
     const name=String(row[nameIdx]||"").trim(),school=schoolIdx>=0?String(row[schoolIdx]||"").trim():"",inputs=qIdx.map(i=>row[i]??""),partialModes=Array(inputs.length).fill(false),calc=YP.calculateResult(state.exam,inputs,partialModes),errors=[];
     if(!name)errors.push("이름 없음");if(!calc.valid)errors.push("점수 입력 오류");
     const record={examId:state.exam.examId,courseId:state.exam.courseId,school:YP.normalizeSchool(school),name,grade:gradeIdx>=0?String(row[gradeIdx]||"").trim():"",classNo:classIdx>=0?String(row[classIdx]||"").trim():"",resultInputs:inputs,partialModes,importMode:"upsert",importSource:{fileName,sheetName:"CSV",sourceRow:k+2,format:"q-header"}};
     const sourceTotal=totalIdx>=0&&String(row[totalIdx]??"").trim()!==""?Number(row[totalIdx]):null,existing=findExistingBatchRecord(record);
     return {rowNo:k+2,record,calc,sourceTotal:Number.isFinite(sourceTotal)?sourceTotal:null,errors,saveable:!!name&&calc.valid&&!errors.length,existing,errorMessage:errors.join(" · ")};
   }).filter(x=>x.record.name||x.record.resultInputs.some(v=>String(v||"").trim()!==""));
   renderBatchPreview({fileName,sheetName:"CSV",format:"q-header",inputModeLabel:"0/1 정오표·실제 점수"},parsed);
 }
 async function previewExcel(file){
   if(typeof YP_XLSX==="undefined")throw new Error("Excel 가져오기 모듈을 불러오지 못했습니다. Pages 배포 파일을 확인하세요.");
   const imported=await YP_XLSX.importAssessment(file,state.exam);
   const parsed=imported.students.map(s=>{
     const record={examId:state.exam.examId,courseId:state.exam.courseId,school:YP.normalizeSchool(s.school),name:s.name,grade:s.grade||"",classNo:s.classNo||"",resultInputs:s.inputs,partialModes:s.partialModes||Array(state.exam.questionCount).fill(false),importMode:"upsert",importSource:{fileName:imported.fileName,sheetName:imported.sheetName,sourceRow:s.sourceRow,format:imported.format,inputMode:imported.inputMode}};
     const calc=YP.calculateResult(state.exam,record.resultInputs,record.partialModes),errors=[...(s.errors||[])];if(!record.name)errors.push("이름 없음");if(!calc.valid)errors.push("점수 입력 오류");
     const existing=findExistingBatchRecord(record);return {rowNo:s.sourceRow,record,calc,sourceTotal:s.sourceTotal,errors,saveable:!!record.name&&calc.valid&&!errors.length,existing,errorMessage:errors.join(" · ")};
   });
   const modeLabel=imported.inputMode==="raw-choice"?"객관식 선택번호 → 검수 정오표":"0/1 정오표·실제 점수";
   renderBatchPreview({...imported,inputModeLabel:modeLabel},parsed);
   if(imported.answerKeyMismatchQuestions?.length)YP.toast(`Excel 정답표와 검수 정답표가 다른 문항: ${imported.answerKeyMismatchQuestions.join(", ")}번. 사이트 검수 정답으로 재채점했습니다.`,7000);
 }
 async function handleBatchFile(file){
   if(!file)return;
   resetBatchPreview(false);const summary=$("batchImportSummary");summary.classList.remove("hidden");summary.innerHTML='<div class="batch-summary-card"><span>파일 분석</span><b>학생 행과 문항 열을 확인하는 중...</b></div>';
   try{if(/\.xlsx$/i.test(file.name))await previewExcel(file);else if(/\.csv$/i.test(file.name))previewCsv(await file.text(),file.name);else throw new Error(".xlsx 또는 .csv 파일만 첨부할 수 있습니다.")}
   catch(err){state.batchRows=[];summary.classList.remove("hidden");summary.innerHTML=`<div class="batch-summary-card warn"><span>가져오기 실패</span><b>${YP.escapeHTML(err.message)}</b></div>`;$("csvPreview").classList.add("hidden");$("saveBatchBtn").classList.add("hidden");YP.toast(err.message,7000)}
 }
 async function saveBatch(){
   const rows=state.batchRows.filter(x=>x.saveable),records=rows.map(x=>x.record);if(!records.length)return YP.toast("저장 가능한 학생 기록이 없습니다.");
   if(!YP_API.demo&&!YP_API.isAuthenticated()){openSettings();return YP.toast("교사 PIN으로 이 컴퓨터를 먼저 연결하세요.",5000)}
   const button=$("saveBatchBtn");button.disabled=true;button.textContent=`${records.length}명 Google Sheets 저장 중...`;
   try{
     const data=await YP_API.saveBatch(records);state.serverInstanceId=String(data.serverInstanceId||state.serverInstanceId||"");const savedCount=Number(data.savedCount??data.saved?.length??0),created=Number(data.createdCount??savedCount),updated=Number(data.updatedCount??0),failed=Array.isArray(data.failed)?data.failed.length:0;
     YP.toast(`${savedCount}명 저장 완료 · 신규 ${created} · 수정 ${updated}${failed?` · 실패 ${failed}`:""}`,7000);await refreshReports();
     const summary=$("batchImportSummary");summary.insertAdjacentHTML("beforeend",`<div class="batch-summary-card ok"><span>Google Sheets 반영</span><b>${savedCount}명 완료${failed?` · 실패 ${failed}`:""}</b></div>`);
   }catch(e){handleAuthFailure(e);YP.toast(e.message,7000)}finally{button.disabled=false;button.textContent=`검증된 학생 ${records.length}명 일괄 저장`}
 }
 function openSettings(){setAuthModalState();$("teacherPinInput").value="";$("settingsModal").classList.remove("hidden");if(!YP_API.demo&&!YP_API.isAuthenticated())setTimeout(()=>$("teacherPinInput").focus(),80)}
 function closeSettings(){$("settingsModal").classList.add("hidden")}
 async function teacherLogin(){const pin=$("teacherPinInput").value.trim();if(!pin)return $("settingsStatus").textContent="교사 PIN을 입력하세요.";const btn=$("teacherLoginBtn");btn.disabled=true;btn.textContent="연결 중...";try{const d=await YP_API.login(pin);$("settingsStatus").textContent="교사 연결이 완료되었습니다. 시험 설정을 자동 동기화합니다.";setAuthModalState();await autoSyncCatalog(false);await refreshReports();YP.toast("이 컴퓨터에서 바로 학생 성적을 입력할 수 있습니다.",5000)}catch(e){$("settingsStatus").textContent=e.message}finally{btn.disabled=false;btn.textContent="이 컴퓨터를 교사용으로 연결"}}
 async function ping(){try{const d=YP_API.isAuthenticated()?await YP_API.sessionStatus():await YP_API.bootstrap();$("settingsStatus").textContent=YP_API.isAuthenticated()?`교사 연결 정상 · 만료 ${formatExpiry(d.expiresAt)}`:`Apps Script 서버 연결 정상 · 교사 인증 필요`;setAuthModalState($("settingsStatus").textContent)}catch(e){handleAuthFailure(e);$("settingsStatus").textContent=e.message}}
 async function syncCatalog(){try{const d=await autoSyncCatalog(true);$("settingsStatus").textContent=`동기화 완료: 과정 ${d.courses}, 시험 ${d.exams}, 문항 ${d.questions}`}catch(e){handleAuthFailure(e);$("settingsStatus").textContent=e.message}}
 async function createNewDeviceLink(){try{const d=await YP_API.createDeviceSetupToken(),u=new URL(location.href);u.search="";u.hash=`teacher-setup=${encodeURIComponent(d.setupToken)}`;await YP.copyText(u.toString());$("settingsStatus").textContent=`새 컴퓨터 연결 링크를 복사했습니다. ${formatExpiry(d.expiresAt)}까지 한 번만 사용할 수 있습니다.`;YP.toast("새 컴퓨터 연결 링크를 복사했습니다.",5000)}catch(e){handleAuthFailure(e);$("settingsStatus").textContent=e.message}}
 function logoutTeacher(){YP_API.clearSession();localStorage.removeItem(YP.config.catalogSyncStorage);updateConnectionUI();setAuthModalState("이 컴퓨터의 교사 연결을 해제했습니다.");refreshReports()}
 const autoRefreshState={lastAt:0,promise:null};
 async function refreshWhenActive(reason){
   if(YP_API.demo||!YP_API.isAuthenticated()||document.hidden)return null;
   const now=Date.now();
   if(autoRefreshState.promise)return autoRefreshState.promise;
   if(now-autoRefreshState.lastAt<1500)return null;
   autoRefreshState.lastAt=now;
   autoRefreshState.promise=(async()=>{
     try{await refreshReports()}
     catch(e){handleAuthFailure(e)}
     finally{autoRefreshState.promise=null}
   })();
   return autoRefreshState.promise;
 }
 function bind(){
   $("courseSelect").onchange=renderExamOptions;$("examSelect").onchange=loadExam;$("applyPasteBtn").onclick=applyPaste;$("sampleBtn").onclick=fillSample;$("clearBtn").onclick=clearAll;$("saveReportBtn").onclick=saveCurrent;$("cancelEditBtn").onclick=cancelEdit;$("refreshReportsBtn").onclick=refreshReports;$("downloadCsvTemplateBtn").onclick=downloadTemplate;
   $("csvFile").onchange=e=>handleBatchFile(e.target.files?.[0]);$("saveBatchBtn").onclick=saveBatch;
   const drop=$("batchDropZone");if(drop){["dragenter","dragover"].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add("dragover")}));["dragleave","drop"].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove("dragover")}));drop.addEventListener("drop",e=>handleBatchFile(e.dataTransfer?.files?.[0]))}
   $("settingsBtn").onclick=openSettings;$("closeSettingsBtn").onclick=closeSettings;$("teacherLoginBtn").onclick=teacherLogin;$("teacherPinInput").addEventListener("keydown",e=>{if(e.key==="Enter")teacherLogin()});$("pingBtn").onclick=ping;$("syncCatalogBtn").onclick=syncCatalog;$("newDeviceLinkBtn").onclick=createNewDeviceLink;$("logoutBtn").onclick=logoutTeacher;$("settingsModal").addEventListener("click",e=>{if(e.target===$("settingsModal"))closeSettings()});window.addEventListener("focus",()=>refreshWhenActive("focus"));window.addEventListener("pageshow",()=>refreshWhenActive("pageshow"));window.addEventListener("online",()=>refreshWhenActive("online"));document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshWhenActive("visibility")});
 }
 async function init(){showDemo();initCourses();bind();await initializeServerConnection()}
 document.addEventListener("DOMContentLoaded",init);
})();
