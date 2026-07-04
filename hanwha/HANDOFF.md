# KBO 티켓팅 도우미 Handoff

## 2026-07-04 Claude 재개 — 수집 보존 + 잔여 배치 설계 완료

- 시장조사 수집 원문을 LLM 재실행 없이 journal 에서 기계 추출해 **`docs/MARKET_RESEARCH_2026-07-raw.md`**(14건: 6방향 리서치 + 검증 verdict, 84KB)로 보존했다 — 커밋 `089431b`. 최종 합성 완료 → `docs/MARKET_RESEARCH_2026-07.md` (Top5 재검증·데이터 오류 2건 발견 포함). R1 종결.
- 잔여 작업 전체를 **`docs/BATCH_DESIGN_2026-07.md`**(커밋 `d124f81`) 설계 스펙으로 확정했다 — R1 시장조사 합성 / R2 크론 checksum(=원 3/9) / R3 OG·manifest·offline / R4 공유+선예매 배지 / R5 캘린더 절충+.ics / R6 이벤트 미러링+오류 표준화 / R7 v31+`#fff8ef` 잔존 2건 / R8 문서 재기준선 / X0 배포 게이트(D3/D7/D8 사용자 결정). 각 단계에 모델 배정(opus/sonnet)·앵커·검증 게이트 명시.
- **다음 구현 루프 시작점: `BATCH_DESIGN_2026-07.md` 의 R2부터** (아래 07-03 절의 "원 3/9부터"와 같은 내용 — 설계 문서가 최신 단일 소스). R1(시장조사 합성)은 문서 작업이라 병렬 가능.
- 역할 분담 유지: 설계/분석=Fable(메인), 구현=opus/sonnet 서브에이전트.

## 2026-07-03 LazyCodex 업데이트, Claude 중단 복구 및 배포

- LazyCodex `4.15.1` 설치 완료. `omo --version`은 `4.15.1`, 플러그인 부트스트랩 상태는 `success`, Codex 비대화식 런타임 프로브는 훅 로드 후 `OK`로 종료했다.
- 후속 Codex 세션에서 Claude 중단 상태를 복원하고 원 2/9 단계까지 완료한 뒤 커밋·PR·main 머지·Pages 배포를 마쳤다.

### Claude Code 원본 세션

- 세션 ID: `1c574453-6fa4-4756-a8ae-90fa5149b214`
- 진입점/작업 위치/브랜치: Claude Desktop · `/Users/minsub/Documents/hanwha` · `main`
- 세션 로그: `/Users/minsub/.claude/projects/-Users-minsub-Documents-hanwha/1c574453-6fa4-4756-a8ae-90fa5149b214.jsonl`
- 중단 시각: 2026-07-03 21:01:20 KST
- 직접 원인: 컨텍스트 창 부족이 아니라 `You've hit your session limit · resets 1:10am (Asia/Seoul)` API 429
- Claude가 마지막으로 사용자에게 밝힌 계획: 두 워크플로우 완료 뒤 독립 재검증 → 커밋 → push → 배포 → 라이브 확인까지 자동 진행. **중단 때문에 이 후속 동작은 하나도 실행되지 않았다.**
- 원 세션 재개 명령: `cd /Users/minsub/Documents/hanwha && claude --resume 1c574453-6fa4-4756-a8ae-90fa5149b214`

### 읽기 전용 전면 감사 — 완료

- Run ID / Task ID: `wf_936f8643-51f` / `wjzsh3s5i`
- 범위: 목표 갭, JS/CSS 데드 코드, 데이터 파이프라인, 문서 드리프트, 적대 검증, 통합 리포트
- 상태: wrapper와 감사 결과 모두 완료. 후속 9단계 구현의 입력으로 사용됨.
- 원본: `.omo/evidence/claude-interruption-20260703/wf_936f8643-51f.json`, `refactor-audit-wf_936f8643-51f.js`

### 9단계 구현 워크플로우 — 1/9만 Claude가 완료

