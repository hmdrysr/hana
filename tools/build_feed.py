#!/usr/bin/env python3
"""Writes feed.xml: an Atom feed of new listings and price changes.

Anyone can follow it from the Fediverse (Mastodon and others) without signing up for
anything new, through a bridge that turns a feed into a followable account; see
README.md, "Follow Hana on the Fediverse". Feed readers can use it directly.

Run after any change to index.json or a menu:  python3 tools/build_feed.py
tools/check.py reports an error when feed.xml is out of date. Standard library only."""
import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent


def site_url(root):
    regions = json.loads((root / "regions.json").read_text(encoding="utf-8")).get("regions", [])
    url = next((r.get("url") for r in regions if r.get("name") == "Chittagong"), "") or "{{SITE_URL}}"
    return url if url.endswith("/") or "{{" in url else url + "/"


def build(root=ROOT):
    site = site_url(root)
    index = json.loads((root / "index.json").read_text(encoding="utf-8"))
    entries = []
    for row in index.get("restaurants", []):
        loc = (row.get("locations") or [""])[0]
        if loc.startswith("http") or not (root / loc).is_file():
            continue
        m = json.loads((root / loc).read_text(encoding="utf-8"))
        link = f"{site}#/r/{row['id']}"
        ann = m.get("announcement") or {}
        if ann.get("published"):
            entries.append((ann["published"], f"tag:hana,2026:{row['id']}:v{m.get('version')}",
                            f"{m['name']}: version {m.get('version')} of the menu", ann.get("summary", ""), link))
        for p in m.get("price_history") or []:
            if p.get("published") and p.get("published") != ann.get("published"):
                text = p.get("summary", "") + " " + "; ".join(
                    f"{c.get('label')}: {c.get('old')} to {c.get('new')}" for c in p.get("changes", [])[:20])
                entries.append((p["published"], f"tag:hana,2026:{row['id']}:{p['published']}", f"{m['name']}: price changes", text.strip(), link))
    entries.sort(reverse=True)
    updated = entries[0][0] if entries else "2026-10-15T00:00:00+06:00"
    out = ['<?xml version="1.0" encoding="utf-8"?>',
           '<feed xmlns="http://www.w3.org/2005/Atom">',
           "  <title>Hana: food and groceries in Chittagong</title>",
           "  <subtitle>New listings and price changes. Prices include all charges; payment on delivery only.</subtitle>",
           f'  <link rel="alternate" href="{escape(site)}"/>',
           f'  <link rel="self" href="{escape(site)}feed.xml"/>',
           f"  <id>{escape(site)}</id>",
           f"  <updated>{updated}</updated>",
           "  <author><name>Hana Community</name></author>"]
    for when, eid, title, summary, link in entries[:100]:
        out += ["  <entry>", f"    <title>{escape(title)}</title>", f'    <link href="{escape(link)}"/>',
                f"    <id>{escape(eid)}</id>", f"    <updated>{when}</updated>", f"    <summary>{escape(summary)}</summary>", "  </entry>"]
    out.append("</feed>")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    (ROOT / "feed.xml").write_text(build(), encoding="utf-8")
    print("feed.xml written")
    sys.exit(0)
