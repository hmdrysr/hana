#!/usr/bin/env python3
"""Self-test for tools/check.py, tools/order_line.py and tools/verify_images.py.
Standard library only. Copies the real Tava Restaurant listing into a temporary
folder, confirms it passes, then breaks it one way at a time and confirms the
check catches each break.

    python3 tools/selftest.py
"""
import copy
import re
import hashlib
import http.server
import json
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import order_line  # noqa: E402
import verify_images  # noqa: E402

CHECK = HERE / "check.py"
TAVA = "6c6cfbab5f1ad5a85d0ec7e83545bdb47077cea462f1868bcef6cc3d547d21d7"
STAMP2 = "2026-10-20T10:00:00+06:00"


def dump(obj):
    return (json.dumps(obj, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def sha(b):
    return hashlib.sha256(b).hexdigest()


class Repo:
    """A temporary copy of the real repo data with the Tava listing only."""

    def __init__(self, tmp):
        self.root = Path(tmp)
        self.dir = self.root / "menus" / TAVA
        (self.root / "menus").mkdir()
        shutil.copytree(ROOT / "menus" / TAVA, self.dir)
        for f in ("areas.json", "peers.json", "vouchers.json", "rules.json"):
            shutil.copy(ROOT / f, self.root / f)
        self.versions = {1: json.loads((self.dir / "versions" / "1.json").read_bytes())}
        self.raw = {1: (self.dir / "versions" / "1.json").read_bytes()}
        self.index = None
        self.write_index()

    @property
    def latest(self):
        return max(self.versions)

    def write_index(self, edit=None):
        n = self.latest
        idx = {"version": 1, "city": "Chittagong", "updated": "2026-10-20", "restaurants": [{
            "id": self.versions[n]["id"], "name": self.versions[n]["name"],
            "neighbourhood": self.versions[n]["neighbourhood"], "claimed": self.versions[n].get("claimed", False),
            "version": n, "menu_hash": sha(self.raw[n]),
            "locations": [f"menus/{TAVA}/menu.json"]}]}
        if edit:
            edit(idx)
        (self.root / "index.json").write_text(json.dumps(idx))

    def save(self, n, menu, link_previous=True):
        """Write version n (and make menu.json match the latest)."""
        if n > 1 and link_previous:
            menu["previous"] = sha(self.raw[n - 1])
        raw = dump(menu)
        self.versions[n], self.raw[n] = menu, raw
        (self.dir / "versions" / f"{n}.json").write_bytes(raw)
        (self.dir / "menu.json").write_bytes(self.raw[self.latest])
        self.write_index()

    def new_version(self, change, announce="auto", summary="Prices updated by the restaurant."):
        """Make version N+1 from the latest. `change(menu)` edits the copy."""
        prev = self.versions[self.latest]
        cur = copy.deepcopy(prev)
        n = self.latest + 1
        cur["version"] = n
        change(cur)
        import check  # the real diff code, so the test uses the same rules the tool does
        real = check.diff_money(check.money_map(prev), check.money_map(cur))
        changes = [{**c, "label": c["key"]} for c in real]
        if announce == "none":
            changes = []
        elif announce == "wrong":
            changes = [{"key": "item:dahi-bara", "label": "Dahi Bara", "old": 1, "new": 2}]
        cur["announcement"] = {"published": STAMP2, "summary": summary, "changes": changes}
        hist = list(prev.get("price_history") or [])
        if changes:
            hist.append({"version": n, "published": STAMP2, "summary": summary, "changes": changes})
        cur["price_history"] = hist
        self.save(n, cur)
        return cur


def run_check(repo, extra=None):
    for name, text in (extra or {}).items():
        (repo.root / name).write_text(text)
    r = subprocess.run([sys.executable, str(CHECK), "--root", str(repo.root)], capture_output=True, text=True)
    return r.returncode, r.stdout


def set_price(menu, item_id, price):
    for it in menu["items"]:
        if it["id"] == item_id:
            it["price"] = price
            return
    raise KeyError(item_id)


FAILED = 0
TOTAL = 0


def check_case(name, expect_fail, needle, setup, extra=None):
    global FAILED, TOTAL
    TOTAL += 1
    with tempfile.TemporaryDirectory() as d:
        repo = Repo(d)
        setup(repo)
        code, out = run_check(repo, extra)
    ok = (code != 0) == expect_fail and (needle is None or needle in out)
    print(("PASS  " if ok else "FAIL  ") + name)
    if not ok:
        FAILED += 1
        print("      exit code", code, "| expected failure:", expect_fail, "| looking for:", needle)
        print("      " + out.strip().replace("\n", "\n      "))


def check_true(name, cond, detail=""):
    global FAILED, TOTAL
    TOTAL += 1
    print(("PASS  " if cond else "FAIL  ") + name)
    if not cond:
        FAILED += 1
        if detail:
            print("      " + detail)


def edit_v1(fn):
    """Edit version 1 in place (menu.json follows)."""
    def go(repo):
        m = copy.deepcopy(repo.versions[1])
        fn(m)
        repo.save(1, m)
    return go


# ------------------------------------------------------------ check.py cases
check_case("real Tava listing passes", False, "0 error(s)", lambda r: None)

# price changes
check_case("price change with a correct announcement passes", False, "0 error(s)",
           lambda r: r.new_version(lambda m: set_price(m, "dahi-bara", 240)))
check_case("price change with no announcement", True, "NOT announced",
           lambda r: r.new_version(lambda m: set_price(m, "dahi-bara", 240), announce="none"))
check_case("announcement lists a change that did not happen", True, "did not happen",
           lambda r: r.new_version(lambda m: set_price(m, "dahi-bara", 240), announce="wrong"))


def edited_history(r):
    r.new_version(lambda m: set_price(m, "dahi-bara", 240))
    m = copy.deepcopy(r.versions[2])
    m["price_history"][0]["summary"] = "Nothing changed."
    r.save(2, m)


check_case("price history edited after the fact", True, "price_history", edited_history)


def broken_chain(r):
    r.new_version(lambda m: None)
    m = copy.deepcopy(r.versions[2])
    m["previous"] = "0" * 64
    r.save(2, m, link_previous=False)


check_case("version chain broken", True, "previous", broken_chain)


def menu_differs_from_latest(r):
    r.new_version(lambda m: None)
    (r.dir / "menu.json").write_bytes(r.raw[1])


check_case("menu.json is not the latest version", True, "byte-for-byte", menu_differs_from_latest)


def gap(r):
    r.new_version(lambda m: None)
    r.new_version(lambda m: None)
    (r.dir / "versions" / "2.json").unlink()


check_case("missing version file", True, "no gaps", gap)
check_case("non-integer price", True, "whole",
           edit_v1(lambda m: set_price(m, "dahi-bara", 220.5)))
check_case("negative price", True, None, edit_v1(lambda m: set_price(m, "dahi-bara", -5)))
check_case("duplicate item id", True, "duplicate",
           edit_v1(lambda m: m["items"].append(copy.deepcopy(m["items"][0]))))
check_case("zone fee changed without announcement", True, "NOT announced",
           lambda r: r.new_version(lambda m: m["delivery"]["zones"][0].update(fee=50), announce="none"))
check_case("zone fee change announced passes", False, "0 error(s)",
           lambda r: r.new_version(lambda m: m["delivery"]["zones"][0].update(fee=50)))

# identity and claim rules
check_case("wrong temporary id", True, None, edit_v1(lambda m: m.update(id="f" * 64)))
check_case("claimed listing without a signature", True, "signature",
           edit_v1(lambda m: m.update(claimed=True)))
check_case("unclaimed listing carrying a signature", True, "signature",
           edit_v1(lambda m: m.update(signature="abc")))
check_case("unclaimed listing without a note", True, "listing_note",
           edit_v1(lambda m: m.pop("listing_note")))

# location, hours, photos
check_case("relative index location outside the repo", True, "location",
           lambda r: r.write_index(lambda i: i["restaurants"][0].update(locations=["../x.json"])))
check_case("http index location", True, "https",
           lambda r: r.write_index(lambda i: i["restaurants"][0].update(locations=["http://example.org/m.json"])))
check_case("wrong menu hash in index", True, "does not match",
           lambda r: r.write_index(lambda i: i["restaurants"][0].update(menu_hash="b" * 64)))
check_case("plus_code does not match location", True, "plus_code",
           edit_v1(lambda m: m["location"].update(lat=22.40)))
check_case("swapped coordinates", True, "outside Bangladesh",
           edit_v1(lambda m: m.update(location={"lat": 91.81, "lon": 22.36})))
check_case("midnight-crossing hours are accepted", False, "0 error(s)",
           edit_v1(lambda m: m.update(hours={d: [["19:00", "04:00"]] for d in
                                            ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]})))
check_case("hours with equal start and end", True, "start and end are the same",
           edit_v1(lambda m: m.update(hours={d: [["19:00", "19:00"]] for d in
                                            ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]})))
