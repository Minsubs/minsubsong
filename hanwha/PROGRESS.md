# 한화이글스 커뮤니티 웹페이지 진행상황

## 목표

한화이글스 팬들이 경기 일정, 선수 기록, 팀 흐름, 커뮤니티 피드를 한 화면에서 볼 수 있는 웹페이지를 만든다.

## Phase 체크리스트

- [x] Phase 1: 정적 MVP 화면 제작
  - `index.html`, `styles.css`, `script.js` 생성
  - 경기/선수/커뮤니티 피드 UI 구현
  - 팬 커뮤니티용 히어로 이미지 asset 추가
  - 기본 반응형 레이아웃과 테마 전환 구현
- [x] Phase 2: 데이터 구조화
  - 경기/선수 데이터를 별도 JSON 파일로 분리
  - 데이터 출처와 갱신 기준 명시
  - 추후 API 연동 가능한 모듈 구조로 변경
- [x] Phase 3: 메모(커뮤니티) 기능 확장
  - 메모 localStorage 영속화 (새로고침해도 유지)
  - 메모 삭제 기능 추가
  - 사용자 입력 XSS 이스케이프 처리
- [x] Phase 4: 실제 데이터 연동 검토
  - KBO/공식 사이트/스포츠 데이터 출처 비교
  - 자동 갱신 주기와 캐싱 전략 결정
- [x] Phase 5: PWA 앱화
  - 앱 매니페스트 추가
  - 앱 아이콘 추가
  - service worker 캐시 추가
  - 오프라인 fallback 추가
- [x] Phase 6: 데이터 자동 갱신 스크립트
  - KBO 공식 페이지 수집
  - 팀 요약/경기/라이브 경기/선수 랭킹 JSON 자동 생성
  - 실행 명령 문서화
- [x] Phase 7: 자동갱신 자동화 + 클라이언트 자동 반영
  - GitHub Actions cron으로 update-data 자동 실행 + 변경분 자동 커밋
  - GitHub Pages 자동 배포
  - 앱이 열려 있을 때 클라이언트 폴링으로 최신 데이터 자동 반영
  - Periodic Background Sync best-effort

## Phase 1 Handoff

- 현재 프로젝트는 설치 과정 없이 브라우저에서 `index.html`을 열면 동작하는 정적 웹페이지다.
- 생성 이미지 원본은 Codex 기본 생성 폴더에 남겨두고, 프로젝트에서는 `assets/hero-stadium.png`를 참조한다.
- 2026-05-30 기준 KBO 검색 결과를 참고해 팀 순위/주요 선수 기록 일부를 정적 데이터로 넣었다.
- 다음 Phase는 `script.js`의 `data` 객체를 `data/games.json`, `data/players.json`, `data/posts.json` 등으로 분리하는 것이 자연스럽다.

## Phase 2 Handoff

- `script.js`의 하드코딩 데이터 객체를 `data/` 아래 JSON 파일로 분리했다.
  - `data/meta.json`: 데이터 기준일, 안내문, 출처 링크
  - `data/summary.json`: 팀 요약 보드
  - `data/games.json`: 경기 일정/결과
  - `data/players.json`: 선수 기록 카드
  - `data/posts.json`: 초기 커뮤니티 피드
- `script.js`는 `loadData()`에서 JSON을 fetch한 뒤 `renderAll()`로 화면을 그린다.
- JSON fetch가 들어갔기 때문에 이제 직접 파일 열기보다 로컬 서버 실행이 기준이다.
  - 실행 예: `python3 -m http.server 4173`
  - 접속: `http://127.0.0.1:4173/index.html`
- 다음 Phase는 커뮤니티 기능 확장이다. 현재 등록한 응원글은 메모리에서만 유지되므로 새로고침하면 사라진다.

## Phase 3 Status

- 사용자 요청으로 Phase 3 커뮤니티 기능 확장은 우선 보류했다.
- 현재 등록한 응원글은 여전히 브라우저 메모리에서만 유지된다.

## Phase 4 Handoff

- 실제 데이터 연동 검토를 `docs/DATA_INTEGRATION.md`에 정리했다.
- 권장 방향은 공식 KBO 페이지를 1차 출처로 보고, 서버 사이드 수집 스크립트가 `data/*.json`을 갱신하는 방식이다.
- 클라이언트가 외부 KBO 페이지를 직접 fetch하지 않고, 현재처럼 로컬 JSON만 읽게 유지하는 편이 CORS/HTML 변경/장애 대응에 유리하다.
- 현재 정적 JSON 스냅샷도 2026-05-30 KST 확인 기준 공식 KBO 페이지에 맞춰 일부 갱신했다.
  - 팀 순위: 5위, 25승 25패, W2
  - 팀 타율: 0.280
  - 팀 홈런: 58
  - 최근/예정 경기: 05.27~05.31 한화 경기 기준
  - 주요 선수: 강백호, 페라자, 문현빈, 류현진
- 다음 구현 단계는 `scripts/update-data.mjs`를 만들어 KBO HTML을 수집하고 `data/*.json`을 자동 생성하는 작업이다.

## Main Dashboard Handoff

