"""
Playwright 브라우저 설정
사람처럼 행동하는 설정 (봇 감지 회피)
"""
import asyncio
import random
from playwright.async_api import async_playwright, Browser, BrowserContext, Page


async def create_browser(headless: bool = False, slow_mo: int = 0):
    """브라우저 인스턴스 생성"""
    pw = await async_playwright().start()

    browser = await pw.chromium.launch(
        headless=headless,
        slow_mo=slow_mo or 50,  # 최소 50ms 딜레이 (사람처럼)
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--window-size=1920,1080",
        ],
    )

    return pw, browser


async def create_context(browser: Browser) -> BrowserContext:
    """브라우저 컨텍스트 생성"""
    context = await browser.new_context(
        viewport={"width": 1920, "height": 1080},
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        locale="ko-KR",
        timezone_id="Asia/Seoul",
        ignore_https_errors=True,
    )

    # 스텔스: webdriver 숨기기
    await context.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    """)

    return context


async def create_page(context: BrowserContext) -> Page:
    """새 페이지(탭) 생성"""
    page = await context.new_page()
    page.set_default_timeout(15000)
    page.set_default_navigation_timeout(30000)

    # JavaScript alert/confirm/prompt 자동 처리
    page.on("dialog", lambda dialog: asyncio.ensure_future(_handle_dialog(dialog)))

    return page


async def _handle_dialog(dialog):
    """JS dialog 자동 처리 (비정상 활동 감지 팝업 등)"""
    msg = dialog.message
    print(f"  🔔 JS 팝업 감지: {msg[:80]}")
    await dialog.accept()  # 확인 클릭
    print(f"  ✅ 팝업 자동 닫기 완료")


async def human_delay(min_ms: int = 500, max_ms: int = 1500):
    """사람처럼 랜덤 딜레이"""
    delay = random.randint(min_ms, max_ms)
    await asyncio.sleep(delay / 1000)


async def human_click(page: Page, locator, description: str = ""):
    """사람처럼 클릭 (랜덤 딜레이 포함)"""
    await human_delay(300, 800)
    await locator.click()
    if description:
        print(f"  ✅ {description}")
    await human_delay(500, 1200)