- Run ID / Task ID: `wf_2d70359c-9f3` / `wmzskwekn`
- 원본 스크립트: `.omo/evidence/claude-interruption-20260703/refactor-apply-all-wf_2d70359c-9f3.js`
- 결과 원문: `.omo/evidence/claude-interruption-20260703/refactor-apply-wmzskwekn.output`
- 사용량: agent 9개, sub-agent token 121,547, tool call 66

| 단계 | Claude 중단 당시 상태 | 작업트리 반영 여부 |
|---|---|---|
| 1. 데드 JS/데이터 원자 제거 | 완료 | 반영됨 |
| 2. 고아 CSS 수술 | 45,624 tokens/12 calls 뒤 session limit, 반환값 `null` | 중단 당시 `styles.css` 변경 없음 |
| 3. 파이프라인 동일 내용 쓰기 생략 | session limit, 0 token/0 call | 미반영 |
| 4. OG/manifest/offline | session limit, 0/0 | 미반영 |
| 5. 공유 + 선예매 배지 | session limit, 0/0 | 미반영 |
| 6. 지난 티켓팅 절충 + ICS | session limit, 0/0 | 미반영 |
| 7. 이벤트 미러링 + 오류 상태 | session limit, 0/0 | 미반영 |
| 8. v31 + 전체 검증 | session limit, 0/0 | 미반영 |
| 9. 문서 재기준선 | session limit, 0/0 | 미반영 |

Claude가 완료한 1단계의 정확한 내용:

- `script.js`: `renderPlayers`, `currentPlayerFilter`, 선수 필터 리스너/호출/상수 제거
- `script.js`: `renderRankingList`, `rankingPanel` 데드 분기, `rankingPanel`/`rankingBoard` 상수 제거; `renderRankingPanels`의 실제 순위 렌더는 유지
- `script.js`/`service-worker.js`/`scripts/update-data.mjs`: `players.json`, `player-rankings.json` fetch·precache·생성 경로 원자 제거
- `tests/update-data.test.mjs`: 두 빌더 테스트·fixture·import 제거
- `data/players.json`, `data/player-rankings.json`: 삭제 상태
- `summary` 경로는 8단계 전까지 유지한다는 불변 조건 때문에 의도적으로 보존
- 검증: 앱 테스트 44/44, worker 테스트 68/68, 관련 JS/MJS 문법 검사 통과
- `isFiniteStat`는 고아가 됐지만 당시 스펙 밖이라 유지. `hitters`/`pitchers` 파싱도 export와 다른 용도가 있어 유지.

### 2026-07 시장조사 워크플로우 — 조사 원문은 보존, 문서는 미생성

- Run ID / Task ID: `wf_3b40bb01-459` / `wx3zomffd`
- 목표: 2026-06-11 시장조사 대비 경쟁사/KBO 시장/암표법/예매처/플랫폼/수익화 델타 조사와 문서 합성
- 원본 스크립트: `.omo/evidence/claude-interruption-20260703/market-research-refresh-wf_3b40bb01-459.js`
- 결과 원문: `.omo/evidence/claude-interruption-20260703/market-research-wx3zomffd.output`
- 사용량: agent 19개, sub-agent token 900,082, tool call 264
- 6개 research 단계는 모두 완료.
- verify 0–4, 6–8은 완료. verify 5, 9, 10, 11은 session limit으로 실패.
- 최종 `synthesize:doc`는 0 token/0 call로 즉시 실패. workflow result는 `doc: null`, `verifiedCount: 12`.
- 따라서 `MARKET_RESEARCH_2026-07.md` 같은 최종 문서는 생성되지 않았다. 개별 조사 결과는 원문에 있지만, 실패한 검증 4개를 다시 돌리고 합성하기 전에는 제품 판단 근거로 확정하지 않는다.

### 원문 보존 위치

- 고정 스냅샷과 SHA-256 목록: `.omo/evidence/claude-interruption-20260703/README.md`
- 전체 sub-agent transcript: `/Users/minsub/.claude/projects/-Users-minsub-Documents-hanwha/1c574453-6fa4-4756-a8ae-90fa5149b214/subagents/workflows/`
- 전체 workflow 메타데이터: `/Users/minsub/.claude/projects/-Users-minsub-Documents-hanwha/1c574453-6fa4-4756-a8ae-90fa5149b214/workflows/`

