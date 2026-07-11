# 백엔드 + Web Push 도입 플랜

작성일: 2026-06-11 KST
성격: **플랜 문서 — 코드 구현 완료(2026-07, `worker/` + SW/클라 셸, 단위검증), 배포·실기기 검증 미실행.** 이하 본문은 2026-06-11 조사 시점 서술이며 코드 관련 현재 상태는 `worker/README.md` 참조. 사실은 4개 트랙(Web Push 기술 타당성 / 호스팅 아키텍처 / 프라이버시·UX / 코드 매핑) 조사 기반이나, **최종 결정 전 재검증을 권장**한다. 외부 한도·약관·법령은 시점에 따라 바뀌므로 착수 직전 1차 출처 재확인 필요. PIPA/정보통신망법 해석 부분은 **법률 자문이 아니며** 발송 전 변호사/개인정보 담당 검토 권장.
관련: `PROGRESS.md`의 "지표 기반 네이티브 알림/제휴/스토어 확장 여부 결정", `docs/CANCEL_TICKET_ALERT_RESEARCH.md` 7장 미해결질문 3(푸시 백엔드 투자), 동 문서 5장 ② 사용자 주도 확인 경로의 선결과제(Web Push)를 구체화한 것이다.

---

## 1. 배경 / 목표

### 1.1 왜 백엔드 + 푸시인가

현재 앱은 **백엔드 없는 GitHub Pages 정적 PWA**다. 데이터는 GitHub Actions cron(하루 4회, `hanwha/scripts/update-data.mjs`)이 KBO를 스크랩해 `data/*.json`으로 커밋하고 Pages가 자동 배포한다. 알림은 **앱이 열려 있을 때만** 동작하는 로컬 `Notification`이다 — 조사 당시(2026-06-11) `service-worker.js`에 `push` 핸들러가 없어(코드 매핑 확인) 앱이 닫혀 있으면 알림이 도달하지 않았다(2026-07 현재 push/pushsubscriptionchange 핸들러 구현됨 — 이 절은 도입 배경 설명으로만 유효).

합의된 핵심 가치는 **"10구단 통합 예매-오픈 캘린더 + 알림"**이고, 진짜 무기는 **"앱이 닫혀 있어도 오는 예매 오픈 임박 푸시"**다. 이 한 줄을 실현하는 표준 메커니즘이 Web Push다 — 서버가 푸시 서비스(FCM/Mozilla/Apple)로 메시지를 보내면 **앱이 닫혀 있어도 서비스워커가 깨어나** `push` 이벤트에서 알림을 표시한다. 이를 위해선 ① VAPID 키 ② 구독(endpoint/keys) 영속 저장 ③ 발송 워커가 필요하고, 셋 다 신규 백엔드 컴포넌트다. Web Push 표준은 2023-03부터 **Baseline Widely available**이다.

> 출처: Push API — MDN https://developer.mozilla.org/en-US/docs/Web/API/Push_API · Re-engageable Notifications & Push — MDN https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Re-engageable_Notifications_Push · 코드 매핑(조사 당시 `service-worker.js`에 push/pushsubscriptionchange 핸들러 부재, `notificationclick:93`·`periodicsync:117`만 존재 — 2026-07 현재 push/pushsubscriptionchange 핸들러 구현됨. 이 절은 도입 배경 설명으로만 유효)

### 1.2 "개인정보 최소화" 원칙과의 트레이드오프 (명시)

이 앱의 운영 원칙은 **로그인 없음 · PII 최소 · 모든 상태는 localStorage**다(`PROGRESS.md` 원칙절). Web Push 도입은 이 원칙과 **정면으로 트레이드오프**한다:

- **득**: 앱이 닫혀 있어도 도달하는 알림 — 핵심 가치 실현.
- **실(트레이드오프)**: 지금까지 "서버 보유 데이터 0"이던 구조에 **푸시 구독(endpoint+키)이라는 신규 서버 보관 데이터**가 생긴다. 보관 책임·삭제 책임·새 인프라 운영 부담이 발생한다.

이 트레이드오프를 흡수하는 설계 원칙(4장에서 상술):

- 로그인/계정 없이 **익명 구독만** 저장. endpoint를 익명 식별자(PK)로 쓰고 별도 user UUID조차 만들지 않는다.
- 저장 항목은 endpoint/p256dh/auth/관심구단·카테고리(topics)/생성시각으로 **최소화**. IP·User-Agent·위치·디바이스 지문·연락처는 저장 금지.
- endpoint는 capability URL(bearer token)이므로 **비밀로 취급**(평문 로그 금지).
- 구독 해제 시 즉시 삭제, 410/404 endpoint 자동 파기, 무응답 TTL 정리.

W3C Push API 명세상 endpoint는 "사용자의 기기·신원·위치를 푸시 서비스 외 행위자가 추론할 수 없어야 한다"고 규정하며, deactivate된 endpoint는 재사용 금지(영속 식별자 방지)다 — 즉 endpoint+키만 저장하면 익명성이 구조적으로 성립한다. 다만 여기에 IP 등을 결합 저장하는 순간 PIPA 회색지대로 격상된다.

> 출처: W3C Push API — Security and Privacy Considerations https://www.w3.org/TR/push-api/ · RFC 8030 Privacy Considerations https://www.rfc-editor.org/rfc/rfc8030 · Pushpad — Web Push and privacy https://pushpad.xyz/blog/web-push-notifications-and-privacy

---

## 2. 아키텍처 결정

### 2.1 추천 스택 (1순위) — Cloudflare Workers + KV/D1 + Cron Triggers

