# 변경 내역 — v3.6.7

## 원인
v3.6.6 `view=portalShare`는 Apps Script HtmlService에 OG 태그를 넣었지만, 카카오 크롤러의 HTML 처리와 Google 리디렉션/보안 래퍼 때문에 학생명 OG를 신뢰성 있게 읽어오지 못했습니다. GitHub Pages의 정적 `portal.html`은 공유 URL의 `#` 뒤 정보로 서버 측 제목을 바꿀 수 없습니다.

## 수정
- 외부 Cloudflare Worker가 학생 이름을 `og:title`로 HTTP 200 `text/html`에 직접 응답
- 실제 토큰·지문은 Worker URL의 URL fragment에만 보존; 브라우저에서 원래 GitHub 포털 링크로 이동
- Kakao 미리보기 서버가 JavaScript를 실행할 필요 없이 즉시 OG 메타데이터 조회
- Apps Script `portalShare` 경로는 구버전 링크 호환을 위해 유지, 신규 공유 버튼에서는 사용 안 함
- Worker 설정이 없으면 이름+직접 링크 문구 복사로 안전하게 대체
- `og:url` 메타 태그를 생략해 원래 `#` 공유 URL이 대체되지 않도록 함
- 수정 화면, 반별 학생 관리, 누적 총괄 코멘트, 기존 포털 보안/학생 병합 모두 유지

## 수정 범위
`site/assets/app.js`, `site/assets/portal.js`, `site/index.html`, `site/portal.html`, 신규 `site/assets/share-config.js`, `site/assets/share-link.js`, 신규 `cloudflare-worker/index.mjs`, 회귀 테스트, package.json.

## 주의사항
Worker를 생성·배포하고 `share-config.js`에 URL을 등록하기 전에는 학생별 OG 카드는 활성화되지 않습니다. 또한 이 시스템은 별도 Cloudflare 호스팅을 추가하며, 학생의 이름이 링크 쿼리·카카오 미리보기에 공개됩니다.


# Young’s Physics v3.6.7 — 학생 이름 카카오톡 미리보기 적용 안내

## 반드시 먼저 읽으세요

v3.6.6의 Apps Script `view=portalShare` 링크는 Kakao OG 봇이 Open Graph HTML을 안정적으로 읽기 어려웠습니다. v3.6.7은 **별도 HTML 응답 서버(Cloudflare Worker)**에서 학생별 `og:title`을 응답합니다. GitHub Pages는 그대로 학생 대시보드를 제공하고, Google Sheets/Apps Script는 그대로 성적 데이터를 저장합니다.

**중요:** 이 업데이트는 *GitHub 파일만 커밋해서는 개인별 카드가 활성화되지 않습니다.* Cloudflare Worker를 한 번 생성한 다음, 새 Worker 주소를 `site/assets/share-config.js`에 등록해야 합니다. Worker가 없으면 복사 버튼은 안전한 대안으로 `학생 이름 + 직접 링크`의 **두 줄 텍스트**를 복사합니다(카카오 카드 제목은 공통으로 남을 수 있음).

## 0. 백업

운영 Google Sheet 사본을 만들고 현재 GitHub 커밋을 보관합니다. 기존 학생 기록, 교사 PIN, Apps Script 배포는 손대지 않습니다.

## 1. Cloudflare Worker 만들기 (최초 1회)

1. Cloudflare 계정에 로그인한 뒤 **Workers & Pages → Create application → Create Worker**로 이동합니다. (버전에 따라 Create/Start with Hello World 등의 UI가 나타날 수 있습니다.)
2. 새 Worker의 이름은 예를 들어 `youngs-physics-preview`로 지정해 배포합니다.
3. **Edit code / Quick edit** 화면에서 이 패치의 `cloudflare-worker/index.mjs` 전체를 붙여넣고 **Deploy**합니다.
4. 주소가 `https://your-worker.your-subdomain.workers.dev` 형태로 표시됩니다. `/health`를 붙여 확인합니다.

    `https://your-worker.your-subdomain.workers.dev/health`

    정상 응답: `{ "ok": true, "service": "youngs-physics-og", "version": "3.6.7" }`

Cloudflare 계정과 배포를 직접 생성해야 합니다. 이 패키지는 Worker 소스만 제공하고 실제 공개 Worker를 대신 배포하지는 않습니다.

## 2. GitHub 소스 적용

`GitHub패치.zip` 압축을 풀어 내부 경로 그대로 GitHub 저장소 최상위에 올립니다. **기존 `.github/workflows/pages.yml`, `site/assets/runtime-config.js`, `apps-script/Code.gs`는 바꾸지 않습니다.**

새로 생긴 `site/assets/share-config.js`에서 다음 값만 변경합니다.

```javascript
window.YP_SHARE_CONFIG = Object.freeze({
  previewBaseUrl: "https://your-worker.your-subdomain.workers.dev"
});
```

