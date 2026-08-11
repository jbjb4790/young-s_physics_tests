# Young’s Physics 복습·총괄 통합 성적 분석 시스템 설치·운영 안내


## 0. 로고·테마 디자인만 기존 통합판에 적용하는 경우

기존 **총괄평가 통합판 2.0**이 이미 정상 운영 중이고 이번에 제공된 Young’s Physics 로고와 새 화면 디자인만 반영하려면, 리브랜딩 패치 ZIP의 웹 파일을 저장소에 덮어쓴 뒤 GitHub Pages만 다시 배포합니다.

```text
적용 대상: site/index.html, site/report.html, site/guide.html,
          site/assets/styles.css, app.js, core.js, report.js,
          site/assets/vendor/docx-export.bundle.js,
          site/assets/images/* 및 보정된 총괄 문제 crop 데이터
```

이번 디자인 패치는 다음 서버 항목을 변경하지 않습니다.

- `apps-script/Code.gs`
- Google Sheets의 Courses, Exams, Questions, Reports 열 구조
- `SPREADSHEET_ID`, `WRITE_KEY`, `FINGERPRINT_SECRET`
- 기존 학생 토큰과 지문
- 저장 API와 총괄·복습 연결 정책

따라서 **디자인만 적용할 때는 Apps Script 새 버전 재배포와 시험 설정 서버 동기화가 필요하지 않습니다.** 배포 후 교사용 화면, 학생 링크, Word 출력만 확인합니다. 전체 프로젝트를 신규 설치하거나 기존 주간 복습판에서 총괄평가 통합판으로 처음 올리는 경우에는 아래 1절부터 모든 절차를 진행합니다.

## 1. 설치 전 백업

기존 주간 복습 시스템을 운영 중이라면 먼저 Google Spreadsheet 전체 사본과 Apps Script 현재 버전을 백업합니다. 이번 패치는 기존 학생 기록을 유지하도록 헤더 이름 기반 마이그레이션을 포함하지만, 실데이터 변경 전 백업은 필수입니다.

## 2. 이번 버전의 입력 구조

### 총괄평가

- 학생 이름: 필수
- 학교: 필수. 기존 복습 기록 연결키에 사용
- 객관식 1~20번: `0` 틀림, `1` 맞음
- 서술형 21~25번: 실제 점수 `0~4`
- 총점: 100점

총괄 서술형에서 `1`은 실제 1점입니다. `P1`은 총괄 서술형에서 사용하지 않습니다.

### 기존 주간 복습

기존 규칙을 유지합니다.

- `0`: 0점
- `1`: 해당 문항 만점
- 그 밖의 숫자: 실제 부분점수
- `P1`: 정확히 1점 부분점수
- 빈칸: 미채점

## 3. Google Sheets와 Apps Script 업데이트

1. 기존 Google Spreadsheet를 엽니다.
2. 확장 프로그램 → Apps Script를 엽니다.
3. 기존 `Code.gs`를 백업한 뒤 패키지의 `apps-script/Code.gs` 전체로 교체합니다.
4. 프로젝트 설정 → 스크립트 속성에서 다음 값을 확인합니다.

```text
SPREADSHEET_ID       현재 시스템 전용 Spreadsheet ID
WRITE_KEY            충분히 긴 교사용 비밀 문자열
FINGERPRINT_SECRET   WRITE_KEY와 다른 충분히 긴 비밀 문자열 권장
```

5. Apps Script 편집기에서 `connectThisSpreadsheet()`를 실행하고 권한을 승인합니다.
6. Courses, Exams, Questions, Reports 시트의 새 스키마가 적용됐는지 확인합니다.

### 기존 시트 마이그레이션 동작

새 Code.gs는 기존 열 위치에 새 헤더를 덮어쓰지 않습니다. 각 시트의 기존 헤더 이름을 읽고 다음 새 헤더 순서로 전체 데이터를 재배치합니다.

- Exams: 총괄평가 유형, 파트, 입력 프로필, 연결 회차 등의 열 추가
- Questions: `InputMode`, `OriginalRetryJSON` 추가
- Reports: `StudentKey` 추가

기존 Reports의 StudentKey가 비어 있어도 시스템은 과정·학교·이름으로 즉시 계산해 연결합니다. WRITE_KEY와 FINGERPRINT_SECRET을 설정한 뒤 `repairIntegrity` API를 실행하면 저장된 행의 지문·식별 다이제스트·StudentKey를 일괄 갱신할 수 있습니다.

## 4. Apps Script 웹 앱 재배포

Code.gs가 바뀌었으므로 기존 배포의 코드가 자동으로 갱신되지 않습니다.

1. 배포 → 배포 관리
2. 기존 웹 앱 배포의 연필 아이콘
3. 버전 → 새 버전
4. 실행 사용자 → 나
5. 액세스 권한 → 모든 사용자
6. 배포
7. 기존 `/exec` URL이 유지되는지 확인

권한 정책상 새 URL이 생성되면 교사용 화면의 서버 설정 URL도 교체합니다.

## 5. GitHub Pages 업데이트

전체 프로젝트 ZIP을 새 저장소에 올리거나 패치 ZIP의 파일을 기존 저장소에 덮어씁니다.

필수 변경 범위:

```text
site/index.html
site/report.html
site/guide.html
site/assets/core.js
site/assets/api.js
site/assets/app.js
site/assets/report.js
site/assets/styles.css
site/assets/vendor/docx-export.bundle.js
site/assets/data/catalog.js
site/assets/data/catalog.json
site/assets/data/questions/physics1-basic-total-*.json
site/assets/documents/assessments/
site/assets/pages/assessments/
apps-script/Code.gs
tests/run-tests.mjs
```

