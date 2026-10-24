# Young’s Physics v3.7.4 — 물리2 일반 13회차 전기회로 (미배포 로컬 준비본)

- 기존 시험 ID **`physics2-basic-r13`**의 `coming-soon`/0문항 placeholder를 **`ready`/7문항/100점**으로 활성화. 새로운 중복 ID를 생성하지 않음.
- 문항별 배점: **20·10·15·25·10·10·10 = 100점**. 원본 PDF 3페이지·해답/숙제노트 HWP 원형 보존, 웹 검수 해설 PDF 3페이지 생성.
- HWP 공식 해답 1~7번 수식(회로 전류, 내부저항, 브리지 회로, 메쉬 전류)과 독립 검산 대조. 4번은 전위차의 크기 6V, 정의에 따른 부호 `Va−Vb=-6V`를 구분. 1·3·6번 전제조건은 문항 주석으로 설명.
- 교사 0/1/P1/실수 부분점수/공란 입력, 원문 7문항+동형 7문항은 4지 객관식 재도전 제공.
- v3.7.3 대비 **4과정 / 42 시험 (준비22) / 230문항**, 기존 다른 41개 시험 데이터 불변. 물리2 전자기·파동 총괄 이력에 이미 13회차 포함되므로 연결 설정 수정 없음.
- Apps Script, Worker, 로고·테마, 영구 학생 링크, server token/fingerprint, `.github/workflows/pages.yml`, `runtime-config.js`, `share-config.js` 변경 없음.
- `npm test`: **281개 중 280 PASS, 1 기존 Excel 원본 미첨부 SKIP, 0 FAIL**. 자세한 검증: `docs/물리2_13회차_검수등록보고서_v3.7.4.md`.
- **운영 서비스/GitHub/Sheets/Apps Script/Worker 미배포.** 명시적 배포 요청 전 변경 금지.
- 배포 전 운영 GitHub 실제 최신 소스와 **v3.7.3** 비교, Sheets `Courses/Exams/Questions/QuestionOverrides` 백업 및 13회차 override 충돌 확인. 동기화는 기존 데이터 행 교체가 가능하므로 검토 후 실시. 되돌릴 때는 GitHub 기존 커밋을 복구하고, Sheets는 백업과 차이 비교하여 13회차 관련 행만 선택 복원한다.
