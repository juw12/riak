"""Serve the app folder locally and take screenshots with Playwright.

Usage:
  python tests/shoot.py <page> <out_prefix> [--sizes 390x844,1440x900] [--wait 2500] [--js "code"] [--full]

Prints console errors and page errors as JSON on the last line.
"""
import argparse
import http.server
import json
import os
import socketserver
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def serve():
    handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(*a, directory=str(ROOT), **k)
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd.server_address[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("page")
    ap.add_argument("out")
    ap.add_argument("--sizes", default="390x844,1440x900")
    ap.add_argument("--wait", type=int, default=2500)
    ap.add_argument("--js", action="append", default=[])
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--dark", action="store_true")
    args = ap.parse_args()
    for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
        os.environ.pop(k, None)
    os.environ["NO_PROXY"] = "localhost,127.0.0.1"
    port = serve()
    from playwright.sync_api import sync_playwright

    errors = []
    outputs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--proxy-bypass-list=127.0.0.1;localhost", "--no-proxy-server"])
        for size in args.sizes.split(","):
            w, h = (int(v) for v in size.split("x"))
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, color_scheme="dark" if args.dark else "light")
            page = ctx.new_page()
            page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.goto(f"http://127.0.0.1:{port}/{args.page}")
            page.wait_for_timeout(args.wait)
            for code in args.js:
                if code.startswith("wait:"):
                    page.wait_for_timeout(int(code[5:]))
                    continue
                try:
                    res = page.evaluate(code)
                    if res is not None:
                        outputs.append(res)
                except Exception as e:  # noqa: BLE001
                    errors.append(f"js error: {e}")
                page.wait_for_timeout(400)
            overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            out = f"{args.out}-{w}.png"
            Path(out).parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=out, full_page=args.full)
            outputs.append({"size": size, "overflow": overflow, "file": out})
            ctx.close()
        browser.close()
    print(json.dumps({"errors": errors, "outputs": outputs}))
    sys.stdout.flush()
    os._exit(0)


if __name__ == "__main__":
    main()
