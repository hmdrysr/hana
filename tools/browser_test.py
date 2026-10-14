#!/usr/bin/env python3
"""Optional browser test for the app. Needs Python Playwright and Chromium, which are
NOT standard library, so this is not part of tools/check.py or tools/selftest.py.

    python3 -m http.server 8765        (in the repo root, in another terminal)
    python3 tools/browser_test.py http://localhost:8765/

Checks, at 320, 360, 768 and 1280 pixels wide, in light and dark mode:
- no sideways scrolling on any screen, at normal text size and at 200 percent;
- the restaurant list is in alphabetical order, and area filtering and search work;
- the one-restaurant rule asks before emptying the basket;
- the order message ends with a check line that tools/order_line.py accepts;
- add buttons and navigation are at least 40 pixels tall;
- no script errors.
Prints PASS or FAIL for each check and exits 1 on any failure.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import order_line  # noqa: E402

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/").rstrip("/") + "/index.html"
TAVA = "6c6cfbab5f1ad5a85d0ec7e83545bdb47077cea462f1868bcef6cc3d547d21d7"
MEAL = "bee9f4b3ba09a8f47ca77d741df138917ea6c584407e9b8a7418313d42340d9b"
SCREENS = ["", "#/r/" + TAVA, "#/basket", "#/orders", "#/about"]
failed = 0


def ok(name, cond, detail=""):
    global failed
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond or not detail else "  (" + str(detail) + ")"))
    failed += not cond


with sync_playwright() as p:
    browser = p.chromium.launch()
    errors = []
    for scheme in ("light", "dark"):
        for width in (320, 360, 768, 1280):
            for screen in SCREENS:
                page = browser.new_page(viewport={"width": width, "height": 800}, color_scheme=scheme)
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.goto(BASE + screen)
                page.wait_for_timeout(500)
                normal = page.evaluate("document.documentElement.scrollWidth - innerWidth")
                page.evaluate("document.documentElement.style.fontSize = '200%'")
                page.wait_for_timeout(150)
                large = page.evaluate("document.documentElement.scrollWidth - innerWidth")
                ok(f"no sideways scroll, {scheme}, {width}px, {screen[:6] or 'list'}", normal <= 0 and large <= 0, (normal, large))
                page.close()

    page = browser.new_page(viewport={"width": 360, "height": 800})
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_selector("#results article")
    names = lambda: page.eval_on_selector_all("#results .card-title", "e => e.map(x => x.textContent)")
    got = names()
    ok("list is alphabetical", got == sorted(got, key=str.lower), got)
    page.select_option("#area", "ccc")
    ok("whole-city area hides the Khulshi-only restaurant", "Tava Restaurant" not in names(), names())
    page.select_option("#area", "ward-14")
    ok("a Khulshi ward shows the Khulshi-only restaurant", "Tava Restaurant" in names(), names())
    page.fill("#q", "piza")
    ok("fuzzy search finds pizza", set(names()) == {"Meal Master", "Sliced"}, names())
    page.fill("#q", "")
    page.goto(BASE + "#/r/" + TAVA)
    page.wait_for_selector(".page-title")
    h = page.evaluate("document.querySelector('button.chip').getBoundingClientRect().height")
    n = page.evaluate("document.querySelector('#nav-bar a').getBoundingClientRect().height")
    ok("add buttons and navigation are at least 40px tall", h >= 40 and n >= 40, (h, n))
    page.click("button[aria-label^='Add Dahi Bara']")
    page.click("button[aria-label^='Add Dahi Bara']")
    page.goto(BASE + "#/r/" + MEAL)
    page.wait_for_selector(".page-title")
    page.click("button[aria-label^='Add French Fries']")
    page.wait_for_selector("dialog[open]")
    ok("second restaurant asks before emptying the basket", "one restaurant" in page.inner_text("#dialog-text"))
    page.click("#dialog-cancel")
    page.goto(BASE + "#/basket")
    page.wait_for_selector("#zone")
    page.fill("#name", "Test")
    page.fill("#address", "House 1, Road 2")
    page.click("button[type=submit]")
    page.wait_for_selector("pre")
    line = page.inner_text("pre").strip().splitlines()[-1]
    menu_bytes = (HERE.parent / "menus" / TAVA / "menu.json").read_bytes()
    res = order_line.decode(line, [(menu_bytes, json.loads(menu_bytes))])
    ok("order check line is accepted by tools/order_line.py", res["ok"] and res["subtotal_from_menu"] == 440, res)
    ok("no script errors", not errors, errors)
    browser.close()

print("\nFAILED" if failed else "\nAll browser checks passed.")
sys.exit(1 if failed else 0)
