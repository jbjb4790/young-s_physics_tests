
/**
 * Young's Physics 주간 복습·총괄평가 통합 성적 분석 시스템
 * Google Sheets + Apps Script Web App API
 *
 * Script Properties:
 *   SPREADSHEET_ID       (필수, connectThisSpreadsheet() 실행 시 자동 설정 가능)
 *   WRITE_KEY            (선택, 구버전 호환·긴급 관리자 인증)
 *   FINGERPRINT_SECRET   (선택, 학생 링크 서명용. 설치 함수가 자동 생성)
 *   SESSION_SECRET       (선택, 교사 세션 서명용. 설치 함수가 자동 생성)
 *   TEACHER_PIN_HASH     (교사 PIN 해시. installYoungsPhysics()가 자동 생성)
 *   TEACHER_PIN_SALT     (교사 PIN 솔트)
 *   AUTH_EPOCH           (세션 일괄 무효화 버전)
 *
 * 브라우저에는 WRITE_KEY를 저장하지 않는다. GitHub Pages는 공개된 /exec URL만
 * 자동으로 알고, 교사 PIN 또는 10분짜리 1회용 새 컴퓨터 연결 링크로 교사 세션을 발급받는다.
 */

const SHEETS = {
  COURSES: "Courses",
  EXAMS: "Exams",
  QUESTIONS: "Questions",
  QUESTION_OVERRIDES: "QuestionOverrides",
  STUDENTS: "Students",
  REPORTS: "Reports"
};

const HEADERS = {
  Courses: ["CourseId","CourseName","Active"],
  Exams: ["ExamId","CourseId","Round","Title","ShortTitle","AssessmentType","Section","ExamDate","QuestionCount","MaxScore","ExamPDF","SolutionPDF","ReviewStatus","ConfigVersion","Status","PagesJSON","CoreNoteJSON","InputProfileJSON","HistoryExamIdsJSON","HistoryLabel","SourceTitle","SourceNote","DisplayOrder"],
  Questions: ["ExamId","QuestionNo","Type","InputMode","MaxPoints","Unit","Topic","Difficulty","AnswerJSON","RubricJSON","ExplanationJSON","OriginalRetryJSON","SimilarProblemJSON","ReviewStatus","CorrectionNote","ImageJSON"],
  QuestionOverrides: ["ExamId","QuestionNo","AnswerJSON","OriginalRetryJSON","SimilarProblemJSON","RevisionNote","UpdatedAt"],
  Students: ["StudentId","PortalToken","PortalFingerprint","IdentitySeed","IdentityDigest","IdentityKey","School","Name","Grade","ClassNo","ExternalId","CreatedAt","UpdatedAt","Active"],
  Reports: ["Token","Fingerprint","IdentitySeed","IdentityDigest","StudentKey","ExamId","CourseId","School","Name","Grade","ClassNo","ResultInputsJSON","PartialModesJSON","ScoringJSON","RecordJSON","CreatedAt","UpdatedAt","StudentId"]
};

const API_VERSION = "3.3.0-hosted-parent-bridge";
const FEATURE_VERSION = "3.5.0-student-lifetime-portal";
const STUDENT_PORTAL_SCHEMA_VERSION = "1";
const DEFAULT_SESSION_TTL_DAYS = 90;
const DEFAULT_SETUP_TOKEN_TTL_MINUTES = 10;

