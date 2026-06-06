# KBO 티켓팅 도우미 진행상황

## 현재 목표

한화 단일 개인 앱에서 **KBO 10구단 티켓팅 도우미**로 전환한다. 무료 PWA로 예매 캘린더와 알림 저장 수요를 검증한 뒤, 지표가 충분할 때 취소표 관심 경기 알림, 네이티브 알림, 제휴, 스토어 배포로 확장한다.

## 원칙

- 합법 알림 도우미: 예매처 연결, 오픈 일정 정리, 알림 저장, 허용된 방식의 관심 경기 상태 알림만 제공한다.
- 금지: 자동예매, 대기열/안티봇 우회, 무단 스크래핑 기반 취소표 감시, 계정 로그인 대행.
- 개인정보 최소화: 현재 수요 검증 신호는 브라우저 localStorage에만 저장하고 외부 전송하지 않는다.
- 위험 작업: git history rewrite, force push, 계정/비밀번호 작업은 사용자 승인 또는 사용자 직접 조치가 필요하다.

## 현재 체크리스트

- [x] 10구단 예매처/오픈 규칙 매핑
- [x] KBO 일정 수집을 10개 팀 `teamId` 호출 방식으로 변경
- [x] `data/ticketing-calendar.json` 생성
- [x] `예매 캘린더` 탭 추가
- [x] 구단 필터가 홈/원정 양쪽을 모두 매칭하도록 수정
- [x] 캘린더 경기의 티켓 알림 저장 지원
- [x] PWA 캐시/버전 정합성 갱신
- [x] `ticketlink-macro/`를 제품 worktree 밖으로 분리
- [x] `검증` 탭과 로컬 수요 신호 집계 추가
- [x] README/진행상황/데이터/앱배포 문서와 앱 메타 카피를 `KBO 티켓팅 도우미` 기준으로 정리
- [x] 취소표 관심 경기 알림을 Phase 3 후보 범위로 문서화
- [x] 다음 세션용 `HANDOFF.md` 작성
- [ ] 과거 macro 커밋 히스토리 rewrite 여부 결정
- [ ] 노출 가능성이 있는 계정 비밀번호 사용자 직접 교체
- [ ] 수요 검증 운영 루틴 정의
- [ ] 취소표 관심 경기 알림의 예매처별 허용 범위/데이터 접근 방식 조사
- [ ] 지표 기반 네이티브 알림/제휴/스토어 확장 여부 결정

## Phase 0 — Macro 분리

- `ticketlink-macro/`는 제품 worktree 밖으로 이동했다.
- 보존 위치: `/Users/minsub/Documents/한화/_separated/ticketlink-macro-20260606-203301`
- 현재 제품 worktree의 `ticketlink-macro/*` tracked deletion은 `main`에 커밋/머지되어 있다.
- 현재 worktree와 분리 폴더에는 실제 `.env`가 없고 `.env.example`만 확인했다.
- 과거 커밋 `dd2b6fd`, `d597970`에는 macro 이력이 남아 있다.
- 과거 노출 가능성이 있는 계정 비밀번호는 사용자가 직접 교체해야 한다.

## Phase 1 — 10구단 예매 캘린더

- `scripts/kbo-schedule-api.mjs`
  - `KBO_TEAM_IDS = ["HH","OB","LG","SK","WO","HT","SS","LT","NC","KT"]`
  - `parseKoreanScheduleRows(rows, { teamFilter: null })`로 중립 전구단 일정 파싱 지원
- `scripts/update-data.mjs`
  - `collectAllTeamScheduleGames()`가 월별 target마다 10개 팀을 concrete `teamId`로 호출한다.
  - `buildTicketCalendar()`가 예정 경기만 추출하고 `ticketing` metadata를 붙인다.
  - public JSON에서 `rawTime`, `rawScore`를 제거한다.
- `data/ticketing-calendar.json`
  - 최신 검증 기준 214경기
  - 10개 홈팀 포함
  - 예매 오픈 시각순 정렬
