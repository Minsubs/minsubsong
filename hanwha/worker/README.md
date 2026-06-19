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
| `OPTIONS` | * | CORS preflight. |

## 스케줄러 (scheduled, 분단위 cron)

매 분 실행 → 자체 게이트로 동작:

1. 만료 구독 reap(`deleteExpired`).
2. **조용한 시간(KST 22:00~08:00)** 이면 발송 스킵(`isQuietHour`).
3. 배포된 `DATA_BASE_URL/data/ticketing-calendar.json` fetch(재계산 없이 신뢰).
4. 캘린더 홈팀 → `<CODE>:ticket_open` 구독 로드 + 발송 이력(sent_log) Set 구성.
5. `selectDueSubscriptions` — 오픈 `PUSH_LEAD_MINUTES` 분 전 ~ 오픈 시각 윈도우 & topic 매칭 & 미발송만 선별.
6. VAPID 키 준비(미설정/플레이스홀더면 발송 스킵 — 게이트).
7. `sendPush` 발송. **410/404 → D1 즉시 삭제**, 2xx → `markSent`(once-per-game 캡).

## 운영

```bash
npm install               # wrangler 설치
npm test                  # 단위 테스트(node --test)
npm run db-init           # D1 스키마 적용 (wrangler d1 execute)
npm run dev               # 로컬 개발
npm run deploy            # 배포 (크리덴셜 필요 — 아래 게이트)
```

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
3. **실기기 푸시 도달** — 브라우저가 만든 진짜 `p256dh`/`auth` 로 암호화한 ciphertext 가
   FCM/Mozilla/Apple 푸시 서비스에서 수락·복호화되는지는 **실기기에서만** 검증 가능.
4. **D8 법률/개인정보 처리방침** — 익명 수집이라도 푸시 동의·처리방침 고지(법률 검토) 필요.

## 프라이버시

- 저장: `subscriptions`(endpoint/p256dh/auth/topics/created_at/expires_at), `sent_log`(빈도 캡),
  `demand_counters`(집계 카운트). **IP/User-Agent/위치/UUID/지문/연락처 컬럼 없음.**
- `endpoint` 는 bearer 비밀 → 로그 평문 금지(`maskEndpoint` 로 마스킹 후 기록).
- `/api/events` 는 allow-list 로 카운트만 통과시키고 식별자 필드를 제거한다.
