"""
Playwright 브라우저 설정
사람처럼 행동하는 설정 + 봇 탐지 회피 (NetFunnel/티켓링크 대응)
"""
import asyncio
import random
from playwright.async_api import async_playwright, Browser, BrowserContext, Page


# 봇 탐지 회피용 init script
# - navigator.webdriver 제거
# - navigator.plugins / mimeTypes 길이 0 → 가짜로 채움
# - navigator.languages 명시
# - window.chrome 객체 (Chrome 환경 모사)
# - WebGL vendor/renderer 스푸핑
# - Permissions API 의 notification 권한 조작 (헤드리스 탐지 우회)
# - iframe contentWindow.chrome 노출
STEALTH_INIT_SCRIPT = """
(() => {
    // 1) webdriver 흔적 제거
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // 2) plugins / mimeTypes (헤드리스/자동화 브라우저는 length 0)
    const fakePlugin = (name, filename, description) => {
        const plugin = Object.create(Plugin.prototype);
        Object.defineProperty(plugin, 'name', { value: name });
        Object.defineProperty(plugin, 'filename', { value: filename });
        Object.defineProperty(plugin, 'description', { value: description });
        return plugin;
    };
    Object.defineProperty(navigator, 'plugins', {
        get: () => [
            fakePlugin('PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
            fakePlugin('Chrome PDF Viewer', 'internal-pdf-viewer', ''),
            fakePlugin('Chromium PDF Viewer', 'internal-pdf-viewer', ''),
            fakePlugin('Microsoft Edge PDF Viewer', 'internal-pdf-viewer', ''),
            fakePlugin('WebKit built-in PDF', 'internal-pdf-viewer', ''),
        ],
    });

    // 3) 언어 (한국어 환경)
    Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en-US', 'en'],
    });

    // 4) window.chrome 존재 (자동화 도구는 보통 비어있음)
    if (!window.chrome) {
        window.chrome = {};
    }
    window.chrome.runtime = window.chrome.runtime || {
        OnInstalledReason: {},
        PlatformOs: {},
        PlatformArch: {},
        connect: () => ({}),
        sendMessage: () => {},
    };
    window.chrome.loadTimes = window.chrome.loadTimes || (() => ({}));
    window.chrome.csi = window.chrome.csi || (() => ({}));

    // 5) WebGL vendor / renderer (자동화 환경은 보통 'Google Inc.' / 'SwiftShader')
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (param) {
        if (param === 37445) return 'Intel Inc.';            // UNMASKED_VENDOR_WEBGL
        if (param === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
        return getParameter.call(this, param);
    };

    // 6) Permissions API: notification 의 default 응답 우회
    const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
    if (originalQuery) {
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters)
        );
    }

    // 7) hardware/platform 일관성
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });

    // 8) iframe contentWindow.chrome 노출 (일부 탐지가 iframe 안 검사)
    try {
        const originalDescriptor = Object.getOwnPropertyDescriptor(
            HTMLIFrameElement.prototype, 'contentWindow'
        );
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function () {
                const win = originalDescriptor.get.call(this);
                if (win && !win.chrome) {
                    try { win.chrome = window.chrome; } catch (e) {}
                }
                return win;
            },
        });
    } catch (e) {}
})();
"""


# 다양한 Chrome UA (매 실행마다 약간씩 바꿔서 핑거프린팅 회피)
_CHROME_UA_POOL = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
]


# 자동화 우회 args (자동 모드 전용 — mylgid 같은 보안검사엔 오히려 의심 시그널)
_LAUNCH_ARGS_STEALTH = [
    "--disable-blink-features=AutomationControlled",
    "--window-size=1920,1080",
    "--lang=ko-KR",
]

# 일반 Chrome 에 가까운 args (시스템 Chrome 사용 시)
_LAUNCH_ARGS_NORMAL = [
    "--disable-blink-features=AutomationControlled",
    "--window-size=1920,1080",
    "--lang=ko-KR",
]


