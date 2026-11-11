# Young’s Physics v3.7.12 누적 패치 검증 보고서

작성일: 2026-11-10. 적용 기준: 제공된 정상 `YoungsPhysics_v3.7.10_full_source.zip`.
운영 상태는 사용자가 v3.7.10 적용이라고 확인한 내용을 기준으로 삼았습니다.
실제 GitHub 커밋·운영 Apps Script `/exec`·Google Sheets·Cloudflare 상태는 원격 조회하지 않았습니다.
운영 쓰기·배포는 0건입니다.

## 변경 목적과 범위

v3.7.10에서 바로 적용하는 누적 패치입니다. 미적용 v3.7.11 원본 최종 물리2심화 5회차와
물리2 전자기·파동 총괄평가를 포함합니다. 과거 재구성본이나 Builder를 먼저 설치하지 않습니다.
총괄평가 ID `physics2-basic-total-electromagnetism`을 중복 생성 없이 coming-soon에서 ready로 활성화했습니다.
새 심화5회 ID는 `physics2-advanced-r05`입니다.

총괄: 객관20+서술5, 전 문항4점·100점. 객관식은 선택번호1~5, 서술형은 실제0~4점.
물리2 11~15회 누적 결과와 연결하며, 기존 학부모 총괄평가 분류와 성적표 바로보기 버튼을 사용합니다.
심화5회: 원본7문항100점, 배점15·15·15·15·15·15·10. 6번은 문제지15점을 우선합니다.
최종 카탈로그: 4과정,46시험,준비완료29시험,301문항.

## 원본 자료

전자기/파동 문제지17쪽·해설지26쪽은 업로드된 원본과 바이트 동일합니다.
문제 PDF SHA256: `6c9935820ca4273bcbc58f761fd1699e7946a1664c3d184cdb53e8bf114a3ee5`
해설 PDF SHA256: `e7597337eb1f395b9e4360163e73fbe36f8f39974cb2b0b62895efb1c2c808ee`

문제페이지17개는 200dpi PNG이며, 문항25개는 원본의 문장·수식·그림·선택지·답안칸을 포함한 영역을 그대로 사용합니다.
문항별 crop의 좌표는 [x,y,width,height]입니다. 별도 원본추출 manifest의 [left,top,right,bottom]과 혼동하지 않도록 변환·검증했습니다.
원문 해설25개도 원본 해설 PDF의 해당 문항 영역에서 추출했습니다.
원본의 글·그림·정답을 새로 작성하거나 수정하지 않았습니다.

실제 패키지의 PDF를 다시 렌더링하여 문제페이지17개 및 해설crop25개의 픽셀 일치를 확인했습니다.
Chromium의 실제 YP.drawQuestionCrop으로 그린 canvas25개를 원본crop과 비교하여 모두 픽셀 일치를 확인했습니다.
기존 시험의 PDF·페이지이미지는 모두 바이트 보존했습니다.

## 공식 정답과 원문 표현 대조

객관식 정답: 3,2,2,3,2,5,3,1,1,3,3,5,2,4,5,1,2,1,5,4.
채점은 첨부 공식 정답표를 사용하며 임의로 복수 정답·새 정답을 추가하지 않았습니다.
3·5·6·13·15·24번의 표현 차이는 `SOURCE_REVIEW_3712.md`와 제출 후 해설에 구분했습니다.
특히3·13·15번은 교사가 문제·해설을 확인한 뒤 실제 채점에 사용해야 합니다.
UI의 검수 표시는 '공식해답기준'으로 명시하며, 전 문항 오류가 없다고 독립 인증한 것으로 표현하지 않습니다.
문항25개의 원문 재도전 선택지와 새 동형25개를 제공하되, 동형은 '동형 (새 작성)'으로 표시합니다.
서술형 세부 배점은 원문에 없어 임의 확정하지 않았습니다.

## 소스 영향과 보호 범위

기존시험 정의는 총괄 활성화, 심화5회 추가, 심화총괄 history의 r05 연결 이외에는 동일합니다.
물리1 16회 및 물리2심화4회 신구 분리, 반·학생관리·병합, 기존 영구 링크, 총괄 누적 코멘트와 순위정책을 유지합니다.
Apps Script·매니페스트·Cloudflare Worker·API·코어·학생 식별자 생성/검증 로직 변경 없음.
Apps Script/Worker 재배포·학생링크 재발급·PIN 재설정·설치함수 실행은 필요하지 않습니다.

보고서 UI `site/assets/report.js`에만 원문해설 이미지·해당PDF쪽 링크와 출처 기반 안내 표시를 추가했습니다.
새 필드가 없는 기존 시험은 기존 HTML을 사용합니다. 링크는 고정된 내부자료 경로만 허용합니다.
변경은 표시문구3곳과 선택적 원문해설 렌더함수1개이며 역치환하면 v3.7.10 report.js SHA가 일치합니다.
학생 소유권·token/fingerprint·API 요청·점수·재도전 채점 코드는 바꾸지 않았습니다.

