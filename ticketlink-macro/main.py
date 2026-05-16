"""
LG트윈스 티켓 예매 매크로
메인 실행 파일

사용법:
    python main.py                    # 기본 실행
    python main.py --headless         # 브라우저 숨기고 실행
    python main.py --dry-run          # 테스트 실행 (실제 예매 X)
    python main.py --open-time "2026-04-07 11:00:00"  # 오픈 시간 대기
"""
import asyncio
import argparse
import sys
from datetime import datetime, timedelta

from config import (
    TICKET_URL, HEADLESS, SLOW_MO,
    WAIT_FOR_OPEN, OPEN_TIME, FAST_MODE,
    USE_PERSISTENT_CONTEXT, PROFILE_DIR,
    PERSISTENT_CONTEXT_STEALTH, PERSISTENT_CONTEXT_CHANNEL,
)
from browser import (
    create_browser, create_context, create_page,
    create_persistent_setup,
    human_delay, human_mouse_move, human_click_at,
    detect_bot_block,
)
from login import login
from seat_selector import (
    select_game, select_zone,
    select_seats, auto_select_seats_fast,
)
from notifier import notify_success, notify_failure, notify_waiting


async def _pace(min_ms: int, max_ms: int):
    """critical-path 인간형 dwell. FAST_MODE 면 거의 0."""
    if FAST_MODE:
        await human_delay(50, 150)
    else:
        await human_delay(min_ms, max_ms)


async def _wait_until_url_stable(page, max_ms: int = 3000, stable_ms: int = 500, poll_ms: int = 100):
    """URL 이 일정 시간 변하지 않을 때까지 폴링. 리다이렉트 완료 감지용."""
    try:
        prev = page.url
    except Exception:
        return
    elapsed = 0
    stable = 0
    while elapsed < max_ms:
        await page.wait_for_timeout(poll_ms)
        elapsed += poll_ms
        try:
            cur = page.url
        except Exception:
            return
        if cur == prev:
            stable += poll_ms
            if stable >= stable_ms:
                return
        else:
            prev = cur
            stable = 0


async def wait_for_open_time(target_time_str: str):
    """예매 오픈 시간까지 대기"""
    target = datetime.strptime(target_time_str, "%Y-%m-%d %H:%M:%S")
    print(f"\n⏰ 예매 오픈 시간: {target_time_str}")

    while True:
        now = datetime.now()
        diff = (target - now).total_seconds()

        if diff <= 0:
            print("\n🚀 예매 오픈! 시작합니다!")
            break
        elif diff > 60:
            notify_waiting(f"오픈까지 {int(diff)}초 남음... ({now.strftime('%H:%M:%S')})")
            await asyncio.sleep(1)
        elif diff > 5:
            notify_waiting(f"오픈까지 {diff:.1f}초 남음...")
            await asyncio.sleep(0.1)
        else:
            # 5초 이내: 최대한 빠르게 체크
            notify_waiting(f"오픈까지 {diff:.2f}초!")
            await asyncio.sleep(0.01)


