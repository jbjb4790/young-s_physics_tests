# Young's Physics v3.6.4 적용 안내

## 1. Google Spreadsheet 백업
운영 Google Spreadsheet에서 `파일 → 사본 만들기`로 백업한다.

## 2. Apps Script Code.gs 교체
1. 운영 Spreadsheet에서 `확장 프로그램 → Apps Script`를 연다.
2. 기존 `Code.gs`를 별도 백업한다.
3. v3.6.4 `Code.gs` 전체 내용으로 교체한다.
4. 저장한다.

이번 변경은 시트 구조를 바꾸지 않으므로 다음 함수는 실행하지 않는다.

- `installYoungsPhysics()`
- `resetTeacherPin()`
- `migrateStudentPortals()`
- `repairReportStorage()`

`appsscript.json` 권한도 변경되지 않았다.

## 3. Apps Script 웹 앱 새 버전 배포
`배포 → 배포 관리 → 기존 웹 앱 편집 → 버전: 새 버전 → 배포`

기존 설정을 유지한다.

- 실행 사용자: 나
- 액세스 권한: 로그인하지 않은 사용자를 포함한 모든 사용자

기존 배포를 새 버전으로 갱신하면 `/exec` 주소는 일반적으로 유지된다.

## 4. GitHub 패치 적용
`YoungsPhysics_학생이름_링크미리보기_v3.6.4_GitHub패치.zip`을 압축 해제하고 내부 파일을 저장소 최상위에 덮어쓴다.

이번 패치는 `.github/workflows/pages.yml`과 `site/assets/runtime-config.js`를 변경하지 않는다.

권장 커밋 메시지:

`Personalize student portal share preview with student name v3.6.4`

## 5. GitHub Pages 배포 후 강력 새로고침
- Windows: `Ctrl + Shift + R`
- Mac: `Command + Shift + R`

## 6. 확인 방법
교사용 화면에서 학생의 `영구 링크 복사`를 누른다.

정상적인 새 링크는 GitHub 주소가 아니라 다음과 비슷한 Apps Script 공유 주소이다.

`https://script.google.com/macros/s/.../exec?view=portalShare&token=...&fp=...&site=...&sid=...`

이 링크를 카카오톡에 새 메시지로 붙여넣었을 때 제목이 다음처럼 표시되어야 한다.

`Young's Physics OOO 학생 학습페이지`

링크를 누르면 기존 학생 통합 학습 페이지로 자동 이동한다.

## 7. 기존에 보낸 링크
기존 `github.io/portal.html#...` 링크는 계속 작동한다. 다만 기존 링크를 그대로 다시 붙여넣으면 일반 제목이 표시될 수 있다.

앞으로는 교사용 화면의 `영구 링크 복사` 버튼 또는 학생 페이지의 `이 페이지 링크 복사` 버튼으로 새 공유 링크를 복사해 전달한다.

## 8. 카카오톡 미리보기 캐시
카카오톡은 이미 미리보기한 동일 URL의 카드 정보를 캐시할 수 있다. v3.6.4의 공유 URL은 기존 GitHub 링크와 주소 자체가 달라지므로 일반적으로 새 카드가 생성된다. 테스트 시에는 반드시 새로 복사한 v3.6.4 링크를 사용한다.
