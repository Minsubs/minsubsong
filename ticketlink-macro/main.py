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
    WAIT_FOR_OPEN, OPEN_TIME,
)
from browser import create_browser, create_context, create_page, human_delay
from login import login
from seat_selector import (
    wait_for_booking_page, select_game, select_zone,
    select_seats, auto_select_seats_fast,
)
from notifier import notify_success, notify_failure, notify_waiting


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


async def open_booking_window(page, context):
    """홈구장 티켓 예매하기 - URL 추출 후 새 탭에서 직접 이동"""
    print("\n🎟️ 티켓 예매 페이지로 이동 중...")
    await page.goto(TICKET_URL, wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)

    print("🔍 예매 URL 추출 중...")
    
    # JavaScript로 예매 버튼의 URL 추출 (팝업 열지 않고 URL만 가져옴)
    booking_url = await page.evaluate("""
        () => {
            // 방법 1: onclick에서 window.open URL 추출
            const allElements = document.querySelectorAll('a, button, div, span');
            for (const el of allElements) {
                const onclick = el.getAttribute('onclick') || '';
                const text = el.textContent || '';
                
                if (text.includes('티켓 예매하기') || text.includes('예매하기')) {
                    // onclick에서 URL 추출
                    const match = onclick.match(/window\\.open\\s*\\(\\s*['"](https?:\\/\\/[^'"]+)/);
                    if (match) return match[1];
                    
                    // href 확인
                    const href = el.getAttribute('href') || '';
                    if (href.includes('ticketlink') || href.includes('facility')) {
                        return href;
                    }
                }
            }
            
            // 방법 2: 모든 링크에서 ticketlink URL 찾기
            const links = document.querySelectorAll('a[href*="ticketlink"], a[href*="facility"]');
            for (const link of links) {
                const href = link.getAttribute('href');
                if (href && href.includes('reserve')) return href;
            }
            
            // 방법 3: 스크립트 내에서 URL 패턴 찾기
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const text = script.textContent || '';
                const match = text.match(/(https?:\\/\\/facility\\.ticketlink\\.co\\.kr[^'"\\s]+)/);
                if (match) return match[1];
            }
            
            // 방법 4: onclick 함수 내에서 URL 찾기
            for (const el of allElements) {
                const onclick = el.getAttribute('onclick') || '';
                if (onclick.includes('facility') || onclick.includes('ticketlink')) {
                    const match = onclick.match(/(https?:\\/\\/[^'"\\s)]+)/);
                    if (match) return match[1];
                }
            }
            
            return null;
        }
    """)

    if booking_url:
        print(f"  ✅ 예매 URL 추출 성공: {booking_url[:80]}...")
    else:
        # URL 추출 실패 시: 버튼 클릭 + 새 페이지 이벤트 리스너
        print("  ⚠️ URL 추출 실패, 버튼 클릭 방식으로 전환...")
        
        # 새 페이지 이벤트 리스너 설정
        new_pages = []
        context.on("page", lambda p: new_pages.append(p))
        
        # 버튼 클릭
        btn = page.locator('text="홈구장 티켓 예매하기"').first
        if await btn.count() > 0:
            await btn.click()
            await page.wait_for_timeout(5000)
            
            if new_pages:
                booking_page = new_pages[-1]
                if not booking_page.is_closed():
                    await booking_page.wait_for_timeout(3000)
                    print(f"  ✅ 새 창 감지: {booking_page.url}")
                    return booking_page
        
        print("  ❌ 예매 URL을 찾을 수 없습니다.")
        return None

    # 새 탭에서 예매 URL 열기
    print("  🌐 새 탭에서 예매 페이지 열기...")
    booking_page = await context.new_page()
    
    try:
        await booking_page.goto(booking_url, wait_until="domcontentloaded", timeout=30000)
    except Exception as e:
        print(f"  ⚠️ 첫 로딩 타임아웃 (리다이렉트 중일 수 있음): {e}")
    
    # 리다이렉트 완료 대기
    await booking_page.wait_for_timeout(5000)
    
    if booking_page.is_closed():
        print("  ❌ 예매 페이지가 닫혔습니다.")
        return None
    
    final_url = booking_page.url
    print(f"  ✅ 예매 페이지 최종 URL: {final_url}")
    
    # 에러 확인
    if "error" in final_url:
        print("  ⚠️ 에러 페이지 감지")
        try:
            body_text = await booking_page.locator('body').text_content()
            if "비정상" in (body_text or ""):
                print("  ℹ️ NetFunnel '비정상적인 접근' 에러")
                print("  ℹ️ 예매 시간이 아니거나 봇 탐지에 걸린 경우입니다.")
        except:
            pass
    
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
            # 경기 선택 후 페이지 변화 대기 (사람처럼)
            print("  ⏳ 페이지 전환 대기...")
            await human_delay(2000, 4000)
            
            # 회차 선택 버튼이 있으면 클릭
            try:
                round_btn = booking_page.locator('[class*="round"], [class*="time"], [class*="session"]').first
                if await round_btn.count() > 0 and await round_btn.is_visible():
                    await human_delay(500, 1000)
                    await round_btn.click()
                    print("  ✅ 회차 선택 완료")
                    await human_delay(1500, 2500)
            except:
                pass

            # "다음" 또는 "좌석선택" 버튼 찾기
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
                        await human_delay(2000, 4000)
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
            await browser.close()
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
