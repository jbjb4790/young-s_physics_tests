# v3.4.4 업데이트 — 단답형·서술형 포함 전 문항 객관식 오답 재도전

- 학생이 틀리거나 부분점수를 받은 문항은 원문 문제·그림을 그대로 보고 4지 또는 5지 객관식 보기에서 답을 선택합니다.
- 기존 단답형·서술형도 수식·단위·문장을 직접 입력하지 않습니다.
- 새 동형 문제도 전부 객관식으로 제공하고, 답 제출 전에는 정답·해설을 숨깁니다.
- 제출 후 학생이 고른 보기와 정답 보기를 표시하고 검수 해설·공식·부분점수 기준을 공개합니다.
- 준비 완료 시험 9개, 108문항의 원문 재도전과 동형 문제에 각각 4지·5지 보기를 적용했습니다.
- `QuestionOverrides`에 남아 있는 구형 자유입력 설정은 v3.4.4 `Code.gs`가 유효한 객관식 설정만 병합하고, 불완전한 수정본은 검수 원본 보기로 자동 복귀합니다.

기존 운영본에서는 Spreadsheet를 백업한 뒤 `Code.gs`를 v3.4.4로 교체하고 웹 앱을 새 버전으로 재배포합니다. 이어 GitHub v3.4.4 패치를 덮어쓰되 기존 `.github/workflows/pages.yml`과 `site/assets/runtime-config.js`는 유지합니다. `installYoungsPhysics()`는 다시 실행하지 않습니다.

---

# v3.4.3 업데이트 — 총괄평가 상위 50% 백분율 표시

총괄평가 성적표 첫 화면에 동일 평가 집단 기준 `상위 N%`를 표시합니다. 상위 50% 이내인 학생에게만 표시되며, 동점자는 같은 경쟁 순위를 사용합니다. 이번 변경은 GitHub 정적 파일만 수정하므로 Apps Script `Code.gs` 교체·재배포와 시험 설정 서버 동기화가 필요하지 않습니다.

## 적용

1. 기존 GitHub 저장소를 백업합니다.
2. v3.4.3 GitHub 패치의 내부 파일을 저장소 최상위에 덮어씁니다.
3. 기존 `.github/workflows/pages.yml`과 `site/assets/runtime-config.js`는 유지합니다.
4. 커밋 후 GitHub Pages 배포가 끝나면 브라우저를 강력 새로고침합니다.

---

# v3.4.2 업데이트 — 심화 총괄 1~25번 전체 선택번호

- 일반 물리1·물리2 총괄: 1~20번 학생 선택번호 `1~5`, 21~25번 실제 획득 점수
- 물리1심화·물리2심화 총괄: 1~25번 모두 학생 선택번호 `1~5`
- 물리2심화 과정과 `physics2-advanced-total` 준비 항목 추가
- 입력 범위는 시험의 `InputProfileJSON.objectiveRange`로 제어되어 향후 문항 등록 시 자동 적용

기존 운영본에서는 Spreadsheet를 백업한 뒤 `Code.gs`를 v3.4.2로 교체하고 웹 앱을 새 버전으로 재배포합니다. GitHub에는 v3.4.2 패치를 덮어쓰되 기존 `.github/workflows/pages.yml`과 `site/assets/runtime-config.js`는 유지합니다. 이후 교사용 화면에서 **시험 설정 서버 동기화**를 한 번 실행합니다.

---

# v3.4.1 업데이트 — 총괄 객관식 선택번호·CSV 이름 열 자동 인식

물리1·물리2 총괄평가에서는 1~20번을 학생 선택번호 `1~5`로 입력합니다. 21~25번은 실제 서술형 점수를 입력합니다. CSV는 `이름`, `성명`, `학생명`, `학생 이름`, `학생 성명`, `Name` 등을 이름 열로 인식하며 UTF-8·CP949/EUC-KR·UTF-16과 쉼표·탭·세미콜론 구분자를 자동 감지합니다.

기존 0/1·O/X 자료는 구형 호환 모드로 불러오지만, 새 템플릿은 학생 선택번호를 사용합니다. 적용 후 교사용 화면에서 **시험 설정 서버 동기화**를 한 번 실행해야 Questions 시트의 총괄 입력 모드도 최신 상태가 됩니다.