GOOD_PHOTO = {"alt": "Plate of dahi bara", "sources": ["https://i.ibb.co/x/dahi.jpg"],
              "sha256": "a" * 64, "width": 800, "height": 600, "bytes": 90000}
check_case("good photo entry passes", False, "0 error(s)",
           edit_v1(lambda m: m.update(photos=[GOOD_PHOTO])))
check_case("photo without alt text", True, "alt",
           edit_v1(lambda m: m.update(photos=[{k: v for k, v in GOOD_PHOTO.items() if k != "alt"}])))
check_case("photo over the size limit", True, "bytes",
           edit_v1(lambda m: m.update(photos=[{**GOOD_PHOTO, "bytes": 900000}])))
check_case("photo from an http address", True, "https",
           edit_v1(lambda m: m.update(photos=[{**GOOD_PHOTO, "sources": ["http://i.ibb.co/x.jpg"]}])))
check_case("photo hash that is not a hash", True, "sha256",
           edit_v1(lambda m: m.update(photos=[{**GOOD_PHOTO, "sha256": "zzz"}])))

# commitments
for key in ("commission", "sponsored", "featured", "service_fee", "surge"):
    check_case(f"forbidden field '{key}'", True, "founding commitments",
               edit_v1(lambda m, k=key: m.update({k: 1})))
