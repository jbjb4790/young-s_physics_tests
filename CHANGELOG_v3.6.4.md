# Young's Physics v3.6.4 변경 내역

## 목적
학생 통합 영구 링크를 카카오톡·문자·메신저에 붙여넣었을 때 기존의 일반 제목 대신 학생 이름을 포함한 제목이 표시되도록 개선한다.

예시:

`Young's Physics 김물리 학생 학습페이지`

## 핵심 변경
- GitHub Pages 정적 `portal.html#...` 링크 대신 Apps Script `view=portalShare` 공유 URL을 복사한다.
- Apps Script가 학생 영구 토큰·지문을 검증한 뒤 학생 이름으로 Open Graph 메타태그를 서버에서 렌더링한다.
- 공유 미리보기에는 학생 이름만 포함하고 학교·점수·시험 기록은 포함하지 않는다.
- 사람이 링크를 열면 JavaScript로 기존 hosted parent bridge 학습페이지로 즉시 이동한다.
- 학생 페이지 내부의 `이 페이지 링크 복사`도 동일한 개인화 공유 URL을 복사한다.
- 실제 브라우저 탭 제목도 `Young's Physics OOO 학생 학습페이지`로 변경된다.
- 기존 학생 영구 토큰·지문, 성적, 반 편성, 누적 코멘트, 오답 학습 구조는 유지한다.

## 수정 파일
- `apps-script/Code.gs`
- `site/assets/app.js`
- `site/assets/portal.js`
- `site/portal.html`
- `site/index.html`
- `package.json`
- `tests/run-tests.mjs`
- `README.md`

## 중요한 기술적 이유
기존 학생 링크의 학생 식별값은 URL `#hash`에 들어 있다. Hash 값은 웹 서버나 카카오톡 미리보기 크롤러의 HTTP 요청에 전달되지 않으며, GitHub Pages는 정적 호스팅이므로 학생별 `<meta property="og:title">`을 서버에서 만들 수 없다.

따라서 공유용 링크만 Apps Script가 동적으로 렌더링하고, 실제 학습 화면은 기존 GitHub Pages를 그대로 사용하는 구조로 변경했다.
