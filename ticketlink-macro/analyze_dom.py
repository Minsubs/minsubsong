"""스케줄 페이지 DOM 분석 스크립트"""
import asyncio
from browser import create_browser, create_context, create_page
from login import login
from config import TICKET_URL

async def analyze():
    pw, browser = await create_browser()
    context = await create_context(browser)
    page = await create_page(context)
    
    # 로그인
    await login(page)
    
    # 티켓 페이지
    await page.goto(TICKET_URL, wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    
    # 예매 버튼 클릭, 새 창 캐치
    new_pages = []
    context.on("page", lambda p: new_pages.append(p))
    btn = page.locator('text="홈구장 티켓 예매하기"').first
    await btn.click()
    await page.wait_for_timeout(8000)
    
    if not new_pages:
        print("새 창이 안 열림!")
        return
    
    bp = new_pages[-1]
    if bp.is_closed():
        print("새 창이 닫혔음!")
        return
    
    await bp.wait_for_timeout(3000)
    print(f"\nURL: {bp.url}\n")
    
    # 전체 HTML에서 주요 요소 추출
    dom_info = await bp.evaluate("""
        () => {
            const info = {};
            
            // 캘린더/날짜 요소
            const calItems = document.querySelectorAll('[class*="cal"], [class*="date"], [class*="day"]');
            info.calendar = Array.from(calItems).slice(0, 20).map(el => ({
                tag: el.tagName,
                class: el.className,
                text: el.textContent.trim().substring(0, 50),
                clickable: el.tagName === 'A' || el.tagName === 'BUTTON' || el.onclick != null
            }));
            
            // 경기/게임 목록
            const games = document.querySelectorAll('[class*="game"], [class*="match"], [class*="schedule"], [class*="list"] li, tbody tr');
            info.games = Array.from(games).slice(0, 15).map(el => ({
                tag: el.tagName,
                class: el.className,
                text: el.textContent.trim().substring(0, 100),
            }));
            
            // 버튼들
            const buttons = document.querySelectorAll('button, a.btn, [class*="btn"], input[type="submit"]');
            info.buttons = Array.from(buttons).slice(0, 20).map(el => ({
                tag: el.tagName,
                class: el.className,
                text: el.textContent.trim().substring(0, 50),
                href: el.getAttribute('href'),
                disabled: el.disabled,
            }));
            
            // 스텝 네비게이션
            const steps = document.querySelectorAll('[class*="step"], [class*="tab"], [class*="progress"]');
            info.steps = Array.from(steps).slice(0, 10).map(el => ({
                tag: el.tagName,
                class: el.className,
                text: el.textContent.trim().substring(0, 80),
            }));
            
            // 전체 body의 주요 div 구조
            const mainDivs = document.querySelectorAll('body > div, #wrap > div, .container > div, #container > div, main > div, .content > div');
            info.structure = Array.from(mainDivs).slice(0, 15).map(el => ({
                tag: el.tagName,
                id: el.id,
                class: el.className,
                childCount: el.children.length,
            }));
            
            return info;
        }
    """)
    
    import json
    print("=== CALENDAR/DATE ELEMENTS ===")
    print(json.dumps(dom_info.get("calendar", []), indent=2, ensure_ascii=False))
    print("\n=== GAMES/SCHEDULE ===")
    print(json.dumps(dom_info.get("games", []), indent=2, ensure_ascii=False))
    print("\n=== BUTTONS ===")
    print(json.dumps(dom_info.get("buttons", []), indent=2, ensure_ascii=False))
    print("\n=== STEPS ===")
    print(json.dumps(dom_info.get("steps", []), indent=2, ensure_ascii=False))
    print("\n=== PAGE STRUCTURE ===")
    print(json.dumps(dom_info.get("structure", []), indent=2, ensure_ascii=False))
    
    await browser.close()
    await pw.stop()

asyncio.run(analyze())
