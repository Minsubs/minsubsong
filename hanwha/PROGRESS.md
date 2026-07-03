# KBO 티켓팅 도우미 진행상황

> 2026-07-03 중단 지점: LazyCodex `4.15.1` 업데이트 완료 후 새 세션 적용 대기. Claude 워크플로우 1/9 데이터 경로 제거와 Codex 2/9 고아 CSS·공개 수요검증 렌더러 제거까지 작업트리에 반영·검증됨(`npm run check` 44/44, 브라우저 375/768/1280, 배포본 대비 모바일 더보기 픽셀 diff 100/100). 다음은 3/9 데이터 쓰기 동일 내용 스킵. 상세는 `HANDOFF.md` 최상단.

> **다음 개발 단일 소스: [`docs/ROADMAP.md`](docs/ROADMAP.md)** (백엔드/푸시 플랜 + 시장조사 + UI/UX 개편 + 미뤄둔 수정 통합). 개발 재개 시 여기부터.
> Now 버킷 진행: ~~N1 NOL 링크 · N2 "KBO TIDO" 개명~~ (`e0a95c2`) · ~~N4 검증 신호 보강 · 홈 예매오픈 카운트다운 카드~~ (`10177b5`) → **모두 완료·검증**.
> Now 진행: ~~iOS 설치유도 시트~~ → **완료·검증 (미커밋, 작업트리)**. 남은 Now: UI 골격 잔여(더보기 알림·구독 허브 `more-subnav` · 빈/로딩/오류 표준화) · N3 프로모션(공개 데이터 소스 선결) · N5 어필리에이트(아고다/링크프라이스 계정 선결). 진짜 분기점은 D3/D7/D8 결정 후 X0(백엔드+푸시 기반).
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
- [x] NOL 티켓 예매처 링크 404 경로 수정 (`ticket.interpark.com/Contents/Sports`)
- [ ] 과거 macro 커밋 히스토리 rewrite 여부 결정
- [ ] 노출 가능성이 있는 계정 비밀번호 사용자 직접 교체
- [ ] 수요 검증 운영 루틴 정의
- [x] 취소표 관심 경기 알림의 예매처별 허용 범위/데이터 접근 방식 조사 → `docs/CANCEL_TICKET_ALERT_RESEARCH.md` (2026-06-11, 결론: 자동 감시는 5개 예매처 전부 보류 조건 해당 — 컨시어지형 v1만 진행 가능)
- [ ] 지표 기반 네이티브 알림/제휴/스토어 확장 여부 결정
- [x] live-game.json 전구단화 (오늘의 KBO 전 경기 배열 + selectedTeam 선택, 레거시 단일 객체 방어 유지)
- [x] N1 인터파크(NOL) 예매처 링크 복구 (`script.js` 두산/키움/LG → `nol.interpark.com/ticket`, 커밋 `e0a95c2`) — 검증: NOL 200 / 구 URL 404
- [x] N2 앱 개명 "KBO TIDO" (index.html·manifest·README·offline.html, localStorage 키는 유지, 커밋 `e0a95c2`)
- [x] N4 검증 탭 신호 보강 + "합산=백엔드 선행" 고지 (`demand-scope-note` + cancel_watch_*/team_selected 신호, 커밋 `10177b5`)
- [x] 홈 "다음 예매 오픈" 카운트다운 카드 (`#ticketOpenCard`, 내 구단 최근접 openAt, 커밋 `10177b5`)
- [x] (Now) iOS 설치유도 시트 — iOS Safari·미설치에서만 상단 버튼+홈 1회성 배너 → 3스텝 시트(공유→홈화면 추가→확인), a11y(focus trap·Esc·aria-modal), 비-Safari 적응 카피, 캐시 v26. (미커밋, 작업트리)
- [ ] (Now) UI 골격 잔여 — 더보기 알림·구독 허브(`more-subnav`) · 빈/로딩/오류 표준화
- [ ] (Now·외부선결) N3 프로모션 일정 칩(공개 데이터 소스) · N5 여행/숙박 어필리에이트(계정+공정위 표기)

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

## 2026-06-12 — 최신 main 동기화 + NOL 링크 수정