check_case("HTML in a menu name", True, "no HTML",
           edit_v1(lambda m: m.update(name="<b>Tava</b>")))
check_case("forbidden city spelling in a doc", True, "never uses", lambda r: None,
           extra={"NOTES.md": "The city of Chatto" + "gram is large."})
check_case("customer-looking mobile number in a doc warns", False, "looks like a mobile number",
           lambda r: None, extra={"NOTES.md": "Call 01712345678 about the order."})


# areas: levels and kinds
def edit_areas(fn):
    def go(repo):
        a = json.loads((repo.root / "areas.json").read_text())
        fn(a)
        (repo.root / "areas.json").write_text(json.dumps(a))
    return go


def area(a, aid):
    return next(x for x in a["areas"] if x["id"] == aid)


check_case("ward placed directly in the city", True, "must be part of a zone",
           edit_areas(lambda a: area(a, "ward-14").update(part_of=["ccc"])))
check_case("area without a kind", True, "kind must be",
           edit_areas(lambda a: area(a, "ward-14").pop("kind")))
check_case("ward without a number", True, "needs its number",
           edit_areas(lambda a: area(a, "ward-14").pop("number")))
check_case("zone without part_of", True, "part_of is required",
           edit_areas(lambda a: area(a, "khulshi").pop("part_of")))
check_case("two city areas", True, "exactly one area of kind city",
           edit_areas(lambda a: area(a, "epz").update(kind="city", part_of=[])))

# interface uniformity
check_case("unknown class in the app", True, "not in the allowed list", lambda r: None,
           extra={"app.js": 'h("div", { class: "fancy-box" });'})
check_case("Beer CSS margin helper in the app", True, "margin helpers", lambda r: None,
           extra={"app.js": 'h("p", { class: "top-margin" });'})
check_case("inline style in the page", True, "inline styles", lambda r: None,
           extra={"index.html": '<p style="color:red">x</p>'})
check_case("allowed classes pass", False, "0 error(s)", lambda r: None,
           extra={"app.js": 'h("p", { class: "muted " + (x === "warn" ? "tertiary-container" : "flush") });'})