- 사용자 요청으로 메인 첫 화면을 커뮤니티 중심에서 실시간 경기/선수 랭킹 중심으로 재구성했다.
- 추가 데이터 파일:
  - `data/live-game.json`: 오늘 경기판 데이터
  - `data/player-rankings.json`: 타율/평균자책/팀 내부 장타 순위
- `script.js`는 위 두 JSON을 추가로 fetch해서 히어로 영역의 실시간 경기판과 랭킹 패널, 별도 랭킹 섹션을 렌더링한다.
- 현재 실시간 스코어 값은 공식 일정 기반의 경기중 상태와 수집 대기 표시다. 실제 이닝/스코어 자동 갱신은 `scripts/update-data.mjs` 구현 시 연결하면 된다.

## Phase 5 Handoff

- PWA 설치를 위한 `manifest.webmanifest`를 추가했다.
- 앱 아이콘은 공식 구단 로고가 아닌 자체 `E` 마크 기반 SVG로 `assets/app-icon.svg`에 추가했다.
- `service-worker.js`가 앱 셸, 히어로 이미지, JSON 데이터를 캐시한다.
- 데이터 JSON 요청은 network-first 전략이라 온라인이면 최신 파일을 우선 받고, 실패하면 캐시를 사용한다.
- 문서 탐색 요청은 network-first 후 캐시된 `index.html`로 fallback한다.
- `offline.html`은 완전 오프라인 fallback 화면이다.
- 상단에는 브라우저가 `beforeinstallprompt`를 제공할 때만 보이는 `앱 설치` 버튼을 추가했다.

## Phase 6 Handoff

- `scripts/update-data.mjs`를 추가했다.
- 실행 명령:
  - `npm run update:data`
  - 직접 실행: `node scripts/update-data.mjs`
- 스크립트가 갱신하는 파일:
  - `data/meta.json`
  - `data/summary.json`
  - `data/games.json`
  - `data/live-game.json`
  - `data/player-rankings.json`
  - `data/players.json`
- `data/posts.json`은 커뮤니티 초기 데이터라 자동 갱신 대상에서 제외했다.
- KBO 원본 HTML은 `data/cache/raw/`에 저장하며 `.gitignore`에서 제외했다.
- `package.json`에 `serve`, `update:data`, `check` 스크립트를 추가했다.
- 현재 자동 갱신은 공식 KBO 순위/일정/선수기록 HTML 기반이다. 경기 중 이닝별 라인스코어는 아직 스코어보드/문자중계 출처 추가가 필요하다.
- KBO 스코어보드 파싱을 추가해 오늘 한화 경기 결과와 1~9회 라인스코어까지 `data/live-game.json`에 반영한다.

## Shop Links Handoff

- 메인 히어로 영역에 굿즈 바로가기 링크를 추가했다.
  - 스파이더 한화이글스: `https://spyder.co.kr/eagles_index.html`
  - 형지 한화이글스샵: `https://www.eaglesshop.co.kr/`
- 앱 셸 HTML/CSS가 바뀌어 `service-worker.js` 캐시 버전을 `eagles-lounge-v2`로 올렸다.

## Scoreboard Layout Handoff

- 실시간 경기판의 이닝별 스코어를 이닝별 카드 묶음에서 2행 미니 라인스코어 테이블로 변경했다.
- 원정/홈 팀 행에 1~9회 점수와 최종 득점 `R`을 함께 보여주므로 세로 공간을 덜 사용한다.
- 모바일 폭에서는 테이블만 가로 스크롤되어 라이브 패널 전체 레이아웃이 길게 늘어나지 않게 했다.
- 앱 셸 JS/CSS가 바뀌어 `service-worker.js` 캐시 버전을 `eagles-lounge-v4`로 올리고, `index.html`의 CSS/JS 참조에 버전 쿼리를 붙였다.

## Live First Layout & Alerts Handoff

- 메인 히어로의 우선순위를 실시간 경기판/선수 랭킹 패널 중심으로 바꿨다.
- 기존 히어로 문구, 경기판/랭킹 링크, 스파이더/형지샵 링크는 실시간 패널 아래 보조 영역으로 내렸다.
- 상단에 `알림 켜기` 버튼을 추가했다.
- 알림 권한이 허용되면 서비스워커 `showNotification`으로 현재 경기 요약 알림을 띄운다.
- 알림 클릭 시 앱의 `#live` 영역으로 돌아오도록 `notificationclick` 핸들러를 추가했다.
- 앱 셸 HTML/CSS/JS/service worker가 바뀌어 캐시 버전을 `eagles-lounge-v5`, CSS/JS 참조를 `?v=4`로 올렸다.

## Ticketing Handoff

- 경기 카드와 대표 경기 카드에 홈팀 기준 티켓 예매 정보를 추가했다.
- 현재 매핑:
  - 한화 홈: 티켓링크 `https://www.ticketlink.co.kr/sports/137/63`
  - SSG 홈: SSG 티켓 `https://ticket.ssg.com/ticket`
  - NC 홈: NC 다이노스 공식 홈페이지 `https://www.ncdinos.com/`