/**
 * 스프레드시트를 열 때 표시되는 운영 메뉴.
 * 새 컴퓨터 연결에는 브라우저에 비밀키를 저장하지 않고 교사 PIN 또는 1회용 링크를 사용한다.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("Young's Physics")
      .addItem("① 설치·시트 초기화", "installYoungsPhysics")
      .addItem("학교 미기입 표기 정리(분할 실행)", "migrateSchoolLabels")
      .addSeparator()
      .addItem("교사 PIN 직접 변경", "setTeacherPin")
      .addItem("무작위 교사 PIN 재발급", "resetTeacherPin")
      .addItem("GitHub Pages 허용 주소 설정", "setSiteOrigins")
      .addItem("허용 주소 제한 즉시 해제", "clearSiteOrigins")
      .addItem("모든 교사 기기 세션 해제", "invalidateTeacherSessions")
      .addSeparator()
      .addItem("성적표 토큰 저장소 진단", "diagnoseReportStorage")
      .addItem("성적표 토큰 저장소 복구", "repairReportStorage")
      .addSeparator()
      .addItem("학생 통합 링크 마이그레이션", "migrateStudentPortals")
      .addItem("학생 통합 링크 진단", "diagnoseStudentPortals")
      .addSeparator()
      .addItem("웹 앱 배포 진단", "checkWebAppDeployment")
      .addItem("연결 상태 확인", "showYoungsPhysicsStatus")
      .addToUi();
  } catch (err) {}
}

/** 현재 설치 상태를 스프레드시트 알림창에 표시한다. */
function showYoungsPhysicsStatus() {
  const props = PropertiesService.getScriptProperties();
  const status = bootstrap_();
  const ss = getSpreadsheet_();
  const lines = [
    "API 버전: " + status.apiVersion,
    "기능 버전: " + (status.featureVersion || FEATURE_VERSION),
    "스프레드시트: " + ss.getName(),
    "교사 PIN: " + (status.teacherPinConfigured ? "설정됨" : "미설정"),
    "교사 세션 유효기간: " + status.sessionTtlDays + "일",
    "새 컴퓨터 링크 유효기간: " + status.setupTokenTtlMinutes + "분",
    "허용 사이트: " + (String(props.getProperty("SITE_ORIGINS") || props.getProperty("SITE_ORIGIN") || "").trim() || "미설정(모든 HTTPS origin 허용)"),
    "SPREADSHEET_ID: " + (props.getProperty("SPREADSHEET_ID") ? "설정됨" : "미설정")
  ];
  try {
    SpreadsheetApp.getUi().alert("Young's Physics 연결 상태", lines.join("\n"), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (uiErr) {}
  return {ok:true, status:status, spreadsheetId:ss.getId(), spreadsheetUrl:ss.getUrl()};
}

function doGet(e) {
  try {
    const parameters = (e && e.parameter) || {};
    const view = String(parameters.view || "");
    if (view === "host") {
      return hostedBridgeShell_(String(parameters.site || ""));
    }
    const action = String(parameters.action || "ping");
    if (action === "bridge") {
      return bridgeHtml_(
        String(e.parameter.origin || ""),
        String(e.parameter.channel || "")
      );
    }
    if (action === "bridgeCheck") {
      const origin = validateBridgeOrigin_(String(e.parameter.origin || ""));
      return jsonOutput_({
        ok:true,
        apiVersion:API_VERSION,
        featureVersion:FEATURE_VERSION,
        serverInstanceId:getServerInstanceId_(),
        origin:origin,
        formPostBridge:true,
        legacyHtmlBridge:true
      });
    }
    if (action === "getReport") {
      return jsonOutput_(getReport_(String(e.parameter.token || ""), String(e.parameter.fp || "")));
    }
    if (action === "getExamStats") {
      return jsonOutput_({ok:true, stats:getExamStats_(String(e.parameter.examId || ""))});
    }
    if (action === "bootstrap") {
      return jsonOutput_(bootstrap_());
    }
    if (action === "ping") {
      return jsonOutput_({
        ok:true,
        message:"Young's Physics Apps Script API 정상",
        apiVersion:API_VERSION,
        featureVersion:FEATURE_VERSION,
        serverInstanceId:getServerInstanceId_(),
        transport:"content-service",
        time:new Date().toISOString()
      });
    }
    return jsonOutput_({ok:false, code:"UNSUPPORTED_ACTION", error:"지원하지 않는 GET action입니다: " + action});
  } catch (err) {
    return jsonOutput_(apiErrorObject_(err));
  }
}


/**
 * GitHub Pages 앱을 Apps Script HTML Service 안의 자식 iframe으로 실행한다.
 * google.script.run은 Apps Script가 직접 제공한 상위 페이지에서만 호출하고,
 * GitHub 앱은 postMessage로 요청·응답만 교환한다. 이 구조는 브라우저의
 * cross-origin fetch, third-party Apps Script iframe, ContentService CORS에 의존하지 않는다.
 */
function hostedBridgeShell_(requestedSiteUrl) {
  const rawSite = String(requestedSiteUrl || "").trim();
  const origin = validateBridgeOrigin_(rawSite);
  if (rawSite.indexOf(origin) !== 0) {
    throwApiError_("HOST_SITE_INVALID", "GitHub Pages 사이트 주소가 올바르지 않습니다.");
  }
  const suffix = rawSite.slice(origin.length, origin.length + 1);
  if (suffix && suffix !== "/" && suffix !== "?" && suffix !== "#") {
    throwApiError_("HOST_SITE_INVALID", "GitHub Pages 사이트 주소와 origin이 일치하지 않습니다.");
  }

  const channel = String(Utilities.getUuid() + Utilities.getUuid()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 96);
  const siteJson = safeJsonForHtml_(rawSite);
  const originJson = safeJsonForHtml_(origin);
  const channelJson = safeJsonForHtml_(channel);
  const versionJson = safeJsonForHtml_(API_VERSION);
  const html = [
    '<!doctype html>',
    '<html lang="ko"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="robots" content="noindex,nofollow">',
    '<title>Young\'s Physics Secure Connection</title>',
    '<style>',
    'html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#f4f8ff;font-family:Arial,"Noto Sans KR",sans-serif}',
    '#ypHostFrame{display:block;width:100%;height:100%;border:0;background:white}',
    '#ypHostStatus{position:fixed;z-index:20;left:50%;top:50%;transform:translate(-50%,-50%);min-width:280px;max-width:calc(100% - 40px);padding:22px 24px;border:1px solid #cfe0f8;border-radius:18px;background:white;box-shadow:0 18px 60px rgba(0,45,110,.18);color:#0b2c63;text-align:center}',
    '#ypHostStatus b{display:block;font-size:18px;margin-bottom:8px}#ypHostStatus span{font-size:13px;color:#5d6f89}',
    '</style></head><body>',
    '<div id="ypHostStatus"><b>Young\'s Physics 보안 연결 중</b><span>Google Sheets 통신 채널을 준비하고 있습니다.</span></div>',
    '<iframe id="ypHostFrame" title="Young\'s Physics 성적 분석" allow="clipboard-read; clipboard-write; fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe>',
    '<script>',
    '(function(){"use strict";',
    'var SITE=' + siteJson + ';',
    'var SITE_ORIGIN=' + originJson + ';',
    'var CHANNEL=' + channelJson + ';',
    'var VERSION=' + versionJson + ';',
    'var frame=document.getElementById("ypHostFrame");',
    'var status=document.getElementById("ypHostStatus");',
    'var ready=false;',
    'function send(message){try{if(frame&&frame.contentWindow)frame.contentWindow.postMessage(message,SITE_ORIGIN);}catch(e){}}',
    'function errorText(error){return error&&error.message?String(error.message):String(error||"Apps Script error");}',
    'function readyMessage(){send({type:"YP_HOST_BRIDGE_READY",channel:CHANNEL,apiVersion:VERSION});}',
    'window.addEventListener("message",function(event){',
    '  if(!frame||event.source!==frame.contentWindow||event.origin!==SITE_ORIGIN)return;',
    '  var message=event.data||{};',
    '  if(message.channel!==CHANNEL)return;',
    '  if(message.type==="YP_HOST_BRIDGE_HELLO"){ready=true;status.style.display="none";readyMessage();return;}',
    '  if(message.type!=="YP_HOST_BRIDGE_REQUEST"||!message.id)return;',
    '  var id=String(message.id);',
    '  google.script.run',
    '    .withSuccessHandler(function(result){send({type:"YP_HOST_BRIDGE_RESPONSE",channel:CHANNEL,id:id,result:result});})',
    '    .withFailureHandler(function(error){send({type:"YP_HOST_BRIDGE_RESPONSE",channel:CHANNEL,id:id,result:{ok:false,code:"HOST_SERVER_ERROR",error:errorText(error)}});})',
    '    .apiBridge(message.body||{});',
    '});',
    'function start(){',
    '  try{var u=new URL(SITE);u.searchParams.set("ypEmbedded","1");u.searchParams.set("ypBridgeChannel",CHANNEL);frame.src=u.toString();}',
    '  catch(e){status.innerHTML="<b>사이트 주소 오류</b><span>GitHub Pages 주소를 다시 확인하세요.</span>";return;}',
    '  var count=0;var timer=setInterval(function(){count++;readyMessage();if(ready||count>120)clearInterval(timer);},250);',
    '}',
    'start();',
    '})();',
    '<\/script></body></html>'
  ].join("");
  return HtmlService.createHtmlOutput(html)
    .setTitle("Young's Physics Secure Connection")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * GitHub Pages에서 Apps Script ContentService로 직접 fetch할 때 브라우저·조직 정책에 따라
 * 리디렉션/CORS 단계가 차단될 수 있다. 이 HTML 브리지는 Apps Script의 google.script.run을
 * 사용해 서버 함수를 호출하고, 결과만 postMessage로 GitHub Pages에 돌려준다.
 */
function bridgeHtml_(requestedOrigin, requestedChannel) {
  let origin;
  let channel;
  try {
    origin = validateBridgeOrigin_(requestedOrigin);
    channel = validateBridgeChannel_(requestedChannel);
  } catch (err) {
    return bridgeErrorHtml_(requestedOrigin, requestedChannel, err);
  }

  const originJson = JSON.stringify(origin).replace(/</g, "\\u003c");
  const channelJson = JSON.stringify(channel).replace(/</g, "\\u003c");
  const versionJson = JSON.stringify(API_VERSION);
  const html = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">',
    '<title>Young\'s Physics API Bridge</title></head>',
    '<body style="margin:0;background:transparent">',
    '<script>',
    '(function(){',
    '"use strict";',
    'var ORIGIN=' + originJson + ';',
    'var CHANNEL=' + channelJson + ';',
    'var VERSION=' + versionJson + ';',
    'var TOP_WINDOW=window.top;',
    'function send(payload){try{TOP_WINDOW.postMessage(payload,ORIGIN);}catch(e){}}',
    'function errorText(error){return error&&error.message?String(error.message):String(error||"Apps Script bridge error");}',
    'window.addEventListener("message",function(event){',
    '  if(event.source!==TOP_WINDOW||event.origin!==ORIGIN)return;',
    '  var message=event.data||{};',
    '  if(message.type!=="YP_API_BRIDGE_REQUEST"||message.channel!==CHANNEL||!message.id)return;',
    '  google.script.run',
    '    .withSuccessHandler(function(result){send({type:"YP_API_BRIDGE_RESPONSE",channel:CHANNEL,id:String(message.id),result:result});})',
    '    .withFailureHandler(function(error){send({type:"YP_API_BRIDGE_RESPONSE",channel:CHANNEL,id:String(message.id),result:{ok:false,code:"BRIDGE_SERVER_ERROR",error:errorText(error)}});})',
    '    .apiBridge(message.body||{});',
    '});',
    'var waitCount=0;',
    'function ready(){',
    '  if(!(window.google&&google.script&&google.script.run)){',
    '    waitCount++;',
    '    if(waitCount>400){send({type:"YP_API_BRIDGE_ERROR",channel:CHANNEL,apiVersion:VERSION,code:"GOOGLE_SCRIPT_RUN_UNAVAILABLE",error:"Apps Script 브리지 런타임을 불러오지 못했습니다."});return;}',
    '    setTimeout(ready,50);return;',
    '  }',
    '  send({type:"YP_API_BRIDGE_READY",channel:CHANNEL,apiVersion:VERSION,bridgeMode:"nested-top-window"});',
    '}',
    'ready();',
    '})();',
    '<\/script></body></html>'
  ].join('');
  return HtmlService.createHtmlOutput(html)
    .setTitle("Young's Physics API Bridge")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * HtmlService는 자체 IFRAME 샌드박스 안에서 실행될 수 있다. 브리지 검증 오류도
 * 최상위 GitHub Pages 창에 postMessage하여 타임아웃 대신 원인을 즉시 표시한다.
 */
function bridgeErrorHtml_(requestedOrigin, requestedChannel, err) {
  const origin = normalizeBridgeOriginInput_(requestedOrigin);
  const channel = String(requestedChannel || "").trim();
  if (!origin || !/^[A-Za-z0-9_-]{16,120}$/.test(channel)) {
    return jsonOutput_(apiErrorObject_(err));
  }
  const payload = apiErrorObject_(err);
  payload.type = "YP_API_BRIDGE_ERROR";
  payload.channel = channel;
  payload.apiVersion = API_VERSION;
  const originJson = JSON.stringify(origin).replace(/</g, "\\u003c");
  const payloadJson = JSON.stringify(payload).replace(/</g, "\\u003c");
  const html = [
    '<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"></head>',
    '<body><script>',
    '(function(){"use strict";var ORIGIN=' + originJson + ';var PAYLOAD=' + payloadJson + ';',
    'try{window.top.postMessage(PAYLOAD,ORIGIN);}catch(e){}',
    '})();',
    '<\/script></body></html>'
  ].join('');
  return HtmlService.createHtmlOutput(html)
    .setTitle("Young's Physics API Bridge Error")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** 전체 Pages URL이 들어와도 scheme + host origin으로 정규화한다. */
function normalizeBridgeOriginInput_(origin) {
  const raw = String(origin || "").trim();
  const match = raw.match(/^(https?):\/\/([^\/?#]+)/i);
  if (!match) return "";
  const scheme = String(match[1] || "").toLowerCase();
  const authority = String(match[2] || "").toLowerCase();
  const secure = scheme === "https" && /^[a-z0-9.-]+(?::\d+)?$/.test(authority);
  const local = scheme === "http" && /^(localhost|127\.0\.0\.1)(?::\d+)?$/.test(authority);
  return secure || local ? scheme + "://" + authority : "";
}

function validateBridgeOrigin_(origin) {
  const value = normalizeBridgeOriginInput_(origin);
  if (!value) {
    throwApiError_("BRIDGE_ORIGIN_INVALID", "통신 브리지의 사이트 origin이 올바르지 않습니다.");
  }
  const props = PropertiesService.getScriptProperties();
  const configured = String(props.getProperty("SITE_ORIGINS") || props.getProperty("SITE_ORIGIN") || "").trim();
  if (configured) {
    const allowed = configured.split(/[\n,;]/).map(normalizeBridgeOriginInput_).filter(String);
    if (allowed.indexOf(value) < 0) {
      throwApiError_("BRIDGE_ORIGIN_DENIED", "현재 사이트 주소 " + value + "가 Apps Script SITE_ORIGINS 허용 목록에 없습니다. setSiteOrigins()를 다시 실행하거나 제한을 비우세요.", {requestedOrigin:value, allowedOrigins:allowed});
    }
  }
  return value;
}

function validateBridgeChannel_(channel) {
  const value = String(channel || "").trim();
  if (!/^[A-Za-z0-9_-]{16,120}$/.test(value)) {
    throwApiError_("BRIDGE_CHANNEL_INVALID", "통신 브리지 채널 값이 올바르지 않습니다.");
  }
  return value;
}

function doPost(e) {
  // GitHub Pages의 cross-origin fetch/iframe 초기화가 브라우저 정책에 막히는 경우를 피하기 위해,
  // hidden form POST → HtmlService postMessage 응답 방식도 지원한다.
  if (isFormPostBridgeRequest_(e)) {
    return handleFormPostBridge_(e);
  }
  try {
    return jsonOutput_(dispatchApiRequest_(parseBody_(e)));
  } catch (err) {
    return jsonOutput_(apiErrorObject_(err));
  }
}

function isFormPostBridgeRequest_(e) {
  return !!(e && e.parameter && String(e.parameter.__ypTransport || "") === "form-post");
}

/**
 * 브라우저가 Apps Script를 hidden iframe 안에서 직접 로드한 뒤 google.script.run을 여는 방식은
 * 일부 환경에서 제3자 iframe/샌드박스 정책에 의해 준비 메시지가 도착하지 않을 수 있다.
 * 이 전송은 요청 자체를 HTML form POST로 보내고, 처리 결과가 담긴 매우 작은 HtmlService 문서가
 * window.top.postMessage()로 GitHub Pages에 결과를 돌려준다.
 */
function handleFormPostBridge_(e) {
  const rawOrigin = String(e && e.parameter && e.parameter.origin || "");
  const rawChannel = String(e && e.parameter && e.parameter.channel || "");
  const rawId = String(e && e.parameter && e.parameter.id || "");

  let origin = "";
  let channel = "";
  let requestId = "";
  let result;
  try {
    // 문법상 안전한 origin을 먼저 확보해 오류도 요청한 사이트에만 돌려준다.
    origin = normalizeBridgeOriginInput_(rawOrigin);
    channel = validateBridgeChannel_(rawChannel);
    requestId = validateBridgeRequestId_(rawId);
    validateBridgeOrigin_(origin);
    result = dispatchApiRequest_(parseBody_(e));
  } catch (err) {
    result = apiErrorObject_(err);
    try { if (!origin) origin = normalizeBridgeOriginInput_(rawOrigin); } catch (ignored) {}
    try { if (!channel) channel = validateBridgeChannel_(rawChannel); } catch (ignored) {}
    try { if (!requestId) requestId = validateBridgeRequestId_(rawId); } catch (ignored) {}
  }

  // origin/channel/id 자체가 유효하지 않으면 어떤 외부 창에도 메시지를 보내지 않는다.
  if (!origin || !channel || !requestId) {
    return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><title>Invalid bridge request</title>')
      .setTitle("Young's Physics invalid bridge request")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return formPostBridgeHtml_(origin, channel, requestId, result);
}

function validateBridgeRequestId_(requestId) {
  const value = String(requestId || "").trim();
  if (!/^[A-Za-z0-9_-]{8,180}$/.test(value)) {
    throwApiError_("BRIDGE_REQUEST_ID_INVALID", "통신 브리지 요청 ID가 올바르지 않습니다.");
  }
  return value;
}

function formPostBridgeHtml_(origin, channel, requestId, result) {
  const originJson = safeJsonForHtml_(origin);
  const payloadJson = safeJsonForHtml_({
    type:"YP_API_FORM_RESPONSE",
    channel:channel,
    id:requestId,
    apiVersion:API_VERSION,
    result:result
  });
  const html = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">',
    '<title>Young\'s Physics Form Bridge</title></head>',
    '<body style="margin:0;background:transparent">',
    '<script>',
    '(function(){"use strict";',
    'var TARGET=' + originJson + ';',
    'var MESSAGE=' + payloadJson + ';',
    'function send(win){try{if(win&&win.postMessage)win.postMessage(MESSAGE,TARGET);}catch(e){}}',
    // Apps Script HTML Service는 IFRAME sandbox를 사용하므로 parent가 Google 래퍼일 수 있다.
    // top에도 보내야 실제 GitHub Pages가 반드시 수신한다.
    'setTimeout(function(){send(window.parent);if(window.top!==window.parent)send(window.top);},0);',
    '})();',
    '<\/script></body></html>'
  ].join('');
  return HtmlService.createHtmlOutput(html)
    .setTitle("Young's Physics Form Bridge")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function safeJsonForHtml_(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** HtmlService 브리지에서 호출하는 공개 서버 함수. */
function apiBridge(request) {
  try {
    return dispatchApiRequest_(request || {});
  } catch (err) {
    return apiErrorObject_(err);
  }
}

function dispatchApiRequest_(body) {
  body = body || {};
  const action = String(body.action || "");
  const writeKey = body.writeKey;
  switch (action) {
    case "bootstrap":
      return bootstrap_();
    case "teacherLogin":
      return teacherLogin_(String(body.teacherPin || ""), String(body.deviceLabel || ""));
    case "claimDevice":
      return claimDevice_(String(body.setupToken || ""), String(body.deviceLabel || ""));
    case "sessionStatus":
      return sessionStatus_(String(body.sessionToken || ""));
    case "createDeviceSetupToken":
      assertTeacherAuth_(body); return createDeviceSetupToken_();
    case "ping":
      if (body.sessionToken) verifyTeacherSession_(String(body.sessionToken));
      else if (writeKey !== undefined && writeKey !== "") assertWriteKey_(writeKey);
      return {
        ok:true,
        message:"Google Sheets 연결 정상",
        apiVersion:API_VERSION,
        featureVersion:FEATURE_VERSION,
        serverInstanceId:getServerInstanceId_(),
        transport:"form-post-bridge",
        spreadsheetId:getSpreadsheet_().getId(),
        time:new Date().toISOString()
      };
    case "listCourses":
      return {ok:true, courses:listRows_(SHEETS.COURSES)};
    case "listExams":
      return {ok:true, exams:listRows_(SHEETS.EXAMS)};
    case "getExam":
      return {ok:true, exam:getRowBy_(SHEETS.EXAMS,"ExamId",String(body.examId || ""))};
    case "getQuestions":
      assertTeacherAuth_(body); return {ok:true, questions:getQuestionRows_(String(body.examId || ""))};
    case "saveExam":
      assertTeacherAuth_(body); return {ok:true, exam:saveExam_(body.exam || {})};
    case "saveQuestions":
      assertTeacherAuth_(body); return {ok:true, count:saveQuestions_(String(body.examId || ""), body.questions || [])};
    case "saveQuestionAnswers":
      assertTeacherAuth_(body); return saveQuestionAnswers_(String(body.examId || ""), body.questions || [], String(body.revisionNote || ""));
    case "clearQuestionAnswerOverrides":
      assertTeacherAuth_(body); return clearQuestionAnswerOverrides_(String(body.examId || ""), body.questionNos || []);
    case "syncCatalog":
      assertTeacherAuth_(body); return syncCatalog_(body.catalog || {});
    case "saveReport":
      assertTeacherAuth_(body); return saveReport_(body.record || {});
    case "saveBatch":
      assertTeacherAuth_(body); return saveBatch_(body.records || []);
    case "getReport":
      return getReport_(String(body.token || ""), String(body.fp || ""));
    case "getStudentPortal":
      return getStudentPortal_(String(body.token || ""), String(body.fp || ""));
    case "getStudentExamDetail":
      return getStudentExamDetail_(String(body.token || ""), String(body.fp || ""), String(body.reportToken || ""));
    case "listReports":
      assertTeacherAuth_(body); return {ok:true, reports:listReports_(body), serverInstanceId:getServerInstanceId_()};
    case "listStudents":
      assertTeacherAuth_(body); return {ok:true, students:listStudents_(body), serverInstanceId:getServerInstanceId_(), featureVersion:FEATURE_VERSION};
    case "reissueStudentPortal":
      assertTeacherAuth_(body); return reissueStudentPortal_(String(body.studentId || ""));
    case "migrateStudentPortals":
      assertTeacherAuth_(body); return migrateStudentPortals_(Number(body.batchSize || 300));
    case "deleteReport":
      assertTeacherAuth_(body); return {ok:true, deleted:deleteReport_(String(body.token || ""))};
    case "getExamStats":
      return {ok:true, stats:getExamStats_(String(body.examId || ""))};
    case "checkIntegrity":
      assertTeacherAuth_(body); return checkIntegrity_();
    case "repairIntegrity":
      assertTeacherAuth_(body); return repairIntegrity_();
    case "recalculateExam":
      assertTeacherAuth_(body); return recalculateExam_(String(body.examId || ""));
    case "exportExamData":
      assertTeacherAuth_(body); return {ok:true, data:exportExamData_(String(body.examId || ""))};
    case "backupReports":
      assertTeacherAuth_(body); return backupReports_();
    case "checkStorageLocation":
      assertTeacherAuth_(body); return {ok:true, spreadsheetId:getSpreadsheet_().getId(), spreadsheetUrl:getSpreadsheet_().getUrl()};
    default:
      return {ok:false, code:"UNSUPPORTED_ACTION", error:"지원하지 않는 POST action입니다: " + action};
  }
}

function apiErrorObject_(err) {
  return {
    ok:false,
    code:String(err && err.code || "SERVER_ERROR"),
    error:String(err && err.message || err),
    data:err && err.data ? err.data : null,
    stack:String(err && err.stack || "")
  };
}

function connectThisSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("스프레드시트에 연결된 Apps Script에서 실행하세요.");
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
  initializeSheets_();
  // 학교 표기 변환은 설치와 분리한다. 기존 기록이 많아도 설치 함수가 시간 초과되지 않는다.
  return {
    spreadsheetId:ss.getId(),
    url:ss.getUrl(),
    schoolLabelsMigrated:0,
    schoolMigrationDeferred:true
  };
}

/**
 * 최초 설치용 함수.
 * 중요: Apps Script 편집기에서 실행할 때 UI alert()는 서버 실행을 일시 정지시키므로 사용하지 않는다.
 * 설치 결과와 최초 PIN은 실행 로그와 Spreadsheet toast에 비차단 방식으로 표시한다.
 * 기존 Reports의 학교 표기 변환은 migrateSchoolLabels()를 여러 번 실행하는 분할 방식으로 처리한다.
 */
function installYoungsPhysics() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new Error("다른 설치 또는 저장 작업이 진행 중입니다. 20초 후 다시 실행하세요.");
  }
  try {
    const connected = connectThisSpreadsheet();
    ensureAuthSecrets_();
    const props = PropertiesService.getScriptProperties();
    let pin = "";
    if (!props.getProperty("TEACHER_PIN_HASH")) {
      pin = generateTeacherPin_();
      setTeacherPinValue_(pin, false);
    }

    const ss = getSpreadsheet_();
    const reports = ss.getSheetByName(SHEETS.REPORTS);
    const pendingSchoolRows = reports ? Math.max(0, reports.getLastRow() - 1) : 0;
    const result = {
      ok:true,
      apiVersion:API_VERSION,
      spreadsheetId:connected.spreadsheetId,
      spreadsheetUrl:connected.url,
      schoolLabelsMigrated:0,
      schoolMigrationDeferred:pendingSchoolRows > 0,
      pendingSchoolRows:pendingSchoolRows,
      teacherPin:pin || "이미 설정됨",
      message:pin
        ? "설치 완료. 최초 교사 PIN이 생성되었습니다. 실행 로그에서 PIN을 복사하세요."
        : "설치 완료. 기존 교사 PIN을 유지했습니다."
    };

    const toastMessage = pin
      ? "설치 완료 · 교사 PIN: " + pin + " · 실행 로그에도 기록되었습니다."
      : "설치 완료 · 기존 교사 PIN을 유지했습니다.";
    try { ss.toast(toastMessage, "Young's Physics", 20); } catch (toastErr) {}
    console.log("YOUNGS_PHYSICS_INSTALL_RESULT=" + JSON.stringify(result));
    if (pin) console.log("YOUNGS_PHYSICS_TEACHER_PIN=" + pin);
    return result;
  } finally {
    lock.releaseLock();
  }
}

/** 교사 PIN을 사용자가 직접 입력해 변경한다. 기존 교사 세션은 모두 무효화된다. */
function setTeacherPin() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt("교사 PIN 설정", "8자 이상의 영문·숫자 PIN을 입력하세요.", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return {ok:false, cancelled:true};
  const pin = String(response.getResponseText() || "").trim();
  setTeacherPinValue_(pin, true);
  // alert()는 서버 실행을 일시 정지시킬 수 있으므로 비차단 toast와 로그만 사용한다.
  try { getSpreadsheet_().toast("교사 PIN이 변경되었습니다. 기존 교사 세션은 모두 해제되었습니다.", "Young's Physics", 12); } catch (toastErr) {}
  console.log("YOUNGS_PHYSICS_TEACHER_PIN_CHANGED=true");
  return {ok:true, apiVersion:API_VERSION, pinLength:pin.length};
}

/** Apps Script 편집기에서 현재 웹 앱 배포 상태와 URL을 확인한다. */
function checkWebAppDeployment() {
  const service = ScriptApp.getService();
  const props = PropertiesService.getScriptProperties();
  const result = {
    ok:true,
    apiVersion:API_VERSION,
    serviceEnabled:service.isEnabled(),
    serviceUrl:String(service.getUrl() || ""),
    spreadsheetConnected:!!props.getProperty("SPREADSHEET_ID"),
    teacherPinConfigured:!!props.getProperty("TEACHER_PIN_HASH"),
    siteOrigins:String(props.getProperty("SITE_ORIGINS") || props.getProperty("SITE_ORIGIN") || ""),
    note:"serviceEnabled가 true여도 배포 액세스 권한은 Apps Script의 배포 관리 화면에서 로그인 없이 모든 사용자로 설정해야 합니다."
  };
  console.log("YOUNGS_PHYSICS_WEBAPP_DIAGNOSTIC=" + JSON.stringify(result));
  try {
    getSpreadsheet_().toast(
      result.serviceEnabled ? "웹 앱 배포 감지됨 · 실행 로그에서 /exec URL을 확인하세요." : "웹 앱 배포가 감지되지 않습니다. 새 웹 앱 배포가 필요합니다.",
      "Young's Physics",
      15
    );
  } catch (toastErr) {}
  return result;
}

/**
 * HTML 브리지를 삽입할 수 있는 사이트 origin을 제한한다.
 * 예: https://username.github.io (저장소 경로는 제외)
 */
function setSiteOrigins() {
  const props = PropertiesService.getScriptProperties();
  const current = String(props.getProperty("SITE_ORIGINS") || props.getProperty("SITE_ORIGIN") || "").trim();
  const currentJson = JSON.stringify(current).replace(/</g, "\\u003c");
  const html = [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<style>',
    'body{font-family:Arial,"Noto Sans KR",sans-serif;margin:0;padding:22px;color:#0c2b50;background:#f7faff}',
    'h2{margin:0 0 8px;font-size:20px}',
    'p{margin:0 0 14px;line-height:1.55;color:#42566f;font-size:13px}',
    'textarea{box-sizing:border-box;width:100%;height:96px;border:1px solid #b8c9df;border-radius:10px;padding:12px;font:14px/1.5 monospace;background:#fff;resize:vertical}',
    '.hint{margin-top:8px;font-size:12px;color:#687b92}',
    '.buttons{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}',
    'button{border:0;border-radius:9px;padding:10px 15px;font-weight:700;cursor:pointer}',
    '.secondary{background:#e9f1fb;color:#0c2b50}',
    '.danger{background:#fff0f0;color:#b42318}',
    '.primary{background:#1267e8;color:#fff}',
    '#status{min-height:18px;margin-top:10px;font-size:12px;color:#1267e8}',
    '</style></head><body>',
    '<h2>GitHub Pages 허용 주소 설정</h2>',
    '<p>허용할 사이트 주소를 입력하세요. 여러 주소는 쉼표 또는 줄바꿈으로 구분합니다. 저장 시 경로는 제거되고 <b>https://도메인</b>만 남습니다.</p>',
    '<textarea id="origins" placeholder="https://username.github.io"></textarea>',
    '<div class="hint">예: https://username.github.io 또는 https://example.com</div>',
    '<div id="status"></div>',
    '<div class="buttons">',
    '<button class="danger" onclick="clearOrigins()">제한 해제</button>',
    '<button class="secondary" onclick="google.script.host.close()">취소</button>',
    '<button class="primary" onclick="saveOrigins()">저장</button>',
    '</div>',
    '<script>',
    'document.getElementById("origins").value=' + currentJson + ';',
    'function busy(message){document.getElementById("status").textContent=message;Array.prototype.forEach.call(document.querySelectorAll("button"),function(b){b.disabled=true;});}',
    'function done(result){document.getElementById("status").textContent=result&&result.siteOrigins&&result.siteOrigins.length?"저장 완료: "+result.siteOrigins.join(", "):"허용 주소 제한을 해제했습니다.";setTimeout(function(){google.script.host.close();},650);}',
    'function failed(err){document.getElementById("status").textContent="오류: "+(err&&err.message?err.message:String(err));Array.prototype.forEach.call(document.querySelectorAll("button"),function(b){b.disabled=false;});}',
    'function saveOrigins(){busy("저장 중...");google.script.run.withSuccessHandler(done).withFailureHandler(failed).saveSiteOriginsFromDialog(document.getElementById("origins").value);}',
    'function clearOrigins(){busy("제한 해제 중...");google.script.run.withSuccessHandler(done).withFailureHandler(failed).clearSiteOrigins();}',
    '<\/script></body></html>'
  ].join("");
  const output = HtmlService.createHtmlOutput(html).setWidth(560).setHeight(365);
  SpreadsheetApp.getUi().showModalDialog(output, "Young's Physics · 허용 주소");
  console.log("YOUNGS_PHYSICS_SITE_ORIGINS_DIALOG_OPENED=true");
  return {ok:true, dialogOpened:true, current:current};
}

/** 비차단 HTML 대화상자에서 전달된 값을 실제 Script Properties에 저장한다. */
function saveSiteOriginsFromDialog(raw) {
  return saveSiteOriginsValue_(raw);
}

/** 허용 origin 값을 저장한다. 빈 문자열이면 제한을 해제한다. */
function saveSiteOriginsValue_(raw) {
  const props = PropertiesService.getScriptProperties();
  const text = String(raw || "").trim();
  if (!text) {
    props.deleteProperty("SITE_ORIGINS");
    props.deleteProperty("SITE_ORIGIN");
    try { getSpreadsheet_().toast("허용 주소 제한을 해제했습니다.", "Young's Physics", 10); } catch (toastErr) {}
    console.log("YOUNGS_PHYSICS_SITE_ORIGINS=[]");
    return {ok:true, siteOrigins:[]};
  }
  const values = text.split(/[\n,;]/).map(normalizeBridgeOriginInput_).filter(String);
  if (!values.length) {
    throw new Error("허용 주소 형식이 올바르지 않습니다. https://도메인 형식으로 입력하세요.");
  }
  const unique = [];
  values.forEach(function(value) {
    if (unique.indexOf(value) < 0) unique.push(value);
  });
  props.setProperty("SITE_ORIGINS", unique.join(","));
  props.deleteProperty("SITE_ORIGIN");
  try { getSpreadsheet_().toast("허용 사이트 " + unique.length + "개를 저장했습니다.", "Young's Physics", 12); } catch (toastErr) {}
  console.log("YOUNGS_PHYSICS_SITE_ORIGINS=" + JSON.stringify(unique));
  return {ok:true, siteOrigins:unique};
}

/** UI 입력 없이 즉시 제한을 해제한다. Apps Script 편집기에서 직접 실행해도 대기하지 않는다. */
function clearSiteOrigins() {
  return saveSiteOriginsValue_("");
}

/** 무작위 교사 PIN을 새로 만들고 기존 세션을 모두 무효화한다. */
function resetTeacherPin() {
  ensureAuthSecrets_();
  const pin = generateTeacherPin_();
  setTeacherPinValue_(pin, true);
  try { getSpreadsheet_().toast("새 교사 PIN: " + pin, "Young's Physics", 20); } catch (toastErr) {}
  console.log("YOUNGS_PHYSICS_TEACHER_PIN=" + pin);
  return {ok:true, teacherPin:pin};
}

/** 모든 교사 브라우저 세션만 무효화하고 PIN은 유지한다. */
function invalidateTeacherSessions() {
  PropertiesService.getScriptProperties().setProperty("AUTH_EPOCH", randomSecret_());
  clearDeviceSetupToken_();
  return {ok:true};
}


/** Apps Script 편집기에서 직접 실행하는 초기화 편의 함수 */
function setupSheets() {
  initializeSheets_();
  return {ok:true, spreadsheetId:getSpreadsheet_().getId(), sheets:Object.keys(HEADERS)};
}

/**
 * Apps Script 편집기에서 catalog.json 전체 문자열(또는 객체)을 직접 동기화하는 편의 함수.
 * 예: syncCatalogFromJson('{"courses":[...],"exams":[...]}', '교사용 WRITE_KEY')
 */
function syncCatalogFromJson(catalogJson, writeKey) {
  assertWriteKey_(writeKey);
  const parsed = (typeof catalogJson === "string") ? JSON.parse(catalogJson) : catalogJson;
  return syncCatalog_(parsed || {});
}

function initializeSheets_() {
  const ss = getSpreadsheet_();
  Object.keys(HEADERS).forEach(function(name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    ensureSheetSchema_(sh, HEADERS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,HEADERS[name].length).setFontWeight("bold").setBackground("#0c2b50").setFontColor("#ffffff");
  });
}

/**
 * 기존 주간 복습 시스템 시트에 새 총괄평가 열을 추가할 때 데이터를 보존한다.
 * 단순히 새 헤더를 기존 열 위에 덮어쓰면 열 위치가 바뀐 Reports/Questions 데이터가
 * 손상되므로, 현재 헤더 이름을 기준으로 전체 행을 새 스키마 순서로 재배치한다.
 */
function ensureSheetSchema_(sh, targetHeaders) {
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow === 0 || lastCol === 0) {
    sh.getRange(1,1,1,targetHeaders.length).setValues([targetHeaders]);
    return;
  }

  const currentHeaders = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(v){ return String(v || "").trim(); });
  const exact = currentHeaders.length >= targetHeaders.length && targetHeaders.every(function(h,i){ return currentHeaders[i] === h; });
  if (exact) return;

  const currentIndex = {};
  currentHeaders.forEach(function(h,i){ if (h && currentIndex[h] === undefined) currentIndex[h] = i; });
  const recognized = targetHeaders.some(function(h){ return currentIndex[h] !== undefined; });
  if (!recognized) {
    throw new Error(sh.getName() + " 시트의 1행이 예상 헤더가 아닙니다. 백업 후 설치 안내서의 스키마 마이그레이션 절차를 확인하세요.");
  }

  const sourceRows = lastRow > 1 ? sh.getRange(2,1,lastRow-1,lastCol).getValues() : [];
  const remapped = sourceRows.map(function(row){
    return targetHeaders.map(function(h){
      const idx = currentIndex[h];
      return idx === undefined ? "" : row[idx];
    });
  });

  sh.clearContents();
  sh.getRange(1,1,1,targetHeaders.length).setValues([targetHeaders]);
  if (remapped.length) sh.getRange(2,1,remapped.length,targetHeaders.length).setValues(remapped);
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error("SPREADSHEET_ID가 설정되지 않았습니다. connectThisSpreadsheet()를 먼저 실행하세요.");
}

/**
 * 공개 링크가 어느 운영 Spreadsheet에서 생성되었는지 구분하기 위한 비밀이 아닌 짧은 식별자.
 * Spreadsheet ID 원문은 노출하지 않고 SHA-256 요약값의 앞부분만 사용한다.
 */
function getServerInstanceId_() {
  const id = String(getSpreadsheet_().getId() || "");
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    "youngs-physics|" + id,
    Utilities.Charset.UTF_8
  );
  return webSafeBase64_(digest).slice(0, 16);
}

function getSheet_(name) {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    if (!HEADERS[name]) throw new Error(name + " 시트를 찾을 수 없습니다.");
    sh = ss.insertSheet(name);
    ensureSheetSchema_(sh, HEADERS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,HEADERS[name].length)
      .setFontWeight("bold")
      .setBackground("#0c2b50")
      .setFontColor("#ffffff");
  }
  return sh;
}

function parseBody_(e) {
  // 기본 전송은 text/plain JSON이고, 일부 브라우저·보안 환경에서는
  // application/x-www-form-urlencoded의 payload 필드로 한 번 더 시도한다.
  // 두 형식을 모두 지원해 GitHub Pages → Apps Script 전송 호환성을 높인다.
  if (!e) return {};
  const parameterPayload = e.parameter && e.parameter.payload;
  if (parameterPayload !== undefined && parameterPayload !== "") {
    try { return JSON.parse(String(parameterPayload)); }
    catch (err) { throw new Error("요청 payload JSON을 해석할 수 없습니다."); }
  }
  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); }
    catch (err) { throw new Error("요청 JSON을 해석할 수 없습니다."); }
  }
  // 단순 form 필드 전송도 최소 호환용으로 허용한다.
  return Object.assign({}, e.parameter || {});
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function assertWriteKey_(key) {
  const saved = PropertiesService.getScriptProperties().getProperty("WRITE_KEY");
  if (!saved) throwApiError_("AUTH_REQUIRED", "구버전 WRITE_KEY가 설정되지 않았습니다. 교사 PIN으로 인증하세요.");
  if (!constantTimeEqual_(String(key || ""), String(saved))) throwApiError_("AUTH_INVALID", "WRITE_KEY가 올바르지 않습니다.");
}

