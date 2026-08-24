> **v3.4.0 정답 관리·보기 선택 업데이트:** 교사용 홈페이지에서 선택한 시험의 객관식 정답 번호, 서술형 모범답안, 원문 재도전 보기와 동형 문제 보기를 수정해 Google Sheets의 `QuestionOverrides` 시트에 저장할 수 있습니다. 준비 완료된 108문항의 원문 재도전과 동형 문제는 모두 보기 선택 방식이며, 기존에 문자열 입력 대상이던 서술형·단답형 65문항과 답안번호가 별도 등록되지 않은 복합 선택형 3문항도 정확한 문자열을 입력할 필요가 없습니다. 기존 배포의 `.github/workflows/pages.yml`과 `site/assets/runtime-config.js`는 유지한 채 v3.4.0 패치를 적용하세요.

> **v3.3.0 교사 인증 연결 수정:** GitHub Pages를 Apps Script 보안 상위 페이지 안에서 실행하고, 서버 호출은 공식 `google.script.run`으로 처리합니다. PIN 입력 후 “Apps Script 서버에 연결하지 못했습니다”가 표시되면 `HOSTED_PARENT_BRIDGE_FIX_KO.md` 순서대로 Code.gs와 GitHub 패치를 함께 적용하세요. 기존 학생 기록·PIN·토큰은 유지됩니다.

# Young’s Physics 성적 분석 시스템 3.4.0

> **v3.2.5 자동 연결 수정:** 지속형 `google.script.run` iframe 대신 hidden form POST 응답 브리지를 사용합니다. `Apps Script GET 연결은 정상이나 통신 브리지를 열지 못했습니다` 오류가 발생하면 `FORM_POST_BRIDGE_FIX_KO.md` 순서대로 **Code.gs와 GitHub 파일을 함께** 교체하세요. 기존 학생 기록·PIN·토큰은 유지됩니다.


> **v3.2.4 성적표 토큰 수정:** 학생 링크에 생성 당시 Apps Script `/exec` 주소와 서버 식별자를 함께 넣고, Reports의 `Token` 열·A열·`RecordJSON`을 교차 조회합니다. 기존 기록은 `diagnoseReportStorage()`와 `repairReportStorage()`로 점검·복구할 수 있습니다. 적용 순서는 `REPORT_TOKEN_FIX_KO.md`를 확인하세요.


> **v3.2.3 연결 수정:** 교사 인증의 `Failed to fetch`를 방지하기 위해 Apps Script HtmlService 통신 브리지를 사용합니다. 적용 순서는 `PIN_FAILED_TO_FETCH_FIX_KO.md`를 확인하세요.


GitHub Pages와 Google Sheets + Apps Script로 운영하는 **주간 복습·총괄평가 통합 성적 분석 시스템**입니다.

## v3.4.0 정답 관리와 선택형 오답 재도전

- 상단 메뉴의 **정답 관리**에서 시험별 공식 정답과 모범답안을 수정
- 객관식 1~5번 정답 번호, 원문 재도전 보기, 동형 문제 보기를 한 화면에서 편집
- 저장값은 `QuestionOverrides` 시트에 분리 보존되어 카탈로그 재동기화 후에도 유지
- 다른 교사용 컴퓨터와 새로 여는 학생 성적표에서 최신 수정본 자동 사용
- 원문 재도전과 동형 문제는 모두 `<select>` 보기 선택 방식
- 기존 학생 점수는 정답 변경만으로 자동 재채점하지 않으며, Excel을 다시 일괄 저장하거나 학생 기록을 수정해야 함
- 기존 운영본 업데이트에서는 `installYoungsPhysics()`를 다시 실행하지 않고 `Code.gs` 새 버전 배포만 수행


3.3.0 배포본은 기존 Excel 일괄 입력·다른 컴퓨터 자동 연결·성적표 토큰 검증 기능을 유지하면서, 교사 인증 통신을 Apps Script 상위 보안 페이지와 `google.script.run` 방식으로 변경합니다. 다음 기능도 그대로 포함합니다.