- 예정 경기에는 `티켓 알림` 버튼을 표시하고, 누르면 브라우저 알림 권한을 요청한 뒤 로컬 알림 저장소에 경기별 알림을 저장한다.
- 알림 권한이 없는 환경에서는 예매처 링크를 새 창으로 여는 fallback을 둔다.
- `scripts/update-data.mjs`가 `games.json`을 갱신할 때도 홈팀 기준 `ticketing` 필드를 붙이도록 했다.
- 앱 셸 HTML/CSS/JS/service worker가 바뀌어 캐시 버전을 `eagles-lounge-v6`, CSS/JS 참조를 `?v=5`로 올렸다.

## Upcoming Schedule & Ticket Alarm Handoff

- 예정 경기 필터는 최대 10경기까지 노출하도록 `MAX_UPCOMING_GAMES = 10`을 추가했다.
- `scripts/update-data.mjs`의 자동 생성도 예정 경기 10개까지 보존하도록 변경했다.
- 현재 `data/games.json`에는 최근 3경기와 예정 10경기를 담았다.
- 티켓 알림 버튼은 브라우저 알림 권한과 무관하게 먼저 `localStorage.eaglesTicketReminders`에 저장한다.
- 브라우저 알림 권한이 허용되면 추가로 OS/브라우저 알림을 띄우고, 권한이 없거나 차단된 환경에서는 앱 내부 저장 완료 토스트를 보여준다.
- 두산/NOL, 롯데 자체 예매, KIA 티켓링크, 키움/NOL 예매처 매핑을 추가했다.
- 앱 셸 HTML/CSS/JS/service worker가 바뀌어 캐시 버전을 `eagles-lounge-v8`, CSS/JS 참조와 JSON fetch 버전을 `?v=7`로 올렸다.

## Ticket Open Time Handoff

- 경기 카드의 티켓 영역에 예매 오픈 시각과 알림 예정 시각을 표시한다.
- 티켓 알림은 예매 오픈 `10분 전`으로 계산해 `localStorage.eaglesTicketReminders`에 `openAt`, `remindAt`을 저장한다.
- 앱/PWA가 열려 있으면 30초마다 저장된 티켓 알림을 확인하고, 도래한 알림은 토스트와 브라우저 알림으로 보여준다.
- 현재 홈팀별 기본 예매 오픈 규칙:
  - 한화/KIA/NC/키움: 경기 7일 전 11:00
  - SSG: 경기 5일 전 11:00
  - 두산: 경기 7일 전 11:00, 베어스클럽 10:00 선예매 표시
  - 롯데: 경기 14일 전 14:00, 구단 앱 공지 확인 문구 표시
- 앱이 완전히 닫힌 상태의 백그라운드 푸시는 아직 서버 푸시 연동이 필요하다.
- 앱 셸 HTML/CSS/JS/service worker가 바뀌어 캐시 버전을 `eagles-lounge-v10`, CSS/JS 참조와 JSON fetch 버전을 `?v=9`로 올렸다.

## Scoreboard Visual Polish Handoff

- 라이브 스코어보드에 팀 배지를 추가했다. 공식 로고가 아닌 앱 자체 스타일의 모노그램 배지이며, 한화는 오렌지 `E` 배지로 강조한다.
- 라이브 스코어보드의 팀/점수/상태 영역을 카드형 리듬으로 정리했다.
- 좁은 화면에서는 3열 점수판을 팀 카드, 경기 상태, 팀 카드 순서로 세로 배치해 간격이 눌리거나 어긋나지 않게 했다.
- 대표 경기 카드에도 팀 배지를 넣어 라이브 보드와 시각 언어를 맞췄다.
- 경기 카드의 날짜, 티켓 영역, 상태 칩 간격을 정리했다.
- 앱 셸 HTML/CSS/JS/service worker가 바뀌어 캐시 버전을 `eagles-lounge-v11`, CSS/JS 참조와 JSON fetch 버전을 `?v=10`으로 올렸다.

## Tabbed App Layout Handoff

- 긴 단일 스크롤 페이지를 탭 기반 화면으로 바꿨다.
- 상단 탭 메뉴는 `실시간`, `경기`, `랭킹`, `선수`, `커뮤니티`로 구성된다.
- 각 주요 섹션에 `data-view-panel`을 부여하고, 현재 선택된 화면만 보이도록 `setActiveView()`에서 `hidden`을 제어한다.
- 기존 상단 메뉴, 브랜드 홈, 히어로 버튼도 같은 `data-view-target` 로직에 연결했다.
- URL hash(`#games`, `#rankings` 등)와 뒤로가기/앞으로가기에도 탭 상태가 맞춰진다.
- 앱 셸 HTML/CSS/JS/service worker가 바뀌어 캐시 버전을 `eagles-lounge-v12`, CSS/JS 참조와 JSON fetch 버전을 `?v=11`로 올렸다.

## Personal App Branding Handoff

- 앱 제목을 `내가 쓰려고 만든 한화이글스 앱`으로 변경했다.
- 상단 브랜드는 `내 한화이글스 앱`, 보조 문구는 `경기 · 랭킹 · 티켓 체크`로 변경했다.
- 히어로 문구도 개인용 체크 앱 컨셉으로 바꿨다.
- `커뮤니티` 탭은 `메모` 탭으로 표시하고, 섹션 제목은 `내 한화 메모장`으로 변경했다.
- 초기 `data/posts.json`도 타인 게시글이 아닌 `나`의 개인 메모 데이터로 변경했다.
- `manifest.webmanifest`, `offline.html`, `README.md`의 앱명/설명도 개인용 앱 컨셉으로 맞췄다.
- 앱 셸 HTML/CSS/JS/service worker가 바뀌어 캐시 버전을 `eagles-lounge-v13`, CSS/JS 참조와 JSON fetch 버전을 `?v=12`로 올렸다.