### Claude 중단 뒤 Codex가 이어서 완료한 범위

- 원 2/9 단계에 해당하는 고아 CSS와 공개 수요검증 렌더러 제거를 완료했다. 로컬 `trackDemandSignal` 저장 경로는 유지했다.
- 삭제된 선수 JSON과 연결돼 있던 타자·투수 페이지 네트워크 호출, 파서, 메타 소스까지 제거하고 회귀 테스트를 추가했다.
- 기존 CSS에서 추출한 `DESIGN.md` 기준서를 추가했다.
- 검증: `npm run check` 45/45, worker 68/68, 데드 UI 참조 0, CSS 괄호 균형 정상, 375/768/1280 브라우저 확인, 배포본 대비 모바일 더보기 픽셀 diff 100/100, 콘솔 오류 0.
- 커밋: `f199a8d`(코드/데이터 제거), `e71d196`(중단 원문/디자인 문서 보존).
- PR #10을 merge commit `f2754be`로 `main`에 머지했다.
- GitHub Pages run `28660491720` 성공. `https://minsubs.github.io/minsubsong/`에서 HTTP 200, 더보기 탭, 삭제 UI 부재, 가로 overflow 없음, 콘솔 오류 0, 선수 데이터·서비스워커 참조 0을 확인했다.
- 배포 워크플로우는 성공했지만 GitHub가 `actions/checkout@v4` 등 Node.js 20 기반 액션을 Node.js 24로 강제 실행한다는 deprecation 경고를 남겼다. 기능 실패는 아니다.
- 다음 구현 루프는 원 3/9인 `scripts/update-data.mjs` 동일 내용 재작성 생략부터 시작한다.
- 시장조사 루프는 구현 루프와 별도다. 실패한 verify 4개 → 문서 합성을 재실행해야 한다.

작성 시각: 2026-06-10 KST (최초 2026-06-06)

## 시작 위치

- repo: `/Users/minsub/Documents/hanwha`
- 앱 루트: `/Users/minsub/Documents/hanwha/hanwha`
- 기준 브랜치: `main`
- 최신 원격 반영 기준: `origin/main`

새 세션에서는 아래 순서로 시작한다.

```bash
cd /Users/minsub/Documents/hanwha
git status --short --branch
sed -n '1,220p' hanwha/HANDOFF.md
sed -n '1,220p' hanwha/PROGRESS.md
```

## 현재 제품 방향

한화 단일 개인 앱이 아니라 **KBO 10구단 티켓팅 도우미**로 전환했다.

현재 구현 범위는 무료 PWA 기반 수요 검증이다.

- 10구단 예매 오픈 캘린더
- 홈팀 기준 공식 예매처 링크
- 앱이 열려 있을 때의 티켓 알림 저장
- `검증` 탭의 localStorage 기반 수요 신호 집계

취소표 기능은 구현된 기능이 아니라 **Phase 3 후보**다. 표현은 “취소표 자동 감지”가 아니라 “취소표 관심 경기 알림”으로 제한한다.

## 안전 원칙

- 허용: 예매처 연결, 오픈 일정 정리, 알림 저장, 허용된 방식의 관심 경기 상태 알림
- 금지: 자동예매, 대기열/안티봇 우회, CAPTCHA 우회, 무단 스크래핑 기반 취소표 감시, 계정 로그인 대행
- 개인정보: 현재 수요 검증 신호는 브라우저 `localStorage.eaglesDemandSignals`에만 저장한다.
- 휴먼게이트: git history rewrite, force push, 계정/비밀번호 작업은 사용자 승인 또는 사용자 직접 조치가 필요하다.

## 완료된 일