function bootstrap_() {
  ensureAuthSecrets_();
  const props = PropertiesService.getScriptProperties();
  const service = ScriptApp.getService();
  return {
    ok:true,
    apiVersion:API_VERSION,
    featureVersion:FEATURE_VERSION,
    serverInstanceId:getServerInstanceId_(),
    appName:"Young's Physics 성적 분석",
    authMode:"teacher-session",
    teacherPinConfigured:!!props.getProperty("TEACHER_PIN_HASH"),
    sessionTtlDays:getSessionTtlDays_(),
    setupTokenTtlMinutes:getSetupTokenTtlMinutes_(),
    serviceEnabled:service.isEnabled(),
    serviceUrl:String(service.getUrl() || ""),
    spreadsheetConnected:!!props.getProperty("SPREADSHEET_ID"),
    serverTime:new Date().toISOString()
  };
}

function teacherLogin_(pin, deviceLabel) {
  ensureAuthSecrets_();
  if (!verifyTeacherPin_(pin)) throwApiError_("AUTH_INVALID", "교사 PIN이 올바르지 않습니다.");
  return createSessionResponse_(deviceLabel || "teacher-device");
}

function sessionStatus_(sessionToken) {
  const payload = verifyTeacherSession_(sessionToken);
  return {ok:true, authenticated:true, role:payload.role, expiresAt:new Date(Number(payload.exp)).toISOString(), sessionId:String(payload.sid || "")};
}

function createDeviceSetupToken_() {
  ensureAuthSecrets_();
  const raw = randomSecret_() + randomSecret_();
  const expiresAt = Date.now() + getSetupTokenTtlMinutes_() * 60 * 1000;
  PropertiesService.getScriptProperties().setProperties({
    DEVICE_SETUP_TOKEN_HASH:hashText_(raw),
    DEVICE_SETUP_TOKEN_EXPIRES_AT:String(expiresAt)
  });
  return {ok:true, setupToken:raw, expiresAt:new Date(expiresAt).toISOString(), oneTime:true};
}

function claimDevice_(setupToken, deviceLabel) {
  ensureAuthSecrets_();
  const props = PropertiesService.getScriptProperties();
  const savedHash = String(props.getProperty("DEVICE_SETUP_TOKEN_HASH") || "");
  const expiresAt = Number(props.getProperty("DEVICE_SETUP_TOKEN_EXPIRES_AT") || 0);
  if (!savedHash || !expiresAt) throwApiError_("SETUP_TOKEN_INVALID", "새 컴퓨터 연결 토큰이 없거나 이미 사용되었습니다.");
  if (Date.now() > expiresAt) { clearDeviceSetupToken_(); throwApiError_("SETUP_TOKEN_EXPIRED", "새 컴퓨터 연결 링크가 만료되었습니다. 기존 교사 컴퓨터에서 새 링크를 생성하세요."); }
  if (!constantTimeEqual_(hashText_(String(setupToken || "")), savedHash)) throwApiError_("SETUP_TOKEN_INVALID", "새 컴퓨터 연결 토큰이 올바르지 않습니다.");
  clearDeviceSetupToken_();
  return createSessionResponse_(deviceLabel || "claimed-device");
}

function clearDeviceSetupToken_() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty("DEVICE_SETUP_TOKEN_HASH");
  props.deleteProperty("DEVICE_SETUP_TOKEN_EXPIRES_AT");
}

function assertTeacherAuth_(body) {
  const token = String(body && body.sessionToken || "");
  if (token) return verifyTeacherSession_(token);
  // 기존 설치본과 긴급 복구를 위해 WRITE_KEY를 계속 허용하되 새 브라우저는 사용하지 않는다.
  if (body && body.writeKey !== undefined && body.writeKey !== "") {
    assertWriteKey_(body.writeKey);
    return {role:"legacy-admin", exp:Date.now()+60000};
  }
  throwApiError_("AUTH_REQUIRED", "교사 인증이 필요합니다. 교사 PIN 또는 새 컴퓨터 연결 링크로 인증하세요.");
}

function createSessionResponse_(deviceLabel) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + getSessionTtlDays_() * 24 * 60 * 60 * 1000;
  const payload = {
    v:1, role:"teacher", iat:issuedAt, exp:expiresAt,
    epoch:getAuthEpoch_(), sid:newToken_().slice(0,32),
    device:String(deviceLabel || "").slice(0,120)
  };
  const encoded = base64UrlText_(JSON.stringify(payload));
  const signature = webSafeBase64_(Utilities.computeHmacSha256Signature(encoded, getSessionSecret_()));
  return {ok:true, authenticated:true, sessionToken:encoded + "." + signature, expiresAt:new Date(expiresAt).toISOString(), role:"teacher"};
}

function verifyTeacherSession_(token) {
  ensureAuthSecrets_();
  const parts = String(token || "").split(".");
  if (parts.length !== 2) throwApiError_("AUTH_REQUIRED", "교사 세션이 없거나 형식이 올바르지 않습니다.");
  const expected = webSafeBase64_(Utilities.computeHmacSha256Signature(parts[0], getSessionSecret_()));
  if (!constantTimeEqual_(expected, parts[1])) throwApiError_("AUTH_INVALID", "교사 세션 서명이 올바르지 않습니다.");
  let payload;
  try { payload = JSON.parse(base64UrlDecodeText_(parts[0])); }
  catch (err) { throwApiError_("AUTH_INVALID", "교사 세션 정보를 읽을 수 없습니다."); }
  if (String(payload.role) !== "teacher") throwApiError_("AUTH_INVALID", "교사 권한이 없는 세션입니다.");
  if (Number(payload.exp || 0) <= Date.now()) throwApiError_("AUTH_EXPIRED", "교사 인증이 만료되었습니다. PIN으로 다시 인증하세요.");
  if (!constantTimeEqual_(String(payload.epoch || ""), getAuthEpoch_())) throwApiError_("AUTH_REVOKED", "교사 세션이 무효화되었습니다. PIN으로 다시 인증하세요.");
  return payload;
}

function ensureAuthSecrets_() {
  const props = PropertiesService.getScriptProperties();
  const updates = {};
  if (!props.getProperty("SESSION_SECRET")) updates.SESSION_SECRET = randomSecret_() + randomSecret_();
  if (!props.getProperty("FINGERPRINT_SECRET")) updates.FINGERPRINT_SECRET = randomSecret_() + randomSecret_();
  if (!props.getProperty("AUTH_EPOCH")) updates.AUTH_EPOCH = randomSecret_();
  if (Object.keys(updates).length) props.setProperties(updates);
}

function getSessionSecret_() {
  ensureAuthSecrets_();
  return String(PropertiesService.getScriptProperties().getProperty("SESSION_SECRET"));
}

function getAuthEpoch_() {
  ensureAuthSecrets_();
  return String(PropertiesService.getScriptProperties().getProperty("AUTH_EPOCH"));
}

function getSessionTtlDays_() {
  const n = Number(PropertiesService.getScriptProperties().getProperty("SESSION_TTL_DAYS") || DEFAULT_SESSION_TTL_DAYS);
  return isFinite(n) && n >= 1 && n <= 365 ? Math.floor(n) : DEFAULT_SESSION_TTL_DAYS;
}

function getSetupTokenTtlMinutes_() {
  const n = Number(PropertiesService.getScriptProperties().getProperty("SETUP_TOKEN_TTL_MINUTES") || DEFAULT_SETUP_TOKEN_TTL_MINUTES);
  return isFinite(n) && n >= 2 && n <= 60 ? Math.floor(n) : DEFAULT_SETUP_TOKEN_TTL_MINUTES;
}

function setTeacherPinValue_(pin, invalidateSessions) {
  const value = String(pin || "").trim();
  if (value.length < 8) throw new Error("교사 PIN은 8자 이상이어야 합니다.");
  ensureAuthSecrets_();
  const props = PropertiesService.getScriptProperties();
  const salt = randomSecret_();
  props.setProperties({TEACHER_PIN_SALT:salt, TEACHER_PIN_HASH:hashText_(salt + "|" + value)});
  if (invalidateSessions) invalidateTeacherSessions();
}

function verifyTeacherPin_(pin) {
  const props = PropertiesService.getScriptProperties();
  const hash = String(props.getProperty("TEACHER_PIN_HASH") || "");
  const salt = String(props.getProperty("TEACHER_PIN_SALT") || "");
  if (!hash || !salt) throwApiError_("PIN_NOT_CONFIGURED", "교사 PIN이 설정되지 않았습니다. Apps Script에서 installYoungsPhysics()를 실행하세요.");
  return constantTimeEqual_(hashText_(salt + "|" + String(pin || "").trim()), hash);
}

