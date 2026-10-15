#!/usr/bin/env python3
"""Reference implementation of the Hana order check line (SPEC.md section 6.4).
Standard library only. The app's own code must produce and read exactly this format.

The check line is the last line of the order message the customer sends:

    CHECK hana1 H=<first 12 hex of menu hash> Z=<zone id> I=<items> S=<subtotal> F=<fee or ?> C=<code>

    I = item-id[.option-id]*qty, comma separated, sorted, for example  dahi-bara*2,kulcha*1
    S = items subtotal in whole taka, F = the zone's delivery fee in whole taka (? if not stated)
    C = first 8 characters of the Crockford base32 of SHA-256 over
        hana1|<full menu hash>|<zone id>|<items>|<S>|<F>

What this protects, and what it does not
- The restaurant's tool decodes the line and works out the items and prices again
  from the restaurant's own signed menu. It ignores any total the customer typed.
- The code catches slips and edits made by someone who did not recompute it.
- The code is not secret. Someone who edits the line and recomputes the code gets
  a valid line, but the decoder still prices the items from the signed menu, so the
  price cannot be changed this way. The restaurant must read the decoded view.

Pickup orders use Z=pickup and F=0.

Business confirmation (SPEC.md section 6.5). The business replies in the same chat with:

    CONFIRMED hana1 O=<order code> C=<check code> E=<minutes or ?> T=<time> K=<key id or -> S=<signature or ->

T is the time of the confirmation in whole minutes since 1970-01-01 UTC. It must fall within
the confirmation window (rules.json, confirmation_window_minutes) after the order was
prepared. K is the first 8 hex characters of SHA-256 of the business's public key, and S is
the Ed25519 signature (unpadded base64url) over
    hana1-confirm|<the full check line>|<order code>|<E>|<T>
A listing without an owner key replies with K=- S=-, which the app shows as
"confirmed by message, not signed".

Command line:
    python3 tools/order_line.py decode MENU_VERSIONS_DIR "CHECK hana1 ..."
"""
import hashlib
import json
import re
import sys
from pathlib import Path

CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
LINE = re.compile(
    r"^CHECK hana1 H=(?P<h>[0-9a-f]{12}) Z=(?P<z>[a-z0-9-]+) I=(?P<i>[a-z0-9.*,-]+) "
    r"S=(?P<s>\d+) F=(?P<f>\d+|\?) C=(?P<c>[0-9A-HJKMNP-TV-Z]{8})$")
CONFIRM = re.compile(
    r"CONFIRMED hana1 O=(?P<o>[0-9A-HJKMNP-TV-Z]{6}) C=(?P<c>[0-9A-HJKMNP-TV-Z]{8}) E=(?P<e>\d{1,3}|\?) "
    r"T=(?P<t>\d{8,10}) K=(?P<k>[0-9a-f]{8}|-) S=(?P<s>[A-Za-z0-9_-]{86}|-)")
MAX_QTY = 99
PICKUP = "pickup"


class OrderError(ValueError):
    pass


def b32(data):
    n = int.from_bytes(data, "big")
    bits = len(data) * 8
    out = []
    pad = (-bits) % 5
    n <<= pad
    for shift in range(bits + pad - 5, -1, -5):
        out.append(CROCKFORD[(n >> shift) & 31])
    return "".join(out)


def menu_hash(menu_bytes):
    return hashlib.sha256(menu_bytes).hexdigest()


def price_table(menu):
    """item key (item-id or item-id.option-id) -> whole-taka price, or None when the listing
    does not state it (the business then gives the price when it confirms)"""
    t = {}
    for it in menu["items"]:
        if "price" in it:
            t[it["id"]] = it["price"]
        for op in it.get("options") or []:
            t[f"{it['id']}.{op['id']}"] = op["price"]
    return t


def zone_fee(menu, zone_id):
    if zone_id == PICKUP:
        if menu.get("pickup") is False:
            raise OrderError("this business does not offer pickup")
        return 0
    for z in menu["delivery"]["zones"]:
        if z["id"] == zone_id:
            return z.get("fee")
    raise OrderError(f"unknown zone '{zone_id}'")


def canonical(full_hash, zone_id, items, sub, fee):
    return f"hana1|{full_hash}|{zone_id}|{items}|{sub}|{fee}"


def make_code(full_hash, zone_id, items, sub, fee):
    digest = hashlib.sha256(canonical(full_hash, zone_id, items, sub, fee).encode("utf-8")).digest()
    return b32(digest)[:8]


def build(menu_bytes, menu, lines, zone_id):
    """lines: {item_key: qty}. Returns the check line. Prices come from the menu only."""
    prices = price_table(menu)
    parts = []
    sub = 0
    for key in sorted(lines):
        qty = lines[key]
        if key not in prices:
            raise OrderError(f"'{key}' is not on this menu")
        if not isinstance(qty, int) or isinstance(qty, bool) or not (1 <= qty <= MAX_QTY):
            raise OrderError(f"quantity for '{key}' must be a whole number from 1 to {MAX_QTY}")
        parts.append(f"{key}*{qty}")
        sub += (prices[key] or 0) * qty
    if not parts:
        raise OrderError("an order needs at least one item")
    items = ",".join(parts)
    fee = zone_fee(menu, zone_id)
    fee_text = "?" if fee is None else str(fee)
    h = menu_hash(menu_bytes)
    code = make_code(h, zone_id, items, sub, fee_text)
    return f"CHECK hana1 H={h[:12]} Z={zone_id} I={items} S={sub} F={fee_text} C={code}"


