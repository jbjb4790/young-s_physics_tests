# Apps Script 설치 및 스키마 마이그레이션

`Code.gs`는 주간 복습과 총괄평가를 같은 Reports 시트에서 관리합니다.

## Script Properties

```text
SPREADSHEET_ID
WRITE_KEY
FINGERPRINT_SECRET
```

FINGERPRINT_SECRET을 생략하면 WRITE_KEY를 지문 서명 비밀값으로 사용하지만, 서로 다른 값을 권장합니다.

## 최초 설치

1. Google Spreadsheet에 연결된 Apps Script에 Code.gs를 붙여넣습니다.
2. Script Properties를 설정합니다.
3. `connectThisSpreadsheet()`를 실행합니다.
4. 웹 앱으로 새 배포합니다.
5. GitHub Pages 교사용 화면에서 카탈로그 동기화를 실행합니다.

## 기존 주간 시스템에 적용

이번 버전은 Exams, Questions, Reports의 열 수와 순서가 달라집니다. `ensureSheetSchema_()`가 기존 1행 헤더 이름을 기준으로 데이터를 새 스키마에 재배치합니다. 따라서 Code.gs를 교체한 뒤 `connectThisSpreadsheet()`를 실행해야 합니다.

기존 Reports의 StudentKey는 비어 있어도 조회할 때 계산됩니다. 완전한 무결성 갱신은 WRITE_KEY와 FINGERPRINT_SECRET 설정 후 `repairIntegrity` API를 실행합니다.

## 주요 API

```text
ping
listCourses
listExams
getExam
getQuestions
syncCatalog
saveReport
saveBatch
getReport
listReports
deleteReport
getExamStats
checkIntegrity
repairIntegrity
recalculateExam
exportExamData
backupReports
checkStorageLocation
```

`getReport`와 `saveReport`는 총괄평가일 때 `historyRecords`도 반환합니다. 연결 대상은 Exams 시트의 `HistoryExamIdsJSON`과 Reports의 `StudentKey`로 결정합니다.

## 보안

- WRITE_KEY는 쓰기·목록·삭제 요청에 필요합니다.
- 학생 리포트 GET은 토큰과 지문을 모두 검증합니다.
- 서버에서는 지문 HMAC, IdentityDigest, StudentKey를 다시 검사합니다.
- 학생 링크에 WRITE_KEY가 포함되지 않습니다.