async def open_booking_window(page, context, max_retries: int = 1):
    """홈구장 티켓 예매하기 — 실제 버튼 클릭으로 새 페이지 열기.

    티켓링크의 href 는 `javascript:clickTicketReserve()` — JS 함수가 NetFunnel 키
    발급 + window.open 호출. URL 만 빼서 직접 goto 하면 NetFunnel invalid.key
    차단당함. 따라서 진짜 클릭 + 새 페이지 이벤트 리스너로 받아야 함.
    """
    print("\n🎟️ 티켓 페이지로 이동 중...")
    await page.goto(TICKET_URL, wait_until="domcontentloaded")

    # 예매 버튼 등장 대기 — 클래스 + 텍스트 둘 다 시도
    btn = None
    for sel in ['a.btn_ticket', 'a:has-text("홈구장 티켓 예매하기")']:
        try:
            await page.locator(sel).first.wait_for(state="visible", timeout=8000)
            btn = page.locator(sel).first
            print(f"  ✅ 예매 버튼 발견: {sel}")
            break
        except Exception:
            continue
    if btn is None:
        print("  ❌ 예매 버튼을 찾을 수 없음")
        return None

    # 사람처럼 살짝 둘러보기 (NetFunnel 입장에서 자연스러운 사용자 흐름)
    await human_mouse_move(page, steps=4)

    # 새 페이지 이벤트 리스너 (클릭 전에 등록 필수)
    new_page_future: asyncio.Future = asyncio.get_event_loop().create_future()

    def _on_page(p):
        if not new_page_future.done():
            new_page_future.set_result(p)

    context.on("page", _on_page)

    booking_page = None
    try:
        print("🎯 예매 버튼 클릭 (사람처럼 mouseDown/Up timing) → 새 페이지 대기...")
        await human_click_at(page, btn)

        try:
            booking_page = await asyncio.wait_for(new_page_future, timeout=15)
        except asyncio.TimeoutError:
            print("  ❌ 15초 안에 새 페이지 안 열림 (popup blocker? 버튼 비활성?)")
            return None
    finally:
        try:
            context.remove_listener("page", _on_page)
        except Exception:
            pass

    # 새 페이지 활성화 + 사람처럼 행동 (페이지 측 봇 탐지 회피)
    try:
        await booking_page.bring_to_front()
    except Exception:
        pass

    try:
        await booking_page.wait_for_load_state("domcontentloaded", timeout=20000)
    except Exception as e:
        print(f"  ⚠️ 로딩 타임아웃: {e}")

    # 페이지 진입 직후 마우스 + 인간형 dwell — 페이지 측 봇 탐지 회피
    try:
        await human_mouse_move(booking_page, steps=8)
    except Exception:
        pass
    await _pace(2000, 4000)

    # URL 안정화 (NetFunnel/리다이렉트 완료)
    await _wait_until_url_stable(booking_page, max_ms=4000, stable_ms=600)

    if booking_page.is_closed():
        print("  ❌ 예매 페이지가 닫혔습니다.")
        return None

    final_url = booking_page.url
    print(f"  ✅ 예매 페이지 URL: {final_url}")

    # 차단 감지
    blocked, reason = await detect_bot_block(booking_page)
    if blocked:
        print(f"  🚫 차단 감지: {reason}")
        if max_retries > 0:
            print(f"  🔄 잠시 대기 후 재시도 (남은: {max_retries})")
            await booking_page.close()
            await _pace(3000, 5000)
            return await open_booking_window(page, context, max_retries=max_retries - 1)
        else:
            print("  ❌ 재시도 한도 도달. 가능 원인:")
            print("     - 예매 오픈 시간 미도래")
            print("     - 단시간 반복 시도로 IP/세션 일시 차단")
            print("     - 캡차 또는 추가 인증 필요 (브라우저에서 직접 확인)")

    return booking_page


async def handle_booking_flow(booking_page):
    """예매 창에서의 전체 플로우 처리
    
    티켓링크 예매 단계:
    1. 날짜/회차선택 (schedule 페이지)
    2. 등급/좌석선택 (seat 페이지)  
    3. 권종/할인/매수선택
    4. 배송선택/예매확인
    5. 결제
    """
    url = booking_page.url
    print(f"\n📋 예매 플로우 시작 (URL: {url})")

    # 에러 페이지 확인
    if "error" in url:
        print("  ❌ 에러 페이지 감지")
        return False

    # ====== STEP 1: 날짜/회차 선택 ======
    if "schedule" in url:
        print("\n📅 [STEP 1] 날짜/회차 선택")
        game_selected = await select_game(booking_page)

        if game_selected:
            print("  ⏳ 페이지 전환 대기...")
            await _pace(2000, 4000)

            try:
                round_btn = booking_page.locator('[class*="round"], [class*="time"], [class*="session"]').first
                if await round_btn.count() > 0 and await round_btn.is_visible():
                    await human_delay(500, 1000)
                    await round_btn.click()
                    print("  ✅ 회차 선택 완료")
                    await _pace(1500, 2500)
            except:
                pass

            next_selectors = [
                'button:has-text("좌석선택")',
                'button:has-text("다음")',
                'a:has-text("좌석선택")',
                'a:has-text("다음")',
                'button:has-text("선택완료")',
                '[class*="next"]',
                '[class*="btn_next"]',
            ]
            for sel in next_selectors:
                try:
                    btn = booking_page.locator(sel).first
                    if await btn.count() > 0 and await btn.is_visible():
                        await human_delay(500, 1000)
                        await btn.click()
                        print(f"  ✅ 다음 단계 버튼 클릭: {sel}")
                        await _pace(2000, 4000)
                        break
                except:
                    continue

    # URL 재확인
    url = booking_page.url
    print(f"  현재 URL: {url}")

    # ====== STEP 2: 등급/좌석 선택 ======
    # URL에 seat, zone, area, grade 등이 있으면 좌석 선택 단계
    if any(kw in url for kw in ["seat", "zone", "area", "grade", "block"]):
        print("\n💺 [STEP 2] 등급/좌석 선택")
        zone_selected = await select_zone(booking_page)
        if zone_selected:
            await booking_page.wait_for_timeout(2000)
            seat_selected = await auto_select_seats_fast(booking_page)
            if not seat_selected:
                seat_selected = await select_seats(booking_page)
            return seat_selected

    # 페이지 분석 (URL로 판단 못 할 때)
    print("  🔍 페이지 구조 분석 중...")
    try:
        page_text = await booking_page.locator('body').text_content()
        text = (page_text or "")[:500].strip()
        print(f"  페이지 내용: {text[:200]}...")

        # 텍스트에서 단계 판단
        if "등급" in text or "좌석" in text or "구역" in text:
            print("\n💺 좌석 선택 페이지로 판단")
            zone_selected = await select_zone(booking_page)
            if zone_selected:
                await booking_page.wait_for_timeout(2000)
                seat_selected = await auto_select_seats_fast(booking_page)
                if not seat_selected:
                    seat_selected = await select_seats(booking_page)
                return seat_selected
    except:
        pass

    return "manual"