def decode(line, known_menus):
    """known_menus: list of (menu_bytes, menu_dict) for every version the restaurant has published.
    Returns what the restaurant should read: items and prices from the signed menu, plus flags."""
    m = LINE.match(line.strip())
    if not m:
        raise OrderError("not a valid check line")
    found = [(b, d) for b, d in known_menus if menu_hash(b).startswith(m["h"])]
    if not found:
        raise OrderError("this order uses a menu version the restaurant has not published")
    menu_bytes, menu = found[0]
    full = menu_hash(menu_bytes)
    prices = price_table(menu)
    out_lines, flags, sub = [], [], 0
    for part in m["i"].split(","):
        key, _, qty_text = part.partition("*")
        if not qty_text.isdigit() or not (1 <= int(qty_text) <= MAX_QTY):
            raise OrderError(f"bad quantity in '{part}'")
        if key not in prices:
            raise OrderError(f"'{key}' is not on menu version {menu['version']}")
        qty = int(qty_text)
        p = prices[key]
        out_lines.append({"item": key, "qty": qty, "price": p, "line_total": None if p is None else p * qty})
        sub += (p or 0) * qty
        if p is None:
            flags.append(f"'{key}' has no listed price: tell the customer its price and the total")
    fee = zone_fee(menu, m["z"])
    fee_text = "?" if fee is None else str(fee)
    if int(m["s"]) != sub:
        flags.append(f"subtotal in the message is Tk {m['s']} but the signed menu gives Tk {sub}")
    if m["f"] != fee_text:
        flags.append(f"delivery fee in the message is {m['f']} but the signed menu gives {fee_text}")
    expected = make_code(full, m["z"], m["i"], m["s"], m["f"])
    if m["c"] != expected:
        flags.append("the check code does not match: the line was edited or mistyped")
    newest = max(d["version"] for _, d in known_menus)
    if menu["version"] != newest:
        flags.append(f"order uses menu version {menu['version']}; the current version is {newest}. "
                     "Compare prices in the price history before deciding.")
    return {"menu_version": menu["version"], "zone": m["z"], "lines": out_lines,
            "subtotal_from_menu": sub, "delivery_fee": fee_text, "flags": flags,
            "ok": not [f for f in flags if "no listed price" not in f]}


def confirm_message(check_line, order_code, eta, minute):
    return f"hana1-confirm|{check_line.strip()}|{order_code}|{eta}|{minute}".encode("utf-8")


def now_minutes():
    import time
    return int(time.time() // 60)


def key_id(public_raw):
    return hashlib.sha256(public_raw).hexdigest()[:8]


def make_confirmation(check_line, order_code, eta="?", secret=None, minute=None):
    """secret: the 32-byte Ed25519 private key (seed), or None for an unsigned confirmation.
    minute: confirmation time in minutes since 1970 (UTC); now if not given."""
    m = LINE.match(check_line.strip())
    if not m:
        raise OrderError("not a valid check line")
    eta = str(eta)
    minute = now_minutes() if minute is None else int(minute)
    if secret is None:
        k, s = "-", "-"
    else:
        import ed25519
        k = key_id(ed25519.public_key(secret))
        s = ed25519.b64u(ed25519.sign(secret, confirm_message(check_line, order_code, eta, minute)))
    return f"CONFIRMED hana1 O={order_code} C={m['c']} E={eta} T={minute} K={k} S={s}"


def check_confirmation(text, check_line, order_code, public_b64=None, ordered_minute=None, window=15):
    """Returns 'signed' (valid signature), 'unsigned' (K=- S=-, matches the order) or raises OrderError.
    ordered_minute: when the order was prepared (minutes since 1970, UTC); if given, the
    confirmation time must fall within the window."""
    m = CONFIRM.search(text or "")
    if not m:
        raise OrderError("no confirmation line found")
    cl = LINE.match(check_line.strip())
    if not cl or m["c"] != cl["c"] or m["o"] != order_code:
        raise OrderError("this confirmation is for a different order")
    if ordered_minute is not None:
        t = int(m["t"])
        if t < ordered_minute - 2 or t > ordered_minute + window + 2:
            raise OrderError(f"the confirmation is outside the {window}-minute window after the order")
    if m["s"] == "-" and m["k"] == "-":
        return "unsigned"
    if m["s"] == "-" or m["k"] == "-":
        raise OrderError("the confirmation has a key id without a signature, or the reverse")
    import ed25519
    if not public_b64:
        raise OrderError("the confirmation is signed, but the listing has no public key to check it")
    pub = ed25519.unb64u(public_b64)
    if key_id(pub) != m["k"]:
        raise OrderError("the confirmation was signed with a different key from the listing's")
    if not ed25519.verify(pub, confirm_message(check_line, order_code, m["e"], m["t"]), ed25519.unb64u(m["s"])):
        raise OrderError("the signature does not match: the confirmation was altered or forged")
    return "signed"


def _load_versions(folder):
    out = []
    for p in sorted(Path(folder).glob("*.json"), key=lambda p: int(p.stem)):
        b = p.read_bytes()
        out.append((b, json.loads(b.decode("utf-8"))))
    return out


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "decode":
        try:
            res = decode(sys.argv[3], _load_versions(sys.argv[2]))
        except OrderError as e:
            print("INVALID:", e)
            sys.exit(2)
        print(json.dumps(res, indent=2))
        sys.exit(0 if res["ok"] else 1)
    print(__doc__)
    sys.exit(64)