세 컴포넌트(구독 등록 엔드포인트 / 구독 저장소 / 발송 스케줄러)를 **단일 벤더 · 단일 무료 플랜 · 한 코드베이스**로 통합한다. 한 Worker에 `fetch()`(구독 등록 HTTP) + `scheduled()`(cron 발송)를 같이 둘 수 있어 운영 표면이 가장 작다.

채택 이유:

1. **시간 정밀도** — "예매 오픈 임박 푸시"는 분 단위 정밀 발송이 핵심인데, Worker Cron Triggers는 분 단위 + 엣지 즉시 실행(콜드스타트 사실상 0, V8 isolate)이라 이를 지킨다. 반대로 GitHub Actions cron은 정시 지연이 흔하다(2.4 참조).
2. **무료 한도 충분** — 요청 100k/일, KV 1GB(읽기 100k/일), D1 5GB(쓰기 10만 행/일), Cron 5개. 푸시 대상 수천 명 규모도 여유. 단 **KV는 "서로 다른 키 쓰기 1k/일" 제한**이 있어 구독 등록(빈번한 개별 쓰기)이 많으면 **저장소를 D1로 선택**하는 게 안전하다.
3. **표준 Web Push 유지** — VAPID 그대로, FCM SDK lock-in 없음. 계획 중인 표준 `PushSubscription` 클라이언트를 그대로 쓴다.
4. **Seoul PoP 엣지 실행** — 등록 엔드포인트 지연 최소, 리전 핀 불필요.
5. **VAPID 개인키 보관** — `wrangler secret`으로 안전 보관(아래 2.3).
6. **GitHub Pages는 프론트로 그대로 유지**, Worker만 푸시 백엔드로 분리 추가하는 구조.

> 출처: Cloudflare Workers Limits https://developers.cloudflare.com/workers/platform/limits/ · KV Limits(쓰기 1k/일·동일키 1/초) https://developers.cloudflare.com/kv/platform/limits/ · Cron Triggers https://developers.cloudflare.com/workers/configuration/cron-triggers/ · Seoul PoP https://blog.cloudflare.com/seoul-korea-cloudflares-23rd-data-center/

### 2.2 차선책 (2순위) — 구독 저장만 서버리스 + 발송은 기존 GitHub Actions cron + web-push npm

- **장점**: 신규 인프라 최소(저장소 1개), VAPID 키를 이미 쓰는 **GitHub Actions Secrets**에 보관(친숙), 기존 cron 4슬롯 재사용 → 학습·운영 비용 최저.
- **결정적 단점**: GitHub Actions cron의 시간 부정확성(정시 지연, 최소 간격 5분, 공개 레포 60일 무활동 자동 비활성화)이 "오픈 임박 정시 푸시"라는 핵심 가치를 직접 훼손한다. → **"오픈 임박" 알림에는 부적합**, **"D-1 아침 요약" 같은 시간 여유 있는 알림에는 충분.**
- **활용 경로**: 시간 민감도가 낮은 알림만 낼 P0~초기엔 이걸로 시작했다가, 정시성이 필요해지는 시점(P1 오픈 임박)에 1순위 Worker cron으로 **승격**하는 점진 경로가 가능하다.

**비추천**: ② Supabase(무료 프로젝트 7일 무활동 pause — KBO 비시즌·저트래픽에서 알림 백엔드가 죽음, keep-alive 부담) · ③ Firebase(FCM 발송은 무료지만 Scheduled Functions에 Blaze=카드 등록 필수 → 과금 사고 위험 + FCM proprietary SDK lock-in, 표준 Web Push 이탈).

> 출처: GitHub Actions schedule 지연/60일 비활성화/최소 5분 https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows · web-push npm https://www.npmjs.com/package/web-push · Supabase 7일 pause https://www.itpathsolutions.com/supabase-free-tier-limits · Firebase Pricing(Spark vs Blaze) https://firebase.google.com/docs/projects/billing/firebase-pricing-plans · FCM Web get-started https://firebase.google.com/docs/cloud-messaging/web/get-started

### 2.3 데이터 흐름도

```
[브라우저/PWA]                          [Cloudflare Worker]              [푸시 서비스]
                                                                       (FCM/Mozilla/Apple)
1. 사용자 "알림 켜기"(soft prompt 후)
   권한 granted
2. pushManager.subscribe(
     userVisibleOnly:true,
     applicationServerKey=VAPID public)
        │ subscription = {endpoint, keys.p256dh, keys.auth}
        ▼
3. POST /api/subscriptions ───────────►  fetch() 핸들러
   { endpoint, p256dh, auth,                  │ 저장(최소 스키마)
     topics:["HH:ticket_open", ...] }         ▼
                                          [KV / D1]  endpoint(PK), p256dh, auth,
                                                     topics[], created_at

--- (별개 시간축: 발송) ---

[GitHub Actions cron 4회]
  update-data.mjs ──► data/*.json 커밋(openAt 포함, 6장)
        │ Pages 배포
        ▼
[Cloudflare Worker scheduled() — 분 단위 cron]
  4. data/meta.json·ticketing-calendar.json fetch
     "openAt 임박(예: openAt−15분) & 미발송" 구독 선별
  5. web-push: 페이로드를 p256dh/auth로 E2E 암호화(RFC 8291)
     + VAPID JWT 서명
        │ HTTP POST(endpoint)
        ▼ ───────────────────────────────────────────────►  푸시 서비스
                                                                   │ 기기로 전달
        ◄── 410 Gone/404 ── 즉시 DB 삭제                           ▼
                                                          [브라우저 SW]
                                                          6. push 이벤트 → showNotification()
                                                          7. notificationclick → data.url 열기
                                                             (기존 핸들러 재사용 가능)
```

