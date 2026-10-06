# Young's Physics v3.6.2 · 물리2 역학 총괄평가 추가 적용 안내

## 적용 대상

현재 v3.6.1 프로젝트에 `물리2 역학 총괄평가`를 추가하는 데이터·정적 사이트 패치이다.

- 시험 ID: `physics2-basic-total-mechanics`
- 과정: 물리2
- 문항: 25문항
- 만점: 100점
- 1~20번: 객관식 선택번호 1~5 입력, 각 4점
- 21~25번: 실제 서술형 획득점수 0~4 입력
- 역학 총괄 누적 분석 연결: 물리2 복습 2~9회

## 적용 순서

1. 운영 GitHub 저장소를 백업한다.
2. `YoungsPhysics_물리2_역학총괄추가_v3.6.2_GitHub패치.zip`을 압축 해제한다.
3. ZIP 내부 파일을 GitHub 저장소 **최상위 경로에 그대로 덮어쓴다.** ZIP 자체를 업로드하지 않는다.
4. 커밋한다. 예: `Add Physics 2 mechanics comprehensive assessment v3.6.2`
5. 기존 GitHub Pages Actions가 정상 완료될 때까지 기다린다.
6. 교사용 사이트를 `Ctrl + Shift + R`(Mac: `Cmd + Shift + R`)로 강력 새로고침한다.
7. 교사 인증 후 `시험 설정 서버 동기화`를 **한 번** 실행한다.
8. 시험 목록에서 `물리2 역학 총괄평가`가 `준비 완료`인지 확인한다.
9. 테스트 학생 한 명으로 1~20번 선택번호와 21~25번 점수를 입력하여 저장·리포트 표시를 확인한다.

## Apps Script

이번 추가에서는 서버 스키마/API를 변경하지 않았다. 따라서 아래 작업은 필요 없다.

- `Code.gs` 교체
- `appsscript.json` 변경
- Apps Script 웹 앱 새 버전 배포
- `installYoungsPhysics()` 실행
- 교사 PIN 재설정
- 학생 포털 마이그레이션 재실행

단, 신규 시험과 25개 문항을 Google Sheets `Exams`/`Questions`에 반영하기 위해 **사이트의 시험 설정 서버 동기화는 반드시 한 번 실행**한다.

## 배포 설정 보존

권장 GitHub 패치에는 다음 파일을 의도적으로 포함하지 않았다.

- `.github/workflows/pages.yml`
- `site/assets/runtime-config.js`
- `apps-script/Code.gs`
- `apps-script/appsscript.json`

현재 정상 작동 중인 GitHub Pages workflow, Apps Script `/exec`, 교사 인증 설정을 그대로 보존한다.