- 앱
  - `예매 캘린더` 탭
  - 전체+10구단 필터
  - 예매처 링크
  - 10분 전 티켓 알림 저장

## Phase 2 — 수요 검증

- `검증` 탭을 추가했다.
- `localStorage.eaglesDemandSignals`에 로컬 전용 신호를 저장한다.
- 현재 기록 신호:
  - `calendar_filter_selected`
  - `provider_click`
  - `ticket_reminder_saved`
  - `notification_permission_result`
  - `signals_exported`
- 검증 탭 기능:
  - 알림 저장/예매처 클릭/구단 필터/알림 권한 집계 카드
  - 최근 신호 목록
  - JSON 내보내기
  - 초기화
- 외부 전송, 서버 저장, 개인식별 수집은 없다.

## Phase 3 후보 — 취소표 관심 경기 알림

- 목표: 사용자가 관심 경기를 저장하면 잔여석/취소표 상태 변화 가능성을 알려주고 공식 예매처로 이동시킨다.
- 전제:
  - 예매처 약관과 트래픽 정책을 먼저 확인한다.
  - 로그인 대행, 자동 구매, 대기열 우회, CAPTCHA/안티봇 우회는 하지 않는다.
  - 공식 API, 허용된 공개 상태값, 제휴 피드, 또는 사용자가 직접 열어둔 세션 안에서의 명시적 확인처럼 안전한 접근만 검토한다.
  - 알림 빈도 제한과 중복 알림 방지 정책을 둔다.
- 1차 MVP:
  - 관심 경기 저장
  - 취소표 알림 수요 신호 기록
  - 예매처별 지원 가능/불가 상태 표기
  - 상태 변화가 확인된 경우 알림과 공식 예매처 링크 제공
- 보류 조건:
  - 예매처가 자동 조회를 금지하거나 로그인/대기열/안티봇 우회가 필요하면 해당 예매처는 지원하지 않는다.

## 검증 증거

- Phase 1 RED/GREEN/HTTP:
  - `.omo/ulw-loop/evidence/C001-red.txt`
  - `.omo/ulw-loop/evidence/C001-green.txt`
  - `.omo/ulw-loop/evidence/C001-http.txt`
  - `.omo/ulw-loop/evidence/C002-browser.md`
  - `.omo/ulw-loop/evidence/C002-calendar.png`
  - `.omo/ulw-loop/evidence/C003-green-final.txt`
  - `.omo/ulw-loop/evidence/C003-http-final.txt`
- Phase 2:
  - `.omo/ulw-loop/evidence/phase2-demand-red.txt`
  - `.omo/ulw-loop/evidence/phase2-demand-green.txt`
  - `.omo/ulw-loop/evidence/phase2-check.txt`
  - `.omo/ulw-loop/evidence/phase2-demand-browser.md`
  - `.omo/ulw-loop/evidence/phase2-demand-validation.png`
- 문서/상업용 카피 정리:
  - `.omo/ulw-loop/evidence/docs-commercial-check.txt`
  - `.omo/ulw-loop/evidence/docs-commercial-browser.md`
  - `.omo/ulw-loop/evidence/docs-commercial-brand.png`

최신 전체 회귀:

```bash
npm run check
# 22/22 pass
```

## 다음 세션 시작 지시

```text
/Users/minsub/Documents/한화에서 시작.
hanwha/HANDOFF.md와 hanwha/PROGRESS.md를 읽고 다음 미완 항목으로 진행해.
과거 구현 히스토리는 handoff에 적힌 내용만 신뢰해.
```

## 다음 작업 후보

1. 과거 macro 히스토리 rewrite/force push 여부를 사용자 승인하에 결정한다.
2. 수요 검증 운영 루틴을 정한다.
3. 취소표 관심 경기 알림의 예매처별 허용 범위와 데이터 접근 방식을 조사한다.
4. 지표가 쌓이면 취소표 관심 경기 알림, 네이티브 알림, 제휴 링크 실험으로 확장한다.
