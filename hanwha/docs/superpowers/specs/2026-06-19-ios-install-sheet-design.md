# iOS 설치유도 시트 — 설계 스펙

> 작성일: 2026-06-19 · 성격: 구현 스펙(브레인스토밍 산출) · 단계: ROADMAP Now "iOS 설치유도 시트"
> 참조: `docs/ROADMAP.md` §4.1/§4.2/§4.4/§4.5, 결정 D5(설치 유도 범위)

## 1. 목적 / 배경

현재 설치 유도는 `beforeinstallprompt` → `#installApp` 버튼뿐이다. iOS Safari는 이 이벤트를 발화하지 않으므로 **iOS 사용자에게는 설치 안내가 전혀 노출되지 않는다.** iOS standalone PWA에서만 향후 Web Push(X0~)가 가능하므로 "설치율 = 푸시 도달률"이며, 이 갭을 메우는 것이 목표다.

거래·자동화가 아닌 정보 안내 레이어이고, 자동 팝업/다크패턴 없이 **value-first**로 설치 경로를 안내한다.

## 2. 성공 기준 (관찰 가능)

- **Happy**: iOS Safari · 미설치(non-standalone)에서 상단 `앱 설치` 버튼 노출 + 홈 1회성 배너 노출 → 버튼/배너 클릭 시 3스텝 시트(① 하단 공유 아이콘 ② "홈 화면에 추가" ③ "추가" 확인)가 열린다.
- **Edge**:
  - standalone(이미 설치) 또는 안드로이드 → iOS 배너/시트 **미노출**(기존 동작 유지).
  - iOS 비-Safari(Chrome/Firefox/in-app webview) → 시트가 "Safari에서 열어야 홈 화면에 추가할 수 있어요" 카피로 적응(가짜 스텝 강요 안 함).
  - 배너 `×` dismiss → 재방문 시 다시 안 뜸(`localStorage.eaglesIosInstallHintDismissed`). 설치되면 영구 숨김.
- **Regression**: 안드로이드 `beforeinstallprompt` 네이티브 설치 흐름 유지. 기존 32개 테스트 + 버전드리프트 가드 + 컴플라이언스(fetch) 가드 통과.

## 3. 범위 (D5 결정)

채택: **버튼 + 1회성 배너** (자동 팝업/자연 트리거 제외).

- IN: iOS Safari 감지, 트리거 버튼 재사용, 홈 1회성 배너(dismiss 영속), 3스텝 시트(a11y 포함), 비-Safari 적응 카피.
- OUT(이번 루프 아님): 더보기 알림·구독 허브의 "설치됨/미설치 상태칩"(허브 미구현), soft-prompt 자연 트리거, 실제 푸시 구독(X0).

## 4. 아키텍처 / 파일

순수 프론트, 서버 불요. 변경 파일:

- `index.html` — 시트 마크업(`#iosInstallSheet`) + 홈 패널 상단 1회성 배너(`#iosInstallBanner`)
- `styles.css` — **append-only `[v26] iOS 설치 안내` 레이어** (기존 v22~v25 규칙 비파괴)
- `script.js` — 감지 함수(순수) + 버튼/배너 게이팅 + 시트 열기/닫기/포커스트랩
- 캐시 정합(동시 bump, 버전드리프트 테스트가 강제): `styles.css?v=23` · `script.js?v=24` · `service-worker.js` `CACHE_NAME = "eagles-lounge-v26"` + precache 항목의 `?v` 일치

## 5. 감지 로직 (순수 함수 — 단위 테스트 대상)

`navigator`/`window` 의존 없이 인자로 받아 테스트 가능하게 분리:

- `isIosDevice(ua, maxTouchPoints)` — `/iphone|ipad|ipod/i.test(ua)` 또는 iPadOS(Mac UA & `maxTouchPoints > 1`)
- `isStandaloneDisplay()` — `matchMedia("(display-mode: standalone)").matches || navigator.standalone === true`
- `isIosSafari(ua)` — iOS 기기 & Safari & `CriOS`/`FxiOS`/in-app 토큰 없음
- `shouldShowIosInstall({ ios, standalone })` → `ios && !standalone` (버튼/배너 게이트)

호출부(DOM): 위 순수 결과로 `#installApp`(iOS 분기), `#iosInstallBanner`, 시트 카피 적응을 결정.

## 6. UI 컴포넌트

- **트리거 버튼**: 기존 `#installApp` 재사용. 안드로이드=`beforeinstallprompt` prompt(현행 유지). iOS Safari·non-standalone=버튼 표시 + 클릭 시 시트 오픈. 라벨은 "앱 설치" 유지.
- **1회성 배너**(`#iosInstallBanner`): 홈 패널 상단. 카피 "홈 화면에 추가하면 예매 오픈 알림을 놓치지 않아요." + "설치 방법" 버튼(시트 오픈) + `×` 닫기. dismiss/설치 시 숨김.
- **시트**(`#iosInstallSheet`): `role="dialog"` `aria-modal="true"` `aria-labelledby`. backdrop. 3스텝(번호 + inline SVG 일러스트 + 텍스트). 닫기: 버튼 / backdrop 클릭 / `Esc`. 포커스 트랩(열릴 때 첫 포커스, 닫을 때 트리거로 복귀). 모바일=바텀시트(`safe-area-inset-bottom`), 데스크톱=센터 모달(미디어쿼리). `@media (prefers-reduced-motion: reduce)` 가드.

## 7. 접근성 / 엣지

- 색만으로 구분 금지(아이콘+텍스트 병기), `aria-modal`, 포커스 트랩, `Esc` 닫기, 버튼 `aria-label`.
- 비-Safari iOS: 시트 상단 안내 문구로 적응(스텝 대신/추가).
- `localStorage` 비활성: `try/catch`로 방어, 실패 시 배너 억제(매 방문 노출 방지).

## 8. 테스트 (TDD)

신규 `tests/ios-install.test.mjs` — 기존 텍스트-assertion 컨벤션(파일 읽어 `assert.match`):

- `script.js`: `isIosDevice`/`isStandaloneDisplay`/`isIosSafari`/`shouldShowIosInstall` 함수 존재, `navigator.standalone`, `display-mode: standalone`, 시트 오픈 함수, `eaglesIosInstallHintDismissed` 키, 포커스 트랩/`Escape` 처리.
- `index.html`: `#iosInstallSheet` `role="dialog"`, 3스텝 마커, "홈 화면에 추가" 카피, `#iosInstallBanner`.
- 버전드리프트: 기존 `pwa-registration.test.mjs`의 가드가 SW `v26` 및 `?v` 일치를 자동 강제 → SW/index 동시 bump 필수.
- 컴플라이언스: **fetch 추가 없음** → 기존 가드 유지.
- **브라우저 실검증**(텍스트 테스트로 못 잡는 동작): iOS UA 에뮬레이션으로 버튼·배너·시트 표시/닫기/포커스, 데스크톱·안드로이드 미노출 육안 확인.

## 9. 비범위(YAGNI)

상태칩·soft-prompt 자연 트리거·실제 구독(X0)·예매 화면 배너(홈에만)·자동 팝업.
