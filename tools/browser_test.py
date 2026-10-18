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
    sp.click("nav.kind-tabs button:has-text('Added by customers')")
    sp.wait_for_timeout(200)
    ok("an empty Added by customers tab explains itself instead of saying nothing matches", "No places here yet" in sp.inner_text("#results") and "Nothing matches" not in sp.inner_text("#results"), sp.inner_text("#results")[:200])
    ok("the home page loads no full menus and no search data", not any("/menus/" in u or "search.json" in u for u in seen_urls), [u for u in seen_urls if "menus/" in u])
    sp.close()
    # Orders sent in Hana, through a stand-in for ntfy that keeps messages in memory.
    box = {}
    def fake_ntfy(route):
        req = route.request
        path = req.url.split("https://ntfy.sh/", 1)[1]
        if path.startswith("hana-down"):
            route.abort()
        elif req.method == "POST":
            topic = path.strip("/")
            msg = {"id": "m" + str(sum(len(v) for v in box.values()) + 1), "time": int(datetime.now().timestamp()), "event": "message", "topic": topic, "message": req.post_data}
            box.setdefault(topic, []).append(msg)
            route.fulfill(status=200, content_type="application/json", body=json.dumps(msg))
        elif "/json" in path:
            topic = path.split("/json")[0]
            msgs = box.get(topic, [])
            since = re.search(r"since=([^&]+)", path)
            ids = [m["id"] for m in msgs]
            if since and since.group(1) in ids:
                msgs = msgs[ids.index(since.group(1)) + 1:]
            route.fulfill(status=200, content_type="application/x-ndjson", body="".join(json.dumps(m) + "\n" for m in msgs))
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
    # Presence is signed: forged, replayed, stale and unsigned signals are not believed.
    pres = dp.evaluate("""async () => {
        B.key = await createKey(); const keys = [B.key.publicB64];
        const evil = await createKey();
        const d = { topic: "https://ntfy.sh/hana-presence0123456789" }, pt = presenceTopic(d.topic);
        const out = {};
        out.none = (await presence(d, keys)).state;
        await ntfyPost(pt, "online");
        out.unsigned = (await presence(d, keys)).state;
        const off = await signPresence(B.key.jwk, d.topic, "offline", null, new Date(Date.now() - 60000));
        await ntfyPost(pt, off);
        out.offline = (await presence(d, keys)).state;
        await ntfyPost(pt, await signPresence(B.key.jwk, d.topic, "online", { sold: [], busy: 0 }));
        out.online = (await presence(d, keys)).state;
        await ntfyPost(pt, off);
        out.replayedOffline = (await presence(d, keys)).state;
        await ntfyPost(pt, await signPresence(evil.jwk, d.topic, "offline", null, new Date(Date.now() + 1000)));
        const forged = await signPresence(evil.jwk, d.topic, "online", { sold: ["fries"], pickup_only: true }, new Date(Date.now() + 2000));
        await ntfyPost(pt, forged);
        const p = await presence(d, keys);
        out.forged = [p.state, p.sold.length, p.pickup_only];
        const tampered = JSON.parse((await signPresence(B.key.jwk, d.topic, "online", {}, new Date(Date.now() + 3000))).slice(10)); tampered.s = "offline";
        await ntfyPost(pt, "presence1 " + JSON.stringify(tampered));
        out.tampered = (await presence(d, keys)).state;
        const d2 = { topic: "https://ntfy.sh/hana-stale0123456789" };
        await ntfyPost(presenceTopic(d2.topic), await signPresence(B.key.jwk, d2.topic, "online", {}, new Date(Date.now() - 40 * 60000)));
        out.stale = (await presence(d2, keys)).state;
        const d3 = { topic: "https://ntfy.sh/hana-other0123456789" };
        await ntfyPost(presenceTopic(d3.topic), await signPresence(B.key.jwk, d.topic, "online", {}));
        out.otherTopic = (await presence(d3, keys)).state;
        out.unreachable = (await presence({ topic: "https://ntfy.sh/hana-down0123456789" }, keys)).state;
        return out; }""")
    ok("with no signal, a business shows as not confirmed (not as a decision to stop); an unsigned signal shows as could not check", pres["none"] == "none" and pres["unsigned"] == "unknown", pres)
    ok("a signed signal sets the status, and the one signed last wins", pres["offline"] == "offline" and pres["online"] == "online", pres)
    ok("an authentic offline signal posted again cannot hide a newer online one", pres["replayedOffline"] == "online", pres)
    ok("a signal signed with another key cannot mark the business offline, sold out or pickup only", pres["forged"] == ["online", 0, False], pres)
    ok("an altered signed signal is rejected", pres["tampered"] == "online", pres)
    ok("an old signed signal posted again is ignored as stale", pres["stale"] == "none", pres)
    ok("a signal signed for another business's address is rejected", pres["otherTopic"] == "none", pres)
    ok("when the order service cannot be reached, the status is could not check, not available", pres["unreachable"] == "unknown", pres)
    live = dp.evaluate("""async () => { localStorage.setItem("hana.biz.connections", JSON.stringify({ orders: "https://ntfy.sh/hana-today0123456789" }));
        saveToday({ sold: ["fries"], busy: 30, pickup_only: true }); await new Promise((r) => setTimeout(r, 500));
        return presence({ topic: "https://ntfy.sh/hana-today0123456789" }, [B.key.publicB64]); }""")
    ok("sold-out items, busy time and pickup only reach customers with the signed presence signal", live["online"] and live["sold"] == ["fries"] and live["busy"] == 30 and live["pickup_only"], live)
    # Order intake: replays, made-up orders, oversized messages and floods.
    intake = dp.evaluate("""async () => {
        localStorage.setItem("hana.biz.connections", JSON.stringify({ orders: "https://ntfy.sh/hana-intake0123456789" }));
        localStorage.removeItem("hana.biz.inbox"); localStorage.removeItem("hana.biz.seen");
        const direct = { topic: "https://ntfy.sh/hana-intake0123456789", enc_key: B.key.enc.pub };
        const msg = (code) => "Order " + code + " (sent with Hana)\\nCHECK hana1 H=000000000000 Z=pickup I=x*1 S=0 F=0 C=00000000";
        const now = Math.floor(Date.now() / 1000);
        const take = (id, message, time) => takeMessage({ id, time: time || now, message, topic: "hana-intake0123456789" });
        const out = {};
        const s = await sealOrder(direct, { message: msg("RPA234"), code: "RPA234", cpub: null, sealed_at: new Date().toISOString() });
        out.first = await take("a1", s.envelope);
        out.replay = await take("a2", s.envelope);
        out.replayLater = await take("a3", s.envelope, now + 3600);
        const s2 = await sealOrder(direct, { message: msg("RPA235"), code: "RPA235", cpub: null, sealed_at: new Date().toISOString() });
        out.second = await take("a4", s2.envelope);
        out.count = inboxOrders().length;
        localStorage.setItem("hana.biz.inbox", JSON.stringify(inboxOrders().filter((o) => o.code !== "RPA234")));
        out.afterInboxCleared = await take("a5", s.envelope);
        const old = await sealOrder(direct, { message: msg("ADE234"), code: "ADE234", cpub: null, sealed_at: new Date(Date.now() - 2 * 86400000).toISOString() });
        out.old = await take("a6", old.envelope);
        const legacy = await sealOrder(direct, { message: msg("GEN234"), code: "GEN234", cpub: null });
        out.legacy = await take("a7", legacy.envelope);
        out.legacyBad = [await take("a7b", (await sealOrder(direct, { message: msg("GEN235"), code: "GEN235", reply: "https://evil.example/x" })).envelope),
          await take("a7c", (await sealOrder(direct, { message: msg("x"), code: 12345 })).envelope),
          await take("a7d", (await sealOrder(direct, { message: "Order GEN236 please", code: "GEN236" })).envelope),
          await take("a7e", (await sealOrder(direct, { message: msg("GEN237"), code: "GEN237", cpub: { x: 1 } })).envelope)];
        const evilReply = await sealOrder(direct, { message: msg("EVA234"), code: "EVA234", cpub: null, reply: "https://evil.example/collect", sealed_at: new Date().toISOString() });
        out.evilReply = await take("a8", evilReply.envelope);
        const noCheck = await sealOrder(direct, { message: "Order NCK234 please", code: "NCK234", sealed_at: new Date().toISOString() });
        out.noCheck = await take("a9", noCheck.envelope);
        const badCode = await sealOrder(direct, { message: msg("x"), code: { nested: { deep: [1, [2, [3]]] } }, sealed_at: new Date().toISOString() });
        out.badCode = await take("a10", badCode.envelope);
        out.huge = await take("a11", "HANA1 " + "A".repeat(40000) + ".B");
        out.garbage = await take("a12", "HANA1 abc.def");
        const o = inboxOrders().find((x) => x.code === "RPA235");
        const chat = "HANA1R " + await dSeal(await aesFromRaw(o.keyRaw), { from: "c", t: "chat", text: "Where is it?", at: new Date().toISOString() });
        const topic = o.reply.split("/").pop();
        out.chat1 = await takeMessage({ id: "c1", time: now, message: chat, topic });
        out.chat2 = await takeMessage({ id: "c2", time: now, message: chat, topic });
        out.chats = inboxOrders().find((x) => x.code === "RPA235").chat.length;
        const cancel = "HANA1R " + await dSeal(await aesFromRaw(o.keyRaw), { from: "c", t: "cancel", at: new Date().toISOString() });
        out.plainCancel = await takeMessage({ id: "k0", time: now, message: "CANCEL RPA235", topic: "hana-intake0123456789" });
        out.afterPlain = inboxOrders().find((x) => x.code === "RPA235").status;
        out.cancel1 = await takeMessage({ id: "k1", time: now, message: cancel, topic });
        out.cancel2 = await takeMessage({ id: "k2", time: now, message: cancel, topic });
        const t0 = performance.now();
        for (let i = 0; i < 230; i++) { const f = await sealOrder(direct, { message: msg("F" + String(i).padStart(5, "0")), code: "F" + String(i).padStart(5, "0"), sealed_at: new Date().toISOString() }); await take("f" + i, f.envelope); }
        out.flood = [inboxOrders().length, Math.round(performance.now() - t0)];
        return out; }""")
    ok("an order posted again under a new relay message id is taken in once", intake["first"] and not intake["replay"] and not intake["replayLater"] and intake["count"] == 2, intake)
    ok("two genuinely different orders stay separate", intake["second"], intake)
    ok("a replay is still caught after the order has left the inbox", not intake["afterInboxCleared"], intake)
    ok("an order sealed more than a day before it arrived is rejected; orders from older apps without a time are kept", not intake["old"] and intake["legacy"], intake)
    ok("an older app's order without a sealing time still passes every other check", intake["legacyBad"] == [False, False, False, False], intake["legacyBad"])
    ok("a made-up order that names a reply address elsewhere is rejected", not intake["evilReply"], intake)
    ok("malformed, oversized and nested payloads are dropped without breaking the inbox", not intake["noCheck"] and not intake["badCode"] and not intake["huge"] and not intake["garbage"], intake)
    ok("a flood of made-up orders leaves the inbox bounded", intake["flood"][0] <= 200, intake["flood"])
    ok("a plain CANCEL with a known code cannot change an order sent in Hana", not intake["plainCancel"] and intake["afterPlain"] == "new", intake)
    plain = dp.evaluate("""async () => { const now = Math.floor(Date.now() / 1000);
        const order = "Order PNB234 please\\nCHECK hana1 H=000000000000 Z=pickup I=x*1 S=0 F=0 C=00000000";
        const a = await takeMessage({ id: "p1", time: now, message: order, topic: "hana-intake0123456789" });
        const b = await takeMessage({ id: "p2", time: now, message: "CANCEL PNB234", topic: "hana-intake0123456789" });
        const o = inboxOrders().find((x) => x.code === "PNB234"); return [a, b, o.status, !!o.cancel_request]; }""")
    ok("for a plain order, a plain CANCEL is shown as an unverified request, not applied", plain == [True, True, "new", True], plain)
    ok("a customer message or cancellation posted again has no second effect", intake["chat1"] and not intake["chat2"] and intake["chats"] == 1 and intake["cancel1"] and not intake["cancel2"], intake)
    edges = dp.evaluate("""() => { const now = Date.now(), r = Math.floor(now / 1000), iso = (ms) => new Date(ms).toISOString();
        return { legacy: orderAgeOk(undefined, r), legacyNoRelay: orderAgeOk(undefined, 0), noRelay: orderAgeOk(iso(now), undefined), zeroRelay: orderAgeOk(iso(now), 0),
          badRelay: orderAgeOk(iso(now), "soon"), relayFarOff: orderAgeOk(iso(now), r + 3600), badSealed: orderAgeOk("yesterday", r), numberSealed: orderAgeOk(now, r),
          justInside: orderAgeOk(iso(now - 86400000 + 60000), r), justOutside: orderAgeOk(iso(now - 86400000 - 60000), r),
          smallSkew: orderAgeOk(iso(now + 5 * 60000), r), future: orderAgeOk(iso(now + 15 * 60000), r) }; }""")
    ok("new-format orders fail closed on a missing, zero, malformed or implausible relay time", not any(edges[k] for k in ("noRelay", "zeroRelay", "badRelay", "relayFarOff", "badSealed", "numberSealed")), edges)
    ok("the one-day limit holds at its edges, with small clock skew allowed and the future refused", edges["justInside"] and not edges["justOutside"] and edges["smallSkew"] and not edges["future"], edges)
    ok("orders from older apps, with no sealing time, take the separate accepted path", edges["legacy"] and edges["legacyNoRelay"], edges)
    hard = dp.evaluate("""async () => {
        localStorage.setItem("hana.biz.connections", JSON.stringify({ orders: "https://ntfy.sh/hana-hard0123456789" }));
        const reset = () => { localStorage.removeItem("hana.biz.inbox"); localStorage.removeItem("hana.biz.seen"); seenCache = null; };
        reset();
        const direct = { topic: "https://ntfy.sh/hana-hard0123456789", enc_key: B.key.enc.pub };
        const msg = (code) => "Order " + code + " (sent with Hana)\\nCHECK hana1 H=000000000000 Z=pickup I=x*1 S=0 F=0 C=00000000";
        const now = Math.floor(Date.now() / 1000), out = {};
        const take = (id, message) => takeMessage({ id, time: now, message, topic: "hana-hard0123456789" });
        const seal = (code, extra) => sealOrder(direct, Object.assign({ message: msg(code), code, cpub: null }, extra || {}));
        const oldNew = await seal("AAA111", { sealed_at: new Date(Date.now() - 25 * 3600000).toISOString() });
        const legacy = await seal("AAA222");
        out.legacyFirst = await take("h1", legacy.envelope);
        reset();
        out.oldAfterClear = await take("h2", oldNew.envelope);
        out.legacyAfterClear = await take("h3", legacy.envelope);
        reset();
        const fresh = await seal("AAA333", { sealed_at: new Date().toISOString() });
        const realSet = store.set; store.set = (k, v) => k === "hana.biz.inbox" ? false : realSet.call(store, k, v);
        out.storageFull = await take("h4", fresh.envelope);
        store.set = realSet;
        out.seenAfterFail = hasSeen("AAA333." + fresh.orderTopic.slice(-24));
        out.seenCheckWorks = (await take("h4b", (await seal("AAA444", { sealed_at: new Date().toISOString() })).envelope)) && hasSeen("AAA444." + inboxOrders()[0].reply.slice(-24));
        out.afterSpace = await take("h5", fresh.envelope);
        const realSet2 = store.set; store.set = (k, v) => k === "hana.biz.seen" ? false : realSet2.call(store, k, v);
        const s5 = await seal("AAA555", { sealed_at: new Date().toISOString() });
        out.keptWhenSeenFails = await take("h6", s5.envelope);
        store.set = realSet2;
        out.repeatAfterSeenFails = await take("h7", s5.envelope);
        out.copiesOf555 = inboxOrders().filter((o) => o.code === "AAA555").length;
        const full = Array.from({ length: 200 }, (_, i) => ({ id: "acc" + i, time: now, code: "C" + String(i).padStart(5, "0"), text: "", reply: "https://ntfy.sh/hana-o-" + String(i).padStart(24, "0"), status: "accepted", step: "accepted" }));
        const keepList = inboxOrders(); localStorage.setItem("hana.biz.inbox", JSON.stringify(full));
        const s6 = await seal("AAA666", { sealed_at: new Date().toISOString() });
        const realSet3 = store.set; store.set = (k, v) => k === "hana.biz.inbox" ? false : realSet3.call(store, k, v);
        out.fullAndFailing = await take("h8", s6.envelope);
        store.set = realSet3;
        out.fullThenWorks = await take("h9", s6.envelope);
        out.fullKeepsNew = inboxOrders().some((o) => o.code === "AAA666") && inboxOrders().filter((o) => o.status === "accepted").length === 200;
        const tops = followTopics("https://ntfy.sh/hana-new0123456789", inboxOrders().concat(Array.from({ length: 10 }, (_, i) => ({ reply: "https://ntfy.sh/hana-o-new" + i, status: "new" }))));
        out.topics = [tops.length, tops[0], tops.slice(1).every((t) => t.includes("hana-o-0")), tops.includes("https://ntfy.sh/hana-intake0123456789")];
        localStorage.setItem("hana.biz.inbox", JSON.stringify(keepList));
        const l = inboxOrders(); l.find((o) => o.code === "AAA333").status = "accepted"; saveInbox(l);
        const env = [];
        for (let i = 0; i < 2000; i++) env.push((await seal("B" + String(i).padStart(5, "0"), { sealed_at: new Date().toISOString() })).envelope);
        const t0 = performance.now();
        for (let i = 0; i < env.length; i++) await take("x" + i, env[i]);
        out.ms = Math.round(performance.now() - t0);
        out.inbox = inboxOrders().length;
        out.genuineKept = inboxOrders().some((o) => o.code === "AAA333" && o.status === "accepted");
        out.bytes = (localStorage.getItem("hana.biz.inbox") || "").length + (localStorage.getItem("hana.biz.seen") || "").length;
        out.replayAfterFlood = await take("x-again", env[0]);
        const real = await seal("AAA777", { sealed_at: new Date().toISOString() });
        out.genuineAfterFlood = (await take("x-real", real.envelope)) && inboxOrders()[0].code === "AAA777";
        out.dropped = droppedNew;
        return out; }""")
    ok("after the duplicate record is lost, an old new-format order is still refused; an older app's order comes back (the documented limit)", hard["legacyFirst"] and not hard["oldAfterClear"] and hard["legacyAfterClear"], hard)
    ok("an order that could not be stored is not marked as seen, and is taken in once storage works", not hard["storageFull"] and not hard["seenAfterFail"] and hard["seenCheckWorks"] and hard["afterSpace"], hard)
    ok("2,000 distinct made-up orders: the inbox stays at 200 and an order being prepared is kept", hard["inbox"] <= 200 and hard["genuineKept"] and not hard["replayAfterFlood"], hard)
    ok("when the duplicate record cannot be stored, the order is still kept, and a copy is still caught", hard["keptWhenSeenFails"] and not hard["repeatAfterSeenFails"] and hard["copiesOf555"] == 1, hard)
    ok("with the inbox full of orders being prepared and storage failing, the new order is not lost: it is taken in once storage works", not hard["fullAndFailing"] and hard["fullThenWorks"] and hard["fullKeepsNew"], hard)
    ok("with more than 29 open orders, the new address and the 29 orders being prepared are followed; the old address is not", hard["topics"] == [30, "https://ntfy.sh/hana-new0123456789", True, False], hard["topics"])
    ok("after a flood, a genuine new order is still taken in at the top, and removed unanswered orders are counted", hard["genuineAfterFlood"] and hard["dropped"] > 0, hard)
    keep = dp.evaluate("""async () => {
        const now = Math.floor(Date.now() / 1000);
        const mk = (i, t, step) => ({ id: "k" + i, time: t, code: "K" + String(i).padStart(5, "0"), text: "", reply: "", status: "accepted", step });
        const list = [mk(0, now - 30 * 3600, "accepted"), mk(1, now - 30 * 3600, "delivered")].concat(Array.from({ length: 205 }, (_, i) => mk(i + 2, now - 60, "delivered")));
        list.sort((a, b) => b.time - a.time);
        localStorage.setItem("hana.biz.inbox", "[]"); saveInbox(list);
        const live = inboxOrders();
        while (archiveRun) await archiveRun;
        const recs = await POSDB.all("orders");
        return { openKept: live.some((o) => o.code === "K00000"), oldFinishedGone: !live.some((o) => o.code === "K00001"), finishedTrimmed: live.length,
          archivedAll: ["K00000", "K00001", "K00206"].every((c) => recs.some((r) => r.code === c)), floodArchived: recs.filter((r) => /^B\\d{5}$/.test(r.code)).length,
          noKeys: recs.every((r) => !("keyRaw" in r)), inBackup: (await allRecords()).some((r) => r.store === "orders") }; }""")
    ok("an open order older than 24 hours stays in the live inbox, ahead of 205 finished ones; finished orders older than a day leave it", keep["openKept"] and keep["oldFinishedGone"] and keep["finishedTrimmed"] <= 220, keep)
    ok("every order, including those trimmed from the live inbox and the 2,000 flood orders, is in the order records, without private keys, and in the backup", keep["archivedAll"] and keep["floodArchived"] == 2000 and keep["noKeys"] and keep["inBackup"], keep)
    other = dctx.new_page()
    other.goto(BIZ + "#/")
    other.wait_for_selector(".page-title")
    after = other.evaluate("async () => (await POSDB.all('orders')).some((r) => r.code === 'K00000')")
    other.close()
    ok("the order records are there when the business tools are opened again", after)
    print("      measured: 2,000 orders taken in in %d ms; inbox and duplicate record use %d KB" % (hard["ms"], hard["bytes"] // 1024))
    pflood = "hana-pflood0123456789-online"
    box[pflood] = [{"id": "pf%04d" % i, "time": int(datetime.now().timestamp()), "event": "message", "topic": pflood, "message": "x" * 1000} for i in range(400)]
    pf = dp.evaluate("async () => (await presence({ topic: 'https://ntfy.sh/hana-pflood0123456789' }, [B.key.publicB64])).state")
    ok("a presence address flooded beyond what is read is shown as could not check, not as offline", pf == "unknown", pf)
    # A very large relay answer: 5,000 messages (about 8 MB) on one address.
    big = "hana-big0123456789"
    filler = "x" * 1500
    box[big] = [{"id": "g%05d" % i, "time": int(datetime.now().timestamp()), "event": "message", "topic": big, "message": filler} for i in range(5000)]
    bigres = dp.evaluate("""async (t) => { const t0 = performance.now(); let from = "12h", total = 0, rounds = 0, maxOne = 0; const ids = new Set();
        for (;;) { const m = await ntfyPoll("https://ntfy.sh/" + t, from); rounds++; total += m.length; maxOne = Math.max(maxOne, m.length); m.forEach((x) => ids.add(x.id)); if (m.lastId) from = m.lastId; if (!m.truncated) break; if (rounds > 50) break; }
        return { total, unique: ids.size, rounds, maxOne, ms: Math.round(performance.now() - t0), heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; }""", big)
    ok("a very large relay answer is read at most 1 MB at a time, in order, continuing from the last message: nothing lost or repeated", bigres["total"] == 5000 and bigres["unique"] == 5000 and bigres["maxOne"] < 700 and bigres["rounds"] > 5, bigres)
    print("      measured: 5,000 messages (about 8 MB) read in %d passes of at most %d messages, %d ms in all, JS heap %s MB" % (bigres["rounds"], bigres["maxOne"], bigres["ms"], bigres["heap"]))
    dp.evaluate("""(t) => { localStorage.setItem("hana.biz.connections", JSON.stringify({ orders: "https://ntfy.sh/" + t })); localStorage.setItem("hana.biz.phone", "+8801729298282"); localStorage.removeItem("hana.biz.since"); }""", big)
    dp.goto(BIZ + "#/")
    dp.goto(BIZ + "#/confirm")
    dp.wait_for_selector("text=More messages are still waiting", timeout=20000)
    since_now = dp.evaluate("JSON.parse(localStorage.getItem('hana.biz.since'))['https://ntfy.sh/hana-big0123456789']")
    ok("when a flood is bigger than one pass, the inbox says more messages are waiting and remembers where it stopped", since_now and since_now.startswith("g") and int(since_now[1:]) > 1000, since_now)
    dp.goto(BIZ + "#/")
    dp.wait_for_selector(".page-title")
    dp.evaluate("""() => { localStorage.setItem("hana.biz.connections", JSON.stringify({ orders: "https://ntfy.sh/hana-down0123456789" })); localStorage.setItem("hana.biz.phone", "+8801729298282"); localStorage.removeItem("hana.biz.inbox"); }""")
    dp.goto(BIZ + "#/confirm")
    dp.wait_for_timeout(1500)
    inb = dp.inner_text("main")
    ok("when the order service cannot be reached, the inbox says so with Retry instead of showing no orders", "Could not reach the order service" in inb and "No orders in the last 24 hours" not in inb and dp.locator("button:has-text('Retry')").count() == 1, inb[:400])
    ok("after a flood, the inbox says there are unusually many new orders and points to Connections", "Unusually many new orders" in inb and "Check each one by phone" in inb, inb[:600])
    dp.goto(BIZ + "#/")
    dp.wait_for_selector(".page-title")
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
    allday = page.evaluate("(() => { const h = {}; for (const d of DAYS) h[d] = [['00:00', '23:59']]; const late = new Date(2026, 9, 16, 23, 59, 30); const night = { fri: [['18:00', '02:00']] }; return [openNow(h, late), openNow(night, new Date(2026, 9, 17, 1, 0)), openNow({ fri: [['09:00', '17:00']] }, new Date(2026, 9, 16, 17, 0))]; })()")
    ok("a business open 00:00 to 23:59 is open in the last minute of the day; overnight and closing times still work", allday == [True, True, False], allday)
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
    dm.wait_for_timeout(200)
    bar = dm.inner_text("#basket-bar")
    ok("the basket bar shows the item count and, with every price listed, the subtotal", "1 item" in bar and "BDT" in bar, bar)
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
    # Order again with a real price change: the earlier order recorded BDT 5 less than today's menu.
    was = dm.evaluate("() => { const o = JSON.parse(localStorage.getItem('hana.orders')); o[0].items[0].price -= 5; localStorage.setItem('hana.orders', JSON.stringify(o)); return [o[0].items[0].label, o[0].items[0].price]; }")
    dm.goto(BASE + "#/orders")
    dm.wait_for_selector("text=Order again")
    dm.click("text=Order again")
    dm.wait_for_selector("#zone")
    note = "%s is now BDT %s (it was BDT %s)." % (was[0], f"{was[1] + 5:,}", f"{was[1]:,}")
    ok("order again shows both the old and the new price when a price changed", note in dm.inner_text("main"), [note, dm.inner_text("main")[:300]])
    dm.context.close()
    # Sending in Hana from the real checkout, with a relay that drops answers or refuses.
    import base64, hashlib
    from cryptography.hazmat.primitives.asymmetric import ec, ed25519
    from cryptography.hazmat.primitives import serialization
    b64u = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
    ek = ec.generate_private_key(ec.SECP256R1()); en = ek.private_numbers()
    enc_pub = {"kty": "EC", "crv": "P-256", "x": b64u(en.public_numbers.x.to_bytes(32, "big")), "y": b64u(en.public_numbers.y.to_bytes(32, "big"))}
    enc_priv = dict(enc_pub, d=b64u(en.private_value.to_bytes(32, "big")))
    sk = ed25519.Ed25519PrivateKey.generate()
    sk_pub = b64u(sk.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw))
    sk_jwk = {"kty": "OKP", "crv": "Ed25519", "x": sk_pub, "d": b64u(sk.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption()))}
    E2E = "https://ntfy.sh/hana-e2e0123456789"
    lst = json.loads(urllib.request.urlopen(ROOT_URL + "/list.json").read())
    lite = next(x for x in lst["listings"] if x.get("handle") == "tong")
    menu = json.loads(urllib.request.urlopen(ROOT_URL + "/" + lite["location"]).read())
    menu.update({"demo": False, "claimed": True, "owner": {"public_key": sk_pub}, "direct": {"topic": E2E, "enc_key": enc_pub}})
    mbytes = json.dumps(menu).encode()
    lite.update({"demo": False, "claimed": True, "menu_hash": hashlib.sha256(mbytes).hexdigest()})
    lbytes = json.dumps(lst).encode()
    relay = {"mode": "ok"}
    def e2e_ntfy(route):
        req = route.request
        path = req.url.split("https://ntfy.sh/", 1)[1]
        if req.method == "POST" and path.startswith("hana-o-") and relay.get("cancel") == "lose":
            return route.abort()
        if req.method == "POST" and path.strip("/") == "hana-e2e0123456789":
            if relay["mode"] == "refuse":
                return route.fulfill(status=429, body="")
            msg = {"id": "e" + str(sum(len(v) for v in box.values()) + 1), "time": int(datetime.now().timestamp()), "event": "message", "topic": "hana-e2e0123456789", "message": req.post_data}
            box.setdefault("hana-e2e0123456789", []).append(msg)
            if relay["mode"] == "store500":
                return route.fulfill(status=500, body="")
            return route.abort() if relay["mode"] == "lose" else route.fulfill(status=200, content_type="application/json", body=json.dumps(msg))
        fake_ntfy(route)
    ectx = browser.new_context(viewport={"width": 360, "height": 800}, service_workers="block")
    ectx.route("https://ntfy.sh/**", e2e_ntfy)
    ectx.route("**/list.json", lambda r: r.fulfill(status=200, content_type="application/json", body=lbytes))
    ectx.route("**/" + lite["location"], lambda r: r.fulfill(status=200, content_type="application/json", body=mbytes))
    ep = ectx.new_page()
    ep.on("pageerror", lambda e: errors.append(str(e)))
    ep.goto(BASE + "#/")
    ep.wait_for_selector("#q")
    def menu_text():
        ep.goto(BASE + "#/")
        ep.wait_for_selector("#q")
        ep.goto(BASE + "#/r/" + lite["id"])
        ep.wait_for_selector(".page-title")
        ep.wait_for_timeout(500)
        return ep.inner_text("main")
    post = lambda js: ep.evaluate("async ([jwk, topic, when]) => { await ntfyPost(presenceTopic(topic), " + js + "); }", [sk_jwk, E2E, 0])
    t_none = menu_text()
    post("'online'")
    t_unknown = menu_text()
    post("await signPresence(jwk, topic, 'offline', null, new Date(Date.now() - 60000))")
    old_off = box[[k for k in box if k.endswith("-online") and "e2e" in k][0]][-1]["message"]
    t_off = menu_text()
    post("await signPresence(jwk, topic, 'online', {})")
    t_on = menu_text()
    post(json.dumps(old_off))
    t_replay = menu_text()
    ok("customers see: no signal as not confirmed, an unsigned one as could not check, a signed offline as not taking orders",
       "Not confirmed as taking orders" in t_none and "Not taking orders right now" not in t_none
       and "Could not check whether it is taking orders" in t_unknown and "Not taking orders right now" not in t_unknown
       and "Not taking orders right now" in t_off, [t_none[:300], t_unknown[:300], t_off[:300]])
    ok("a later signed online clears the notices, and replaying the old signed offline does not bring it back",
       not any(x in t_on + t_replay for x in ("Not taking orders right now", "Not confirmed as taking", "Could not check")), [t_on[:300], t_replay[:300]])
    def checkout(adds):
        ep.evaluate("() => { const o = JSON.parse(localStorage.getItem('hana.orders') || '[]'); o.forEach((x) => { x.status = 'cancelled'; }); localStorage.setItem('hana.orders', JSON.stringify(o)); }")
        ep.goto(BASE + "#/r/" + lite["id"])
        ep.wait_for_selector(".page-title")
        ep.wait_for_timeout(400)
        for _ in range(adds):
            ep.click("button[aria-label^='Add Bun']")
            ep.wait_for_timeout(150)
        ep.goto(BASE + "#/basket")
        ep.wait_for_selector("#zone")
        fill_details()
    def fill_details():
        ep.select_option("#zone", "khulshi")
        ep.fill("#name", "Test")
        ep.fill("#address", "House 1")
        ep.fill("#phone", "01712345678")
    def send():
        ep.wait_for_timeout(2100)
        ep.click("button[type=submit]")
    posts = lambda: [m["message"] for m in box.get("hana-e2e0123456789", [])]
    replies = lambda: [m for t, v in box.items() if t.startswith("hana-o-") for m in v]
    saved = lambda: ep.evaluate("JSON.parse(localStorage.getItem('hana.orders') || '[]').map((o) => [o.code, o.status, !!o.uncertain])")
    def open_orders():
        ep.goto(BASE + "#/orders")
        ep.wait_for_selector("h2.card-title")
        ep.wait_for_timeout(300)
    # 1. The connection drops: the order is kept as "sending not confirmed", visible, and resendable.
    checkout(1)
    relay["mode"] = "lose"
    send()
    ep.wait_for_url("**#/orders", timeout=5000)
    ep.wait_for_selector("text=Sending not confirmed", timeout=5000)
    first = saved()
    code = first[0][0]
    ok("when the connection drops, the order is kept and labelled sending not confirmed, never as sent or failed", first == [[code, "awaiting", True]] and len(posts()) == 1 and "Order " + code + " sent" not in ep.inner_text("main") and "Not yet confirmed as sent" in ep.inner_text("main"), [first, ep.inner_text("main")[:300]])
    ep.reload()
    ep.wait_for_selector("button[data-role=resend]")
    ep.click("button[data-role=resend]")
    ep.wait_for_timeout(800)
    ok("after a refresh, Send again with the connection still down keeps it not confirmed", saved()[0][2] and len(posts()) == 2 and "still not confirmed" in ep.inner_text("#snackbar"), [saved(), ep.inner_text("#snackbar")])
    relay["mode"] = "ok"
    ep.click("button[data-role=resend]")
    ep.wait_for_timeout(800)
    p1 = posts()
    ok("Send again resends the identical sealed order, and then the order shows as sent", len(p1) == 3 and p1[0] == p1[1] == p1[2] and saved() == [[code, "awaiting", False]] and ep.locator("button[data-role=resend]").count() == 0, [len(p1), saved()])
    # 2. A second uncertain order blocks a changed basket until it is resolved; a failed
    #    cancellation keeps it open.
    checkout(1)
    relay["mode"] = "lose"
    send()
    ep.wait_for_url("**#/orders", timeout=5000)
    code2 = saved()[0][0]
    relay["mode"] = "ok"
    ep.goto(BASE + "#/r/" + lite["id"])
    ep.wait_for_selector(".page-title")
    ep.wait_for_timeout(300)
    ep.click("button[aria-label^='Add Bun']")
    ep.click("button[aria-label^='Add Bun']")
    ep.goto(BASE + "#/basket")
    ep.wait_for_selector("#zone")
    fill_details()
    n_before = len(posts())
    send()
    ep.wait_for_timeout(800)
    ok("a changed basket cannot be sent while the earlier order's sending is unconfirmed", "already have an order waiting" in ep.inner_text("main") and len(posts()) == n_before, ep.inner_text("main")[-300:])
    relay["cancel"] = "lose"
    open_orders()
    ep.locator("article:has-text('" + code2 + "') button:has-text('Cancel')").first.click()
    ep.click("#dialog-ok")
    ep.wait_for_timeout(800)
    ok("when its cancellation cannot be sent, the earlier order stays open and the customer is told", ["awaiting"] == [x[1] for x in saved() if x[0] == code2] and "Could not send the cancellation" in ep.inner_text("#snackbar"), [saved(), ep.inner_text("#snackbar")])
    relay["cancel"] = "ok"
    ep.locator("article:has-text('" + code2 + "') button:has-text('Cancel')").first.click()
    ep.click("#dialog-ok")
    ep.wait_for_timeout(800)
    ok("a cancellation that was sent is shown as not yet acknowledged, not as read by the business", ["cancelled"] == [x[1] for x in saved() if x[0] == code2] and "not yet acknowledged" in ep.inner_text("#snackbar"), [saved(), ep.inner_text("#snackbar")])
    ep.goto(BASE + "#/basket")
    ep.wait_for_selector("#zone")
    fill_details()
    n_before = len(posts())
    send()
    ep.wait_for_timeout(800)
    ok("until the business acknowledges the cancellation, a new order to it waits", "has not been acknowledged by the business yet" in ep.inner_text("main") and len(posts()) == n_before, ep.inner_text("main")[-300:])
    rec2 = ep.evaluate("(c) => JSON.parse(localStorage.getItem('hana.orders')).find((o) => o.code === c)", code2)
    forged = ep.evaluate("""async ([rec]) => { await postSealed(rec.order_topic, rec.order_key, { from: "b", t: "cancel_ack", code: rec.code, at: new Date().toISOString() }); }""", [rec2])
    ep.goto(BASE + "#/orders")
    ep.wait_for_timeout(16500)
    ok("an unsigned acknowledgement is ignored", ep.evaluate("(c) => !!JSON.parse(localStorage.getItem('hana.orders')).find((o) => o.code === c).cancel_unacked", code2))
    ep.evaluate("""async ([jwk, rec]) => { await postSealed(rec.order_topic, rec.order_key, await signUpdate(jwk, rec.code, { from: "b", t: "cancel_ack", code: rec.code, at: new Date().toISOString() })); }""", [sk_jwk, rec2])
    for _ in range(40):
        ep.wait_for_timeout(500)
        if not ep.evaluate("(c) => !!JSON.parse(localStorage.getItem('hana.orders')).find((o) => o.code === c).cancel_unacked", code2):
            break
    ok("a signed acknowledgement from the business clears it", "acknowledged the cancellation" in ep.inner_text("main"), ep.inner_text("main")[:300])
    ep.goto(BASE + "#/basket")
    ep.wait_for_selector("#zone")
    fill_details()
    send()
    ep.wait_for_url("**#/orders", timeout=5000)
    code3 = saved()[0][0]
    ok("once the earlier order is cancelled, the changed basket is sent as a new order", code3 not in (code, code2) and saved()[0][1] == "awaiting" and not saved()[0][2], saved())
    # 3. The relay refuses: nothing was sent, no order record, and Send tries again.
    checkout(1)
    relay["mode"] = "refuse"
    send()
    ep.wait_for_selector("text=was not sent", timeout=5000)
    ok("when the order service refuses an order (429), the customer is told it was not sent and no record is kept", "refused it (429)" in ep.inner_text("main") and "Nothing reached the business" in ep.inner_text("main") and len(saved()) == 3, ep.inner_text("main")[:300])
    # 3b. A server error after the relay stored the order is uncertain, not "not sent".
    checkout(1)
    relay["mode"] = "store500"
    n0 = len(posts())
    send()
    ep.wait_for_url("**#/orders", timeout=5000)
    ep.wait_for_selector("text=Sending not confirmed", timeout=5000)
    ok("a server error (500) after the relay kept the order is reported as not confirmed, never as nothing reached the business", len(posts()) == n0 + 1 and saved()[0][2] and "Nothing reached the business" not in ep.inner_text("main"), saved()[:2])
    # 3c. A slow relay: repeated taps during a 5-second send make one order.
    checkout(1)
    relay["mode"] = "ok"
    n0 = len(posts())
    ep.evaluate("""() => { const f = window.fetch; window.fetch = (u, o) => (o && o.method === "POST" && String(u).includes("hana-e2e")) ? new Promise((r) => setTimeout(r, 5000)).then(() => f(u, o)) : f(u, o); }""")
    ep.wait_for_timeout(2100)
    ep.click("button[type=submit]")
    for _ in range(6):
        ep.wait_for_timeout(600)
        ep.evaluate("() => { const f = document.querySelector('form'); if (f) f.requestSubmit(); }")
    disabled = ep.evaluate("() => { const b = document.querySelector('button[type=submit]'); return b ? b.disabled : null; }")
    ep.wait_for_url("**#/orders", timeout=10000)
    ep.wait_for_timeout(500)
    ok("during a 5-second send, the Send button is disabled and repeated taps make exactly one order", disabled is True and len(posts()) == n0 + 1 and len([x for x in saved() if x[1] == "awaiting"]) >= 1, [disabled, len(posts()) - n0])
    # 3d. Storage fails after the relay took the order: the record saved before sending survives.
    ep.reload()
    checkout(1)
    ep.evaluate("""() => { const real = Storage.prototype.setItem; let n = 0; Storage.prototype.setItem = function (k, v) { if (k === "hana.orders" && ++n === 2) throw new Error("QuotaExceededError"); return real.call(this, k, v); }; }""")
    n0 = len(posts())
    send()
    ep.wait_for_url("**#/orders", timeout=5000)
    ep.reload()
    ep.wait_for_selector("h2.card-title")
    rec4 = ep.evaluate("JSON.parse(localStorage.getItem('hana.orders'))[0]")
    ok("when storage fails after the relay took the order, the order is still on the phone after a reload, with its reply channel", len(posts()) == n0 + 1 and rec4["uncertain"] and rec4["envelope"] == posts()[-1] and rec4["order_topic"] and rec4["order_key"], {k: rec4.get(k) for k in ("code", "status", "uncertain")})
    ep.evaluate("""async ([jwk, rec]) => { const m = await signUpdate(jwk, rec.code, { from: "b", t: "chat", text: "We have your order.", at: new Date().toISOString() }); await postSealed(rec.order_topic, rec.order_key, m); }""", [sk_jwk, rec4])
    ep.goto(BASE + "#/")
    ep.goto(BASE + "#/orders")
    for _ in range(40):
        ep.wait_for_timeout(500)
        rec4b = ep.evaluate("JSON.parse(localStorage.getItem('hana.orders'))[0]")
        if rec4b.get("chat"):
            break
    ok("that recovered order still receives the business's signed reply, which also clears sending not confirmed", not rec4b.get("uncertain") and any("We have your order." in (c.get("text") or "") for c in rec4b.get("chat") or []), {k: rec4b.get(k) for k in ("uncertain", "chat")})
    checkout(1)
    ep.evaluate("""() => { const real = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === "hana.orders") throw new Error("QuotaExceededError"); return real.call(this, k, v); }; }""")
    n0 = len(posts())
    send()
    ep.wait_for_selector("text=could not be saved here, and it was not sent", timeout=5000)
    ok("when the order cannot be saved on the phone first, nothing is sent", len(posts()) == n0, len(posts()) - n0)
    ep.reload()
    # 4. The business: copies at the same moment, the earlier uncertain order arriving late, and its cancellation.
    ep.goto(BIZ + "#/")
    ep.wait_for_selector(".page-title")
    msgs = box.get("hana-e2e0123456789", [])
    took = ep.evaluate("""async ([priv, topic, msgs, extra]) => {
        localStorage.setItem("hana.biz.connections", JSON.stringify({ orders: topic })); localStorage.removeItem("hana.biz.inbox"); localStorage.removeItem("hana.biz.seen"); seenCache = null;
        B.key = { enc: { priv } };
        const r = await Promise.all(msgs.map((m) => takeMessage(m)));
        for (const m of extra) await takeMessage(m);
        return [r.filter(Boolean).length, inboxOrders().map((o) => o.code).sort(), inboxOrders().filter((o) => o.status === "cancelled").map((o) => o.code)]; }""",
        [enc_priv, E2E, msgs, [dict(m, topic=m["topic"]) for m in replies()]])
    distinct = len(set(m["message"] for m in msgs))
    ok("the business takes in each order once (copies arriving together included) and sees the late order's cancellation", took[0] == distinct and len(took[1]) == distinct and all(x in took[1] for x in (code, code2, code3)) and code2 in took[2], [took, distinct, len(msgs)])
    ectx.close()
    # Places added by customers: kept on the phone, ordered from, shared with volunteers, and listed apart.
    from cryptography.hazmat.primitives.asymmetric import ec as _ec
    rk = _ec.generate_private_key(_ec.SECP256R1()); rn = rk.private_numbers()
    rep_pub = {"kty": "EC", "crv": "P-256", "x": b64u(rn.public_numbers.x.to_bytes(32, "big")), "y": b64u(rn.public_numbers.y.to_bytes(32, "big"))}
    rep_priv = dict(rep_pub, d=b64u(rn.private_value.to_bytes(32, "big")))
    site = json.loads(urllib.request.urlopen(ROOT_URL + "/site.json").read())
    site["reports"] = {"topic": "https://ntfy.sh/hana-reports0123456789", "enc_key": rep_pub}
    lst2 = json.loads(urllib.request.urlopen(ROOT_URL + "/list.json").read())
    for x in lst2["listings"]:
        if x.get("handle") == "tava":
            x["added_by"] = "customer"
    mctx = browser.new_context(viewport={"width": 360, "height": 800}, service_workers="block")
    mctx.route("https://ntfy.sh/**", fake_ntfy)
    mctx.route("**/site.json", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(site)))
    mctx.route("**/list.json", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(lst2)))
    mp = mctx.new_page()
    mp.on("pageerror", lambda e: errors.append(str(e)))
    mreqs = []
    mp.on("request", lambda q: mreqs.append(q.url))
    mp.goto(BASE + "#/")
    mp.wait_for_selector("#q")
    mp.wait_for_timeout(300)
    ok("the home page does not load the add-a-place form", not any("myplaces.js" in u for u in mreqs))
    for tw in (320, 360, 412, 800):
        mp.set_viewport_size({"width": tw, "height": 800})
        mp.wait_for_timeout(150)
        for fs in ("100%", "200%"):
            mp.evaluate("(f) => { document.documentElement.style.fontSize = f; }", fs)
            mp.wait_for_timeout(100)
            sz = mp.evaluate("() => [...document.querySelectorAll('nav.kind-tabs > button')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), b.scrollWidth <= b.clientWidth + 1]; })")
            ok("the type tabs are equal cells with nothing cut off, %dpx, text %s" % (tw, fs), len(set(x[0] for x in sz)) == 1 and len(set(x[1] for x in sz)) == 1 and all(x[2] for x in sz), sz)
    mp.evaluate("() => { document.documentElement.style.fontSize = ''; }")
    mp.set_viewport_size({"width": 360, "height": 800})

    mp.evaluate("() => localStorage.setItem('hana.me', JSON.stringify({ name: 'Secret Customer', address: 'My House', phone: '+8801999999999' }))")
    mp.click("a:has-text('Your favourite place is missing? Add it.')")
    mp.wait_for_selector("#mp-name")
    mp.fill("#mp-name", "Rahim Hotel")
    mp.fill("#mp-tel", "01812345678")
    mp.click("button:has-text('Save on this phone')")
    mp.wait_for_timeout(200)
    err1 = mp.inner_text("main")
    ok("a place needs a way to write to it: a number for calls alone is not enough, and delivery or pickup must be ticked", "cannot take a written order" in err1 and "Tick delivery, pickup or both" in err1, err1[-400:])
    mp.fill("#mp-wa", "01712345678")
    mp.fill("#mp-sms", "123")
    mp.click("button:has-text('Save on this phone')")
    mp.wait_for_timeout(200)
    ok("a wrong number is caught", "Check the text message number" in mp.inner_text("main"))
    mp.fill("#mp-sms", "")
    mp.select_option("#mp-zone", "khulshi")
    mp.locator("#mp-delivers").check(force=True)
    mp.fill("#mp-fee", "50")
    mp.fill("#mp-items", "Chicken biryani, 220\nBeef tehari Tk 180\nBorhani")
    mp.click("button:has-text('Save on this phone')")
    mp.wait_for_selector("text=Added by you, only on your phone")
    pid = mp.url.split("#/r/")[1]
    page_txt = mp.inner_text("main")
    ok("the place is saved on the phone and opens as a listing, labelled added by you, with its menu", "Rahim Hotel" in page_txt and "Chicken biryani" in page_txt and "BDT 220" in page_txt and "BDT 180" in page_txt and "Borhani" in page_txt, page_txt[:500])
    mp.goto(BASE + "#/")
    mp.wait_for_selector("#q")
    all_txt = mp.inner_text("#results")
    mp.click("nav.kind-tabs button:has-text('Added by customers')")
    mp.wait_for_timeout(200)
    cust_txt = mp.inner_text("#results")
    ok("places added by customers are in their own tab with an explicit tag, not among the directory's listings", "Rahim Hotel" not in all_txt and "Tava Restaurant" not in all_txt and "Rahim Hotel" in cust_txt and "Added by you · only on your phone" in cust_txt, [all_txt[:200], cust_txt[:400]])
    ok("a shared place that volunteers listed shows in the same tab, tagged as added by a customer", "Tava Restaurant" in cust_txt and "Added by a customer · not confirmed by the business" in cust_txt, cust_txt[:600])
    mp.goto(BASE + "#/r/" + pid)
    mp.wait_for_selector(".page-title")
    mp.click("button[aria-label^='Add Chicken biryani']")
    mp.goto(BASE + "#/basket")
    mp.wait_for_selector("#zone")
    mp.select_option("#zone", "khulshi")
    mp.fill("#name", "Test")
    mp.fill("#address", "House 1")
    bt = mp.inner_text("main")
    chans = mp.eval_on_selector_all("input[name=channel] + span", "e => e.map(x => x.textContent)")
    ok("checkout offers the place's own WhatsApp and says the prices are not confirmed", any("WhatsApp" in c for c in chans) and "You added this place yourself" in bt and "Delivery fee" in bt, [chans, bt[:300]])
    mp.wait_for_timeout(2100)
    mp.click("button[type=submit]")
    mp.wait_for_url("**#/orders", timeout=5000)
    href = mp.get_attribute("a:has-text('Open WhatsApp')", "href")
    ok("ordering opens WhatsApp to the place's number with the order written out", href and href.startswith("https://wa.me/8801712345678?text=") and "Chicken%20biryani" in href, href)
    mp.goto(BASE + "#/add/" + pid)
    mp.wait_for_selector("#mp-name")
    mp.fill("#mp-name", "Rahim Hotel and Restaurant")
    mp.click("button:has-text('Save changes')")
    mp.wait_for_selector("text=Rahim Hotel and Restaurant")
    ok("a place can be edited", mp.evaluate("JSON.parse(localStorage.getItem('hana.myplaces'))[0].name") == "Rahim Hotel and Restaurant")
    mp.goto(BASE + "#/add/" + pid)
    mp.wait_for_selector("#mp-name")
    mp.click("button:has-text('Save and share for everyone')")
    mp.click("#dialog-ok")
    mp.wait_for_selector("text=Sent to the volunteers", timeout=5000)
    sug = [m for m in box.get("hana-reports0123456789", [])]
    opened = mp.evaluate("async ([priv, env]) => (await openOrder(priv, env)).order", [rep_priv, sug[-1]["message"]]) if sug else None
    ok("sharing sends the place, sealed for the volunteers, with nothing about the customer", opened and opened["t"] == "suggest" and opened["place"]["name"] == "Rahim Hotel and Restaurant" and "Secret Customer" not in json.dumps(opened) and "8801999999999" not in json.dumps(opened) and "My House" not in json.dumps(opened), opened)
    ok("after sharing, the place stays on the phone and says it was shared", mp.evaluate("!!JSON.parse(localStorage.getItem('hana.myplaces'))[0].shared_at"))
    data = mp.evaluate("""() => { let out = null; const real = window.downloadText; return JSON.parse(JSON.stringify({ my_places: myPlaces() })); }""")
    ok("the place is included in the customer's own data", len(data["my_places"]) == 1)
    mp.goto(BASE + "#/add/" + pid)
    mp.wait_for_selector("#mp-name")
    mp.click("button:has-text('Delete')")
    mp.click("#dialog-ok")
    mp.wait_for_url("**#/", timeout=5000)
    ok("a place can be deleted, and past orders from it are kept", mp.evaluate("JSON.parse(localStorage.getItem('hana.myplaces')).length") == 0 and mp.evaluate("JSON.parse(localStorage.getItem('hana.orders')).some((o) => o.restaurant === 'Rahim Hotel')"))
    mctx.close()
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
