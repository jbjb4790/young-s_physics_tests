# Young’s Physics v3.7.13 검증 보고서

작성: 2026-11-13. 기준: 대화에 제공된 `YP_3712_full_source.zip`. 운영 변경·배포 없음.

## 요청과 구현

반별 학생 탭에 현재 반/전체 학생 범위 선택, 이름 일부·학교명 검색, 결과 클릭을 추가했습니다. 검색은 이미 인증된 교사에게 반환된 명단에 한정하고, 검색만으로 쓰기 API를 호출하지 않습니다.

반에 학생을 추가할 때 검색 결과에서 기존 학생을 직접 선택하고 확인하여 배정합니다. 학교·학년·학교 반번호·StudentId 끝6자리를 함께 표시하며 동명이인을 이름으로 자동 선택하지 않습니다. 이미 등록된 학생은 비활성 표시합니다. 현재 반과 다른 반의 소속도 유지합니다. 새 학생 생성은 별도 버튼으로 분리하고 동일 이름이 있으면 경고하며 forceNewStudent=true로 의도를 명시합니다.

학교명 수정은 선택 학생 패널과 전체 학생 통합 링크 목록에서 실행합니다. 기존 `saveStudentProfile` API에 `studentId`와 `school`만 전송합니다. 점수 저장이나 학생 재생성, 병합을 동반하지 않습니다. 변경된 학교명은 프로필과 이후 입력에 반영하고 기존 Reports의 학교명은 당시 값으로 유지합니다. 기존 성적 수정 시 프로필과 학교가 다르면 현재 학교를 적용할지 확인하며, 취소하면 저장하지 않습니다.

## 기준 버전과 산출물

사용자가 마지막으로 명시한 운영 상태는 v3.7.10입니다. 이후 v3.7.12 적용 성공은 확인되지 않았으므로 다음 두 패치를 구분했습니다.

- 정상 v3.7.12 → v3.7.13 증분: `YP_3713_patch_from_3712.zip`.
- 정상 v3.7.10 → v3.7.13 누적: `YP_3713_cumulative_from_3710.zip`. 기존 v3.7.11 원본 등록과 v3.7.12 총괄평가 등록을 포함합니다.
- 전체소스: `YP_3713_full_source.zip`.

실제 운영 커밋·운영 Code.gs·/exec·Google Sheets·Worker를 읽거나 수정하지 않았습니다. 동봉된 읽기 전용 사전검사가 실제 저장소 비교를 위한 절차이며 운영 접속 검증을 대신하지 않습니다.

## 변경 사유와 영향

증분 기준 기존 파일 16개 수정, 신규 14개, 삭제 0개입니다. 실행 코드 변경은 교사 화면 3파일(`site/index.html`, `site/assets/app.js`, `site/assets/styles.css`)에 한정합니다. 이외 변경은 package 버전·테스트 기대값과 신규 검증/안내 자료입니다.

카탈로그 JSON/JS는 v3.7.12와 바이트 동일합니다. 앱 릴리스는 v3.7.13이지만 카탈로그 featureVersion은 기존 `3.7.12-physics2-emw-total`을 유지합니다. 시험 설정이 바뀌지 않았는데 자동 동기화를 유발하지 않기 위한 구분입니다. `pages.yml`의 기존 표시 버전과 API 호환 문자열도 변경하지 않았습니다.

증분 기준 기존 시험 46개(준비29)·301문항, 모든 원본 PDF/페이지 PNG/문항JSON 보존. 전자기·파동 총괄평가, 물리2심화5회차, 심화4회 및 물리1 16회 신구분리, 총괄 성적표 바로보기, Word/PDF 출력, 학생 병합/삭제/기존 결과 수정은 그대로입니다.

## Apps Script·운영 구성

Apps Script Code.gs, appsscript.json, Cloudflare Worker, .github/workflows/pages.yml, runtime-config.js, share-config.js, api.js, core.js, report.js, portal.js에 변경이 없습니다. 재배포·권한 갱신·PIN 초기화·토큰 재발급이 필요하지 않습니다. 기존 GAS가 이 프로젝트의 saveStudentProfile/addStudentToClass를 지원해야 하며 다른 서버 정본을 임의로 덮어쓰지 않습니다.

## 개인정보·학생 링크 불변성

v3.7.12의 실행 코드·시험 자료 중 이번에 수정한 3개 UI 파일을 제외한 **249개 파일의 SHA-256이 동일**합니다. 새 CSS는 기존 테마 CSS 뒤에 교사 UI용 선택자만 추가했고 기존 부분의 해시도 검사했습니다. 신원·링크·병합·기존 선택·일괄입력·자동동기화 함수 15개 블록의 원문 해시도 보존했습니다.

실제 Apps Script 함수를 메모리 Sheets 대체 환경에서 실행하여 학교 수정 전후 StudentId·PortalToken·PortalFingerprint·IdentitySeed·이름·학년·반번호·외부ID·생성일 보존을 검증했습니다. School, IdentityKey, IdentityDigest, UpdatedAt의 변경은 학교 정보 수정에 따른 기존 서버의 의도된 처리입니다. IdentityDigest 갱신을 링크 fingerprint 재발급으로 혼동하지 않습니다.

이때 기존 Reports 모든 행/JSON·점수·Token·Fingerprint·반 멤버십·다른 학생을 바꾸지 않는 것을 확인했고, 기존 포털 토큰·지문으로 수정된 프로필과 예전 성적에 접근하는 서버 함수도 통과했습니다. 같은 이름 학생의 새 생성/기존 배정은 별도로 검사했습니다.

