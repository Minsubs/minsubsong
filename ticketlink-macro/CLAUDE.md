# Ticketlink Macro — Handoff

LG트윈스 홈구장 티켓 자동 예매 매크로. Playwright + 시스템 Chrome 사용.

## 환경

- macOS Apple M1 / arm64
- Python 가상환경: `ticketlink-macro/venv/`
- 브라우저: **시스템 Chrome (148.0.0.0)** via `channel="chrome"` (Chromium 아님 — mylgid 차단됨)
- Playwright persistent context: `ticketlink-macro/profile/`

## 활성화 / 실행

```bash
cd ticketlink-macro && source venv/bin/activate
python prepare_session.py     # 첫 실행: 본인이 직접 mylgid 로그인 → profile/ 저장
python e2e_test.py            # 매크로 끝까지 + 결과 캡쳐 (test_results/ 아래)
python main.py                # 본 매크로 실행
python analyze_dom.py         # 인터랙티브 DOM 분석 (좌석/구역 셀렉터 다듬기용)
python smoke_test.py          # stealth 시그널 11개 검증
```

## 현재 상태 (2026-05-15 22:50)

**진행도**: lgtwins.com 로그인 ✅ → ticketlink schedule 페이지 진입 ✅ → ❌ **여기서 막힘**

**막힌 지점**: ticketlink schedule 페이지에 도착하면 무한 반복 JS alert:
> "시스템에서 비정상적인 활동이 감지되었습니다. 계속될 경우 계정이 차단될 수 있습니다. (ErrorCode:200)"

NetFunnel 1차 (invalid.key) 는 통과. 페이지 측 자체 봇 탐지 (`tk.netfunnel.js` 또는 React 컴포넌트의 검사) 가 잡고 있음. result.json 상 `blocked: false` (URL 은 정상 schedule 페이지) 인데 페이지 측 JS 가 alert 띄우는 것.

## 시도한 회피 (모두 적용된 상태)

| 시도 | 효과 |
|---|---|
| Playwright 번들 Chromium → 시스템 Chrome (`channel="chrome"`) | mylgid 통과 |
| `--no-sandbox` 등 자동화 args 제거 | 인포바 사라짐 |
| `ignore_default_args=["--enable-automation"]` | "자동화 테스트 소프트웨어" 인포바 제거 |
| URL 직접 goto 폐기 → 실제 버튼 클릭 + `context.on("page")` | NetFunnel `invalid.key` 통과 |
| `--disable-blink-features=AutomationControlled` | webdriver 시그널 1차 가림 |
| `STEALTH_MINIMAL_SCRIPT` 적용 | webdriver/webdriverDescriptor/Notification.permission/Permissions.query 가림 |
| UA 강제 (Chrome/131) 해제 → 시스템 Chrome 진짜 UA 사용 | userAgent ↔ userAgentData mismatch 회피 |
| `human_click_at()` (mouseDown→hold→mouseUp) | trusted event 시그널 |
| booking_page 진입 직후 bring_to_front + 마우스 움직임 + 2~4s dwell | 페이지 측 즉시 검사 회피 |
| dialog 무한 루프 안전장치 (3회 초과 시 페이지 close) | 매크로 hang 방지 |

## 다음 액션 후보 (우선순위 순)

1. **`profile/` 초기화 + `prepare_session.py` 재실행** — 5~6번 시도로 ticketlink가 매크로 fingerprint 학습했을 가능성. 새 profile = 새 fingerprint. 본인이 다시 수동 로그인 (5분).

2. **사용자 본 Chrome vs 매크로 환경 fingerprint 비교** — e2e_test 에 `fingerprint.json` 캡쳐 코드 이미 들어가 있음 ([e2e_test.py:155-204](e2e_test.py:155)). 일반 Chrome devtools console 에서 같은 JS 실행해 값 비교 → 다른 시그널 찾기.

3. **`ErrorCode:200` 검색** — ticketlink/NetFunnel 의 정확한 의미. 사용자가 검색해서 알려주면 정확한 시그널 진단 가능.

4. **Canvas/Audio fingerprint spoofing** — 위 1~3 이 모두 실패하면. 복잡한 변경.

5. **다른 IP (모바일 핫스팟)** — IP 단위 학습 차단 가능성 검증.

## 주요 파일

| 파일 | 역할 |
|---|---|
| [config.py](config.py) | 설정 (LOGIN_MODE=manual, USE_PERSISTENT_CONTEXT=True, stealth="minimal") |
| [browser.py](browser.py) | Playwright wrapper, stealth scripts, 리소스 차단, dialog 핸들러 |
| [login.py](login.py) | `is_already_logged_in()` (로그인 페이지 리다이렉트 검사), `login_manual()` |
| [main.py](main.py) | `open_booking_window()` (실제 클릭 + 새 페이지 이벤트), 좌석 흐름 |
| [seat_selector.py](seat_selector.py) | 구역/좌석 선택 (DOM 분석 안 됨 — 셀렉터 추측 상태) |
| [prepare_session.py](prepare_session.py) | 사전 수동 로그인 (profile/ 굳히기) |
| [e2e_test.py](e2e_test.py) | 전체 흐름 검증 + `fingerprint.json` 캡쳐 |
| [analyze_dom.py](analyze_dom.py) | 인터랙티브 DOM 캡쳐 (셀렉터 다듬기 용) |
| [.env](.env) | `LOGIN_ID`, `LOGIN_PW` (커밋 금지 — .gitignore 적용 중) |

## 핵심 디자인 결정

- **`LOGIN_MODE = "manual"`** — mylgid 자동 입력은 봇 탐지로 거의 차단됨. 본인이 수동 로그인 후 터미널 Enter 누르면 매크로 진행.
- **`PERSISTENT_CONTEXT_STEALTH = "minimal"`** — 시스템 Chrome 진짜 환경값 유지, webdriver 만 가림. `"full"` 은 Apple M1 환경에 Intel 강제로 mismatch 발생.
- **`USE_BOOKING_URL_CACHE = False`** — NetFunnel 키는 매번 새로 발급. URL 캐시 무의미.
- **`_BLOCKER_BYPASS_HOSTS`** — lgtwins/mylgid/ticketlink/netfunnel/toastoven 도메인은 리소스 차단 면제.

## 미해결 항목

- [ ] ErrorCode:200 우회 (현재 막힌 지점)
- [ ] 좌석 페이지 진입 후 자동 좌석 선택 (DOM 분석 필요 — analyze_dom.py 인터랙티브 캡쳐 후 셀렉터 다듬기)
- [ ] STEP 3 (권종/매수) 자동화 미구현
- [ ] 결제 단계 — 의도적으로 자동화 X (수동 진행)

## 주의 사항

- 시도 누적 시 ticketlink/NetFunnel이 IP/profile 단위 cool-down 거는 경우 있음. 짧은 시간에 5번 이상 시도 후 1~30분 대기.
- 매크로 종료 시 강제 kill 금지 (Chrome SingletonLock 잔여물). `Ctrl+C` 또는 Enter 로 정상 종료.
  - `_check_and_clean_profile_lock()` 이 다음 실행 시 자동 정리하긴 함.
- 비밀번호는 `.env` 에 평문 — 커밋된 적 있던 자격증명 (`a8e494e`, `dd2b6fd` 커밋) 이라 교체 권장.
