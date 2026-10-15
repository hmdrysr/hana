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
           BIZ, BIZ + "#/join", BIZ + "#/claim", BIZ + "#/confirm", BIZ + "#/update", BIZ + "#/site", BIZ + "#/connect", ROOT_URL + "/index.html#/download", ROOT_URL + "/restaurants/tava/"]
failed = 0

# Finds text that is cut off: any text whose box extends past an ancestor that clips its overflow.
CLIPPED_TEXT = r"""(() => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest("dialog:not([open]), .snackbar:not(.active), script, style, option, select, textarea") || (el.closest("details:not([open])") && !el.closest("summary"))) continue;
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
    ok("search shows dishes as their own group", "Dishes" in page.inner_text("#results"))
    page.fill("#q", "")
    page.focus("#q")
    page.wait_for_timeout(100)
    ok("an empty search shows the top categories", "Top categories" in page.inner_text("#results"))
    page.locator("ul.cat-list a").filter(has_text="Pizza").first.click()
    page.wait_for_timeout(300)
    ok("a category filters the list", set(names()) == {"Meal Master", "Sliced"}, names())
    page.locator("button[aria-label='Clear the category filter']").click()
    page.goto(BASE + "#/r/" + TAVA)
    page.wait_for_selector(".page-title")
    page.click("#settings-link")
    page.wait_for_selector("text=Colour scheme")
    page.click("#settings-link")
    page.wait_for_timeout(300)
    ok("tapping Settings again returns to the previous page", "/r/" + TAVA in page.url, page.url)
    page.click("#settings-link")
    page.wait_for_selector("text=Colour scheme")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    ok("Escape closes Settings", "/r/" + TAVA in page.url, page.url)
    page.goto(BASE + "#/r/" + TAVA)
    page.wait_for_selector(".page-title")
    h = page.evaluate("document.querySelector('button.dish-add').getBoundingClientRect().height")
    ok("no stray 'null' text on the restaurant page", "null" not in page.inner_text("main"))
    ok("restaurant page has a cover", page.locator("main .hero .cover").count() == 1)
    ok("items without a picture show the drawing", page.locator("li.dish .thumb.placeholder").count() > 0)
    ok("details are folded away", page.evaluate("!document.querySelector('details.info-list').open"))
    top = page.evaluate("document.querySelector('li.dish').getBoundingClientRect().top")
    ok("the first dish is reached without scrolling past long text", top < 900, top)
    n = page.evaluate("document.querySelector('#nav-bar a').getBoundingClientRect().height")
    ok("add buttons and navigation are at least 40px tall", h >= 40 and n >= 40, (h, n))
    page.click("button[aria-label^='Add Dahi Bara']")
    page.click("button[aria-label^='Add Dahi Bara']")
    page.goto(BASE + "#/r/" + MEAL)
    page.wait_for_selector(".page-title")
    multi = page.locator("button.dish-add[aria-label$='choose an option']").first
    multi.click()
    page.wait_for_selector("dialog[open] ul.list li")
    ok("an item with sizes opens a chooser", page.locator("dialog[open] ul.list li").count() >= 2)
    page.click("dialog[open] nav button")
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
    page.goto(BASE + "#/")
    page.wait_for_selector(".cat-tile")
    ok("the home page never shows the word null", "null" not in page.inner_text("main"))
    page.click("nav.kind-tabs button:has-text('Groceries')")
    ok("the Groceries tab explains when no store is listed", "No grocery stores are listed yet" in page.inner_text("#results"))
    page.click("nav.kind-tabs button:has-text('All')")
    page.goto(BASE + "#/order?r=" + TAVA + "&items=dahi-bara*2&mode=pickup")
    page.wait_for_selector("text=Total to pay at pickup")
    ok("an order link fills the basket", "BDT 440" in page.inner_text("main"), page.inner_text("main")[:200])
    page.goto(BASE + "#/download")
    page.wait_for_selector("text=Details to include")
    page.check("input[name=dl-format][value=json]", force=True)
    page.click("button:has-text('Names and phone numbers')")
    with page.expect_download() as dl:
        page.click("main button:has-text('Download')")
    data = json.loads(Path(dl.value.path()).read_text())
    first = data.get("listings", [{}])[0]
    ok("the directory downloads as JSON with only the chosen details", data.get("format") == "hana-directory-1" and len(data["listings"]) == 3
       and "business_phone" in first and "items" not in first, list(first))
    page.select_option("#dl-zone", "khulshi")
    page.check("input[name=dl-format][value=pdf]", force=True)
    page.click("button:has-text('Everything')")
    with page.expect_download() as dl:
        page.click("main button:has-text('Download')")
    pdf = Path(dl.value.path()).read_bytes()
    ok("the directory downloads as a PDF book with menus", pdf.startswith(b"%PDF-1.4") and pdf.rstrip().endswith(b"%%EOF") and b"Tava Restaurant" in pdf and b"Dahi Bara" in pdf)
    page.goto(ROOT_URL + "/restaurants/tava/")
    page.wait_for_selector(".page-title")
    ok("a clean listing address opens that listing", "Tava Restaurant" in page.inner_text("main .page-title") and "@tava" in page.inner_text("main"))
    page.goto(BASE + "#/@sliced")
    page.wait_for_timeout(1500)
    ok("an @handle opens that listing", "Sliced" in page.inner_text("main .page-title"), page.inner_text("main")[:120])
    page.goto(BIZ + "#/update")
    page.fill("#listing-phone", "+8801729298282")
    page.click("text=Find my listing")
    page.wait_for_timeout(800)
    ok("the menu editor refuses an unclaimed listing", "not claimed yet" in page.inner_text("main"))
    page.goto(BIZ + "#/join")
    page.wait_for_selector(".menu-editor")
    page.locator(".edit-section input").first.fill("Starters")
    page.click("text=Add an item")
    page.locator(".edit-item input").first.fill("Samosa")
    page.locator(".edit-item input[type=number]").first.fill("40")
    page.click("summary:has-text('Paste or copy the menu as text')")
    page.click("text=Show the current menu as text")
    ok("the visual menu editor produces the menu", "Starters | Samosa | 40" in page.input_value(".menu-editor textarea"), page.input_value(".menu-editor textarea"))
    ctx = browser.new_context(geolocation={"latitude": 22.3601, "longitude": 91.8098}, permissions=["geolocation"], viewport={"width": 360, "height": 800})
    gp = ctx.new_page()
    gp.route("https://nominatim.openstreetmap.org/**", lambda r: r.fulfill(status=200, content_type="application/json",
             body=json.dumps({"address": {"suburb": "Khulshi", "city": "Chittagong", "country": "Bangladesh"}})))
    gp.goto(BASE + "#/")
    gp.wait_for_selector("text=Use my location")
    gp.click("text=Use my location")
    gp.wait_for_timeout(800)
    ok("Use my location sets the zone", gp.eval_on_selector("#area", "e => e.value") == "khulshi", gp.eval_on_selector("#area", "e => e.value"))
    ctx.close()
    ok("no script errors", not errors, errors)
    browser.close()

print("\nFAILED" if failed else "\nAll browser checks passed.")
sys.exit(1 if failed else 0)