# ------------------------------------------------------------ order_line cases
menu_path = ROOT / "menus" / TAVA / "menu.json"
mbytes = menu_path.read_bytes()
menu = json.loads(mbytes)
known = [(mbytes, menu)]
line = order_line.build(mbytes, menu, {"dahi-bara": 2}, "khulshi")
res = order_line.decode(line, known)
check_true("order line round trip is ok", res["ok"] and res["subtotal_from_menu"] == 440, str(res))
check_true("order line shows an unstated fee as '?'", " F=? " in line, line)

tampered = line.replace("dahi-bara*2", "dahi-bara*1")
r2 = order_line.decode(tampered, known)
check_true("changed quantity is flagged", not r2["ok"], str(r2))

cheap = line.replace("S=440", "S=100")
r3 = order_line.decode(cheap, known)
check_true("lowered subtotal is flagged and re-priced from the menu",
           (not r3["ok"]) and r3["subtotal_from_menu"] == 440, str(r3))

fixed = cheap.rsplit(" C=", 1)[0] + " C=" + order_line.make_code(sha(mbytes), "khulshi", "dahi-bara*2", "100", "?")
r4 = order_line.decode(fixed, known)
check_true("recomputed code with a fake total is still flagged", (not r4["ok"]) and r4["subtotal_from_menu"] == 440, str(r4))


def raises(fn):
    try:
        fn()
    except order_line.OrderError:
        return True
    return False


check_true("unknown item is rejected", raises(lambda: order_line.build(mbytes, menu, {"nope": 1}, "khulshi")))
check_true("unknown zone is rejected", raises(lambda: order_line.build(mbytes, menu, {"dahi-bara": 1}, "mars")))
check_true("zero quantity is rejected", raises(lambda: order_line.build(mbytes, menu, {"dahi-bara": 0}, "khulshi")))
check_true("empty order is rejected", raises(lambda: order_line.build(mbytes, menu, {}, "khulshi")))
check_true("garbage line is rejected", raises(lambda: order_line.decode("hello", known)))
check_true("unknown menu version is rejected",
           raises(lambda: order_line.decode(line.replace("H=" + sha(mbytes)[:12], "H=" + "0" * 12), known)))

# option items (use Meal Master, which has options)
MM = "bee9f4b3ba09a8f47ca77d741df138917ea6c584407e9b8a7418313d42340d9b"
mmb = (ROOT / "menus" / MM / "menu.json").read_bytes()
mm = json.loads(mmb)
oline = order_line.build(mmb, mm, {"strips.4-pieces": 1, "french-fries": 2}, "ccc")
ores = order_line.decode(oline, [(mmb, mm)])
check_true("option item prices from the menu", ores["ok"] and ores["subtotal_from_menu"] == 220 + 240, str(ores))

# older version flagged
with tempfile.TemporaryDirectory() as d:
    repo = Repo(d)
    old_bytes, old_menu = repo.raw[1], repo.versions[1]
    repo.new_version(lambda m: set_price(m, "dahi-bara", 240))
    oldline = order_line.build(old_bytes, old_menu, {"dahi-bara": 1}, "khulshi")
    rr = order_line.decode(oldline, [(repo.raw[1], repo.versions[1]), (repo.raw[2], repo.versions[2])])
    check_true("order on an older menu version is flagged", (not rr["ok"]) and any("current version" in f for f in rr["flags"]), str(rr))


# ------------------------------------------------------------ claimed listings, rules and confirmations
import hana_sign  # noqa: E402
import ed25519 as ed  # noqa: E402

SECRET = bytes(range(1, 33))


