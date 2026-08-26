# v3.5.0 학생 영구 통합 포털 API 업데이트

- 새 `Students` 시트에서 학생 한 명당 `StudentId`, 영구 포털 토큰, 지문과 식별 다이제스트를 관리합니다.
- `Reports` 시트 마지막 열에 `StudentId`를 추가해 과정·회차가 달라도 같은 학생의 기록을 연결합니다.
- 새 API: `getStudentPortal`, `getStudentExamDetail`, `listStudents`, `reissueStudentPortal`, `migrateStudentPortals`.
- 기존 운영본에서는 `Code.gs`를 교체하고 웹 앱을 새 버전으로 재배포한 뒤 `migrateStudentPortals()`를 `done:true`가 될 때까지 실행합니다.
- `installYoungsPhysics()`와 PIN 재설정은 다시 실행하지 않습니다. 기존 시험별 토큰·지문과 개별 성적표 링크는 유지됩니다.

---

# v3.4.2 심화 총괄 전체 선택번호 API 업데이트

기존 운영본에서는 `Code.gs`를 v3.4.2로 교체한 뒤 웹 앱을 **새 버전**으로 재배포합니다. `appsscript.json` 권한은 바뀌지 않았고, `installYoungsPhysics()`를 다시 실행하지 않습니다.

- 일반 물리1·물리2 총괄: 1~20번 선택번호, 21~25번 실제 점수
- 물리1심화·물리2심화 총괄: 1~25번 모두 선택번호 1~5
- 범위 판정은 `Exams.InputProfileJSON.objectiveRange`를 사용합니다.

# v3.4.1 총괄 선택번호·CSV 자동 입력 API 업데이트

기존 운영본에서는 `Code.gs`를 v3.4.1로 교체한 뒤 웹 앱을 **새 버전**으로 재배포합니다. `appsscript.json` 권한은 바뀌지 않았고, `installYoungsPhysics()`를 다시 실행하지 않습니다. 교사용 홈페이지에서 정답을 처음 저장할 때 `QuestionOverrides` 시트가 자동 생성됩니다.

추가 API: `getQuestions`, `saveQuestionAnswers`, `clearQuestionAnswerOverrides`. 정답 수정 요청은 교사 세션 인증이 필요합니다.

---

# Young’s Physics Apps Script 3.3.0

## v3.3.0 상위 보안 브리지

GitHub Pages를 직접 열면 Apps Script `/exec?view=host&site=...` 보안 상위 페이지로 자동 전환됩니다. 기존 GitHub UI는 상위 페이지 안의 iframe에서 그대로 표시되고, Google Sheets 요청은 Apps Script HTML Service가 공식 제공하는 `google.script.run`으로 처리합니다.

이 방식은 GitHub Pages가 Apps Script를 숨은 제3자 iframe 또는 cross-origin fetch로 직접 호출하지 않으므로 브라우저별 POST 응답 브리지 실패를 피합니다.

`Code.gs` 변경 후 웹 앱을 반드시 새 버전으로 배포합니다.

```text
실행 사용자: 나
액세스 권한: 로그인하지 않은 사용자를 포함한 모든 사용자
```

`SITE_ORIGINS`에는 저장소 경로를 제외한 origin만 입력합니다.

```text
https://username.github.io
```

## 버전 확인

```text
/exec?action=ping
```

정상 버전:

```text
3.3.0-hosted-parent-bridge
```


## v3.4.2 입력 규칙

- 일반 물리1·물리2 총괄평가 1~20번: 학생 선택번호 1~5
- 일반 총괄 21~25번: 실제 서술형 획득 점수
- 물리1심화·물리2심화 총괄평가 1~25번: 학생 선택번호 1~5
- 구형 0/1·O/X 기록은 `inputEncoding=legacy-binary`로 호환
- 새 총괄 기록은 `inputEncoding=objective-choice-v1`로 저장
