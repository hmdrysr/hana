#!/usr/bin/env python3
"""Writes one page per listing at a clean address built from its handle:

    restaurants/<handle>/index.html   (restaurants, cafés, kitchens and other food businesses)
    groceries/<handle>/index.html     (grocery stores and supermarkets)

so @tong is at https://<site>/restaurants/tong/. Each page is the app itself
(opening straight onto that listing) with the listing's details and menu written into the
page, so it can be read without JavaScript, by search engines and by AI assistants.

Run after any change to a listing or to index.html:  python3 tools/build.py
tools/check.py reports an error when a page is missing or out of date. Standard library only."""
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GROCERY = re.compile(r"grocery|supermarket|super ?shop|convenience", re.I)


def folder(menu):
    return "groceries" if GROCERY.search(menu.get("kind") or "") else "restaurants"


def money(n):
    return "price on request" if n is None else "BDT " + f"{n:,}"


def body(menu, areas):
    zone = areas.get(menu.get("neighbourhood"), {}).get("name", "")
    out = [f"<h1>{escape(menu['name'])}</h1>",
           f"<p>@{escape(menu['handle'])} · {escape(menu.get('kind') or 'Restaurant')}{' · ' + escape(zone) if zone else ''}</p>"]
    if menu.get("claimed") is False:
        out.append("<p>Not yet confirmed by the business. Prices are as printed and may have changed.</p>")
    out.append(f"<p>Phone: {escape(menu.get('business_phone') or '')}<br>Address: {escape(menu.get('address') or '')}</p>")
    out.append("<p>Pay on delivery or at pickup only. Prices include VAT and every other charge.</p>")
    sections = {}
    for it in menu.get("items", []):
        sections.setdefault(it.get("section") or "Menu", []).append(it)
    for sec, items in sections.items():
        out.append(f"<h2>{escape(sec)}</h2><ul>")
        for it in items:
            if it.get("options"):
                price = "; ".join(f"{escape(o['label'])}: {money(o['price'])}" for o in it["options"])
            else:
                price = money(it["price"])
            out.append(f"<li>{escape(it['name'])}: {price}</li>")
        out.append("</ul>")
    out.append('<p><a href="./">Open the full directory</a></p>')
    return "\n".join(out)


def build(root=ROOT):
    template = (root / "index.html").read_text(encoding="utf-8")
    areas = {a["id"]: a for a in json.loads((root / "areas.json").read_text(encoding="utf-8")).get("areas", [])}
    index = json.loads((root / "index.json").read_text(encoding="utf-8"))
    pages = {}
    for row in index.get("restaurants", []):
        loc = (row.get("locations") or [""])[0]
        if not row.get("handle") or loc.startswith("http") or not (root / loc).is_file():
            continue
        menu = json.loads((root / loc).read_text(encoding="utf-8"))
        desc = f"{menu['name']}, {menu.get('kind') or 'Restaurant'} in Chittagong: menu, prices, hours and ordering on Hana. Pay on delivery."
        page = template.replace("base-uri 'none'", "base-uri 'self'")
        page = page.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../../">', 1)
        page = re.sub(r"<title>.*?</title>", f"<title>{escape(menu['name'])} | Hana</title>", page, count=1)
        page = re.sub(r'<meta name="description" content="[^"]*">',
                      f'<meta name="description" content="{escape(desc)}">\n<meta name="hana-listing" content="{row["id"]}">', page, count=1)
        page = re.sub(r"(<main[^>]*>).*?(</main>)", lambda m: m.group(1) + "\n" + body(menu, areas) + "\n" + m.group(2), page, count=1, flags=re.S)
        pages[f"{folder(menu)}/{row['handle']}/index.html"] = page
    return pages


def existing(root=ROOT):
    return {str(p.relative_to(root)): p for d in ("restaurants", "groceries") for p in (root / d).glob("*/index.html")}


def write(root=ROOT):
    pages = build(root)
    for rel, p in existing(root).items():
        if rel not in pages:
            p.unlink()
            try:
                p.parent.rmdir()
            except OSError:
                pass
    for rel, text in pages.items():
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_text(text, encoding="utf-8")
    return pages


if __name__ == "__main__":
    print(len(write()), "listing pages written")