# v3.4.0 기존 운영본 업데이트 안내

현재 v3.3.x 운영 시스템에 **정답 관리·보기 선택 기능**을 추가할 때는 아래 순서만 진행합니다.

1. Spreadsheet 백업
2. Apps Script `Code.gs`를 v3.4.0으로 전체 교체
3. `installYoungsPhysics()`, `resetTeacherPin()`, `repairReportStorage()`는 실행하지 않음
4. 기존 웹 앱을 새 버전으로 재배포
5. GitHub v3.4.0 패치를 덮어쓰되 `.github/workflows/pages.yml`과 `site/assets/runtime-config.js`는 기존 운영 파일 유지
6. GitHub Pages 재배포 후 강력 새로고침

최초 저장 시 `QuestionOverrides` 시트가 자동 생성됩니다. 정답 변경 후 기존 학생 점수는 자동 재채점되지 않으므로 Excel을 다시 저장하거나 학생 기록을 수정해야 합니다.

---

> **v3.3.0 교사 인증 연결 수정:** GitHub Pages를 Apps Script 보안 상위 페이지 안에서 실행하고, 서버 호출은 공식 `google.script.run`으로 처리합니다. PIN 입력 후 “Apps Script 서버에 연결하지 못했습니다”가 표시되면 `HOSTED_PARENT_BRIDGE_FIX_KO.md` 순서대로 Code.gs와 GitHub 패치를 함께 적용하세요. 기존 학생 기록·PIN·토큰은 유지됩니다.

# Young’s Physics 3.3.0 최종 설치·자동 연결·Excel 입력 안내

> **v3.2.5 자동 연결 수정:** 지속형 `google.script.run` iframe 대신 hidden form POST 응답 브리지를 사용합니다. `Apps Script GET 연결은 정상이나 통신 브리지를 열지 못했습니다` 오류가 발생하면 `FORM_POST_BRIDGE_FIX_KO.md` 순서대로 **Code.gs와 GitHub 파일을 함께** 교체하세요. 기존 학생 기록·PIN·토큰은 유지됩니다.


> **v3.2.4 성적표 토큰 수정:** 학생 링크에 생성 당시 Apps Script `/exec` 주소와 서버 식별자를 함께 넣고, Reports의 `Token` 열·A열·`RecordJSON`을 교차 조회합니다. 기존 기록은 `diagnoseReportStorage()`와 `repairReportStorage()`로 점검·복구할 수 있습니다. 적용 순서는 `REPORT_TOKEN_FIX_KO.md`를 확인하세요.


> **v3.2.3 연결 수정:** 교사 인증의 `Failed to fetch`를 방지하기 위해 Apps Script HtmlService 통신 브리지를 사용합니다. 적용 순서는 `PIN_FAILED_TO_FETCH_FIX_KO.md`를 확인하세요.


## 1. 3.3.0의 핵심 통신 구조

3.3.0은 기존 Excel 일괄 입력·학교 표기·다른 컴퓨터 자동 연결 기능을 유지하면서, 교사 인증 통신을 다음처럼 변경합니다.

```text
GitHub 저장소 변수 YP_API_URL
→ GitHub Pages를 열면 Apps Script /exec?view=host&site=... 보안 상위 페이지로 자동 전환
→ 기존 GitHub 디자인을 상위 페이지 안에서 그대로 표시
→ 상위 페이지가 google.script.run으로 Google Sheets 호출
→ 교사 PIN 또는 1회용 링크로 교사 세션 발급
→ Excel 첨부 또는 수동 입력
→ 같은 Google Sheets 학생 기록 자동 조회·저장
```

학교 입력 규칙은 다음과 같습니다.

```text
학교를 입력함       → 입력한 학교명 저장
학교가 빈칸         → 미기입
구버전 학교 미입력  → 미기입으로 호환·정리
```

문항의 미채점 상태는 기존처럼 `미입력`으로 표시됩니다. `미기입`은 학교가 제공되지 않았다는 뜻으로만 사용합니다.

---

## 2. 기존 운영본을 3.3.0으로 업데이트

