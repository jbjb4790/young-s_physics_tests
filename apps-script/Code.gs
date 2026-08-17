
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
  REPORTS: "Reports"
};

const HEADERS = {
  Courses: ["CourseId","CourseName","Active"],
  Exams: ["ExamId","CourseId","Round","Title","ShortTitle","AssessmentType","Section","ExamDate","QuestionCount","MaxScore","ExamPDF","SolutionPDF","ReviewStatus","ConfigVersion","Status","PagesJSON","CoreNoteJSON","InputProfileJSON","HistoryExamIdsJSON","HistoryLabel","SourceTitle","SourceNote","DisplayOrder"],
  Questions: ["ExamId","QuestionNo","Type","InputMode","MaxPoints","Unit","Topic","Difficulty","AnswerJSON","RubricJSON","ExplanationJSON","OriginalRetryJSON","SimilarProblemJSON","ReviewStatus","CorrectionNote","ImageJSON"],
  Reports: ["Token","Fingerprint","IdentitySeed","IdentityDigest","StudentKey","ExamId","CourseId","School","Name","Grade","ClassNo","ResultInputsJSON","PartialModesJSON","ScoringJSON","RecordJSON","CreatedAt","UpdatedAt"]
};

const API_VERSION = "3.2.4-report-token-affinity";
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
      .addItem("모든 교사 기기 세션 해제", "invalidateTeacherSessions")
      .addSeparator()
      .addItem("성적표 토큰 저장소 진단", "diagnoseReportStorage")
      .addItem("성적표 토큰 저장소 복구", "repairReportStorage")
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
    const action = String((e && e.parameter && e.parameter.action) || "ping");
    if (action === "bridge") {
      return bridgeHtml_(
        String(e.parameter.origin || ""),
        String(e.parameter.channel || "")
      );
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
 * GitHub Pages에서 Apps Script ContentService로 직접 fetch할 때 브라우저·조직 정책에 따라
 * 리디렉션/CORS 단계가 차단될 수 있다. 이 HTML 브리지는 Apps Script의 google.script.run을
 * 사용해 서버 함수를 호출하고, 결과만 postMessage로 GitHub Pages에 돌려준다.
 */
function bridgeHtml_(requestedOrigin, requestedChannel) {
  const origin = validateBridgeOrigin_(requestedOrigin);
  const channel = validateBridgeChannel_(requestedChannel);
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
    'function send(payload){try{parent.postMessage(payload,ORIGIN);}catch(e){}}',
    'function errorText(error){return error&&error.message?String(error.message):String(error||"Apps Script bridge error");}',
    'window.addEventListener("message",function(event){',
    '  if(event.source!==parent||event.origin!==ORIGIN)return;',
    '  var message=event.data||{};',
    '  if(message.type!=="YP_API_BRIDGE_REQUEST"||message.channel!==CHANNEL||!message.id)return;',
    '  google.script.run',
    '    .withSuccessHandler(function(result){send({type:"YP_API_BRIDGE_RESPONSE",channel:CHANNEL,id:String(message.id),result:result});})',
    '    .withFailureHandler(function(error){send({type:"YP_API_BRIDGE_RESPONSE",channel:CHANNEL,id:String(message.id),result:{ok:false,code:"BRIDGE_SERVER_ERROR",error:errorText(error)}});})',
    '    .apiBridge(message.body||{});',
    '});',
    'function ready(){',
    '  if(!(window.google&&google.script&&google.script.run)){setTimeout(ready,50);return;}',
    '  send({type:"YP_API_BRIDGE_READY",channel:CHANNEL,apiVersion:VERSION});',
    '}',
    'ready();',
    '})();',
    '<\/script></body></html>'
  ].join('');
  return HtmlService.createHtmlOutput(html)
    .setTitle("Young's Physics API Bridge")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function validateBridgeOrigin_(origin) {
  const value = String(origin || "").trim().replace(/\/$/, "");
  const secure = /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(value);
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/.test(value);
  if (!secure && !local) {
    throwApiError_("BRIDGE_ORIGIN_INVALID", "통신 브리지의 사이트 origin이 올바르지 않습니다.");
  }
  const props = PropertiesService.getScriptProperties();
  const configured = String(props.getProperty("SITE_ORIGINS") || props.getProperty("SITE_ORIGIN") || "").trim();
  if (configured) {
    const allowed = configured.split(/[\n,;]/).map(function(v){ return String(v || "").trim().replace(/\/$/, ""); }).filter(String);
    if (allowed.indexOf(value) < 0) {
      throwApiError_("BRIDGE_ORIGIN_DENIED", "현재 GitHub Pages 주소가 Apps Script SITE_ORIGINS 허용 목록에 없습니다.");
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
  try {
    return jsonOutput_(dispatchApiRequest_(parseBody_(e)));
  } catch (err) {
    return jsonOutput_(apiErrorObject_(err));
  }
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
        serverInstanceId:getServerInstanceId_(),
        transport:"html-service-bridge",
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
      return {ok:true, questions:getQuestionRows_(String(body.examId || ""))};
    case "saveExam":
      assertTeacherAuth_(body); return {ok:true, exam:saveExam_(body.exam || {})};
    case "saveQuestions":
      assertTeacherAuth_(body); return {ok:true, count:saveQuestions_(String(body.examId || ""), body.questions || [])};
    case "syncCatalog":
      assertTeacherAuth_(body); return syncCatalog_(body.catalog || {});
    case "saveReport":
      assertTeacherAuth_(body); return saveReport_(body.record || {});
    case "saveBatch":
      assertTeacherAuth_(body); return saveBatch_(body.records || []);
    case "getReport":
      return getReport_(String(body.token || ""), String(body.fp || ""));
    case "listReports":
      assertTeacherAuth_(body); return {ok:true, reports:listReports_(body), serverInstanceId:getServerInstanceId_()};
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
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const current = String(props.getProperty("SITE_ORIGINS") || props.getProperty("SITE_ORIGIN") || "").trim();
  const response = ui.prompt(
    "GitHub Pages 허용 주소 설정",
    "허용할 origin을 입력하세요. 예: https://username.github.io\n여러 주소는 쉼표로 구분합니다. 저장소 경로(/repo)는 입력하지 않습니다.\n현재값: " + (current || "미설정"),
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return {ok:false, cancelled:true};
  const raw = String(response.getResponseText() || "").trim();
  if (!raw) {
    props.deleteProperty("SITE_ORIGINS");
    props.deleteProperty("SITE_ORIGIN");
    try { getSpreadsheet_().toast("허용 주소 제한을 해제했습니다.", "Young's Physics", 10); } catch (toastErr) {}
    return {ok:true, siteOrigins:[]};
  }
  const values = raw.split(/[\n,;]/).map(function(v){ return String(v || "").trim().replace(/\/$/, ""); }).filter(String);
  const unique = [];
  values.forEach(function(value){
    const secure = /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(value);
    const local = /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/.test(value);
    if (!secure && !local) throw new Error("origin 형식이 올바르지 않습니다: " + value + " (경로 없이 https://도메인 형식으로 입력하세요.)");
    if (unique.indexOf(value) < 0) unique.push(value);
  });
  props.setProperty("SITE_ORIGINS", unique.join(","));
  props.deleteProperty("SITE_ORIGIN");
  try { getSpreadsheet_().toast("허용 사이트 " + unique.length + "개를 저장했습니다.", "Young's Physics", 12); } catch (toastErr) {}
  console.log("YOUNGS_PHYSICS_SITE_ORIGINS=" + JSON.stringify(unique));
  return {ok:true, siteOrigins:unique};
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
  const courseRows=catalog.courses.map(c=>[c.courseId,c.courseName,c.active!==false]);
  replaceData_(SHEETS.COURSES,courseRows);
  const examRows=[],questionRows=[];
  catalog.exams.forEach(function(ex){
    examRows.push([ex.examId,ex.courseId,ex.round,ex.title,ex.shortTitle||"",ex.assessmentType||"weekly",ex.section||"",ex.examDate||"",ex.questionCount||0,ex.maxScore||0,ex.pdf||"",ex.solutionPdf||"",ex.reviewStatus||"",ex.configVersion||"",ex.status||"",JSON.stringify(ex.pages||[]),JSON.stringify(ex.coreNote||{}),JSON.stringify(ex.inputProfile||{}),JSON.stringify(ex.historyExamIds||[]),ex.historyLabel||"",ex.sourceTitle||"",ex.sourceNote||"",ex.displayOrder||""]);
    (ex.questions||[]).forEach(function(q){
      questionRows.push([ex.examId,q.no,q.type,q.inputMode||"achievement",q.maxPoints,q.unit,q.topic,q.difficulty,JSON.stringify({display:q.answer,answerKey:q.answerKey}),JSON.stringify(q.rubric||[]),JSON.stringify({steps:q.explanation||[],formulas:q.formulas||[],commonMistakes:q.commonMistakes||[]}),JSON.stringify(q.originalRetry||{}),JSON.stringify(q.similarProblem||{}),q.reviewStatus||"",q.correctionNote||"",JSON.stringify(q.image||{})]);
    });
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
  const rows=(questions||[]).map(q=>[examId,q.no,q.type,q.inputMode||"achievement",q.maxPoints,q.unit,q.topic,q.difficulty,JSON.stringify({display:q.answer,answerKey:q.answerKey}),JSON.stringify(q.rubric||[]),JSON.stringify({steps:q.explanation||[],formulas:q.formulas||[],commonMistakes:q.commonMistakes||[]}),JSON.stringify(q.originalRetry||{}),JSON.stringify(q.similarProblem||{}),q.reviewStatus||"",q.correctionNote||"",JSON.stringify(q.image||{})]);
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,headers.length).setValues(rows);
  return rows.length;
}

function getQuestionRows_(examId) {
  return listRows_(SHEETS.QUESTIONS).filter(r=>String(r.ExamId)===String(examId)).sort((a,b)=>Number(a.QuestionNo)-Number(b.QuestionNo));
}

function parseScore_(raw,maxPoints,partialMode,inputMode) {
  const text=raw===null||raw===undefined?"":String(raw).trim(),mode=String(inputMode||"achievement");
  if(text==="") return {raw:String(raw||""),status:"ungraded",score:null,valid:true};
  const n=Number(text.replace(/,/g,""));
  if(mode==="binary") {
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

function calculateScoringFromQuestions_(questions,inputs,partialModes) {
  if(!questions||!questions.length) throw new Error("Questions 시트에 시험 문항이 없습니다. 먼저 시험 설정을 동기화하세요.");
  if((inputs||[]).length>questions.length) throw new Error("입력값이 시험 문항 수보다 많습니다.");
  const scoring=questions.map(function(q,i){
    const p=parseScore_((inputs||[])[i],Number(q.MaxPoints),(partialModes||[])[i]===true,String(q.InputMode||"achievement"));
    p.questionNo=Number(q.QuestionNo);p.maxPoints=Number(q.MaxPoints);p.unit=q.Unit;p.topic=q.Topic;p.inputMode=String(q.InputMode||"achievement");
    return p;
  });
  const invalid=scoring.filter(function(x){return !x.valid;});
  if(invalid.length) throw new Error("점수 입력 오류: "+invalid.map(function(x){return x.questionNo+"번";}).join(", "));
  const score=scoring.reduce(function(a,x){return a+(x.score===null?0:Number(x.score));},0);
  const maxScore=questions.reduce(function(a,q){return a+Number(q.MaxPoints);},0);
  const counts={full:0,partial:0,wrong:0,ungraded:0};scoring.forEach(function(x){counts[x.status]=(counts[x.status]||0)+1;});
  return {scoring:scoring,score:score,maxScore:maxScore,percent:maxScore?score/maxScore*100:0,counts:counts};
}

function calculateScoring_(examId,inputs,partialModes) {
  return calculateScoringFromQuestions_(getQuestionRows_(examId),inputs,partialModes);
}

function saveReport_(input) {
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const exam=getRowBy_(SHEETS.EXAMS,"ExamId",String(input.examId||""));
    if(!exam) throw new Error("등록되지 않은 시험입니다.");
    if(String(exam.Status)!=="ready") throw new Error("아직 준비 중인 시험입니다.");
    let name=String(input.name||"").trim();if(!name) throw new Error("학생 이름이 필요합니다.");
    const school=normalizeSchool_(input.school);
    const calc=calculateScoring_(String(input.examId),input.resultInputs||[],input.partialModes||[]);
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
    const now=new Date(),token=old?String(old.Token):newToken_(),seed=old?String(old.IdentitySeed):newToken_();
    const fingerprint=old?String(old.Fingerprint):makeFingerprint_(token,seed),courseId=String(exam.CourseId),identityDigest=makeIdentityDigest_(input.examId,courseId,school,name),studentKey=makeStudentKey_(courseId,school,name);
    const previousRecord=old?safeJson_(old.RecordJSON,{}):{};
    const record={
      token:token,fingerprint:fingerprint,studentKey:studentKey,examId:String(input.examId),courseId:courseId,school:school,name:name,
      grade:String(input.grade||""),classNo:String(input.classNo||""),teacherMemo:String(input.teacherMemo||""),
      resultInputs:input.resultInputs||[],partialModes:input.partialModes||[],scoring:calc.scoring,score:calc.score,maxScore:calc.maxScore,
      percent:calc.percent,counts:calc.counts,createdAt:old?serializeCell_(old.CreatedAt):now.toISOString(),updatedAt:now.toISOString()
    };
    if(input.importSource) record.importSource=input.importSource;
    else if(previousRecord.importSource) record.importSource=previousRecord.importSource;
    const row=[token,fingerprint,seed,identityDigest,studentKey,record.examId,courseId,school,name,record.grade,record.classNo,JSON.stringify(record.resultInputs),JSON.stringify(record.partialModes),JSON.stringify(calc.scoring),JSON.stringify(record),old?old.CreatedAt:now,now];
    if(rowIndex>=0) sh.getRange(rowIndex+2,1,1,headers.length).setValues([row]); else sh.getRange(sh.getLastRow()+1,1,1,headers.length).setValues([row]);
    const stats=getExamStats_(record.examId);
    return {ok:true,record:record,stats:stats,historyRecords:getLinkedHistoryRecords_(record),token:token,fp:fingerprint,displayName:name,created:!old,updated:!!old,serverInstanceId:getServerInstanceId_()};
  } finally { lock.releaseLock(); }
}

function saveBatch_(records) {
  if(!Array.isArray(records)||!records.length) return {ok:true,saved:[],savedCount:0,createdCount:0,updatedCount:0,failed:[],statsByExam:{}};
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  const touched={},saved=[],failed=[];let createdCount=0,updatedCount=0;
  try {
    const sh=getSheet_(SHEETS.REPORTS),headers=HEADERS.Reports;
    const data=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues():[];
    const examCache={},questionCache={},tokenIndex={},identityIndex={},namesByGroup={};
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
        const school=normalizeSchool_(input.school),calc=calculateScoringFromQuestions_(questionCache[examId],input.resultInputs||[],input.partialModes||[]);
        let rowIndex=-1,old=null;
        if(input.token){rowIndex=Object.prototype.hasOwnProperty.call(tokenIndex,String(input.token))?tokenIndex[String(input.token)]:-1;if(rowIndex<0)throw new Error("수정할 서버 토큰을 찾지 못했습니다.");old=rowToObject_(headers,data[rowIndex]);}
        else if(String(input.importMode||"upsert")==="upsert") {const key=reportIdentityKey_(examId,school,name);if(Object.prototype.hasOwnProperty.call(identityIndex,key)){rowIndex=identityIndex[key];old=rowToObject_(headers,data[rowIndex]);}}
        const group=[examId,normalizeIdentity_(school)].join("|");if(!namesByGroup[group])namesByGroup[group]=new Set();
        if(!old&&String(input.importMode||"upsert")!=="upsert"){const base=name;let n=1;while(namesByGroup[group].has(name)){n++;name=base+n;}}
        const now=new Date(),token=old?String(old.Token):newToken_(),seed=old?String(old.IdentitySeed):newToken_(),fingerprint=old?String(old.Fingerprint):makeFingerprint_(token,seed),courseId=String(exam.CourseId),identityDigest=makeIdentityDigest_(examId,courseId,school,name),studentKey=makeStudentKey_(courseId,school,name),previousRecord=old?safeJson_(old.RecordJSON,{}):{};
        const record={token:token,fingerprint:fingerprint,studentKey:studentKey,examId:examId,courseId:courseId,school:school,name:name,grade:String(input.grade||""),classNo:String(input.classNo||""),teacherMemo:String(input.teacherMemo||""),resultInputs:input.resultInputs||[],partialModes:input.partialModes||[],scoring:calc.scoring,score:calc.score,maxScore:calc.maxScore,percent:calc.percent,counts:calc.counts,createdAt:old?serializeCell_(old.CreatedAt):now.toISOString(),updatedAt:now.toISOString()};
        if(input.importSource)record.importSource=input.importSource;else if(previousRecord.importSource)record.importSource=previousRecord.importSource;
        const row=[token,fingerprint,seed,identityDigest,studentKey,examId,courseId,school,name,record.grade,record.classNo,JSON.stringify(record.resultInputs),JSON.stringify(record.partialModes),JSON.stringify(calc.scoring),JSON.stringify(record),old?old.CreatedAt:now,now];
        if(rowIndex>=0){data[rowIndex]=row;updatedCount++;}else{rowIndex=data.length;data.push(row);createdCount++;}
        tokenIndex[token]=rowIndex;identityIndex[reportIdentityKey_(examId,school,name)]=rowIndex;namesByGroup[group].add(name);touched[examId]=true;
        saved.push({token:token,fingerprint:fingerprint,examId:examId,courseId:courseId,school:school,name:name,score:calc.score,maxScore:calc.maxScore,updatedAt:record.updatedAt});
      } catch(err) {
        failed.push({index:batchIndex+1,name:String(input.name||""),sourceRow:input.importSource&&input.importSource.sourceRow||"",error:String(err&&err.message||err)});
      }
    });
    if(saved.length){
      const needed=data.length+1;if(sh.getMaxRows()<needed)sh.insertRowsAfter(sh.getMaxRows(),needed-sh.getMaxRows());
      sh.getRange(2,1,data.length,headers.length).setValues(data);
    }
  } finally { lock.releaseLock(); }
  const statsByExam={};Object.keys(touched).forEach(function(examId){statsByExam[examId]=getExamStats_(examId);});
  return {ok:true,saved:saved,savedCount:saved.length,createdCount:createdCount,updatedCount:updatedCount,failed:failed,statsByExam:statsByExam,serverInstanceId:getServerInstanceId_()};
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
  record=Object.assign(record,{token:String(row.Token),fingerprint:String(row.Fingerprint),studentKey:makeStudentKey_(String(row.CourseId),school,String(row.Name)),examId:String(row.ExamId),courseId:String(row.CourseId),school:school,name:String(row.Name),grade:String(row.Grade||""),classNo:String(row.ClassNo||""),resultInputs:safeJson_(row.ResultInputsJSON,[]),partialModes:safeJson_(row.PartialModesJSON,[]),scoring:scoring});
  if(record.score===undefined) record.score=scoring.reduce((a,x)=>a+Number(x.score||0),0);
  const exam=getRowBy_(SHEETS.EXAMS,"ExamId",record.examId);if(!exam)throwApiError_("EXAM_NOT_FOUND","연결된 시험 설정을 찾을 수 없습니다.");
  record.maxScore=Number(record.maxScore||exam.MaxScore||0);record.percent=record.maxScore?record.score/record.maxScore*100:0;
  record.counts={full:0,partial:0,wrong:0,ungraded:0};scoring.forEach(x=>record.counts[x.status]=(record.counts[x.status]||0)+1);
  return {ok:true,record:record,stats:getExamStats_(record.examId),historyRecords:getLinkedHistoryRecords_(record),serverInstanceId:getServerInstanceId_(),lookupMode:found.lookupMode,integrity:{tokenMatch:true,fingerprintMatch:true,identityMatch:true}};
}

function listReports_(filter) {
  return listRows_(SHEETS.REPORTS).map(function(row){
    const record=safeJson_(row.RecordJSON,{});
    const school=normalizeSchool_(row.School);
    return Object.assign(record,{token:String(row.Token),fingerprint:String(row.Fingerprint),studentKey:makeStudentKey_(String(row.CourseId),school,String(row.Name)),examId:String(row.ExamId),courseId:String(row.CourseId),school:school,name:String(row.Name),grade:String(row.Grade||""),classNo:String(row.ClassNo||""),resultInputs:safeJson_(row.ResultInputsJSON,[]),partialModes:safeJson_(row.PartialModesJSON,[]),scoring:safeJson_(row.ScoringJSON,[]),createdAt:serializeCell_(row.CreatedAt),updatedAt:serializeCell_(row.UpdatedAt)});
  }).filter(function(r){return (!filter.examId||r.examId===filter.examId)&&(!filter.courseId||r.courseId===filter.courseId);}).sort(function(a,b){return String(b.updatedAt).localeCompare(String(a.updatedAt));});
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
 * Reports 헤더를 정식 17열 스키마로 재배치하고 누락·불일치한 토큰 관련 필드를 복구한다.
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
  const key=String(record.studentKey||makeStudentKey_(record.courseId,record.school,record.name));
  return listReports_({courseId:String(record.courseId)}).filter(function(r){return ids.indexOf(String(r.examId))>=0&&String(r.studentKey||makeStudentKey_(r.courseId,r.school,r.name))===key;});
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
  rows.forEach(function(row,i){const o=rowToObject_(headers,row);if(String(o.ExamId)!==examId)return;const calc=calculateScoring_(examId,safeJson_(o.ResultInputsJSON,[]),safeJson_(o.PartialModesJSON,[]));const record=Object.assign(safeJson_(o.RecordJSON,{}),{scoring:calc.scoring,score:calc.score,maxScore:calc.maxScore,percent:calc.percent,counts:calc.counts,updatedAt:new Date().toISOString()});sh.getRange(i+2,14).setValue(JSON.stringify(calc.scoring));sh.getRange(i+2,15).setValue(JSON.stringify(record));sh.getRange(i+2,17).setValue(new Date());updated++;});
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
