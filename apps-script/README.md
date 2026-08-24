# v3.4.0 정답 관리 API 업데이트

기존 운영본에서는 `Code.gs`만 v3.4.0으로 교체한 뒤 웹 앱을 **새 버전**으로 재배포합니다. `appsscript.json` 권한은 바뀌지 않았고, `installYoungsPhysics()`를 다시 실행하지 않습니다. 교사용 홈페이지에서 정답을 처음 저장할 때 `QuestionOverrides` 시트가 자동 생성됩니다.

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
