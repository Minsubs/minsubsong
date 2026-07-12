# KBO 티켓팅 도우미 진행상황

> 2026-07-12 Wave 2 배포 완료: 기존 화면에서 상단·마이팀 선택기·경기장 날씨만 부분 개편하고, 중립+10구단 PWA 아이콘/매니페스트와 iOS 재설치 안내를 연결했다. 앱 캐시는 **v34**, 검증은 **99/99 통과**했다. 커밋 `945100e`를 [GitHub Pages](https://minsubs.github.io/minsubsong/)에 배포했으며([run 29176947950](https://github.com/Minsubs/minsubsong/actions/runs/29176947950)), Cloudflare Worker는 미인증 상태라 미배포다. 실사용자 푸시는 빈 Worker 연동값과 법률 게이트로 비활성이다. 상세는 `HANDOFF.md` 최상단.

> 2026-07-04 배치 완료: `docs/BATCH_DESIGN_2026-07.md`의 R2~R8 전체 구현 + LG 예매처/키움 오픈시각 긴급 데이터 수정, 캐시 v31. 상세는 `HANDOFF.md` 해당 절.

> **다음 개발 단일 소스: [`docs/ROADMAP.md`](docs/ROADMAP.md)** (백엔드/푸시 플랜 + 시장조사 + UI/UX 개편 + 미뤄둔 수정 통합). 개발 재개 시 여기부터.
> Now 버킷 진행: ~~N1 NOL 링크 · N2 "KBO TIDO" 개명~~ (`e0a95c2`) · ~~N4 검증 신호 보강 · 홈 예매오픈 카운트다운 카드~~ (`10177b5`) · ~~iOS 설치유도 시트~~ · ~~데드 코드 정리~~ · ~~R2~R8 배치~~ → **모두 완료·검증**.
> Now 착수 보류: N3 프로모션(공개 데이터 소스 조사 선결) · N5 어필리에이트(D11 수익화 착수 시점 결정 대기). `more-subnav`(더보기 하위탭)는 폐기 결정(하위 면 소멸).
> X0(백엔드+푸시 기반) — D3/D7/D8 **결정 완료**, 코드·프로비저닝 준비 완료, `wrangler login` 대기 — 다음 루프. 병행 가능: X5(가칭, 라이브 스코어+경기 알림) LV0 소스 PoC.
> 상세: `docs/BACKEND_PUSH_PLAN.md` · `docs/FEATURE_MARKET_RESEARCH.md` · `docs/MARKET_RESEARCH_2026-07.md` · `docs/CANCEL_TICKET_ALERT_RESEARCH.md` · `docs/LIVE_ALERTS_DESIGN_2026-07.md`.

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
- [x] Wave 2 부분 개편 — 상단 브랜드·11옵션 마이팀 선택기·경기장 지역 날씨
- [x] 중립+10구단 앱 아이콘/매니페스트 — 성인 20~30대 여성 팬 대상의 프리미엄 티켓 굿즈 방향
- [x] 마이팀 선택 시 manifest/Apple touch icon 교체 + 설치 후 자동 변경 불가 재설치 안내
- [x] 캐시 v34 및 앱 테스트 99/99
- [x] GitHub Pages 프론트 배포 — `945100e`, run `29176947950`
- [x] 전구단 데이터 전환 (games.json 10팀, 리그 리더 타율/홈런/ERA 실데이터)
- [x] NOL 티켓 예매처 링크 404 경로 수정 (`ticket.interpark.com/Contents/Sports`)
- [ ] 과거 macro 커밋 히스토리 rewrite 여부 결정
- [ ] 노출 가능성이 있는 계정 비밀번호 사용자 직접 교체
- [ ] 수요 검증 운영 루틴 정의
- [x] 취소표 관심 경기 알림의 예매처별 허용 범위/데이터 접근 방식 조사 → `docs/CANCEL_TICKET_ALERT_RESEARCH.md` (2026-06-11, 결론: 자동 감시는 5개 예매처 전부 보류 조건 해당 — 컨시어지형 v1만 진행 가능)
- [ ] 지표 기반 네이티브 알림/제휴/스토어 확장 여부 결정
- [x] live-game.json 전구단화 (오늘의 KBO 전 경기 배열 + selectedTeam 선택, 레거시 단일 객체 방어 유지)
- [x] N1 인터파크(NOL) 예매처 링크 복구 (`script.js` 두산/키움/LG → `ticket.interpark.com/Contents/Sports`, 커밋 `e0a95c2`) — 검증: NOL 200 / 구 URL 404
- [x] N2 앱 개명 "KBO TIDO" (index.html·manifest·README·offline.html, localStorage 키는 유지, 커밋 `e0a95c2`)
- [x] N4 검증 탭 신호 보강 + "합산=백엔드 선행" 고지 (`demand-scope-note` + cancel_watch_*/team_selected 신호, 커밋 `10177b5`)
- [x] 홈 "다음 예매 오픈" 카운트다운 카드 (`#ticketOpenCard`, 내 구단 최근접 openAt, 커밋 `10177b5`)
- [x] (Now) iOS 설치유도 시트 — iOS Safari·미설치에서만 상단 버튼+홈 1회성 배너 → 3스텝 시트(공유→홈화면 추가→확인), a11y(focus trap·Esc·aria-modal), 비-Safari 적응 카피, 캐시 v26. (미커밋, 작업트리)
- [x] 데드 코드 정리(2026-07-03) — 선수 그리드·히어로 랭킹패널·리그 리더·공개 수요검증 UI 제거, 신호 수집(`trackDemandSignal`)은 유지. `docs/ROADMAP.md` §1.1 "제거된 화면" 참조. `더보기` 하위탭(`more-subnav`) 신설 계획은 하위 면 소멸로 폐기.
- [x] R1 시장조사 델타 합성 → `docs/MARKET_RESEARCH_2026-07.md` (LG 예매처 티켓링크 오류·키움 오픈 14:00 오류 발견)
- [x] R2 크론 위생 — `update-data.mjs` 동일 내용 재작성 스킵
- [x] R3 OG/매니페스트/오프라인 메타 정렬
- [x] R4 공유 버튼 + 선예매 배지
- [x] R5 캘린더 절충 + .ics 내보내기
- [x] R6 이벤트 미러링 + 오류 상태 표준화(`renderDataError`)
- [x] R7 캐시 트리아드 v30→v31 + `#fff8ef` 잔존 2건 처리(메인 세션이 직접 적용)
- [x] R8 문서 재기준선(ROADMAP/HANDOFF/PROGRESS/DATA_INTEGRATION/FEATURE_MARKET_RESEARCH/CANCEL_TICKET_ALERT_RESEARCH) — 본 배치
- [x] 긴급 데이터 수정 — LG 예매처 NOL→티켓링크, 키움 오픈시각 14:00 정정
- [ ] (Now·착수 보류) N3 프로모션 일정 칩 — 공개 데이터 소스 조사가 선결, 소스 미확보 상태
- [ ] (Now·착수 보류) N5 여행/숙박 어필리에이트 — D11(수익화 착수 시점) 사용자 결정 대기
- [x] X0 배포 게이트 결정 — D3(Cloudflare Workers+D1+Cron)·D7(`wrangler secret`)·D8(발송 전 법률 게이트 유지) 확정(2026-07-10)
- [ ] X0 배포 실행 — **코드·프로비저닝 준비 완료, `wrangler login` 대기**: `cd hanwha/worker && npx wrangler login && bash scripts/provision.sh` → 클라 키 주입 → 실기기 검증. D8 검토 전 실사용자 발송 금지
- [x] X0 차단 버그 수정 — `worker/wrangler.toml`의 `ALLOWED_ORIGIN`/`DATA_BASE_URL`/`VAPID_SUBJECT` 오타 도메인(`minsub.github.io`) → 실측 HTTP 200 도메인(`minsubs.github.io`)으로 정정 (미커밋, 작업트리)
- [x] `worker/scripts/provision.sh` 신설 — D1/VAPID/deploy/secret/스키마 자동화, 멱등. Opus 검증으로 실패경로 3건(P1 키 유실 롤백/P2 pipefail/P3 secret list 판정) 발견·패치 (미커밋, 작업트리)
- [x] X0 클라 결함 9건 패치 — C1(팀명↔코드 불일치, critical)~C6(team_interest 소실), Opus 전원 CONFIRMED. 앱 테스트 **47/47**, 캐시 v31→v32 (미커밋, 작업트리)
- [x] 메뉴 중복 버그 수정 — `index.html` 데드 `<nav class="nav">` 제거(데스크톱 `.view-tabs`와 중복이던 최초 커밋부터의 결함) (미커밋, 작업트리)
- [x] 푸터 카피 정정 — "JSON 스냅샷" 문구 제거 → "KBO 공식 홈페이지 데이터를 자동 수집해 반영합니다"(meta.json·update-data.mjs·index.html 3곳) (미커밋, 작업트리)
- [x] 문서 드리프트 정정 — `docs/BACKEND_PUSH_PLAN.md` 상태 주석(구현 완료·배포 미실행) + `worker/README.md` 게이트2에 `provision.sh` 상호참조 (미커밋, 작업트리)
- [x] `docs/LIVE_ALERTS_DESIGN_2026-07.md` 신규 — 라이브 스코어+마이팀 경기 알림 설계(LV0~LV2, ROADMAP X4 흡수, 미해결 DL1~DL5) (미커밋, 작업트리)
- [x] LV1a 구현 — `worker/lib/scoreboard.js`(순수 파서) + `GET /api/live`(엣지캐시 25s + stale 폴백) + 테스트. 워커 68→**78/78**, `wrangler dev` 실측(캐시 HIT·503 폴백) (미커밋, 작업트리)

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

## 2026-07-03 — Claude 중단 복구 및 배포

- LazyCodex `4.15.1` 업데이트와 런타임 프로브 완료.
- Claude Code 세션 `1c574453-6fa4-4756-a8ae-90fa5149b214`의 중단 시각·원인·워크플로우 원문·SHA-256을 `.omo/evidence/claude-interruption-20260703/`에 보존.
- 원 1/9 선수 UI·데이터 제거를 완결하고, 원 2/9 고아 CSS·공개 수요검증 렌더러 제거 및 `DESIGN.md` 기준서 추가.
- `npm run check` 45/45, worker 68/68, 로컬·배포 실브라우저 콘솔 오류 0.
- PR #10 → merge commit `f2754be` → Pages run `28660491720` 성공. 실사이트 `https://minsubs.github.io/minsubsong/` 검증 완료.
- 다음 구현 루프: 원 3/9 `scripts/update-data.mjs` 동일 내용 재작성 생략. 시장조사는 실패한 verify 4개와 문서 합성을 별도 재개.

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
