"""
실 사이트 자동 로그인 + 예매 페이지 진입 End-to-End 테스트.

진행:
  1) lgtwins.com 로그인 페이지 → MY LG ID 자동 로그인
  2) 티켓 일반 페이지 → 홈구장 예매 URL 추출 (또는 캐시 fast path)
  3) 티켓링크 페이지 도착 후 봇 차단 여부 검사
  4) 단계별 소요 시간 + 스크린샷

좌석 선택은 하지 않음. 실제 예매 안 됨.
"""
import asyncio
import sys
from datetime import datetime
from pathlib import Path

from browser import (
    create_browser, create_context, create_page,
    create_persistent_setup, detect_bot_block,
)
from login import login
from main import open_booking_window
from config import (
    USE_PERSISTENT_CONTEXT, PROFILE_DIR,
    PERSISTENT_CONTEXT_STEALTH, PERSISTENT_CONTEXT_CHANNEL,
)


async def run_test(headless: bool):
    start = datetime.now()
    out_dir = Path(__file__).parent / "test_results" / start.strftime("%Y%m%d_%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print(f"🧪 E2E 테스트  ({'headless' if headless else 'GUI'})")
    print(f"   시작 시각: {start:%H:%M:%S}")
    print(f"   결과 저장: {out_dir}")
    print(f"   Persistent context: {USE_PERSISTENT_CONTEXT}")
    print("=" * 70)

    browser = None  # persistent 시 None
    if USE_PERSISTENT_CONTEXT:
        pw, context = await create_persistent_setup(
            profile_dir=PROFILE_DIR,
            headless=headless,
            slow_mo=0,
            stealth=PERSISTENT_CONTEXT_STEALTH,
            channel=PERSISTENT_CONTEXT_CHANNEL,
        )
        page = context.pages[0] if context.pages else await context.new_page()
        page.set_default_timeout(15000)
        page.set_default_navigation_timeout(30000)
    else:
        pw, browser = await create_browser(headless=headless, slow_mo=0)
        context = await create_context(browser)
        page = await create_page(context)

    timing = {}
    result = {"login": None, "booking_entry": None, "blocked": None, "final_url": None}
    dialog_log: list[dict] = []

    # 모든 페이지의 dialog 메시지 캡쳐 (browser.py 의 자동 accept 와 별개로 기록만)
    def _attach_dialog_capture(p):
        def _capture(d):
            dialog_log.append({
                "page": getattr(p, "url", "(?)") or "(loading)",
                "type": d.type,
                "msg": (d.message or "")[:400],
            })
        p.on("dialog", _capture)
    context.on("page", _attach_dialog_capture)
    for p in context.pages:
        _attach_dialog_capture(p)

    try:
        # ---- 1) 로그인 ----
        t = datetime.now()
        print(f"\n[1/3] 로그인 시도... ({t:%H:%M:%S})")
        # manual 모드는 사용자가 Enter 칠 때까지 무제한 대기 — 타임아웃 길게
        try:
            login_ok = await asyncio.wait_for(login(page), timeout=600)
        except asyncio.TimeoutError:
            print("    ❌ 로그인 10분 타임아웃")
            login_ok = False
        timing["login"] = (datetime.now() - t).total_seconds()
        result["login"] = login_ok
        print(f"    → {'✅ 성공' if login_ok else '❌ 실패'}  ({timing['login']:.1f}s)")

        # 로그인 직후 스크린샷
        try:
            await page.screenshot(path=str(out_dir / "01_after_login.png"), full_page=True)
            (out_dir / "01_after_login.url").write_text(page.url)
        except Exception as e:
            print(f"    ⚠️ 스크린샷 실패: {e}")

        if not login_ok:
            return timing, result

        # ---- 2) 예매 페이지 진입 ----
        t = datetime.now()
        print(f"\n[2/3] 예매 페이지 진입... ({t:%H:%M:%S})")
        try:
            booking_page = await asyncio.wait_for(
                open_booking_window(page, context, max_retries=0),
                timeout=90,
            )
        except asyncio.TimeoutError:
            print("    ❌ 90초 타임아웃")
            booking_page = None
        timing["booking_entry"] = (datetime.now() - t).total_seconds()
        result["booking_entry"] = bool(booking_page and not booking_page.is_closed())
        print(f"    → {'✅ 도착' if result['booking_entry'] else '❌ 실패'}  ({timing['booking_entry']:.1f}s)")

        if not result["booking_entry"]:
            # 실패 시 lgtwins.com/ticket/general 의 상태 캡처 (디버깅용)
            print("    🔍 실패 디버그: 티켓 페이지 상태 캡처")
            try:
                await page.screenshot(
                    path=str(out_dir / "02_ticket_general_FAIL.png"), full_page=True
                )
                (out_dir / "02_ticket_general_FAIL.url").write_text(page.url)
                html = await page.content()
                (out_dir / "02_ticket_general_FAIL.html").write_text(html)
                # 페이지의 모든 링크/버튼 dump
                dump = await page.evaluate("""
                    () => {
                        const out = [];
                        document.querySelectorAll('a, button').forEach(el => {
                            const text = (el.textContent || '').trim().substring(0, 60);
                            if (!text) return;
                            out.push({
                                tag: el.tagName,
                                text: text,
                                href: el.getAttribute('href'),
                                onclick: (el.getAttribute('onclick') || '').substring(0, 200),
                                class: (el.className || '').toString().substring(0, 80),
                            });
                        });
                        return out;
                    }
                """)
                import json as _json
                (out_dir / "02_ticket_general_links.json").write_text(
                    _json.dumps(dump, indent=2, ensure_ascii=False)
                )
                ticket_related = [
                    d for d in dump
                    if any(k in (d.get("text") or "") for k in ["예매", "티켓", "ticket", "Ticket"])
                ]
                print(f"    💾 페이지 캡처 완료. '예매/티켓' 관련 링크 {len(ticket_related)}개:")
                for d in ticket_related[:8]:
                    print(f"       [{d['tag']}] text='{d['text']}'  class='{d['class'][:40]}'")
            except Exception as e:
                print(f"    ⚠️ 디버그 캡처 실패: {e}")
            return timing, result

        result["final_url"] = booking_page.url
        print(f"    URL: {booking_page.url}")

        # 예매 페이지 스크린샷 + HTML
        try:
            await booking_page.screenshot(
                path=str(out_dir / "02_booking_page.png"), full_page=True
            )
            (out_dir / "02_booking_page.url").write_text(booking_page.url)
            html = await booking_page.content()
            (out_dir / "02_booking_page.html").write_text(html)
        except Exception as e:
            print(f"    ⚠️ 캡처 실패: {e}")

        # 진단: NetFunnel 이 보는 시그널 dump (dialog 무한 루프 대비 타임아웃)
        try:
            fp = await asyncio.wait_for(booking_page.evaluate("""
                () => ({
                    // 자동화 시그널
                    webdriver: navigator.webdriver,
                    webdriverDescriptor: !!Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver'),
                    // 핑거프린팅
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    languages: navigator.languages,
                    pluginsLen: navigator.plugins.length,
                    pluginNames: Array.from(navigator.plugins).map(p => p.name),
                    hardwareConcurrency: navigator.hardwareConcurrency,
                    deviceMemory: navigator.deviceMemory,
                    // Notification / Permissions
                    notification: typeof Notification !== 'undefined' ? Notification.permission : 'undefined',
                    // Chrome 객체
                    hasChrome: typeof window.chrome,
                    chromeKeys: window.chrome ? Object.keys(window.chrome) : [],
                    hasChromeRuntime: !!(window.chrome && window.chrome.runtime),
                    // 화면
                    outerW: window.outerWidth, outerH: window.outerHeight,
                    innerW: window.innerWidth, innerH: window.innerHeight,
                    screenW: screen.width, screenH: screen.height,
                    colorDepth: screen.colorDepth, pixelDepth: screen.pixelDepth,
                    // WebGL
                    webglVendor: (() => {
                        try {
                            const c = document.createElement('canvas');
                            const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
                            return gl ? gl.getParameter(37445) : 'no-webgl';
                        } catch (e) { return 'err:'+e.message; }
                    })(),
                    webglRenderer: (() => {
                        try {
                            const c = document.createElement('canvas');
                            const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
                            return gl ? gl.getParameter(37446) : 'no-webgl';
                        } catch (e) { return 'err:'+e.message; }
                    })(),
                })
            """), timeout=10)
            import json as _json
            (out_dir / "fingerprint.json").write_text(
                _json.dumps(fp, indent=2, ensure_ascii=False)
            )
            print(f"    🔬 Fingerprint dump 저장 → fingerprint.json")
            # 핵심 시그널만 콘솔에 요약
            print(f"       webdriver={fp.get('webdriver')!r}  notification={fp.get('notification')!r}")
            print(f"       outerW/H={fp.get('outerW')}/{fp.get('outerH')}  hasChrome={fp.get('hasChrome')}")
            print(f"       chromeRuntime={fp.get('hasChromeRuntime')}  webdriverDesc={fp.get('webdriverDescriptor')}")
        except Exception as e:
            print(f"    ⚠️ Fingerprint dump 실패: {e}")

        # ---- 3) 차단 감지 ----
        t = datetime.now()
        print(f"\n[3/3] 차단 감지 검사...")
        blocked, reason = await detect_bot_block(booking_page)
        timing["bot_check"] = (datetime.now() - t).total_seconds()
        result["blocked"] = blocked
        result["block_reason"] = reason
        if blocked:
            print(f"    🚫 차단 감지: {reason}")
        else:
            print(f"    ✅ 차단 없음 — 정상 페이지")

    finally:
        # 종료 전 잠깐 유지 (사람이 보기 위해)
        if not headless:
            print("\n  ⏸️  2초 후 자동 종료 (GUI 모드)")
            await asyncio.sleep(2)
        try:
            if browser:
                await browser.close()
            else:
                await context.close()
        except Exception:
            pass
        try:
            await pw.stop()
        except Exception:
            pass

    total = (datetime.now() - start).total_seconds()
    timing["total"] = total
    print("\n" + "=" * 70)
    print(f"🏁 총 소요: {total:.1f}s")
    print("=" * 70)

    # 결과 요약 저장 (dialog 로그 포함)
    import json
    (out_dir / "result.json").write_text(
        json.dumps(
            {"timing": timing, "result": result, "dialog_count": len(dialog_log)},
            indent=2, ensure_ascii=False
        )
    )
    if dialog_log:
        (out_dir / "dialogs.json").write_text(
            json.dumps(dialog_log, indent=2, ensure_ascii=False)
        )
        print(f"\n  📋 캡쳐된 dialog {len(dialog_log)}개 → dialogs.json")
        # 중복 제거해서 처음 3개만 콘솔에
        seen = set()
        for d in dialog_log:
            key = (d["type"], d["msg"][:80])
            if key in seen:
                continue
            seen.add(key)
            print(f"     [{d['type']}] {d['msg'][:120]}")
            if len(seen) >= 3:
                break

    return timing, result


async def main():
    headless = "--headless" in sys.argv
    timing, result = await run_test(headless=headless)
    print("\n📊 단계별 시간:")
    for k, v in timing.items():
        print(f"   {k:20} {v:6.1f}s")
    print("\n📋 결과:")
    for k, v in result.items():
        print(f"   {k:20} {v}")


if __name__ == "__main__":
    asyncio.run(main())