주의: Worker 주소만 넣고 `/p`는 넣지 않습니다. 교사 PIN, 학생 이름, 학생 토큰, 지문, Apps Script 비밀키는 이 파일에 넣지 않습니다.

## 3. GitHub Pages 배포

변경 파일을 main 브랜치에 커밋하고 GitHub Actions → Pages 배포 성공을 확인합니다. 학생 페이지를 강력 새로고침합니다.

배포 사이트에서 다음 파일을 브라우저로 직접 열어 Worker 주소가 반영됐는지 확인합니다.

`https://jbjb4790.github.io/저장소명/assets/share-config.js`

## 4. 실제 학생 링크 복사

교사용 화면 → 반별 학생 또는 학생 목록 → 해당 학생의 **이름 미리보기 링크** 버튼을 누릅니다. 정상적인 복사 URL은 다음 구조입니다.

`https://your-worker.your-subdomain.workers.dev/p?n=학생이름&site=...portal.html#id=...&fp=...`

- `?n=학생이름`은 카카오 미리보기 제목에 쓰입니다.
- `#id=...&fp=...` 등은 브라우저에만 전달되며 Worker 서버에 HTTP 요청으로 보내지지 않습니다.
- 카카오톡에 새 URL을 붙여넣으면 OG 제목에 `Young's Physics ○○○ 학생 학습페이지`가 표시될 수 있습니다. 실제 메시지 미리보기는 카카오 서버에서 테스트해야 합니다.
- 카드 클릭 시 브라우저가 `portal.html#...`으로 이동합니다. **Google Apps Script 미리보기 페이지를 거치지 않습니다.**

## 5. 카카오 미리보기 확인/캐시 초기화

카카오디벨로퍼스 → **도구 → 카카오톡 URL 메타정보 관리**에서 새 Worker 공유 URL의 `og:title`, `og:image`가 정확한지 조회합니다.

공식 안내: https://developers.kakao.com/docs/ko/tool/common

기존 공유 주소는 카카오 캐시에 남을 수 있습니다. 새 Worker URL을 복사해서 다시 전송하고 필요하면 해당 URL의 캐시를 초기화합니다. **`og:url`을 생략하여 원본 공유 URL의 `#` 부분이 불필요하게 대체되지 않도록** 했습니다.

## 6. Google Drive 오류가 계속되는 경우

Worker를 거치면 공유 미리보기 자체는 별도로 동작하지만, 실제 학습 페이지의 Apps Script `/exec` 배포가 비활성화됐다면 학생 성적 조회는 별도로 실패할 수 있습니다. 시크릿 창에서 기존 Apps Script 주소의 `?action=ping`이 `ok:true` JSON을 반환하는지 확인하세요. 아닐 경우 기존 배포를 새 버전으로 갱신하고 공개 권한을 확인해야 합니다.

## 7. 개인정보/안전

- 학생 이름은 OG 미리보기·URL 쿼리에 노출됩니다. 학부모에게 공개해도 되는지 확인하세요.
- Worker에서 학생 점수·학교·학년·토큰·지문을 조회하거나 저장하지 않습니다.
- 토큰과 지문은 `#` 뒤에 있으므로 Worker의 HTTP 요청에는 포함되지 않습니다. 다만 카카오 메시지 원문에는 접속 링크 전체가 남습니다. 부모님 외에 전달하지 마세요.
- 학생 이름은 Worker에서 조회하지 않고 공유 링크에 지정된 표시 이름을 HTML에 출력합니다. 이름을 수정했다면 새 링크를 다시 복사하세요.
- 예전 Apps Script 미리보기 URL은 그대로 오류가 날 수 있으므로 새 Worker URL을 다시 전달하세요.
- 학생의 실제 기록 조회는 기존 Apps Script의 토큰·지문·학생 식별 검증을 계속 거칩니다.

## 실서버 테스트 체크

1. Worker `/health` 에서 `ok:true`
2. GitHub `/assets/share-config.js`에서 Worker 주소 확인
3. 교사용 복사한 URL이 Worker 도메인 `/p?n=...`로 시작하는지 확인
4. 시크릿 창에서 학생 링크 클릭 → 학생 통합페이지 정상 표시
5. 카카오 URL 메타정보 관리에서 `og:title`에 학생 이름 표시
6. 카카오톡 새 메시지로 카드와 링크 열기 확인

## 배포 범위

- GitHub `site/index.html`, `site/portal.html`, `site/assets/app.js`, `site/assets/portal.js` 변경
- 새 `site/assets/share-config.js`, `site/assets/share-link.js` 추가
- 새 `cloudflare-worker/index.mjs` 추가 (Cloudflare에 직접 배포)
- 테스트 코드 및 `package.json` 업데이트
- **Apps Script 코드/매니페스트 수정 없음, 추가 OAuth 권한 없음, 기존 배포 URL 변경 없음**
