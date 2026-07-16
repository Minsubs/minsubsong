# KBO 티켓팅 도우미 Handoff

## 2026-07-16 미구현 백로그 전체 구현 — LV2 delayed + LV1b + 예매 데이터 교정 + X0 프로비저닝 진행 (로컬, 미커밋·미배포)

- **선결 실측 해소**: 후반기 재개일(7/16) 라이브 스코어보드를 20:06~20:40 KST 실측 — 진행중 state 는 **`"TOP n"` / `"BOT n"`** 형식으로 확정(올스타 브레이크로 막혔던 `delayed` 선결). 원문 스냅샷 3장: `.omo/evidence/live-scoreboard-20260716/`.
- **LV2 `delayed` 구현(워커)**: `livePhaseOf` TOP/BOT 명시 인식 + 2경로 판정 — **delayed-A(시작 지연)**: 블록 잔존+pre 상태로 시작예정+20분 경과(취소는 블록이 사라진다는 실측이 근거) / **delayed-B(진행 중단)**: state·점수 45분 동결(`live_state.last_change_at` 컬럼 신설, 스키마·db.js 동반). 경기당 1회 캡(`live:<key>:delayed`, A/B 합산), 재개 알림은 백로그(DL5). urgency high. FINAL 후 점수 정정이 득점으로 오발화되던 경로에 가드 추가(워커·클라 동일 클래스). 워커 테스트 116→**124/124**.
- **LV1b 구현(클라)**: 45초 폴링(`/api/live`, `PUSH_API_BASE` 미설정 시 완전 비활성 게이트 — 현재 상태), `applyLiveScoreboard` 병합(live-game.json 스냅샷이 비어도 폴링만으로 홈 라이브 표시), `formatInningLabel`("TOP 5"→"5회 초", 렌더 시점 적용), 마이팀 diff 로컬 알림+토스트(콜드스타트 가드·once-per-key·끝내기 score+end 동시 전이 처리 — 리뷰 CONFIRMED 1건 수정). **알림센터 `game_live`·`weekly_brief` 토글 신설(기본 OFF)** — 워커 F4/F2 토픽에 클라 구독 표면이 없어 수신자가 0명이던 갭 해소. 캐시 v35→**v36**. 앱 테스트 107→**118/118**.
- **예매 데이터 교정(5구단 공식 근거 조사)**: 한화 D-7 11:00 **verified**(공식 입장권 안내 id=1829) · 롯데 D-14 14:00 **verified**(pcode=339 — 실제 규칙은 '시리즈 2주 전 수/금 14시'라 경기별 D-12~16 변동, 주석 반영) · **NC D-7→D-6 11:00 교정**(공식 2023·24 공지 동일 문구, 2026 1차 재확인 필요라 needs-review 유지) · **두산 예매처 NOL(야놀자) `nol.yanolja.com/ticket` 전환**(2026-07-24 홈경기부터, 공식 공지 140; 베어스클럽 라벨은 '일반 1시간 전' 상대규칙으로 정정) · 삼성 미확정(멤버십 상대규칙만 공식 확인 — 공식 페이스북 이미지·멤버십 약관 PDF 직접 열람 필요). `rebuild:ticketing` 재생성(calendar 204건). 네트워크 감사에 **TLS 체인 불완전(doosanbears.com 중간 인증서 누락) → 실패가 아닌 수동확인 경고** 분류 신설. strict 감사 잔여 3건: NC·두산·삼성.
- **X0 워커 실배포 완료(2026-07-16 밤)**: 사용자 `wrangler login` + 이메일 인증 → D1 `kbo-tido` 생성·연결(`65cfc8c5-…`) → workers.dev 서브도메인 `minsubs` 등록(사용자 승인, API PUT) → `provision.sh` 완주(VAPID 키쌍 → deploy → `VAPID_PRIVATE` secret → D1 스키마 5테이블, `last_change_at` 포함). **Worker URL: `https://kbo-tido-push.minsubs.workers.dev`**. 경과 중 수정 2건: ①`provision.sh`의 wrangler 4.x `d1 info` 플레이스홀더 해석 버그 → `d1 list --json` 조회로 교체 ②이메일 미인증(10034)·서브도메인 미등록 2회 차단 모두 VAPID 롤백 트랩 정상 작동(고아 키 없음).
- **클라 언락 완료**: `script.js`에 `VAPID_PUBLIC_KEY`/`PUSH_API_BASE` 주입(캐시 v36 유지 — v36은 미배포 상태라 추가 bump 불필요). `/api/live` 실검증: 경기 중 실데이터 200(BOT 8 등 5경기, 25s 엣지캐시), CORS는 프로덕션 origin만 허용(로컬 403 = 설계대로). 로컬 브라우저에서 실페이로드 주입으로 병합·렌더 전 경로 검증 — 빈 live-game.json 스냅샷에서도 5경기 라이브 표시, 이닝 한글 라벨("8회 말"), 히어로 "진행 중" 배지, 콘솔 오류 0. visibility 게이트(hidden 시 폴링 차단)도 실동작 확인.
- **남은 것**: ①실기기 푸시 검증(데스크톱 Chrome + iOS 설치 PWA에서 알림센터 토글 ON → 앱 닫고 수신 확인 — Pages 프론트 배포 후 가능) ②D8 법률·처리방침 검토 전 실사용자 발송 금지 유지 ③커밋·Pages 배포는 사용자 지시 대기.

