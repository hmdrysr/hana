#!/usr/bin/env python3
"""Prepare a Hana order from the command line: for people, scripts and AI assistants.
Standard library only. Reads the directory from this repository, or from a published copy
with --site https://hmdrysr.github.io/hana/

It produces exactly the message the app produces (SPEC.md section 6.4), plus links that open
the customer's own messaging app with the message filled in, and an app link that opens
checkout with the basket filled in. It never sends anything by itself, except to a business's
own order address (channel "endpoint") when --send is given.

    python3 tools/place_order.py list [--zone khulshi] [--search pizza]
    python3 tools/place_order.py menu "Sliced"
    python3 tools/place_order.py order "Sliced" --item burger-classic-chicken*2 --zone khulshi \\
        --name "Customer name" --address "House, road, landmark" [--ward ward-14] [--pickup] [--note "..."] [--send]

Rules an assistant must follow are in AGENTS.md: show the customer the items, fee and total,
and get their clear approval before anything is sent; never pay or promise payment in advance.
"""
import argparse
import json
import os
import secrets
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import order_line  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def fetch(site, rel):
    if site:
        with urllib.request.urlopen(urllib.parse.urljoin(site, rel), timeout=20) as r:
            return r.read()
    return (ROOT / rel).read_bytes()


def load(site):
    index = json.loads(fetch(site, "index.json"))
    areas = {a["id"]: a for a in json.loads(fetch(site, "areas.json"))["areas"]}
    out = []
    for row in index.get("restaurants", []):
        for loc in row.get("locations", []):
            try:
                raw = fetch(site, loc)
            except Exception:
                continue
            if order_line.menu_hash(raw) != row["menu_hash"]:
                continue
            out.append({"id": row["id"], "raw": raw, "menu": json.loads(raw)})
            break
    return out, areas


def money(n):
    return "BDT " + f"{n:,}"


def find(listings, name):
    name = name.lower()
    hits = [x for x in listings if x["id"] == name or x["menu"]["name"].lower() == name]
    hits = hits or [x for x in listings if name in x["menu"]["name"].lower()]
    if len(hits) != 1:
        sys.exit(f"'{name}' matches {len(hits)} listings; use the exact name or the listing id.")
    return hits[0]


def zone_for(menu, zone_id, areas):
    """The delivery zone entry that covers zone_id (a zone listed directly, or the whole city)."""
    for z in (menu.get("delivery") or {}).get("zones", []):
        covered = set(z.get("areas") or [])
        if z.get("id") == zone_id or zone_id in covered:
            return z
        for a in covered:
            if areas.get(a, {}).get("kind") == "city" and zone_id in areas and a in areas[zone_id].get("part_of", []):
                return z
    return None


def cmd_list(args):
    listings, areas = load(args.site)
    for x in sorted(listings, key=lambda x: x["menu"]["name"].lower()):
        m = x["menu"]
        if args.zone and not zone_for(m, args.zone, areas):
            continue
        if args.search and args.search.lower() not in json.dumps(m).lower():
            continue
        print(f"{m['name']}  ({m.get('kind', 'Restaurant')})  id={x['id']}  claimed={m.get('claimed') is not False}")


def cmd_menu(args):
    listings, _ = load(args.site)
    m = find(listings, args.listing)["menu"]
    print(m["name"], "-", m.get("kind", "Restaurant"))
    for key, price in sorted(order_line.price_table(m).items()):
        print(f"  {key:40} {'price on request' if price is None else money(price)}")