## Rankings Team Standings Handoff

- 랭킹 탭 상단에 `KBO 전체 팀 순위` 테이블을 추가했다.
- 팀 순위는 새 파일 `data/team-standings.json`에서 읽는다.
- 한화 행은 오렌지 배경과 `E` 팀 배지로 강조한다.
- 기존 한화 선수 랭킹 카드는 `한화 선수 순위` 소제목 아래로 이동했다.
- `scripts/update-data.mjs`가 KBO 팀 순위 HTML에서 전체 10개 팀 순위를 파싱해 `team-standings.json`도 갱신하도록 변경했다.
- 앱 셸 HTML/CSS/JS/service worker가 바뀌어 캐시 버전을 `eagles-lounge-v14`, CSS/JS 참조와 JSON fetch 버전을 `?v=13`으로 올렸다.

## Minsub Branding & Ticket Tab Handoff

- 앱 제목과 브랜드를 `민섭이가 쓰려고 만든 한화이글스 앱` 컨셉으로 변경했다.
- 상단 브랜드는 `민섭이 한화이글스 앱`, 보조 문구는 `민섭이 경기 · 랭킹 · 티켓 체크`로 변경했다.
- `manifest.webmanifest`, `offline.html`, `README.md`, 초기 메모 데이터도 민섭이 개인용 앱 컨셉으로 맞췄다.
- 상단 탭에 `티켓팅`을 추가했다.
- `경기` 탭에서는 예정 경기를 제외하고 최근 경기 결과만 보여준다.
- 예정 경기 10개와 예매 오픈 시간, 10분 전 알림 버튼은 새 `티켓팅` 탭으로 이동했다.
- `renderTickets()`를 추가했고, 티켓 알림 저장 후 티켓팅 탭도 다시 렌더링한다.
- 앱 셸 HTML/CSS/JS/service worker가 바뀌어 캐시 버전을 `eagles-lounge-v15`, CSS/JS 참조와 JSON fetch 버전을 `?v=14`로 올렸다.

## Auto Update & Client Sync Handoff (Phase 7)

- 데이터 자동갱신/배포를 GitHub Actions로 자동화했다.
  - `.github/workflows/update-data.yml`: KST 08:00/18:00/23:30/00:30(cron은 UTC로 환산) + 수동 실행(workflow_dispatch). `node scripts/update-data.mjs` 실행 후, 실제 경기/순위/선수 데이터가 바뀐 경우에만 `data/`를 커밋·push한다. `meta.json`의 갱신 시각만 바뀐 경우는 커밋하지 않는다.
  - `.github/workflows/deploy-pages.yml`: main/master push 시 저장소 루트를 GitHub Pages로 배포한다. 데이터 자동 커밋이 push를 일으키면 배포도 자동으로 다시 돈다.
- 클라이언트도 앱이 열려 있는 동안 5분(`POLL_INTERVAL_MS`)마다 `meta.json`을 확인해서, `updatedAt`이 바뀌었을 때만 전체 데이터를 다시 받아 화면을 갱신한다(탭이 보일 때만, `visibilitychange` 시 즉시 1회).
- Periodic Background Sync를 best-effort로 등록한다(`refresh-data`, 6시간). 권한/지원 브라우저(설치된 PWA·Chromium 계열)에서만 동작하고, 그 외에는 조용히 무시된다.
- 한계: 정적 호스팅이라 앱이 완전히 종료된 상태로 보내는 서버 푸시는 없다. 진짜 백그라운드 알림이 필요하면 Web Push 서버(VAPID) 연동이 필요하다.
- 캐시 버전을 `eagles-lounge-v16`, CSS/JS 참조와 JSON fetch 버전을 `?v=15`로 올렸다.

### GitHub 연동 시 사용자가 직접 해야 하는 것

- 원격 저장소 생성 후 `git push`.
- GitHub → Settings → Pages → Source를 "GitHub Actions"로 설정.
- Settings → Actions → General → Workflow permissions를 "Read and write"로 둔다(기본값일 수 있음).

## Memo Persistence Handoff (Phase 3)

- 메모(커뮤니티) 글을 `localStorage.eaglesNotes`에 영속화했다. 새로고침해도 유지된다.
- 초기 `data/posts.json` 시드 위에 사용자 메모가 얹혀 렌더된다.
- 각 사용자 메모에 `id`를 부여하고 `삭제` 버튼을 추가했다(시드 메모에는 삭제 버튼 없음).
- 사용자 입력은 `escapeHtml`로 이스케이프해서 저장·렌더한다(stored XSS 방지).

## Updater Bugfix Handoff

