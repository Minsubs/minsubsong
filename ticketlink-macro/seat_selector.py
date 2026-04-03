"""
좌석 선택 자동화
사람처럼 행동하는 딜레이 포함
"""
import asyncio
from playwright.async_api import Page, BrowserContext
from config import PREFERRED_ZONES, TICKET_COUNT, TARGET_OPPONENT, TARGET_DATE
from browser import human_delay, human_click


async def wait_for_booking_page(page: Page) -> bool:
    """예매 페이지가 정상 로딩될 때까지 대기"""
    print("⏳ 예매 페이지 로딩 대기 중...")
    try:
        error = page.locator('text=비정상적인 접근')
        if await error.count() > 0:
            print("  ❌ 비정상 접근 에러 감지")
            return False
        await page.wait_for_load_state("domcontentloaded", timeout=30000)
        print("  ✅ 예매 페이지 로딩 완료")
        return True
    except Exception as e:
        print(f"  ❌ 페이지 로딩 실패: {e}")
        return False


async def select_game(page: Page, game_date: str = None) -> bool:
    """경기 선택 (날짜 + 상대팀)"""
    date = game_date or TARGET_DATE
    print(f"🏟️ 경기 선택 중... (날짜: {date}, 상대팀: {TARGET_OPPONENT})")

    try:
        await human_delay(1500, 2500)  # 페이지 로딩 후 사람처럼 기다리기

        # 날짜 먼저 찾기
        if date:
            date_variants = [date, date.replace(".", "/"), date.split(".")[-1] + "일"]
            print(f"  🔍 날짜 '{date}' 탐색 중...")
            for dv in date_variants:
                try:
                    loc = page.locator(f'text="{dv}"').first
                    if await loc.count() > 0 and await loc.is_visible():
                        await human_click(page, loc, f"날짜 '{dv}' 선택!")
                        break
                except:
                    continue

        # 상대팀 경기 찾기
        if TARGET_OPPONENT:
            print(f"  🔍 '{TARGET_OPPONENT}' 경기 탐색 중...")
            
            combined_selectors = []
            if date:
                combined_selectors.append(f'tr:has-text("{date}"):has-text("{TARGET_OPPONENT}")')
                combined_selectors.append(f'li:has-text("{date}"):has-text("{TARGET_OPPONENT}")')
                combined_selectors.append(f'div:has-text("{date}"):has-text("{TARGET_OPPONENT}")')
            
            combined_selectors.extend([
                f'text="{TARGET_OPPONENT}"',
                f'a:has-text("{TARGET_OPPONENT}")',
                f'td:has-text("{TARGET_OPPONENT}")',
                f'li:has-text("{TARGET_OPPONENT}")',
            ])

            for sel in combined_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.count() > 0 and await loc.is_visible():
                        await human_click(page, loc, f"{TARGET_OPPONENT} 경기 선택!")
                        return True
                except:
                    continue

        # 첫 번째 예매 가능 경기
        bookable = page.locator('[class*="booking"], [class*="reserve"], a:has-text("예매")')
        if await bookable.count() > 0:
            await human_click(page, bookable.first, "첫 번째 예매 가능 경기 선택")
            return True

        print("  ℹ️ 경기 선택 단계 스킵")
        return True
    except Exception as e:
        print(f"  ❌ 경기 선택 실패: {e}")
        return False