function generateTeacherPin_() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const source = (randomSecret_() + randomSecret_()).replace(/[^A-Za-z0-9]/g, "");
  let out = "";
  for (let i=0;i<10;i++) out += chars.charAt(source.charCodeAt(i % source.length) % chars.length);
  return out;
}

function randomSecret_() {
  return Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
}

function hashText_(text) {
  return webSafeBase64_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ""), Utilities.Charset.UTF_8));
}

function base64UrlText_(text) {
  return webSafeBase64_(Utilities.newBlob(String(text || ""), "text/plain").getBytes());
}

function base64UrlDecodeText_(text) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(String(text || ""))).getDataAsString("UTF-8");
}

function throwApiError_(code, message, data) {
  const err = new Error(message);
  err.code = code;
  if (data !== undefined) err.data = data;
  throw err;
}

function constantTimeEqual_(a,b) {
  if (a.length !== b.length) return false;
  let out = 0; for (let i=0;i<a.length;i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function listRows_(sheetName) {
  const sh = getSheet_(sheetName);
  if (sh.getLastRow() < 2) return [];
  const values = sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();
  const headers = values.shift();
  return values.filter(r=>r.some(v=>v!=="")).map(r=>rowToObject_(headers,r));
}

function rowToObject_(headers,row) {
  const out={}; headers.forEach(function(h,i){ out[h]=serializeCell_(row[i]); }); return out;
}

function serializeCell_(v) {
  if (v instanceof Date) return v.toISOString();
  return v;
}

function getRowBy_(sheetName,key,value) {
  const rows=listRows_(sheetName); return rows.find(function(r){return String(r[key])===String(value);}) || null;
}

function upsertObject_(sheetName,keyName,obj) {
  const sh=getSheet_(sheetName),headers=HEADERS[sheetName],keyIndex=headers.indexOf(keyName);
  if (keyIndex<0) throw new Error("키 열이 없습니다: "+keyName);
  let rowNo=-1;
  if (sh.getLastRow()>=2) {
    const keys=sh.getRange(2,keyIndex+1,sh.getLastRow()-1,1).getValues().flat().map(String);
    const i=keys.indexOf(String(obj[keyName])); if(i>=0) rowNo=i+2;
  }
  const row=headers.map(h=>obj[h]===undefined?"":obj[h]);
  if(rowNo>0) sh.getRange(rowNo,1,1,headers.length).setValues([row]); else {rowNo=sh.getLastRow()+1;sh.getRange(rowNo,1,1,headers.length).setValues([row]);}
  return rowNo;
}

function syncCatalog_(catalog) {
  if (!catalog || !Array.isArray(catalog.courses) || !Array.isArray(catalog.exams)) throw new Error("catalog 형식이 올바르지 않습니다.");
  initializeSheets_();
  // 자료가 아직 정적 카탈로그에 포함되지 않은 준비 중 시험은 기존 Questions 행을 보존한다.
  // 이를 통해 물리1심화·물리2심화 총괄 문항을 먼저 Sheets에 등록한 운영본도
  // 입력 정책만 갱신할 때 문항 데이터가 사라지지 않는다.
  const existingQuestionRowsByExam={};
  listRows_(SHEETS.QUESTIONS).forEach(function(row){
    const id=String(row.ExamId||"");if(!id)return;
    if(!existingQuestionRowsByExam[id])existingQuestionRowsByExam[id]=[];
    existingQuestionRowsByExam[id].push(row);
  });
  const courseRows=catalog.courses.map(c=>[c.courseId,c.courseName,c.active!==false]);
  replaceData_(SHEETS.COURSES,courseRows);
  const examRows=[],questionRows=[];
  catalog.exams.forEach(function(ex){
    examRows.push([ex.examId,ex.courseId,ex.round,ex.title,ex.shortTitle||"",ex.assessmentType||"weekly",ex.section||"",ex.examDate||"",ex.questionCount||0,ex.maxScore||0,ex.pdf||"",ex.solutionPdf||"",ex.reviewStatus||"",ex.configVersion||"",ex.status||"",JSON.stringify(ex.pages||[]),JSON.stringify(ex.coreNote||{}),JSON.stringify(ex.inputProfile||{}),JSON.stringify(ex.historyExamIds||[]),ex.historyLabel||"",ex.sourceTitle||"",ex.sourceNote||"",ex.displayOrder||""]);
    const staticQuestions=Array.isArray(ex.questions)?ex.questions:[];
    if(staticQuestions.length){
      staticQuestions.forEach(function(q){
        questionRows.push([ex.examId,q.no,q.type,q.inputMode||"achievement",q.maxPoints,q.unit,q.topic,q.difficulty,JSON.stringify({display:q.answer,answerKey:q.answerKey,acceptableAnswers:q.acceptableAnswers||[]}),JSON.stringify(q.rubric||[]),JSON.stringify({steps:q.explanation||[],formulas:q.formulas||[],commonMistakes:q.commonMistakes||[]}),JSON.stringify(q.originalRetry||{}),JSON.stringify(q.similarProblem||{}),q.reviewStatus||"",q.correctionNote||"",JSON.stringify(q.image||{})]);
      });
    } else {
      (existingQuestionRowsByExam[String(ex.examId)]||[]).forEach(function(row){
        questionRows.push(HEADERS.Questions.map(function(h){return row[h]===undefined?"":row[h];}));
      });
    }
  });
  replaceData_(SHEETS.EXAMS,examRows);
  replaceData_(SHEETS.QUESTIONS,questionRows);
  return {ok:true,courses:courseRows.length,exams:examRows.length,questions:questionRows.length};
}

function replaceData_(sheetName,rows) {
  const sh=getSheet_(sheetName),headers=HEADERS[sheetName];
  if(sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,Math.max(sh.getLastColumn(),headers.length)).clearContent();
  if(rows.length) sh.getRange(2,1,rows.length,headers.length).setValues(rows);
  sh.autoResizeColumns(1,Math.min(headers.length,8));
}

function saveExam_(ex) {
  if(!ex.examId||!ex.courseId) throw new Error("examId와 courseId가 필요합니다.");
  const obj={ExamId:ex.examId,CourseId:ex.courseId,Round:ex.round||"",Title:ex.title||"",ShortTitle:ex.shortTitle||"",AssessmentType:ex.assessmentType||"weekly",Section:ex.section||"",ExamDate:ex.examDate||"",QuestionCount:ex.questionCount||0,MaxScore:ex.maxScore||0,ExamPDF:ex.pdf||"",SolutionPDF:ex.solutionPdf||"",ReviewStatus:ex.reviewStatus||"",ConfigVersion:ex.configVersion||"",Status:ex.status||"ready",PagesJSON:JSON.stringify(ex.pages||[]),CoreNoteJSON:JSON.stringify(ex.coreNote||{}),InputProfileJSON:JSON.stringify(ex.inputProfile||{}),HistoryExamIdsJSON:JSON.stringify(ex.historyExamIds||[]),HistoryLabel:ex.historyLabel||"",SourceTitle:ex.sourceTitle||"",SourceNote:ex.sourceNote||"",DisplayOrder:ex.displayOrder||""};
  upsertObject_(SHEETS.EXAMS,"ExamId",obj); return obj;
}

function saveQuestions_(examId,questions) {
  if(!examId) throw new Error("examId가 필요합니다.");
  const sh=getSheet_(SHEETS.QUESTIONS),headers=HEADERS.Questions;
  if(sh.getLastRow()>1){
    const ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat();
    for(let i=ids.length-1;i>=0;i--) if(String(ids[i])===examId) sh.deleteRow(i+2);
  }
  const rows=(questions||[]).map(q=>[examId,q.no,q.type,q.inputMode||"achievement",q.maxPoints,q.unit,q.topic,q.difficulty,JSON.stringify({display:q.answer,answerKey:q.answerKey,acceptableAnswers:q.acceptableAnswers||[]}),JSON.stringify(q.rubric||[]),JSON.stringify({steps:q.explanation||[],formulas:q.formulas||[],commonMistakes:q.commonMistakes||[]}),JSON.stringify(q.originalRetry||{}),JSON.stringify(q.similarProblem||{}),q.reviewStatus||"",q.correctionNote||"",JSON.stringify(q.image||{})]);
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,headers.length).setValues(rows);
  return rows.length;
}

function getBaseQuestionRows_(examId) {
  return listRows_(SHEETS.QUESTIONS)
    .filter(function(r){return String(r.ExamId)===String(examId);})
    .sort(function(a,b){return Number(a.QuestionNo)-Number(b.QuestionNo);});
}

function getQuestionOverrideRows_(examId) {
  return listRows_(SHEETS.QUESTION_OVERRIDES)
    .filter(function(r){return String(r.ExamId)===String(examId);})
    .sort(function(a,b){return Number(a.QuestionNo)-Number(b.QuestionNo);});
}

/**
 * Questions 시트는 배포 카탈로그의 검수 원본이고 QuestionOverrides 시트는
 * 홈페이지에서 교사가 수정한 정답·보기만 보존한다. 카탈로그를 다시 동기화해도
 * 운영 중 수정값이 사라지지 않도록 조회 시 두 시트를 합친다.
 */
function getQuestionRows_(examId) {
  const base=getBaseQuestionRows_(examId);
  if(!base.length)return [];
  const overrideMap={};
  getQuestionOverrideRows_(examId).forEach(function(row){overrideMap[String(Number(row.QuestionNo))]=row;});
  return base.map(function(row){
    const override=overrideMap[String(Number(row.QuestionNo))];
    if(!override)return row;
    const merged=Object.assign({},row);
    if(String(override.AnswerJSON||"").trim()!=="")merged.AnswerJSON=override.AnswerJSON;
    ["OriginalRetryJSON","SimilarProblemJSON"].forEach(function(key){
      const raw=String(override[key]||"").trim();
      if(!raw)return;
      const normalized=normalizeChoiceConfigSafe_(safeJson_(raw,{}));
      // 구버전 자유입력·불완전 보기 수정본은 원본 객관식 보기로 자동 복귀한다.
      if(normalized)merged[key]=JSON.stringify(normalized);
    });
    merged.OverrideUpdatedAt=override.UpdatedAt||"";
    merged.OverrideRevisionNote=override.RevisionNote||"";
    return merged;
  });
}

function normalizeChoiceConfigSafe_(config) {
  try{return validateChoiceConfig_(config,"객관식 재도전");}catch(error){return null;}
}

function validateChoiceConfig_(config,label) {
  const value=config&&typeof config==="object"?config:{};
  const choices=(value.choices||[]).map(function(x){return String(x==null?"":x).trim();}).filter(function(x){return x!=="";});
  if(choices.length!==4&&choices.length!==5)throwApiError_("ANSWER_CHOICES_INVALID",label+" 보기는 4개 또는 5개여야 합니다.");
  const normalized=choices.map(function(x){return x.replace(/\s+/g," ").toLowerCase();});
  if(new Set(normalized).size!==normalized.length)throwApiError_("ANSWER_CHOICES_DUPLICATE",label+" 보기에는 같은 내용이 중복될 수 없습니다.");
  const correctChoice=Number(value.correctChoice||value.answer||0);
  if(!Number.isInteger(correctChoice)||correctChoice<1||correctChoice>choices.length)throwApiError_("ANSWER_CORRECT_CHOICE_INVALID",label+" 정답 보기 번호가 유효하지 않습니다.");
  return Object.assign({},value,{inputMode:"choice",choices:choices,correctChoice:correctChoice,answer:choices[correctChoice-1],acceptableAnswers:[String(correctChoice),choices[correctChoice-1]]});
}

function upsertQuestionOverride_(obj) {
  const sh=getSheet_(SHEETS.QUESTION_OVERRIDES),headers=HEADERS.QuestionOverrides;
  const examId=String(obj.ExamId||""),questionNo=Number(obj.QuestionNo);
  let rowNumber=0;
  if(sh.getLastRow()>=2){
    const rows=sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
    for(let i=0;i<rows.length;i++){
      if(String(rows[i][0])===examId&&Number(rows[i][1])===questionNo){rowNumber=i+2;break;}
    }
  }
  const row=headers.map(function(h){return obj[h]===undefined?"":obj[h];});
  if(rowNumber)sh.getRange(rowNumber,1,1,headers.length).setValues([row]);
  else{rowNumber=sh.getLastRow()+1;sh.getRange(rowNumber,1,1,headers.length).setValues([row]);}
  return rowNumber;
}

/** 홈페이지 정답 관리 화면에서 수정한 정답·재도전 보기·동형 문제 보기를 저장한다. */
function saveQuestionAnswers_(examId,questions,revisionNote) {
  examId=String(examId||"").trim();
  if(!examId)throwApiError_("EXAM_ID_REQUIRED","examId가 필요합니다.");
  if(!Array.isArray(questions)||!questions.length)throwApiError_("QUESTION_ANSWERS_REQUIRED","저장할 문항 정답이 없습니다.");
  const baseRows=getBaseQuestionRows_(examId);
  if(!baseRows.length)throwApiError_("QUESTIONS_NOT_FOUND","시험 문항을 찾을 수 없습니다. 시험 설정 서버 동기화를 먼저 실행하세요.");
  const baseMap={};baseRows.forEach(function(row){baseMap[String(Number(row.QuestionNo))]=row;});
  const now=new Date();
  const saved=[];
  questions.forEach(function(item){
    const no=Number(item&&item.no);
    if(!Number.isInteger(no)||no<1||!baseMap[String(no)])throwApiError_("QUESTION_NO_INVALID","등록되지 않은 문항 번호가 포함되어 있습니다: "+String(item&&item.no));
    const display=String(item.answer==null?"":item.answer).trim();
    if(!display)throwApiError_("ANSWER_REQUIRED",no+"번 공식 정답을 입력하세요.");
    const baseAnswer=safeJson_(baseMap[String(no)].AnswerJSON,{});
    const rawAnswerKey=item.answerKey===undefined||item.answerKey===null||item.answerKey===""?baseAnswer.answerKey:Number(item.answerKey);
    if(rawAnswerKey!==undefined&&rawAnswerKey!==null&&rawAnswerKey!==""&&(!Number.isInteger(Number(rawAnswerKey))||Number(rawAnswerKey)<1||Number(rawAnswerKey)>5)){
      throwApiError_("ANSWER_KEY_INVALID",no+"번 객관식 정답 번호는 1~5여야 합니다.");
    }
    const originalRetry=validateChoiceConfig_(item.originalRetry,no+"번 원문 재도전");
    const similarProblem=validateChoiceConfig_(item.similarProblem,no+"번 동형 문제");
    const acceptable=Array.isArray(item.acceptableAnswers)?item.acceptableAnswers:baseAnswer.acceptableAnswers||[];
    const answerJson={display:display,answerKey:rawAnswerKey===""?null:rawAnswerKey,acceptableAnswers:acceptable};
    const obj={
      ExamId:examId,
      QuestionNo:no,
      AnswerJSON:JSON.stringify(answerJson),
      OriginalRetryJSON:JSON.stringify(originalRetry),
      SimilarProblemJSON:JSON.stringify(similarProblem),
      RevisionNote:String(item.revisionNote||revisionNote||"").trim(),
      UpdatedAt:now
    };
    upsertQuestionOverride_(obj);saved.push(no);
  });
  return {ok:true,examId:examId,count:saved.length,questionNos:saved,questions:getQuestionRows_(examId),updatedAt:now.toISOString()};
}

function clearQuestionAnswerOverrides_(examId,questionNos) {
  examId=String(examId||"").trim();
  if(!examId)throwApiError_("EXAM_ID_REQUIRED","examId가 필요합니다.");
  const selected=new Set((Array.isArray(questionNos)?questionNos:[]).map(Number).filter(function(n){return Number.isInteger(n)&&n>0;}));
  const sh=getSheet_(SHEETS.QUESTION_OVERRIDES);let deleted=0;
  if(sh.getLastRow()>=2){
    const rows=sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
    for(let i=rows.length-1;i>=0;i--){
      if(String(rows[i][0])===examId&&(!selected.size||selected.has(Number(rows[i][1])))){sh.deleteRow(i+2);deleted++;}
    }
  }
  return {ok:true,examId:examId,deleted:deleted,questions:getQuestionRows_(examId)};
}

function parseQuestionRange_(value) {
  const m=String(value||"").trim().match(/^(\d+)\s*(?:-|~|–|—)\s*(\d+)$/);
  if(!m)return null;
  const start=Number(m[1]),end=Number(m[2]);
  return Number.isInteger(start)&&Number.isInteger(end)&&start>0&&end>=start?{start:start,end:end}:null;
}

function objectiveChoiceRange_(exam) {
  if(!exam||String(exam.AssessmentType||"")!=="comprehensive")return null;
  const profile=safeJson_(exam.InputProfileJSON,{});
  if(String(profile.objectiveMode||"")!=="choice-number")return null;
  return parseQuestionRange_(profile.objectiveRange);
}

function isComprehensiveChoiceExam_(exam) {
  return !!objectiveChoiceRange_(exam);
}

function effectiveInputMode_(exam,question) {
  const mode=String(question&&question.InputMode||"achievement");
  const no=Number(question&&question.QuestionNo),range=objectiveChoiceRange_(exam);
  if(range&&Number.isInteger(no)&&no>=range.start&&no<=range.end)return "objective-choice";
  return mode;
}

function parseScore_(raw,maxPoints,partialMode,inputMode,answerKey,inputEncoding) {
  const text=raw===null||raw===undefined?"":String(raw).trim(),mode=String(inputMode||"achievement"),encoding=String(inputEncoding||"");
  if(text==="") return {raw:String(raw||""),status:"ungraded",score:null,valid:true};
  const marker=text.toLowerCase().replace(/\s+/g,"");
  const correctMarkers=["o","○","⭕","맞음","정답","correct","true"];
  const wrongMarkers=["x","×","✕","틀림","오답","wrong","false"];
  const n=Number(text.replace(/,/g,""));
  if(mode==="objective-choice") {
    const key=Number(answerKey);
    if(!Number.isInteger(key)||key<1||key>5)return {raw:text,status:"invalid",score:null,valid:false,error:"공식 정답 번호를 찾지 못했습니다."};
    if(correctMarkers.indexOf(marker)>=0)return {raw:text,status:"full",score:Number(maxPoints),valid:true,answerKey:key,legacyMarker:"O"};
    if(wrongMarkers.indexOf(marker)>=0||text==="0")return {raw:text,status:"wrong",score:0,valid:true,answerKey:key,legacyMarker:"X"};
    if(encoding==="legacy-binary"){
      if(n===1)return {raw:text,status:"full",score:Number(maxPoints),valid:true,answerKey:key,legacyMarker:"O"};
      if(n===0)return {raw:text,status:"wrong",score:0,valid:true,answerKey:key,legacyMarker:"X"};
      return {raw:text,status:"invalid",score:null,valid:false,error:"구형 정오표는 0/1 또는 O/X여야 합니다."};
    }
    if(!Number.isInteger(n)||n<1||n>5)return {raw:text,status:"invalid",score:null,valid:false,error:"객관식 선택 번호는 1~5 중 하나여야 합니다."};
    const correct=n===key;
    return {raw:text,status:correct?"full":"wrong",score:correct?Number(maxPoints):0,valid:true,selectedChoice:n,answerKey:key};
  }
  if(mode==="binary") {
    if(correctMarkers.indexOf(marker)>=0)return {raw:text,status:"full",score:Number(maxPoints),valid:true,legacyMarker:"O"};
    if(wrongMarkers.indexOf(marker)>=0)return {raw:text,status:"wrong",score:0,valid:true,legacyMarker:"X"};
    if(!isFinite(n)||(n!==0&&n!==1)) return {raw:text,status:"invalid",score:null,valid:false,error:"객관식은 0 또는 1만 입력합니다."};
    return n===1?{raw:text,status:"full",score:Number(maxPoints),valid:true}:{raw:text,status:"wrong",score:0,valid:true};
  }
  if(mode==="points") {
    if(!isFinite(n)||n<0||n>Number(maxPoints)) return {raw:text,status:"invalid",score:null,valid:false,error:"서술형 점수는 0~"+maxPoints+"점이어야 합니다."};
    if(n===0) return {raw:text,status:"wrong",score:0,valid:true};
    if(Math.abs(n-Number(maxPoints))<1e-9) return {raw:text,status:"full",score:Number(maxPoints),valid:true};
    return {raw:text,status:"partial",score:n,valid:true};
  }
  if(/^p\s*1$/i.test(text)||text==="1점") return {raw:text,status:Number(maxPoints)===1?"full":"partial",score:1,valid:true};
  if(!isFinite(n)) return {raw:text,status:"invalid",score:null,valid:false,error:"숫자가 아닙니다."};
  if(n<0||n>Number(maxPoints)) return {raw:text,status:"invalid",score:null,valid:false,error:"배점 범위를 벗어났습니다."};
  if(n===0) return {raw:text,status:"wrong",score:0,valid:true};
  if(n===1&&!partialMode) return {raw:text,status:"full",score:Number(maxPoints),valid:true};
  if(Math.abs(n-Number(maxPoints))<1e-9) return {raw:text,status:"full",score:Number(maxPoints),valid:true};
  return {raw:text,status:"partial",score:n,valid:true};
}

function calculateScoringFromQuestions_(questions,inputs,partialModes,exam,inputEncoding) {
  if(!questions||!questions.length) throw new Error("Questions 시트에 시험 문항이 없습니다. 먼저 시험 설정을 동기화하세요.");
  if((inputs||[]).length>questions.length) throw new Error("입력값이 시험 문항 수보다 많습니다.");
  const scoring=questions.map(function(q,i){
    const answer=safeJson_(q.AnswerJSON,{}),mode=effectiveInputMode_(exam,q);
    const p=parseScore_((inputs||[])[i],Number(q.MaxPoints),(partialModes||[])[i]===true,mode,answer.answerKey,inputEncoding);
    p.questionNo=Number(q.QuestionNo);p.maxPoints=Number(q.MaxPoints);p.unit=q.Unit;p.topic=q.Topic;p.inputMode=mode;
    return p;
  });
  const invalid=scoring.filter(function(x){return !x.valid;});
  if(invalid.length) throw new Error("점수 입력 오류: "+invalid.map(function(x){return x.questionNo+"번";}).join(", "));
  const score=scoring.reduce(function(a,x){return a+(x.score===null?0:Number(x.score));},0);
  const maxScore=questions.reduce(function(a,q){return a+Number(q.MaxPoints);},0);
  const counts={full:0,partial:0,wrong:0,ungraded:0};scoring.forEach(function(x){counts[x.status]=(counts[x.status]||0)+1;});
  return {scoring:scoring,score:score,maxScore:maxScore,percent:maxScore?score/maxScore*100:0,counts:counts};
}

function calculateScoring_(examId,inputs,partialModes,inputEncoding) {
  const exam=getRowBy_(SHEETS.EXAMS,"ExamId",String(examId||""));
  return calculateScoringFromQuestions_(getQuestionRows_(examId),inputs,partialModes,exam,inputEncoding);
}

function saveReport_(input) {
  ensureStudentPortalSchema_();
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const exam=getRowBy_(SHEETS.EXAMS,"ExamId",String(input.examId||""));
    if(!exam) throw new Error("등록되지 않은 시험입니다.");
    if(String(exam.Status)!=="ready") throw new Error("아직 준비 중인 시험입니다.");
    let name=String(input.name||"").trim();if(!name) throw new Error("학생 이름이 필요합니다.");
    const school=normalizeSchool_(input.school);
    const sh=getSheet_(SHEETS.REPORTS),headers=HEADERS.Reports;
    const data=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues():[];
    const objects=data.map(function(row){return rowToObject_(headers,row);});
    let rowIndex=-1,old=null;
    if(input.token){
      rowIndex=objects.findIndex(function(r){return String(r.Token)===String(input.token);});
      if(rowIndex<0) throw new Error("수정할 서버 토큰을 찾지 못했습니다.");
      old=objects[rowIndex];
    } else if(String(input.importMode||"")==="upsert") {
      const key=reportIdentityKey_(input.examId,school,name);
      rowIndex=objects.findIndex(function(r){return reportIdentityKey_(r.ExamId,r.School,r.Name)===key;});
      if(rowIndex>=0) old=objects[rowIndex];
    }
    if(!old){
      const used=new Set(objects.filter(function(r){return String(r.ExamId)===String(input.examId)&&normalizeIdentity_(normalizeSchool_(r.School))===normalizeIdentity_(school);}).map(function(r){return String(r.Name);}));
      const base=name;let n=1;while(used.has(name)){n++;name=base+n;}
    }
    const previousRecord=old?safeJson_(old.RecordJSON,{}):{},store=loadStudentStore_();
    const profile=resolveStudentProfileInStore_(store,{studentId:String(input.studentId||old&&old.StudentId||previousRecord.studentId||""),school:school,name:name,grade:String(input.grade||""),classNo:String(input.classNo||""),externalStudentId:String(input.externalStudentId||""),forceNewStudent:input.forceNewStudent===true},String(input.studentId||old&&old.StudentId||previousRecord.studentId||""));
    persistStudentStore_(store);
    const now=new Date(),token=old?String(old.Token):newToken_(),seed=old?String(old.IdentitySeed):newToken_();
    const fingerprint=old?String(old.Fingerprint):makeFingerprint_(token,seed),courseId=String(exam.CourseId),identityDigest=makeIdentityDigest_(input.examId,courseId,school,name),studentKey=makeStudentKey_(courseId,school,name);
    const effectiveEncoding=String(input.inputEncoding||previousRecord.inputEncoding||(old?"legacy-binary":isComprehensiveChoiceExam_(exam)?"objective-choice-v1":""));
    const calc=calculateScoring_(String(input.examId),input.resultInputs||[],input.partialModes||[],effectiveEncoding);
    const record={
      token:token,fingerprint:fingerprint,studentId:profile.StudentId,studentKey:studentKey,examId:String(input.examId),courseId:courseId,school:school,name:name,
      grade:String(input.grade||""),classNo:String(input.classNo||""),teacherMemo:String(input.teacherMemo||""),
      resultInputs:input.resultInputs||[],partialModes:input.partialModes||[],scoring:calc.scoring,score:calc.score,maxScore:calc.maxScore,
      percent:calc.percent,counts:calc.counts,inputEncoding:effectiveEncoding,createdAt:old?serializeCell_(old.CreatedAt):now.toISOString(),updatedAt:now.toISOString()
    };
    if(input.importSource) record.importSource=input.importSource;
    else if(previousRecord.importSource) record.importSource=previousRecord.importSource;
    const row=[token,fingerprint,seed,identityDigest,studentKey,record.examId,courseId,school,name,record.grade,record.classNo,JSON.stringify(record.resultInputs),JSON.stringify(record.partialModes),JSON.stringify(calc.scoring),JSON.stringify(record),old?old.CreatedAt:now,now,profile.StudentId];
    if(rowIndex>=0) sh.getRange(rowIndex+2,1,1,headers.length).setValues([row]); else sh.getRange(sh.getLastRow()+1,1,1,headers.length).setValues([row]);
    const stats=getExamStats_(record.examId);
    return {ok:true,record:record,stats:stats,historyRecords:getLinkedHistoryRecords_(record),studentPortal:studentPortalSummary_(profile),token:token,fp:fingerprint,displayName:name,created:!old,updated:!!old,serverInstanceId:getServerInstanceId_(),featureVersion:FEATURE_VERSION};
  } finally { lock.releaseLock(); }
}

