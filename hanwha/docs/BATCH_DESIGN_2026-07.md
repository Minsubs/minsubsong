# 잔여 배치 설계 (2026-07-04) — 구현 대기 스펙

> 성격: **설계만 완료, 미구현.** 설계=Fable, 구현=opus/sonnet 분담 전제.
> 전제 상태: Codex `finish-claude-cleanup` 머지 후 — 데드 JS/CSS 정리 완료(script.js 2397줄, styles.css 3369줄), 캐시 v30, `#fff8ef` 잔존 2건, A1~A7·checksum·미러링 미반영.
> 검증 게이트(모든 단계 공통): `node --check` + `npm run check`(44/44 기준) + worker `node --test worker/test/*.mjs`(68/68). UI 변경은 브라우저 확인 후 완료 선언.

## R1. 시장조사 합성 (sonnet, M)
- 입력: `docs/MARKET_RESEARCH_2026-07-raw.md`(수집 14건: 6방향 리서치 + 검증 verdict).
- 산출: `docs/MARKET_RESEARCH_2026-07.md` — ①요약+6/11 대비 델타표 ②경쟁 ③시장 ④법률(8/11 암표법 체크리스트) ⑤예매처 ⑥플랫폼 ⑦수익화 ⑧Top5 재검증(유지/변경 판정) ⑨unknown(검증 실패 4건 포함 정직 표기) ⑩ROADMAP 시사점.
- 규칙: refuted 주장 본문 제외(부록 기록), 전 주장 출처 URL 유지.

## R2. 크론 위생 (sonnet, S)
- `scripts/update-data.mjs` `writeJson`에 내용 비교(기존 파일 read → 문자열 동일 시 skip, read 실패 시 write). meta.json 포함 전 파일.
- `tests/update-data.test.mjs`에 "동일 내용 재호출 시 재작성 안 함" 1건 추가.
- 효과: 무의미 스냅샷 커밋(최근 2주 20+건) ~80% 억제.

## R3. 메타/매니페스트/오프라인 (sonnet, S) — A3·A4·A5
- A3: `index.html` head에 OG/트위터 메타 — og:title `KBO TIDO — 10구단 예매 오픈 캘린더·알림` / og:description `예매 오픈을 놓치지 않게…` / og:url `https://minsubs.github.io/minsubsong/` / og:image 같은 origin의 `assets/hero-stadium.png` / twitter:card `summary_large_image` + meta description.
- A4: `manifest.webmanifest:21~` shortcuts 점검 — "수요 검증" 단축 잔존 시 "알림 센터"(`./index.html#more`)로 교체, 캘린더 단축 유지.
- A5: `offline.html` Broadcast Ticket 톤 정렬(`.offline-page` 계열 유지, 브랜드 이탤릭 + 카피만).

## R4. 공유 + 선예매 배지 (sonnet, S) — A2·A7
- A2: `renderTicketOpenCard` toc-actions에 `공유` 버튼(`data-share-game`) — `navigator.share({title:'KBO TIDO', text:'{away} vs {home} 예매 오픈 {openText}', url:location.href})`, 미지원 시 clipboard+`showToast('링크를 복사했어요')`. 기존 위임 패턴 준수.
- A7: 홈 티켓 히어로+캘린더 스텁에서 `ticketing.earlyOpenLabel` 존재 시 `선예매 {label}` 배지(`.early-open-chip`, 기존 칩 토큰 재사용, styles 끝 append).

## R5. 캘린더 절충 + .ics (opus, M) — A6·A1
- A6 `renderTicketCalendar` 재구성: ①경기일 지난 항목 제외 ②미오픈을 openAt 임박순 최상단 ③예매 중은 경기일 임박순 3건만 컴팩트 1줄(매치업·경기일·예매처 링크) ④나머지 `예매 중인 경기 N개 더 보기` 토글(aria-expanded, 세션 변수). 기존 스텁 마크업·알림 버튼·data 속성 유지.
- A1 `buildOpenIcs(game, ticketing, openInfo)` 순수함수 + 히어로/스텁 액션 `캘린더에 추가`: VEVENT(DTSTART=openAt UTC, DURATION PT10M, SUMMARY `[예매오픈] {away} vs {home} ({provider})`, DESCRIPTION=예매처 URL, VALARM -PT10M), Blob 다운로드 `kbo-tido-open-*.ics`. 외부 fetch 없음(컴플라이언스 가드 무접촉). 텍스트 테스트 마커 1건.

## R6. 미러링 + 오류 표준화 (sonnet, S)
- `trackDemandSignal`에 `PUSH_API_BASE` 설정 시에만 `navigator.sendBeacon('{PUSH_API_BASE}/api/events', JSON {events:[{event, team?, provider?}]})` — try/catch, PII 금지, worker `validateEventBatch` 형식과 필드 일치 확인.
- `renderDataError` → `.empty-state--error` + `다시 시도`(reload) 카드로 표준화, 대상: featuredGame/ticketGameList/liveGamePanel/teamStandingsBoard(+summary 분기는 현존 시).

## R7. 마감 (sonnet, S)
- 버전 트리아드 v30→v31(index 2곳·SW CACHE+precache·테스트 핀).
- `#fff8ef` 잔존 2건 확인 후 활성이면 `var(--on-accent)` 교체, 죽은 규칙이면 삭제.

## R8. 문서 재기준선 (sonnet, S~M)
- ROADMAP: 라인수/캐시버전 현행화, 제거된 화면 절 신설, more-subnav 폐기 기록, N3(소스 조사 선결)·N5(D11 대기) 상태, R1~R7 반영 기록, 참조 경로를 `/Users/minsub/Documents/hanwha` 기준으로.
- HANDOFF/PROGRESS: 시작 경로 정정('한화'→hanwha), N1 URL 표기를 실코드(`ticket.interpark.com/Contents/Sports`)로 통일.
- DATA_INTEGRATION: players/player-rankings 항목 삭제 반영.

## X0 배포 게이트 (코드 아님 — 사용자 결정 대기)
- D3 호스팅 확정(Cloudflare 권장) → D7 VAPID 키쌍 생성(`wrangler secret`) → D1 생성·`wrangler.toml` ID 교체 → 클라 상수 2개(`VAPID_PUBLIC_KEY`/`PUSH_API_BASE`) 주입 → `wrangler deploy` → 실기기(iOS 설치 PWA 포함) 앱 닫고 푸시 수신 = 성공 증거 → D8 법률/처리방침 검토 후 발송 개시.

## 실행 순서 권장
R2→R3→R4(병렬성 낮음·순차)→R5(opus)→R6→R7→R8. R1은 독립(문서만)이라 아무 때나. 전체 한 PR 또는 R1 별도.
