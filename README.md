# Young’s Physics 성적 분석 시스템 3.2

GitHub Pages와 Google Sheets + Apps Script로 운영하는 **주간 복습·총괄평가 통합 성적 분석 시스템**입니다.

3.2 배포본은 3.1의 다른 컴퓨터 자동 연결 기능을 유지하면서 다음 기능을 추가합니다.

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

## 3.1 운영본에서 업데이트

1. Google Spreadsheet를 `파일 → 사본 만들기`로 백업합니다.
2. Apps Script의 `Code.gs`를 3.2 파일로 교체합니다.
3. `installYoungsPhysics()`를 한 번 실행합니다.
   - 기존 PIN은 유지됩니다.
   - 빈 학교와 구버전 `미입력` 학교 표기가 `미기입`으로 안전하게 정리됩니다.
4. 기존 웹 앱 배포를 **새 버전**으로 갱신합니다.
5. GitHub에는 3.2 패치 또는 전체 업로드본을 덮어쓰고 Pages를 다시 배포합니다.

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