- 로컬 `main`이 `origin/main`보다 뒤처져 있어 기존 로컬 변경을 stash로 보존한 뒤 `git pull --ff-only`로 `83d5030`까지 fast-forward 했다.
- 숨은 worktree의 `docs/ROADMAP.md` N1 항목 기준으로, 두산/키움/LG의 NOL 티켓 링크를 404 응답인 `https://tickets.interpark.com/contents/sports`에서 200 응답인 `https://ticket.interpark.com/Contents/Sports`로 교체했다.
- 적용 파일: `script.js`, `scripts/update-data.mjs`, `data/games.json`, `data/ticketing-calendar.json`, `tests/pwa-registration.test.mjs`, `tests/update-data.test.mjs`.
- 보존된 stash:
  - `stash@{0}`: `preexisting-handoff-before-sync` — 이전 로컬 `HANDOFF.md` 메모, 현재 작업과 무관하여 worktree에는 재적용하지 않음.
  - `stash@{1}`: `codex-roadmap-nol-link-fix-before-sync` — 동기화 전 NOL 링크 수정 백업, 최신 main 위에 수동 재적용 완료.
- 검증:
  - `npm run check` → 33/33 pass
  - `curl -ILsS https://tickets.interpark.com/contents/sports` → HTTP 404
  - `curl -ILsS https://ticket.interpark.com/Contents/Sports` → HTTP 200
  - 로컬 브라우저 `http://127.0.0.1:4173/index.html#tickets`: stale NOL 링크 0개, current NOL 링크 60개 확인
  - 표시 중인 예매처 링크 클릭 → `https://ticket.interpark.com/Contents/Sports`, title `NOL 티켓 | 스포츠 예매`
  - QA용 `python3 -m http.server 4173` 서버는 종료함.

최신 전체 회귀:

```bash
npm run check
# 33/33 pass
```

## Phase 5 — iOS 설치유도 시트 (2026-06-19, 미커밋)

ROADMAP Now "iOS 설치유도 시트" 루프. iOS Safari 는 `beforeinstallprompt` 를 발화하지 않아 기존 `#installApp` 버튼이 iOS 에선 안 보였던 갭을 메운다. (설치=향후 Web Push 도달의 전제.)

- 스펙: `docs/superpowers/specs/2026-06-19-ios-install-sheet-design.md` (브레인스토밍 산출).
- 감지(순수 함수): `isIosDevice`(iPhone/iPad/iPod + iPadOS Mac위장 maxTouchPoints) · `isStandaloneDisplay`(display-mode + navigator.standalone) · `isIosSafari`(CriOS/FxiOS/in-app 제외) · `shouldShowIosInstall`.
- UI: iOS Safari·미설치에서만 상단 `앱 설치` 버튼이 시트를 열고, 홈 패널 1회성 배너(`#iosInstallBanner`, dismiss → `localStorage.eaglesIosInstallHintDismissed`). 3스텝 시트(`#iosInstallSheet`, 공유→홈 화면에 추가→추가) + a11y(role=dialog·aria-modal·focus trap·Esc·backdrop). 비-Safari iOS 는 `needs-safari` 카피로 적응. styles.css `[v26]` append-only 레이어.
- 게이팅 주의: 배너는 `data-view-panel="home"` 라 뷰 라우터(`setActiveView`)가 `.hidden` 을 소유 → 설치 게이팅은 별도 `ios-off` 클래스로 분리(라우터와 충돌 회피).
- 캐시: `styles.css?v=23` · `script.js?v=24` · SW `eagles-lounge-v26` (index+SW 동시 bump, 버전드리프트 테스트가 강제).
- 테스트: 신규 `tests/ios-install.test.mjs` 6케이스. `pwa-registration.test.mjs` 의 SW 버전 핀 v25→v26 갱신.

검증 증거:
- `npm run check` → **38/38 pass** (32 → +6, syntax check 포함).
- 브라우저 실검증(python http.server :4174 + Preview): 데스크톱(MacIntel)에서 배너 `ios-off`·시트 미노출 / 감지 함수 — iPhone Safari show=true·iPhone Chrome safari=false·iPadOS(Mac+touch) ios=true·데스크톱 ios=false·standalone 게이트=false / 시트 오픈 시 포커스 닫기버튼 이동·Esc·백드롭·dismiss(localStorage="1")·비-Safari 노트(block↔none) / 모바일 바텀시트 + 다크 라임 렌더 스크린샷 확인 · 콘솔 에러 없음.
- (검증 중 발견·기록: 같은 세션에서 `?v` 고정 채 파일만 고치면 SW cacheFirst 가 stale 서빙 → 검증 위해 SW unregister+cache clear 필요했음. 프로덕션은 배포마다 캐시명 bump 라 무관.)

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