- 학교가 비어 있으면 저장·목록·학생 리포트·Word에서 **`미기입`**으로 통일
- 구버전의 빈 학교 또는 `미입력` 학교 기록도 `미기입`과 같은 학생으로 인식
- `.xlsx` 파일을 교사용 화면에 첨부하면 학생 행과 문항 열을 자동 탐색
- 물리1 역학 총괄평가 결과표의 객관식 선택 번호 1~20번을 검수 정답표로 자동 채점
- 서술형 21~25번은 Excel에 기록된 실제 점수를 그대로 사용
- 저장 전 학생 수·재계산 점수·원본 총점·오류·신규/수정 여부를 미리 표시
- 같은 시험·학교·이름을 다시 가져오면 기존 토큰과 학부모 링크를 유지한 채 수정
- 여러 학생을 Apps Script `saveBatch` 한 번으로 Google Sheets에 일괄 반영

첨부 검증 파일 `역학진단고사 v3.xlsx`에서는 `1회` 시트의 학생 179명을 읽었고, 학교가 없는 179명은 모두 `미기입`으로 처리되며, 사이트 재계산 점수와 원본 총점의 불일치는 0건이었습니다. 개인정보 보호를 위해 실제 학생 Excel 원본은 공개 GitHub 패키지에 포함하지 않습니다.

## 자동 연결 기능

- Apps Script `/exec` 주소는 GitHub Actions의 저장소 변수 `YP_API_URL`에서 배포 파일로 자동 주입
- 공개 GitHub 파일에는 `WRITE_KEY`, 교사 PIN, 교사 세션을 넣지 않음
- 새 컴퓨터는 교사 PIN을 최초 1회 입력하면 기본 90일 동안 연결 유지
- 이미 연결된 컴퓨터에서 **10분짜리 1회용 새 컴퓨터 연결 링크** 생성 가능
- 접속·새로고침·탭 복귀·창 포커스 복귀·네트워크 재연결 때 Google Sheets 학생 목록 자동 갱신
- 학생·학부모 링크는 교사 인증 없이 열리되 서버 토큰·학생 지문·식별 다이제스트를 검증

## 저장소에 올릴 구조

압축을 푼 뒤 아래 항목을 GitHub 저장소 최상위에 올립니다.

```text
.github/workflows/pages.yml
site/
apps-script/
tests/
sample-data/
README.md
INSTALL_KO.md
package.json
.gitignore
```

`pages.yml`은 `site/`만 Pages에 배포합니다. `apps-script/`는 설치용 서버 소스이며 학생 데이터는 포함하지 않습니다.

## 신규 설치 핵심 순서

1. 전용 Google Spreadsheet에서 `확장 프로그램 → Apps Script`를 엽니다.
2. `apps-script/Code.gs`와 `appsscript.json`을 적용합니다.
3. `installYoungsPhysics()`를 실행하고 표시되는 **교사 PIN**을 보관합니다.
4. Apps Script를 웹 앱으로 배포합니다.
   - 실행 사용자: 나
   - 액세스 권한: 모든 사용자
5. `/exec`로 끝나는 웹 앱 주소를 복사합니다.
6. GitHub 저장소 `Settings → Secrets and variables → Actions → Variables`에 다음 변수를 추가합니다.

```text
Name:  YP_API_URL
Value: https://script.google.com/macros/s/.../exec
```

7. `Settings → Pages → Source`를 `GitHub Actions`로 한 번 설정합니다.
8. 파일을 `main` 브랜치에 올리고 Actions 배포 성공을 확인합니다.
9. Pages 사이트에서 교사 PIN을 최초 1회 입력합니다.
10. `시험 설정 서버 동기화`를 실행합니다.

정상 동기화 기준은 과정 3개, 시험 39개, 등록 문항 108개입니다.

## 기존 운영본에서 3.4.0으로 업데이트