이미 시스템을 운영 중이라면 다음 순서로 적용합니다.

1. Google Spreadsheet에서 `파일 → 사본 만들기`로 백업합니다.
2. Apps Script의 기존 `Code.gs`를 별도 보관합니다.
3. 3.3.0의 `apps-script/Code.gs`로 전체 교체하고 저장합니다.
4. **`installYoungsPhysics()`는 다시 실행하지 않습니다.** 기존 교사 PIN, 학생 기록, 성적표 토큰과 지문을 유지합니다.
5. `appsscript.json`은 기존 v3.2.x와 동일하므로 다시 변경할 필요가 없습니다.
6. Apps Script 웹 앱을 **새 버전**으로 다시 배포합니다.
7. `/exec?action=ping`에서 `3.3.0-hosted-parent-bridge`를 확인합니다.
8. GitHub 저장소에는 3.3.0 전체 파일 또는 패치를 덮어씁니다.
9. GitHub Pages Actions를 다시 실행합니다.
10. Pages 주소를 열면 Apps Script `/exec?view=host&site=...`로 자동 전환되는지 확인한 뒤 교사 PIN을 입력합니다.

새로운 빈 Spreadsheet에 처음 설치할 때만 아래 6절의 `installYoungsPhysics()`를 실행합니다.

---

## 3. GitHub Pages 오류를 먼저 해결해야 하는 경우

다음 오류는 Pages가 저장소에서 아직 활성화되지 않았다는 뜻입니다.

```text
HttpError: Not Found
Get Pages site failed
Please verify that the repository has Pages enabled and configured to build using GitHub Actions
```

저장소에서 다음을 한 번 설정합니다.

```text
Settings
→ Pages
→ Build and deployment
→ Source
→ GitHub Actions
```

그다음:

```text
Actions
→ Deploy Young's Physics to GitHub Pages
→ Re-run all jobs
```

Node.js 버전 경고는 이 404 오류의 직접 원인이 아닙니다. 제공된 workflow는 현재 프로젝트에 맞는 Pages Actions 버전을 사용합니다.

---

## 4. Google Spreadsheet 준비

1. Young’s Physics 전용 Google Spreadsheet를 엽니다.
2. 다른 시험 시스템의 Spreadsheet와 섞지 않습니다.
3. 기존 운영본이라면 먼저 사본을 만듭니다.
4. `확장 프로그램 → Apps Script`를 엽니다.

---

## 5. Apps Script 파일 적용

### Code.gs

1. 기존 `Code.gs`를 백업합니다.
2. 패키지의 `apps-script/Code.gs` 전체 내용을 복사합니다.
3. 편집기의 기존 내용을 모두 지우고 붙여넣습니다.
4. 저장합니다.

### appsscript.json

1. Apps Script 왼쪽 `프로젝트 설정`을 엽니다.
2. **편집기에 appsscript.json 매니페스트 파일 표시**를 켭니다.
3. 패키지의 `appsscript.json` 내용으로 교체합니다.
4. 저장합니다.

---

## 6. 설치 함수 실행

함수 목록에서 다음을 실행합니다.

```text
installYoungsPhysics
```

첫 실행에서는 Google 권한을 승인합니다. 실행 결과:

- `Courses`, `Exams`, `Questions`, `Reports` 시트 생성 또는 안전 마이그레이션
- `SPREADSHEET_ID` 자동 저장
- 학생 링크용 비밀키 자동 생성
- 교사 세션 서명 비밀키 자동 생성
- 10자리 무작위 교사 PIN 생성 또는 기존 PIN 유지
- 학교 빈칸·`미입력` 표기를 `미기입`으로 정리

Spreadsheet를 새로고침하면 상단 메뉴에 다음 항목이 나타납니다.

```text
Young's Physics
├─ ① 설치·시트 초기화
├─ 학교 미기입 표기 정리
├─ 교사 PIN 직접 변경
├─ 무작위 교사 PIN 재발급
├─ 모든 교사 기기 세션 해제
└─ 연결 상태 확인
```

학교 표기만 다시 정리할 때는 `학교 미기입 표기 정리` 메뉴를 사용할 수 있습니다.