# 최소 stealth — Playwright 자동화 흔적만 가림. 시스템 Chrome 진짜값은 유지.
# NetFunnel 2차 검사가 잡는 시그널들 우회:
#   1) navigator.webdriver = undefined
#   2) Object.getOwnPropertyDescriptor 로 webdriver 존재 검사 우회
#   3) Notification.permission 정상 응답 (자동화 환경에선 종종 'denied')
#   4) Permissions API 의 notifications 일관성
#   5) chrome.runtime 존재 보장 (시스템 Chrome 엔 있지만 명시)
STEALTH_MINIMAL_SCRIPT = """
(() => {
    // 1) navigator.webdriver 가리기
    try {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    } catch (e) {}

    // 2) Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver') 가
    //    undefined 반환하도록 (진짜 Chrome 처럼). defineProperty 흔적 가림.
    try {
        const origGetDesc = Object.getOwnPropertyDescriptor;
        Object.getOwnPropertyDescriptor = function(target, prop) {
            if (target === Navigator.prototype && prop === 'webdriver') return undefined;
            return origGetDesc.apply(this, arguments);
        };
    } catch (e) {}

    // 3) Notification.permission 후크 — 자동화 환경에선 'denied' 인 경우 많음 (NetFunnel 의심)
    //    일반 Chrome 디폴트인 'default' 로 강제
    try {
        Object.defineProperty(Notification, 'permission', {
            get: () => 'default',
            configurable: true,
        });
    } catch (e) {}

    // 4) Permissions API: notifications 권한 일관화 (Notification.permission 과 매칭)
    try {
        if (window.navigator.permissions && window.navigator.permissions.query) {
            const origQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
            window.navigator.permissions.query = (parameters) => (
                parameters && parameters.name === 'notifications'
                    ? Promise.resolve({ state: 'prompt' })  // 'prompt' = 'default' 와 동일 의미
                    : origQuery(parameters)
            );
        }
    } catch (e) {}
})();
"""


async def create_browser(headless: bool = False, slow_mo: int = 0):
    """브라우저 인스턴스 생성 (비-persistent, stealth 모드)"""
    pw = await async_playwright().start()

    browser = await pw.chromium.launch(
        headless=headless,
        slow_mo=slow_mo,
        args=_LAUNCH_ARGS_STEALTH,
        ignore_default_args=["--enable-automation"],
    )

    return pw, browser


def _check_and_clean_profile_lock(profile_dir: str) -> str | None:
    """SingletonLock 정리. Chrome 비정상 종료 후 남은 잔여물 자동 처리.

    Returns: 살아있는 Chrome PID 가 잡고 있으면 에러 메시지, 정리만 했으면 None.
    """
    import os, re
    from pathlib import Path
    lock = Path(profile_dir) / "SingletonLock"
    if not lock.exists():
        return None
    try:
        target = os.readlink(lock)  # 형식: "hostname-PID"
        m = re.search(r"-(\d+)$", target)
        if m:
            pid = int(m.group(1))
            try:
                os.kill(pid, 0)  # signal 0 = 존재 확인
                return (
                    f"Chrome 프로세스 PID {pid} 가 프로필을 잠그고 있습니다. "
                    f"해당 Chrome 창을 종료한 뒤 재시도하세요. (또는: kill {pid})"
                )
            except ProcessLookupError:
                pass  # 프로세스 죽음 → 잔여 lock 파일
    except OSError:
        pass
    # 잔여물 자동 정리
    for name in ("SingletonLock", "SingletonSocket", "SingletonCookie"):
        try:
            (Path(profile_dir) / name).unlink(missing_ok=True)
        except Exception:
            pass
    print(f"  🧹 비정상 종료된 이전 세션 lock 정리 완료")
    return None


