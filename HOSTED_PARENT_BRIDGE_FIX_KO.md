# Young’s Physics v3.3.0 교사 인증 연결 수정

## 해결 대상

교사 PIN을 올바르게 입력했는데도 다음 오류가 표시되는 경우에 적용한다.

```text
Apps Script 서버에 연결하지 못했습니다.
GitHub의 YP_API_URL이 최신 /exec 주소인지,
웹 앱의 익명 접근으로 배포되었는지 확인하세요.
```

기존 화면의 “Apps Script 서버는 자동 연결되었습니다” 문구는 배포본에 `/exec` 주소가 들어 있다는 뜻일 뿐, 실제 POST 통신 완료를 뜻하지 않았다.

## v3.3.0의 통신 방식

기존 방식:

```text
GitHub Pages 최상위 페이지
→ Apps Script를 숨은 제3자 iframe/form으로 호출
→ 브라우저 보안·리디렉션 정책에 따라 응답 수신 실패 가능
```

수정 방식:

```text
GitHub Pages 주소 접속
→ Apps Script가 제공하는 보안 상위 페이지로 자동 전환
→ 상위 페이지 안에서 기존 GitHub 디자인을 그대로 표시
→ 상위 페이지의 google.script.run으로 Google Sheets 호출
```

교사용 화면과 학생 리포트 디자인은 GitHub Pages 파일을 그대로 사용하며, 서버 통신만 Apps Script가 직접 제공하는 공식 `google.script.run` 경로로 처리한다.

## 기존 운영본 업데이트

### 1. Spreadsheet 백업

```text
파일 → 사본 만들기
```

### 2. Code.gs 전체 교체

운영 Spreadsheet에서:

```text
확장 프로그램 → Apps Script → Code.gs
```

기존 내용을 백업한 뒤 v3.3.0 `Code.gs` 전체를 붙여넣고 저장한다.

- `installYoungsPhysics()` 재실행 불필요
- 기존 PIN 유지
- 기존 학생 기록·토큰·지문 유지
- `appsscript.json` 변경 없음

### 3. SITE_ORIGINS 확인

Apps Script의:

```text
프로젝트 설정 → 스크립트 속성
```

예를 들어 Pages 주소가:

```text
https://username.github.io/repository/
```

이면 다음처럼 설정한다.

```text
SITE_ORIGINS = https://username.github.io
```

연결 확인 중에는 `SITE_ORIGINS`와 구버전 `SITE_ORIGIN`을 모두 삭제해 임시 제한 해제도 가능하다.

### 4. Apps Script 새 버전 배포

```text
배포 → 배포 관리 → 기존 웹 앱 편집
→ 버전: 새 버전
→ 실행 사용자: 나
→ 액세스 권한: 모든 사용자
→ 배포
```

배포 후 `/exec?action=ping`에서 다음 버전을 확인한다.

```json
{
  "ok": true,
  "apiVersion": "3.3.0-hosted-parent-bridge"
}
```

### 5. GitHub 패치 적용

패치 ZIP 내부를 저장소 최상위에 덮어쓴다. ZIP 자체를 업로드하지 않는다.

주요 변경 파일:

```text
.github/workflows/pages.yml
site/index.html
site/report.html
site/assets/launch.js
site/assets/config.js
site/assets/api.js
site/assets/runtime-config.js
apps-script/Code.gs
package.json
tests/run-tests.mjs
```

### 6. YP_API_URL 확인

```text
GitHub 저장소 → Settings
→ Secrets and variables → Actions → Variables
→ YP_API_URL
```

값은 현재 Apps Script 운영 주소여야 한다.

```text
https://script.google.com/macros/s/.../exec
```

### 7. Pages 재배포

```text
Actions → Deploy Young's Physics to GitHub Pages → Run workflow
```

성공한 워크플로는 다음을 검사한다.

- 공개 ping 버전 3.3.0
- 기존 form POST 호환 경로
- 새 `view=host` 상위 보안 페이지
- GitHub Pages 배포 파일

### 8. 브라우저 확인

배포된 GitHub Pages 주소를 새 탭에서 연다. 정상이라면 주소가 Apps Script `/exec?view=host&site=...` 형태로 자동 전환된 뒤 기존 Young’s Physics 화면이 그대로 표시된다.

교사 PIN을 입력하고 다음을 확인한다.

```text
교사 연결됨
→ 시험 설정 서버 동기화
→ 학생 1명 저장
→ Reports 행 생성
→ 링크 복사
→ 시크릿 창에서 성적표 열기
```

## 재설치하지 않는 항목

이번 패치에서는 다음 작업을 다시 하지 않는다.

```text
installYoungsPhysics()
resetTeacherPin()
repairReportStorage()
Google Sheets 초기화
```

해당 작업은 실제 설치·PIN·토큰 문제가 있을 때만 별도로 실행한다.
