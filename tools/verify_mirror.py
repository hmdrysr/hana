#!/usr/bin/env python3
"""Checks that a hosted copy (mirror) of Hana carries the complete, unaltered directory.

    python3 tools/verify_mirror.py https://mirror.example.org/hana/ [--against https://hmdrysr.github.io/hana/]

It compares the mirror's index.json with the reference copy (this repository by default),
then downloads every menu from the mirror and checks its SHA-256 against the index. Claimed
listings carry their owner's Ed25519 signature, which tools/check.py verifies when the
mirror's files are checked out. Standard library only. Exit code 0 means the mirror matches."""
import argparse
import hashlib
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def get(base, rel):
    if base is None:
        return (ROOT / rel).read_bytes()
    with urllib.request.urlopen(urllib.parse.urljoin(base, rel), timeout=30) as r:
        return r.read()


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("mirror")
    p.add_argument("--against", default=None, help="reference copy (default: this repository)")
    a = p.parse_args()
    mirror = a.mirror if a.mirror.endswith("/") else a.mirror + "/"
    ref = json.loads(get(a.against, "index.json"))
    got = json.loads(get(mirror, "index.json"))
    want = {r["id"]: r["menu_hash"] for r in ref.get("restaurants", [])}
    have = {r["id"]: r for r in got.get("restaurants", [])}
    problems = []
    for rid, h in want.items():
        if rid not in have:
            problems.append(f"missing listing {rid}")
        elif have[rid]["menu_hash"] != h:
            problems.append(f"{have[rid].get('name', rid)}: a different menu version from the reference")
    for rid, row in have.items():
        loc = next((l for l in row.get("locations", []) if not l.startswith("http")), None)
        if not loc:
            continue
        try:
            data = get(mirror, loc)
        except Exception as e:
            problems.append(f"{row.get('name', rid)}: menu could not be downloaded ({e})")
            continue
        if hashlib.sha256(data).hexdigest() != row["menu_hash"]:
            problems.append(f"{row.get('name', rid)}: menu file does not match its hash")
    for f in ("index.html", "core.js", "app.js", "rules.json", "areas.json"):
        try:
            get(mirror, f)
        except Exception:
            problems.append(f"{f} is missing")
    print(f"{len(have)} listings on the mirror, {len(want)} in the reference.")
    for x in problems:
        print("PROBLEM", x)
    print("The mirror matches." if not problems else f"{len(problems)} problem(s).")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