def make_claim(r, change=None, sign=True, vouchers=("voucher-a", "voucher-b"), claim_file=True, signer=SECRET):
    """Turn the Tava listing into a claimed listing signed with SECRET (version 1, replaces Tava)."""
    old = r.versions[1]
    pub = ed.public_key(SECRET)
    m = copy.deepcopy(old)
    m.update(claimed=True, id=hana_sign.listing_id(pub), pickup=True, payment_on_delivery=["cash", "bangla_qr"],
             hours={d: [["11:00", "23:00"]] for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]},
             owner={"account": "https://github.com/example", "menu_source": "https://github.com/example/menu",
                    "public_key": ed.b64u(pub)},
             replaces=old["id"], replaces_hash=sha(r.raw[1]))
    m.pop("listing_note", None)
    m["pledges"] = {k: {"signed": True, "date": "2026-10-15"} for k in ("rider_identity", "data_handling", "fair_pricing", "records")}
    m["delivery"] = {"zones": [{"id": "khulshi", "shape": "named", "areas": ["khulshi"], "fee": 40, "min_order": 300, "eta_min": 45},
                                {"id": "ccc", "shape": "named", "areas": ["ccc"], "fee": 90, "min_order": 300, "eta_min": 45}]}
    import check
    changes = [{**c, "label": c["key"]} for c in check.diff_money(check.money_map(old), check.money_map(m))]
    m["announcement"] = {"published": STAMP2, "summary": "Claimed.", "changes": changes}
    m["price_history"] = [{"version": 1, "published": STAMP2, "summary": "Claimed.", "changes": changes}]
    if change:
        change(m)
    if sign:
        m = hana_sign.sign_menu(m, signer)
    raw = dump(m)
    d = r.root / "menus" / m["id"]
    (d / "versions").mkdir(parents=True)
    (d / "versions" / "1.json").write_bytes(raw)
    (d / "menu.json").write_bytes(raw)
    (r.root / "vouchers.json").write_text(json.dumps({"version": 1, "vouchers": [{"key": "voucher-a"}, {"key": "voucher-b"}]}))
    if claim_file:
        (r.root / "claims").mkdir(exist_ok=True)
        (r.root / "claims" / (m["id"] + ".json")).write_text(json.dumps({
            "id": m["id"], "account": m["owner"]["account"], "menu_source": m["owner"]["menu_source"],
            "claimed_on": "2026-10-15", "evidence": ["Phone check with claim code", "Visit to the address"],
            "vouchers": list(vouchers), "reviews": [{"date": "2026-10-15", "voucher": "voucher-a", "result": "confirmed"}]}))
    idx = {"version": 1, "city": "Chittagong", "updated": "2026-10-20", "restaurants": [{
        "id": m["id"], "name": m["name"], "neighbourhood": m["neighbourhood"], "claimed": True, "version": 1,
        "menu_hash": sha(raw), "reviewed": "2026-10-15", "replaces": old["id"], "locations": [f"menus/{m['id']}/menu.json"]}]}
    (r.root / "index.json").write_text(json.dumps(idx))
    return m


check_case("claimed, signed listing with a claim record passes", False, "0 error(s)", lambda r: make_claim(r))


def tampered(r):
    m = make_claim(r)
    m["items"][0]["price"] = 1
    raw = dump(m)
    d = r.root / "menus" / m["id"]
    (d / "versions" / "1.json").write_bytes(raw)
    (d / "menu.json").write_bytes(raw)
    idx = json.loads((r.root / "index.json").read_text())
    idx["restaurants"][0]["menu_hash"] = sha(raw)
    (r.root / "index.json").write_text(json.dumps(idx))


CASES_EXTRA = [
    ("claimed listing edited after signing", True, "signature does not match", tampered),
    ("claimed listing signed with another key", True, "signature does not match",
     lambda r: make_claim(r, signer=bytes(32))),
    ("claimed listing without a claim record", True, "does not exist", lambda r: make_claim(r, claim_file=False)),
    ("claim checked by only one voucher", True, "at least two different", lambda r: make_claim(r, vouchers=("voucher-a",))),
    ("claim announces no price changes", True, "announce every price", lambda r: make_claim(r, change=lambda m: m.update(announcement={**m["announcement"], "changes": []}, price_history=[]))),
    ("claimed listing that does not say about pickup", True, "pickup", lambda r: make_claim(r, change=lambda m: m.update(pickup=None))),
    ("delivery fee above the limit", True, "above the limit", lambda r: make_claim(r, change=lambda m: m["delivery"]["zones"][1].update(fee=500))),
    ("ward used as a delivery area", True, "is a ward", lambda r: make_claim(r, change=lambda m: m["delivery"]["zones"][0].update(areas=["ward-14"]))),
    ("prepayment field", True, "founding commitments", lambda r: make_claim(r, change=lambda m: m.update(advance_payment=100))),
    ("payment method that is not at delivery", True, "payment_on_delivery", lambda r: make_claim(r, change=lambda m: m.update(payment_on_delivery=["bank_transfer_in_advance"]))),
]
for name, fail, needle, fn in CASES_EXTRA:
    check_case(name, fail, needle, fn)