async def run_macro(headless: bool = False, slow_mo: int = 0, 
                    dry_run: bool = False, open_time: str = None):
    """메인 매크로 실행"""
    print("=" * 60)
    print("  🏟️  LG트윈스 티켓 예매 매크로")
    print("  ⚡ Powered by Playwright (async)")
    print("=" * 60)

    if dry_run:
        print("  🧪 드라이런 모드 (실제 예매 안 함)")
    print()

    # 1. 브라우저 시작
    print("🌐 브라우저 시작 중...")
    browser = None
    if USE_PERSISTENT_CONTEXT:
        print(f"   📂 Persistent profile: {PROFILE_DIR}")
        pw, context = await create_persistent_setup(
            profile_dir=PROFILE_DIR,
            headless=headless,
            slow_mo=slow_mo,
            stealth=PERSISTENT_CONTEXT_STEALTH,
            channel=PERSISTENT_CONTEXT_CHANNEL,
        )
        page = context.pages[0] if context.pages else await context.new_page()
        page.set_default_timeout(15000)
        page.set_default_navigation_timeout(30000)
    else:
        pw, browser = await create_browser(headless=headless, slow_mo=slow_mo)
        context = await create_context(browser)
        page = await create_page(context)

    try:
        # 2. 로그인
        login_success = await login(page)
        if not login_success:
            notify_failure("로그인 실패! 아이디/비밀번호를 확인하세요.")
            return

        # 3. 예매 오픈 시간 대기
        if open_time:
            await wait_for_open_time(open_time)

        # 4. 예매 창 열기
        booking_page = await open_booking_window(page, context)
        if not booking_page:
            notify_failure("예매 창을 열지 못했습니다.")
            return

        if booking_page.is_closed():
            notify_failure("예매 창이 닫혔습니다.")
            return

        # 5. 예매 플로우 실행
        if not dry_run:
            result = await handle_booking_flow(booking_page)

            if result is True:
                notify_success("🎉 좌석 선택 완료! 결제를 진행하세요!")
            elif result == "manual":
                print("\n📌 자동 처리 불가, 브라우저에서 수동으로 진행하세요.")
            else:
                notify_failure("예매 자동화 실패")
        else:
            print("\n🧪 드라이런 완료 - 예매 창이 열린 상태입니다.")

        # 브라우저 유지 (수동 결제/조작을 위해)
        print("\n" + "=" * 60)
        print("  ⏸️  브라우저가 열려있습니다.")
        print("  결제를 완료하거나 수동으로 진행하세요.")
        print("  종료하려면 Ctrl+C를 누르세요.")
        print("=" * 60 + "\n")
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print("\n👋 매크로를 종료합니다.")

    except Exception as e:
        print(f"\n❌ 예상치 못한 오류: {e}")
        notify_failure(str(e))

        # 브라우저 유지
        print("\n⏸️  오류 발생, 브라우저 유지 중. Ctrl+C로 종료.")
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            pass

    finally:
        try:
            if browser:
                await browser.close()
            else:
                await context.close()
        except:
            pass
        try:
            await pw.stop()
        except:
            pass


def main():
    parser = argparse.ArgumentParser(description="LG트윈스 티켓 예매 매크로")
    parser.add_argument("--headless", action="store_true",
                        help="브라우저를 숨기고 실행 (더 빠름)")
    parser.add_argument("--dry-run", action="store_true",
                        help="테스트 실행 (실제 예매 안 함)")
    parser.add_argument("--open-time", type=str, default=None,
                        help='예매 오픈 시간 (예: "2026-04-07 11:00:00")')
    parser.add_argument("--slow-mo", type=int, default=SLOW_MO,
                        help="각 동작 사이 딜레이 (ms)")
    args = parser.parse_args()

    headless = args.headless or HEADLESS
    open_time = args.open_time or (OPEN_TIME if WAIT_FOR_OPEN else None)

    asyncio.run(run_macro(
        headless=headless,
        slow_mo=args.slow_mo,
        dry_run=args.dry_run,
        open_time=open_time,
    ))


if __name__ == "__main__":
    main()