function saveBatch_(records) {
  ensureStudentPortalSchema_();
  if(!Array.isArray(records)||!records.length) return {ok:true,saved:[],savedCount:0,createdCount:0,updatedCount:0,failed:[],statsByExam:{},students:[]};
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  const touched={},saved=[],failed=[];let createdCount=0,updatedCount=0;
  try {
    const sh=getSheet_(SHEETS.REPORTS),headers=HEADERS.Reports;
    const data=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues():[];
    const examCache={},questionCache={},tokenIndex={},identityIndex={},namesByGroup={},studentStore=loadStudentStore_(),portalsByStudent={};
    data.forEach(function(row,i){
      const o=rowToObject_(headers,row),school=normalizeSchool_(o.School),group=[String(o.ExamId),normalizeIdentity_(school)].join("|");
      tokenIndex[String(o.Token)]=i;identityIndex[reportIdentityKey_(o.ExamId,school,o.Name)]=i;
      if(!namesByGroup[group]) namesByGroup[group]=new Set();namesByGroup[group].add(String(o.Name));
    });
    records.forEach(function(raw,batchIndex){
      const input=raw||{};
      try {
        const examId=String(input.examId||"");
        if(!examCache[examId]) examCache[examId]=getRowBy_(SHEETS.EXAMS,"ExamId",examId);
        const exam=examCache[examId];if(!exam) throw new Error("등록되지 않은 시험입니다.");if(String(exam.Status)!=="ready") throw new Error("아직 준비 중인 시험입니다.");
        if(!questionCache[examId]) questionCache[examId]=getQuestionRows_(examId);
        let name=String(input.name||"").trim();if(!name) throw new Error("학생 이름이 필요합니다.");
        const school=normalizeSchool_(input.school);
        let rowIndex=-1,old=null;
        if(input.token){rowIndex=Object.prototype.hasOwnProperty.call(tokenIndex,String(input.token))?tokenIndex[String(input.token)]:-1;if(rowIndex<0)throw new Error("수정할 서버 토큰을 찾지 못했습니다.");old=rowToObject_(headers,data[rowIndex]);}
        else if(String(input.importMode||"upsert")==="upsert") {const key=reportIdentityKey_(examId,school,name);if(Object.prototype.hasOwnProperty.call(identityIndex,key)){rowIndex=identityIndex[key];old=rowToObject_(headers,data[rowIndex]);}}
        const group=[examId,normalizeIdentity_(school)].join("|");if(!namesByGroup[group])namesByGroup[group]=new Set();
        if(!old&&String(input.importMode||"upsert")!=="upsert"){const base=name;let n=1;while(namesByGroup[group].has(name)){n++;name=base+n;}}
        const previousRecord=old?safeJson_(old.RecordJSON,{}):{},preferred=String(input.studentId||old&&old.StudentId||previousRecord.studentId||"");
        const profile=resolveStudentProfileInStore_(studentStore,{studentId:preferred,school:school,name:name,grade:String(input.grade||""),classNo:String(input.classNo||""),externalStudentId:String(input.externalStudentId||""),forceNewStudent:input.forceNewStudent===true},preferred);portalsByStudent[profile.StudentId]=studentPortalSummary_(profile);
        const now=new Date(),token=old?String(old.Token):newToken_(),seed=old?String(old.IdentitySeed):newToken_(),fingerprint=old?String(old.Fingerprint):makeFingerprint_(token,seed),courseId=String(exam.CourseId),identityDigest=makeIdentityDigest_(examId,courseId,school,name),studentKey=makeStudentKey_(courseId,school,name);
        const effectiveEncoding=String(input.inputEncoding||previousRecord.inputEncoding||(old?"legacy-binary":isComprehensiveChoiceExam_(exam)?"objective-choice-v1":""));
        const calc=calculateScoringFromQuestions_(questionCache[examId],input.resultInputs||[],input.partialModes||[],exam,effectiveEncoding);
        const record={token:token,fingerprint:fingerprint,studentId:profile.StudentId,studentKey:studentKey,examId:examId,courseId:courseId,school:school,name:name,grade:String(input.grade||""),classNo:String(input.classNo||""),teacherMemo:String(input.teacherMemo||""),resultInputs:input.resultInputs||[],partialModes:input.partialModes||[],scoring:calc.scoring,score:calc.score,maxScore:calc.maxScore,percent:calc.percent,counts:calc.counts,inputEncoding:effectiveEncoding,createdAt:old?serializeCell_(old.CreatedAt):now.toISOString(),updatedAt:now.toISOString()};
        if(input.importSource)record.importSource=input.importSource;else if(previousRecord.importSource)record.importSource=previousRecord.importSource;
        const row=[token,fingerprint,seed,identityDigest,studentKey,examId,courseId,school,name,record.grade,record.classNo,JSON.stringify(record.resultInputs),JSON.stringify(record.partialModes),JSON.stringify(calc.scoring),JSON.stringify(record),old?old.CreatedAt:now,now,profile.StudentId];
        if(rowIndex>=0){data[rowIndex]=row;updatedCount++;}else{rowIndex=data.length;data.push(row);createdCount++;}
        tokenIndex[token]=rowIndex;identityIndex[reportIdentityKey_(examId,school,name)]=rowIndex;namesByGroup[group].add(name);touched[examId]=true;
        saved.push({token:token,fingerprint:fingerprint,studentId:profile.StudentId,portalToken:profile.PortalToken,portalFingerprint:profile.PortalFingerprint,examId:examId,courseId:courseId,school:school,name:name,score:calc.score,maxScore:calc.maxScore,updatedAt:record.updatedAt});
      } catch(err) {
        failed.push({index:batchIndex+1,name:String(input.name||""),sourceRow:input.importSource&&input.importSource.sourceRow||"",error:String(err&&err.message||err)});
      }
    });
    if(saved.length){
      const needed=data.length+1;if(sh.getMaxRows()<needed)sh.insertRowsAfter(sh.getMaxRows(),needed-sh.getMaxRows());
      sh.getRange(2,1,data.length,headers.length).setValues(data);
      persistStudentStore_(studentStore);
    }
  } finally { lock.releaseLock(); }
  const statsByExam={};Object.keys(touched).forEach(function(examId){statsByExam[examId]=getExamStats_(examId);});
  const studentMap={};saved.forEach(function(r){if(!studentMap[r.studentId])studentMap[r.studentId]={studentId:r.studentId,portalToken:r.portalToken,portalFingerprint:r.portalFingerprint,school:r.school,name:r.name};});
  return {ok:true,saved:saved,savedCount:saved.length,createdCount:createdCount,updatedCount:updatedCount,failed:failed,statsByExam:statsByExam,students:Object.keys(studentMap).map(function(k){return studentMap[k];}),serverInstanceId:getServerInstanceId_(),featureVersion:FEATURE_VERSION};
}


function newToken_() {
  return Utilities.getUuid().replace(/-/g,"") + Utilities.getUuid().replace(/-/g,"").slice(0,8);
}

function secret_() {
  ensureAuthSecrets_();
  const p=PropertiesService.getScriptProperties();
  return p.getProperty("FINGERPRINT_SECRET") || p.getProperty("WRITE_KEY") || getSessionSecret_();
}

function makeFingerprint_(token,seed) {
  const sig=Utilities.computeHmacSha256Signature(String(token)+"|"+String(seed),secret_());
  return webSafeBase64_(sig);
}

function normalizeIdentity_(value) {
  return String(value||"").trim().toLowerCase().replace(/\s+/g,"").replace(/[()\[\]{}\-_.]/g,"");
}

/** 학교가 비어 있거나 구버전 표기인 경우 최신 표기인 '미기입'으로 통일한다. */
function normalizeSchool_(value) {
  const school=String(value||"").trim();
  return !school||school==="미입력"||school==="미기입" ? "미기입" : school;
}