- `ticketlink-macro/`를 제품 repo에서 분리하고 tracked deletion을 `main`에 반영했다.
- `ticketlink-macro` 보존 위치: `/Users/minsub/Documents/한화/_separated/ticketlink-macro-20260606-203301`
- `KBO_TEAM_IDS` 10개 팀 기반으로 예매 캘린더 생성 파이프라인을 확장했다.
- `data/ticketing-calendar.json`은 예정 경기 데이터를 포함한다. 이 수치는 `chore(hanwha): refresh KBO snapshot` 커밋마다 갱신되는 스냅샷이라 시점에 따라 달라진다 (2026-06-10 확인 기준 200경기, 모두 예정 경기, 홈팀 10개 전구단).
- 앱에 `예매 캘린더` 탭을 추가했다.
- 캘린더 필터는 홈/원정 양쪽 구단을 매칭한다.
- 캘린더 경기의 10분 전 티켓 알림 저장을 지원한다.
- `검증` 탭을 추가하고 로컬 수요 신호를 집계한다.
- README, PROGRESS, 데이터 연동 문서, 앱 배포 문서를 상업화 후보 제품 기준으로 업데이트했다.
- 취소표 관심 경기 알림을 Phase 3 후보로 문서화했다.

### 2026-06-10 — v20 리디자인 + 10구단 전환 (미커밋, 작업트리에만 존재)

- 전면 리디자인: 다크 "Night Game"(라임 `#c8ff45`/시안) · 라이트 "Daylight"(블루 `#2f6bff`). 토큰 교체 + 레거시 별칭 리매핑, styles.css 끝 v20/v21 마감 레이어.
- IA 7탭→5탭(home/tickets/schedule/standings/more) + 모바일 바텀탭(≤919px). 라우팅은 기존 `data-view-panel` 그룹핑 재사용.
- "내 구단"(`selectedTeam`, localStorage) 개인화: 요약보드(standings 파생: 순위/승-패/승률/흐름)·라이브 패널(대표 경기 폴백)·일정 필터·순위 강조(`is-myteam`)·캘린더 초기 필터.
- 팀 엠블럼 스쿼클 + 한글 풀네임. 브랜드 마크 "K" 제거(텍스트 브랜드만). 한화샵 쇼핑 링크 제거(10구단 중립화).
- 데이터 파이프라인(`scripts/update-data.mjs`): 한화 필터 제거 → 리그 리더(타율/홈런/ERA, 전구단 실데이터) + 리그 주요 선수 8인 + games.json 10팀(최근 7일/향후 14일) + live-game.json 오늘의 KBO 전 경기 배열(`buildLiveGames`, UI 는 selectedTeam 경기 선택 + 레거시 단일 객체 방어).
- PWA: CACHE `eagles-lounge-v22`, 자산 `?v=20`, 데이터 `?v=19`, theme-color/manifest 신 팔레트.
- 테스트: 신규/갱신 포함 30개. 상세 검증 증거는 PROGRESS.md "Phase 4" 절.

### 2026-06-12 — 최신 main 동기화 + NOL 링크 수정

- 로컬 `main`을 `origin/main` 최신 `83d5030`까지 `git pull --ff-only`로 동기화했다.
- 동기화 전 변경은 stash로 보존했다:
  - `stash@{0}` `preexisting-handoff-before-sync`: 이전 로컬 `HANDOFF.md` 메모. 현재 작업과 무관해 worktree에는 재적용하지 않았다.
  - `stash@{1}` `codex-roadmap-nol-link-fix-before-sync`: 동기화 전 NOL 링크 수정 백업. 최신 main 위에 수동 재적용 완료.
- 두산/키움/LG의 NOL 티켓 링크를 404 경로 `https://tickets.interpark.com/contents/sports`에서 200 경로 `https://ticket.interpark.com/Contents/Sports`로 교체했다.
- 반영 범위: 앱 상수(`script.js`), 데이터 생성기(`scripts/update-data.mjs`), 현재 스냅샷(`data/games.json`, `data/ticketing-calendar.json`), 회귀 테스트(`tests/pwa-registration.test.mjs`, `tests/update-data.test.mjs`).
- 검증:
  - `npm run check` → 33/33 pass
  - old URL curl → HTTP 404, new URL curl → HTTP 200
  - 로컬 브라우저 `#tickets`: stale NOL 링크 0개, current NOL 링크 60개
  - 표시 중인 예매처 링크 클릭 → `https://ticket.interpark.com/Contents/Sports`, title `NOL 티켓 | 스포츠 예매`
  - QA 서버(`python3 -m http.server 4173`) 종료 완료.

