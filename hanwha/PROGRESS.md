# KBO 티켓팅 도우미 진행상황

> **다음 개발 단일 소스: [`docs/ROADMAP.md`](docs/ROADMAP.md)** (백엔드/푸시 플랜 + 시장조사 + UI/UX 개편 + 미뤄둔 수정 통합). 개발 재개 시 여기부터 — Now 버킷: N1 인터파크(NOL) 링크 수정 · N2 "KBO TIDO" 개명. 진짜 분기점은 D3/D7/D8 결정 후 X0(백엔드+푸시 기반).
> 상세: `docs/BACKEND_PUSH_PLAN.md` · `docs/FEATURE_MARKET_RESEARCH.md` · `docs/CANCEL_TICKET_ALERT_RESEARCH.md`.

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
- [x] v20 전면 리디자인 (다크 "Night Game" 라임/시안 · 라이트 "Daylight" 블루)
- [x] 5탭 IA 재구조 (홈·예매·일정·결과·순위·더보기) + 모바일 바텀탭
- [x] "내 구단" 선택(`selectedTeam`) — 10구단 개인화 (요약/라이브/일정/순위/캘린더)
- [x] 전구단 데이터 전환 (games.json 10팀, 리그 리더 타율/홈런/ERA 실데이터)
- [ ] 과거 macro 커밋 히스토리 rewrite 여부 결정
- [ ] 노출 가능성이 있는 계정 비밀번호 사용자 직접 교체
- [ ] 수요 검증 운영 루틴 정의
- [x] 취소표 관심 경기 알림의 예매처별 허용 범위/데이터 접근 방식 조사 → `docs/CANCEL_TICKET_ALERT_RESEARCH.md` (2026-06-11, 결론: 자동 감시는 5개 예매처 전부 보류 조건 해당 — 컨시어지형 v1만 진행 가능)
- [ ] 지표 기반 네이티브 알림/제휴/스토어 확장 여부 결정
- [x] live-game.json 전구단화 (오늘의 KBO 전 경기 배열 + selectedTeam 선택, 레거시 단일 객체 방어 유지)

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
  - 스냅샷 갱신(`refresh KBO snapshot`)으로 경기 수는 시점마다 변동 (2026-06-10 확인 기준 200경기, 모두 예정 경기)
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

- **타당성 조사 완료 (2026-06-11)**: `docs/CANCEL_TICKET_ALERT_RESEARCH.md`. 자동 상태 감시는 robots/약관/안티봇으로 5개 예매처 전부 불가(아래 보류 조건 해당). 합법 경로는 ① B2B 제휴 피드(NHN링크/SSG/NC 협상 후보) ② 사용자 주도 확인(딥링크+시간 리마인더) ③ 공식 취소표 대기 서비스 안내. 권고: "취소표 컨시어지 v1"로 범위 축소 진행 — 사용자 결정 대기.
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

## Phase 4 — v20 리디자인 + 10구단 전환 (2026-06-10)

- 디자인: 다크 "Night Game"(`#0a0b0e` + 라임 `#c8ff45`/시안 `#19e3ff`) / 라이트 "Daylight"(`#eeeee8` + 블루 `#2f6bff`). 토큰은 `:root`/`:root.dark` 교체 + 레거시 별칭(`--orange`→`--accent`) 리매핑. 마감 레이어는 styles.css 끝의 v20/v21 주석 블록.
- 팀 엠블럼: 방패 → 스쿼클(rect rx15) + 한글 풀네임 이니셜(한화·두산·기아…). 구단 브랜드색은 `teamColors` 유지.
- IA: 7탭 → 5탭 (home/tickets/schedule/standings/more). 섹션은 `data-view-panel` 그룹핑(예매=티켓팅+캘린더, 더보기=선수+검증). 모바일(≤919px) 바텀탭 고정/뷰탭 숨김.
- 내 구단: `selectedTeam`(localStorage) + `#teamSelect` 칩. `is-eagles`/`is-hanwha` → `is-myteam`. 요약보드는 `teamStandings`에서 파생(순위/승-패/승률/흐름), 라이브 패널은 selectedTeam 대표 경기 폴백, 일정은 selectedTeam 필터.
- 데이터: `update-data.mjs` 한화 필터 제거 → `player-rankings.json`(리그 타율/홈런/ERA top3, 전구단) · `players.json`(리그 주요 8인) · `games.json`(10팀, 최근7일+향후14일) · `live-game.json`(오늘의 KBO 전 경기 배열, `buildLiveGames` + 스코어보드 매칭, 실패 시 한화 단일 폴백).
- PWA: CACHE v22, 자산 `?v=20`, 데이터 `?v=19`(shape 변경 캐시버스트), theme-color `#0a0b0e`/`#eeeee8`.
- 검증 증거: `npm run check` 30/30 pass (테스트 8개 신규/갱신 포함). 브라우저 실검증 — 모바일(390)/데스크톱(1280) × 다크/라이트, 내 구단 한화↔LG↔두산↔키움↔SSG 전환 시 홈 요약/라이브(실스코어)/일정/순위 강조 변경 확인, 콘솔 에러 없음.

최신 전체 회귀:

```bash
npm run check
# 30/30 pass
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