function schoolIdentityVariants_(value) {
  const raw=String(value||"").trim(),canonical=normalizeSchool_(raw),values=[raw,canonical];
  if(canonical==="미기입") values.push("","미입력","미기입");
  return values.filter(function(v,i,a){return a.indexOf(v)===i;});
}

function reportIdentityKey_(examId,school,name) {
  return [String(examId||""),normalizeIdentity_(normalizeSchool_(school)),normalizeIdentity_(name)].join("|");
}

function makeStudentKeyRaw_(courseId,school,name) {
  return webSafeBase64_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,[courseId,normalizeIdentity_(school),normalizeIdentity_(name)].join("|"),Utilities.Charset.UTF_8));
}

function makeStudentKey_(courseId,school,name) {
  return makeStudentKeyRaw_(courseId,normalizeSchool_(school),name);
}

function makeIdentityDigest_(examId,courseId,school,name) {
  return webSafeBase64_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,[examId,courseId,school,name].join("|"),Utilities.Charset.UTF_8));
}

function webSafeBase64_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,"");
}

/** URL 복사·메신저 전달 과정에서 섞일 수 있는 공백·제로폭 문자를 제거한다. */

/**
 * 학생 한 명에게 하나의 영구 학부모 포털 링크를 부여한다.
 * 기존 Reports 행은 유지하고 마지막 StudentId 열로 Students 시트와 연결한다.
 */
function ensureStudentPortalSchema_() {
  const props=PropertiesService.getScriptProperties();
  if(String(props.getProperty("STUDENT_PORTAL_SCHEMA_VERSION")||"")===STUDENT_PORTAL_SCHEMA_VERSION)return;
  const ss=getSpreadsheet_();
  [SHEETS.STUDENTS,SHEETS.REPORTS].forEach(function(name){
    let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);
    ensureSheetSchema_(sh,HEADERS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,HEADERS[name].length).setFontWeight("bold").setBackground("#0c2b50").setFontColor("#ffffff");
  });
  props.setProperty("STUDENT_PORTAL_SCHEMA_VERSION",STUDENT_PORTAL_SCHEMA_VERSION);
}

function makeStudentBaseIdentityKey_(school,name) {
  return [normalizeIdentity_(normalizeSchool_(school)),normalizeIdentity_(name)].join("|");
}

function makeStudentProfileIdentityKey_(school,name,grade,classNo,externalId) {
  const ext=normalizeIdentity_(externalId);
  if(ext)return "external|"+ext;
  return [makeStudentBaseIdentityKey_(school,name),normalizeIdentity_(grade),normalizeIdentity_(classNo)].join("|");
}

function makeStudentProfileDigest_(studentId,school,name,grade,classNo,externalId) {
  return webSafeBase64_(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    [studentId,normalizeSchool_(school),String(name||"").trim(),String(grade||"").trim(),String(classNo||"").trim(),String(externalId||"").trim()].join("|"),
    Utilities.Charset.UTF_8
  ));
}

function makeStudentPortalFingerprint_(token,seed) {
  const sig=Utilities.computeHmacSha256Signature(String(token)+"|"+String(seed)+"|student-portal",secret_());
  return webSafeBase64_(sig);
}

function normalizeStudentProfile_(row) {
  const school=normalizeSchool_(row.School),name=String(row.Name||"").trim(),grade=String(row.Grade||"").trim(),classNo=String(row.ClassNo||"").trim(),externalId=String(row.ExternalId||"").trim();
  return {
    StudentId:String(row.StudentId||"").trim(),PortalToken:normalizeReportToken_(row.PortalToken),PortalFingerprint:String(row.PortalFingerprint||"").trim(),IdentitySeed:String(row.IdentitySeed||"").trim(),
    IdentityDigest:String(row.IdentityDigest||"").trim(),IdentityKey:String(row.IdentityKey||makeStudentProfileIdentityKey_(school,name,grade,classNo,externalId)),School:school,Name:name,Grade:grade,ClassNo:classNo,ExternalId:externalId,
    CreatedAt:row.CreatedAt||new Date(),UpdatedAt:row.UpdatedAt||new Date(),Active:String(row.Active).toLowerCase()!=="false"
  };
}

function studentProfileToRow_(p) {
  return [p.StudentId,p.PortalToken,p.PortalFingerprint,p.IdentitySeed,p.IdentityDigest,p.IdentityKey,p.School,p.Name,p.Grade,p.ClassNo,p.ExternalId,p.CreatedAt,p.UpdatedAt,p.Active!==false];
}

function rebuildStudentStoreIndexes_(store) {
  store.byId={};store.byToken={};store.byIdentity={};store.byBase={};store.byExternal={};
  store.rows.forEach(function(p){
    if(p.StudentId)store.byId[p.StudentId]=p;
    if(p.PortalToken)store.byToken[p.PortalToken]=p;
    if(p.IdentityKey)store.byIdentity[p.IdentityKey]=p;
    const base=makeStudentBaseIdentityKey_(p.School,p.Name);if(!store.byBase[base])store.byBase[base]=[];store.byBase[base].push(p);
    const ext=normalizeIdentity_(p.ExternalId);if(ext)store.byExternal[ext]=p;
  });
}

function loadStudentStore_() {
  ensureStudentPortalSchema_();
  const sh=getSheet_(SHEETS.STUDENTS),headers=HEADERS.Students,values=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues():[];
  const store={sh:sh,rows:values.map(function(row){return normalizeStudentProfile_(rowToObject_(headers,row));}),dirty:false};
  rebuildStudentStoreIndexes_(store);return store;
}

function persistStudentStore_(store) {
  if(!store||!store.dirty)return;
  const sh=store.sh,headers=HEADERS.Students,rows=store.rows.map(studentProfileToRow_),last=Math.max(0,sh.getLastRow()-1);
  if(rows.length){if(sh.getMaxRows()<rows.length+1)sh.insertRowsAfter(sh.getMaxRows(),rows.length+1-sh.getMaxRows());sh.getRange(2,1,rows.length,headers.length).setValues(rows);}
  if(last>rows.length)sh.getRange(rows.length+2,1,last-rows.length,headers.length).clearContent();
  store.dirty=false;rebuildStudentStoreIndexes_(store);
}

function createStudentProfileInStore_(store,input) {
  const now=new Date(),school=normalizeSchool_(input.school),name=String(input.name||"").trim();if(!name)throw new Error("학생 이름이 필요합니다.");
  const grade=String(input.grade||"").trim(),classNo=String(input.classNo||"").trim(),externalId=String(input.externalStudentId||input.externalId||"").trim();
  const studentId="stu_"+newToken_(),portalToken="sp_"+newToken_(),seed=newToken_();
  const profile={StudentId:studentId,PortalToken:portalToken,PortalFingerprint:makeStudentPortalFingerprint_(portalToken,seed),IdentitySeed:seed,IdentityDigest:"",IdentityKey:makeStudentProfileIdentityKey_(school,name,grade,classNo,externalId),School:school,Name:name,Grade:grade,ClassNo:classNo,ExternalId:externalId,CreatedAt:now,UpdatedAt:now,Active:true};
  profile.IdentityDigest=makeStudentProfileDigest_(studentId,school,name,grade,classNo,externalId);
  store.rows.push(profile);store.dirty=true;rebuildStudentStoreIndexes_(store);return profile;
}

function updateStudentProfileInStore_(store,profile,input) {
  const school=normalizeSchool_(input.school!==undefined?input.school:profile.School),name=String(input.name!==undefined?input.name:profile.Name||"").trim()||profile.Name,grade=String(input.grade!==undefined?input.grade:profile.Grade||"").trim(),classNo=String(input.classNo!==undefined?input.classNo:profile.ClassNo||"").trim(),externalId=String(input.externalStudentId||input.externalId||profile.ExternalId||"").trim();
  const changed=profile.School!==school||profile.Name!==name||profile.Grade!==grade||profile.ClassNo!==classNo||profile.ExternalId!==externalId||profile.Active===false;
  if(changed){profile.School=school;profile.Name=name;profile.Grade=grade;profile.ClassNo=classNo;profile.ExternalId=externalId;profile.IdentityKey=makeStudentProfileIdentityKey_(school,name,grade,classNo,externalId);profile.IdentityDigest=makeStudentProfileDigest_(profile.StudentId,school,name,grade,classNo,externalId);profile.UpdatedAt=new Date();profile.Active=true;store.dirty=true;rebuildStudentStoreIndexes_(store);}
  return profile;
}

function resolveStudentProfileInStore_(store,input,preferredStudentId) {
  const school=normalizeSchool_(input.school),name=String(input.name||"").trim(),grade=String(input.grade||"").trim(),classNo=String(input.classNo||"").trim(),externalId=String(input.externalStudentId||input.externalId||"").trim();
  if(!name)throw new Error("학생 이름이 필요합니다.");
  const preferred=String(preferredStudentId||input.studentId||"").trim();
  if(preferred&&store.byId[preferred])return updateStudentProfileInStore_(store,store.byId[preferred],{school:school,name:name,grade:grade,classNo:classNo,externalStudentId:externalId});
  if(input.forceNewStudent===true)return createStudentProfileInStore_(store,{school:school,name:name,grade:grade,classNo:classNo,externalStudentId:externalId});
  const ext=normalizeIdentity_(externalId);if(ext&&store.byExternal[ext])return updateStudentProfileInStore_(store,store.byExternal[ext],{school:school,name:name,grade:grade,classNo:classNo,externalStudentId:externalId});
  const exactKey=makeStudentProfileIdentityKey_(school,name,grade,classNo,externalId);if(store.byIdentity[exactKey])return updateStudentProfileInStore_(store,store.byIdentity[exactKey],{school:school,name:name,grade:grade,classNo:classNo,externalStudentId:externalId});
  const base=makeStudentBaseIdentityKey_(school,name),candidates=(store.byBase[base]||[]).filter(function(p){return p.Active!==false;});
  if(candidates.length===1){
    const c=candidates[0],incomingClass=normalizeIdentity_(classNo),savedClass=normalizeIdentity_(c.ClassNo);
    if(incomingClass&&savedClass&&incomingClass!==savedClass)return createStudentProfileInStore_(store,{school:school,name:name,grade:grade,classNo:classNo,externalStudentId:externalId});
    return updateStudentProfileInStore_(store,c,{school:school,name:name,grade:grade||c.Grade,classNo:classNo||c.ClassNo,externalStudentId:externalId||c.ExternalId});
  }
  if(candidates.length>1){
    const incomingClass=normalizeIdentity_(classNo),classMatches=incomingClass?candidates.filter(function(p){return normalizeIdentity_(p.ClassNo)===incomingClass;}):[];
    if(classMatches.length===1)return updateStudentProfileInStore_(store,classMatches[0],{school:school,name:name,grade:grade,classNo:classNo,externalStudentId:externalId});
    throwApiError_("STUDENT_PROFILE_AMBIGUOUS","같은 학교와 이름의 학생 통합 페이지가 여러 개입니다. 교사용 화면에서 기존 학생을 선택하거나 반·번호를 구분해 주세요.",{school:school,name:name,candidateCount:candidates.length});
  }
  return createStudentProfileInStore_(store,{school:school,name:name,grade:grade,classNo:classNo,externalStudentId:externalId});
}

function studentPortalSummary_(profile) {
  return {studentId:profile.StudentId,portalToken:profile.PortalToken,portalFingerprint:profile.PortalFingerprint,school:profile.School,name:profile.Name,grade:profile.Grade,classNo:profile.ClassNo,externalId:profile.ExternalId,createdAt:serializeCell_(profile.CreatedAt),updatedAt:serializeCell_(profile.UpdatedAt)};
}

function hydrateReportObject_(row) {
  const record=safeJson_(row.RecordJSON,{}),school=normalizeSchool_(row.School),scoring=safeJson_(row.ScoringJSON,[]);
  const hydrated=Object.assign(record,{token:String(row.Token),fingerprint:String(row.Fingerprint),studentId:String(row.StudentId||record.studentId||""),studentKey:makeStudentKey_(String(row.CourseId),school,String(row.Name)),examId:String(row.ExamId),courseId:String(row.CourseId),school:school,name:String(row.Name),grade:String(row.Grade||""),classNo:String(row.ClassNo||""),resultInputs:safeJson_(row.ResultInputsJSON,[]),partialModes:safeJson_(row.PartialModesJSON,[]),scoring:scoring,createdAt:serializeCell_(row.CreatedAt),updatedAt:serializeCell_(row.UpdatedAt)});
  if(hydrated.score===undefined)hydrated.score=scoring.reduce(function(a,x){return a+Number(x.score||0);},0);
  return hydrated;
}

function reportBelongsToStudent_(report,profile,studentStore) {
  const linkedId=String(report.studentId||"").trim();
  if(linkedId)return linkedId===String(profile.StudentId);
  const base=makeStudentBaseIdentityKey_(report.school,report.name);
  if(base!==makeStudentBaseIdentityKey_(profile.School,profile.Name))return false;
  // 아직 StudentId가 없는 구버전 행은 같은 학교·이름의 활성 프로필이 정확히 하나일 때만
  // 임시로 연결한다. 동명이인 후보가 둘 이상이면 다른 학생 결과가 섞이지 않도록 제외한다.
  const store=studentStore||loadStudentStore_(),candidates=(store.byBase[base]||[]).filter(function(p){return p.Active!==false;});
  if(candidates.length!==1||String(candidates[0].StudentId)!==String(profile.StudentId))return false;
  const reportGrade=normalizeIdentity_(report.grade),profileGrade=normalizeIdentity_(profile.Grade);
  const reportClass=normalizeIdentity_(report.classNo),profileClass=normalizeIdentity_(profile.ClassNo);
  if(reportGrade&&profileGrade&&reportGrade!==profileGrade)return false;
  if(reportClass&&profileClass&&reportClass!==profileClass)return false;
  return true;
}

function listStudentReportRecords_(profile) {
  const store=loadStudentStore_();
  return listRows_(SHEETS.REPORTS).map(hydrateReportObject_).filter(function(r){return reportBelongsToStudent_(r,profile,store);}).sort(function(a,b){return String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt));});
}

function findStudentProfileByPortal_(token,fp) {
  ensureStudentPortalSchema_();token=normalizeReportToken_(token);fp=String(fp||"").trim();if(!token||!fp)throwApiError_("PORTAL_LINK_INCOMPLETE","학생 통합 링크에 토큰 또는 지문이 없습니다.");
  const store=loadStudentStore_(),profile=store.byToken[token];if(!profile)throwApiError_("STUDENT_PORTAL_NOT_FOUND","학생 통합 페이지 토큰을 찾을 수 없습니다. 교사에게 최신 학생 통합 링크를 요청해 주세요.",{serverInstanceId:getServerInstanceId_()});
  if(!profile.Active)throwApiError_("STUDENT_PORTAL_DISABLED","이 학생 통합 페이지는 비활성화되어 있습니다.");
  if(!constantTimeEqual_(profile.PortalFingerprint,fp))throwApiError_("PORTAL_FINGERPRINT_MISMATCH","학생 통합 링크의 지문이 일치하지 않습니다. 교사에게 링크를 다시 요청해 주세요.");
  const recomputed=makeStudentPortalFingerprint_(profile.PortalToken,profile.IdentitySeed);if(!constantTimeEqual_(recomputed,profile.PortalFingerprint))throwApiError_("PORTAL_FINGERPRINT_INTEGRITY","학생 통합 링크 무결성 검증에 실패했습니다.");
  const digest=makeStudentProfileDigest_(profile.StudentId,profile.School,profile.Name,profile.Grade,profile.ClassNo,profile.ExternalId);if(!constantTimeEqual_(digest,profile.IdentityDigest))throwApiError_("PORTAL_IDENTITY_INTEGRITY","학생 통합 정보 무결성 검증에 실패했습니다.");
  return profile;
}