### 같은 날 심야 추가 배치 — "모두 진행" 지시분 (본 커밋으로 main→Pages 배포)

- **예매 규칙 감사: strict 잔여 5→1건**. 삼성 **verified**(티켓링크 삼성 전용관 `sports/137/57` 판매목록 대조 — 시리즈 단위 화요일 11:00 일괄 오픈, 시리즈 첫 경기 기준 D-7 11:00; 2026 공지로 취소마감 4시간 전·계정당 6매 확인, URL도 전용관으로 교체). 두산 **verified**(NOL 두산 전용관 임베드 판매 데이터: 7/24 경기 `bookingOpenTime 2026-07-17 11:00` = D-7 11:00, 8/11까지 10경기 동일). **키움도 NOL(야놀자) 전환 확정** — NOL 통합은 구 인터파크 플랫폼 전체 적용(KBO 내 인터파크 구단 = 두산·키움 2곳 모두), 키움은 이미 NOL에서 판매 중(7.21 경기 오픈 7/14 14:00 = 기존 D-7 14:00 규칙 유지 재확인). 두산·키움 URL을 NOL 전용관 딥링크(`genre/sports/bears`/`heroes`)로 교체 — **설정에서 구 인터파크 URL 완전 소멸**(테스트 핀 갱신). **잔여 1건 = NC**(2026 고유 1차 공지 미확보 — 조사 에이전트가 세션 리밋으로 중단. 힌트: 2025 연간 티켓 안내는 seq=541756로 존재 확인 → 다음 세션에서 2026 대응 공지 seq 탐색 권장).
- **D8 패키지**: `docs/PRIVACY_POLICY_DRAFT_2026-07.md`(처리방침 초안 §A + 컴플라이언스 체크 §B 10항 — 9항 충족) + 앱 내 `privacy.html`(offline.html 패턴, 다크/라이트 실측, 더보기 링크, SW 캐시 등재) 신설. **미확정 3곳: §9 운영자 표기·문의 이메일, §10 시행일 — `<mark>` 표시 상태로 배포됨. 조속히 확정해 교체 필요.** 사용자 지시("머지 배포까지 진행")로 D8 완결 전 배포를 진행함 — 알림은 전 카테고리 기본 OFF opt-in이므로 실발송은 사용자가 직접 켠 경우에만 발생.
- **워커 크론 실전 무오류**: 배포 직후 라이브 창에서 `wrangler tail` 10분 감시 — 오류 이벤트 0건(F4 라이브 모니터 포함).
- **득점 오탐 가드**(리뷰 plausible 후속): FINAL 후 점수 정정이 득점 알림으로 오발화되는 경로를 워커(`curPhase === "live"` 한정)·클라(`prev.status === "live"` 한정, 끝내기 live→final은 통과) 양쪽에 차단 + 회귀 테스트.
- **브랜드 개명 후보(결정 대기)**: 4렌즈 39후보 생성 + 기존 서비스 충돌 웹 스크리닝 완료. Top3 = **선구안**(GOOD EYE, 워드플레이+검색 고유성) · **워닝트랙**(오픈 임박 경고 은유 정조준) · **티났다**(티오 났다×티 나다 밈 감성). 탈락: 풀카운트·승요(동일 분야 동명 앱 존재). 확정 시 KIPRIS 상표 검색 선행.
- 최종 검증: 앱 **125/125**(privacy 7건 포함) · 워커 **124/124** · strict 감사 잔여 NC 1건 · 네트워크 감사 신규 URL 전부 200(두산 공지만 TLS 체인 경고 분류).
- 검증: 앱 **118/118** · 워커 **124/124** · 네트워크 감사 전 URL 200(두산 공지만 TLS 경고) · 브라우저 실검증(콘솔 오류 0, 알림센터 6토픽 기본 OFF, NC 카드 D-6 오픈 07.22 11:00, 두산 카드 NOL 링크, 폴링 게이트 inert 확인). 구현은 opus 2트랙 병렬 + 트랙별 적대적 리뷰(워크플로우 `wf_3ee0a524-917`, 에이전트 10개).

