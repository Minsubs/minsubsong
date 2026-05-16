"""
캡처 결과를 사람이 빠르게 훑는 도구.

사용법:
    python inspect_capture.py                     # 최신 캡처 디렉토리 자동
    python inspect_capture.py captures/2026...   # 특정 디렉토리
    python inspect_capture.py --keyword 3루       # 텍스트 키워드로 요소 필터
    python inspect_capture.py --suggest seat      # 좌석 셀렉터 후보 추천
"""
import argparse
import json
import sys
from pathlib import Path
from collections import Counter


def find_latest_capture(root: Path) -> Path | None:
    captures = root / "captures"
    if not captures.exists():
        return None
    subs = sorted([d for d in captures.iterdir() if d.is_dir()])
    return subs[-1] if subs else None


def _load_json_files(capture_dir: Path) -> list[tuple[Path, dict]]:
    out = []
    for f in sorted(capture_dir.glob("capture_*.json")):
        try:
            out.append((f, json.loads(f.read_text())))
        except Exception as e:
            print(f"  ⚠️ 파싱 실패 {f.name}: {e}")
    return out


def summary(capture_dir: Path):
    print(f"\n📂 {capture_dir}")
    print("=" * 70)
    for f, data in _load_json_files(capture_dir):
        print(f"\n▶ {f.name}")
        print(f"  URL    : {data.get('url')}")
        print(f"  Title  : {data.get('title')}")
        print(f"  Body cls: {(data.get('bodyClass') or '')[:80]}")
        svgs = data.get("svgs", [])
        if svgs:
            big = max(svgs, key=lambda s: s.get("rectCount", 0) + s.get("gCount", 0))
            print(f"  SVG    : {len(svgs)}개 (가장 큰 SVG → rect={big.get('rectCount')} g={big.get('gCount')} viewBox={big.get('viewBox')})")
        if data.get("canvases"):
            print(f"  Canvas : {len(data['canvases'])}개 ← 좌석맵이 canvas 일 가능성")
        print(f"  seat-like: {data.get('seatLikeTotal')}개")
        print(f"  clickable: {data.get('clickableTotal')}개")
        print(f"  inputs : {len(data.get('inputs', []))}개")
        # 스텝 표시
        steps = [s["text"] for s in data.get("steps", []) if s.get("text")]
        if steps:
            print(f"  steps  : {steps[:5]}")


def keyword_search(capture_dir: Path, keyword: str):
    """텍스트에 키워드가 포함된 요소만 추려서 셀렉터 후보 제안"""
    print(f"\n🔎 '{keyword}' 포함 요소 검색")
    print("=" * 70)
    for f, data in _load_json_files(capture_dir):
        matches = []
        for bucket in ("clickable", "seatLike", "headings"):
            for el in data.get(bucket, []):
                txt = el.get("text", "") or ""
                if keyword in txt:
                    matches.append((bucket, el))
        if not matches:
            continue
        print(f"\n▶ {f.name}  ({len(matches)}건)")
        for bucket, el in matches[:20]:
            cls = el.get("class", "")
            tag = el.get("tag", "")
            txt = (el.get("text") or "").replace("\n", " ").strip()
            print(f"  [{bucket:>10}] <{tag}> class='{cls[:60]}'  text='{txt[:50]}'")


def suggest_selectors(capture_dir: Path, target: str):
    """target 키워드(seat/zone/area/grade 등) 로 셀렉터 후보 추천"""
    print(f"\n💡 '{target}' 셀렉터 후보 추천")
    print("=" * 70)
    target_l = target.lower()
    class_token_counter: Counter = Counter()
    tag_counter: Counter = Counter()
    data_attr_counter: Counter = Counter()

    for _, data in _load_json_files(capture_dir):
        for el in data.get("seatLike", []) + data.get("clickable", []):
            cls = (el.get("class") or "").lower()
            if target_l not in cls:
                continue
            tag_counter[el.get("tag")] += 1
            for token in cls.split():
                if target_l in token:
                    class_token_counter[token] += 1
            for k in (el.get("dataAttrs") or {}).keys():
                data_attr_counter[k] += 1

    print(f"\n  태그 분포:")
    for tag, n in tag_counter.most_common(10):
        print(f"    {tag:>10}  ×{n}")

    print(f"\n  자주 등장하는 class 토큰 (이걸로 셀렉터 좁히기):")
    for tok, n in class_token_counter.most_common(15):
        print(f"    .{tok}  ×{n}")
        # CSS 셀렉터 예시 같이
        print(f"      → page.locator('.{tok}')  또는  page.locator('[class*=\"{tok}\"]')")

    if data_attr_counter:
        print(f"\n  data-* 속성 (가장 안정적인 셀렉터):")
        for k, n in data_attr_counter.most_common(10):
            print(f"    [{k}]  ×{n}")
            print(f"      → page.locator('[{k}]')")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default=None, help="capture 디렉토리 (생략 시 최신)")
    parser.add_argument("--keyword", "-k", help="텍스트 키워드 검색")
    parser.add_argument("--suggest", "-s", help="해당 키워드로 셀렉터 후보 추천")
    args = parser.parse_args()

    root = Path(__file__).parent
    if args.path:
        cap_dir = Path(args.path)
        if not cap_dir.is_absolute():
            cap_dir = root / cap_dir
    else:
        cap_dir = find_latest_capture(root)
        if not cap_dir:
            print("❌ captures/ 폴더에 결과가 없습니다. 먼저 `python analyze_dom.py` 실행하세요.")
            sys.exit(1)

    if not cap_dir.exists():
        print(f"❌ 디렉토리 없음: {cap_dir}")
        sys.exit(1)

    if args.suggest:
        suggest_selectors(cap_dir, args.suggest)
    elif args.keyword:
        keyword_search(cap_dir, args.keyword)
    else:
        summary(cap_dir)


if __name__ == "__main__":
    main()