def rules_edit(fn):
    def go(r):
        rules = json.loads((ROOT / "rules.json").read_text())
        fn(rules)
        (r.root / "rules.json").write_text(json.dumps(rules))
    return go


check_case("rules allowing prepayment", True, "prepayment_allowed", rules_edit(lambda x: x.update(prepayment_allowed=True)))
check_case("rules without tax-inclusive prices", True, "prices_include_all_charges", rules_edit(lambda x: x.update(prices_include_all_charges=False)))

# confirmations
cl = order_line.build(mbytes, menu, {"dahi-bara": 1}, "pickup")
check_true("pickup order has no delivery fee", " Z=pickup " in cl and " F=0 " in cl, cl)
pubb = ed.b64u(ed.public_key(SECRET))
conf = order_line.make_confirmation(cl, "ABC123", "30", SECRET)
check_true("signed confirmation is accepted", order_line.check_confirmation(conf, cl, "ABC123", pubb) == "signed")
check_true("unsigned confirmation is recognised", order_line.check_confirmation(order_line.make_confirmation(cl, "ABC123"), cl, "ABC123") == "unsigned")
check_true("confirmation with a changed delivery time is rejected", raises(lambda: order_line.check_confirmation(conf.replace("E=30", "E=10"), cl, "ABC123", pubb)))
nowm = order_line.now_minutes()
check_true("confirmation with a changed timestamp is rejected", raises(lambda: order_line.check_confirmation(re.sub(r"T=\d+", "T=" + str(nowm - 1), conf), cl, "ABC123", pubb)))
check_true("confirmation inside the 15-minute window is accepted",
           order_line.check_confirmation(order_line.make_confirmation(cl, "ABC123", "30", SECRET, minute=nowm + 10), cl, "ABC123", pubb, ordered_minute=nowm) == "signed")
check_true("confirmation after the 15-minute window is rejected",
           raises(lambda: order_line.check_confirmation(order_line.make_confirmation(cl, "ABC123", "30", SECRET, minute=nowm + 40), cl, "ABC123", pubb, ordered_minute=nowm)))
check_true("confirmation for another order is rejected", raises(lambda: order_line.check_confirmation(conf, cl, "ZZZ999", pubb)))
check_true("confirmation signed by another key is rejected",
           raises(lambda: order_line.check_confirmation(order_line.make_confirmation(cl, "ABC123", "30", bytes(32)), cl, "ABC123", pubb)))

# ------------------------------------------------------------ verify_images cases
payload = b"\xff\xd8\xff\xe0test-image-bytes"


class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/ok.jpg":
            self.send_response(200); self.send_header("Content-Type", "image/jpeg"); self.end_headers(); self.wfile.write(payload)
        elif self.path == "/page":
            self.send_response(200); self.send_header("Content-Type", "text/html"); self.end_headers(); self.wfile.write(b"<html>")
        else:
            self.send_response(404); self.end_headers()

    def log_message(self, *a):
        pass


srv = http.server.HTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}"
good = sha(payload)
ok, msg = verify_images.verify(base + "/ok.jpg", good, len(payload), allow_local_http=True)
check_true("image that matches passes", ok, msg)
ok, msg = verify_images.verify(base + "/ok.jpg", "0" * 64, len(payload), allow_local_http=True)
check_true("image with a different hash fails", (not ok) and "hash" in msg, msg)
ok, msg = verify_images.verify(base + "/ok.jpg", good, 5, allow_local_http=True)
check_true("image with a different size fails", (not ok) and "size" in msg, msg)
ok, msg = verify_images.verify(base + "/page", good, None, allow_local_http=True)
check_true("web page instead of an image fails", (not ok) and "not an image" in msg, msg)
ok, msg = verify_images.verify(base + "/missing.jpg", good, None, allow_local_http=True)
check_true("missing image fails", not ok, msg)
ok, msg = verify_images.verify(base + "/ok.jpg", good, None)
check_true("plain http is refused", (not ok) and "https" in msg, msg)
ok, msg = verify_images.verify(base + "/ok.jpg", good, len(payload), max_bytes=5, allow_local_http=True)
check_true("image over the size limit fails", (not ok) and "larger" in msg, msg)
srv.shutdown()