## 2026-07-14 분기 예매 규칙 감사 루틴 구현 (로컬, 미배포)

- 예매 운영 설정의 단일 원본을 `scripts/ticket-provider-config.mjs`로 분리했다. 예매처와 오픈 규칙은 각각 공식 URL·최종 확인일·검증 상태를 기록하며, 감사 메타는 public `data/*.json`에 노출하지 않는다.
- `scripts/audit-ticket-providers.mjs`와 분기 GitHub Actions(`audit-ticket-providers.yml`, 1/4/7/10월 1일 09:00 KST)를 추가했다. 기본 스키마 검사는 10구단 누락·잘못된 URL/시각·근거 메타를 검사하고, `--strict`는 92일 초과 또는 `needs-review`를 실패 처리한다. `--network`는 공식 URL을 읽기 전용으로 확인하며 자동 수정·콘텐츠 스크래핑은 하지 않는다.
- SSG 공식 현재 판매 목록에서 홈경기가 **D-4 11:00**에 열리는 것을 확인해 기존 D-5를 교정했다. `npm run rebuild:ticketing`으로 현재 `games.json`/`ticketing-calendar.json`을 재생성했다.
- `npm run check` **107/107** 통과. URL 네트워크 감사도 고유 공식 URL **17/17 HTTP 200**(한화 홈페이지 정상 리디렉션 포함)이다. 390px 로컬 브라우저에서 SSG 7/19 경기의 `예매 오픈 07.15 11:00`(D-4)·공식 링크를 확인했고 경고/오류는 0건이다. 엄격 감사는 공식 오픈 규칙 1차 근거가 아직 없는 **한화·NC·두산·롯데·삼성 5구단** 때문에 의도적으로 실패한다. 이 5건이 다음 데이터 작업이다.
- 이 변경은 이전 cold-start 변경과 함께 아직 커밋·push·Pages 배포하지 않았다. `.omo/` 기존 산출물은 건드리지 않았다.

## 2026-07-14 cold start — 예매 데이터 잔여 정리 (로컬, 미배포)