---

## 7. Apps Script 웹 앱 배포

Apps Script 우측 상단에서:

```text
배포
→ 새 배포
→ 유형 선택: 웹 앱
```

설정:

```text
실행 사용자: 나
액세스 권한: 모든 사용자
```

배포 후 다음 형식의 주소를 복사합니다.

```text
https://script.google.com/macros/s/배포ID/exec
```

`/dev`가 아니라 `/exec` 주소를 사용합니다.

### 기존 배포 업데이트

`Code.gs`를 바꿨다면 저장만 해서는 운영 웹 앱에 반영되지 않습니다.

```text
배포
→ 배포 관리
→ 기존 웹 앱 편집
→ 버전: 새 버전
→ 배포
```

---

## 8. GitHub 저장소 변수 등록

저장소에서:

```text
Settings
→ Secrets and variables
→ Actions
→ Variables
→ New repository variable
```

다음 값을 만듭니다.

```text
Name:  YP_API_URL
Value: Apps Script의 /exec 주소
```

다음 값은 GitHub에 넣지 않습니다.

```text
교사 PIN
교사 세션 토큰
WRITE_KEY
FINGERPRINT_SECRET
SESSION_SECRET
학생 이름·학교·점수
```

---

## 9. GitHub 파일 업로드와 Pages 배포

GitHub용 ZIP을 압축 해제한 뒤 내부 파일을 저장소 최상위에 올립니다. ZIP 자체를 올리지 않습니다.

```text
저장소 root
├─ .github/workflows/pages.yml
├─ site/
├─ apps-script/
├─ tests/
├─ sample-data/
├─ README.md
├─ INSTALL_KO.md
├─ package.json
└─ .gitignore
```

그다음:

1. `Settings → Pages → Source → GitHub Actions`를 선택합니다.
2. `main` 브랜치에 파일을 커밋합니다.
3. `Actions → Deploy Young's Physics to GitHub Pages`를 엽니다.
4. 모든 단계가 초록색인지 확인합니다.
5. `Settings → Pages → Visit site`로 접속합니다.

---

## 10. 첫 교사용 컴퓨터 연결

Pages 사이트를 엽니다.

1. 우측 상단 `교사 인증`을 누릅니다.
2. 설치 시 생성된 교사 PIN을 입력합니다.
3. `이 컴퓨터를 교사용으로 연결`을 누릅니다.
4. 시험 설정과 기존 학생 기록이 자동으로 표시되는지 확인합니다.
5. 필요하면 `시험 설정 서버 동기화`를 실행합니다.

정상 동기화 기준:

```text
과정 4개
시험 40개
등록 문항 108개
```

---

## 11. 다른 컴퓨터에서 바로 입력

### 방법 A — 교사 PIN 최초 1회 입력

새 컴퓨터에서 같은 Pages 주소를 열고 교사 PIN을 입력합니다. 이후 해당 브라우저에서는 바로 성적을 입력할 수 있습니다.

### 방법 B — PIN 입력 없이 연결

이미 연결된 컴퓨터에서:

```text
우측 상단 교사 연결됨
→ 새 컴퓨터 연결 링크 복사
```

복사한 링크를 10분 안에 새 컴퓨터에서 한 번 엽니다. 링크는 한 번 사용 후 폐기됩니다.

---

## 12. 학교 미기입 처리

### 수동 입력

학교 칸을 비운 상태로 저장하면 다음처럼 기록됩니다.

```text
School = 미기입
```

교사용 학생 목록, 학부모 리포트, Word DOCX에서도 모두 `미기입`으로 표시됩니다.

### 기존 기록

구버전에서 학교가 빈칸이거나 `미입력`으로 저장된 기록은 3.2에서 같은 학생으로 취급합니다. `installYoungsPhysics()` 또는 Spreadsheet 메뉴의 `학교 미기입 표기 정리`를 실행하면 실제 Sheet 값도 `미기입`으로 통일됩니다.

---

## 13. 첨부 Excel로 물리1 역학 총괄평가 입력

### 13.1 시험 선택

교사용 사이트에서 먼저 다음을 선택합니다.

```text
과정: 물리1
시험: 역학 총괄평가
```

