# Young’s Physics Apps Script 3.2

## 설치 파일

```text
Code.gs
appsscript.json
```

Google Spreadsheet에 연결된 Apps Script 프로젝트에 두 파일을 적용합니다.

## 최초 설치·업데이트

```text
installYoungsPhysics()
```

이 함수는 다음을 수행합니다.

- 현재 Spreadsheet ID 연결
- Courses, Exams, Questions, Reports 시트 생성·안전 마이그레이션
- 학생 링크용 `FINGERPRINT_SECRET` 자동 생성
- 교사 세션용 `SESSION_SECRET` 자동 생성
- 세션 일괄 무효화용 `AUTH_EPOCH` 자동 생성
- 교사 PIN이 없으면 10자리 무작위 PIN 생성
- 학교가 빈칸이거나 구버전 `미입력`인 기록을 `미기입`으로 정리
- 학교 표기 변경에 맞춰 `IdentityDigest`, `StudentKey`, `RecordJSON`도 함께 갱신

기존 PIN이 있으면 설치 함수가 변경하지 않습니다.

Spreadsheet를 새로고침하면 `Young's Physics` 메뉴가 추가됩니다.

```text
① 설치·시트 초기화
학교 미기입 표기 정리
교사 PIN 직접 변경
무작위 교사 PIN 재발급
모든 교사 기기 세션 해제
연결 상태 확인
```

## Excel 일괄 저장 API

사이트가 `.xlsx`를 브라우저에서 해석한 뒤 정규화한 학생 기록을 다음 API로 전송합니다.

```text
saveBatch
```

3.2의 `saveBatch`는 다음 방식으로 동작합니다.

- Reports 시트를 한 번 읽음
- 동일 `examId + 학교 + 이름` 기록을 찾아 upsert
- 기존 토큰·지문·학부모 링크 유지
- 신규·수정 학생을 메모리에서 반영
- 전체 결과를 한 번의 `setValues`로 저장
- 영향받은 시험만 통계를 다시 계산
- 저장 성공·신규·수정·실패 건수를 반환

학교는 빈칸, `미입력`, `미기입`을 모두 동일한 학교 식별값으로 취급하고 저장값은 `미기입`으로 통일합니다.

## 교사 인증 API

```text
bootstrap
teacherLogin
sessionStatus
createDeviceSetupToken
claimDevice
```

교사 세션 기본 유효기간은 90일입니다. 브라우저에는 `WRITE_KEY`가 아니라 서명된 세션 토큰만 저장됩니다.

## 성적 API

```text
syncCatalog
saveReport
saveBatch
listReports
deleteReport
getReport
getExamStats
checkIntegrity
repairIntegrity
recalculateExam
exportExamData
backupReports
checkStorageLocation
```

학생 리포트 조회는 교사 세션을 요구하지 않지만, 토큰·지문·학생 식별 다이제스트를 모두 검증합니다.

## Script Properties

설치 함수가 자동으로 관리합니다.

```text
SPREADSHEET_ID
FINGERPRINT_SECRET
SESSION_SECRET
TEACHER_PIN_HASH
TEACHER_PIN_SALT
AUTH_EPOCH
```

선택 설정:

```text
SESSION_TTL_DAYS           기본 90, 1~365
SETUP_TOKEN_TTL_MINUTES    기본 10, 2~60
WRITE_KEY                  구버전 호환·긴급 복구용만 사용
```

## 웹 앱 배포

```text
실행 사용자: 나
액세스 권한: 모든 사용자
```

운영 사이트에는 `/exec` 주소를 사용합니다. `Code.gs`를 수정한 뒤에는 기존 웹 앱 배포를 새 버전으로 갱신해야 합니다.