핵심: 등록(3)과 발송(4~7)은 **다른 시간축**이다. 등록은 사용자 액션 즉시, 발송은 cron이 데이터의 `openAt`을 계산해 임박 시점에. 페이로드는 endpoint/keys로 **E2E 암호화**(RFC 8291)되고 VAPID JWT로 서명된다.

> 출처: PushManager.subscribe() — MDN https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe · web-push 라이브러리 https://github.com/web-push-libs/web-push

### 2.4 VAPID 키 보관

- VAPID = ECDSA **P-256 키쌍** 1쌍, `web-push generate-vapid-keys`로 1회 생성.
- **공개키**: 클라이언트에 상수로 박아 `applicationServerKey`(Base64url)로 `subscribe()`에 전달. (코드 매핑상 조사 당시 클라에 VAPID public key 상수 없음 — 신규 추가 필요했음. 2026-07 현재 `script.js:2273`에 `VAPID_PUBLIC_KEY` 상수 추가됨 — 아래 6장 표 앞 상태 주석 참조.)
- **개인키**: 절대 클라에 노출 금지. 발송 시 JWT 서명용.
  - 1순위(Worker): `wrangler secret put VAPID_PRIVATE_KEY`.
  - 2순위(GHA 발송): GitHub Actions Secrets.
- VAPID를 지정하면 그 앱의 모든 푸시가 VAPID 인증 스킴을 따라야 한다.

> 출처: VAPID(draft-ietf-webpush-vapid) https://datatracker.ietf.org/doc/html/draft-ietf-webpush-vapid-01 · web-push npm https://www.npmjs.com/package/web-push

### 2.5 기존 GitHub Actions cron / Pages 와의 결합