실제 학생 개인정보, 운영 토큰, 교사 PIN은 테스트에 사용하지 않았습니다. 실제 운영 DB 불변성을 원격으로 조회한 결과가 아니라, 운영 쓰기를 하지 않았고 가상 데이터로 동작을 확인한 결과입니다.

## 자동 검사

기준 v3.7.12: 439개 중438통과·1건너뜀·0실패.
최종 작업본: **470개 중469통과·1건너뜀·0실패**.
v3.7.12+완성 증분 ZIP 재현본: 동일.
v3.7.10+완성 누적 ZIP 재현본: 동일.
전체 ZIP 독립 압축해제본: 동일.

건너뜀1개는 이전부터 필요한 별도179명 학생 Excel 원본 부재입니다. 새 학생관리31개 검사는 모두 수행했습니다. 이전 테스트를 실패하지 않도록 삭제하지 않았고, 승인된 app.js/styles.css 변경은 새 전용 검사로 검증하며 다른 보호 파일 검사는 유지했습니다. package 및 교사 JS 캐시 버전 기대값만 이번 버전에 맞췄습니다.

신규 검사는 부분 검색/공백/학교 검색, 현재 반·전체 범위, 결과 없음, HTML 이스케이프, 동명이인 ID 선택, 명시 선택 전 쓰기 차단, 중복 배정·중복 클릭, 원래 반 유지, 새 학생 생성 경고, 학교 부분 업데이트, 저장 실패·취소·잘못된 응답 ID/지문, 데모 저장 금지, 과거 학교로의 자동 회귀 차단, 교사 인증, 실제 GAS 프로필 수정·반 배정·동명이인 신규 생성 등을 포함합니다.

## 브라우저 검사

실제 교사 HTML/CSS/app/core 코드를 Chromium에 넣고 가상 학생과 메모리 API/localStorage로 **25개 항목 통과**. 현재/전체 검색, 결과 클릭·학교 자동 채움, Enter 키 선택, 반 배정, 추가 화면의 검색 연결, 동명이인 생성 취소, 학교 저장, 입력 중 점수 보존, 저장 실패, 과거 성적 재저장 확인, 390px 모바일 가로 넘침0, JavaScript 예외0, 외부 요청0을 확인했습니다.

환경 정책으로 localhost HTTP 이동이 차단되어 자산을 인라인으로 주입했습니다. 따라서 실제 HTTP 배포/GAS/Sheets E2E가 아닙니다. `docs/validation/roster3713/browser_results.json`과 가상 학생 스크린샷, npm-test.log를 포함했습니다. 운영 적용 전 복제 시트/테스트 학생 스모크 검사가 필요합니다.

## 적용 및 되돌리기

자세한 절차는 `README_3713_apply_rollback.md`에 있습니다. 현재 저장소 ZIP을 패치 안 `CHECK_3713.py`로 읽기전용 검사하여 PASS_BASE이면 해당 패치 하나만 적용하고, ALREADY_COMPLETE이면 재적용하지 않으며 STOP이면 덮어쓰지 않습니다.

정적 배포 전 운영 소스·Sheets 사본을 백업합니다. 증분에서 카탈로그를 바꾸지 않으므로 이번 UI만을 위한 시험 설정 수동 동기화는 필요하지 않습니다. 누적 패치에서는 신규 시험 정의가 포함되므로 자동 동기화/정답 덮어쓰기 상태를 확인합니다. 배포 후 Ctrl+F5로 교사화면 캐시를 갱신합니다.

문제 발생 시 실제 적용 직전 커밋에서 이번 정적 변경만 되돌립니다. 학생·성적 삭제, StudentId/토큰 재발급, Sheets 과거 사본 전체 덮어쓰기는 하지 않습니다. 이미 저장된 학교명/반 소속은 정적 롤백으로 되돌아가지 않으므로 해당 학생만 정확히 재수정합니다. 누적 적용 후 새 시험 기록이 있으면 새 시험 정의/자료는 남깁니다.

## 증분 변경 파일

- `package.json`
- `site/assets/app.js`
- `site/assets/styles.css`
- `site/index.html`
- `tests/physics1-r06-q04-revision.test.mjs`
- `tests/physics2-advanced-r02.test.mjs`
- `tests/physics2-advanced-r03.test.mjs`
- `tests/physics2-advanced-r04-versioning.test.mjs`
- `tests/physics2-advanced-r04.test.mjs`
- `tests/physics2-advanced-r05.test.mjs`
- `tests/physics2-emw-total.test.mjs`
- `tests/physics2-r13.test.mjs`
- `tests/physics2-r14.test.mjs`
- `tests/physics2-r15.test.mjs`
- `tests/run-tests.mjs`
- `tests/share-preview.test.mjs`

## 신규 파일

- `CHECK_3713.py`
- `PATCH_MANIFEST_3713.json`
- `README_3713_apply_rollback.md`
- `YP_3713_validation_report.md`
- `docs/validation/roster3713/assign_search_desktop.png`
- `docs/validation/roster3713/assign_search_mobile.png`
- `docs/validation/roster3713/browser_results.json`
- `docs/validation/roster3713/npm-test.log`
- `docs/validation/roster3713/roster_search_desktop.png`
- `docs/validation/roster3713/roster_search_mobile.png`
- `docs/validation/roster3713/school_editor_desktop.png`
- `tests/fixtures/roster-server-harness.mjs`
- `tests/fixtures/roster-v3712-baseline.json`
- `tests/roster-search-school.test.mjs`