async def select_zone(page: Page) -> bool:
    """좌석 구역(등급) 선택"""
    print("🎯 좌석 구역 선택 중...")
    await human_delay(1500, 2500)

    try:
        for zone_name in PREFERRED_ZONES:
            print(f"  🔍 '{zone_name}' 구역 탐색 중...")

            zone_selectors = [
                f'text="{zone_name}"',
                f'[title*="{zone_name}"]',
                f'[data-name*="{zone_name}"]',
                f'[class*="zone"]:has-text("{zone_name}")',
                f'[class*="grade"]:has-text("{zone_name}")',
                f'[class*="area"]:has-text("{zone_name}")',
                f'button:has-text("{zone_name}")',
                f'a:has-text("{zone_name}")',
                f'div:has-text("{zone_name}")',
            ]

            for sel in zone_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.count() > 0 and await loc.is_visible():
                        await human_click(page, loc, f"'{zone_name}' 구역 선택 완료!")
                        return True
                except:
                    continue

        # 잔여석 자동 선택
        print("  ⚠️ 선호 구역 없음, 잔여석 있는 구역 자동 선택...")
        any_zone = page.locator('[class*="available"], [class*="remain"], [class*="possible"]')
        if await any_zone.count() > 0:
            await human_click(page, any_zone.first, "잔여석 있는 구역 자동 선택")
            return True

        print("  ❌ 선택 가능한 구역 없음")
        return False
    except Exception as e:
        print(f"  ❌ 구역 선택 실패: {e}")
        return False


async def select_seats(page: Page) -> bool:
    """좌석 선택"""
    print(f"💺 좌석 {TICKET_COUNT}개 선택 중...")
    await human_delay(1500, 2500)

    try:
        selected = 0
        seat_selectors = [
            '[class*="seat"][class*="available"]',
            '[class*="seat"]:not([class*="sold"]):not([class*="disabled"])',
            '[data-status="available"]',
            '[data-status="Y"]',
            'circle[class*="available"]',
            'rect[class*="available"]',
            '.seat_available',
            '.seat.on',
        ]

        for sel in seat_selectors:
            seats = page.locator(sel)
            count = await seats.count()
            if count > 0:
                print(f"  🔍 좌석 발견: {sel} ({count}개)")
                for i in range(min(TICKET_COUNT, count)):
                    try:
                        await human_delay(300, 600)
                        await seats.nth(i).click()
                        selected += 1
                        print(f"  ✅ 좌석 {selected}/{TICKET_COUNT} 선택")
                    except:
                        continue
                if selected >= TICKET_COUNT:
                    break

        if selected > 0:
            print(f"  ✅ 총 {selected}개 좌석 선택 완료!")
            await human_delay(500, 1000)

            next_selectors = [
                'button:has-text("선택완료")',
                'button:has-text("좌석 선택 완료")',
                'button:has-text("다음")',
                'button:has-text("예매하기")',
                'a:has-text("선택완료")',
                'a:has-text("다음")',
            ]
            for sel in next_selectors:
                loc = page.locator(sel).first
                if await loc.count() > 0 and await loc.is_visible():
                    await human_click(page, loc, "선택 완료 버튼 클릭")
                    return True

            print("  ⚠️ 완료 버튼 못 찾음")
            return True
        else:
            print("  ❌ 선택 가능한 좌석 없음")
            return False
    except Exception as e:
        print(f"  ❌ 좌석 선택 실패: {e}")
        return False


async def auto_select_seats_fast(page: Page) -> bool:
    """빠른 자동 좌석 선택 (JS 방식)"""
    print("⚡ 빠른 좌석 선택 모드...")
    try:
        result = await page.evaluate(f"""
            () => {{
                const selectors = [
                    '[class*="seat"][class*="available"]',
                    '[class*="seat"]:not([class*="sold"]):not([class*="disabled"]):not([class*="selected"])',
                    '[data-status="available"]',
                    '.seat_available',
                    'circle.available',
                    'rect.available',
                ];
                let seats = [];
                for (const sel of selectors) {{
                    seats = document.querySelectorAll(sel);
                    if (seats.length > 0) break;
                }}
                if (seats.length === 0) return {{ success: false, count: 0 }};
                let clicked = 0;
                for (let i = 0; i < Math.min({TICKET_COUNT}, seats.length); i++) {{
                    seats[i].click();
                    clicked++;
                }}
                return {{ success: clicked > 0, count: clicked }};
            }}
        """)
        if result["success"]:
            print(f"  ✅ 빠른 모드로 {result['count']}개 좌석 선택!")
            return True
        else:
            print("  ⚠️ 빠른 모드 실패")
            return False
    except Exception as e:
        print(f"  ⚠️ 빠른 모드 에러: {e}")
        return False
