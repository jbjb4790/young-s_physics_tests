# 물리2 11회차 전기장 추가 v3.6.8 — 적용 안내서

## 이번 업데이트

- 시험 ID: `physics2-basic-r11` (기존 준비 중 항목 활성화)
- 8문항·총 100점, 배점 20/10/10/10/10/10/20/10
- 숙제노트 2~4페이지 해설을 우선 검수. 7번 주기 교정, 8번 마찰 조건 누락으로 확인 필요
- 8문항 모두 원문 문제 이미지, 객관식 원문 재도전, 새 4지 객관식 동형 문제 및 해설 작성
- 마찰 조건이 누락된 8번은 학생 화면에서 해설·정답을 자동으로 공개하지 않음
- 학생 통합 학습 페이지에 기존 점수·강약점·누적 분석 방식으로 연결

## 기존 운영 사이트에 안전하게 적용하기

1. GitHub 저장소와 Google Spreadsheet를 백업합니다.
2. **`YoungsPhysics_물리2_11회차전기장_추가_v3.6.8_GitHub패치.zip`** 을 압축 해제합니다.
3. 압축 해제한 폴더의 파일을 **기존 GitHub 저장소 최상위**에 경로 그대로 덮어씁니다. ZIP 자체만 올리지 마세요.
4. 커밋하고 GitHub Actions의 Pages 배포가 완료되도록 기다립니다.
5. 홈페이지를 `Ctrl + Shift + R` (Mac은 `Command + Shift + R`)로 강력 새로고침합니다.
6. 교사 PIN 인증 후 **`시험 설정 서버 동기화`** 버튼을 딱 한 번 누릅니다.
7. 과정 `물리2` → `11회차 복습 테스트 · 전기장`에서 **8문항/100점**을 확인합니다.
8. 테스트 학생 한 명에 대해 Q1=`1` → 20점, Q2=`0` → 0점, Q7=`P1` → 부분점수 1점을 확인합니다.
9. 학생 통합 링크를 열어 기존 누적 결과에 해당 회차가 추가되는지 확인합니다.

### 이번에는 변경하지 않는 파일

- `apps-script/Code.gs`, `apps-script/appsscript.json`
- `.github/workflows/pages.yml`
- `site/assets/runtime-config.js`
- Cloudflare Worker / 학생 공유 주소
- 교사 PIN 및 Google Sheets의 기존 학생 기록

따라서 Apps Script 코드를 교체하거나 웹 앱을 다시 배포하지 않습니다. 단, 새 문항을 `Questions`·`Exams`에 등록하기 위한 **시험 설정 서버 동기화**는 필요합니다.

## 실험 자료 검수 주의사항

- 7번 (4): 기존 해설 주기식의 유효중력 역수 오류를 바로잡아 `T=2π√(√3 l/(2g))`로 적용했습니다.
- 8번: 원문에서 **마찰의 유무가 명시되지 않아** 특정한 E 값이 유일하지 않습니다. 조건부 해설은 검수 보고서에 남기고 **학생 자동 공개는 보류**합니다. 문제 조건을 수정하려면 교사가 먼저 확정해 주세요.
- 원본 시험 하단 '초파 그리면 2점'은 기본 100점 합계에 추가하지 않았습니다.

## 릴리스 파일 안내

- `site/assets/data/catalog.js` 및 `catalog.json`: 사이트 전체 시험/문항 설정
- `site/assets/data/questions/physics2-basic-r11.json`: 물리2 11회 문항 데이터
- `site/assets/pages/physics2/r11-p1~p3.png`: 문제 이미지 3장
- `site/assets/documents/physics2/r11.pdf`: 원본 3페이지 시험지
- `site/assets/documents/physics2/r11-verified-solution.pdf`: 교정 해설 PDF (8번 답 비공개)
- `tests/physics2-r11.test.mjs`: 신규 15개 자동 검사
- `docs/물리2_11회차_문제해설_검수보고서.md`: 발견 사항과 교정 근거
- `물리2_11회차_학생입력예시.csv`: 학생 CSV 입력 예시

## 서버 운영 확인

Apps Script API 버전은 계속 기존 `3.3.0-hosted-parent-bridge`를 사용합니다. 정적 카탈로그의 featureVersion은 `3.6.8-physics2-r11-electric-field`로 증가하므로, 교사 화면의 서버 동기화 버튼을 반드시 눌러야 합니다.