GitHub 저장소에는 실제 학생 데이터, WRITE_KEY, FINGERPRINT_SECRET을 올리지 않습니다.

## 6. 시험 설정 서버 동기화

1. GitHub Pages 교사용 화면을 엽니다.
2. 서버 설정을 누릅니다.
3. Apps Script `/exec` URL과 WRITE_KEY를 입력합니다.
4. 연결 확인을 누릅니다.
5. `시험 설정 서버 동기화`를 한 번 실행합니다.
6. 완료 숫자가 과정 3, 시험 39, 문항 108인지 확인합니다.

문항 108개는 기존 물리1 2~8회 58개와 물리1 총괄 50개입니다. 아직 자료가 없는 회차·총괄평가는 준비 중 메타데이터만 저장됩니다.

## 7. 총괄평가 학생 저장

1. 과정과 총괄평가를 선택합니다.
2. 학생 이름과 학교를 입력합니다.
3. 1~20번은 O/X 버튼 또는 0/1을 입력합니다.
4. 21~25번은 0~4점 실제 서술형 점수를 입력합니다.
5. 상단 점수와 미입력 문항을 확인합니다.
6. `저장·성적 분석·링크 복사`를 누릅니다.

한 번의 클릭으로 다음이 순서대로 처리됩니다.

```text
입력 검증
→ Google Sheets 저장
→ 같은 총괄평가 평균 재계산
→ 지정된 복습 회차의 동일 학생 기록 검색
→ 학생 통합 리포트 생성
→ 무작위 토큰·지문 링크 생성
→ 클립보드 복사
```

## 8. 학생 연결 정책

총괄 리포트는 다음이 모두 같은 복습 기록만 연결합니다.

```text
courseId
정규화한 학교
정규화한 학생 이름
총괄평가에 지정된 historyExamIds
```

공백, 괄호, 하이픈, 밑줄, 영문 대소문자는 정규화합니다. 다른 학교, 다른 과정, 다른 이름, 연결 범위 밖 회차는 제외합니다.

동명이인이고 학교도 같은 경우에는 이름만으로 구분할 수 없으므로 기존 시스템의 `이름2`, `이름3` 규칙을 같은 학생에 일관되게 사용해야 합니다.

## 9. 학부모용 통합 리포트

링크에는 다음이 표시됩니다.

- 총괄 점수와 같은 총괄 응시자 평균
- 연결된 복습 테스트 회차 수와 누적 성취율
- 복습 회차별 성취율 흐름
- 복습 누적 단원별 강점·보완
- 총괄평가 단원별 강점·보완
- 문항별 학생 점수와 전체 평균
- 오답·부분점수 원문 문제
- 원문 답 제출 후 공개되는 검수 해설·공식·실수·루브릭
- 원문 제출 후 활성화되는 새 동형 문제
- 동형 답 제출 후 공개되는 정답·해설
- Word, PDF, 인쇄, 학부모 링크 복사

## 10. Word와 PDF

Word 버튼은 HTML에 `.doc` 확장자만 붙이지 않고 실제 OOXML `.docx`를 생성합니다. 로고, 점수 그래프, 복습 흐름 그래프, 문제 이미지는 `word/media/`에 포함되어 다른 컴퓨터에서도 보입니다.

PDF는 브라우저 인쇄 기능을 사용합니다. 인쇄 대화상자에서 A4, 배경 그래픽 사용, 머리글·바닥글 해제를 권장합니다.

## 11. 자료가 없는 총괄 추가

물리2 역학, 물리2 전자기·파동, 물리1심화 총괄은 연결 범위만 등록되어 있습니다. 시험지와 해설지를 추가할 때는 다음 순서로 작업합니다.

1. 문항·정답·해설 검수
2. 객관식 단일 정답 확인
3. 서술형 4점 루브릭 작성
4. 문제 페이지 이미지 및 crop 등록
5. 검증된 해설·공식·자주 하는 실수 작성
6. 원문 재도전과 동형 문제 작성
7. `status: ready`로 전환
8. Apps Script 카탈로그 재동기화

## 12. 배포 후 점검

- 교사용 페이지가 빈 화면 없이 열리는가
- 총괄 O/X와 서술형 점수가 올바르게 계산되는가
- 총괄에서 학교 미입력이 차단되는가
- 저장 버튼 한 번으로 링크가 복사되는가
- 같은 학생의 복습 2~8회가 역학 총괄에만 연결되는가
- 다른 학교의 동명이인이 섞이지 않는가
- 원문 제출 전 정답과 해설이 숨겨지는가
- 동형 문제 제출 전 정답이 숨겨지는가
- 잘못된 지문으로 링크 접근이 차단되는가
- Word 안에 외부 이미지 연결이 없는가

## 13. 오류 대응

### 서버에 연결하지 못했습니다

- URL 끝이 `/exec`인지 확인
- 웹 앱 액세스가 모든 사용자로 되어 있는지 확인
- 새 Code.gs 배포 후 새 버전을 만들었는지 확인

### 총괄에 복습 기록이 연결되지 않습니다

- 과정, 학교, 학생 이름이 같은지 확인
- 복습 기록의 회차가 연결 범위 안인지 확인
- 기존 학교가 `미입력`이면 실제 학교로 수정한 뒤 다시 저장
- 같은 학교 동명이인은 이름 뒤 번호가 일관적인지 확인

### 기존 시트 열이 이상합니다

즉시 쓰기를 중단하고 백업 사본과 비교합니다. 원본 1행 헤더를 임의로 편집했다면 자동 마이그레이션이 인식하지 못할 수 있습니다. 새 템플릿 Sheet에 데이터를 헤더 이름 기준으로 옮기는 것이 안전합니다.