- `scripts/update-data.mjs`의 `parseScoreboard`에서 경기 전 빈 점수("")가 `Number("")===0` 때문에 `0:0`으로 잘못 들어가던 버그를 고쳤다(빈 값/비숫자는 `null`).
  - 증상: 시작 전인 오늘 경기가 "무 0:0 결과" / 라이브 "경기 결과 0:0"으로 표시됨.
  - 수정 후: 시작 전 경기는 `upcoming`("경기전"), 라이브는 "경기 예정/스코어 대기"로 표시.
- 알려진 한계: KBO 일정 페이지(`DailySchedule.aspx`)는 현재 달만 반환한다(POST/`__VIEWSTATE` 기반이라 쿼리로 다음 달 조회 불가). 그래서 매월 말일에는 예정 경기가 거의 0이 될 수 있고, 다음 달 1일 자동갱신부터 정상 복구된다.

## 검증 기록

- 2026-05-30 19:25 KST: `python3 -m http.server 4173`로 로컬 서버 실행 후 브라우저 검증.
  - 페이지 제목/히어로 문구 렌더링 확인.
  - 경기 카드 4개, 선수 카드 4개, 커뮤니티 글 3개 초기 렌더링 확인.
  - 선수 필터에서 투수 1명으로 필터링되는 것 확인.
  - 응원글 등록 시 피드 최상단에 새 글이 추가되는 것 확인.
  - 브라우저 콘솔 에러 없음.
- 2026-05-30 19:32 KST: Phase 2 데이터 분리 후 재검증.
  - `data/*.json` 5개 파일 모두 `python3 -m json.tool` 통과.
  - 로컬 서버에서 JSON fetch와 초기 렌더링 확인.
  - 팀 요약 값 `5위`, `0.279`, `52`, `W3` 렌더링 확인.
  - 경기 전체 4개, 예정 경기 필터 2개, 선수 전체 4개, 투수 필터 1개 확인.
  - 응원글 등록 동작 확인.
  - 브라우저 콘솔 에러 없음.
- 2026-05-30 KST: Phase 4 검토 및 데이터 스냅샷 갱신.
  - KBO 공식 팀 순위/일정/팀 타자/선수 타자/선수 투수 페이지 확인.
  - 한화 공식 사이트와 MyKBO Stats를 보조 출처 후보로 비교.
  - `data/meta.json`, `data/summary.json`, `data/games.json`, `data/players.json` 갱신.
  - `data/*.json` 5개 파일 모두 `python3 -m json.tool` 통과.
  - `python3 -m http.server 4173` 실행 후 `index.html`, `data/summary.json`, `data/games.json` HTTP 응답 확인.
- 2026-05-30 KST: 메인 대시보드 재구성 후 검증.
  - `data/live-game.json`, `data/player-rankings.json` 문법 통과.
  - 로컬 서버에서 실시간 경기판, 히어로 랭킹 2개, 랭킹 카드 3개 렌더링 확인.
  - 경기 카드 5개, 선수 카드 4개 렌더링 확인.
  - 브라우저 콘솔 에러 없음.
- 2026-05-30 KST: Phase 5 PWA 앱화 후 검증.
  - `manifest.webmanifest` JSON 문법 통과.
  - `service-worker.js`, `script.js` Node 문법 검사 통과.
  - 로컬 서버에서 `manifest.webmanifest`, `service-worker.js`, `offline.html`, `assets/app-icon.svg` HTTP 200 응답 확인.
  - 브라우저에서 manifest/icon/theme-color/apple mobile meta 태그 확인.
  - 메인 대시보드 렌더링 및 브라우저 콘솔 에러 없음 확인.
- 2026-05-30 KST: Phase 6 데이터 자동 갱신 스크립트 검증.
  - `node --check scripts/update-data.mjs` 통과.
  - `node scripts/update-data.mjs` 실행 성공.
  - KBO 공식 페이지에서 JSON 스냅샷 갱신 확인.
  - 갱신 후 `data/*.json` 문법 검사 통과.
  - `npm run check` 통과.
  - `npm run serve` 후 브라우저에서 갱신된 데이터 기준시각, 팀 요약, 라이브 경기판, 경기 카드 5개, 선수 카드 4개, 랭킹 카드 3개 렌더링 확인.
  - 브라우저 콘솔 에러 없음.
- 2026-05-30 KST: 스코어보드 라인스코어 연동 후 검증.
  - KBO 스코어보드에서 오늘 한화 경기 `SSG 10:13 한화` 결과와 1~9회 점수 추출 확인.
  - `data/live-game.json`에 경기 결과/최종 상태/라인스코어 반영 확인.
  - 05.31 예정 경기에 05.30 점수가 잘못 병합되지 않도록 날짜 조건 추가.
  - 브라우저에서 갱신 화면 확인 및 콘솔 에러 없음.
- 2026-05-31 KST: 굿즈 바로가기 링크 추가 후 검증.
  - `npm run check` 통과.
  - 스파이더 한화이글스 공식몰 링크 HTTP 200 확인.
  - 형지 이글스 레플리카샵 링크 GET 200 확인.
  - 브라우저에서 `스파이더 한화이글스`, `형지 한화이글스샵` 링크가 보이고 `target="_blank"`/`rel="noopener"`가 적용된 것 확인.
  - 브라우저 콘솔 에러 없음.