- **GitHub Pages**: 앱 호스팅(`./hanwha`를 사이트 루트로 배포, `deploy-pages.yml:45`) — **그대로 유지**. 프론트와 푸시 백엔드를 분리하고, 클라 구독 등록은 Worker 도메인으로 **CORS POST**한다.
- **GitHub Actions cron(하루 4회)**: 데이터 스냅샷 유지 목적엔 충분하므로 **변경 불필요**. 다만 발송 트리거 근거가 되도록 `update-data.mjs`가 계산된 `openAt`(절대시각)을 JSON에 emit하도록 보강한다(6장 #6).
- **발송 트리거**: 1순위는 Worker `scheduled()`가 배포된 `data/ticketing-calendar.json`을 fetch해 `openAt 임박` 판정. (또는 Worker가 D1에 발송 due를 미리 적재해두고 폴링.) GitHub Actions cron은 정시성 한계로 발송 주체로는 부적합 — 데이터 스냅샷용으로만 남긴다.

> 출처: 코드 매핑(`update-data.yml` cron:4-9 KST 08/18/23:30/00:30, run:32, commit gate:38-50; `deploy-pages.yml` workflow_run:10-12, path ./hanwha:45)

---

## 3. iOS / 브라우저 제약 (최대 리스크)

### 3.1 핵심 제약

- **iOS/iPadOS 16.4+ (2023-03)부터 Web Push 지원** — 단 **반드시 "홈 화면에 추가"한 설치형 PWA**에서만. Safari 일반 탭에서는 불가.
- 필수 조건:
  - `manifest.json`에 **`display:"standalone"`** — 없으면 iOS가 Web Push를 아예 활성화하지 않음.
  - 권한 요청은 **사용자 제스처(탭) 안에서만** 호출.
  - iOS는 **자동 설치 프롬프트 없음** — 사용자가 공유 메뉴 → "홈 화면에 추가"를 **수동**으로 해야 함. ← **최대 퍼널 이탈 지점.**
- 권한 거부 복구 비용: **iOS는 시스템 prompt 1회, Android는 2회.** 거부하면 OS 설정에서 직접 켜야 함.
- 페이로드/silent 제약: 페이로드 상한 Chrome/Firefox ~4KB, **Safari ~2KB**(가장 작은 2KB를 상한으로 설계, 큰 데이터는 수신 후 fetch). **Safari는 visible 알림 필수, silent push 불가**, Firefox는 silent push에 쿼터 → "조용한 백그라운드 동기화" 설계 불가, **항상 사용자에게 보이는 알림**으로 설계.
- TTL 최대 4주이나, 예매 오픈 임박 알림은 **짧은 TTL(수십 분~수 시간)** 권장 — 만료 알림이 늦게 도착하는 것 방지.
- EU/DMA 이슈는 (1차 출처상) 해소됨 — iOS 17.4 정식판부터 WebKit 홈화면 웹앱+푸시 EU 유지. (한국 서비스라 실무 영향 낮음.)
- (참고) Declarative Web Push(Safari 18.4, 2025-03)는 SW 없이도 표준 JSON으로 알림 가능한 신메커니즘이나, 구버전 iOS/타브라우저 폴백 위해 **기존 SW push 경로가 여전히 필요** → 후속 최적화로 보류.

> 출처: WebKit — Web Push for Web Apps on iOS/iPadOS (16.4) https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ · PWA iOS Limitations [2026] — MagicBell https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide · iOS web push setup — OneSignal https://documentation.onesignal.com/docs/en/web-push-for-ios · Browser push(payload/TTL/silent) — Bloomreach https://documentation.bloomreach.com/engagement/docs/browser-push-notifications · Push API support — caniuse https://caniuse.com/push-api · Meet Declarative Web Push — WebKit https://webkit.org/blog/16535/meet-declarative-web-push/ · 9to5Mac(EU) https://9to5mac.com/2024/03/01/apple-home-screen-web-apps-ios-17-eu/

### 3.2 시사점 — iOS 설치율 = 푸시 도달률

iOS 비중이 큰 한국 시장에서, iOS 사용자가 푸시를 받으려면 **"홈 화면 추가"를 수동으로 해야만 한다.** 자동 프롬프트가 없으므로, 핵심 가치("앱 닫혀도 오는 푸시")가 **iOS 설치 유도 UX의 성패에 종속**된다. 따라서 "iOS 설치 유도"를 별도 핵심 트랙으로 다룬다.

### 3.3 사용자 안내 / 설치 유도 설계

- **첫 진입 즉시 prompt 금지** — 가치 경험 전 요청은 옵트인율 급락 + 거부 시 복구 어려움.
- **2단계 soft prompt(pre-permission)**: 앱 UI("예매 오픈 1시간 전 푸시 받기" 카드/버튼)로 가치를 먼저 설명 → 동의 시 그때 시스템 권한 prompt 호출.
- **타이밍**: 사용자가 **관심경기/티켓 리마인더 등록 직후** — 이 앱은 "관심경기 등록" 시점이 자연스러운 트리거(`eaglesTicketReminders` 저장 시점).
- **iOS 분기**: prompt 전에 **"홈 화면에 추가" 설치 안내 단계**가 선행돼야 한다(미설치 시 권한 자체가 불가). iOS Safari 감지 + 공유 메뉴 안내 일러스트/스텝 카드를 둔다.

> 출처: Prompt for push permissions — OneSignal https://documentation.onesignal.com/docs/en/prompt-for-push-permissions · How to improve push opt-in rate — Batch https://doc.batch.com/guides-and-best-practices/orchestration/how-to-improve-the-push-opt-in-rate · Asking permission — Apple Developer https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications

---

## 4. 프라이버시 설계

### 4.1 최소 저장 스키마 (PII 없음)

권장 컬럼만:

| 컬럼 | 설명 |
| --- | --- |
| `endpoint` | PK, **비밀(bearer) 취급** — 평문 로그·분석 전송 금지 |
| `p256dh` | 페이로드 암호화용 클라 공개키 |
| `auth` | 인증 시크릿 |
| `topics` | 구독 카테고리/팀 배열 (예: `["HH:ticket_open","HH:cancel_window"]`) |
| `created_at` | UTC |
| `expires_at` | (선택) TTL 기준 |

**저장 금지**: IP, User-Agent 원문, 정밀 위치, 이메일/전화/이름, 외부 광고 식별자, 임의 클라이언트 UUID. 발송 로그에 endpoint 평문 금지(해시/마스킹). endpoint를 클라 localStorage에도 보관해 "끄기" 시 서버 DELETE 호출에 사용. 관심 데이터 출처는 기존 localStorage(`eaglesTicketReminders`, `cancelWatchGames`/`CANCEL_WATCH_KEY`, `SELECTED_TEAM_KEY`)이며, **endpoint+키+관심구단 코드만** 보내고 PII는 안 보낸다.

### 4.2 동의 / 철회 / 파기

- **동의(켜기)**: 명확·구체 in-app 고지 — 무엇을(예매오픈/취소표/결과), 무엇으로(브라우저 푸시 endpoint+암호화키), 왜(알림 발송), 보관기간(구독 해제 시 즉시 삭제 + 무응답 endpoint 자동 정리), 철회방법(설정 토글). 익명 설계라 별도 회원약관 불필요.
- **철회/삭제**: 토글 OFF → 한 동작으로 (a) 브라우저 `subscription.unsubscribe()` + (b) 서버 `DELETE /api/subscriptions`(endpoint 키로) **둘 다** 실행. UI에 "끄면 서버 기록도 즉시 삭제됩니다" 명시. 토픽 단위 OFF는 `topics` 배열만 갱신, 전체 OFF는 행 삭제.
- **자동 파기**: 발송 워커가 410 Gone/404 응답 endpoint를 **그 자리에서 삭제**(좀비 구독 = 불필요한 보유). 장기 무응답 TTL(예: 180일) 자동 파기 잡. `pushsubscriptionchange` 핸들러로 endpoint 회전 시 서버 갱신.
- GDPR Art. 5(1)(e) 저장제한 / Art. 17 잊혀질 권리 관점: 동의 철회 시 "지체 없이" device token·preferences 완전 삭제.

> 출처: Pushpad — Web Push Error 410 https://pushpad.xyz/blog/web-push-error-410-the-push-subscription-has-expired-or-the-user-has-unsubscribed · MDN — 410 Gone https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/410 · GDPR Art. 17 https://gdpr-info.eu/art-17-gdpr/ · GDPR Storage Limitation https://legalclarity.org/gdpr-storage-limitation-retention-periods-and-compliance/

### 4.3 PIPA / 정보통신망법 관점 (법률 자문 아님)

- **개인정보 해당성**: endpoint+키만 저장하면 본인 식별 요소와의 결합 수단이 시스템에 없어 개인정보 해당성이 **낮다.** 단 IP 등을 결합 저장하면 식별 가능성이 올라가 회색지대. 가장 안전한 운영은 "개인정보가 아닐 가능성이 높게 설계"하되 **개인정보처럼 보호**.
- **정보성 vs 광고성 분기(정보통신망법 §50)**: §50은 **영리목적 광고성 정보**에만 사전동의·수신거부·야간 별도동의를 요구. "예매 오픈 임박", "취소표 타임 안내", "경기 결과"는 사용자가 직접 구독한 **정보성/트랜잭션 알림**으로 설계하면 광고 규제 트랙과 분리된다. → **현 단계 광고성 푸시 도입 금지**를 정책으로 명문화.
- **야간 규제(§50 ④)**: 21:00~익일 08:00 영리 광고성 정보는 별도 사전동의 필수. 정보성이라도 야간 발송은 "조용한 시간"으로 자율 제한(아래 4.4).
- **최소수집·파기(보호법 §3·§21)**: 목적에 필요한 최소만, 철회/목적달성 시 지체 없이 파기.

> 출처: 정보통신망법 제50조 https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EC%A0%95%EB%B3%B4%ED%86%B5%EC%8B%A0%EB%A7%9D%20%EC%9D%B4%EC%9A%A9%EC%B4%89%EC%A7%84%20%EB%B0%8F%20%EC%A0%95%EB%B3%B4%EB%B3%B4%ED%98%B8%20%EB%93%B1%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0/%EC%A0%9C50%EC%A1%B0 · 개인정보보호법 https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%EB%B3%B4%ED%98%B8%EB%B2%95 · 개인정보 포털(결합 식별) https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=27 · Pushwoosh — 한국 푸시 준수 가이드 https://www.pushwoosh.com/ko/blog/privacy-compliant-push-korea/

### 4.4 카테고리별 opt-in (피로 관리)

단일 "알림 허용?" 토글은 부적절 — **카테고리별 opt-in**(각 독립 토글, **기본 OFF**, 명시적 액션으로만 켜짐):

- `ticket_open` — 예매 오픈 임박(핵심, 시간 민감 → 즉시 발송 허용)
- `cancel_window` — 취소표 타임 리마인더(기존 cancel watch 정책과 정렬: 전날 21시/당일 11시)
- `game_result` — 경기 결과(저긴급 → 조용한 시간 존중, 묶음 가능)

- **조용한 시간 기본 22:00~08:00 KST**: 이 창의 비긴급(결과 등)은 보류 후 아침 묶음. **단 `ticket_open`은 예외**(오픈 시각이 야간일 수 있고 사용자가 직접 구독한 시간 민감 정보성 알림) — "야간에도 예매 알림 받기" 토글로 사용자 선택권 부여.
- **빈도 캡**: 정보성 기준 보수적으로 — 같은 경기/이벤트 중복 발송 금지(기존 `firedReminders`/`notifiedAt` 패턴을 서버 측에 이식), 비긴급 카테고리 1일 묶음 1회. 마케팅 푸시 주 2~5건이면 46% 옵트아웃이라는 업계 데이터 → 정보성은 더 보수적으로.
- **VAPID + `userVisibleOnly:true`** — silent push 금지, 모든 푸시는 사용자에게 보이게.

> 출처: Courier — Reduce Notification Fatigue https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas · OneSignal — Frequency Capping https://onesignal.com/blog/prevent-overmessaging-frequency-capping/ · Braze — Frequency Capping https://www.braze.com/resources/articles/whats-frequency-capping

### 4.5 데이터 최소화 체크리스트 (플랜에 그대로 반영)

- [ ] 저장 컬럼은 endpoint/p256dh/auth/topics/created_at 만. IP·UA·위치·지문·외부ID·연락처 금지.
- [ ] 로그인/계정 없음 유지 — endpoint를 익명 PK로, 별도 UUID 생성 안 함.
- [ ] endpoint를 비밀(bearer)로 취급 — 평문 로그 금지, 발송 로그 해시/마스킹.
- [ ] 광고성 푸시 금지 — 정보성/사용자-구독 알림만.
- [ ] 카테고리별 opt-in, 모두 기본 OFF, 명시적 액션으로만 켜짐.
- [ ] 조용한 시간 22:00~08:00, `ticket_open` 예외(사용자 토글).
- [ ] 끄기 = 서버 즉시 삭제(unsubscribe + DELETE), 토픽 단위 갱신.
- [ ] 410/404 → 즉시 파기, 무응답 TTL 자동 정리, `pushsubscriptionchange` 갱신.
- [ ] 구독 시 명확·구체 고지(무엇/왜/보관기간/철회방법), 보관·파기 정책 문서화.
- [ ] VAPID + `userVisibleOnly:true` — silent push 금지.
- [ ] 백엔드 트레이드오프 명시(서버 보유 데이터 0 → endpoint 보유로 증가, 위 항목으로 상쇄).

---

## 5. 단계적 로드맵

각 Phase: **한 줄 가치 · 선결조건 · 작업량(S/M/L) · 성공지표.** 원칙(루프엔지니어링): 각 Phase 끝에서 멈추고 다음 진행 여부를 확인한다. P0가 모든 푸시 Phase의 공통 기반이다. (푸시 외에 **백엔드가 강화하는 기존 기능**은 9장 참조 — P0와 함께 묶어 갈 후보.)

### Phase 0 — 백엔드 + 푸시 기반 (공통 인프라)

- **가치**: 앱이 닫혀 있어도 알림을 보낼 수 있는 최소 파이프라인을 세운다 (모든 후속 Phase의 토대).
- **범위**: VAPID 키 생성/보관 → 구독 등록 엔드포인트(`POST /api/subscriptions`) + 저장소(KV/D1) → SW `push`/`pushsubscriptionchange` 핸들러 → 발송 파이프라인(web-push) → soft-prompt 권한 UX + iOS 설치 안내. 첫 발송 검증용으로 단순 테스트 토픽 1개.
- **선결조건**: 호스팅 스택 최종 선택(8장 #1), `manifest.json display:standalone` 확인, VAPID 키쌍 생성.
- **작업량**: **L** (백엔드 신규 + SW/클라 변경 + UX).
- **성공지표**: 실제 기기(데스크톱 Chrome 1대 + iOS 설치 PWA 1대)에서 앱을 닫은 상태로 테스트 푸시 수신 성공. 구독 등록/삭제 시 저장소에 정확히 반영.

### Phase 1 — 예매 오픈 임박 푸시 (내 구단) [핵심]

- **가치**: 내 구단 경기의 예매 오픈 임박 시점에 앱이 닫혀 있어도 푸시 — **이 앱의 진짜 무기.**
- **범위**: `update-data.mjs`가 `openAt`(절대시각) emit(6장 #6) → 발송 워커가 "openAt 임박(예: −15분) & 미발송 & topic=ticket_open" 구독 선별 → web-push 발송. `ticket_open` 토픽 opt-in UI. 분 단위 정밀도 필요 → 1순위 Worker cron(또는 차선책에서 승격).
- **선결조건**: Phase 0 완료, 발송 정밀도 확보(Worker cron). `ticketing-calendar.json`에 `openAt` 필드.
- **작업량**: **M**.
- **성공지표**: 실제 예매 오픈 직전(목표 ±수 분 이내) 푸시 도달. 중복 발송 0(같은 경기 1회). 옵트인 사용자 대비 도달률 추적.

### Phase 2 — 취소표 컨시어지 푸시화

- **가치**: 기존 로컬 취소표 리마인더를 서버 푸시로 승격 + 공식 대기서비스 신청 리마인더 — 앱 닫혀도 도달.
- **범위**: `cancel_window` 토픽 발송(기존 `checkCancelWatchReminders` 시각 정책 = 전날 21시/당일 11시를 서버 측으로 이식). 공식 취소표 대기 서비스(인터파크 예매대기/티켓링크 취소표 대기) **신청 안내 리마인더 + 공식 딥링크.** 자동 잔여석 감시는 하지 않음(`CANCEL_TICKET_ALERT_RESEARCH.md` 결론 — 5개 예매처 전부 보류 조건). 데이터 등급 차이(오픈 알림=공개공지 / 취소표=상태 보장 없는 확인 유도) UX 카피 명시.
- **선결조건**: Phase 0 완료. `CANCEL_TICKET_ALERT_RESEARCH.md` 권고("컨시어지 v1") 범위 확정(8장 연계).
- **작업량**: **M**.
- **성공지표**: 취소표 타임 리마인더 푸시 도달 + 공식 대기서비스 딥링크 클릭률(제휴 협상 레버리지 신호로 축적).

### Phase 3 — 경기 시작/결과 푸시 (내 구단)

- **가치**: 내 구단 경기 시작/결과를 알림 — 리텐션/재방문.
- **범위**: `game_result` 토픽(저긴급). 조용한 시간 존중 + 묶음("오늘 결과 N건" 1건). `games.json`/`live-game.json` 기반 트리거.
- **선결조건**: Phase 0 완료. 빈도 캡/묶음 로직(4.4).
- **작업량**: **S~M**.
- **성공지표**: 결과 푸시 묶음 도달, 옵트아웃율이 임계(예: 카테고리별 옵트인 대비) 이하 유지.

### Phase 4+ — 아이디어 백로그 (확장 가능 목록)

각 항목은 개별 Phase로 분리해 "아이디어 하나씩 추가" 형태로 진행. 미확정 후보:

- **직관 체크리스트 / 원정 정보 푸시**: 직관 D-1 준비물·교통·날씨 안내. (가치 中, 작업 S~M, 외부 데이터 소스 필요 — 범위 unknown)
- **순위 / 매직넘버 알림**: 내 구단 순위 변동·매직넘버 발생 시. (`teamStandings` 파생, 작업 S)
- **알림 정밀도 강화**: Worker cron 실측 지연 PoC 후 발송 윈도우 미세 조정, Declarative Web Push 도입 검토(iOS 구현 단순화). (작업 M)
- **위젯 / 홈스크린 바로가기**: PWA shortcuts/위젯으로 내 구단 다음 경기. (플랫폼 지원 범위 unknown)
- **B2B 제휴 피드 기반 실데이터 취소표 알림**: `CANCEL_TICKET_ALERT_RESEARCH.md`의 제휴 성사 시 경로(NHN링크/SSG/NC) — 푸시 백엔드 위에서 실현. (작업 L, 선결=제휴 계약)

> 출처: 코드 매핑(`teamStandings` 파생 요약보드, `games.json`/`live-game.json` 10팀 구조 — `PROGRESS.md` Phase 4) · `docs/CANCEL_TICKET_ALERT_RESEARCH.md` 5장/6장(제휴 경로·컨시어지 v1)

---

## 6. 코드 변경 지점 요약 (코드 매핑 트랙 기반)

모든 경로는 워크트리 절대경로. 워크플로우는 `hanwha/`가 아니라 **워크트리 루트**의 `.github/workflows/`에 있다.

> **상태 주석(2026-07 추가, 아래 표는 2026-06-11 조사 시점 원문 그대로 보존)**: #1(SW `push` 핸들러)·#2(`pushsubscriptionchange` 핸들러)·#3(`subscribe()` + 백엔드 POST 셸)·#4(VAPID public key 상수)·#8(백엔드 — `worker/`, Cloudflare Worker + D1, 단위테스트 68/68 통과)은 **구현 완료**됐다. 단 실배포(`wrangler login` + `provision.sh`)·클라 키 실주입·실기기 검증·D8 법률 검토는 미실행 — 상세는 `worker/README.md` "절대 게이트" 참조. 나머지 #5(로컬 리마인더와의 중복 방지)·#6(`update-data.mjs`의 `openAt` emit)·#7(GHA 발송 워크플로우)·#9(`manifest.json` display 필드)는 구현 여부 **개별 확인 필요**.

| # | 파일 | 위치 | 변경(개념) |
| --- | --- | --- | --- |
| 1 | `hanwha/service-worker.js` | `:92` 부근(notificationclick 위) | `push` 핸들러 신규 — `event.data.json()` → `showNotification(title,{body,icon,badge,tag,data:{url}})`. 기존 `showTicketNotification`(script.js:1567)·`checkTicketReminders`(:1672) 규약 그대로 따르면 `notificationclick`(:93) 무수정 호환 |
| 2 | `hanwha/service-worker.js` | 동일 영역 | `pushsubscriptionchange` 핸들러 신규 — 재구독 후 새 endpoint 백엔드 재전송 |
| 3 | `hanwha/script.js` | `:1837` SW 등록 콜백 / 권한 granted 분기 `:1616`·`:1598` | `pushManager.subscribe({userVisibleOnly:true, applicationServerKey})` + 구독 백엔드 POST. subscribe는 권한 granted 이후(`enableNotifications`:1605 / `maybeShowTicketNotification`:1581) |
| 4 | `hanwha/script.js` | 상단 상수 영역(`:25~32` 근처) | VAPID public key 상수 신규(현재 없음) |
| 5 | `hanwha/script.js` | `:1656` `checkTicketReminders` | 서버 푸시와 **중복 방지** — `tag` 통일(`eagles-ticket-due-<gameId>`, 현재 :1676) 또는 구독 성공 시 로컬 리마인더 발송 비활성 |
| 6 | `hanwha/scripts/update-data.mjs` | `:342-348` `buildTicketCalendar` / `:358-371` `ticketOpenTimestamp` | 계산된 `openAt`(ISO/epoch)을 JSON에 emit — 현재 정렬용으로만 쓰고 출력 안 함. 백엔드/클라가 재계산 없이 트리거 근거로 사용 |
| 7 | `.github/workflows/`(워크트리 루트) | 신규 또는 미사용 | 발송 디스패치 — 정시성 한계로 **백엔드(Worker cron) 권장**. 차선책 채택 시에만 GHA cron 사용, VAPID 비밀키는 Secrets |
| 8 | 백엔드(신규) | — | 구독 저장 엔드포인트 + "openAt 임박 미발송" 선별 + web-push 발송 + 410/404 파기 |
| 9 | `hanwha/manifest.json` | display 필드 | iOS Web Push 활성화 위해 `display:"standalone"` 확인/보장 |

데이터 주의: `ticketing-calendar.json`에 **절대 `openAt` 필드 없음**(`openAt` grep 0건). `openDaysBefore`+`openTime`("HH:MM")+`date`("MM.DD", 연도 없음)로 **파생 계산** 필요. 연도는 `meta.json`의 `updatedAt`에서 추출(클라 `seasonYear()`:777 / 서버 `kstParts.year`:381). → #6이 가장 깔끔한 변경 지점.

> 출처: 코드 매핑 보고(`service-worker.js` push/pushsubscriptionchange 부재 / `script.js` notifyButton:221·notificationSupported:1505·enableNotifications:1605·checkTicketReminders:1656·SW register:1836 / `update-data.mjs` buildTicketCalendar:342·ticketOpenTimestamp:358 / `ticketing-calendar.json` openAt 0건)

---

## 7. 비용 / 운영

### 7.1 무료 한도 안에서 운영 가능한가 — 가능

- **Cloudflare(1순위)**: 요청 100k/일, KV 1GB·읽기 100k/일, D1 5GB·쓰기 10만 행/일, Cron 5개. 이 앱 규모(수천 명 구독)는 **압도적으로 여유.** 콜드스타트 사실상 0.
- **푸시 서비스 발송(FCM/Mozilla/Apple)**: Web Push 표준 발송 자체는 무료(횟수 과금 아님).
- **GitHub Pages + Actions(기존)**: 그대로 무료 한도 내.

### 7.2 한계 도달 시 / 주의

- **KV "서로 다른 키 쓰기 1k/일" 제한**이 구독 등록 폭증 시 병목 → **저장소를 D1로(쓰기 10만 행/일) 선택**하면 회피. (구독 수백~수천이면 KV로도 가능, 폭증 대비 D1 권장.)
- 한도 초과 시 Cloudflare Workers Paid는 $5/월 수준(2026 시점 — 착수 시 재확인).
- **차선책(GHA) 운영 리스크**: 공개 레포 60일 무활동 자동 비활성화(KBO 비시즌 주의), 정시 지연.
- **미확인(unknown)**: Cloudflare Cron Trigger의 정확한 실행 지연 SLA는 공식 수치 명시 없음(문서엔 cron *변경* 전파 15분만 언급, 실행 지연은 일반적으로 분 단위 양호하나 공시 없음). **발송 정밀도가 critical(P1)하면 PoC로 실측 권장.**

> 출처: Cloudflare Workers Pricing https://developers.cloudflare.com/workers/platform/pricing/ · KV Limits https://developers.cloudflare.com/kv/platform/limits/ · GitHub Actions schedule(60일 비활성화) https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows

---

## 8. 미해결 결정 (사용자 몫)

1. **호스팅 스택 최종 선택**: 1순위 Cloudflare Workers+D1+Cron(통합·정밀)로 바로 갈지, 2순위(저장만 서버리스 + GHA 발송)로 시작했다 P1에서 승격할지. (정밀 발송 필요 시점이 결정 기준)
2. **iOS 설치 유도 범위**: "홈 화면 추가" 안내를 어느 수준까지(단순 배너 / 스텝 일러스트 / iOS Safari 감지 자동 노출) 구현할지 — iOS 설치율이 곧 푸시 도달률이므로 투자 우선순위 결정.
3. **발송 빈도 / 조용한 시간**: 카테고리별 캡, 조용한 시간 기본값(22:00~08:00 제안), `ticket_open` 야간 예외 토글 노출 여부.
4. **개인정보 처리방침 필요 여부**: endpoint+키만 저장하는 익명 설계라 별도 회원약관은 불요로 봤으나, in-app 고지 수준으로 충분한지 / 별도 처리방침 문서를 둘지 — **발송 전 변호사·개인정보 담당 검토 권장**(법률 자문 아님).
5. **광고성 푸시 정책 명문화**: "정보성만, 광고성 금지"를 정책 문서에 박을지(정보통신망법 §50 트랙 회피).
6. **P2 취소표 컨시어지 범위 연계**: `CANCEL_TICKET_ALERT_RESEARCH.md` 7장 미해결질문 1~2(컨시어지 v1 범위, 제휴 BD 착수)와 묶어 결정.
7. **Cron 정밀도 PoC 여부**: P1 착수 전 Cloudflare Worker cron 실행 지연을 실측할지(공식 SLA unknown).
8. **VAPID 키 운영 주체**: 키 생성·보관·로테이션 책임자와 보관처(`wrangler secret` vs GitHub Secrets) 최종 확정.

---

## 9. 백엔드 도입 시 기존 구현 강화 포인트

백엔드는 "푸시"만 푸는 게 아니라, **이미 만든 기능들의 구조적 한계**도 함께 푼다. 푸시(5장)와 같은 인프라(구독/저장/발송) 위에서 추가 비용 없이 얻는 강화 포인트를 정리한다. 각: 현재 한계 → 강화 → 작업량 → 우선순위. (4장 프라이버시 원칙 — PII 없음·익명·최소수집 — 은 여기서도 그대로 적용.)

| 기능 | 현재 한계 | 백엔드로 강화 | 작업량 | 우선순위 |
| --- | --- | --- | --- | --- |
| **수요 검증(`검증` 탭)** | `eaglesDemandSignals` localStorage — **기기별이라 합산 불가**, 사실상 본인만 봄 | **익명 이벤트 서버 집계**(카운트만): 실사용자 수·예매오픈 클릭·관심구단 분포·취소표 관심 수 → "이걸 쓰는 사람이 있나"를 실측 | S~M | ★ **최우선** (P0와 함께) |
| **예매-오픈 캘린더 정확도** | `openAt` 파생계산(`openDaysBefore`+`openTime`), 예매처 실제 공지와 어긋날 수 있음 | 서버에서 오픈시각 검증·보정·이상 감지 → **푸시 신뢰도와 직결**(틀린 시각이면 알림도 틀림) | M | 높음 (P1 선결) |
| **데이터 신선도 / 라이브** | cron 4회/일 **git 커밋**(히스토리 오염·갱신 지연, 라이브 스코어 늦음) | API 서빙으로 더 잦은 갱신 + 커밋 churn 제거 (단 정적 `data/*.json` fallback 유지가치와 트레이드오프) | M~L | 중 |
| **운영 가시성** | 서버 데이터 0 → 지표 없음 | 발송 도달률·구독 수·410 파기율·옵트아웃율 등 운영 지표 | S | 중 (P0 부수) |
| 알림 정밀도(기존 로컬 리마인더) | 티켓/취소표 리마인더가 **앱 열려야만** 동작 | 서버 푸시로 정시 발송 | — | **로드맵 P1/P2 흡수** |
| 취소표 컨시어지 | 로컬 리마인더 + 공식 안내만 | 서버 발송 + 제휴 시 실상태 피드 수용 | — | **로드맵 P2/P4 흡수** |
| 내 구단/설정 동기화 | 기기별 localStorage | 익명 구독에 묶어 크로스기기 동기화 — **무계정·PII최소 원칙과 트레이드오프** | M | 낮음 / **보류 권장** |

### ★ 강조 — 수요 검증 집계가 "메리트 증명"의 핵심

지금 `검증` 탭 신호는 localStorage라 **기기마다 흩어져 합산이 안 된다**(나만 보는 숫자). 백엔드가 생기면 **익명 카운트만** 서버로 모아 "실사용 N명 / 예매오픈 클릭 M회 / 관심구단 분포"를 실측할 수 있고, 이게 곧:
- **제휴 협상 레버리지**(예매처/구단에 "이만큼 수요가 있다"는 객관 근거 — `CANCEL_TICKET_ALERT_RESEARCH.md` 제휴 경로의 선결),
- **지속/중단 판단 근거**("메리트가 뭐냐"는 질문에 데이터로 답)
가 된다. 푸시 인프라(P0)에 **익명 이벤트 수집 엔드포인트 하나**만 더하면 되므로, **가장 싸게 제품 메리트를 입증**하는 강화다. 단 PII·기기지문 없이 **집계 카운트만**(개별 사용자 추적 금지) — 4장 원칙 준수.

### 강화 ↔ 로드맵 관계

- **신규 강화 작업**(5장 푸시 로드맵과 별개로 추가): 수요 검증 집계 · 캘린더 정확도 검증 · 데이터 신선도 · 운영 가시성. → **P0(기반)에 "익명 집계 엔드포인트 + 운영지표"를 함께 넣는 것**을 권장(같은 백엔드라 한계비용 작음).
- **로드맵에 이미 흡수**: 알림 정밀도·취소표 서버 발송은 P1/P2가 그 자체.
- **보류**: 크로스기기 설정 동기화(개인정보 최소화 원칙과 충돌, 효용 낮음).

> 출처: 코드 매핑(`script.js` `DEMAND_SIGNALS_KEY="eaglesDemandSignals"`·`trackDemandSignal` localStorage 집계, 공개 렌더러 제거 / `update-data.mjs` git 커밋 cron / `ticketing-calendar.json` `openAt` 부재→파생) · `docs/CANCEL_TICKET_ALERT_RESEARCH.md`(제휴 경로·수요 신호 레버리지) · 4장 프라이버시 설계(익명·최소수집)

---

(모든 절 출처 명시. 외부 한도/약관/법령은 2026-06-11 조사 시점 기준이며 착수 직전 재검증 권장. unknown은 정직하게 표기함.)