function buildStudentPortalData_(profile) {
  const reports=listStudentReportRecords_(profile),examRows=listRows_(SHEETS.EXAMS),examMap={};examRows.forEach(function(e){examMap[String(e.ExamId)]=e;});
  // 누적 요약에는 단원·배점·문항 번호만 필요하므로 Questions 시트를 한 번만 읽어 시험별로 묶는다.
  // 시험마다 문항 시트를 반복 조회하면 Apps Script 실행 시간이 급격히 늘어나므로 피한다.
  const questionCache={};listRows_(SHEETS.QUESTIONS).forEach(function(q){const id=String(q.ExamId||"");if(!questionCache[id])questionCache[id]=[];questionCache[id].push(q);});
  Object.keys(questionCache).forEach(function(id){questionCache[id].sort(function(a,b){return Number(a.QuestionNo)-Number(b.QuestionNo);});});
  const unitMap={},courseMap={},weakItems=[];let totalScore=0,totalMax=0,percentSum=0,full=0,partial=0,wrong=0,ungraded=0;
  const summaries=reports.map(function(r){
    const exam=examMap[r.examId]||{},questions=questionCache[r.examId]||[];
    const counts=r.counts||{full:0,partial:0,wrong:0,ungraded:0};full+=Number(counts.full||0);partial+=Number(counts.partial||0);wrong+=Number(counts.wrong||0);ungraded+=Number(counts.ungraded||0);totalScore+=Number(r.score||0);totalMax+=Number(r.maxScore||exam.MaxScore||0);percentSum+=Number(r.percent||0);
    const unitSnapshot={};questions.forEach(function(q,i){const s=r.scoring[i]||{},unit=String(q.Unit||"미분류"),key=[r.courseId,unit].join("|");if(!unitMap[key])unitMap[key]={courseId:r.courseId,unit:unit,score:0,maxPoints:0,questionCount:0,wrongCount:0,partialCount:0};const u=unitMap[key];u.score+=Number(s.score||0);u.maxPoints+=Number(q.MaxPoints||0);u.questionCount++;if(s.status==="wrong")u.wrongCount++;if(s.status==="partial")u.partialCount++;if(!unitSnapshot[unit])unitSnapshot[unit]={unit:unit,score:0,maxPoints:0};unitSnapshot[unit].score+=Number(s.score||0);unitSnapshot[unit].maxPoints+=Number(q.MaxPoints||0);if(s.status==="wrong"||s.status==="partial")weakItems.push({reportToken:r.token,examId:r.examId,courseId:r.courseId,questionNo:Number(q.QuestionNo),unit:unit,topic:String(q.Topic||""),status:String(s.status),score:s.score,maxPoints:Number(q.MaxPoints||0)});});
    const ckey=r.courseId;if(!courseMap[ckey])courseMap[ckey]={courseId:ckey,score:0,maxPoints:0,count:0};courseMap[ckey].score+=Number(r.score||0);courseMap[ckey].maxPoints+=Number(r.maxScore||exam.MaxScore||0);courseMap[ckey].count++;
    return {reportToken:r.token,examId:r.examId,courseId:r.courseId,title:String(exam.Title||r.examId),shortTitle:String(exam.ShortTitle||exam.Title||r.examId),assessmentType:String(exam.AssessmentType||"weekly"),section:String(exam.Section||""),round:Number(exam.Round||0),examDate:serializeCell_(exam.ExamDate),score:Number(r.score||0),maxScore:Number(r.maxScore||exam.MaxScore||0),percent:Number(r.percent||0),counts:counts,unitSnapshot:Object.keys(unitSnapshot).map(function(k){const u=unitSnapshot[k];return {unit:u.unit,score:u.score,maxPoints:u.maxPoints,percent:u.maxPoints?u.score/u.maxPoints*100:0};}),createdAt:r.createdAt,updatedAt:r.updatedAt};
  });
  const units=Object.keys(unitMap).map(function(k){const u=unitMap[k];return Object.assign(u,{percent:u.maxPoints?u.score/u.maxPoints*100:0});}).sort(function(a,b){return b.percent-a.percent;});
  const courses=Object.keys(courseMap).map(function(k){const c=courseMap[k];return Object.assign(c,{percent:c.maxPoints?c.score/c.maxPoints*100:0});}).sort(function(a,b){return b.percent-a.percent;});
  const chronological=summaries.slice().sort(function(a,b){return String(a.updatedAt||a.createdAt).localeCompare(String(b.updatedAt||b.createdAt));});
  return {student:studentPortalSummary_(profile),reports:summaries,cumulative:{testCount:summaries.length,weeklyCount:summaries.filter(function(x){return x.assessmentType!=="comprehensive";}).length,comprehensiveCount:summaries.filter(function(x){return x.assessmentType==="comprehensive";}).length,totalScore:totalScore,totalMaxScore:totalMax,weightedPercent:totalMax?totalScore/totalMax*100:0,averagePercent:summaries.length?percentSum/summaries.length:0,latestPercent:chronological.length?chronological[chronological.length-1].percent:0,counts:{full:full,partial:partial,wrong:wrong,ungraded:ungraded},units:units,courses:courses,trend:chronological.map(function(x){return {reportToken:x.reportToken,examId:x.examId,label:x.shortTitle,percent:x.percent,assessmentType:x.assessmentType,updatedAt:x.updatedAt};}),strongUnits:units.slice(0,3),weakUnits:units.slice().sort(function(a,b){return a.percent-b.percent;}).slice(0,3),weakItems:weakItems.sort(function(a,b){const sa=a.status==="wrong"?0:1,sb=b.status==="wrong"?0:1;return sa-sb;})},serverInstanceId:getServerInstanceId_(),featureVersion:FEATURE_VERSION,integrity:{portalTokenMatch:true,portalFingerprintMatch:true,identityMatch:true}};
}

function getStudentPortal_(token,fp) {
  const profile=findStudentProfileByPortal_(token,fp);return Object.assign({ok:true},buildStudentPortalData_(profile));
}

function getStudentExamDetail_(token,fp,reportToken) {
  const profile=findStudentProfileByPortal_(token,fp),found=findReportRowByToken_(reportToken);if(!found)throwApiError_("REPORT_NOT_FOUND","선택한 시험 성적 기록을 찾을 수 없습니다.");
  const report=hydrateReportObject_(found.row),store=loadStudentStore_();if(!reportBelongsToStudent_(report,profile,store))throwApiError_("PORTAL_REPORT_MISMATCH","선택한 시험 결과가 이 학생 통합 페이지에 속하지 않습니다.");
  const detail=getReport_(report.token,String(found.row.Fingerprint||report.fingerprint||""));detail.student=studentPortalSummary_(profile);detail.featureVersion=FEATURE_VERSION;return detail;
}

function listStudents_(filter) {
  const migrationProps=PropertiesService.getScriptProperties();
  if(String(migrationProps.getProperty("STUDENT_PORTAL_MIGRATION_COMPLETE")||"")!==STUDENT_PORTAL_SCHEMA_VERSION){try{migrateStudentPortals_(500);}catch(migrationError){console.log("YOUNGS_PHYSICS_STUDENT_PORTAL_AUTO_MIGRATION_ERROR="+String(migrationError&&migrationError.message||migrationError));}}
  const store=loadStudentStore_(),allReports=listRows_(SHEETS.REPORTS).map(hydrateReportObject_),examMap={};listRows_(SHEETS.EXAMS).forEach(function(e){examMap[String(e.ExamId)]=e;});
  return store.rows.filter(function(p){return p.Active!==false;}).map(function(p){const reports=allReports.filter(function(r){return reportBelongsToStudent_(r,p,store);}),latest=reports.slice().sort(function(a,b){return String(b.updatedAt).localeCompare(String(a.updatedAt));})[0]||null,average=reports.length?reports.reduce(function(sum,r){return sum+Number(r.percent||0);},0)/reports.length:0,latestExam=latest?examMap[latest.examId]||{}:{};return Object.assign(studentPortalSummary_(p),{reportCount:reports.length,averagePercent:average,latestReport:latest?{reportToken:latest.token,examId:latest.examId,title:String(latestExam.Title||latest.examId),score:latest.score,maxScore:latest.maxScore,percent:latest.percent,updatedAt:latest.updatedAt}:null});}).filter(function(p){return (!filter||!filter.name||normalizeIdentity_(p.name).indexOf(normalizeIdentity_(filter.name))>=0)&&(!filter||!filter.school||normalizeIdentity_(p.school)===normalizeIdentity_(normalizeSchool_(filter.school)));}).sort(function(a,b){return [a.school,a.name,a.classNo].join("|").localeCompare([b.school,b.name,b.classNo].join("|"));});
}

function reissueStudentPortal_(studentId) {
  ensureStudentPortalSchema_();const store=loadStudentStore_(),p=store.byId[String(studentId||"")];if(!p)throwApiError_("STUDENT_NOT_FOUND","학생 통합 프로필을 찾을 수 없습니다.");const token="sp_"+newToken_(),seed=newToken_();p.PortalToken=token;p.IdentitySeed=seed;p.PortalFingerprint=makeStudentPortalFingerprint_(token,seed);p.UpdatedAt=new Date();store.dirty=true;persistStudentStore_(store);return {ok:true,student:studentPortalSummary_(p),serverInstanceId:getServerInstanceId_()};
}

function migrateStudentPortals_(batchSize) {
  ensureStudentPortalSchema_();const lock=LockService.getScriptLock();if(!lock.tryLock(20000))throw new Error("다른 학생 링크 마이그레이션 또는 저장 작업이 진행 중입니다.");
  try{
    const sh=getSheet_(SHEETS.REPORTS),headers=HEADERS.Reports,lastRow=sh.getLastRow(),props=PropertiesService.getScriptProperties(),size=Math.max(10,Math.min(1000,Number(batchSize||300)));let startRow=Math.max(2,Number(props.getProperty("STUDENT_PORTAL_MIGRATION_NEXT_ROW")||2));
    if(lastRow<2||startRow>lastRow){props.deleteProperty("STUDENT_PORTAL_MIGRATION_NEXT_ROW");props.setProperty("STUDENT_PORTAL_MIGRATION_COMPLETE",STUDENT_PORTAL_SCHEMA_VERSION);return {ok:true,done:true,processed:0,linked:0,students:listRows_(SHEETS.STUDENTS).length,remainingRows:0};}
    const count=Math.min(size,lastRow-startRow+1),rows=sh.getRange(startRow,1,count,headers.length).getValues(),store=loadStudentStore_();let linked=0;
    rows.forEach(function(row){const o=rowToObject_(headers,row),record=safeJson_(o.RecordJSON,{}),preferred=String(o.StudentId||record.studentId||""),profile=resolveStudentProfileInStore_(store,{school:o.School,name:o.Name,grade:o.Grade,classNo:o.ClassNo,studentId:preferred},preferred);if(String(o.StudentId||"")!==profile.StudentId||String(record.studentId||"")!==profile.StudentId){row[headers.indexOf("StudentId")]=profile.StudentId;record.studentId=profile.StudentId;row[headers.indexOf("RecordJSON")]=JSON.stringify(record);linked++;}});
    if(linked)sh.getRange(startRow,1,count,headers.length).setValues(rows);persistStudentStore_(store);const next=startRow+count,done=next>lastRow;if(done){props.deleteProperty("STUDENT_PORTAL_MIGRATION_NEXT_ROW");props.setProperty("STUDENT_PORTAL_MIGRATION_COMPLETE",STUDENT_PORTAL_SCHEMA_VERSION);}else{props.deleteProperty("STUDENT_PORTAL_MIGRATION_COMPLETE");props.setProperty("STUDENT_PORTAL_MIGRATION_NEXT_ROW",String(next));}return {ok:true,done:done,processed:count,linked:linked,students:store.rows.length,nextRow:done?null:next,remainingRows:done?0:lastRow-next+1};
  } finally {lock.releaseLock();}
}

function migrateStudentPortals() {
  const result=migrateStudentPortals_(300);try{getSpreadsheet_().toast(result.done?"학생 통합 링크 연결 완료 · "+result.students+"명":"학생 통합 링크 연결 중 · 남은 기록 "+result.remainingRows,"Young's Physics",15);}catch(e){}console.log("YOUNGS_PHYSICS_STUDENT_PORTAL_MIGRATION="+JSON.stringify(result));return result;
}

function diagnoseStudentPortals() {
  ensureStudentPortalSchema_();const students=listRows_(SHEETS.STUDENTS),reports=listRows_(SHEETS.REPORTS),missing=reports.filter(function(r){return !String(r.StudentId||"").trim();}).length,invalid=[];if(missing)PropertiesService.getScriptProperties().deleteProperty("STUDENT_PORTAL_MIGRATION_COMPLETE");students.forEach(function(s){const p=normalizeStudentProfile_(s);if(makeStudentPortalFingerprint_(p.PortalToken,p.IdentitySeed)!==p.PortalFingerprint)invalid.push({studentId:p.StudentId,type:"fingerprint"});if(makeStudentProfileDigest_(p.StudentId,p.School,p.Name,p.Grade,p.ClassNo,p.ExternalId)!==p.IdentityDigest)invalid.push({studentId:p.StudentId,type:"identity"});});const result={ok:true,featureVersion:FEATURE_VERSION,students:students.length,reports:reports.length,reportsWithoutStudentId:missing,issues:invalid};console.log("YOUNGS_PHYSICS_STUDENT_PORTAL_DIAGNOSTIC="+JSON.stringify(result));return result;
}

function normalizeReportToken_(value) {
  let token=String(value===undefined||value===null?"":value)
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g,"")
    .trim();
  if (/%[0-9A-Fa-f]{2}/.test(token)) {
    try { token=decodeURIComponent(token); } catch (decodeErr) {}
  }
  return token.replace(/[\u200B-\u200D\u2060\uFEFF]/g,"").trim();
}

/**
 * Reports의 실제 헤더가 구버전이거나 설치가 중간에 끝났어도 Token 열·A열·RecordJSON을
 * 순서대로 확인한다. 읽기 요청이므로 시트 구조를 자동으로 파괴적으로 바꾸지 않는다.
 */
function findReportRowByToken_(token) {
  const target=normalizeReportToken_(token);
  if(!target) return null;
  const sh=getSheet_(SHEETS.REPORTS),lastRow=sh.getLastRow();
  if(lastRow<2) return null;
  const width=Math.max(sh.getLastColumn(),HEADERS.Reports.length);
  const headers=sh.getRange(1,1,1,width).getValues()[0].map(function(v){return String(v||"").trim();});
  const rows=sh.getRange(2,1,lastRow-1,width).getValues();
  const tokenCol=headers.indexOf("Token"),recordCol=headers.indexOf("RecordJSON");
  const canonicalRecordCol=HEADERS.Reports.indexOf("RecordJSON");

  for(let i=0;i<rows.length;i++) {
    const raw=rows[i],candidates=[];
    if(tokenCol>=0)candidates.push({value:raw[tokenCol],mode:"header"});
    candidates.push({value:raw[0],mode:"column-a"});
    const jsonIndex=recordCol>=0?recordCol:canonicalRecordCol;
    const embedded=safeJson_(raw[jsonIndex],{});
    if(embedded&&embedded.token)candidates.push({value:embedded.token,mode:"record-json"});
    const match=candidates.find(function(c){return normalizeReportToken_(c.value)===target;});
    if(!match)continue;

    let object;
    if(tokenCol>=0)object=rowToObject_(headers,raw);
    else object=rowToObject_(HEADERS.Reports,raw.slice(0,HEADERS.Reports.length));
    object=Object.assign({},embedded||{},object||{});
    object.Token=normalizeReportToken_(object.Token||match.value||embedded.token);
    if(!object.Fingerprint&&embedded.fingerprint)object.Fingerprint=embedded.fingerprint;
    if(!object.ExamId&&embedded.examId)object.ExamId=embedded.examId;
    if(!object.CourseId&&embedded.courseId)object.CourseId=embedded.courseId;
    if(!object.School&&embedded.school)object.School=embedded.school;
    if(!object.Name&&embedded.name)object.Name=embedded.name;
    return {row:object,rowNumber:i+2,lookupMode:match.mode};
  }
  return null;
}

function getReport_(token,fp) {
  token=normalizeReportToken_(token);fp=String(fp||"").trim();
  if(!token||!fp) throwApiError_("REPORT_LINK_INCOMPLETE","학생 토큰 또는 지문이 없습니다.");
  const found=findReportRowByToken_(token);
  if(!found) {
    const sh=getSheet_(SHEETS.REPORTS);
    throwApiError_("REPORT_NOT_FOUND","성적표 토큰을 찾을 수 없습니다. 이 링크를 만든 Apps Script 서버와 현재 사이트에 연결된 서버가 다른지 확인한 뒤 교사용 화면의 ‘서버 기록’에서 링크를 다시 복사해 주세요.",{
      serverInstanceId:getServerInstanceId_(),
      reportCount:Math.max(0,sh.getLastRow()-1),
      tokenPreview:token.slice(0,8)+"…"+token.slice(-6)
    });
  }
  const row=found.row;
  if(!constantTimeEqual_(String(row.Fingerprint||""),String(fp))) throwApiError_("FINGERPRINT_MISMATCH","요청한 학생과 서버에서 불러온 학생 정보가 일치하지 않습니다. 교사에게 새 결과 링크를 요청해 주세요.",{serverInstanceId:getServerInstanceId_()});
  const recomputed=makeFingerprint_(String(row.Token),String(row.IdentitySeed||""));
  if(!constantTimeEqual_(recomputed,String(row.Fingerprint||""))) throwApiError_("FINGERPRINT_INTEGRITY","서버 토큰·지문 무결성 검증에 실패했습니다. 교사용 화면에서 해당 학생 링크를 다시 발급해 주세요.",{serverInstanceId:getServerInstanceId_(),rowNumber:found.rowNumber});
  const rawSchool=String(row.School||"").trim(),school=normalizeSchool_(rawSchool);
  const identityMatches=schoolIdentityVariants_(rawSchool).some(function(candidate){return constantTimeEqual_(makeIdentityDigest_(String(row.ExamId),String(row.CourseId),candidate,String(row.Name)),String(row.IdentityDigest));});
  if(!identityMatches) throwApiError_("IDENTITY_INTEGRITY","학생 식별 정보 무결성 검증에 실패했습니다.",{serverInstanceId:getServerInstanceId_(),rowNumber:found.rowNumber});
  let record=safeJson_(row.RecordJSON,{});
  const scoring=safeJson_(row.ScoringJSON,[]);
  record=Object.assign(record,{token:String(row.Token),fingerprint:String(row.Fingerprint),studentId:String(row.StudentId||record.studentId||""),studentKey:makeStudentKey_(String(row.CourseId),school,String(row.Name)),examId:String(row.ExamId),courseId:String(row.CourseId),school:school,name:String(row.Name),grade:String(row.Grade||""),classNo:String(row.ClassNo||""),resultInputs:safeJson_(row.ResultInputsJSON,[]),partialModes:safeJson_(row.PartialModesJSON,[]),scoring:scoring});
  if(record.score===undefined) record.score=scoring.reduce((a,x)=>a+Number(x.score||0),0);
  const exam=getRowBy_(SHEETS.EXAMS,"ExamId",record.examId);if(!exam)throwApiError_("EXAM_NOT_FOUND","연결된 시험 설정을 찾을 수 없습니다.");
  record.maxScore=Number(record.maxScore||exam.MaxScore||0);record.percent=record.maxScore?record.score/record.maxScore*100:0;
  record.counts={full:0,partial:0,wrong:0,ungraded:0};scoring.forEach(x=>record.counts[x.status]=(record.counts[x.status]||0)+1);
  return {ok:true,record:record,stats:getExamStats_(record.examId),historyRecords:getLinkedHistoryRecords_(record),questions:getQuestionRows_(record.examId),serverInstanceId:getServerInstanceId_(),featureVersion:FEATURE_VERSION,lookupMode:found.lookupMode,integrity:{tokenMatch:true,fingerprintMatch:true,identityMatch:true}};
}

