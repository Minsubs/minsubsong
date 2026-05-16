"""
티켓링크 DOM 분석 도구 (인터랙티브)

사용법:
    python analyze_dom.py                    # 인터랙티브 모드 (권장)
    python analyze_dom.py --auto             # 기존 자동 모드 (로그인까지)
    python analyze_dom.py --label seat       # 캡처 라벨 지정

인터랙티브 모드 흐름:
    1. 브라우저가 lgtwins.com 로그인 페이지로 자동 이동
    2. 본인이 직접 로그인 (봇 탐지 회피)
    3. 분석하고 싶은 페이지로 직접 이동
    4. 터미널에서 [Enter] 입력하면 그 시점 DOM 캡처
    5. q + [Enter] 로 종료

결과물 ( captures/{timestamp}/ ):
    - capture_{n}_{label}.json    : 추출된 DOM 메타데이터
    - capture_{n}_{label}.html    : 전체 HTML
    - capture_{n}_{label}.png     : 스크린샷
    - capture_{n}_{label}.url     : 그 시점 URL
"""
import asyncio
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from browser import create_browser, create_context, create_page
from config import LOGIN_URL


# 캡처할 DOM 메타데이터 (모든 단계 공통)
EXTRACT_SCRIPT = """
() => {
    const info = {
        url: location.href,
        title: document.title,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        meta: {},
    };

    // 1) 좌석맵 후보 식별: SVG / Canvas / 좌석 컨테이너
    info.svgs = Array.from(document.querySelectorAll('svg')).map(svg => ({
        id: svg.id,
        class: svg.getAttribute('class'),
        width: svg.getAttribute('width'),
        height: svg.getAttribute('height'),
        viewBox: svg.getAttribute('viewBox'),
        childTags: [...new Set(Array.from(svg.children).map(c => c.tagName))],
        rectCount: svg.querySelectorAll('rect').length,
        circleCount: svg.querySelectorAll('circle').length,
        pathCount: svg.querySelectorAll('path').length,
        gCount: svg.querySelectorAll('g').length,
    }));

    info.canvases = Array.from(document.querySelectorAll('canvas')).map(c => ({
        id: c.id,
        class: c.className,
        width: c.width,
        height: c.height,
        rectVisible: c.getBoundingClientRect(),
    }));

    // 2) 좌석/구역 후보 (class 에 seat/zone/area/grade/block 포함)
    const SEAT_KEYWORDS = ['seat', 'zone', 'area', 'grade', 'block', 'section'];
    const seatLike = [];
    document.querySelectorAll('*').forEach(el => {
        const cls = (el.className && el.className.toString) ? el.className.toString().toLowerCase() : '';
        const id = (el.id || '').toLowerCase();
        if (SEAT_KEYWORDS.some(k => cls.includes(k) || id.includes(k))) {
            seatLike.push({
                tag: el.tagName,
                id: el.id,
                class: el.className.toString().substring(0, 100),
                role: el.getAttribute('role'),
                ariaLabel: el.getAttribute('aria-label'),
                dataAttrs: Object.fromEntries(
                    Array.from(el.attributes || [])
                        .filter(a => a.name.startsWith('data-'))
                        .slice(0, 5)
                        .map(a => [a.name, a.value.substring(0, 50)])
                ),
                text: (el.textContent || '').trim().substring(0, 40),
                childCount: el.children.length,
                clickable: el.tagName === 'A' || el.tagName === 'BUTTON' || el.onclick != null,
            });
        }
    });
    info.seatLike = seatLike.slice(0, 80);
    info.seatLikeTotal = seatLike.length;

    // 3) 클릭 가능 요소 (a / button / role=button / [class*=btn])
    const clickable = [];
    document.querySelectorAll('a, button, [role="button"], [class*="btn"], input[type="button"], input[type="submit"]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // 안 보이는 건 제외
        clickable.push({
            tag: el.tagName,
            id: el.id,
            class: (el.className && el.className.toString) ? el.className.toString().substring(0, 80) : '',
            text: (el.textContent || '').trim().substring(0, 50),
            href: el.getAttribute('href'),
            disabled: el.disabled || false,
            visible: rect.top < window.innerHeight && rect.bottom > 0,
        });
    });
    info.clickable = clickable.slice(0, 120);
    info.clickableTotal = clickable.length;

    // 4) 입력 필드 (폼/매수/할인 등)
    info.inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        class: el.className.toString().substring(0, 60),
        value: (el.value || '').substring(0, 40),
        placeholder: el.placeholder,
        options: el.tagName === 'SELECT'
            ? Array.from(el.options).slice(0, 10).map(o => ({ value: o.value, text: o.text }))
            : undefined,
    }));

    // 5) 단계/스텝 표시 UI
    info.steps = Array.from(document.querySelectorAll('[class*="step"], [class*="tab"], [class*="progress"], [class*="stage"]')).slice(0, 12).map(el => ({
        tag: el.tagName,
        class: el.className.toString().substring(0, 80),
        text: (el.textContent || '').trim().substring(0, 100),
    }));

    // 6) 주요 텍스트 노드 (페이지 식별에 도움)
    info.headings = Array.from(document.querySelectorAll('h1, h2, h3, [class*="title"]')).slice(0, 15).map(el => ({
        tag: el.tagName,
        class: el.className.toString().substring(0, 60),
        text: (el.textContent || '').trim().substring(0, 80),
    }));

    // 7) iframe (티켓링크는 결제/좌석 일부를 iframe 으로 띄움)
    info.iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
        src: f.src,
        id: f.id,
        name: f.name,
        class: f.className,
    }));

    // 8) body 클래스 (페이지 타입 식별)
    info.bodyClass = document.body.className;

    return info;
}
"""


