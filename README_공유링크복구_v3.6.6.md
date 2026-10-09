# Young's Physics v3.6.6 — 학생 공유 링크 접속 안정화

## 변경 배경

v3.6.4~v3.6.5의 Apps Script `studentPortalShareHtml_()`는 카카오톡 링크 미리보기를 표시한 뒤 `window.location.replace(hostedUrl)`를 실행했습니다. Google Apps Script `HtmlService`는 IFRAME sandbox를 사용하며 자동 최상위 탐색을 제한합니다. 이 자동 이동이 실패하거나 중첩 프레임으로 연결될 위험을 줄이는 수정입니다.

**이 수정은 구버전 또는 폐기된 `/exec` 배포를 자동 복구하지 않습니다.** 먼저 같은 `/exec?action=ping`이 정상인지 확인하세요.

## 변경 사항

- 공유 미리보기의 학생 이름 Open Graph 제목 유지
- 공유 HTML 내부 자동 `location.replace()` 이동 제거
- 사용자 클릭 기반 `target="_blank"` 버튼으로 GitHub 포털 직접 이동
- 교사용 학생 목록·선택 학생 영역에 **직접 링크 복사** 추가
- 교사용 `열기` 버튼과 저장 완료 후 `열기`는 바로 GitHub 학생 포털 URL 사용
- 학부모 학생 페이지에도 **직접 링크 복사** 추가
- 기존 학생 포털 토큰·지문·서버 식별자 검증, Reports, 반 편성, 병합 기능 변경 없음
- 과거 공유용 URL을 최신 GitHub 포털 직접 URL로 변환하는 로컬 전용 `tools/old-share-link-to-direct.html` 제공. 학생 토큰을 외부 서버에 전송하지 않음

## 현재 장애 진단 (중요)

1. 교사 Apps Script **배포 관리**에서 기존 웹 앱 `/exec` 주소를 확인합니다.
2. 시크릿 창에서 **현재 `/exec?action=ping`** 을 엽니다.
   - JSON `ok:true` → 웹 앱 공개 GET이 정상. 3번으로 진행
   - Google 로그인 화면/Drive에서 파일을 열 수 없음/404 → 기존 `/exec` 배포가 접근 불가한 상태일 가능성. 3.6.6 코드만 올려서는 해결 불가. 기존 배포를 **편집하여 새 버전으로 갱신**하고 `액세스: 모든 사용자`, `실행 사용자: 나`를 확인하세요. 기존 배포를 삭제한 경우 새 배포 주소가 달라지므로 GitHub runtime-config의 API URL도 갱신해야 합니다.
3. `?view=portalShare` URL만 실패하면 3.6.6 패치를 적용합니다. 수정 후 공유 주소를 열면 학생 이름이 있는 페이지와 큰 **학생 학습 페이지 열기** 버튼이 나타납니다.
4. 기존 학부모 공유 링크가 폐기된 주소라면 `tools/old-share-link-to-direct.html`을 컴퓨터에서 열어 기존 링크를 붙여넣고 **직접 링크 생성**을 누르세요. 학생 토큰·지문이 유효하고 GitHub의 최신 API 주소가 정상이라면 바로 열 수 있습니다.

## 설치

1. Google Spreadsheet와 Code.gs를 백업하세요.
2. Apps Script `Code.gs`를 패치의 새 `Code.gs`로 교체합니다.
3. 기존 웹 앱 배포 관리에서 **새 버전**으로 업데이트하고 URL을 확인합니다.
4. GitHub 패치 ZIP의 내부 파일을 저장소 최상위 경로에 덮어쓰고 커밋합니다.
5. GitHub Pages 재배포 후 강력 새로고침합니다.
6. 교사용 `학생 통합 링크 → 직접 링크 복사`와 `이름 미리보기 링크`를 각각 확인합니다.

**유지되는 설정:** `.github/workflows/pages.yml`, `site/assets/runtime-config.js`, `appsscript.json`, 교사 PIN, 기존 학생 성적 및 영구 포털 토큰.

## 보안과 운영 주의

- 학생 이름 표시 링크는 카카오톡 크롤러가 Apps Script 주소를 읽을 수 있어야 미리보기가 만들어집니다. 플랫폼별 미리보기는 실제 운영 테스트가 필요합니다.
- 학생 이름·토큰·지문을 채팅 지원 문의에 그대로 붙여넣지 마세요. 문제 진단에는 `/exec?action=ping`의 정상/오류 결과와 링크의 **도메인 및 `view` 항목만** 있으면 충분합니다.
- 학생이 병합되어 흡수된 프로필의 링크는 원래 정책대로 비활성화됩니다. 링크 변환으로 다른 학생 권한을 얻을 수는 없습니다.
- 현재 패치 후 공유 링크를 누르면 먼저 개인화된 안내 페이지를 보여주고 학부모가 버튼을 누르면 학습 페이지가 열립니다. 이는 Google iframe 제한을 피하기 위한 의도적 추가 탭입니다.

## 검증

`npm test` 및 Node JS 구문 검사. 테스트는 Apps Script 출력 문자열의 모의 실행과 프런트엔드 코드를 확인하나 실제 Google 계정/카카오톡에서의 배포 테스트를 대체하지 않습니다.
