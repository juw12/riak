"""End-to-end smoke test for Riak. Serves the app, walks every panel and main flow, screenshots, reports errors.

Usage: python tests/smoke.py [--sizes 390x844,1440x900] [--out ../shots/smoke]
Prints JSON on the last line: {"errors": [...], "checks": {...}, "overflow": {...}}
"""
import argparse
import http.server
import json
import re
import os
import socketserver
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIN_HOUR = int(os.environ.get("RIAK_SMOKE_HOUR", "14"))
CLOCK_PIN = """(() => {
  const RealDate = Date;
  const target = new RealDate();
  target.setHours(__HOUR__, 0, 0, 0);
  const offset = target.getTime() - RealDate.now();
  class PinnedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...args);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  window.Date = PinnedDate;
})();"""


SYSTEM_CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def serve():
    handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(*a, directory=str(ROOT), **k)
    http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd.server_address[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sizes", default="390x844,1440x900")
    ap.add_argument("--out", default=str(ROOT.parent / "shots" / "smoke"))
    ap.add_argument("--dark", action="store_true")
    args = ap.parse_args()
    for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
        os.environ.pop(k, None)
    port = serve()
    from playwright.sync_api import sync_playwright

    errors = []
    checks = {}
    overflow = {}
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(args=["--no-proxy-server"])
        except Exception:
            # Playwright's bundled shell can lag behind a library upgrade; fall back to installed Chrome
            browser = p.chromium.launch(executable_path=SYSTEM_CHROME, args=["--no-proxy-server"])
        for size in args.sizes.split(","):
            w, h = (int(v) for v in size.split("x"))
            ctx = browser.new_context(viewport={"width": w, "height": h}, color_scheme="dark" if args.dark else "light")
            # Pin the local time of day so screenshots do not depend on when the test runs
            # (tank lights, fishing day phase and weather all follow the clock).
            ctx.add_init_script(CLOCK_PIN.replace("__HOUR__", str(PIN_HOUR)))
            page = ctx.new_page()
            page.on("console", lambda m: errors.append(f"{size} console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e: errors.append(f"{size} pageerror: {e}"))
            page.goto(f"http://127.0.0.1:{port}/index.html")
            page.wait_for_timeout(1200)
            try:
                run_flow(page, ctx, size, w, out, errors, checks, overflow, port)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{size} FLOW FAILED: {str(exc).splitlines()[0]}")
                page.screenshot(path=str(out / f"fail-{w}.png"))
            ctx.close()
        browser.close()
    print(json.dumps({"errors": errors, "checks": checks, "overflow": {k: v for k, v in overflow.items() if v}}))
    sys.stdout.flush()
    os._exit(0)


def run_flow(page, ctx, size, w, out, errors, checks, overflow, port):
    if True:
        if True:

            def shot(name):
                page.wait_for_timeout(500)
                overflow[f"{name}-{w}"] = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                page.screenshot(path=str(out / f"{name}-{w}.png"))

            def close_sheets():
                page.evaluate("document.querySelectorAll('.sheet-head .btn').forEach(b => b.click())")
                page.wait_for_timeout(300)

            # onboarding
            page.get_by_role("radio", name="Neon tetras: a school of six").click()
            page.get_by_role("button", name="Fill the tank").click()
            page.wait_for_timeout(1500)
            checks[f"fish-{w}"] = page.evaluate("riak.core.fishIn(riak.core.activeTank().id).length")
            shot("tank")
            # feed: enter feed mode and tap the water a few times
            page.click('.tool[data-tool="feed"]')
            box = page.locator("#tankCanvas").bounding_box()
            for i in range(3):
                page.mouse.click(box["x"] + box["width"] * (0.3 + i * 0.2), box["y"] + box["height"] * 0.3)
                page.wait_for_timeout(200)
            page.wait_for_timeout(3500)
            checks[f"fed-{w}"] = page.evaluate("riak.core.S().stats.fed")
            shot("feed")
            page.click(".modebar .btn.primary")
            # care sheet + test water
            page.click('.tool[data-tool="care"]')
            page.wait_for_timeout(300)
            page.locator(".sheet").get_by_role("button", name="Test the water").click()
            shot("care")
            close_sheets()
            # clean mode: drag across the glass
            page.evaluate("riak.core.activeTank().w.glass = 0.6")
            page.evaluate("riak.app.panels.tank.setMode('clean')")
            for row in range(8):
                y = box["y"] + box["height"] * (0.08 + row * 0.12)
                page.mouse.move(box["x"] + 2, y)
                page.mouse.down()
                page.mouse.move(box["x"] + box["width"] - 2, y, steps=12)
                page.mouse.up()
            page.wait_for_timeout(500)
            checks[f"glass-{w}"] = page.evaluate("riak.core.activeTank().w.glass")
            # fish card via residents
            page.evaluate("riak.app.panels.tank.setMode('view')")
            page.click('.tool[data-tool="fish"]')
            page.wait_for_timeout(300)
            shot("residents")
            page.locator(".sheet .list-row").first.click()
            shot("fishcard")
            close_sheets()
            # shop
            page.evaluate("riak.core.S().shells = 2000")
            page.click('.tool[data-tool="shop"]')
            page.wait_for_timeout(300)
            page.locator(".sheet .list-row .btn.primary").first.click()
            shot("shop")
            close_sheets()
            # scape mode
            page.click('.tool[data-tool="scape"]')
            page.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.6)
            shot("scape")
            page.click(".modebar .btn.primary")
            # share
            page.click('.tool[data-tool="share"]')
            page.wait_for_timeout(500)
            checks[f"share-{w}"] = page.evaluate("document.querySelector('.sheet input').value.includes('#visit=')")
            visit_link = page.evaluate("document.querySelector('.sheet input').value")
            close_sheets()
            # fishing
            page.evaluate("riak.app.go('fishing')")
            shot("fishing")
            page.locator(".spot:not([disabled])").first.click()
            page.wait_for_timeout(600)
            shot("scene")
            fp = "riak.app.panels.fishing"
            # flick cast: a real upward swipe on the water
            page.locator(".scene-wrap canvas").scroll_into_view_if_needed()
            cv = page.locator(".scene-wrap canvas").bounding_box()
            sx = cv["x"] + cv["width"] * 0.4
            # a player retries after "swipe up faster"; a loaded CI browser can slow the first flick
            for attempt in range(3):
                page.mouse.move(sx, cv["y"] + cv["height"] * 0.9)
                page.mouse.down()
                for i in range(1, 7):
                    page.mouse.move(sx + i * 2, cv["y"] + cv["height"] * (0.9 - i * 0.12), steps=1)
                    page.wait_for_timeout(8)
                page.mouse.up()
                page.wait_for_timeout(150)
                if page.evaluate(f"{fp}.stateName") != "idle":
                    break
            checks[f"flick-cast-{w}"] = page.evaluate(f"{fp}.stateName + ' ' + {fp}.castM + 'm'")
            page.wait_for_timeout(1200)
            # crank the reel in circles to retrieve
            page.locator(".crank").scroll_into_view_if_needed()
            crank = page.locator(".crank").bounding_box()
            cx = crank["x"] + crank["width"] / 2
            cy = crank["y"] + crank["height"] / 2
            page.mouse.move(cx + 40, cy)
            page.mouse.down()
            import math as _m
            for i in range(1, 40):
                a = i * 0.5
                page.mouse.move(cx + 40 * _m.cos(a), cy + 40 * _m.sin(a))
                page.wait_for_timeout(16)
            checks[f"crank-{w}"] = page.evaluate(f"Math.round({fp}.reelInput * 100) / 100")
            page.mouse.up()
            page.evaluate(f"{fp}.biteProgress = {fp}.biteNeed; {fp}.nibbles = []")
            page.wait_for_timeout(200)
            checks[f"bite-{w}"] = page.evaluate(f"{fp}.stateName")
            page.evaluate(f"{fp}.press(true)")
            page.wait_for_timeout(900)
            checks[f"fight-{w}"] = page.evaluate(f"{fp}.stateName")
            shot("fight")
            page.evaluate(f"{fp}.press(false)")
            page.evaluate(f"{fp}.landed(0.5)")
            page.wait_for_timeout(500)
            checks[f"caught-{w}"] = page.evaluate("riak.core.S().stats.caught")
            checks[f"landed-{w}"] = page.evaluate("riak.core.angler().landed")
            shot("catch")
            page.locator(".sheet .catch-share .btn").first.click()
            checks[f"album-{w}"] = page.evaluate("riak.core.angler().album.length")
            page.locator(".sheet-foot .btn").first.click()
            page.wait_for_timeout(300)
            # trophy card renders without throwing
            checks[f"trophy-{w}"] = page.evaluate("import('./js/anglerui.js').then(m => { const c = m.trophyCanvas(riak.core.angler().album[0]); return c.width + 'x' + c.height; })")
            # classic controls still work
            page.evaluate("riak.core.angler().controls = 'classic'")
            page.evaluate(f"{fp}.resetCast(); {fp}.press(true)")
            page.wait_for_timeout(500)
            page.evaluate(f"{fp}.press(false)")
            page.wait_for_timeout(1200)
            page.evaluate(f"{fp}.biteProgress = {fp}.biteNeed; {fp}.nibbles = []")
            page.wait_for_timeout(200)
            page.evaluate(f"{fp}.press(true)")
            page.wait_for_timeout(300)
            checks[f"classic-{w}"] = page.evaluate(f"{fp}.stateName")
            shot("classic")
            page.evaluate(f"{fp}.press(false); riak.core.angler().controls = 'flick'; {fp}.resetCast()")
            # tournament against the CPU anglers
            page.evaluate(f"{fp}.startTournament({{ spotId: 'pond', mode: 'bigcatch', seconds: 120, humans: 2 }})")
            page.wait_for_timeout(400)
            page.locator(".sheet-foot .btn").first.click()
            page.wait_for_timeout(600)
            checks[f"tourney-{w}"] = page.evaluate(f"!!{fp}.tourney && {fp}.tourney.running")
            shot("tournament")
            page.evaluate(f"{fp}.tourney.elapsed = 119.9")
            page.wait_for_timeout(500)
            page.locator(".sheet-foot .btn").first.click()
            page.wait_for_timeout(400)
            page.locator(".sheet-foot .btn").first.click()
            page.wait_for_timeout(300)
            page.evaluate(f"{fp}.tourney.elapsed = 119.9")
            page.wait_for_timeout(600)
            checks[f"tourney-done-{w}"] = page.evaluate(f"{fp}.tourney === null")
            shot("tournament-results")
            close_sheets()
            page.evaluate(f"{fp}.renderList()")
            page.wait_for_timeout(300)
            shot("fishing-list")
            page.get_by_role("button", name=re.compile("^Quests")).click()
            page.wait_for_timeout(300)
            shot("quests")
            close_sheets()
            page.get_by_role("button", name=re.compile("^Album")).click()
            page.wait_for_timeout(400)
            shot("album")
            close_sheets()
            # garden
            page.evaluate("riak.core.addXp(800)")
            page.evaluate("riak.app.go('garden')")
            page.wait_for_timeout(400)
            page.locator(".tray .btn.primary").first.click()
            page.wait_for_timeout(300)
            page.locator(".sheet .list-row .btn.primary").first.click()
            page.wait_for_timeout(300)
            page.evaluate("const tr = riak.core.S().greenhouse.trays[0]; if (tr.crop) { tr.crop.grown = tr.crop.need * 0.6; }")
            page.evaluate("riak.app.panels.garden.render()")
            shot("garden")
            # reef
            page.evaluate("riak.core.buyReef(); riak.core.buyStarterFrag(); riak.core.buyStarterFrag(); riak.core.S().reef.corals.forEach(c => c.g = 1.1)")
            page.evaluate("riak.app.panels.garden.tab = 'reef'; riak.app.panels.garden.render()")
            shot("reef")
            # journal
            page.evaluate("riak.app.go('journal')")
            shot("journal")
            page.locator(".dex-item").first.click()
            shot("journal-detail")
            close_sheets()
            # focus
            page.evaluate("riak.app.go('focus')")
            shot("focus")
            page.get_by_role("button", name="Start 25 min").click()
            page.wait_for_timeout(1200)
            shot("focus-running")
            page.get_by_role("button", name="End early").click()
            # koi pond
            page.evaluate("riak.app.go('pond')")
            page.wait_for_timeout(700)
            checks[f"pond-koi-{w}"] = page.evaluate("riak.app.panels.pond.koi.length")
            page.evaluate("riak.app.panels.pond.scatterFood()")
            page.wait_for_timeout(5000)
            checks[f"pond-eaten-{w}"] = page.evaluate("riak.app.panels.pond.eaten")
            shot("pond")
            # settings
            page.click("#settingsBtn")
            shot("settings")
            close_sheets()
            # language switch to Indonesian and back
            page.evaluate("riak.core.S().lang = 'id'")
            page.evaluate("riak.app.go('tank')")
            shot("tank-after")
            # watch mode
            page.evaluate("riak.app.panels.tank.enterWatch()")
            page.wait_for_timeout(600)
            shot("watch")
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            # visit link in a fresh page
            vp = ctx.new_page()
            vp.on("pageerror", lambda e: errors.append(f"{size} visit pageerror: {e}"))
            vp.goto(visit_link.replace("http://127.0.0.1", "http://127.0.0.1"))
            vp.wait_for_timeout(1500)
            checks[f"visit-{w}"] = vp.evaluate("!!riak.app.panels.tank.visit")
            vp.screenshot(path=str(out / f"visit-{w}.png"))
            vp.close()
            # reload: save persists
            page.reload()
            page.wait_for_timeout(1200)
            checks[f"persist-{w}"] = page.evaluate("riak.core.S().onboarded && riak.core.S().stats.caught")


if __name__ == "__main__":
    main()