def _make_capture_dir() -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = Path(__file__).parent / "captures" / ts
    out.mkdir(parents=True, exist_ok=True)
    return out


async def _capture(page, out_dir: Path, n: int, label: str):
    """현재 페이지 상태를 파일로 저장"""
    safe_label = "".join(c if c.isalnum() or c in "-_" else "_" for c in label) or "step"
    base = out_dir / f"capture_{n:02d}_{safe_label}"

    # URL
    url = page.url
    (base.with_suffix(".url")).write_text(url + "\n")

    # 메타데이터 추출
    try:
        info = await page.evaluate(EXTRACT_SCRIPT)
    except Exception as e:
        print(f"  ⚠️ evaluate 실패: {e}")
        info = {"error": str(e), "url": url}

    (base.with_suffix(".json")).write_text(
        json.dumps(info, indent=2, ensure_ascii=False)
    )

    # 전체 HTML
    try:
        html = await page.content()
        (base.with_suffix(".html")).write_text(html)
    except Exception as e:
        print(f"  ⚠️ HTML 저장 실패: {e}")

    # 스크린샷
    try:
        await page.screenshot(path=str(base.with_suffix(".png")), full_page=True)
    except Exception as e:
        print(f"  ⚠️ 스크린샷 실패: {e}")

    # 콘솔 요약
    print(f"\n  📸 capture_{n:02d}_{safe_label}")
    print(f"     URL: {url}")
    print(f"     SVG: {len(info.get('svgs', []))}개 / Canvas: {len(info.get('canvases', []))}개")
    print(f"     seat-like 요소: {info.get('seatLikeTotal', 0)}개 (상위 80개 저장)")
    print(f"     클릭가능: {info.get('clickableTotal', 0)}개 / 입력필드: {len(info.get('inputs', []))}개")
    if info.get("svgs"):
        big_svg = max(info["svgs"], key=lambda s: s.get("rectCount", 0) + s.get("gCount", 0))
        print(f"     ⭐ 가장 큰 SVG: rect={big_svg.get('rectCount')} g={big_svg.get('gCount')} viewBox={big_svg.get('viewBox')}")
    if info.get("canvases"):
        print(f"     ⭐ Canvas 감지: 좌석맵이 canvas 일 가능성")