# ------------------------------------------------------------ unpack, autofill and workflow cases
import io  # noqa: E402
import zipfile  # noqa: E402
import unpack  # noqa: E402
import autofill  # noqa: E402
import make_workflow  # noqa: E402


def make_zip(path, entries, symlink=None):
    with zipfile.ZipFile(path, "w") as z:
        for name, data in entries.items():
            z.writestr(name, data)
        if symlink:
            zi = zipfile.ZipInfo(symlink)
            zi.external_attr = (0o120777 << 16)
            z.writestr(zi, "/etc/passwd")


def unpack_raises(entries, **kw):
    with tempfile.TemporaryDirectory() as d:
        zp = Path(d) / "a.zip"
        make_zip(zp, entries, **kw)
        (Path(d) / "repo").mkdir()
        try:
            unpack.unpack(zp, Path(d) / "repo")
        except ValueError:
            return True
        return False


with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    (d / "repo").mkdir()
    (d / "repo" / "README.md").write_text("old")
    make_zip(d / "a.zip", {"hana/README.md": "new", "hana/app.js": "x", "hana/.github/workflows/unzip.yml": "evil",
                           "hana/menus/a/menu.json": "{}", "hana/__pycache__/x.pyc": "j", "hana/other.zip": "z"})
    ad, ch, un, sk = unpack.unpack(d / "a.zip", d / "repo")
    check_true("unpack removes the single top folder", (d / "repo" / "app.js").exists() and not (d / "repo" / "hana").exists())
    check_true("unpack reports added and changed files", sorted(ad) == ["app.js", "menus/a/menu.json"] and ch == ["README.md"], str((ad, ch)))
    check_true("unpack skips workflows, junk and top-level zips", len(sk) == 3 and not (d / "repo" / ".github").exists(), str(sk))
    ad, ch, un, sk = unpack.unpack(d / "a.zip", d / "repo")
    check_true("unpack twice changes nothing", not ad and not ch and len(un) == 3, str((ad, ch, un)))

check_true("unpack refuses '..' names", unpack_raises({"../evil.txt": "x"}))
check_true("unpack refuses absolute names", unpack_raises({"/etc/evil.txt": "x"}))
check_true("unpack refuses backslash names", unpack_raises({"a\\b.txt": "x"}))
check_true("unpack refuses links", unpack_raises({"a.txt": "x"}, symlink="link"))
check_true("unpack refuses a .git folder", unpack_raises({".git/config": "x", "a.txt": "y"}))

with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    (d / "README.md").write_text("Site {{SITE_URL}} repo {{REPO_URL}} {{OWNER}}/{{REPO}}")
    (d / "site.json").write_text('{"repo_url": "{{REPO_URL}}"}')
    ch = autofill.run(d, "Iffy-Org/hana")
    txt = (d / "README.md").read_text()
    check_true("autofill fills every placeholder", "{{" not in txt and "https://github.com/Iffy-Org/hana" in txt
               and "https://iffy-org.github.io/hana/" in txt and sorted(ch) == ["README.md", "site.json"], txt)
    check_true("autofill twice does nothing", autofill.run(d, "Iffy-Org/hana") == [])
    try:
        autofill.values("not a repo")
        bad = False
    except ValueError:
        bad = True
    check_true("autofill refuses a bad repo name", bad)
    check_true("autofill handles the user-site repo name",
               autofill.values("me/me.github.io")["{{SITE_URL}}"] == "https://me.github.io/")

wf_path = ROOT / ".github" / "workflows" / "unzip.yml"
# The workflow is pasted in by hand, so a repo may carry its own edited copy. A difference
# is reported, not counted as a failure; the unpack rules themselves are tested above.
if not wf_path.exists():
    print("NOTE  .github/workflows/unzip.yml is not installed here, so it was not compared")
elif wf_path.read_text(encoding="utf-8") != make_workflow.render():
    print("NOTE  .github/workflows/unzip.yml differs from the one tools/make_workflow.py generates. "
          "Check that it still skips .github/workflows/, refuses unsafe paths and deletes nothing.")
else:
    check_true("unzip workflow matches tools/make_workflow.py", True)

print()
print(f"{TOTAL - FAILED} of {TOTAL} self-test cases behaved as expected.")
sys.exit(1 if FAILED else 0)
