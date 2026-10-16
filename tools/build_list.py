#!/usr/bin/env python3
"""Writes the two files that keep the app fast as the directory grows:

    list.json    one small summary per listing: what the home page, filters, categories,
                 the phone book and the zone check need. Full menus are not loaded until a
                 customer opens a listing.
    search.json  every item's name, section, category and price, per listing, loaded only
                 when someone searches for a dish or picks a category.

Categories and cuisines use the same rules as the app: FOOD and GROCERY in core.js are read
from that file, so there is one source. Run python3 tools/build.py after any change."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENTRY = re.compile(r'\["([a-z_]+)", "([^"]+)", "([a-z_]+)", /(.+)/i\]')


def prices_confirmed_at(m):
    """Same rule as pricesConfirmedAt() in core.js."""
    if m.get("prices_confirmed_at"):
        return m["prices_confirmed_at"]
    changed = [e for e in (m.get("price_history") or []) if isinstance(e, dict) and e.get("changes") and e.get("published")]
    if changed:
        return changed[-1]["published"]
    if not m.get("price_history") or m.get("version") == 1:
        return (m.get("announcement") or {}).get("published")
    return None


def rules(root):
    src = (root / "core.js").read_text(encoding="utf-8")
    out = {}
    for name in ("FOOD", "GROCERY"):
        block = src[src.index(f"const {name} = ["):]
        block = block[:block.index("\n];")]
        out[name] = [(k, re.compile(p, re.I)) for k, _, _, p in ENTRY.findall(block)]
    return out


GROCERY_KIND = re.compile(r"grocery|supermarket|super ?shop|convenience", re.I)


def build(root=ROOT):
    R = rules(root)
    def cat(text, lst):
        for k, rx in lst:
            if text and rx.search(text):
                return k
        return None
    index = json.loads((root / "index.json").read_text(encoding="utf-8"))
    listings, search = [], {}
    for row in index.get("restaurants", []):
        loc = (row.get("locations") or [""])[0]
        if loc.startswith("http") or not (root / loc).is_file():
            continue
        m = json.loads((root / loc).read_text(encoding="utf-8"))
        grocery = bool(GROCERY_KIND.search(m.get("kind") or ""))
        lst = R["GROCERY"] if grocery else R["FOOD"]
        items = m.get("items") or []
        def item_cat(it, l=lst):
            return cat(it.get("name"), l) or cat(it.get("category"), l) or cat(it.get("section"), l)
        cats = []
        for it in items:
            k = item_cat(it)
            if k and k not in cats:
                cats.append(k)
        if grocery:
            ck = "grocery"
        else:
            ck = cat(m.get("cuisine"), R["FOOD"])
            if not ck:
                score = {}
                for it in items:
                    k = cat(it.get("section"), R["FOOD"]) or item_cat(it, R["FOOD"])
                    if k and k not in ("sides", "drink"):
                        score[k] = score.get(k, 0) + 1
                ck = sorted(score.items(), key=lambda kv: -kv[1])[0][0] if score else None
        if ck and ck != "grocery" and ck not in cats:
            cats.append(ck)
        listings.append({
            "id": row["id"], "name": m["name"], "handle": m.get("handle"), "kind": m.get("kind"),
            "neighbourhood": m.get("neighbourhood"), "claimed": m.get("claimed"), "demo": True if m.get("demo") is True else None, "version": m.get("version"),
            "prices_confirmed": prices_confirmed_at(m),
            "menu_hash": row["menu_hash"], "location": loc, "cuisine": m.get("cuisine"), "cuisine_key": ck, "cats": cats,
            "cover": m.get("cover"), "hours": m.get("hours"), "delivery": m.get("delivery"), "pickup": m.get("pickup"),
            "scheduled_orders": m.get("scheduled_orders"), "direct": m.get("direct") if m.get("claimed") else None, "business_phone": m.get("business_phone"),
            "address": m.get("address"), "contact": m.get("contact") or [], "item_count": len(items),
        })
        rows = []
        for it in items:
            ps = [o.get("price") for o in it.get("options") or [] if o.get("price") is not None]
            rows.append([it.get("name"), it.get("section"), it.get("category"),
                         it.get("price") if not it.get("options") else (min(ps) if ps else None), bool(it.get("options"))])
        search[row["id"]] = rows
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":")) + "\n"
    return dump({"format": "hana-list-1", "listings": listings}), dump({"format": "hana-search-1", "items": search})


def write(root=ROOT):
    lst, srch = build(root)
    (root / "list.json").write_text(lst, encoding="utf-8")
    (root / "search.json").write_text(srch, encoding="utf-8")
    return lst, srch


if __name__ == "__main__":
    a, b = write()
    print(f"list.json {len(a.encode())} bytes, search.json {len(b.encode())} bytes")
