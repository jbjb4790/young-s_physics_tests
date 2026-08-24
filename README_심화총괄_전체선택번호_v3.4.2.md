# Young’s Physics v3.4.2 적용 안내

## 1. 변경되는 입력 규칙

### 일반 물리1·물리2 총괄평가

```text
1~20번  학생이 실제로 고른 객관식 번호 1~5
21~25번 학생이 실제로 받은 서술형 점수
```

### 물리1심화·물리2심화 총괄평가

```text
1~25번 모두 학생이 실제로 고른 객관식 번호 1~5
```

심화 총괄에서는 숫자 `1`이 정답 여부 또는 1점을 뜻하지 않고 **①번 선택**을 뜻합니다. 선택번호는 시험의 현재 검수 정답표와 비교하여 문항 만점 또는 0점으로 자동 채점됩니다.

## 2. 이번 패치에 포함된 구조 변경

- `physics1-advanced-total`의 선택번호 범위를 `1-25`로 변경
- 새 과정 `physics2-advanced`와 총괄평가 준비 항목 `physics2-advanced-total` 추가
- 입력 정책을 과정명 하드코딩이 아니라 `Exams.InputProfileJSON.objectiveRange`로 판정
- Excel·CSV 정답표 검증도 선택번호 범위 전체에 적용
- 자료가 아직 정적 카탈로그에 없는 심화 총괄의 기존 `Questions` 행은 시험 설정 서버 동기화 시 보존
- 물리1심화·물리2심화 총괄용 Q1~Q25 CSV 예시 추가

물리1심화·물리2심화 총괄 문제지와 검증 정답 자료는 제공되지 않았으므로, 이번 패치에는 임의 문제나 정답을 만들지 않았습니다. 두 시험은 자료 등록 전까지 `준비 중`입니다.

## 3. 운영 Spreadsheet 백업

Google Spreadsheet에서 다음을 먼저 실행합니다.

```text
파일 → 사본 만들기
```

기존 `Reports`, `Questions`, `QuestionOverrides` 시트는 삭제하지 않습니다.

## 4. Apps Script 적용

1. 운영 Spreadsheet에서 `확장 프로그램 → Apps Script`를 엽니다.
2. 기존 `Code.gs`를 별도로 백업합니다.
3. v3.4.2 `Code.gs` 내용으로 전체 교체하고 저장합니다.
4. 다음 함수는 다시 실행하지 않습니다.

```text
installYoungsPhysics()
resetTeacherPin()
repairReportStorage()
```

5. `배포 → 배포 관리 → 기존 웹 앱 편집 → 버전: 새 버전 → 배포`를 실행합니다.
6. 실행 사용자는 `나`, 액세스 권한은 기존과 동일한 `모든 사용자`를 유지합니다.

이번 버전은 GitHub 통신 호환성을 위해 Apps Script `API_VERSION`을 계속 다음 값으로 유지합니다.

```text
3.3.0-hosted-parent-bridge
```

따라서 `/exec?action=ping`에서 3.3.0 문자열이 나오는 것이 정상입니다.

## 5. GitHub 패치 적용

v3.4.2 GitHub 패치 ZIP을 압축 해제한 뒤 내부 파일을 저장소 최상위에 경로 그대로 덮어씁니다.

이번 패치에는 다음 파일이 들어 있지 않습니다.

```text
.github/workflows/pages.yml
site/assets/runtime-config.js
```

따라서 현재 정상 동작 중인 Pages workflow와 Apps Script `/exec` 주소 설정은 유지됩니다.

커밋 예시:

```text
Use choice numbers for all 25 advanced comprehensive questions
```

커밋 후 Pages 배포가 끝나면 브라우저를 강력 새로고침합니다.

```text
Windows: Ctrl + Shift + R
Mac: Command + Shift + R
```

## 6. 시험 설정 서버 동기화

교사용 홈페이지에서 다음을 한 번 실행합니다.

```text
교사 연결됨 → 시험 설정 서버 동기화
```

정상 카탈로그 기준:

```text
과정 4개
시험 40개
현재 등록 문항 108개
```

심화 총괄 두 시험은 문제 자료가 없으므로 `준비 중`이며 108개 문항 수에는 포함되지 않습니다.

## 7. 심화 총괄 문제 자료를 등록할 때

문제지와 정답지가 준비되면 각 시험을 다음처럼 등록합니다.

```text
QuestionCount = 25
Status = ready
InputProfileJSON.objectiveRange = "1-25"
InputProfileJSON.objectiveMode = "choice-number"
InputProfileJSON.subjectiveRange = ""
InputProfileJSON.subjectiveMode = "none"
```

각 문항에는 반드시 공식 정답번호 `1~5`와 문항 배점을 등록해야 합니다. 홈페이지 `정답 관리`에서 정답을 수정한 값은 `QuestionOverrides` 시트에 별도로 보존됩니다.

## 8. Excel·CSV 입력 형식

```csv
학교,학생 성명,학년,반번호,Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8,Q9,Q10,Q11,Q12,Q13,Q14,Q15,Q16,Q17,Q18,Q19,Q20,Q21,Q22,Q23,Q24,Q25
,홍길동,2,1반 1번,1,2,3,4,5,1,2,3,4,5,1,2,3,4,5,1,2,3,4,5,1,2,3,4,5
```

- Q1~Q25: 학생이 실제로 고른 선택번호
- 허용값: 1, 2, 3, 4, 5
- 학교 빈칸: `미기입`
- 같은 시험·학교·이름 재입력: 기존 기록 수정 및 기존 성적표 토큰 유지

## 9. 최종 확인

1. 심화 총괄 시험을 선택합니다.
2. 21~25번도 `①~⑤` 선택 버튼으로 표시되는지 확인합니다.
3. `1`을 입력했을 때 1점이 아니라 ①번 선택으로 표시되는지 확인합니다.
4. CSV Q1~Q25를 불러와 선택번호가 유지되는지 확인합니다.
5. 정답표가 등록된 시험에서 총점이 자동 계산되는지 확인합니다.
6. 테스트 학생 1명을 저장하고 Google Sheets `Reports` 행과 학부모 링크를 확인합니다.
