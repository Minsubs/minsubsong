"""
LG트윈스 홈페이지 로그인 자동화
MY LG ID 로그인 방식 (mylgid.com 리다이렉트)
"""
import asyncio
from playwright.async_api import Page
from config import LOGIN_ID, LOGIN_PW, LOGIN_URL, BASE_URL


async def login(page: Page) -> bool:
    """MY LG ID로 로그인
    
    플로우:
    1. lgtwins.com/member/login 접속
    2. "MY LG ID 로그인" 클릭 → mylgid.com으로 이동 (콜백 URL 포함)
    3. mylgid.com에서 아이디/비밀번호 입력
    4. 자동으로 lgtwins.com으로 리다이렉트
    """
    print("🔐 로그인 페이지로 이동 중...")
    await page.goto(LOGIN_URL, wait_until="networkidle")
    await page.wait_for_timeout(2000)

    # MY LG ID 로그인 버튼 클릭
    # lgtwins.com 로그인 페이지에서 클릭해야 콜백 URL이 정상 포함됨
    print("🔑 MY LG ID 로그인 선택...")
    clicked = False
    
    selectors_to_try = [
        'a:has(img[alt*="MY LG ID"])',       # 이미지 alt로 찾기
        'a:has(img[alt*="my lg id"])',
        'a:has-text("MY LG ID")',            # 텍스트로 찾기
        'a[href*="mylgid"]',                  # href로 찾기
        'a[onclick*="mylgid"]',               # onclick에서 찾기
        '.login_mylg a',                      # 클래스 기반
        '.mylgid a',
    ]
    
    for sel in selectors_to_try:
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0:
                await loc.click()
                clicked = True
                print(f"  ✅ MY LG ID 버튼 클릭 ({sel})")
                break
        except:
            continue

    if not clicked:
        # JS로 MY LG ID 링크 URL 추출 시도
        print("  ⚠️ 셀렉터로 못 찾음, JS로 링크 URL 추출...")
        try:
            mylg_url = await page.evaluate("""
                () => {
                    const links = document.querySelectorAll('a');
                    for (const link of links) {
                        const href = link.getAttribute('href') || '';
                        const text = link.textContent || '';
                        const img = link.querySelector('img');
                        const alt = img ? (img.getAttribute('alt') || '') : '';
                        if (href.includes('mylgid') || text.includes('MY LG ID') || 
                            alt.includes('MY LG ID') || alt.includes('my lg id')) {
                            return href;
                        }
                    }
                    return null;
                }
            """)
            if mylg_url:
                print(f"  🔗 MY LG ID URL 발견: {mylg_url}")
                await page.goto(mylg_url, wait_until="domcontentloaded")
                clicked = True
        except Exception as e:
            print(f"  ❌ JS 추출도 실패: {e}")

    if not clicked:
        # 최후의 수단: lgtwins.com 로그인 페이지에서 직접 버튼 클릭 (좌표 기반)
        print("  ⚠️ 최후의 수단: 페이지 내 모든 링크 중 두 번째 큰 버튼 클릭")
        try:
            # 로그인 페이지에 보통 2개의 큰 버튼이 있음
            # 첫 번째: LG TWINS 로그인, 두 번째: MY LG ID 로그인
            big_btns = page.locator('a[class*="btn"], .btn_lg, .login-btn, a.btn')
            count = await big_btns.count()
            if count >= 2:
                await big_btns.nth(1).click()
                clicked = True
            elif count >= 1:
                await big_btns.nth(0).click()
                clicked = True
        except:
            pass

    if not clicked:
        print("  ❌ MY LG ID 로그인 버튼을 찾을 수 없습니다.")
        return False

    # mylgid.com 로그인 페이지 로딩 대기
    await page.wait_for_timeout(3000)
    current_url = page.url
    print(f"  현재 URL: {current_url}")

    # mylgid.com이 아니면 다시 시도
    if "mylgid" not in current_url:
        print("  ⚠️ mylgid.com으로 이동 안 됨, 다시 대기...")
        try:
            await page.wait_for_url("**/mylgid.com/**", timeout=10000)
        except:
            print(f"  현재 URL: {page.url}")
            # 이미 로그인된 상태일 수 있음
            if "lgtwins.com" in page.url and "login" not in page.url:
                print("✅ 이미 로그인되어 있습니다!")
                return True

    # 아이디 입력
    print("📝 아이디 입력 중...")
    try:
        id_input = page.locator('#loginId')
        await id_input.wait_for(state="visible", timeout=10000)
        await id_input.click()
        await id_input.fill(LOGIN_ID)
        print("  ✅ 아이디 입력 완료")
    except Exception as e:
        print(f"  ❌ 아이디 입력 실패: {e}")
        return False

    # 비밀번호 입력 (type으로 한 글자씩 입력)
    print("📝 비밀번호 입력 중...")
    try:
        pw_input = page.locator('#loginPwd')
        await pw_input.wait_for(state="visible", timeout=5000)
        await pw_input.click()
        await pw_input.fill(LOGIN_PW)
        print("  ✅ 비밀번호 입력 완료")
    except Exception as e:
        print(f"  ❌ 비밀번호 입력 실패: {e}")
        return False

    await page.wait_for_timeout(500)

    # 로그인 버튼 클릭
    print("🚀 로그인 버튼 클릭...")
    try:
        login_btn = page.locator('#btnLogin')
        await login_btn.wait_for(state="visible", timeout=5000)
        await login_btn.click()
        print("  ✅ 로그인 버튼 클릭 완료")
    except Exception as e:
        print(f"  ⚠️ #btnLogin 실패, Enter 키로 제출: {e}")
        await pw_input.press("Enter")

    # 로그인 처리 대기
    await page.wait_for_timeout(3000)
    print(f"  🔍 로그인 후 URL: {page.url}")

    # 로그인 완료 대기 (lgtwins.com으로 리다이렉트)
    print("⏳ 로그인 처리 & 리다이렉트 대기 중...")
    
    # lgtwins.com으로 리다이렉트 대기 (최대 15초)
    try:
        await page.wait_for_url("**/lgtwins.com/**", timeout=15000)
        print(f"  ✅ lgtwins.com으로 리다이렉트 완료: {page.url}")
        print("✅ 로그인 성공!")
        return True
    except:
        pass

    # 리다이렉트 안 됐으면 직접 lgtwins.com으로 이동
    current_url = page.url
    print(f"  현재 URL: {current_url}")

    if "mylgid" in current_url:
        # 에러 메시지 확인 (실제 내용이 있는 경우만 실패)
        error_msg = page.locator('[class*="error"]:visible, .toast:visible, .alert:visible')
        if await error_msg.count() > 0:
            text = (await error_msg.first.text_content() or "").strip()
            if text and len(text) > 2:  # 빈 에러 메시지 무시
                print(f"  ❌ 로그인 실패: {text}")
                return False

    # 직접 lgtwins.com으로 이동해서 로그인 상태 확인
    print("  ℹ️ lgtwins.com으로 직접 이동하여 로그인 확인...")
    await page.goto(f"{BASE_URL}/main", wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)

    # 로그인 상태 확인
    # 방법 1: 로그아웃 링크/버튼 존재 여부
    logged_in = False
    check_selectors = [
        'a[href*="logout"]',
        'text=로그아웃',
        '[class*="mypage"]',
        '.ico_my',
        '.btn_my',
        'a[href*="mypage"]',
        '[class*="login_after"]',
        '[class*="logged"]',
    ]
    for sel in check_selectors:
        try:
            if await page.locator(sel).count() > 0:
                logged_in = True
                break
        except:
            continue

    # 방법 2: 로그인/회원가입 링크가 없으면 로그인된 상태
    if not logged_in:
        try:
            login_link = await page.locator('text=로그인/회원가입').count()
            if login_link == 0:
                logged_in = True
        except:
            pass

    if logged_in:
        print("✅ 로그인 성공!")
        return True
    else:
        print("  ❌ 로그인 실패: 로그인 상태 확인 불가")
        return False