아래20개 보호 파일은 v3.7.10과 SHA256이 동일합니다.
- `cloudflare-worker/index.mjs`
- `apps-script/appsscript.json`
- `apps-script/Code.gs`
- `apps-script/README.md`
- `.github/workflows/pages.yml`
- `site/assets/runtime-config.js`
- `site/assets/api.js`
- `site/assets/xlsx-import.js`
- `site/assets/core.js`
- `site/assets/config.js`
- `site/assets/share-config.js`
- `site/assets/styles.css`
- `site/assets/share-link.js`
- `site/assets/portal.js`
- `site/assets/vendor/docx-export.bundle.js`
- `site/assets/images/favicon.png`
- `site/assets/images/logo-mark.png`
- `site/assets/images/logo.png`
- `site/assets/images/logo-source.png`
- `site/assets/app.js`

수정된 기존파일21개(나머지는 신규자료/검사/문서):
- `package.json`
- `site/assets/data/catalog.js`
- `site/assets/data/catalog.json`
- `site/assets/report.js`
- `site/index.html`
- `site/portal.html`
- `site/report.html`
- `tests/conditional-explanations.test.mjs`
- `tests/physics1-r06-q04-revision.test.mjs`
- `tests/physics1-r16-versioning.test.mjs`
- `tests/physics2-advanced-r02.test.mjs`
- `tests/physics2-advanced-r03.test.mjs`
- `tests/physics2-advanced-r04-versioning.test.mjs`
- `tests/physics2-advanced-r04.test.mjs`
- `tests/physics2-r11.test.mjs`
- `tests/physics2-r12.test.mjs`
- `tests/physics2-r13.test.mjs`
- `tests/physics2-r14.test.mjs`
- `tests/physics2-r15.test.mjs`
- `tests/run-tests.mjs`
- `tests/share-preview.test.mjs`

삭제파일0개. 전체 소스는 456개 파일입니다.
실제 변경파일 명세와 전후해시는 `PATCH_MANIFEST_3712.json`에 있습니다.

## 실행한 검사

기준 v3.7.10 npm test:396개 중395통과/1건너뜀/0실패.
최종 소스 npm test:439개 중438통과/1건너뜀/0실패.
건너뜀1개는 기존부터 별도 학생179명 Excel 원본이 필요한 테스트입니다.
총괄 정답표·채점·source조건·원본SHA·crop좌표·기존파일보호·교사정답수정 우선순위 등을 추가 검사했습니다.
변경된 총시험수·준비문항수·캐시버전의 기존 테스트 기대값을 갱신했으며, 승인된 총괄활성화와 보고서표시확장만 과거전체해시검사의 예외로 두고 새 검사로 보완했습니다.

오프라인 Chromium 실제 스크립트 검사:
- 교사 입력25칸, 서술형0~4점 입력5칸, 합계100점 저장.
- 기존 합성 학생의 r15 기록 완전 보존, 새 총괄에서도 StudentId 유지.
- 잘못된 보고서 fingerprint와 포털 소유권 요청 거절.
- 보고서 원문canvas25개 픽셀 일치, 원문해설 제출전 숨김.
- 원문25개 및 동형25개 정답 제출/해설 열기 모두 통과.
- 모바일390px 가로 넘침0, 원문해설이미지25개 디코드·표시 정상.
- 총괄 전용카드, EMW 제목, 소유권검증 뒤 개별성적표 정보 조회 정상.
- JavaScript 예외0건, 외부 요청0건.
- 실제 DOCX 생성, Word 내부 이미지5개와 ZIP구조 정상, LibreOffice 렌더8쪽 확인.

환경은 HTTP 네비게이션을 차단하여 실제 JavaScript를 오프라인 HTML에 삽입했습니다.
메모리 데모저장소·data URI이미지로더·테스트용 렌더진입훅을 사용했습니다.
이는 운영 서버 E2E가 아니며, 온라인 토큰·Sheets의 실제 데이터를 조회한 검사가 아닙니다.
생성 DOCX는 합성 검증용으로만 사용했고 운영 학생 자료가 아닙니다.

읽기전용 사전검사:정상 v3.7.10→PASS_BASE, 완성본→ALREADY_COMPLETE, v3.7.9와충돌app.js→STOP.
소스가 v3.7.5누락 상태이면 정상v3.7.10과 다르므로 STOP하게 되어 있습니다.

## 적용과 되돌리기

`README_3712_APPLY_ROLLBACK.md`의 순서대로 먼저 현재저장소 사전검사·운영Sheets백업을 수행합니다.
로그인된 교사페이지 재접속시 자동동기화가 가능하므로 백업은 정적배포 전에 필요합니다.
ZIP내용을 기존 폴더 경로에 맞게 적용하고 기존 정적배포 절차를 사용합니다. ZIP자체를 업로드하는 방식이 아닙니다.
서버시험 설정은 자동동기화의 결과를 확인하고 실패시에만 연결/충돌을 점검한 후 수동동기화합니다.

새 성적이 없다면 적용전 실제커밋으로 정적파일만 롤백합니다.
새 심화5회/총괄성적이 생겼다면 해당 시험정의·이미지를 유지하며 변경만 되돌립니다.
Students/Reports 삭제, 시트 과거사본 전체덮어쓰기, v3.7.5/v3.7.7 전체소스로의 다운그레이드는 금지합니다.