async def create_persistent_setup(
    profile_dir: str,
    headless: bool = False,
    slow_mo: int = 0,
    stealth=False,
    channel: str = "chrome",
):
    """Persistent context 생성 — 쿠키/세션이 profile_dir 에 영구 저장.

    Args:
        stealth:
            - False     : 아무것도 안 함 (시스템 Chrome 진짜값 그대로, mylgid 통과)
            - "minimal" : navigator.webdriver 만 가림 (NetFunnel 통과용, 권장)
            - True/"full": 전체 stealth init script (Chromium 환경에서만 권장)
        channel: "chrome" = 시스템 Chrome (권장).
                 "chromium"/None = 번들 Chromium (mylgid 차단됨).
                 "msedge" = 시스템 Edge.

    Returns:
        (playwright, context)
    """
    from pathlib import Path
    import random
    Path(profile_dir).mkdir(parents=True, exist_ok=True)

    # 이전 Chrome 인스턴스가 프로필 잠그고 있는지 체크
    stuck = _check_and_clean_profile_lock(profile_dir)
    if stuck:
        raise RuntimeError(stuck)

    pw = await async_playwright().start()

    if stealth is True or stealth == "full":
        args = _LAUNCH_ARGS_STEALTH
        ignore_default_args = ["--enable-automation", "--enable-blink-features=IdleDetection"]
        ua = random.choice(_CHROME_UA_POOL)
    else:
        # minimal/False — 시스템 Chrome 그대로. UA 도 강제 안 함 (진짜 UA = userAgentData 일치)
        args = _LAUNCH_ARGS_NORMAL
        ignore_default_args = ["--enable-automation"]
        ua = None  # 진짜 시스템 Chrome UA 사용

    launch_kwargs = dict(
        user_data_dir=profile_dir,
        headless=headless,
        slow_mo=slow_mo,
        args=args,
        ignore_https_errors=True,
        # 일반 사용자처럼 — Accept-Language 만 명시
        extra_http_headers={
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
    )
    if ua is not None:
        launch_kwargs["user_agent"] = ua
        launch_kwargs["viewport"] = {"width": 1920, "height": 1080}
        launch_kwargs["locale"] = "ko-KR"
        launch_kwargs["timezone_id"] = "Asia/Seoul"
    # ua=None 이면 viewport/locale/timezone 도 진짜 환경 그대로 (mismatch 회피)
    if ignore_default_args is not None:
        launch_kwargs["ignore_default_args"] = ignore_default_args
    if channel and channel != "chromium":
        launch_kwargs["channel"] = channel

    try:
        context = await pw.chromium.launch_persistent_context(**launch_kwargs)
        print(f"  🌐 Browser channel: {channel or 'chromium (bundled)'}")
    except Exception as e:
        # 시스템 Chrome 못 찾으면 chromium 으로 fallback
        if channel and channel != "chromium":
            print(f"  ⚠️ '{channel}' 실행 실패 ({e}), chromium 으로 fallback")
            launch_kwargs.pop("channel", None)
            context = await pw.chromium.launch_persistent_context(**launch_kwargs)
        else:
            raise

    # stealth init script — 모드별 분기
    if stealth is True or stealth == "full":
        await context.add_init_script(STEALTH_INIT_SCRIPT)
        print(f"  🛡️  Stealth: full")
    elif stealth == "minimal":
        await context.add_init_script(STEALTH_MINIMAL_SCRIPT)
        print(f"  🛡️  Stealth: minimal (webdriver only)")
    else:
        print(f"  🛡️  Stealth: off")

    # 컨텍스트 단위 dialog 자동 처리 — 새로 떠는 페이지에도 자동 적용
    context.on("page", _attach_dialog_handler)
    # 이미 존재하는 첫 페이지(persistent context 의 about:blank)에도 등록
    for existing_page in context.pages:
        _attach_dialog_handler(existing_page)

    from config import BLOCK_RESOURCES
    if BLOCK_RESOURCES:
        await install_resource_blocker_on_context(context)

    return pw, context


async def create_context(browser: Browser) -> BrowserContext:
    """브라우저 컨텍스트 생성 (stealth init script 포함)"""
    context = await browser.new_context(
        viewport={"width": 1920, "height": 1080},
        user_agent=random.choice(_CHROME_UA_POOL),
        locale="ko-KR",
        timezone_id="Asia/Seoul",
        ignore_https_errors=True,
        # 실제 브라우저처럼 Accept-Language 헤더
        extra_http_headers={
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
    )

    await context.add_init_script(STEALTH_INIT_SCRIPT)
    context.on("page", _attach_dialog_handler)

    from config import BLOCK_RESOURCES
    if BLOCK_RESOURCES:
        await install_resource_blocker_on_context(context)

    return context


# 차단할 리소스 타입 / 도메인
# - font: 폰트 다운로드는 좌석 잡기에 무관
# - media: 동영상/오디오 무관
# - image: 좌석맵이 PNG/JPG라면 차단하면 안 됨. 옵션으로 분리
# - 추적/광고 도메인: 무조건 차단
_BLOCK_DOMAINS = (
    "google-analytics.com",
    "googletagmanager.com",
    "doubleclick.net",
    "googlesyndication.com",
    "facebook.com/tr",
    "facebook.net",
    "connect.facebook.net",
    "kakao.com/ads",
    "kakao-ads",
    "criteo",
    "hotjar.com",
    "mixpanel.com",
    "amplitude.com",
    "segment.io",
    "branch.io",
    "appsflyer",
    "adjust.com",
    "nelo2",        # 네이버 에러 로그
    "naver-rcm",
    "wcs.naver.com",  # 네이버 분석
)

_BLOCK_RESOURCE_TYPES_DEFAULT = {"font", "media"}


# 차단 면제 도메인 — 이 도메인의 모든 요청은 통과 (NetFunnel JS 의존성 보존)
_BLOCKER_BYPASS_HOSTS = (
    "lgtwins.com",
    "mylgid.com",
    "ticketlink.co.kr",
    "netfunnel",          # nf*.netfunnel.com 등 NetFunnel 인프라
    "toastoven.net",      # 티켓링크 정적 리소스 CDN
)


async def install_resource_blocker_on_context(context: BrowserContext):
    """컨텍스트 단위 리소스 차단 (모든 페이지/새 탭에 자동 적용).

    핵심 도메인(_BLOCKER_BYPASS_HOSTS)은 무조건 통과 — NetFunnel/티켓링크 JS 의 외부 의존성
    (네이버 WCS, 일부 분석 트래커) 까지도 살려둬야 정상 시그널로 인식됨.
    제3자 광고/트래커만 외부 도메인에서 차단.
    """
    async def _route(route):
        try:
            req = route.request
            rtype = req.resource_type
            url = req.url

            # 1) 핵심 도메인은 무조건 통과 (NetFunnel/티켓링크/lgtwins/mylgid)
            if any(h in url for h in _BLOCKER_BYPASS_HOSTS):
                await route.continue_()
                return

            # 2) 외부 도메인의 리소스 타입 차단
            if rtype in _BLOCK_RESOURCE_TYPES_DEFAULT:
                await route.abort()
                return
            # 3) 외부 도메인의 광고/추적 차단
            if any(d in url for d in _BLOCK_DOMAINS):
                await route.abort()
                return

            await route.continue_()
        except Exception:
            try:
                await route.continue_()
            except Exception:
                pass

    await context.route("**/*", _route)


async def create_page(context: BrowserContext) -> Page:
    """새 페이지(탭) 생성. dialog 핸들러는 컨텍스트 단위 등록으로 자동 부착."""
    page = await context.new_page()
    page.set_default_timeout(15000)
    page.set_default_navigation_timeout(30000)
    return page


# 페이지별 dialog 카운트 — 같은 메시지 반복 시 무한 루프로 간주 후 close
_DIALOG_COUNTS: dict = {}
_DIALOG_LIMIT = 3


async def _handle_dialog(dialog, page=None):
    """JS dialog 자동 처리. 같은 메시지 _DIALOG_LIMIT 회 이상 뜨면 페이지 자동 close."""
    msg = dialog.message
    print(f"  🔔 JS dialog [{dialog.type}]: {msg[:200]}")
    try:
        await dialog.accept()
    except Exception as e:
        print(f"  ⚠️ dialog accept 실패: {e}")
        return

    # 무한 루프 감지
    if page is None:
        return
    key = (id(page), msg[:120])
    _DIALOG_COUNTS[key] = _DIALOG_COUNTS.get(key, 0) + 1
    if _DIALOG_COUNTS[key] >= _DIALOG_LIMIT:
        print(f"  🚨 같은 dialog {_DIALOG_LIMIT}회 — 무한 루프로 간주, 페이지 close")
        try:
            await page.close()
        except Exception:
            pass


def _attach_dialog_handler(page):
    """새로 떠는 페이지에 dialog 핸들러 자동 등록"""
    page.on("dialog", lambda d: asyncio.ensure_future(_handle_dialog(d, page)))
    page.on("console", lambda msg: _on_console(page, msg))
    print(f"  📄 새 페이지 핸들러 등록: {page.url or '(loading)'}")


def _on_console(page, msg):
    t = msg.type
    if t in ("error", "warning"):
        try:
            text = msg.text[:200]
        except Exception:
            text = "(?)"
        print(f"  📢 console.{t}: {text}")


async def human_delay(min_ms: int = 500, max_ms: int = 1500):
    """사람처럼 랜덤 딜레이"""
    delay = random.randint(min_ms, max_ms)
    await asyncio.sleep(delay / 1000)


async def human_mouse_move(page: Page, steps: int = 8):
    """페이지 위에서 사람처럼 마우스를 살짝 움직임 (탐지 우회용 워밍업)

    - 클릭 직전 호출하면 자동화 휴리스틱 점수를 낮추는 데 도움
    - 화면 밖으로 안 나가도록 viewport 범위 내에서만 이동
    """
    try:
        viewport = page.viewport_size or {"width": 1920, "height": 1080}
        w, h = viewport["width"], viewport["height"]
        # 화면 가운데 부근에서 시작
        x, y = w / 2 + random.randint(-100, 100), h / 2 + random.randint(-100, 100)
        await page.mouse.move(x, y)
        for _ in range(steps):
            dx = random.randint(-80, 80)
            dy = random.randint(-60, 60)
            x = max(20, min(w - 20, x + dx))
            y = max(20, min(h - 20, y + dy))
            await page.mouse.move(x, y, steps=random.randint(3, 8))
            await asyncio.sleep(random.uniform(0.03, 0.12))
    except Exception:
        # 마우스 움직임 실패는 비치명적
        pass


async def human_click(page: Page, locator, description: str = ""):
    """사람처럼 클릭 (랜덤 딜레이 + 마우스 워밍업 포함)"""
    await human_delay(300, 800)
    # 50% 확률로 마우스 살짝 움직여서 자연스럽게
    if random.random() < 0.5:
        await human_mouse_move(page, steps=random.randint(3, 6))
    await locator.click()
    if description:
        print(f"  ✅ {description}")
    await human_delay(500, 1200)


async def human_click_at(page: Page, locator, description: str = ""):
    """좌표 기반 사람 같은 클릭 — mouseDown → 약간 대기 → mouseUp.

    button.click() 은 mouseDown/mouseUp 사이 0ms — 봇 시그널.
    사람은 30~120ms 사이.
    """
    try:
        box = await locator.bounding_box()
        if box is None:
            # 폴백
            await locator.click()
            return
        x = box["x"] + box["width"] * (0.3 + random.random() * 0.4)
        y = box["y"] + box["height"] * (0.3 + random.random() * 0.4)
        # 마우스 이동 (사람처럼 여러 스텝)
        await page.mouse.move(x, y, steps=random.randint(5, 12))
        await asyncio.sleep(random.uniform(0.05, 0.2))
        await page.mouse.down()
        await asyncio.sleep(random.uniform(0.04, 0.12))  # 클릭 hold 시간
        await page.mouse.up()
        if description:
            print(f"  ✅ {description}")
    except Exception as e:
        print(f"  ⚠️ human_click_at 실패, locator.click() 폴백: {e}")
        await locator.click()


# === NetFunnel / 봇 탐지 감지 유틸 ===

NETFUNNEL_HINTS = (
    "비정상적인 접근",
    "비정상 활동",
    "정상적인 접근이 아닙니다",
    "접근이 차단",
    "NetFunnel",
    "잠시 후 다시",
)


async def detect_bot_block(page: Page) -> tuple[bool, str]:
    """봇 탐지/NetFunnel 차단 페이지 여부 확인.

    Returns:
        (차단됨, 감지된 사유 문구)
    """
    try:
        url = page.url
        if "error" in url.lower():
            try:
                body_text = await page.locator("body").text_content()
                body_text = (body_text or "")[:1000]
            except Exception:
                body_text = ""

            for hint in NETFUNNEL_HINTS:
                if hint in body_text:
                    return True, hint
            # URL은 error지만 본문에 힌트가 없으면 일반 에러 페이지일 수 있음
            return True, f"error URL: {url}"

        # URL이 정상이어도 본문에 NetFunnel 힌트가 있을 수 있음
        try:
            body_text = await page.locator("body").text_content()
            body_text = (body_text or "")[:1500]
            for hint in NETFUNNEL_HINTS:
                if hint in body_text:
                    return True, hint
        except Exception:
            pass
    except Exception:
        pass
    return False, ""


