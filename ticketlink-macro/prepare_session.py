"""
사전 수동 로그인 — 매크로 실행 전 1회만.

흐름:
    1. 매크로 전용 Chromium 창이 lgtwins.com 로그인 페이지로 열림
    2. 본인이 직접 mylgid 로그인 (자격증명 자동입력 X — 봇탐지 회피)
    3. 로그인 끝나고 lgtwins.com/main 보이면 터미널에서 [Enter]
    4. 쿠키/세션이 ./profile/ 에 영구 저장됨

저장 후:
    - main.py / analyze_dom.py / e2e_test.py 모두 같은 profile 사용
    - 매크로 실행 시 로그인 단계 자동 스킵
    - 쿠키 만료(보통 수일~수주) 전까지 재로그인 불필요
"""
import asyncio
import sys
from pathlib import Path

from browser import create_persistent_setup
from config import PROFILE_DIR, LOGIN_URL


async def main():
    print("=" * 70)
    print("  🔐 사전 수동 로그인 세션 준비")
    print("=" * 70)
    print(f"  📂 프로필 저장 위치: {PROFILE_DIR}")
    print(f"  🌐 브라우저: 시스템 Chrome (Chromium 아님)")
    print()
    print("  ⚠️  주의: 시스템 Chrome 이 다른 창에서 실행 중이면 프로필 충돌 가능")
    print("           이미 Chrome 떠있다면 모두 닫고 시작하세요 (또는 별도 user_data_dir 사용)")
    print()
    print("  1) Chrome 창이 열리면 본인이 직접 mylgid 로그인하세요")
    print("  2) lgtwins.com 로 자동 리다이렉트 되면 OK")
    print("  3) 이 터미널에서 [Enter] 입력 → 종료 & 세션 저장")
    print("=" * 70)
    print()

    pw, context = await create_persistent_setup(
        profile_dir=PROFILE_DIR,
        headless=False,         # 수동 로그인이라 GUI 필수
        slow_mo=0,
        stealth=False,          # 수동 로그인엔 stealth 끄기 (mylgid 보안검사 회피)
        channel="chrome",       # 시스템 Chrome 사용 — Chromium 으로는 mylgid 차단됨
    )

    # 기존 페이지 재사용 (persistent context는 초기 페이지를 가지고 있을 수 있음)
    page = context.pages[0] if context.pages else await context.new_page()
    page.set_default_timeout(15000)
    page.set_default_navigation_timeout(30000)

    try:
        await page.goto(LOGIN_URL, wait_until="domcontentloaded")
        print("👉 브라우저에서 직접 로그인하세요.")
        print("   로그인 끝나면 이 창에서 [Enter] 누르세요.\n")

        # 사용자 입력 대기 (브라우저는 그대로 열려있음)
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, input, "  로그인 완료 후 [Enter] (또는 'q' 종료): "
            )
        except (EOFError, KeyboardInterrupt):
            pass

        # 세션 검증 — login.py 의 is_already_logged_in 재사용 (false positive 없는 시그널)
        try:
            print("\n  🍪 세션 검증 중...")
            from login import is_already_logged_in
            logged_in = await is_already_logged_in(page)
            cookies = await context.cookies()
            print(f"     검증: {'✅ 로그인됨' if logged_in else '⚠️ 로그인 안 됨 — 다시 시도 필요'}")
            print(f"     쿠키 {len(cookies)}개 저장됨")
        except Exception as e:
            print(f"     ⚠️ 세션 확인 실패: {e}")

        print(f"\n✅ 프로필 저장: {PROFILE_DIR}")
        print("   이제 매크로/테스트 실행 시 로그인 단계가 자동 스킵됩니다.")
    finally:
        await context.close()
        await pw.stop()


if __name__ == "__main__":
    asyncio.run(main())
