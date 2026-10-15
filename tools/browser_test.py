#!/usr/bin/env python3
"""Optional browser test for the app. Needs Python Playwright and Chromium, which are
NOT standard library, so this is not part of tools/check.py or tools/selftest.py.

    python3 -m http.server 8765        (in the repo root, in another terminal)
    python3 tools/browser_test.py http://localhost:8765/

Checks, at 320, 360, 768 and 1280 pixels wide, in light and dark mode:
- no sideways scrolling and no text cut off on any screen, at normal text size and at 200 percent;
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

ROOT_URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/").rstrip("/")
BASE = ROOT_URL + "/index.html"
BIZ = ROOT_URL + "/business.html"
TAVA = "6c6cfbab5f1ad5a85d0ec7e83545bdb47077cea462f1868bcef6cc3d547d21d7"
MEAL = "bee9f4b3ba09a8f47ca77d741df138917ea6c584407e9b8a7418313d42340d9b"
SCREENS = [BASE, BASE + "#/r/" + TAVA, BASE + "#/basket", BASE + "#/orders", BASE + "#/about", BASE + "#/terms", BASE + "#/settings",
           BIZ, BIZ + "#/join", BIZ + "#/claim", BIZ + "#/confirm", BIZ + "#/update", BIZ + "#/site"]
failed = 0

# Finds text that is cut off: any text whose box extends past an ancestor that clips its overflow.
CLIPPED_TEXT = r"""(() => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest("dialog:not([open]), .snackbar:not(.active), script, style, option, select, textarea")) continue;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || el.getClientRects().length === 0) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    const rects = Array.from(r.getClientRects());
    if (!rects.length) continue;
    let a = el;
    while (a && a !== document.documentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX !== "visible" || s.overflowY !== "visible") {
        const b = a.getBoundingClientRect();
        for (const t of rects) {
          if (t.width === 0) continue;
          if (t.right > b.right + 1 || t.left < b.left - 1 || (s.overflowY !== "visible" && a !== document.body && (t.bottom > b.bottom + 1 || t.top < b.top - 1))) {
            out.push(el.tagName + "." + el.className + " in " + a.tagName + "." + a.className + ": " + n.nodeValue.trim().slice(0, 40));
            break;
          }
        }
      }
      a = a.parentElement;
    }
  }
  return Array.from(new Set(out));
})()"""


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
                page.goto(screen)
                page.wait_for_timeout(500)
                normal = page.evaluate("document.documentElement.scrollWidth - innerWidth")
                clipped = page.evaluate(CLIPPED_TEXT)
                page.evaluate("document.documentElement.style.fontSize = '200%'")
                page.wait_for_timeout(150)
                large = page.evaluate("document.documentElement.scrollWidth - innerWidth")
                clipped += page.evaluate(CLIPPED_TEXT)
                ok(f"no text cut off, {scheme}, {width}px, {screen.replace(ROOT_URL, '')}", not clipped, clipped[:3])
                ok(f"no sideways scroll, {scheme}, {width}px, {screen.replace(ROOT_URL, '')}", normal <= 0 and large <= 0, (normal, large))
                page.close()

    page = browser.new_page(viewport={"width": 360, "height": 800})
    page.on("pageerror", lambda e: errors.append(str(e)))
    # Fix the clock at 8 p.m. on a Thursday, when every listed business is open.
    import datetime
    page.clock.install(time=datetime.datetime(2026, 10, 15, 20, 0, 0))
    page.goto(BASE)
    page.wait_for_selector("#results article")
    names = lambda: page.eval_on_selector_all("#results .card-title", "e => e.map(x => x.textContent)")
    got = names()
    ok("list is alphabetical", got == sorted(got, key=str.lower), got)
    opts = page.eval_on_selector_all("#area option", "e => e.map(x => x.value)")
    ok("customers choose a zone, not the whole city or a ward", "ccc" not in opts and not any(o.startswith("ward-") for o in opts), opts)
    page.select_option("#area", "bakalia")
    ok("another zone hides the Khulshi-only restaurant", "Tava Restaurant" not in names(), names())
    page.select_option("#area", "khulshi")
    ok("Khulshi shows the Khulshi-only restaurant", "Tava Restaurant" in names(), names())
    before = page.evaluate("document.body.className")
    page.click("#theme-toggle")
    page.click("#theme-toggle")
    ok("colour-mode toggle switches to dark", "dark" in page.evaluate("document.body.className"), (before, page.evaluate("document.body.className")))
    page.click("#theme-toggle")
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
    labels = page.eval_on_selector_all("input[name=channel] + span", "e => e.map(x => x.textContent)")
    ok("checkout offers written channels only (no phone call)", labels and not any("call" in x.lower() for x in labels), labels)
    wards = page.eval_on_selector_all("#ward option", "e => e.map(x => x.value)")
    ok("wards are offered only inside the chosen zone", "ward-14" in wards and "ward-40" not in wards, wards)
    page.fill("#name", "Test")
    page.fill("#address", "House 1, Road 2")
    page.click("button[type=submit]")
    page.wait_for_selector("pre")
    message = page.inner_text("pre").strip()
    line = message.splitlines()[-1]
    menu_bytes = (HERE.parent / "menus" / TAVA / "menu.json").read_bytes()
    res = order_line.decode(line, [(menu_bytes, json.loads(menu_bytes))])
    ok("order check line is accepted by tools/order_line.py", res["ok"] and res["subtotal_from_menu"] == 440, res)
    ok("no courier slip is prepared", "DELIVERY SLIP" not in page.inner_text("main"))
    code = message.split()[1]
    page.goto(BASE + "#/orders")
    page.wait_for_selector("textarea")
    ok("a new order waits for confirmation", "Waiting for the business to confirm" in page.inner_text("article"))
    ok("no complaint summary before confirmation", "Problem with this order?" not in page.inner_text("article"))
    page.locator("textarea").first.fill("CONFIRMED ZZZZZZ")
    page.click("text=Save the reply")
    page.wait_for_timeout(300)
    ok("a confirmation for another order is refused", "different order" in page.inner_text("article"))
    page.locator("textarea").first.fill("Thank you. CONFIRMED " + code)
    page.click("text=Save the reply")
    page.wait_for_timeout(300)
    ok("the business's confirmation confirms the order", "Confirmed by message" in page.inner_text("article") and "Problem with this order?" in page.inner_text("article"))
    stale = page.evaluate("""() => {
        const orders = JSON.parse(localStorage.getItem("hana.orders"));
        const o = Object.assign({}, orders[0], { code: "AAAAAA", status: "awaiting", confirmation: null,
            created: new Date(Date.now() - 20 * 60000).toISOString(), window_start: null });
        orders.unshift(o);
        localStorage.setItem("hana.orders", JSON.stringify(orders));
        return o.code;
    }""")
    page.reload()
    page.wait_for_selector("article")
    first = page.locator("article").first
    ok("an order not confirmed within 15 minutes is cancelled automatically", "Cancelled automatically" in first.inner_text(), first.inner_text()[:200])
    page.locator("textarea").first.fill("CONFIRMED " + stale)
    page.locator("article").first.locator("text=Save the reply").click()
    page.wait_for_timeout(300)
    ok("a late plain confirmation is refused", "has passed" in page.locator("article").first.inner_text())
    ok("the automatic cancellation is in the activity record", "cancelled automatically" in page.inner_text("main"))
    page.goto(BASE + "#/terms")
    page.wait_for_selector("text=Limitation of liability")
    ok("the Terms page shows the terms", "Governing law" in page.inner_text("main"))
    ok("no script errors", not errors, errors)
    browser.close()

print("\nFAILED" if failed else "\nAll browser checks passed.")
sys.exit(1 if failed else 0)
