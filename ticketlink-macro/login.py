"""
LG트윈스 홈페이지 로그인 — 본인이 직접 로그인 후 터미널 [Enter].

mylgid 자동입력은 봇 탐지로 거의 차단됨 (CLAUDE.md 참고).
persistent context 사용 시 첫 실행만 수동, 다음부터 자동 스킵.
"""
import asyncio
from playwright.async_api import Page
from config import LOGIN_URL


async def is_already_logged_in(page: Page) -> bool:
    """로그인 페이지로 갔을 때 자동 리다이렉트되면 로그인됨, 로그인 폼 보이면 미로그인."""
    try:
        await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(2000)

        if "/member/login" not in page.url:
            print(f"  ✅ {page.url} 으로 자동 리다이렉트 → 로그인됨")
            return True

        form_selectors = [
            'a:has-text("MY LG ID")',
            'a[href*="mylgid"]',
            'a[onclick*="mylgid"]',
            '#loginId',
            '#loginPwd',
            'a:has-text("LG TWINS 로그인")',
            'input[type="password"]',
        ]
        for sel in form_selectors:
            try:
                if await page.locator(sel).count() > 0:
                    print(f"  ❌ 로그인 폼 감지 ({sel}) → 미로그인")
                    return False
            except Exception:
                continue

        print(f"  ⚠️ 로그인 페이지인데 폼 없음 — 미로그인으로 간주 (URL: {page.url})")
        return False
    except Exception as e:
        print(f"  ⚠️ 세션 확인 실패: {e}")
        return False


async def login(page: Page) -> bool:
    """본인이 브라우저에서 직접 로그인 후 터미널에서 Enter."""
    print("🔍 기존 세션 확인 중...")
    if await is_already_logged_in(page):
        print("✅ 이미 로그인됨 (세션 재사용)")
        return True

    print("🔐 로그인 페이지로 이동...")
    await page.goto(LOGIN_URL, wait_until="domcontentloaded")

    print()
    print("=" * 62)
    print("  👉 브라우저에서 직접 로그인하세요")
    print("  ✋ 로그인 끝나면 이 터미널에서 [Enter] 누르세요")
    print("     ('q' [Enter] 로 종료)")
    print("=" * 62)

    try:
        answer = await asyncio.get_event_loop().run_in_executor(
            None, input, "  Enter: "
        )
    except (EOFError, KeyboardInterrupt):
        print("  ⏹  사용자 중단")
        return False

    if answer.strip().lower() in ("q", "quit", "exit"):
        return False

    if "/member/login" in page.url:
        print("  ⚠️ 아직 로그인 페이지에 있습니다. 로그인을 끝내고 다시 시도하세요.")
        return False

    print(f"✅ 로그인 확인 (현재 URL: {page.url})")
    return True
