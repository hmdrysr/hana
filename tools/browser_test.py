#!/usr/bin/env python3
"""Optional browser test for the app. Needs Python Playwright and Chromium, which are
NOT standard library, so this is not part of tools/check.py or tools/selftest.py.

    python3 tools/browser_test.py     (serves a temporary copy with the test listings itself)

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
import urllib.request
import re
from datetime import datetime
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import order_line  # noqa: E402

def fixture_site():
    """A temporary copy of the repository with the test-only listings (tools/fixtures) added,
    rebuilt and served on a free port. The live directory holds only the demo listings."""
    import atexit, shutil, subprocess, tempfile, socket, time
    tmp = Path(tempfile.mkdtemp(prefix="hana-test-"))
    site = tmp / "site"
    shutil.copytree(HERE.parent, site, ignore=shutil.ignore_patterns(".git", "__pycache__", "*.zip"))
    for d in (HERE / "fixtures" / "menus").iterdir():
        shutil.copytree(d, site / "menus" / d.name)
    idx = json.loads((site / "index.json").read_text())
    idx["restaurants"] += json.loads((HERE / "fixtures" / "index-extra.json").read_text())["restaurants"]
    (site / "index.json").write_text(json.dumps(idx, indent=2) + "\n")
    subprocess.run([sys.executable, str(site / "tools" / "build.py")], cwd=site, check=True, capture_output=True)
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    atexit.register(lambda: (srv.terminate(), shutil.rmtree(tmp, ignore_errors=True)))
    time.sleep(1)
    return f"http://localhost:{port}"  # a host name, not an IP: passkeys need one


ROOT_URL = (sys.argv[1] if len(sys.argv) > 1 else fixture_site()).rstrip("/")
BASE = ROOT_URL + "/index.html"
BIZ = ROOT_URL + "/business.html"
TAVA = "6c6cfbab5f1ad5a85d0ec7e83545bdb47077cea462f1868bcef6cc3d547d21d7"
MEAL = "bee9f4b3ba09a8f47ca77d741df138917ea6c584407e9b8a7418313d42340d9b"
SCREENS = [BASE, BASE + "#/r/" + TAVA, BASE + "#/basket", BASE + "#/orders", BASE + "#/about", BASE + "#/terms", BASE + "#/settings",
           BIZ, BIZ + "#/join", BIZ + "#/claim", BIZ + "#/confirm", BIZ + "#/update", BIZ + "#/site", BIZ + "#/connect", BIZ + "#/more", BIZ + "#/pos", BIZ + "#/statements", BIZ + "#/riders", BIZ + "#/backup", ROOT_URL + "/index.html#/download", ROOT_URL + "/restaurants/tava/"]
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
                page.on("console", lambda m: "Content Security Policy" in m.text and errors.append("CSP: " + m.text[:160]))
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

    # The full order protocol (code, check line, confirmation window) applies to claimed listings.
    # No listing is claimed yet, so this page sees Tava as claimed, through a stand-in list.
    import hashlib
    claimed_bytes = (HERE / "fixtures" / "menus" / TAVA / "menu.json").read_text().replace('"claimed": false', '"claimed": true', 1).encode()
    stand_in = json.loads(urllib.request.urlopen(ROOT_URL + "/list.json").read())
    for L in stand_in["listings"]:
        if L["id"] == TAVA:
            L["claimed"], L["menu_hash"] = True, hashlib.sha256(claimed_bytes).hexdigest()
    page = browser.new_context(viewport={"width": 360, "height": 800}, service_workers="block").new_page()
    page.route("**/list.json", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(stand_in)))
    page.route("**/menus/" + TAVA + "/menu.json", lambda r: r.fulfill(status=200, content_type="application/json", body=claimed_bytes))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: "Content Security Policy" in m.text and errors.append("CSP: " + m.text[:160]))
    # Fix the clock at 8 p.m. on a Thursday, when every listed business is open.
    page.clock.install(time=datetime(2026, 10, 15, 20, 0, 0))
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
    page.wait_for_timeout(400)
    places = lambda: set(page.eval_on_selector_all("#results a.dish-hit .small-text", "e => e.map(x => x.textContent.split(' · ')[0])"))
    ok("fuzzy search finds pizza where it is sold, one line per place", places() == {"Meal Master", "Sliced"} and page.locator("#results a.dish-hit").count() == 2, places())
    squeezed = page.evaluate("[...document.querySelectorAll('#results a.dish-hit div')].filter((d) => d.getBoundingClientRect().width < 90).map((d) => d.textContent)")
    ok("found items are never squeezed into narrow columns", not squeezed, squeezed)
    ok("search shows items first, before places", "Dishes" in page.inner_text("#results") and ("Places" not in page.inner_text("#results") or page.inner_text("#results").index("Dishes") < page.inner_text("#results").index("Places")), page.inner_text("#results")[:120])
    page.click("button:has-text('Show every match')")
    page.wait_for_timeout(200)
    ok("every match in every place is shown on request", page.locator("#results a.dish-hit").count() > 2)
    page.locator("#results a.dish-hit").first.click()
    page.wait_for_selector("li.dish:focus", timeout=5000)
    ok("tapping a found item opens the place at that item", "izz" in page.inner_text("li.dish:focus").lower(), page.inner_text("li.dish:focus"))
    page.fill("#menu-search", "piza")
    page.wait_for_timeout(200)
    vis = page.eval_on_selector_all("main li.dish", "e => e.filter(x => x.getBoundingClientRect().height > 0).map(x => x.innerText.split('\\n')[0])")
    total = page.locator("main li.dish").count()
    ok("fuzzy search inside a menu keeps only matching items", vis and len(vis) < total and "Strips" not in vis and any("Pizza" in v for v in vis), (len(vis), total))
    page.goto(BASE + "#/")
    page.wait_for_selector("#q")
    page.click("button.clear-search")
    ok("the x button clears the search", page.input_value("#q") == "" and page.locator("button.clear-search").first.is_hidden())
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
    wide = []
    for route in ["#/", "#/r/" + TAVA, "#/basket", "#/orders"]:
        page.goto(BASE + route)
        page.wait_for_timeout(500)
        page.evaluate("document.documentElement.style.fontSize = '200%'")
        page.wait_for_timeout(100)
        if page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || [...document.querySelectorAll('main *')].some((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && getComputedStyle(e).position !== 'fixed')"):
            wide.append(route)
        page.evaluate("document.documentElement.style.fontSize = ''")
    ok("nothing runs off the screen at 360px with text at 200%", not wide, wide)
    page.evaluate("() => { window.__set = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); }; store.set('hana.test', 1); }")
    full = page.evaluate("document.getElementById('snackbar').textContent")
    page.evaluate("() => { Storage.prototype.setItem = window.__set; }")
    ok("a full phone storage is reported, never silent", "storage is full" in full, full)
    page.goto(BASE + "#/r/" + TAVA)
    page.wait_for_selector(".page-title")
    page.click("button[aria-label='Add to favourites']")
    page.goto(BASE + "#/")
    page.wait_for_selector("button:has-text('Favourites')")
    page.click("button:has-text('Favourites')")
    page.wait_for_timeout(300)
    names = page.inner_text("#list") if page.locator("#list").count() else page.inner_text("main")
    ok("favourites filter shows only saved places", "Tava Restaurant" in names and "Sliced" not in names, names[:200])
    page.click("button:has-text('Favourites')")
    page.click("button:has-text('Open now')")
    page.wait_for_timeout(300)
    ok("the Open now filter can be switched on", page.get_attribute("button:has-text('Open now')", "aria-pressed") == "true")
    page.click("button:has-text('Open now')")
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
    d = page.evaluate("(() => { const out = []; for (const f of ['', '200%']) { document.documentElement.style.fontSize = f; const r = document.querySelector('dialog[open]').getBoundingClientRect(); out.push({ l: r.left, r: innerWidth - r.right, w: r.width, h: r.height, mid: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 2 && Math.abs((r.top + r.bottom) / 2 - innerHeight / 2) < 2 }); } document.documentElement.style.fontSize = ''; return out; })()")
    ok("dialogs are compact, centred and keep a margin on both sides, also at 200% text", all(x["l"] >= 16 and x["r"] >= 16 and x["w"] <= 300 and x["mid"] for x in d) and d[0]["h"] <= 320, d)
    page.click("#dialog-cancel")
    page.goto(BASE + "#/r/" + TAVA)
    page.wait_for_selector(".page-title")
    page.click("button[aria-label^='Add Dahi Bara']")
    page.wait_for_timeout(400)
    geo = page.evaluate("""() => { const r = (s) => { const e = document.querySelector(s); return e && !e.hidden ? e.getBoundingClientRect() : null; };
        const sb = r("#snackbar"), bar = r("a.basket-bar"), nav = r("nav.bottom");
        const hit = (a, b) => a && b && a.top < b.bottom && b.top < a.bottom;
        return { overlap: hit(sb, bar) || hit(sb, nav), left: sb && sb.left, right: sb && innerWidth - sb.right }; }""")
    ok("the added-to-basket notice never covers the basket bar or navigation", not geo["overlap"] and geo["left"] >= 16 and geo["right"] >= 16, geo)
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
    menu_bytes = claimed_bytes
    line = line.split(": ", 1)[1] if line.startswith("Order reference") else line
    res = order_line.decode(line, [(menu_bytes, json.loads(menu_bytes))])
    ok("order check line is accepted by tools/order_line.py", res["ok"] and res["subtotal_from_menu"] == 0, res)
    ok("the order message is polite and asks for the prices and the total", message.startswith("Hello, I'd like to order from Tava Restaurant.") and "Could you please confirm the item prices" in message and "No advance payment, please." in message, message[:300])
    ok("no courier slip is prepared", "DELIVERY SLIP" not in page.inner_text("main"))
    code = re.search(r"CONFIRMED ([0-9A-Z]{6})", message).group(1)
    page.goto(BASE + "#/orders")
    page.wait_for_selector("textarea")
    ok("a new order waits for confirmation", "Waiting for the business to confirm" in page.inner_text("article:has(textarea), article:has-text('Confirmed by message')"))
    ok("no complaint summary before confirmation", "Problem with this order?" not in page.inner_text("article:has(textarea), article:has-text('Confirmed by message')"))
    page.locator("textarea").first.fill("CONFIRMED ZZZZZZ")
    page.click("text=Save the reply")
    page.wait_for_timeout(300)
    ok("a confirmation for another order is refused", "different order" in page.inner_text("article:has(textarea), article:has-text('Confirmed by message')"))
    page.locator("textarea").first.fill("Thank you. CONFIRMED " + code)
    page.click("text=Save the reply")
    page.wait_for_timeout(300)
    ok("the business's confirmation confirms the order", "Confirmed by message" in page.inner_text("article:has(textarea), article:has-text('Confirmed by message')") and "Problem with this order?" in page.inner_text("article:has(textarea), article:has-text('Confirmed by message')"))
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
    first = page.locator("article:has-text('Order " + stale + "')")
    ok("an order not confirmed within 15 minutes is cancelled automatically", "Cancelled automatically" in first.inner_text(), first.inner_text()[:200])
    first.locator("textarea").fill("CONFIRMED " + stale)
    first.locator("text=Save the reply").click()
    page.wait_for_timeout(300)
    ok("a late plain confirmation is refused", "has passed" in page.locator("article:has-text('Order " + stale + "')").inner_text())
    ok("the automatic cancellation is in the activity record", "cancelled automatically" in page.inner_text("main"))
    page.goto(BASE + "#/terms")
    page.wait_for_selector("text=Limitation of liability")
    ok("the Terms page shows the terms", "Governing law" in page.inner_text("main"))
    page.goto(BASE + "#/")
    page.wait_for_selector(".cat-tile")
    ok("the home page never shows the word null", "null" not in page.inner_text("main"))
    page.click("nav.kind-tabs button:has-text('Groceries')")
    ok("the Groceries tab lists the demo grocery store only", "DUWAN" in page.inner_text("#results") and "TONG" not in page.inner_text("#results"))
    page.click("nav.kind-tabs button:has-text('All')")
    page.goto(BASE + "#/order?r=" + TAVA + "&items=dahi-bara*2&mode=pickup")
    page.wait_for_selector("text=no listed price")
    ok("an order link fills the basket", "Dahi Bara" in page.inner_text("main") and "no listed price" in page.inner_text("main"), page.inner_text("main")[:200])
    page.goto(BASE + "#/order?r=" + MEAL + "&items=french-fries*2&mode=pickup")
    page.wait_for_selector("#dialog[open]")
    page.click("#dialog-ok")
    page.wait_for_selector("text=Total to pay at pickup")
    ok("the basket shows each line's sum and the total", "2 × BDT 120 = BDT 240" in page.inner_text("main") and "Subtotal (items)" in page.inner_text("main"), page.inner_text("main")[:300])
    page.goto(BASE + "#/download")
    page.wait_for_selector("text=Details to include")
    page.check("input[name=dl-format][value=json]", force=True)
    page.click("button:has-text('Names and phone numbers')")
    with page.expect_download() as dl:
        page.click("main button:has-text('Download')")
    data = json.loads(Path(dl.value.path()).read_text())
    first = data.get("listings", [{}])[0]
    ok("the directory downloads as JSON with only the chosen details", data.get("format") == "hana-directory-1" and len(data["listings"]) == 5
       and "business_phone" in first and "items" not in first, list(first))
    page.select_option("#dl-zone", "khulshi")
    page.check("input[name=dl-format][value=pdf]", force=True)
    page.click("button:has-text('Everything')")
    with page.expect_download() as dl:
        page.click("main button:has-text('Download')")
    pdf = Path(dl.value.path()).read_bytes()
    ok("the directory downloads as a PDF book with menus", pdf.startswith(b"%PDF-1.4") and pdf.rstrip().endswith(b"%%EOF") and b"Tava Restaurant" in pdf and b"Dahi Bara" in pdf)
    page.goto(ROOT_URL + "/restaurants/tava/")
    page.wait_for_selector("main .page-title:has-text('Tava Restaurant')", timeout=10000)
    ok("a clean listing address opens that listing", "Tava Restaurant" in page.inner_text("main .page-title") and "@tava" in page.inner_text("main"))
    page.goto(BASE + "#/@sliced")
    page.wait_for_timeout(1500)
    ok("an @handle opens that listing", "Sliced" in page.inner_text("main .page-title"), page.inner_text("main")[:120])
    # Volunteer-entered listings skip the protocol: a plain, polite message and a manual note.
    ip = browser.new_context(viewport={"width": 360, "height": 800}, service_workers="block", geolocation={"latitude": 22.36012, "longitude": 91.80981}, permissions=["geolocation"]).new_page()
    ip.on("console", lambda m: "Content Security Policy" in m.text and errors.append("CSP: " + m.text[:160]))
    ip.goto(BASE + "#/r/" + TAVA)
    ip.wait_for_selector(".page-title")
    ok("a volunteer listing says its prices and hours are not confirmed", "Not confirmed by the business · entered October 15, 2026" in ip.inner_text("main"))
    ip.click("button[aria-label^='Add Dahi Bara']")
    ip.goto(BASE + "#/basket")
    ip.wait_for_selector("#zone")
    ip.select_option("#zone", "khulshi")
    ip.click("summary:has-text('Add a note for this item')")
    lefts = ip.evaluate("[...document.querySelectorAll('main ul.list > li:has(details.item-note)')].map((li) => Math.round(li.firstElementChild.getBoundingClientRect().left))")
    ok("basket lines stay aligned when a note is open", len(set(lefts)) == 1, lefts)
    ip.fill("[id='note-dahi-bara']", "no onion")
    ip.press("[id='note-dahi-bara']", "Tab")
    ip.wait_for_timeout(200)
    ip.select_option("#swap", "call")
    ip.fill("#name", "Test")
    ip.fill("#address", "House 1, Road 2")
    pgap = ip.evaluate("(() => { const t = document.querySelector('#address').closest('.field').getBoundingClientRect(); const m = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Add a map pin')).getBoundingClientRect(); return m.top - t.bottom; })()")
    ok("the map pin button keeps its distance from the address box", pgap >= 8, pgap)
    ip.click("text=Add a map pin for the rider")
    ip.wait_for_selector("canvas.map-pin")
    gap = ip.evaluate("(() => { const t = document.querySelector('#address').closest('.field').getBoundingClientRect(); const m = document.querySelector('canvas.map-pin').getBoundingClientRect(); return m.top - t.bottom; })()")
    mw = ip.evaluate("(() => { const c = document.querySelector('canvas.map-pin').getBoundingClientRect(); const f = document.querySelector('#address').closest('.field').getBoundingClientRect(); return [Math.round(c.width), Math.round(f.width), Math.round(c.height)]; })()")
    ok("the map fits its box: as wide as the address box, half as tall", mw[0] == mw[1] and abs(mw[2] - mw[0] / 2) <= 2, mw)
    px = ip.evaluate("(() => { const c = document.querySelector('canvas.map-pin'); const d = c.getContext('2d').getImageData(c.width / 2, c.height / 2 - 14, 1, 1).data; return [d[0], d[1], d[2]]; })()")
    ok("the pin is drawn at the centre of the map", px[0] > 150 and px[1] < 80, px)
    ok("the map pin shows a map below the address, with space between", gap >= 8 and ip.locator("text=Open in a map app").count() == 1, gap)
    ip.fill("#addr-label", "Home")
    ip.evaluate("() => { const x = document.querySelector('button[type=submit]'); x.click(); x.click(); x.click(); }")
    ip.wait_for_selector("pre")
    ip.wait_for_timeout(500)
    ok("repeated taps on Send create one order", ip.evaluate("JSON.parse(localStorage.getItem('hana.orders') || '[]').length") == 1)
    plain = ip.inner_text("pre").strip()
    ok("an item note goes into the message", "Dahi Bara (2 pieces) (note: no onion)" in plain, plain[:300])
    links = ip.eval_on_selector_all("a[href^='https://wa.me/'], a[href^='sms:']", "e => e.map((x) => decodeURIComponent(x.href.split(/[?&](?:text|body)=/)[1] || ''))")
    ok("the substitution choice and item note arrive intact in the WhatsApp and text-message links", links and all("If an item is not available: please call me first." in x and "(note: no onion)" in x for x in links), [x[-120:] for x in links])
    ok("the substitution choice goes into the message", "If an item is not available: please call me first." in plain, plain[-300:])
    ok("a volunteer listing gets a plain message with no codes", plain.startswith("Hello, I'd like to order from Tava Restaurant.") and "CHECK" not in plain and "CONFIRMED" not in plain and plain.endswith("Thank you!"), plain[-200:])
    ip.goto(BASE + "#/orders")
    ip.wait_for_selector("text=The business confirmed")
    ip.click("text=The business confirmed")
    ip.wait_for_timeout(300)
    ip.click("summary:has-text('Check before you pay')")
    ip.locator("label.checkbox").first.click()
    ok("check before you pay confirms when everything is there", "Everything is here" in ip.inner_text("main"))
    ok("the customer notes a volunteer listing's confirmation", "not signed" in ip.inner_text("main"), ip.inner_text("main")[:200])
    ok("a map pin is added to the message", "Map pin: https://www.openstreetmap.org/?mlat=22.36012&mlon=91.80981" in plain, plain[-300:])
    ip.evaluate("() => { const o = JSON.parse(localStorage.getItem('hana.orders')); o[0].items[0].price = o[0].items[0].price + 5; o[0].items = o[0].items.concat([{ key: 'gone-item', label: 'Gone item', qty: 1, price: 99 }]); localStorage.setItem('hana.orders', JSON.stringify(o)); }")
    ip.goto(BASE + "#/orders")
    ip.wait_for_selector("text=Order again")
    ip.click("text=Order again")
    ip.wait_for_selector("#zone")
    ok("order again spells out what changed since the last order", "Gone item is no longer on the menu" in ip.inner_text("main"), ip.inner_text("main")[:300])
    ok("order again compares with the price recorded on the earlier order", "Dahi Bara (2 pieces) no longer has a listed price" in ip.inner_text("main"), ip.inner_text("main")[:300])
    ok("order again refills the basket", "Dahi Bara" in ip.inner_text("main"))
    ip.fill("#address", "")
    ip.click("button.chip:has-text('Home')")
    ok("a saved address fills in the address and zone", ip.input_value("#address") == "House 1, Road 2" and ip.input_value("#zone") == "khulshi")
    ip.close()
    up = browser.new_page(viewport={"width": 360, "height": 800})
    up.goto(BIZ + "#/update")
    up.fill("#listing-phone", "+8801729298282")
    up.click("text=Find my listing")
    up.wait_for_timeout(800)
    ok("the menu editor refuses an unclaimed listing", "not claimed yet" in up.inner_text("main"))
    up.close()
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
    page.goto(BASE + "#/settings")
    page.wait_for_selector("text=Install the app")
    ok("Settings offers installation", page.locator("button:has-text('Install Hana')").count() == 1)
    page.evaluate("""() => { const e = new Event("beforeinstallprompt"); e.prompt = () => { window.__prompted = true; };
        e.userChoice = Promise.resolve({ outcome: "accepted" }); window.dispatchEvent(e); }""")
    page.click("button:has-text('Install Hana')")
    page.wait_for_timeout(200)
    ok("Install uses the browser's own install offer", page.evaluate("window.__prompted === true"))
    page.click("button[aria-label='Plum']")
    page.wait_for_timeout(300)
    page.reload()
    page.wait_for_selector("text=App icon")
    ok("a chosen app icon is used for installing", page.evaluate("document.querySelector('link[rel=manifest]').href.startsWith('data:application/manifest+json')")
       and page.evaluate("document.querySelector('link[rel=apple-touch-icon]').href.startsWith('data:image/png')"))
    page.click("text=Use the standard icon")
    page.wait_for_selector("text=App icon")
    ok("the standard icon can be restored", page.evaluate("document.querySelector('link[rel=manifest]').getAttribute('href') === 'manifest.webmanifest'"))
    page.goto(BASE + "#/")
    page.wait_for_selector(".cat-tile")
    ok("the home page offers installation", "Install Hana" in page.inner_text("main"))
    page.click("main button:has-text('Not now')")
    page.reload()
    page.wait_for_selector(".cat-tile")
    ok("Not now hides the install offer on the home page", "Install Hana" not in page.inner_text("main"))
    ctx = browser.new_context(viewport={"width": 360, "height": 800})
    cp = ctx.new_page()
    cp.clock.install(time=datetime(2026, 10, 15, 10, 0))
    cp.goto(BASE + "#/r/" + MEAL)
    cp.wait_for_selector("button.dish-add")
    ok("items in a closed business are not greyed out", cp.locator("button.dish-add[disabled]").count() == 0)
    cp.locator("button.dish-add").first.click()
    cp.wait_for_selector("dialog[open] h5")
    ok("tapping an item in a closed business says when it opens", "closed now" in cp.inner_text("dialog[open]") and "opens again" in cp.inner_text("dialog[open]"))
    ctx.close()
    bp = browser.new_page(viewport={"width": 360, "height": 800})
    bp.goto(BIZ + "#/backup")
    bp.wait_for_selector("text=Receipt details")
    bp.fill("#p-name", "Test Kitchen")
    bp.locator("main button:has-text('Save')").first.click()
    bp.wait_for_timeout(300)
    bp.goto(BIZ + "#/pos")
    bp.wait_for_selector("text=New sale")
    bp.fill("#free-name", "Samosa")
    bp.fill("#free-price", "40")
    bp.click("button[aria-label='Add this item']")
    bp.click("text=Save and show the receipt")
    bp.wait_for_selector("#receipt")
    rc = bp.inner_text("#receipt")
    ok("a counter sale gives a numbered receipt", "Test Kitchen" in rc and "R-000001" in rc and "BDT 40" in rc and "not a VAT tax invoice" in rc, rc[:200])
    bp.goto(BIZ + "#/statements")
    bp.wait_for_selector("#statement")
    bp.wait_for_timeout(300)
    ok("the statement totals today's sales", "BDT 40" in bp.inner_text("#statement"))
    with bp.expect_download() as dl:
        bp.click("text=Download CSV")
    ok("the statement downloads as CSV", "R-000001" in Path(dl.value.path()).read_text())
    bp.goto(BIZ + "#/backup")
    bp.wait_for_selector("text=Download a backup")
    with bp.expect_download() as dl:
        bp.click("text=Download a backup")
    back = json.loads(Path(dl.value.path()).read_text())
    ok("the point-of-sale backup file holds the sales", back.get("format") == "hana-pos-backup-1" and any(r["store"] == "sales" for r in back["records"]))
    bp.close()
    sp = browser.new_page(viewport={"width": 360, "height": 800})
    seen_urls = []
    sp.on("request", lambda req: seen_urls.append(req.url))
    sp.goto(BASE + "#/")
    sp.wait_for_selector(".cat-tile")
    sp.wait_for_timeout(500)
    ok("the home page loads no full menus and no search data", not any("/menus/" in u or "search.json" in u for u in seen_urls), [u for u in seen_urls if "menus/" in u])
    sp.close()
    # Orders sent in Hana, through a stand-in for ntfy that keeps messages in memory.
    box = {}
    def fake_ntfy(route):
        req = route.request
        path = req.url.split("https://ntfy.sh/", 1)[1]
        if req.method == "POST":
            topic = path.strip("/")
            msg = {"id": "m" + str(sum(len(v) for v in box.values()) + 1), "time": int(datetime.now().timestamp()), "event": "message", "topic": topic, "message": req.post_data}
            box.setdefault(topic, []).append(msg)
            route.fulfill(status=200, content_type="application/json", body=json.dumps(msg))
        elif "/json" in path:
            topic = path.split("/json")[0]
            route.fulfill(status=200, content_type="application/x-ndjson", body="".join(json.dumps(m) + "\n" for m in box.get(topic, [])))
        else:
            route.fulfill(status=404, body="")
    dctx = browser.new_context(viewport={"width": 360, "height": 800})
    dctx.route("https://ntfy.sh/**", fake_ntfy)
    dp = dctx.new_page()
    dp.goto(BIZ + "#/")
    dp.wait_for_selector(".page-title")
    sealed = dp.evaluate("""async () => {
        const k = await createEncKey();
        const direct = { topic: "https://ntfy.sh/hana-testtopic0123456789", enc_key: k.pub };
        const s = await sealOrder(direct, { message: "Order ABC123 (sent with Hana)", code: "ABC123" });
        await ntfyPost(direct.topic, s.envelope);
        const opened = await openOrder(k.priv, s.envelope);
        await postSealed(opened.order.reply, opened.keyRaw, { from: "b", t: "confirm", line: "CONFIRMED ABC123" });
        const back = await readSealed(s.orderTopic, s.key, "24h");
        return { text: opened.order.message, reply: back[0] && back[0].line, plain: s.envelope.includes("ABC123") };
    }""")
    ok("an order sent in Hana is encrypted, opened only with the business key, and answered on its own channel",
       sealed["text"].startswith("Order ABC123") and sealed["reply"] == "CONFIRMED ABC123" and not sealed["plain"], sealed)
    online = dp.evaluate("""async () => { const d = { topic: "https://ntfy.sh/hana-presence0123456789" };
        const before = await isOnline(d); await ntfyPost(presenceTopic(d.topic), "online"); const after = await isOnline(d); return [before, after]; }""")
    ok("a business shows as available only after its tools say so", online == [False, True], online)
    live = dp.evaluate("""async () => { localStorage.setItem("hana.biz.connections", JSON.stringify({ orders: "https://ntfy.sh/hana-today0123456789" }));
        saveToday({ sold: ["fries"], busy: 30, pickup_only: true }); await new Promise((r) => setTimeout(r, 300));
        return presence({ topic: "https://ntfy.sh/hana-today0123456789" }); }""")
    ok("sold-out items, busy time and pickup only reach customers with the presence signal", live["online"] and live["sold"] == ["fries"] and live["busy"] == 30 and live["pickup_only"], live)
    dp.evaluate("""() => { localStorage.setItem("hana.biz.connections", JSON.stringify({ orders: "https://ntfy.sh/hana-testtopic0123456789" }));
        localStorage.setItem("hana.biz.inbox", JSON.stringify([{ id: "x1", time: Math.floor(Date.now() / 1000), code: "ABC123", text: "Order ABC123 Z=pickup ", reply: "https://ntfy.sh/hana-o-test0123456789", keyRaw: "", status: "accepted", step: "accepted", accepted_at: Date.now() }])); }""")
    dp.evaluate("""() => { document.getElementById("main").replaceChildren(progressPanel(inboxOrders()[0], () => {})); }""")
    ok("an accepted pickup order offers Ready next", "Ready for pickup" in dp.inner_text("main"))
    ok("an open order offers an honest running-late notice", "Running late: add 15 minutes" in dp.inner_text("main"))
    dp.evaluate("""() => { const o = inboxOrders()[0]; o.text = "Order ABC123 Z=khulshi "; document.getElementById("main").replaceChildren(progressPanel(o, () => {})); }""")
    dp.click("button:has-text('Out for delivery')")
    dp.wait_for_timeout(200)
    ok("out for delivery needs the rider's name and mobile number", "rider's name and mobile" in dp.inner_text("#snackbar"))
    dp.goto(BASE + "#/")
    dp.wait_for_selector(".cat-tile")
    dp.evaluate("""async () => { const p = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]); const j = await crypto.subtle.exportKey("jwk", p.publicKey);
        const s = await sealOrder({ topic: "https://ntfy.sh/hana-testtopic0123456789", enc_key: { kty: "EC", crv: "P-256", x: j.x, y: j.y } }, { message: "x", code: "CHT123" });
        localStorage.setItem("hana.orders", JSON.stringify([{ code: "CHT123", status: "awaiting", created: new Date().toISOString(), window_start: new Date().toISOString(), restaurant: "Test", restaurant_id: "x", items: [], subtotal: 0, fee: 0, mode: "pickup", channel: "hana", order_topic: s.orderTopic, order_key: s.key }])); }""")
    dp.goto(BASE + "#/orders")
    dp.wait_for_selector("text=Messages with the business")
    dp.click("summary:has-text('Messages with the business')")
    dp.click("button:has-text('Where is my order?')")
    dp.wait_for_timeout(500)
    ok("a customer can message the business about an open order", any("HANA1R" in m["message"] for v in box.values() for m in v) and "Where is my order?" in dp.inner_text("main"))
    signing = dp.evaluate("""async () => {
        const biz = await makeOrderKey(), cust = await makeOrderKey();
        const p = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]); const j = await crypto.subtle.exportKey("jwk", p.publicKey);
        const s = await sealOrder({ topic: "https://ntfy.sh/hana-testtopic0123456789", enc_key: { kty: "EC", crv: "P-256", x: j.x, y: j.y } }, { message: "x", code: "SIG123" });
        const o = { code: "SIG123", status: "confirmed_signed", claimed: true, public_key: biz.pub, created: new Date().toISOString(), restaurant: "Test", restaurant_id: "x", items: [], subtotal: 0, fee: 0, mode: "delivery", channel: "hana", order_topic: s.orderTopic, order_key: s.key, sign_key: cust.jwk };
        localStorage.setItem("hana.orders", JSON.stringify([o]));
        await postSealed(s.orderTopic, s.key, { from: "b", t: "status", step: "delivered", text: "Delivered" });
        const real = await signUpdate(biz.jwk, "SIG123", { from: "b", at: new Date().toISOString(), t: "status", step: "out", text: "Out for delivery", rider: { name: "Rahim", phone: "+8801711111111" } });
        await postSealed(s.orderTopic, s.key, real);
        await pollFeeds();
        const got = JSON.parse(localStorage.getItem("hana.orders"))[0];
        const mine = await customerUpdate(o, { t: "chat", text: "Thanks" });
        const forged = Object.assign({}, mine, { text: "You never came" });
        return { steps: (got.progress || []).map((x) => x.step + ":" + x.verified), mine: await checkUpdate(cust.pub, "SIG123", mine), forged: await checkUpdate(cust.pub, "SIG123", forged), summary: complaintText(got) };
    }""")
    ok("an unsigned update is ignored and a signed one is accepted", signing["steps"] == ["out:true"], signing["steps"])
    ok("the customer's messages are signed and cannot be altered", signing["mine"] is True and signing["forged"] is False, signing)
    ok("the complaint summary carries the signed records", "(signed by the business)" in signing["summary"] and "Signed records" in signing["summary"])
    pc = page.evaluate("""() => [
        pricesConfirmedAt({ version: 1, price_history: [], announcement: { published: "2026-10-01T10:00:00+06:00" } }),
        pricesConfirmedAt({ version: 3, announcement: { published: "2026-10-20T10:00:00+06:00" }, price_history: [
            { version: 2, published: "2026-10-10T10:00:00+06:00", changes: [{ key: "x", old: 10, new: 12 }] },
            { version: 3, published: "2026-10-20T10:00:00+06:00", changes: [] }] }),
        pricesConfirmedAt({ version: 3, prices_confirmed_at: "2026-10-25T10:00:00+06:00", price_history: [] })]""")
    ok("the price date moves only with a price change or an explicit reconfirmation", pc == ["2026-10-01T10:00:00+06:00", "2026-10-10T10:00:00+06:00", "2026-10-25T10:00:00+06:00"], pc)
    # Order states without the demo: a confirmed order with no further news, an unsigned
    # update, and Active before Past even with many past orders.
    page.goto(BASE + "#/")
    page.evaluate("""() => {
        const now = Date.now(), iso = (ms) => new Date(now - ms).toISOString();
        const base = { restaurant: "Test Kitchen", restaurant_id: "x", items: [{ key: "a", label: "Rice", qty: 1, price: 50 }], subtotal: 50, fee: 0, mode: "delivery", channel: "whatsapp" };
        const past = Array.from({ length: 14 }, (_, i) => Object.assign({}, base, { code: "PAST" + String(i).padStart(2, "0"), status: "cancelled", created: iso(3600000 + i) }));
        const quiet = Object.assign({}, base, { code: "QUIET1", status: "confirmed_signed", created: iso(120000), confirmed_at: iso(60000) });
        const unsigned = Object.assign({}, base, { code: "UNSIG1", status: "confirmed_signed", created: iso(300000), confirmed_at: iso(240000),
            progress: [{ step: "accepted", at: iso(200000), text: "Accepted, being prepared", verified: false }] });
        localStorage.setItem("hana.orders", JSON.stringify(past.concat([quiet, unsigned])));
    }""")
    page.goto(BASE + "#/orders")
    page.wait_for_selector("text=Active")
    quiet = page.locator("article:has-text('QUIET1')").inner_text()
    ok("a confirmed order with no update says so, and claims no preparation", "Waiting for the business's next update" in quiet and "being prepared" not in quiet, quiet[:200])
    ok("an unsigned update is labelled as not verified", "Not verified" in page.locator("article:has-text('UNSIG1')").inner_text())
    order = page.evaluate("[...document.querySelectorAll('main h2, main article')].map((e) => e.tagName === 'ARTICLE' ? (e.innerText.match(/Order ([A-Z0-9]{6})/) || [])[1] : e.innerText)")
    ok("active orders come first, never pushed to a later page by past ones", order.index("Active") < order.index("QUIET1") < order.index("Past orders") and "UNSIG1" in order and order.index("UNSIG1") < order.index("Past orders"), order[:8])
    page.evaluate("localStorage.removeItem('hana.orders')")
    bn = page.evaluate("[fuzzyMatches('চা', 'Tea (cha) Milk tea'), fuzzyMatches('বিরিয়ানি', 'Chicken Biryani'), fuzzyMatches('অজানা', 'Chicken Biryani'), fuzzyMatches('ডিম', 'Farm eggs')]")
    ok("searching in Bangla script finds the English menu words, and an unknown word finds nothing", bn == [True, True, False, True], bn)
    mx = page.evaluate("[fuzzyMatches('চা', 'Masala tea'), fuzzyMatches('বিরানি', 'Kacchi biryani'), fuzzyMatches('মুরগী', 'Chicken roll'), fuzzyMatches('বিরিয়ানি kacchi', 'Kacchi biryani'), fuzzyMatches('kacchi বিরিয়ানি', 'Beef tehari'), fuzzyMatches('চা,', 'Masala tea')]")
    ok("Bangla spelling variants and mixed Bangla and English searches match correctly", mx == [True, True, True, True, False, True], mx)
    # A dropped connection on first load: the error explains itself, and Try again recovers.
    rc = browser.new_context(viewport={"width": 360, "height": 800}, service_workers="block")
    rp = rc.new_page()
    down = {"on": True}
    rc.route("**/*.json", lambda r: r.abort() if down["on"] else r.continue_())
    rp.goto(BASE + "#/")
    rp.wait_for_selector("text=Try again", timeout=15000)
    down["on"] = False
    rp.click("button:has-text('Try again')")
    rp.wait_for_selector("#q", timeout=15000)
    rp.wait_for_selector("#results .card-title", timeout=15000)
    ok("after a dropped connection, Try again loads the directory", "TONG: NOT A REAL PLACE" in rp.inner_text("#results") and "could not be loaded" not in rp.inner_text("main"))
    rc.close()
    # Demo listings: orders are confirmed and delivered on their own, with clear labels.
    TONG = json.loads(urllib.request.urlopen(ROOT_URL + "/list.json").read())
    TONG = next(x["id"] for x in TONG["listings"] if x.get("handle") == "tong")
    dm = browser.new_context(viewport={"width": 360, "height": 800}, service_workers="block").new_page()
    dm.on("pageerror", lambda e: errors.append(str(e)))
    dm.goto(BASE + "#/r/" + TONG)
    dm.wait_for_selector(".page-title")
    dm.goto(BASE + "#/")
    dm.wait_for_selector("#sort")
    dm.select_option("#sort", "fee")
    ok("places can be sorted by the customer, and cards show who confirmed the prices", "Demo, just for fun" in dm.inner_text("#results"))
    dm.goto(BASE + "#/r/" + TONG)
    dm.wait_for_selector(".page-title")
    ok("a demo listing says it is not a real place", "Demo, just for fun" in dm.inner_text("main") and "Not a real place" in dm.inner_text("main"))
    dm.click("button[aria-label^='Add Bun']")
    dm.goto(BASE + "#/basket")
    dm.wait_for_selector("#zone")
    dm.select_option("#zone", "khulshi")
    dm.fill("#name", "Test")
    dm.fill("#address", "Demo street")
    ok("a demo order offers only the demo channel", dm.eval_on_selector_all("input[name=channel] + span", "e => e.map(x => x.textContent)") == ["Demo order: nothing is sent, just for fun"])
    dm.click("button[type=submit]")
    dm.wait_for_selector("text=Confirmed automatically (demo)", timeout=10000)
    ok("placing an order goes straight to the order, and the basket is empty", "#/orders" in dm.url and dm.evaluate("!localStorage.getItem('hana.basket') || !JSON.parse(localStorage.getItem('hana.basket'))"))
    ok("the order shows a plain status, an arrival estimate and a timeline of real events", "Arriving in about" in dm.inner_text("section.order-hero") and "Order sent to TONG" in dm.inner_text("ol.order-timeline") and dm.locator("ol.order-timeline > li.next").count() == 1, dm.inner_text("section.order-hero"))
    dm.evaluate("() => { const o = JSON.parse(localStorage.getItem('hana.orders')); o[0].created = new Date(Date.now() - 40000).toISOString(); localStorage.setItem('hana.orders', JSON.stringify(o)); }")
    dm.wait_for_selector("text=Rice Uddin is on the way", timeout=5000)
    ok("Rice Uddin is the pretend rider, with a Call button", dm.locator("button[aria-label='Call Rice Uddin']").count() == 1 and "Out for delivery with Rice Uddin." in dm.inner_text("ol.order-timeline"))
    dm.evaluate("() => { const o = JSON.parse(localStorage.getItem('hana.orders')); o[0].created = new Date(Date.now() - 80000).toISOString(); localStorage.setItem('hana.orders', JSON.stringify(o)); }")
    dm.wait_for_selector("text=Hope you enjoyed your dopamine hit", timeout=5000)
    ok("a demo order is delivered on its own, labelled as a demo", "(demo)" in dm.inner_text("main") and "Problem with this order?" not in dm.inner_text("main") and "Order again" in dm.inner_text("main"))
    dm.context.close()
    # Business sign-in: a recovery phrase and a passkey unlock the key from vault.json.
    vctx = browser.new_context(viewport={"width": 360, "height": 800}, service_workers="block")
    published = {}
    vctx.route("**/vault.json", lambda r: r.fulfill(status=200, content_type="application/json", body=published["vault"]) if "vault" in published else r.fulfill(status=404, body=""))
    vp = vctx.new_page()
    vp.on("pageerror", lambda e: errors.append(str(e)))
    cdp = vctx.new_cdp_session(vp)
    cdp.send("WebAuthn.enable")
    cdp.send("WebAuthn.addVirtualAuthenticator", {"options": {"protocol": "ctap2", "transport": "internal", "hasResidentKey": True, "hasUserVerification": True, "isUserVerified": True, "hasPrf": True, "automaticPresenceSimulation": True}})
    vp.goto(BIZ + "#/connect")
    vp.wait_for_selector("text=Sign in with recovery phrase")
    vp.click("summary:has-text('Other ways')")
    vp.click("text=Create a new key (new business)")
    vp.click("button:has-text('Set up sign-in')")
    vp.wait_for_selector("#recovery-phrase")
    phrase = vp.inner_text("#recovery-phrase").strip()
    key_id = vp.evaluate("B.key.id")
    with vp.expect_download() as dl:
        vp.click("text=Download vault.json")
    published["vault"] = Path(dl.value.path()).read_text()
    ok("sign-in setup gives a five-word phrase and an encrypted vault", len(phrase.split()) == 5 and key_id in published["vault"] and '"d"' not in published["vault"], phrase)
    vp.click("text=Add a passkey on this device")
    vp.wait_for_selector("text=Passkey added")
    with vp.expect_download() as dl:
        vp.click("text=Download vault.json")
    published["vault"] = Path(dl.value.path()).read_text()
    ok("a passkey is added to the vault", '"type": "passkey"' in published["vault"])
    # The vault is the listing's: point Tava's listing at it, sign out, and sign in again.
    vp.evaluate("""(pub) => { const row = B.index.find((r) => r.id === pub.id); row.locations = ["menus/" + pub.id + "/menu.json"]; }""", {"id": TAVA})
    vp.click("text=Sign out on this device")
    vp.wait_for_selector("#si-phone")
    vp.fill("#si-phone", "+8801729298282")
    vp.fill("#si-words", "  " + phrase.upper().replace(" ", "   ") + " ")
    vp.click("text=Sign in with recovery phrase")
    vp.wait_for_selector("text=Signed in with key", timeout=20000)
    ok("the recovery phrase signs in, in any case and spacing", vp.evaluate("B.key && B.key.id") == key_id)
    vp.click("text=Sign out on this device")
    vp.wait_for_selector("#si-phone")
    vp.fill("#si-phone", "+8801729298282")
    vp.fill("#si-words", "abandon ability able about above")
    vp.click("text=Sign in with recovery phrase")
    vp.wait_for_selector("text=does not open this vault", timeout=20000)
    ok("a wrong phrase is refused", vp.evaluate("B.key") is None)
    vp.click("text=Sign in with passkey")
    vp.wait_for_selector("text=Signed in with key", timeout=20000)
    ok("the passkey signs in", vp.evaluate("B.key && B.key.id") == key_id)
    vp.click("summary:has-text('Staff')")
    vp.fill("#staff-name", "Rahim")
    vp.click("text=Add a staff member")
    vp.wait_for_selector("#staff-phrase")
    staff_phrase = vp.inner_text("#staff-phrase").strip()
    with vp.expect_download() as dl:
        vp.click("text=Download vault.json")
    published["vault"] = Path(dl.value.path()).read_text()
    vp.click("text=Sign out on this device")
    vp.wait_for_selector("#si-phone")
    vp.fill("#si-phone", "+8801729298282")
    vp.fill("#si-words", staff_phrase)
    vp.click("text=Sign in with recovery phrase")
    vp.wait_for_selector("text=as staff member Rahim", timeout=20000)
    ok("a staff member signs in with their own phrase and key", vp.evaluate("B.key.staff") == "Rahim" and vp.evaluate("B.key.id") != key_id and vp.evaluate("!!B.key.enc"))
    vp.goto(BIZ + "#/poster")
    vp.wait_for_selector("#poster svg", timeout=15000)
    ok("the QR poster shows the listing's code", "Tava Restaurant" in vp.inner_text("#poster"))
    vp.goto(BIZ + "#/setup")
    vp.wait_for_selector("progress")
    ok("the guided setup lists the steps with progress", "steps done" in vp.inner_text("main") and "Print your poster (done)" in vp.inner_text("main"))
    vp.evaluate("localStorage.setItem('hana.lang', 'bn')")
    vp.goto(BASE + "#/")
    vp.wait_for_timeout(1500)
    ok("Bangla replaces the interface labels", "হোম" in vp.inner_text("body") and vp.evaluate("document.documentElement.lang") == "bn")
    vp.evaluate("localStorage.removeItem('hana.lang')")
    vctx.close()
    dctx.close()
    ok("no script errors", not errors, errors)
    browser.close()

print("\nFAILED" if failed else "\nAll browser checks passed.")
sys.exit(1 if failed else 0)