def cmd_order(args):
    listings, areas = load(args.site)
    x = find(listings, args.listing)
    m = x["menu"]
    lines = {}
    for part in args.item:
        key, _, qty = part.partition("*")
        lines[key] = lines.get(key, 0) + int(qty or 1)
    if args.pickup:
        zone_id, fee = order_line.PICKUP, 0
    else:
        if not args.zone:
            sys.exit("A delivery order needs --zone (a zone id from areas.json), or use --pickup.")
        z = zone_for(m, args.zone, areas)
        if not z:
            sys.exit(f"{m['name']} does not list delivery to {args.zone}.")
        zone_id, fee = z["id"], z.get("fee")
    check = order_line.build(x["raw"], m, lines, zone_id)
    prices = order_line.price_table(m)
    labels = {}
    for it in m.get("items", []):
        for op in it.get("options") or []:
            labels[f"{it['id']}.{op['id']}"] = f"{it['name']} ({op['label']})"
        labels.setdefault(it["id"], it["name"])
    sub = sum((prices[k] or 0) * q for k, q in lines.items())
    unpriced = any(prices[k] is None for k in lines)
    code = order_line.b32(secrets.token_bytes(4))[:6]
    formal = m.get("claimed") is True
    zone_name = "" if args.pickup else areas[args.zone]["name"] + (" (" + areas[args.ward]["name"] + ")" if args.ward in areas else "")
    priced = [k for k in lines if prices[k] is not None]
    ask = []
    if unpriced:
        ask.append("the prices of the items without a listed price" if priced else "the item prices")
    elif not formal:
        ask.append("the item prices")
    if not args.pickup and (fee is None or not formal):
        ask.append("the delivery charge to " + zone_name)
    msg = [f"Hello, I'd like to order from {m['name']}.", "", "Order:"]
    msg += [f"{q} × {labels[k]}" if prices[k] is None else f"{q} × {labels[k]}: {money(prices[k] * q)}" for k, q in sorted(lines.items())]
    msg.append("")
    if sub and priced:
        msg.append(("Subtotal of listed prices: " if unpriced else "Subtotal: ") + money(sub))
    if not args.pickup and fee is not None:
        msg.append(f"Delivery charge to {zone_name}: {money(fee)}")
    if not unpriced and fee is not None:
        msg.append("Total: " + money(sub + fee))
    if ask:
        ask.append("the total amount")
        msg.append("")
        msg.append("Could you please confirm " + ", ".join(ask[:-1]) + " and " + ask[-1] + "?")
    msg += ["", "Name: " + args.name]
    msg.append("Pickup: I'll collect the order myself." if args.pickup else f"Delivery address: {args.address}, {zone_name}")
    if args.note:
        msg.append("Note: " + args.note)
    msg += ["", "I'll pay at pickup. No advance payment, please." if args.pickup else "I'll pay by cash on delivery. No advance payment, please.", ""]
    if formal:
        msg.append("To confirm, please reply: CONFIRMED " + code)
    msg.append("Thank you!")
    if formal:
        msg += ["", f"Order reference {code} (Hana): {check}"]
    if m.get("demo") is True:
        msg = ["DEMO LISTING, NOT A REAL PLACE: nothing is sent. Try it in the app instead; it is confirmed and \"delivered\" in about a minute.", ""] + msg
    text = "\n".join(msg)
    print(text)
    print("\n--- How to send it (the customer's own account) ---")
    for c in m.get("contact", []):
        cid, app = str(c.get("id")), c.get("app")
        q = urllib.parse.quote(text)
        if app == "phone":
            app = "sms"
        link = {"whatsapp": f"https://wa.me/{cid}?text={q}", "sms": f"sms:+{cid}?body={q}",
                "email": f"mailto:{cid}?subject={urllib.parse.quote('Hana order ' + code)}&body={q}",
                "xmpp": f"xmpp:{cid}?message;body={q}", "endpoint": f"POST {cid} (text/plain)"}.get(app, f"{app}: {cid} (paste the message)")
        print(f"{app}{' (preferred)' if c.get('preferred') else ''}: {link}")
    site = args.site or "https://hmdrysr.github.io/hana/"
    items = ",".join(f"{k}*{q}" for k, q in sorted(lines.items()))
    print("App link (opens checkout with this basket):",
          f"{site}#/order?r={x['id']}&items={items}&mode={'pickup' if args.pickup else 'delivery'}" + ("" if args.pickup else f"&zone={args.zone}"))
    print(f"\nThe business must confirm within 15 minutes with: CONFIRMED {code}. Otherwise the order is cancelled.")
    if args.send:
        ep = next((c for c in m.get("contact", []) if c.get("app") == "endpoint"), None)
        if not ep:
            sys.exit("This business has no direct order address; send the message with one of the links above.")
        req = urllib.request.Request(ep["id"], data=text.encode("utf-8"), method="POST", headers={"Content-Type": "text/plain;charset=utf-8"})
        with urllib.request.urlopen(req, timeout=20) as r:
            print("Sent directly; the business's server answered", r.status)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--site", default=os.environ.get("HANA_SITE"), help="published copy to read instead of this repository")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("list"); a.add_argument("--zone"); a.add_argument("--search"); a.set_defaults(fn=cmd_list)
    a = sub.add_parser("menu"); a.add_argument("listing"); a.set_defaults(fn=cmd_menu)
    a = sub.add_parser("order"); a.add_argument("listing"); a.add_argument("--item", action="append", required=True, help="item key*quantity")
    a.add_argument("--zone"); a.add_argument("--ward"); a.add_argument("--pickup", action="store_true")
    a.add_argument("--name", required=True); a.add_argument("--address", default=""); a.add_argument("--note")
    a.add_argument("--send", action="store_true", help="send to the business's own order address, if it has one")
    a.set_defaults(fn=cmd_order)
    args = p.parse_args()
    if args.cmd == "order" and not args.pickup and not args.address:
        sys.exit("A delivery order needs --address.")
    args.fn(args)


if __name__ == "__main__":
    main()
