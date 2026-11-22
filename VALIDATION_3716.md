# Young's Physics v3.7.16 검증 결과

2026-11-21. 일반 물리2 3회차 `physics2-basic-r03` 추가. 실제 기준 v3.7.15 전체소스에서 작업했고 원격 운영 서비스에는 접근하거나 배포하지 않았습니다.

## 결과

기준 v3.7.15는 505검사 중 504통과·1건너뜀·0실패입니다. v3.7.16은 519검사 중 518통과·1건너뜀·0실패입니다. 건너뛴 1개는 기존 179명 학생 Excel 원본이 첨부되지 않은 검사입니다. 이번 원본PDF·문항·이미지 검사는 전부 수행했습니다.

전체 시험 47개 중 3회차의 기존 대기 항목 1개만 활성화했습니다. 준비 시험 32개, 준비 문항326개입니다. r03는 8문항100점, 원문재도전8개·새 동형8개입니다. 문항은행과 catalog.js/json은 일치합니다.

## 보존 및 범위

v3.7.15 기준 기존 파일 25개 수정, 새 파일 19개 추가, 삭제0개, 전체 516개입니다. 실행 동작에 영향을 주는 변경은 카탈로그, 신규 자료, HTML 3개의 카탈로그 캐시값입니다. 기존 core/app/report/portal/API/링크/서버 코드와 CSS는 그대로입니다. 기존 검사들의 고정 버전·시험수 기대값도 새 버전에 맞췄습니다.

나머지 기존 시험46개의 객체, 기존 문항JSON31개, 학생 링크·인증·서버·운영설정20개 파일의 SHA-256 불변을 검증했습니다. 물리1 16회·물리2심화4회 신구 분리, 물리2심화6회 최종본, 일반 물리2 2회, 학부모 총괄평가 버튼, 학생 검색·반 배정·학교명 수정이 보존됩니다.

실제 학생 DB를 읽거나 쓴 것이 아닙니다. 가상 기록을 이용한 점수 계산·정규화·누적 분석에서 StudentId/token/fingerprint가 보존됨을 확인했습니다. 신규 만점100점, P1=1점, 부분점수, 미채점, 범위초과 거절을 확인했습니다.

## 원본과 내용 검수

첨부 문제지·해설지 각2쪽을 바이트 그대로 보존했습니다. 원본 문제지2쪽은200dpi PNG이며 8문항 crop을 모두 시각검수했습니다. PNG 실제 RGB 픽셀을 해독하여 모든 crop과 기록한 해시의 일치를 검증했습니다. 5·7번은 공통 지문과 해당 문항 원본을 그대로 복사하고 16px 흰 여백만 추가한 합성입니다. 각 부분을 원본 페이지와 픽셀 단위로 비교했습니다.

원문재도전8개·동형8개의 키와 유일 정답을 독립 검산했습니다. 2번은 문제의4:1을 적용한3h/5, 8번은 높은A의 체공시간이 더 김, 여각의 동일초속력 조건, 공기저항 사거리 비교의 조건부족을 반영했습니다. 8번배점7/7/6은 문제지를 따릅니다. 원본해설PDF는 수정하지 않았습니다.

별도 검수해설PDF3쪽은 모든 페이지를 렌더링하여 한글·수식·배점·정정 박스·넘침을 시각 확인했습니다.

## 화면 코드 검증 및 한계

실제 core/report/portal/app JS를 가상 DOM과 가상학생으로 실행했습니다. 성적표와 통합포털 각각8문항100점·원문canvas8개 생성, 제출전 해설숨김, 무응답제출 방지, 정오판정, 해설공개, 동형활성화·채점, 다시풀기 초기화를 확인했습니다. 교사 화면의 r03 선택과8입력칸·배점·실제 입력 이벤트의 점수계산도 확인했습니다. 결과는 docs/validation/physics2-basic-r03-dom-flows.json에 있습니다.

실제 Chromium은 환경의 socket() Operation not permitted 오류로 시작하지 못했습니다. 따라서 실제 브라우저 CSS 렌더링,390px 모바일 레이아웃과 스크린샷,운영API E2E는 수행하지 않았습니다. 이 한계를 가상DOM 검증이나 원본이미지 픽셀검증과 혼동하지 않습니다.

## 패키징

v3.7.15 증분과 v3.7.13 누적 패치를 각각의 기준 전체소스에 적용한 결과, 최종 전체소스와 516개 모든 파일의 SHA-256이 일치했습니다. 원본 두 PDF가 각 ZIP에도 바이트 그대로 포함됨을 확인했습니다. 전체 ZIP CRC검사와 사전검사의 PASS_BASE/ALREADY_COMPLETE/다른기준STOP을 모두 통과했습니다. 증분 ZIP을 독립 재현한 소스에서도 최종 회귀519개 중518통과·1건너뜀·0실패를 확인했습니다. 최종 ZIP바이트수·SHA는 전달 기록에서 별도로 관리합니다.

## 변경 파일

- CHECK_3716_FROM_3713.py
- CHECK_3716_FROM_3715.py
- PATCH_MANIFEST_3716.json
- README_3716_apply_rollback.md
- README_LATEST.md
- VALIDATION_3716.md
- docs/physics2-basic-r03-review.md
- docs/validation/physics2-basic-r03-dom-flows.json
- docs/validation/physics2-basic-r03-original-assets.json
- docs/validation/physics2-basic-r03-original-preview.png
- package.json
- site/assets/data/catalog.js
- site/assets/data/catalog.json
- site/assets/data/questions/physics2-basic-r03.json
- site/assets/documents/physics2/r03-original-solution.pdf
- site/assets/documents/physics2/r03-original.pdf
- site/assets/documents/physics2/r03-reviewed-solution.pdf
- site/assets/pages/physics2/r03-original-p1.png
- site/assets/pages/physics2/r03-original-p2.png
- site/assets/pages/physics2/r03-q05-original-composite.png
- site/assets/pages/physics2/r03-q07-original-composite.png
- site/index.html
- site/portal.html
- site/report.html
- tests/conditional-explanations.test.mjs
- tests/fixtures/r03-basic-baseline-v3715.json
- tests/physics1-r06-q04-revision.test.mjs
- tests/physics1-r16-versioning.test.mjs
- tests/physics2-advanced-r02.test.mjs
- tests/physics2-advanced-r03.test.mjs
- tests/physics2-advanced-r04-versioning.test.mjs
- tests/physics2-advanced-r04.test.mjs
- tests/physics2-advanced-r05.test.mjs
- tests/physics2-advanced-r06.test.mjs
- tests/physics2-basic-r02.test.mjs
- tests/physics2-basic-r03.test.mjs
- tests/physics2-emw-total.test.mjs
- tests/physics2-r11.test.mjs
- tests/physics2-r12.test.mjs
- tests/physics2-r13.test.mjs
- tests/physics2-r14.test.mjs
- tests/physics2-r15.test.mjs
- tests/roster-search-school.test.mjs
- tests/run-tests.mjs
