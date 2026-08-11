# Apps Script 재배포 필요

이번 패치는 Code.gs의 시트 스키마, 점수 파서, StudentKey, historyRecords API를 변경하므로 반드시 Apps Script 웹 앱을 새 버전으로 재배포해야 합니다.

1. 기존 Spreadsheet 백업
2. Code.gs 교체
3. connectThisSpreadsheet 실행
4. 배포 관리 → 새 버전
5. `/exec` URL 확인
6. GitHub Pages 서버 설정에서 연결 확인
7. 시험 설정 서버 동기화