- 2026-05-31 KST: 스코어보드 압축 레이아웃 검증.
  - `npm run check` 통과.
  - 브라우저에서 `.line-score table` 렌더링 확인.
  - 기존 카드형 `.line-score > span` 0개 확인.
  - 이닝 헤더 `팀, 1~9, R`와 원정/홈 2행 셀 33개 확인.
  - 페이지 전체 가로 오버플로우 없음 및 브라우저 콘솔 에러 없음.
- 2026-05-31 KST: 라이브 우선 화면/알림 기능 검증.
  - `npm run check` 통과.
  - 브라우저에서 CSS `./styles.css?v=4`, JS `./script.js?v=4` 로드 확인.
  - 히어로 영역 DOM 순서가 `hero-dashboard` 다음 `hero-content`인 것 확인.
  - 화면 최상단에서 실시간 패널이 안내 문구보다 위에 배치된 것 확인.
  - 현재 브라우저 권한 상태에서는 알림 버튼이 `알림 차단됨`으로 표시되는 것 확인.
  - 페이지 전체 가로 오버플로우 없음 및 브라우저 콘솔 에러 없음.
- 2026-05-31 KST: 경기별 티켓팅 정보/티켓 알림 UI 검증.
  - `npm run check` 통과.
  - `data/games.json` 문법 통과.
  - 한화 티켓링크, SSG 티켓, NC 다이노스 예매처 링크 HTTP 200 확인.
  - 브라우저에서 CSS `./styles.css?v=5`, JS `./script.js?v=5` 로드 확인.
  - 대표 경기 포함 `.ticket-strip` 5개 렌더링 확인.
  - 예정 경기의 `티켓 알림` 버튼 활성화, 지난 경기의 `종료` 버튼 비활성화 확인.
  - 페이지 전체 가로 오버플로우 없음 및 브라우저 콘솔 에러 없음.
- 2026-05-31 KST: 예정 경기 10개/티켓 알림 저장 검증.
  - `npm run check` 통과.
  - `data/games.json` 문법 통과, 총 13경기 중 예정 10경기 확인.
  - 브라우저에서 CSS `./styles.css?v=7`, JS `./script.js?v=7` 로드 확인.
  - `예정` 필터 클릭 후 경기 카드 10개 렌더링 확인.
  - 첫 예정 경기 티켓 알림 버튼이 `알림 설정됨`으로 바뀌고 토스트가 표시되는 것 확인.
  - 페이지 전체 가로 오버플로우 없음 및 브라우저 콘솔 에러 없음.
- 2026-05-31 KST: 예매 오픈 시각/10분 전 티켓 알림 검증.
  - `npm run check` 통과.
  - `data/games.json` 문법 통과.
  - 브라우저에서 CSS `./styles.css?v=9`, JS `./script.js?v=9` 로드 확인.
  - `예정` 필터 클릭 후 경기 카드 10개 렌더링 확인.
  - 예정 경기 카드에 `예매 오픈` 시각과 `알림 ... (10분 전)` 문구가 표시되는 것 확인.
  - 아직 알림 가능 시간이 남은 경기에는 `10분 전 알림`, 이미 오픈된 경기는 `오픈됨`으로 표시되는 것 확인.
  - `10분 전 알림` 클릭 후 버튼이 `알림 설정됨`으로 바뀌고 저장 완료 토스트가 표시되는 것 확인.
  - 페이지 전체 가로 오버플로우 없음 및 브라우저 콘솔 에러 없음.
- 2026-05-31 KST: 스코어보드 간격/배지 UI 검증.
  - `npm run check` 통과.
  - `data/live-game.json`, `data/games.json` 문법 통과.
  - 브라우저에서 CSS `./styles.css?v=10`, JS `./script.js?v=10` 로드 확인.
  - 라이브 스코어보드에 팀 배지 2개와 대표 경기 카드 배지 2개가 렌더링되는 것 확인.
  - 좁은 화면에서 라이브 스코어보드가 팀 카드/상태/팀 카드 세로 배치로 정렬되는 것 확인.
  - 라인스코어 테이블, 경기 카드, 티켓 카드에 가로 오버플로우가 없는 것 확인.
  - 브라우저 콘솔 에러 없음.
- 2026-05-31 KST: 탭 기반 화면 분리 검증.
  - `npm run check` 통과.
  - `data/live-game.json`, `data/games.json` 문법 통과.
  - 브라우저에서 CSS `./styles.css?v=11`, JS `./script.js?v=11` 로드 확인.
  - `실시간` 탭에서는 라이브 보드와 팀 요약만 보이는 것 확인.
  - `경기`, `랭킹`, `선수`, `커뮤니티` 탭 클릭 시 해당 패널만 보이는 것 확인.
  - 선수 카드 4개, 커뮤니티 글 3개, 랭킹 카드 3개, 경기 카드 13개 렌더링 확인.
  - hash 전환과 탭 active 상태 동기화 확인.
  - 페이지 전체 가로 오버플로우 없음 및 브라우저 콘솔 에러 없음.
