#!/usr/bin/env python3
"""Rebuilds every generated file: feed.xml, list.json, search.json and the listing pages (restaurants/<handle>/,
groceries/<handle>/). Run after changing a listing, index.json or index.html."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_feed  # noqa: E402
import build_pages  # noqa: E402
import build_list  # noqa: E402

(build_feed.ROOT / "feed.xml").write_text(build_feed.build(), encoding="utf-8")
build_list.write()
print("feed.xml, list.json and search.json written;", len(build_pages.write()), "listing pages written")