async def interactive_mode():
    """사용자가 직접 페이지 이동, [Enter] 마다 캡처"""
    print("=" * 60)
    print("  🔍 DOM 분석 도구 (인터랙티브 모드)")
    print("=" * 60)
    print("  1) 브라우저가 열리면 본인이 직접 로그인")
    print("  2) 분석할 페이지로 이동")
    print("  3) 터미널에서 라벨 입력 후 [Enter] (예: 'schedule', 'seat')")
    print("  4) q [Enter] 로 종료")
    print("=" * 60)

    out_dir = _make_capture_dir()
    print(f"\n  💾 저장 위치: {out_dir}\n")

    pw, browser = await create_browser(headless=False, slow_mo=0)
    context = await create_context(browser)
    page = await create_page(context)

    # 새로 열린 페이지(예: 예매 팝업) 추적
    extra_pages = [page]
    context.on("page", lambda p: extra_pages.append(p))

    try:
        await page.goto(LOGIN_URL, wait_until="domcontentloaded")
        print("👉 브라우저에서 직접 로그인하세요. 끝나면 라벨 입력하고 [Enter].\n")

        n = 1
        while True:
            try:
                # 입력은 동기 — 백그라운드에서 페이지는 그대로
                label = await asyncio.get_event_loop().run_in_executor(
                    None, input, f"  [{n:02d}] 라벨 (또는 'q' 종료, 'list' 탭목록, 't <번호>' 탭선택): "
                )
            except (EOFError, KeyboardInterrupt):
                break

            label = label.strip()
            if label.lower() in ("q", "quit", "exit"):
                break

            if label.lower() == "list":
                print("  현재 열린 페이지/탭:")
                for i, p in enumerate(extra_pages):
                    closed = "(closed)" if p.is_closed() else ""
                    try:
                        u = p.url if not p.is_closed() else "(closed)"
                    except Exception:
                        u = "(?)"
                    print(f"    [{i}] {u} {closed}")
                continue

            if label.lower().startswith("t "):
                try:
                    idx = int(label.split()[1])
                    if 0 <= idx < len(extra_pages) and not extra_pages[idx].is_closed():
                        page = extra_pages[idx]
                        print(f"  🔀 활성 페이지 전환: {page.url}")
                    else:
                        print("  ⚠️ 유효하지 않은 탭 번호")
                except (ValueError, IndexError):
                    print("  ⚠️ 사용법: t <번호>")
                continue

            if not label:
                label = f"step{n}"

            await _capture(page, out_dir, n, label)
            n += 1

        print(f"\n  ✅ 총 {n-1}개 캡처 완료")
        print(f"  💾 {out_dir}")
    finally:
        try:
            await browser.close()
        except Exception:
            pass
        try:
            await pw.stop()
        except Exception:
            pass


async def auto_mode():
    """기존 자동 모드 (로그인 → 예매 버튼 클릭 → 분석)"""
    from login import login
    from config import TICKET_URL

    out_dir = _make_capture_dir()
    print(f"  💾 저장 위치: {out_dir}\n")

    pw, browser = await create_browser()
    context = await create_context(browser)
    page = await create_page(context)

    new_pages = [page]
    context.on("page", lambda p: new_pages.append(p))

    try:
        await login(page)
        await _capture(page, out_dir, 1, "after_login")

        await page.goto(TICKET_URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        await _capture(page, out_dir, 2, "ticket_general")

        btn = page.locator('text="홈구장 티켓 예매하기"').first
        if await btn.count() > 0:
            await btn.click()
            await page.wait_for_timeout(8000)

        bp = new_pages[-1]
        if not bp.is_closed():
            await bp.wait_for_timeout(3000)
            await _capture(bp, out_dir, 3, "booking_window")
    finally:
        try:
            await browser.close()
        except Exception:
            pass
        try:
            await pw.stop()
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser(description="티켓링크 DOM 분석 도구")
    parser.add_argument("--auto", action="store_true", help="자동 모드 (로그인부터 자동, 봇 탐지 위험)")
    args = parser.parse_args()

    if args.auto:
        asyncio.run(auto_mode())
    else:
        asyncio.run(interactive_mode())


if __name__ == "__main__":
    main()