시험을 잘못 선택한 상태에서 파일을 첨부하면 객관식 정답표 불일치가 감지되어 가져오기가 중단될 수 있습니다.

### 13.2 파일 첨부

`Excel·CSV 일괄 입력` 영역에서:

```text
Excel(.xlsx) 또는 CSV 파일 첨부
```

을 눌러 `역학진단고사 v3.xlsx`를 선택하거나 파일을 영역에 끌어놓습니다.

### 13.3 자동 해석 내용

첨부 형식에서는 다음 항목을 자동으로 찾습니다.

- `1회` 시트
- 학생 이름
- 학년과 반
- 문제번호 1~25
- 객관식 1~20번 학생 선택 번호
- 서술형 21~25번 실제 점수
- 원본 총점

`학원` 열은 학교로 사용하지 않습니다. 별도 학교 열이 없으므로 학교는 모두 `미기입`으로 저장됩니다.

객관식 1~20번은 Excel·CSV의 학생 선택번호 1~5를 그대로 저장하고 사이트의 **검수 정답표**와 비교해 채점합니다.

```text
선택 번호가 검수 정답과 같음 → 1
선택 번호가 검수 정답과 다름 → 0
```

서술형 21~25번은 Excel의 실제 점수 0~4를 그대로 사용합니다.

### 13.4 저장 전 미리보기

파일을 읽으면 다음 항목을 표시합니다.

- 첨부 파일명과 읽은 시트
- 읽은 학생 수
- 학교 미기입 인원
- 객관식 해석 방식
- 학생별 재계산 점수
- Excel 원본 총점
- 점수 일치 여부
- 신규 저장 또는 기존 기록 수정 여부
- 오류가 있는 원본 행

오류가 없는 학생만 저장 대상이 됩니다.

### 13.5 일괄 저장

```text
검증된 학생 기록 일괄 저장
```

버튼을 누르면 정규화된 학생 기록만 Apps Script로 전송됩니다.

```text
교사 세션 검증
→ Reports 시트 1회 조회
→ 동일 학생 upsert
→ 토큰·학부모 링크 유지
→ 한 번의 Sheet 쓰기로 일괄 저장
→ 시험 평균·문항 통계 재계산
```

첨부 검증 파일에서는 다음 결과를 확인했습니다.

```text
읽은 학생: 179명
학교 미기입: 179명
원본 학생 행: 5~201행
사이트 재계산과 원본 총점 불일치: 0건
공식·계산용 중복 행 제외: 정상
```

### 13.6 같은 Excel을 다시 첨부할 때

같은 시험·학교·이름의 기록은 새 학생으로 추가하지 않고 기존 기록을 수정합니다.

```text
Token 유지
Fingerprint 유지
학부모 결과 링크 유지
점수와 UpdatedAt 갱신
```

---

## 14. Excel 지원 형식과 제한

지원:

- `.xlsx`
- 문항 번호가 연속된 `1~n` 구조
- `Q1~Qn` 헤더 구조
- 객관식 선택 번호 1~5
- 학생 선택번호 1~5, 구형 O/X 또는 0/1 정오표
- 서술형 실제 점수
- CSV Q1~Qn 구조

제한:

- 구형 `.xls`는 `.xlsx`로 다시 저장해야 합니다.
- 암호화 또는 비밀번호가 걸린 Excel은 읽을 수 없습니다.
- 인터넷 브라우저가 `DecompressionStream`을 지원해야 합니다. 최신 Chrome 또는 Edge 사용을 권장합니다.
- 실제 학생 Excel 파일은 GitHub 저장소에 올리지 않습니다.

Excel 원본 파일은 브라우저에서만 읽고, 파일 자체는 GitHub나 Apps Script에 업로드하지 않습니다. 저장 버튼을 누르면 학생 이름·학교 표기·문항별 결과 등 정규화된 기록만 Apps Script로 전송됩니다.

---

## 15. 수동 입력 규칙

### 주간 복습

```text
0             틀림·0점
1             해당 문항 만점
그 밖의 숫자  실제 부분점수
P1            정확히 1점 부분점수
빈칸          미채점·미입력
```

### 일반 물리1·물리2 총괄평가