## 검증 상태

최신 확인 명령:

```bash
cd /Users/minsub/Documents/한화/hanwha
npm run check
```

결과:

```text
33/33 pass
```

브라우저 실검증(2026-06-10): 모바일 390/데스크톱 1280 × 다크/라이트, 내 구단 한화↔LG↔두산 전환 시 홈 요약·라이브·일정·순위 강조가 함께 바뀜, 콘솔 에러 없음.

## 남은 작업

0. **다음 개발은 [`docs/ROADMAP.md`](docs/ROADMAP.md) 단일 소스 참조** — 백엔드/푸시·시장조사·UI/UX 개편·미뤄둔 수정 통합.
   - ~~N1 NOL 링크 · N2 "KBO TIDO" 개명~~ → **완료·검증 (`e0a95c2`; NOL 200 / 구 URL 404)**.
   - ~~N4 검증 신호 보강 · 홈 예매오픈 카운트다운 카드~~ → **완료 (`10177b5`)**.
   - ~~iOS 설치유도 시트~~ → **완료·검증 (2026-06-19, 미커밋·작업트리)**. 스펙 `docs/superpowers/specs/2026-06-19-ios-install-sheet-design.md`, Phase 5 참조. iOS Safari·미설치 버튼+홈 1회성 배너 → 3스텝 시트, a11y, 캐시 v26, 38/38 + 브라우저 검증.
   - **남은 Now (다음 권장 루프):** UI 골격 잔여 — 더보기 알림·구독 허브(`more-subnav`) · 빈/로딩/오류 표준화. 그다음 N3 프로모션(공개 데이터 소스 선결) · N5 어필리에이트(아고다/링크프라이스 계정 선결).
   - 백엔드 분기점은 X0(결정 D3/D7/D8 선행).
1. 과거 macro 커밋 히스토리 rewrite/force push 여부를 사용자 승인하에 결정한다.
2. 노출 가능성이 있는 계정 비밀번호는 사용자가 직접 교체한다.
3. 수요 검증 운영 루틴을 정의한다.
4. ~~취소표 관심 경기 알림의 예매처별 허용 범위와 데이터 접근 방식을 조사한다.~~ → 완료 (2026-06-11, `docs/CANCEL_TICKET_ALERT_RESEARCH.md`). 다음 결정: 컨시어지 v1 진행 여부 + 제휴 BD 착수 기준 (문서 7절 미해결 질문 참조).
5. 지표가 쌓이면 취소표 관심 경기 알림, 네이티브 알림, 제휴 링크 실험으로 확장한다.

(v20 리디자인 + 10구단 전환은 2026-06-10 main 머지 완료 — 커밋/PR 이력 참조.)

## 주의할 로컬 상태

아래 경로는 작업용/보존용 untracked 상태로 남아 있을 수 있다. 사용자 승인 없이 삭제하거나 커밋하지 않는다.

- `/Users/minsub/Documents/한화/.claude/`
- `/Users/minsub/Documents/한화/.omo/`
- `/Users/minsub/Documents/한화/_separated/`
- `/Users/minsub/Documents/한화/data/`

## 다음 세션 추천 첫 작업

사용자가 별도 지시하지 않으면 `수요 검증 운영 루틴 정의`부터 진행한다.

취소표 관심 경기 알림: 조사 문서는 완료(`docs/CANCEL_TICKET_ALERT_RESEARCH.md`). 진행 지시가 오면 문서 6절 권고(컨시어지 v1: 관심 경기 저장 + 예매처별 지원 상태 표기 + 공식 취소표 대기 안내 + 딥링크 + 시간 리마인더 + 수요 신호) 범위로만 구현하고, 자동 상태 감시는 제휴 성사 전까지 금지 유지.