- 2026-05-31 KST: 개인용 앱 브랜딩 변경 검증.
  - `npm run check` 통과.
  - `manifest.webmanifest`, `data/posts.json` 문법 통과.
  - 브라우저에서 CSS `./styles.css?v=12`, JS `./script.js?v=12` 로드 확인.
  - 문서 제목, Apple 앱 제목, 상단 브랜드, 히어로 제목이 `내가 쓰려고 만든 한화이글스 앱` 컨셉으로 바뀐 것 확인.
  - 탭 라벨이 `커뮤니티` 대신 `메모`로 표시되는 것 확인.
  - 메모 탭에서 `내 한화 메모장`, `내 메모`, 개인 메모 초기 데이터가 렌더링되는 것 확인.
  - 페이지 전체 가로 오버플로우 없음 및 브라우저 콘솔 에러 없음.
- 2026-05-31 KST: 랭킹 탭 KBO 전체 순위 추가 검증.
  - `npm run check` 통과.
  - `data/team-standings.json` 문법 통과.
  - 브라우저에서 CSS `./styles.css?v=13`, JS `./script.js?v=13` 로드 확인.
  - 랭킹 탭에서 `전체 팀 순위`가 먼저 나오고, 그 아래에 `한화 선수 순위` 카드가 나오는 것 확인.
  - KBO 팀 순위 10개 행 렌더링 확인.
  - 한화 5위 행이 강조 표시되는 것 확인.
  - 페이지 전체 가로 오버플로우 없음 및 브라우저 콘솔 에러 없음.
- 2026-05-31 KST: 민섭이 브랜딩/티켓팅 탭 분리 검증.
  - `npm run check` 통과.
  - `manifest.webmanifest`, `data/posts.json`, `data/games.json` 문법 통과.
  - 브라우저에서 CSS `./styles.css?v=14`, JS `./script.js?v=14` 로드 확인.
  - 문서 제목, Apple 앱 제목, 상단 브랜드, 히어로 문구가 `민섭이` 개인용 앱 컨셉으로 바뀐 것 확인.
  - 상단 탭에 `티켓팅`이 추가된 것 확인.
  - `경기` 탭에서 필터/예정 경기/티켓 카드가 사라지고 최근 결과 3개만 보이는 것 확인.
  - `티켓팅` 탭에서 예정 경기 10개와 예매 오픈/10분 전 알림 정보가 보이는 것 확인.
  - 페이지 전체 가로 오버플로우 없음 및 브라우저 콘솔 에러 없음.
- 2026-05-31 KST: 자동갱신 자동화/폴링/메모 영속화 검증.
  - `npm run check` 통과 (script.js / service-worker.js / update-data.mjs).
  - node:vm으로 실제 `script.js`를 로드한 검증 하니스 18/18 통과: escapeHtml, 초기 렌더(피드/메타/라이브/순위/선수/경기), 메모 localStorage 저장·삭제·재로드 복원, XSS 이스케이프, pollData 변경감지(동일 시 meta만 재요청, 변경 시 전체 재로드).
  - 로컬 서버에서 `index.html` 200, `?v=15` CSS/JS 참조, `data/*.json` 8개 200, service worker `eagles-lounge-v16` 확인.
  - `node scripts/update-data.mjs` 실제 KBO 수집 성공, `data/*.json` 8개 문법 통과. 한화 5위(26승25패)·타율 0.282·홈런 60·W3 확인.
  - 워크플로우 YAML 2개 추가(update-data, deploy-pages). 로컬에 yq/PyYAML 부재로 최종 YAML 검증은 push 시 GitHub 검증에 의존.
- 2026-05-31 KST: 스코어보드 pre-game 0:0 버그 수정 검증.
  - 수정 후 재실행: 05.31 경기가 `upcoming`("경기전")으로 분류, recent 3 / upcoming 1.
  - live-game이 "경기 예정 · 스코어 대기 · None:None"으로 표시되는 것 확인.
  - `data/*.json` 문법 통과.

## 세션 핸드오프 (2026-05-31)

- 이번 세션에서 Phase 3(메모 영속화)와 Phase 7(자동갱신 자동화/배포/폴링)을 구현·검증 완료했다.
- 스코어보드 경기 전 0:0 오표시 버그도 수정했다(`parseScoreboard` 빈 점수 → null).
- 앱을 개인 멀티 프로젝트 repo `Minsubs/minsubsong` 안의 `hanwha/` 하위 디렉토리로 통합해 `main`에 직접 push했다(`ticketlink-macro/`와 나란히).
  - GitHub Actions 워크플로우는 repo 루트 `.github/workflows/`에 있고 경로를 `hanwha/`로 맞췄다(`update-data.yml`, `deploy-pages.yml`).
  - GitHub Pages는 `hanwha/`를 사이트 루트로 배포하므로 URL은 `https://minsubs.github.io/minsubsong/`이다.
  - 하위 경로 배포에 맞춰 `service-worker.js`의 알림 클릭 base를 `self.location.origin` → `self.registration.scope`로 고쳤다.
- 처음 1회 GitHub 설정(직접): Settings → Pages → Source = GitHub Actions, Settings → Actions → General → Workflow permissions = Read and write.
  - 설정 후 Actions 탭에서 `Deploy hanwha app to GitHub Pages` 성공 확인, `Update KBO data (hanwha)`는 Run workflow로 1회 수동 검증 권장.
