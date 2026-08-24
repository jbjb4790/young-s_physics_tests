# Young’s Physics v3.4.2 변경 내역

## 기능 변경

- 물리1심화 총괄평가 1~25번 전체를 학생 선택번호 `1~5` 입력 방식으로 변경
- 물리2심화 과정과 총괄평가 준비 항목 추가
- 물리2심화 총괄평가 1~25번 전체를 학생 선택번호 `1~5` 입력 방식으로 설정
- 일반 물리1·물리2 총괄은 기존 규칙 유지: 1~20번 선택번호, 21~25번 실제 점수
- 심화 총괄에서 `1`은 ①번 선택이며 1점 또는 정답 표시가 아님
- 선택번호 범위를 `InputProfileJSON.objectiveRange`에서 읽도록 공통화
- Excel·CSV의 정답표 검사 범위를 q1~25 전체로 확장
- 정적 카탈로그에 문항이 없는 준비 중 시험의 기존 Google Sheets `Questions` 행을 동기화 시 보존

## 카탈로그 변경

- 과정 수: 3개 → 4개
- 시험 수: 39개 → 40개
- 추가 과정 ID: `physics2-advanced`
- 추가 시험 ID: `physics2-advanced-total`
- 현재 준비 완료 문항 수: 108개 유지

## 변경 파일

```text
site/index.html
site/report.html
site/guide.html
site/assets/core.js
site/assets/app.js
site/assets/xlsx-import.js
site/assets/data/catalog.json
site/assets/data/catalog.js
apps-script/Code.gs
apps-script/README.md
sample-data/Excel_자동가져오기_형식안내.md
sample-data/물리1심화_총괄_학생선택번호_입력예시.csv
sample-data/물리2심화_총괄_학생선택번호_입력예시.csv
tests/run-tests.mjs
README.md
INSTALL_KO.md
package.json
```

## 의도적으로 변경하지 않은 파일

```text
.github/workflows/pages.yml
site/assets/runtime-config.js
apps-script/appsscript.json
```

기존 GitHub Pages 배포 설정, Apps Script `/exec` 주소, OAuth 권한은 유지됩니다.

## 데이터 관련 주의

물리1심화·물리2심화 총괄 문제지와 정답 자료가 제공되지 않았으므로 공식 정답번호나 문항 배점은 생성하지 않았습니다. 자료 등록 전까지 두 시험은 `준비 중`입니다.
