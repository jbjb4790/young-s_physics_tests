# Young’s Physics v3.5.0 변경 내역

## 핵심 변경

기존의 `시험 결과 한 건당 링크 한 개` 방식에 더해, 학생 프로필 하나당 영구 학부모 링크 한 개를 발급하는 누적 포털을 추가했다.

## Google Sheets 구조

### 새 Students 시트

```text
StudentId
PortalToken
PortalFingerprint
IdentitySeed
IdentityDigest
IdentityKey
School
Name
Grade
ClassNo
ExternalId
CreatedAt
UpdatedAt
Active
```

### Reports 시트

기존 열을 유지하고 마지막에 `StudentId`를 추가했다. 기존 시험별 `Token`, `Fingerprint`, `RecordJSON`은 유지한다.

## Apps Script

### 공개 API

```text
getStudentPortal
getStudentExamDetail
```

### 교사 인증 API

```text
listStudents
reissueStudentPortal
migrateStudentPortals
```

### Spreadsheet 함수·메뉴

```text
migrateStudentPortals
diagnoseStudentPortals
```

### 데이터 보호

- 학생 포털 토큰과 지문 검증
- 학생 식별 다이제스트 검증
- 선택한 시험이 해당 학생 소유인지 검증
- 동명이인 복수 프로필이 존재할 때 미연결 구버전 기록을 여러 학생에게 중복 노출하지 않음
- 학생 포털 계산 시 Questions 시트를 한 번만 읽고 시험별로 묶어 처리

## 교사용 홈페이지

- 기존 학생 선택 영역 추가
- `동명이인 신규 학생` 버튼 추가
- 저장 시 안정적인 `StudentId` 연결
- `저장·성적 분석·학생 링크 복사` 버튼으로 문구 변경
- 학생별 영구 링크 관리 표 추가
- 시험 기록 표에 영구 링크 복사·열기와 개별 시험 링크 기능을 분리
- Excel·CSV 일괄 입력에서 기존 학생 연결 후보와 동명이인 충돌 표시

## 학부모 학생 포털

새 파일:

```text
site/portal.html
site/assets/portal.js
```

탭:

```text
누적 요약
주간 복습
총괄평가
오답 학습
```

시험 상세 기능:

- 점수·동일 시험 평균
- 총괄 상위 비율
- 단원·문항별 분석
- 원문 문제와 검수 해설
- 원문 객관식 재도전
- 객관식 동형 문제
- 기존 개별 성적표와 Word 출력 연결

## 기존 링크 호환성

- 기존 시험별 링크는 삭제하거나 변경하지 않는다.
- 새 영구 포털은 기존 시험별 링크를 대체하는 학부모 대표 링크로 사용한다.
- 학생 점수, CreatedAt, UpdatedAt, 시험별 토큰과 지문을 유지한다.

## 버전

```text
패키지 버전: 3.5.0
기능 버전: 3.5.0-student-lifetime-portal
Apps Script 통신 API 식별자: 3.3.0-hosted-parent-bridge
```

Apps Script 통신 API 식별자는 현재 정상 운영 중인 GitHub host bridge와의 호환을 위해 유지했다.
