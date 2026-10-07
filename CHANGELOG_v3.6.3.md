# Young’s Physics v3.6.3 변경 내역

## 학생 통합 포털
- `총괄평가` 탭 상단에 누적 데이터 기반 학습 코멘트 카드 추가
- 누적 주간 복습 수, 총괄평가 수, 최근 성취 흐름, 강점·보완 단원을 문장으로 요약
- 총괄평가 상세 화면에도 해당 시험과 연결 복습 기록을 반영한 학생별 코멘트 추가

## 개별 총괄 성적표
- 기존 단순 점수 코멘트를 누적 학습 기반 코멘트로 확장
- 동일 평가 평균 대비 차이, 상위 N%, 연결 복습 흐름, 반복 강점/보완 단원, 개선 단원, 우선 오답 문항을 반영
- 코멘트 하단에 분석 근거(연결 복습 회차, 동일 평가 인원 등) 표시

## Word(.docx)
- 총괄평가 Word 성적표에 동일한 `누적 데이터 기반 총괄평가 코멘트` 포함

## 개인정보·표시 정책
- 누적 가중 성취율 숫자는 표시하지 않음
- 코멘트는 이미 학생 링크에서 확인 가능한 성적·단원 데이터를 바탕으로 브라우저에서 자동 생성
- 별도 외부 AI API로 학생 데이터를 전송하지 않음

## 변경 파일
- `site/assets/core.js`
- `site/assets/portal.js`
- `site/assets/report.js`
- `site/assets/styles.css`
- `site/assets/vendor/docx-export.bundle.js`
- `site/index.html`
- `site/report.html`
- `site/portal.html`
- `site/guide.html`
- `README.md`
- `package.json`
- `tests/run-tests.mjs`