1. Google Spreadsheet를 `파일 → 사본 만들기`로 백업합니다.
2. Apps Script의 `Code.gs`를 3.4.0 파일로 전체 교체합니다.
3. **`installYoungsPhysics()`, `resetTeacherPin()`, `repairReportStorage()`는 다시 실행하지 않습니다.** 기존 PIN·학생 기록·토큰·지문을 그대로 유지합니다.
4. 기존 웹 앱 배포를 **새 버전**으로 갱신합니다.
5. GitHub에는 v3.4.0 기능 패치를 덮어쓰되 `.github/workflows/pages.yml`과 `site/assets/runtime-config.js`는 기존 운영본을 유지하고 Pages를 다시 배포합니다.
6. 배포된 GitHub Pages 주소를 열면 Apps Script `/exec?view=host&site=...` 주소로 자동 전환된 뒤 기존 화면이 표시되는지 확인합니다.

새로운 빈 Spreadsheet에 처음 설치하는 경우에만 `installYoungsPhysics()`를 실행합니다.

## Excel로 학생 기록 일괄 입력

1. 교사용 사이트에서 과정과 시험을 먼저 선택합니다.
   - 첨부 파일의 경우 `물리1 → 역학 총괄평가`
2. `Excel·CSV 일괄 입력` 영역에 `.xlsx` 파일을 첨부하거나 끌어놓습니다.
3. 자동 해석 결과를 확인합니다.
   - 읽은 시트와 학생 수
   - 학교 미기입 인원
   - 객관식 해석 방식
   - 재계산 점수와 원본 총점
   - 신규 저장 또는 기존 기록 수정
4. `검증된 학생 기록 일괄 저장`을 누릅니다.
5. Apps Script가 모든 학생을 Google Sheets에 저장하고 시험 통계를 다시 계산합니다.

첨부 형식에서는 `학원` 열을 학교로 오인하지 않습니다. 학교 열이 따로 없으므로 `미기입`으로 저장됩니다.

### 지원 형식

- `.xlsx`
- 비밀번호가 설정되지 않은 파일
- 문항 번호가 연속된 `1~n` 형식 또는 `Q1~Qn` 헤더 형식
- 객관식 선택 번호, O/X, 0/1 정오표
- 서술형 실제 점수
- CSV `Q1~Qn` 형식

## 새 컴퓨터 연결

### 방법 A — 교사 PIN

새 컴퓨터에서 같은 Pages 주소를 열고 교사 PIN을 최초 1회 입력합니다.

### 방법 B — PIN 입력 없이 연결

이미 연결된 컴퓨터에서:

```text
우측 상단 교사 연결됨
→ 새 컴퓨터 연결 링크 복사
→ 10분 안에 새 컴퓨터에서 링크 열기
```

링크는 한 번 사용되면 즉시 폐기됩니다.

## GitHub Pages 404 배포 오류

`configure-pages` 단계에서 `Get Pages site failed: Not Found`가 발생하면 다음을 한 번 설정합니다.

```text
Settings
→ Pages
→ Build and deployment
→ Source
→ GitHub Actions
```

그다음 실패한 workflow를 다시 실행합니다.

## 보안 원칙

- GitHub에는 실제 학생 이름·학교·점수·토큰을 넣지 않습니다.
- GitHub에는 교사 PIN, 세션 토큰, `WRITE_KEY`, `FINGERPRINT_SECRET`, `SESSION_SECRET`을 넣지 않습니다.
- Excel은 브라우저에서 읽으며 원본 파일 자체를 GitHub 또는 Apps Script에 업로드하지 않습니다.
- 정규화된 학생 기록만 교사 인증 후 Apps Script로 전송합니다.
- 학생 데이터의 원본은 Google Sheets입니다.
- 공용 컴퓨터에서는 `이 컴퓨터 연결 해제`를 누릅니다.

## 로컬 검사

```bash
npm test
npm run serve
```

로컬에서는 `site/assets/runtime-config.js`의 URL이 비어 있어 데모 모드로 실행됩니다.
