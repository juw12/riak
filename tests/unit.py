"""Run Riak's browser unit tests plus static checks (no purple, no emoji).

Usage: python tests/unit.py            -> prints a JSON summary, exit 0 when everything passes
Needs: Playwright for Python (chromium).
"""
import colorsys
import functools
import http.server
import json
import re
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 18942
BANNED_HUE = (235, 335)

EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F900-\U0001F9FF\U00002B00-\U00002BFF\uFE0F]"
)
HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")


def hue_of(hex_value):
    h = hex_value.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hue, light, sat = colorsys.rgb_to_hls(r, g, b)
    return hue * 360, sat, light


def static_checks():
    purple = []
    emoji = []
    files = [p for p in ROOT.rglob("*") if p.suffix in {".js", ".css", ".html", ".webmanifest", ".md"}]
    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith(("tests/", "design-run/", "docs/hone/")):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in HEX.finditer(text):
            hue, sat, _ = hue_of(match.group(0))
            if sat >= 0.12 and BANNED_HUE[0] <= hue <= BANNED_HUE[1]:
                purple.append(f"{rel}: {match.group(0)}")
        for match in EMOJI.finditer(text):
            emoji.append(f"{rel}: U+{ord(match.group(0)):04X}")
    return purple, emoji


def browser_tests():
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    errors = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://127.0.0.1:{PORT}/tests/unit.html")
            for _ in range(80):
                if page.evaluate("window.__done === true"):
                    break
                page.wait_for_timeout(250)
            results = page.evaluate("window.__results")
            browser.close()
    finally:
        server.shutdown()
    return results, errors


def main():
    print('static checks...', file=sys.stderr, flush=True)
    purple, emoji = static_checks()
    print('browser tests...', file=sys.stderr, flush=True)
    results, errors = browser_tests()
    print('done', file=sys.stderr, flush=True)
    failed = [r for r in results if not r["ok"]]
    summary = {
        "tests": len(results),
        "passed": len(results) - len(failed),
        "failed": failed,
        "page_errors": errors,
        "purple_hex": purple,
        "emoji": emoji,
    }
    ok = not failed and not errors and not purple and not emoji
    summary["ok"] = ok
    print(json.dumps(summary, indent=1))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