function listReports_(filter) {
  ensureStudentPortalSchema_();
  return listRows_(SHEETS.REPORTS).map(hydrateReportObject_).filter(function(r){return (!filter.examId||r.examId===filter.examId)&&(!filter.courseId||r.courseId===filter.courseId)&&(!filter.studentId||r.studentId===filter.studentId);}).sort(function(a,b){return String(b.updatedAt).localeCompare(String(a.updatedAt));});
}

/**
 * Apps Script 편집기에서 직접 실행하는 성적표 저장소 진단 함수.
 * 학생 개인정보는 로그에 출력하지 않고 헤더·행 수·토큰 상태만 요약한다.
 */
function diagnoseReportStorage() {
  const sh=getSheet_(SHEETS.REPORTS),lastRow=sh.getLastRow(),lastCol=sh.getLastColumn();
  const headers=lastCol?sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(function(v){return String(v||"").trim();}):[];
  const tokenCol=headers.indexOf("Token"),recordCol=headers.indexOf("RecordJSON");
  let tokenCount=0,embeddedTokenCount=0,blankTokenRows=0;
  if(lastRow>1){
    const width=Math.max(lastCol,HEADERS.Reports.length),rows=sh.getRange(2,1,lastRow-1,width).getValues();
    rows.forEach(function(row){
      const token=normalizeReportToken_(tokenCol>=0?row[tokenCol]:row[0]);
      if(token)tokenCount++;else blankTokenRows++;
      const idx=recordCol>=0?recordCol:HEADERS.Reports.indexOf("RecordJSON"),record=safeJson_(row[idx],{});
      if(normalizeReportToken_(record&&record.token))embeddedTokenCount++;
    });
  }
  const result={
    ok:true,
    apiVersion:API_VERSION,
    serverInstanceId:getServerInstanceId_(),
    spreadsheetId:getSpreadsheet_().getId(),
    sheetName:sh.getName(),
    reportRows:Math.max(0,lastRow-1),
    tokenHeaderFound:tokenCol>=0,
    tokenColumn:tokenCol>=0?tokenCol+1:null,
    recordJsonHeaderFound:recordCol>=0,
    tokenCount:tokenCount,
    embeddedTokenCount:embeddedTokenCount,
    blankTokenRows:blankTokenRows,
    schemaExact:HEADERS.Reports.every(function(h,i){return headers[i]===h;})
  };
  console.log("YOUNGS_PHYSICS_REPORT_DIAGNOSTIC="+JSON.stringify(result));
  try{getSpreadsheet_().toast("성적표 저장소 진단 완료 · 행 "+result.reportRows+" · 토큰 "+result.tokenCount,"Young's Physics",15);}catch(toastErr){}
  return result;
}

/**
 * Reports 헤더를 정식 18열 스키마로 재배치하고 누락·불일치한 토큰 관련 필드를 복구한다.
 * 지문을 다시 만든 행은 기존 링크가 바뀌므로 교사용 화면에서 링크를 다시 복사해야 한다.
 */
function repairReportStorage() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))throw new Error("다른 저장 작업이 진행 중입니다. 잠시 후 다시 실행하세요.");
  try{
    const sh=getSheet_(SHEETS.REPORTS);
    ensureSheetSchema_(sh,HEADERS.Reports);
    if(sh.getLastRow()<2)return {ok:true,apiVersion:API_VERSION,serverInstanceId:getServerInstanceId_(),rows:0,repaired:0,reissuedLinks:0};
    const rows=sh.getRange(2,1,sh.getLastRow()-1,HEADERS.Reports.length).getValues();
    let repaired=0,reissuedLinks=0;
    rows.forEach(function(row){
      const obj=rowToObject_(HEADERS.Reports,row),record=safeJson_(obj.RecordJSON,{});
      let changed=false;
      let token=normalizeReportToken_(obj.Token||record.token);
      if(!token){token=newToken_();changed=true;}
      let seed=normalizeReportToken_(obj.IdentitySeed);
      if(!seed){seed=newToken_();changed=true;}
      const expected=makeFingerprint_(token,seed);
      let fingerprint=String(obj.Fingerprint||record.fingerprint||"").trim();
      if(!fingerprint||!constantTimeEqual_(fingerprint,expected)){fingerprint=expected;changed=true;reissuedLinks++;}
      const school=normalizeSchool_(obj.School||record.school),name=String(obj.Name||record.name||"").trim();
      const examId=String(obj.ExamId||record.examId||""),courseId=String(obj.CourseId||record.courseId||"");
      const studentKey=makeStudentKey_(courseId,school,name),identityDigest=makeIdentityDigest_(examId,courseId,school,name);
      if(String(obj.Token||"")!==token||String(obj.IdentitySeed||"")!==seed||String(obj.Fingerprint||"")!==fingerprint||String(obj.School||"")!==school||String(obj.StudentKey||"")!==studentKey||String(obj.IdentityDigest||"")!==identityDigest)changed=true;
      const hydrated=Object.assign({},record,{token:token,fingerprint:fingerprint,studentKey:studentKey,examId:examId,courseId:courseId,school:school,name:name});
      row[0]=token;row[1]=fingerprint;row[2]=seed;row[3]=identityDigest;row[4]=studentKey;row[5]=examId;row[6]=courseId;row[7]=school;row[8]=name;row[14]=JSON.stringify(hydrated);
      if(changed)repaired++;
    });
    sh.getRange(2,1,rows.length,HEADERS.Reports.length).setValues(rows);
    const result={ok:true,apiVersion:API_VERSION,serverInstanceId:getServerInstanceId_(),rows:rows.length,repaired:repaired,reissuedLinks:reissuedLinks};
    console.log("YOUNGS_PHYSICS_REPORT_REPAIR="+JSON.stringify(result));
    try{getSpreadsheet_().toast("성적표 저장소 복구 완료 · "+repaired+"행 정리 · 링크 재발급 "+reissuedLinks+"건","Young's Physics",20);}catch(toastErr){}
    return result;
  } finally {lock.releaseLock();}
}

function getLinkedHistoryRecords_(record) {
  const exam=getRowBy_(SHEETS.EXAMS,"ExamId",String(record.examId||""));
  if(!exam) return [];
  const ids=safeJson_(exam.HistoryExamIdsJSON,[]);if(!ids.length)return [];
  const key=String(record.studentKey||makeStudentKey_(record.courseId,record.school,record.name)),studentId=String(record.studentId||"");
  return listReports_({courseId:String(record.courseId)}).filter(function(r){return ids.indexOf(String(r.examId))>=0&&(studentId?String(r.studentId||"")===studentId:String(r.studentKey||makeStudentKey_(r.courseId,r.school,r.name))===key);});
}

function deleteReport_(token) {
  const sh=getSheet_(SHEETS.REPORTS);if(sh.getLastRow()<2)return 0;
  const values=sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String);const i=values.indexOf(String(token));
  if(i<0)return 0;sh.deleteRow(i+2);return 1;
}

function getExamStats_(examId) {
  const exam=getRowBy_(SHEETS.EXAMS,"ExamId",examId);if(!exam) throw new Error("시험 설정을 찾을 수 없습니다.");
  const questions=getQuestionRows_(examId),reports=listRows_(SHEETS.REPORTS).filter(r=>String(r.ExamId)===examId&&String(r.CourseId)===String(exam.CourseId));
  const normalized=reports.map(function(r){const scoring=safeJson_(r.ScoringJSON,[]);return {score:scoring.reduce((a,x)=>a+Number(x.score||0),0),scoring:scoring};});
  const scores=normalized.map(r=>r.score).sort((a,b)=>a-b),n=scores.length,maxScore=questions.reduce((a,q)=>a+Number(q.MaxPoints),0);
  const average=n?scores.reduce((a,b)=>a+b,0)/n:0,median=n?(n%2?scores[(n-1)/2]:(scores[n/2-1]+scores[n/2])/2):0;
  const perQuestion=questions.map(function(q,i){
    const vals=normalized.map(r=>Number((r.scoring[i]||{}).score||0)),states=normalized.map(r=>(r.scoring[i]||{}).status);
    return {questionNo:Number(q.QuestionNo),average:n?vals.reduce((a,b)=>a+b,0)/n:0,maxPoints:Number(q.MaxPoints),fullRate:n?states.filter(s=>s==="full").length/n*100:0,wrongRate:n?states.filter(s=>s==="wrong").length/n*100:0,partialRate:n?states.filter(s=>s==="partial").length/n*100:0};
  });
  const unitNames=[];questions.forEach(q=>{if(unitNames.indexOf(String(q.Unit))<0)unitNames.push(String(q.Unit));});
  const units=unitNames.map(function(unit){
    const idx=questions.map((q,i)=>String(q.Unit)===unit?i:-1).filter(i=>i>=0),max=idx.reduce((a,i)=>a+Number(questions[i].MaxPoints),0);
    const avg=n?normalized.reduce((sum,r)=>sum+idx.reduce((a,i)=>a+Number((r.scoring[i]||{}).score||0),0),0)/n:0;
    return {unit:unit,maxPoints:max,averageScore:avg,averagePercent:max?avg/max*100:0};
  });
  return {count:n,average:average,averagePercent:maxScore?average/maxScore*100:0,median:median,highest:n?Math.max.apply(null,scores):0,lowest:n?Math.min.apply(null,scores):0,scoreList:scores,perQuestion:perQuestion,units:units};
}

function checkIntegrity_() {
  const rows=listRows_(SHEETS.REPORTS),issues=[],seen={};
  rows.forEach(function(r){
    const token=String(r.Token);if(seen[token])issues.push({token:token,type:"duplicate-token"});seen[token]=true;
    if(makeFingerprint_(token,String(r.IdentitySeed))!==String(r.Fingerprint))issues.push({token:token,type:"fingerprint"});
    const schools=schoolIdentityVariants_(r.School);
    const identityOk=schools.some(function(school){return makeIdentityDigest_(String(r.ExamId),String(r.CourseId),school,String(r.Name))===String(r.IdentityDigest);});
    const studentKeyOk=schools.some(function(school){return makeStudentKeyRaw_(String(r.CourseId),school,String(r.Name))===String(r.StudentKey);});
    if(!identityOk)issues.push({token:token,type:"identity"});
    if(!studentKeyOk)issues.push({token:token,type:"student-key"});
  });
  return {ok:true,checked:rows.length,issues:issues};
}

function repairIntegrity_() {
  const sh=getSheet_(SHEETS.REPORTS),headers=HEADERS.Reports;if(sh.getLastRow()<2)return {ok:true,repaired:0,schoolLabelsMigrated:0};
  const values=sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues();let repaired=0,schoolLabelsMigrated=0;
  values.forEach(function(row){
    const o=rowToObject_(headers,row),school=normalizeSchool_(o.School),fp=makeFingerprint_(String(o.Token),String(o.IdentitySeed)),identityDigest=makeIdentityDigest_(String(o.ExamId),String(o.CourseId),school,String(o.Name)),studentKey=makeStudentKey_(String(o.CourseId),school,String(o.Name));
    const record=safeJson_(o.RecordJSON,{}),recordChanged=record.school!==school||record.studentKey!==studentKey;
    const schoolChanged=String(o.School)!==school;
    if(String(o.Fingerprint)!==fp||schoolChanged||String(o.IdentityDigest)!==identityDigest||String(o.StudentKey)!==studentKey||recordChanged){
      record.school=school;record.studentKey=studentKey;
      row[1]=fp;row[3]=identityDigest;row[4]=studentKey;row[7]=school;row[14]=JSON.stringify(record);repaired++;if(schoolChanged)schoolLabelsMigrated++;
    }
  });
  if(repaired)sh.getRange(2,1,values.length,headers.length).setValues(values);
  return {ok:true,repaired:repaired,schoolLabelsMigrated:schoolLabelsMigrated};
}

/**
 * 빈 학교와 구버전 '미입력' 표기를 '미기입'으로 바꾸고 무결성 필드를 함께 갱신한다.
 * 한 번에 전체 행을 처리하지 않고 기본 100행씩 처리하여 Apps Script 실행 시간 제한을 피한다.
 */
function migrateSchoolLabels_(batchSize) {
  const sh = getSheet_(SHEETS.REPORTS);
  const headers = HEADERS.Reports;
  const props = PropertiesService.getScriptProperties();
  const lastRow = sh.getLastRow();
  const size = Math.max(10, Math.min(500, Number(batchSize || 100)));
  let startRow = Math.max(2, Number(props.getProperty("SCHOOL_MIGRATION_NEXT_ROW") || 2));

  if (lastRow < 2 || startRow > lastRow) {
    props.deleteProperty("SCHOOL_MIGRATION_NEXT_ROW");
    return {ok:true, done:true, processed:0, migrated:0, nextRow:null, totalRows:Math.max(0,lastRow-1)};
  }

  const count = Math.min(size, lastRow - startRow + 1);
  const values = sh.getRange(startRow,1,count,headers.length).getValues();
  let migrated = 0;
  values.forEach(function(row){
    const o = rowToObject_(headers,row);
    const school = normalizeSchool_(o.School);
    const identityDigest = makeIdentityDigest_(String(o.ExamId),String(o.CourseId),school,String(o.Name));
    const studentKey = makeStudentKey_(String(o.CourseId),school,String(o.Name));
    const record = safeJson_(o.RecordJSON,{});
    const recordChanged = record.school !== school || record.studentKey !== studentKey;
    if (String(o.School)!==school || String(o.IdentityDigest)!==identityDigest || String(o.StudentKey)!==studentKey || recordChanged) {
      record.school = school;
      record.studentKey = studentKey;
      row[3] = identityDigest;
      row[4] = studentKey;
      row[7] = school;
      row[14] = JSON.stringify(record);
      migrated++;
    }
  });

  if (migrated) sh.getRange(startRow,1,count,headers.length).setValues(values);
  const nextRow = startRow + count;
  const done = nextRow > lastRow;
  if (done) props.deleteProperty("SCHOOL_MIGRATION_NEXT_ROW");
  else props.setProperty("SCHOOL_MIGRATION_NEXT_ROW", String(nextRow));

  return {
    ok:true,
    done:done,
    processed:count,
    migrated:migrated,
    nextRow:done ? null : nextRow,
    totalRows:lastRow-1,
    remainingRows:done ? 0 : lastRow-nextRow+1
  };
}

/** Spreadsheet 메뉴 또는 Apps Script 편집기에서 반복 실행한다. 기본 100행씩 진행한다. */
function migrateSchoolLabels() {
  const result = migrateSchoolLabels_(100);
  const message = result.done
    ? "학교 표기 정리 완료 · 이번 실행 " + result.migrated + "개 변경"
    : "학교 표기 정리 진행 중 · " + result.processed + "행 처리 · 남은 행 " + result.remainingRows;
  try { getSpreadsheet_().toast(message, "Young's Physics", 15); } catch (toastErr) {}
  console.log("YOUNGS_PHYSICS_SCHOOL_MIGRATION=" + JSON.stringify(result));
  return result;
}

/** 학교 표기 분할 변환을 처음 행부터 다시 시작한다. */
function resetSchoolMigrationCursor() {
  PropertiesService.getScriptProperties().deleteProperty("SCHOOL_MIGRATION_NEXT_ROW");
  return {ok:true, nextRow:2};
}

function recalculateExam_(examId) {
  const sh=getSheet_(SHEETS.REPORTS),headers=HEADERS.Reports;if(sh.getLastRow()<2)return {ok:true,updated:0};
  const rows=sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues();let updated=0;
  rows.forEach(function(row,i){const o=rowToObject_(headers,row);if(String(o.ExamId)!==examId)return;const existingRecord=safeJson_(o.RecordJSON,{}),encoding=String(existingRecord.inputEncoding||"legacy-binary");const calc=calculateScoring_(examId,safeJson_(o.ResultInputsJSON,[]),safeJson_(o.PartialModesJSON,[]),encoding);const record=Object.assign(existingRecord,{scoring:calc.scoring,score:calc.score,maxScore:calc.maxScore,percent:calc.percent,counts:calc.counts,inputEncoding:encoding,updatedAt:new Date().toISOString()});sh.getRange(i+2,14).setValue(JSON.stringify(calc.scoring));sh.getRange(i+2,15).setValue(JSON.stringify(record));sh.getRange(i+2,17).setValue(new Date());updated++;});
  return {ok:true,updated:updated,stats:getExamStats_(examId)};
}

function exportExamData_(examId) {
  return {exam:getRowBy_(SHEETS.EXAMS,"ExamId",examId),questions:getQuestionRows_(examId),reports:listReports_({examId:examId})};
}

function backupReports_() {
  const ss=getSpreadsheet_(),src=getSheet_(SHEETS.REPORTS),name="Reports_Backup_"+Utilities.formatDate(new Date(),Session.getScriptTimeZone()||"Asia/Seoul","yyyyMMdd_HHmmss");
  const copy=src.copyTo(ss).setName(name);return {ok:true,sheetName:copy.getName(),rows:Math.max(0,copy.getLastRow()-1)};
}

function safeJson_(text,fallback) {
  try { return text===""||text===null||text===undefined?fallback:JSON.parse(String(text)); } catch(e) { return fallback; }
}