```text
1~20번 객관식  학생이 고른 선택 번호 1~5
21~25번 서술형 실제 획득 점수 0~문항 배점
```

### 물리1심화·물리2심화 총괄평가

```text
1~25번 객관식  학생이 고른 선택 번호 1~5
```

객관식은 입력한 선택 번호를 현재 검수 정답표와 비교해 자동으로 문항 만점 또는 0점으로 채점합니다. 기존 0/1·O/X 파일은 구형 호환 모드로만 불러옵니다. 일반 총괄의 서술형 `1`은 실제 1점이지만, 심화 총괄의 `1`은 ①번 선택을 뜻합니다.

---

## 16. 자동 동기화

컴퓨터 A에서 학생을 저장하면 Google Sheets의 `Reports`에 기록됩니다. 컴퓨터 B에서는 다음 시점에 최신 기록을 다시 불러옵니다.

- 사이트 접속
- 새로고침
- 다른 탭에서 돌아옴
- 브라우저 창 포커스 복귀
- 네트워크 재연결

수동 `서버 기록 새로고침` 버튼도 사용할 수 있습니다.

---

## 17. 자주 발생하는 오류

### `Get Pages site failed: Not Found`

```text
Settings → Pages → Source → GitHub Actions
```

설정 후 workflow를 다시 실행합니다.

### `YP_API_URL 미설정`

Actions Variables에 `YP_API_URL`과 `/exec` 주소를 등록하고 다시 배포합니다.

### 사이트가 데모 모드로 열림

- Pages가 새 workflow로 배포되었는지 확인
- `YP_API_URL`이 `/exec`로 끝나는지 확인
- 브라우저 강력 새로고침

### Excel 파일을 읽지 못함

- 확장자가 `.xlsx`인지 확인
- 비밀번호를 제거
- 최신 Chrome 또는 Edge에서 다시 시도
- 파일에서 학생 이름과 문제번호 1~25가 있는 원본 입력 시트를 유지

### 선택한 시험과 정답표 불일치

현재 선택한 시험이 Excel 파일과 같은 시험인지 확인합니다. 물리1 역학 파일은 반드시 `물리1 → 역학 총괄평가`에서 가져옵니다.

### 일부 학생만 저장 가능

미리보기에서 오류 행을 확인합니다. 이름 누락, 객관식 해석 불가, 서술형 배점 초과 등이 있으면 해당 행은 저장 대상에서 제외됩니다.

### 학생 기록이 컴퓨터마다 다르게 보임

상단이 `교사 연결됨`인지 확인하고 `서버 기록 새로고침`을 누릅니다. 데모 모드 기록은 브라우저 로컬 데이터입니다.

---

## 18. 최종 확인표

- [ ] Google Spreadsheet 백업
- [ ] 3.3.0 `Code.gs` 적용
- [ ] 기존 운영본이면 `installYoungsPhysics()`를 다시 실행하지 않음
- [ ] 신규 설치인 경우에만 `appsscript.json` 적용 및 `installYoungsPhysics()` 실행
- [ ] Apps Script 웹 앱 새 버전 배포
- [ ] `/exec?action=ping`에서 `3.3.0-hosted-parent-bridge` 확인
- [ ] GitHub Variable `YP_API_URL` 등록·확인
- [ ] GitHub Pages Source를 `GitHub Actions`로 설정
- [ ] GitHub 3.3.0 파일 배포 성공
- [ ] Pages 접속 시 `/exec?view=host&site=...` 주소로 자동 전환
- [ ] 첫 컴퓨터 교사 PIN 연결 성공
- [ ] 시험 설정 동기화: 3과정·39시험·108문항
- [ ] 학교 공란 학생 1명 수동 저장 후 `미기입` 표시 확인
- [ ] 물리1 역학 총괄평가 선택
- [ ] Excel 첨부 후 학생 179명 미리보기 확인
- [ ] 재계산 점수와 원본 총점 불일치 0건 확인
- [ ] 검증된 학생 일괄 저장
- [ ] 다른 컴퓨터에서 같은 학생 기록 조회
- [ ] 학부모 링크와 Word에서 학교 `미기입` 표시 확인
