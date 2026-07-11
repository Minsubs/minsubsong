# KBO TIDO Push Backend (Cloudflare Worker + D1)

예매 오픈 임박 Web Push 백엔드. **익명 · 무PII**. 표준 Web Push(VAPID ES256 + RFC 8291
aes128gcm)만 사용하며 FCM SDK / node web-push 라이브러리에 의존하지 않는다.

- `index.js` — 얇은 shell(HTTP + cron). 순수 로직은 `lib/*` 에 있고 단위검증됨.
- `lib/cors.js` `lib/db.js` `lib/push-logic.js` `lib/webpush.js` — 순수/얇은 헬퍼.
- `schema.sql` — D1 스키마(PII 컬럼 없음).
- `test/*.test.mjs` — `node --test` 단위 테스트.

## 엔드포인트 (fetch)

CORS allowlist(`ALLOWED_ORIGIN`) 만 허용. 와일드카드 `*` 금지. 쿠키/Authorization 미사용.

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/api/subscriptions` | 구독 등록/갱신(upsert). body: `{ endpoint, keys:{p256dh,auth}, topics:["HH:ticket_open"] }`. → `201` |
| `DELETE` | `/api/subscriptions` | 구독 해지. body: `{ endpoint }`. → `200` |
| `POST` | `/api/events` | 익명 집계 이벤트(카운트만, PII 거부). body: `{ events:[{name,count,key?}] }`. → `202` |
| `GET` | `/api/metrics` | 집계 카운트 조회(식별자 없음). → `200` |
| `GET` | `/api/live` | 라이브 스코어 프록시(LV1a). `env.SCOREBOARD_URL` HTML을 `lib/scoreboard.js`로 파싱. → `200 { ok, fetchedAt, games }` / 원 소스 실패·stale 없음 → `503 { ok:false, games:[] }` |
| `OPTIONS` | * | CORS preflight. |

## 스케줄러 (scheduled, 분단위 cron)

매 분 실행 → 자체 게이트로 동작:

1. 만료 구독 reap(`deleteExpired`).
2. **조용한 시간(KST 22:00~08:00)** 이면 발송 스킵(`isQuietHour`).
3. 배포된 `DATA_BASE_URL/data/ticketing-calendar.json` fetch(재계산 없이 신뢰).
4. 캘린더 홈팀 → `<CODE>:ticket_open` 구독 로드 + 발송 이력(sent_log) Set 구성.
5. `selectDueSubscriptions` — 오픈 `PUSH_LEAD_MINUTES` 분 전 ~ 오픈 시각 윈도우 & topic 매칭 & 미발송만 선별.
6. VAPID 키 준비(미설정/플레이스홀더면 발송 스킵 — 게이트. 단 F3/F4 상태 baseline 은 계속 기록).
7. `sendPush` 발송. **410/404 → D1 즉시 삭제**, 2xx → `markSent`(once-per-key 캡). **429 → Retry-After 로그(마스킹)+이번 틱 skip, 누적 5건 초과 시 잔여 발송 중단(T1)**. 페이로드는 **DWP(`web_push:8030`+`notification`) + 레거시 SW(`title/body/tag/url`) 병기, ≤2KB(T2)**.

### 신규 발송 동작 (F1~F4)

- **F1 동시오픈 묶음**: 같은 due 윈도우에 한 구독(endpoint)에 오픈 2건+이면 개별 대신 묶음 1건 — 정확 동시각은 "N개 구단 동시 오픈", 시차는 "11:00 한화 → 14:00 키움". 묶인 각 (endpoint,gameId)를 개별 `markSent`.
- **F2 주간 브리핑(`<CODE>:weekly_brief`)**: 일요일 KST 20:00(야간창 회피), 다가오는 주(월~일) 팀별 오픈 일정 1건. dedup `weekly:<ISO주차>`, 오픈 0건이면 스킵, 한 틱 발송 상한(기본 40) 초과분은 다음 틱 이어감.
- **F3 재편성 감지(`calendar_seen` diff)**: 시즌 진행 중 새로 나타난(=직전 미출현) 경기 중 경기일 임박 항목을 홈·원정 `ticket_open` 구독자에 정보 알림 1건. dedup `resched:<gameId>`. **콜드스타트(테이블 비었을 때)는 기록만·발송 없음**. quiet hour 존중.
- **F4 라이브 경기(`<CODE>:game_live`)**: 오늘 경기 창(첫 경기 -20분~23:30)에서 스코어보드(`/api/live` 동일 파서)를 `live_state`와 diff → `start`/`score`(득점 팀만)/`end`/`canceled`(일정에 있는데 미출현/소실 **연속 2회** 후 — LV0 실측: 취소는 상태문자열 없이 목록에서 사라짐). tag `live-<gameId>` 고정(트레이 최신 1건 교체). TTL 300s, quiet hour는 **경기일 23:30까지 예외**(ticket_open 기존 정책 불변).

`GET /api/live` 캐시 정책: `caches.default` 엣지 캐시 **25초**(TTL당 원 소스 최대 1회) + 실패 대비 stale 캐시 10분, 클라 응답엔 `Cache-Control: max-age=15`로 과폴링을 완화한다.

## 운영

```bash
npm install               # wrangler 설치
npm test                  # 단위 테스트(node --test)
npm run db-init           # D1 스키마 적용 (wrangler d1 execute)
npm run dev               # 로컬 개발
npm run deploy            # 배포 (크리덴셜 필요 — 아래 게이트)
```

### 최초 프로비저닝 (X0 배포 게이트 자동화)

`npx wrangler login` 만 사용자가 직접 하면, 나머지 게이트(D1 생성 → VAPID 키쌍 생성 →
공개키 패치 → 배포 → 개인키 secret 주입 → 스키마 적용)는 스크립트가 처리한다:

```bash
cd hanwha/worker
npx wrangler login        # 1회 — 브라우저 OAuth (사용자 직접)
bash scripts/provision.sh # 멱등 — 재실행 안전
```

스크립트가 끝나면 출력되는 공개키/Worker URL 로 `script.js` 의
`VAPID_PUBLIC_KEY` / `PUSH_API_BASE` 를 교체하고 캐시 트리아드를 bump 한다(클라이언트 언락).

### 비밀 주입 (파일 금지)

개인키는 **wrangler secret 으로만** 주입한다. `wrangler.toml`/리포에 절대 커밋하지 않는다.

```bash
wrangler secret put VAPID_PRIVATE   # base64url raw d (32바이트 스칼라)
```

공개 변수(`ALLOWED_ORIGIN`, `DATA_BASE_URL`, `VAPID_PUBLIC` 플레이스홀더, `VAPID_SUBJECT`,
`PUSH_LEAD_MINUTES`, `PUSH_TTL_SECONDS`)는 `wrangler.toml [vars]` 에 둔다.

## 절대 게이트 — 충족 전 "완료" 표기 금지

이 백엔드의 순수 로직(cors/db/push-logic/webpush 암호 구성요소)은 단위검증됐으나, 아래는
환경 제약상 **미검증**이며 프로덕션 활성화 전 반드시 충족해야 한다:

1. **VAPID 프로덕션 키쌍** — 공개키는 클라/`VAPID_PUBLIC` 플레이스홀더 교체, **개인키는
   `wrangler secret put VAPID_PRIVATE`** 로만. 리포/`wrangler.toml`에 개인키 커밋 금지.
   클라(`script.js`)의 applicationServerKey 와 동일 공개키여야 한다.
2. **배포** — `account_id` / `CF_API_TOKEN` / D1 `database_id` 등 크리덴셜이 본 워크플로우
   범위에 없다. `wrangler deploy` + `wrangler d1 create kbo-tido` 후 `database_id` 교체 필요.
   (위 "최초 프로비저닝" 절의 `scripts/provision.sh`가 `wrangler login` 이후 이 단계를 자동화한다 —
   단, 크리덴셜 자체가 없으면 스크립트도 대신할 수 없어 게이트는 여전히 미충족이다.)
3. **실기기 푸시 도달** — 브라우저가 만든 진짜 `p256dh`/`auth` 로 암호화한 ciphertext 가
   FCM/Mozilla/Apple 푸시 서비스에서 수락·복호화되는지는 **실기기에서만** 검증 가능.
4. **D8 법률/개인정보 처리방침** — 익명 수집이라도 푸시 동의·처리방침 고지(법률 검토) 필요.

## 프라이버시

- 저장: `subscriptions`(endpoint/p256dh/auth/topics/created_at/expires_at), `sent_log`(빈도 캡),
  `demand_counters`(집계 카운트). **IP/User-Agent/위치/UUID/지문/연락처 컬럼 없음.**
- `endpoint` 는 bearer 비밀 → 로그 평문 금지(`maskEndpoint` 로 마스킹 후 기록).
- `/api/events` 는 allow-list 로 카운트만 통과시키고 식별자 필드를 제거한다.