- 로컬 작업 폴더는 `/Users/minsub/Documents/minsubsong`(hanwha/ 포함). 초기 작업에 쓰던 `/Users/minsub/Documents/한화` standalone 폴더는 이제 사용하지 않아도 된다.
- 남은 개선 후보(선택): 월말 예정 경기 공백 해소를 위한 다음 달 일정 수집(POST/`__VIEWSTATE` 필요), 실제 브라우저(설치형 PWA)에서 알림/Periodic Sync 동작 확인.

## 세션 핸드오프 (2026-06-03)

- 현재 작업 루트는 `/Users/minsub/Documents/한화`이고, 원격 기준 앱 파일은 `hanwha/` 하위 디렉토리에 있다.
- Git 상태 확인 결과 `main` 브랜치가 `origin/main`을 추적하며 HEAD는 둘 다 `604cb3e`였다.
- 원격 `hanwha/service-worker.js`에는 GitHub Pages 하위 경로 대응 수정이 이미 반영되어 있다.
  - 알림 클릭 URL base: `self.registration.scope`
- `hanwha` 디렉토리에서 `npm run check` 실행 완료.
  - `script.js`, `service-worker.js`, `scripts/update-data.mjs` 문법 체크 통과.
- 루트에 untracked 항목이 남아 있다.
  - `.claude/`
  - `data/`
  - 원격 앱 기준 파일은 `hanwha/` 아래이므로 이번 세션에서는 건드리지 않았다.
- 사용자가 요청한 `lazycodex` 설치를 진행했다.
  - 실행 명령: `npx lazycodex-ai install --no-tui --codex-autonomous`
  - 설치 패키지: `lazycodex-ai@4.7.5`
  - Codex 플러그인: `omo@sisyphuslabs` enabled 상태로 `/Users/minsub/.codex/config.toml`에 반영됨.
  - 생성/등록된 주요 에이전트: `explorer`, `librarian`, `metis`, `momus`, `plan`, `codex-ultrawork-reviewer`
  - 현재 세션에서는 일부 multi-agent 도구와 역할이 보이지만, `session_start` 훅과 플러그인 전체 로드는 새 Codex 세션 시작 후가 더 안정적이다.
- 새 세션 시작 권장 절차:
  1. `/Users/minsub/Documents/한화/AGENTS.md` 확인.
  2. `/Users/minsub/Documents/한화/hanwha/PROGRESS.md`의 이 섹션부터 확인.
  3. `git status --short --branch`로 루트 untracked 항목을 확인하되, 앱 작업은 기본적으로 `hanwha/` 기준으로 진행.
  4. 필요한 경우 `hanwha`에서 `npm run check` 후 개발 서버 `python3 -m http.server 4173` 실행.

## Next-Month Schedule & PWA QA Handoff (2026-06-03)

- 월말 예정 경기 공백 해소를 구현했다.
  - 새 모듈: `scripts/kbo-schedule-api.mjs`
  - KBO 공식 국문 일정 API(`/ws/Schedule.asmx/GetScheduleList`)를 form POST로 호출한다.
  - 현재 달과 다음 달 한화 경기(`teamId=HH`)를 함께 수집하고 중복 제거 후 `games.json`/`live-game.json` 생성에 사용한다.
  - `data/cache/raw/schedule-YYYY-MM.json` 원본 JSON을 저장한다(`data/cache/`는 git 제외).
- 테스트 인프라를 추가했다.
  - `npm test`: `node --test tests/*.test.mjs`
  - `npm run check`: 문법 체크 + 테스트 실행
  - 일정 파싱/다음 달 병합/중복 제거 테스트 3개
  - PWA 서비스워커 등록/Periodic Sync/알림 클릭 scope 회귀 테스트 2개
- 실제 데이터 갱신을 실행했다.
  - `npm run update:data`
  - 기준 시각: `2026-06-03 15:00 KST`
  - 결과: `games.json`은 최근 1경기 + 예정 10경기, 예정 경기는 06.03~06.13까지 노출
- 브라우저/HTTP QA를 수행했다.
  - 로컬 서버: `python3 -m http.server 4173`
  - 브라우저 DOM QA: 실시간 탭이 2026-06-03 데이터로 렌더링되고, 티켓팅 탭에 예정 경기 10개와 예매 오픈/10분 전 알림 정보가 표시됨.
  - QA artifacts:
    - `artifacts/qa-live-dom.txt`
    - `artifacts/qa-ticketing-dom.txt`
    - `artifacts/qa-games-http.txt`
    - `artifacts/qa-service-worker-http.txt`
    - `artifacts/qa-manifest-http.txt`
  - 스크린샷 캡처는 Browser CDP `Page.captureScreenshot` 타임아웃으로 실패했지만, DOM snapshot과 HTTP response artifact는 남겼다.
- 검증 명령:
  - `node --test tests/kbo-schedule-api.test.mjs` RED: `ERR_MODULE_NOT_FOUND` 확인 후 구현
  - `npm test` GREEN: 5/5 통과
  - `npm run check` GREEN
  - `npm run update:data` 성공
  - `curl -i /data/games.json`: HTTP 200, 예정 10경기 확인
  - `curl -i /service-worker.js`: HTTP 200, `self.registration.scope`, `periodicsync`, `refresh-data` 확인
  - `curl -i /manifest.webmanifest`: HTTP 200, 민섭이 브랜딩과 icon 확인
