"""
Stealth init script smoke test.

목적: 외부 사이트 안 가고, navigator/window 속성만 검증해서
      browser.py 의 STEALTH_INIT_SCRIPT 가 정상 주입되는지 확인.
"""
import asyncio
from browser import create_browser, create_context, create_page


CHECK_SCRIPT = """
() => ({
    webdriver: navigator.webdriver,
    pluginsLen: navigator.plugins.length,
    pluginNames: Array.from(navigator.plugins).map(p => p.name),
    languages: navigator.languages,
    chromeRuntime: typeof window.chrome,
    chromeRuntimeKeys: window.chrome ? Object.keys(window.chrome) : [],
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
})
"""

WEBGL_CHECK = """
() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return { error: 'no webgl' };
    return {
        vendor: gl.getParameter(37445),
        renderer: gl.getParameter(37446),
    };
}
"""


def _expect(name, actual, predicate, expected_desc):
    status = "✅" if predicate(actual) else "❌"
    print(f"  {status} {name:25} = {actual!r:50}  (expected: {expected_desc})")
    return predicate(actual)


async def main():
    print("🧪 Stealth Smoke Test")
    print("=" * 70)

    pw, browser = await create_browser(headless=True, slow_mo=0)
    context = await create_context(browser)
    page = await create_page(context)

    try:
        await page.goto("about:blank")
        result = await page.evaluate(CHECK_SCRIPT)
        webgl = await page.evaluate(WEBGL_CHECK)

        print("\n[navigator / window checks]")
        ok = []
        ok.append(_expect("navigator.webdriver", result["webdriver"], lambda v: v is None, "undefined/None"))
        ok.append(_expect("plugins.length",       result["pluginsLen"], lambda v: v >= 3,     ">= 3"))
        ok.append(_expect("languages",            result["languages"],  lambda v: "ko-KR" in (v or []), "ko-KR 포함"))
        ok.append(_expect("window.chrome type",   result["chromeRuntime"], lambda v: v == "object", "object"))
        ok.append(_expect("chrome 키",            result["chromeRuntimeKeys"], lambda v: "runtime" in v, "runtime 키 있음"))
        ok.append(_expect("hardwareConcurrency",  result["hardwareConcurrency"], lambda v: v == 8, "8"))
        ok.append(_expect("deviceMemory",         result["deviceMemory"], lambda v: v == 8, "8"))
        ok.append(_expect("platform",             result["platform"], lambda v: v == "MacIntel", "MacIntel"))
        ua = result["userAgent"]
        ua_preview = ua[:40] + "..." + ua[-30:] if len(ua) > 70 else ua
        ok.append(_expect("userAgent (Chrome)", ua_preview, lambda _v: "Chrome" in ua, "Chrome 포함"))

        print("\n[WebGL]")
        ok.append(_expect("webgl vendor",   webgl.get("vendor"),   lambda v: "Intel" in (v or ""), "Intel 포함"))
        ok.append(_expect("webgl renderer", webgl.get("renderer"), lambda v: "Intel" in (v or ""), "Intel 포함"))

        passed = sum(ok)
        total = len(ok)
        print(f"\n{'=' * 70}")
        print(f"결과: {passed}/{total} 통과")
        if passed < total:
            print("⚠️ 일부 stealth 항목 실패 — STEALTH_INIT_SCRIPT 점검 필요")
        else:
            print("🎉 모든 stealth 항목 정상 주입됨")

        # 봇 탐지 감지 함수도 검증 (정상 페이지면 False 여야 함)
        from browser import detect_bot_block
        blocked, reason = await detect_bot_block(page)
        print(f"\n[detect_bot_block]")
        print(f"  about:blank → blocked={blocked} reason='{reason}'  (정상 페이지여야 False)")

    finally:
        await browser.close()
        await pw.stop()


if __name__ == "__main__":
    asyncio.run(main())