- NC 홈경기는 티켓링크 병행이 아니라 **NC 다이노스 자체 앱/홈페이지 예매**가 현재 기준이다. 기존 `NC 다이노스`/`https://www.ncdinos.com/` 매핑을 유지했다([NC 공식 앱](https://apps.apple.com/kr/app/nc-dinos/id1495745743), [자체 통합 플랫폼 안내](https://about.ncsoft.com/news/article/ncdinos-news-20220316)).
- KT 일반회원 예매는 구단의 2026년 7월 공식 안내 기준 **경기 7일 전 16:00**이다([kt wiz 공식 공지](https://www.ktwiz.co.kr/media/wiznews/201267)). `scripts/update-data.mjs`와 현재 `games.json`/`ticketing-calendar.json`의 KT `openTime`·`openAt`을 11:00→16:00으로 고쳤다.
- 예매처 URL의 유일한 브라우저 데이터 소스를 생성 JSON의 `game.ticketing`으로 정리했다. 현재 운영 설정의 코드 단일 원본은 후속 작업에서 `scripts/ticket-provider-config.mjs`로 분리됐다. 브라우저 `script.js`는 메타가 누락되면 KBO 일정 링크로 fail-closed 하며 임의 오픈시각을 만들지 않는다. 취소표 대기 서비스 분류만 팀별 UI 메타로 남겼다.
- 앱 셸은 캐시 **v35**로 올렸다. `npm run check` **100/100**, 390px 로컬 브라우저에서 KT 16:00 표시·NC 자체 예매 링크 6개·`eagles-lounge-v35` 설치·오프라인 재로딩·콘솔/페이지 오류 0을 확인했다. 이 변경은 아직 커밋·push·Pages 배포하지 않았다.
- 분기 감사 루틴은 후속 작업에서 구현됐다. 남은 데이터 작업은 한화·NC·두산·롯데·삼성의 2026 공식 오픈 규칙 근거 확보다. X0 Worker 배포는 여전히 Wrangler 인증과 사용자 승인 대기이며, LV2 `delayed` 실측은 7월 16일 경기 재개 이후다.

## 2026-07-12 Wave 2 배포 완료

- 기존 디자인을 유지하면서 상단 브랜드/마이팀 선택기/경기장 날씨만 부분 개편했다. 신규 사용자는 `KBO 전체` 중립 상태이며, 저장된 유효 구단은 그대로 복원된다.
- 중립 1종과 10구단별 PWA 아이콘·매니페스트를 완성했다. 성인 20~30대 여성 팬을 위한 프리미엄 티켓 스티커/스포츠 굿즈 방향이며, 공식 구단 마크 복제나 성별 고정관념은 사용하지 않는다.
- 마이팀 선택 즉시 manifest와 Apple touch icon이 바뀐다. 이미 홈 화면에 설치한 iOS 앱 아이콘은 자동 교체되지 않아 삭제 후 재설치 안내를 표시한다.
- 경기장별 날씨는 Open-Meteo 기반이며 로딩·오류·오래된 캐시·경기 없음 상태와 오프라인 폴백을 포함한다. 앱 캐시는 **v34**, 앱 검증은 **99/99 통과**했다.
- 프론트는 커밋 `945100e`로 [GitHub Pages](https://minsubs.github.io/minsubsong/)에 배포했다([Actions run 29176947950](https://github.com/Minsubs/minsubsong/actions/runs/29176947950)). Cloudflare Worker는 인증되지 않아 미배포다. 코드에 `SEND_ENABLED` 변수는 없으며, 현재 실사용자 발송 잠금은 빈 Worker 연동값과 미배포 상태로 유지한다. 법률·처리방침 검토 전 실사용자 발송은 금지한다.

## 2026-07-10 X0 백엔드 + UI 전면 리프레시 + 워커 알림기능 배치 (본 커밋으로 `main`→Pages 배포)

- **X0 사용자 결정 확정**: D3=Cloudflare Workers+D1+Cron 채택 · D7=VAPID 개인키는 `wrangler secret`로만 주입 · D8=발송 전 법률·처리방침 검토 게이트 유지(검토 자체는 아직 미실행, 원칙만 확정).
- **X0 차단 버그 수정**: `worker/wrangler.toml`의 `ALLOWED_ORIGIN`/`DATA_BASE_URL`이 오타 도메인 `minsub.github.io`를 가리키고 있어 CORS·데이터 fetch가 배포돼도 전부 실패했을 상태 — 실측(`curl` HTTP 200)으로 확인한 `minsubs.github.io` / `minsubs.github.io/minsubsong`로 교체. `VAPID_SUBJECT`도 동일하게 실서비스 URL로 정정.
- **`worker/scripts/provision.sh` 신설**: `npx wrangler login` 1회 후 D1 생성 → VAPID 키쌍 생성 → `wrangler.toml` 패치 → `wrangler deploy` → `wrangler secret put VAPID_PRIVATE` → D1 스키마 적용까지 멱등 처리(재실행 안전). Opus 검증으로 실패 경로 3건 발견·패치: P1 키 유실 시 롤백 trap 누락, P2 `pipefail` 없이 중간 실패가 조용히 죽는 경로, P3 `wrangler secret list` 판정 오류. 사용 방법은 `worker/README.md` "최초 프로비저닝" 절.
- **X0 클라 결함 9건 확정·패치**(Opus 서브에이전트 전원 CONFIRMED, 패치 후 앱 테스트 **47/47**):
  - **C1(critical)** — 알림 토픽이 UI 팀명(`한화`)과 워커 표준 코드(`HH`)로 서로 달라 구독이 실질 무효였음 → `script.js`에 `TEAM_PUSH_CODE` 매핑 신설.
  - C2 — 알림 켜기만 있고 끄기 경로가 없던 결함 → `unsubscribeFromPush` + `toggleNotifications`로 온/오프 대칭화.
  - C3 — 토글·팀 변경·앱 시작 시 서버 구독 재동기화 누락 → 세 지점 모두 `subscribeToPush()` 재호출 추가(endpoint 회전 복구 포함).
  - C4 — SW `pushsubscriptionchange`가 재구독 후 백엔드 재등록을 하지 않던 결함 보강.
  - C5 — `PUSH_API_BASE` 기본값이 존재하지 않는 `kbo-tido.app`이던 것을 실배포 예정 URL 기준으로 정정.
  - C6 — 팀 변경 시 `team_interest` 로컬 키가 소실되던 결함 수정.
  - 캐시 트리아드 v31 → v32(X0 패치) → **v33(UI 리프레시 포함, 본 배포)**.
- **메뉴 중복 버그 수정**: `index.html`의 데드 `<nav class="nav">`(최초 커밋부터 존재, 데스크톱에서 `.view-tabs`와 중복 표시)를 제거. DOM 실측으로 중복 소멸 확인.
- **푸터 카피 정정**: "JSON 스냅샷"/"MVP용 정적 데이터" 계열 문구를 "KBO 공식 홈페이지 데이터를 자동 수집해 반영합니다"로 통일 — `data/meta.json` note, `scripts/update-data.mjs`, `index.html` 폴백 문구 3곳 동시 반영.
- **문서 드리프트 정정**: `docs/BACKEND_PUSH_PLAN.md`의 "플랜 문서 — 미구현"·"`push` 핸들러 없음" 서술과 §6 매핑 표를 현재 상태(코드 구현 완료·배포·실기기 검증은 미실행)로 상태 주석 정정. `worker/README.md` "게이트 2(배포)" 절에 `provision.sh` 상호참조 추가.
- **신규 설계 문서**: [`docs/LIVE_ALERTS_DESIGN_2026-07.md`](docs/LIVE_ALERTS_DESIGN_2026-07.md) — 라이브 스코어 실시간화(홈 패널 몇 회·몇 대 몇) + 마이팀 시작/득점/종료/우천취소/우천지연 알림. LV0(소스 PoC) → LV1(홈 실시간화+앱 열림 알림) → LV2(앱 닫힘 푸시, ROADMAP X4를 흡수) 3단계. 미해결 결정 DL1~DL5(득점 알림 범위·quiet-hour 예외·폴링 주기·착수 순서·우천지연 포함 여부).
- **LV1a 완료**: `worker/lib/scoreboard.js`(순수 파서) + `GET /api/live`(엣지캐시 25초 + 원 소스 실패 시 stale 캐시 10분 폴백) + 단위테스트. `wrangler dev` 로컬 실측으로 캐시 HIT와 503 폴백 동작 확인.
- **워커 알림기능 배치 F1~F4 + T1/T2 완료**(워커 테스트 78 → **116/116**):
  - F1 동시오픈 묶음 발송(실측: 캘린더 204건 중 85.8%가 같은 분 정확 동시오픈 → 묶음이 상시 경로). F2 주간 예매 브리핑(`weekly_brief` 토픽, 일요일 KST 20:00, ISO주차 dedup, 청크 발송). F3 재편성(더블헤더) 발표 감지(`calendar_seen` diff, 콜드스타트 가드). F4 라이브 경기 알림(`game_live` 토픽 — start/score/end/**canceled**, 우천취소는 LV0 실측대로 "일정엔 있는데 스코어보드 미출현" diff + 2회 연속 확인, delayed는 진행중 표기 실측 후로 보류). T1 429 Retry-After 백오프, T2 DWP+레거시 병기 페이로드(2KB 보장).
  - 부수 발견·수정: 기존 `buildSentSet`이 캘린더에 없는 `game.id`를 조회해 once-per-key 캡이 틱 간 무효였던 버그를 `gameIdOf`(home+date+time)로 통일 수정.
- **UI 전면 리프레시(D1~D5+D7) 완료** — 앱 테스트 **47/47**, 캐시 v33:
  - D1 Pretendard Variable 전환(+SW `fonts-v1` 런타임 캐시). D2 v2 플랫 레터마크 뱃지(그라디언트/글로우 제거) — 레터 매핑 **한화 E·LG T·두산 D·키움 K·SSG L·KIA T·삼성 SL·롯데 G·KT KT·NC NC**(`TEAM_MASCOT_LETTER`). D3 데스크톱 1120px 그리드 + 홈 2컬럼 + 인라인 카운트다운("10시간 57분 45초", 24h+ 일 단위 승격). D4 테마 부팅 시 `prefers-color-scheme` 존중. D5 실물 티켓 히어로(본체+절취선+세로 스텁, 경기별 시드 바코드, 보딩패스 시리얼 `NO. 2026-0718-HRS-EAG-DJN` — `TEAM_SERIAL_CODE`/`STADIUM_SERIAL_CODE`), 경기장 실명(`STADIUM_NAME`: 대전 한화생명볼파크 등), "구장"→"경기장", 메타 2줄, 매치업 한글. D7 버튼 위계(예매처=filled primary / 알림=종 토글 / 캘린더·공유=ghost 아이콘). D-0 스탬프 겹침 수정.
  - ⚠️ 내부 코드(`TEAM_PUSH_CODE`)는 UI 문자열에 절대 노출 안 함(푸시 topic 등 시스템 표면 전용). 표시용 3글자 코드는 `TEAM_SERIAL_CODE`/`STADIUM_SERIAL_CODE` 별도.
- **X0 Cloudflare 실배포(사용자 액션 필요, 미실행)**:
  ```bash
  cd hanwha/worker && npx wrangler login && bash scripts/provision.sh
  ```
  후 출력 공개키/Worker URL로 `script.js` `VAPID_PUBLIC_KEY`/`PUSH_API_BASE` 교체 + 캐시 bump + 실기기 푸시 검증. **D8 법률·처리방침 검토 완료 전 실사용자 발송 금지.** (Pages 프론트 배포와 무관 — 워커는 별도 인프라.)
- 시장조사(`docs/MARKET_RESEARCH_2026-07.md` §10) 반영은 `docs/ROADMAP.md` §2/§1.2/§8에(X1 앵커 "포스트시즌(10월) 전", X5 신설 등).

## 2026-07-10 잔여 백로그
- ~~**LV2 우천지연(`delayed`)** — 스코어보드 진행중 표기가 올스타 브레이크로 실측 불가. **7/16 후반기 재개 후** 표기 확인하고 구현(F4에 자리만 주석).~~ → **완료(2026-07-16)** — 실측 후 2경로 구현, 위 2026-07-16 절 참조. 취소(`canceled`)는 이미 diff 방식으로 구현됨.
- **시장조사 잔여 데이터 확인(2026-07-14)**: NC 자체 앱/홈페이지 예매 유지, KT 일반예매 16시 교정, 예매 설정 코드 소스 `scripts/ticket-provider-config.mjs` 단일화, 분기 감사 루틴 구현. 엄격 감사 잔여는 한화·NC·두산·롯데·삼성 오픈 규칙 5건이다.

## 2026-07-04 R2~R8 배치 구현 + 긴급 데이터 수정 완료 (캐시 v31)

- `docs/BATCH_DESIGN_2026-07.md`의 R2~R8 전체를 구현·반영했다: R2 크론 위생(동일 내용 재작성 스킵) · R3 OG/매니페스트/오프라인 메타 · R4 공유 버튼+선예매 배지 · R5 캘린더 절충+.ics 내보내기 · R6 이벤트 미러링+오류 상태 표준화 · R7 캐시 트리아드 v30→v31(**메인 세션이 직접 적용**) · R8 문서 재기준선(본 배치).
- **긴급 데이터 수정**(`docs/MARKET_RESEARCH_2026-07.md` §10-2 근거): LG 예매처를 NOL 인터파크→**티켓링크**로 교체, 키움 오픈시각을 11:00→**14:00**으로 정정.
- 문서 재기준선(R8) 반영 범위: `docs/ROADMAP.md`(캐시 v31·라인수 실측·제거된 화면 절 신설·`more-subnav` 폐기 기록·N3/N5 상태 명기), `HANDOFF.md`/`PROGRESS.md`(본 절+체크리스트), `docs/DATA_INTEGRATION.md`(players/player-rankings 삭제 반영), `docs/FEATURE_MARKET_RESEARCH.md`/`docs/CANCEL_TICKET_ALERT_RESEARCH.md`(암표법 시행일 8/28 정정·취소표대기 요금 표기 완화).
- **다음 루프 = X0 배포 게이트(D3 호스팅 스택 / D7 VAPID 키 운영 / D8 법률·처리방침 검토) 결정 → 결정 후 X1(예매 오픈 임박 푸시) 착수. 병행 가능한 별도 트랙: N3(구단 프로모션 데이터 소스 조사) / N5(D11 수익화 착수 시점 결정 대기).**

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
- `ticketlink-macro` 보존 위치: `/Users/minsub/Documents/hanwha/_separated/ticketlink-macro-20260606-203301`
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
cd /Users/minsub/Documents/hanwha/hanwha
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
   - **남은 Now (착수 보류):** N3 프로모션(공개 데이터 소스 선결) · N5 어필리에이트(D11 수익화 착수 시점 결정 대기). `more-subnav`는 폐기 결정, 빈/로딩/오류 표준화는 R6에서 완료(2026-07-04) — 자세한 내용은 `docs/ROADMAP.md` §1.1/§4.1 참조.
   - **X0 배포 게이트 — D3/D7/D8 결정 완료(2026-07-10)**: D3=Cloudflare Workers+D1+Cron, D7=`wrangler secret`, D8=발송 전 법률 게이트 유지. 코드·프로비저닝 스크립트(`worker/scripts/provision.sh`) 준비 완료, 클라 결함 9건 패치(앱 47/47) 반영 완료 — 남은 것은 사용자의 `npx wrangler login` 실행뿐(위 2026-07-10 절 참조). 그다음 X1(예매 오픈 임박 푸시) 착수, 병행 가능 트랙: X5(라이브 스코어+경기 알림, 가칭) LV0 소스 PoC.
1. 과거 macro 커밋 히스토리 rewrite/force push 여부를 사용자 승인하에 결정한다.
2. 노출 가능성이 있는 계정 비밀번호는 사용자가 직접 교체한다.
3. 수요 검증 운영 루틴을 정의한다.
4. ~~취소표 관심 경기 알림의 예매처별 허용 범위와 데이터 접근 방식을 조사한다.~~ → 완료 (2026-06-11, `docs/CANCEL_TICKET_ALERT_RESEARCH.md`). 다음 결정: 컨시어지 v1 진행 여부 + 제휴 BD 착수 기준 (문서 7절 미해결 질문 참조).
5. 지표가 쌓이면 취소표 관심 경기 알림, 네이티브 알림, 제휴 링크 실험으로 확장한다.

(v20 리디자인 + 10구단 전환은 2026-06-10 main 머지 완료 — 커밋/PR 이력 참조.)

## 주의할 로컬 상태

아래 경로는 작업용/보존용 untracked 상태로 남아 있을 수 있다. 사용자 승인 없이 삭제하거나 커밋하지 않는다.

- `/Users/minsub/Documents/hanwha/.claude/`
- `/Users/minsub/Documents/hanwha/.omo/`
- `/Users/minsub/Documents/hanwha/_separated/`
- `/Users/minsub/Documents/hanwha/data/`

## 다음 세션 추천 첫 작업

사용자가 별도 지시하지 않으면 **`cd hanwha/worker && npx wrangler login && bash scripts/provision.sh`**부터 진행한다(위 2026-07-10 절 "다음 루프" 참조). 완료 후 `script.js`의 `VAPID_PUBLIC_KEY`/`PUSH_API_BASE` 교체 → 캐시 bump → 실기기 푸시 검증. D8(법률·처리방침 검토) 완료 전 실사용자 대상 발송은 금지 유지.

병행 가능한 별도 트랙: LV1b(클라 폴링, `docs/LIVE_ALERTS_DESIGN_2026-07.md` 참조) · 수요 검증 운영 루틴 정의 · 취소표 관심 경기 알림(조사 문서 완료 — `docs/CANCEL_TICKET_ALERT_RESEARCH.md`. 진행 지시가 오면 문서 6절 권고 범위로만 구현하고, 자동 상태 감시는 제휴 성사 전까지 금지 유지).
