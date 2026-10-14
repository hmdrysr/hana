#!/usr/bin/env python3
"""Check that menu photo links still serve the exact image the owner declared.
Standard library only. Needs network access, so run it by hand or in CI, not in
the offline self-test (which uses a local test server).

    python3 tools/verify_images.py menus/<id>/menu.json

For every photo it downloads each source address and checks: https, the reply is
an image, the size is within the limit, the SHA-256 matches, and the declared size
in bytes matches. It reports which sources work, so owners can keep spares.
"""
import hashlib
import json
import sys
import urllib.request

MAX_BYTES = 300_000


def verify(url, sha256, declared_bytes=None, max_bytes=MAX_BYTES, timeout=20, allow_local_http=False):
    """Returns (ok, message)."""
    local = allow_local_http and url.startswith("http://127.0.0.1")
    if not (url.startswith("https://") or local):
        return False, "not an https address"
    req = urllib.request.Request(url, headers={"User-Agent": "hana-verify-images/1"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            ctype = (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            if not ctype.startswith("image/"):
                return False, f"reply is '{ctype or 'unknown'}', not an image (a web page instead of the file?)"
            data = r.read(max_bytes + 1)
    except Exception as e:  # network errors are expected here and are reported, not hidden
        return False, f"could not fetch: {e}"
    if len(data) > max_bytes:
        return False, f"larger than {max_bytes} bytes"
    if declared_bytes is not None and len(data) != declared_bytes:
        return False, f"size is {len(data)} bytes, menu says {declared_bytes}"
    got = hashlib.sha256(data).hexdigest()
    if got != sha256:
        return False, f"hash is {got}, menu says {sha256}"
    return True, "ok"


def photos_in(menu):
    for i, ph in enumerate(menu.get("photos") or []):
        yield f"photos[{i}]", ph
    for it in menu.get("items") or []:
        for i, ph in enumerate(it.get("photos") or []):
            yield f"items[{it.get('id')}].photos[{i}]", ph


def main(path):
    menu = json.load(open(path, encoding="utf-8"))
    bad = 0
    count = 0
    for where, ph in photos_in(menu):
        working = 0
        for src in ph.get("sources", []):
            ok, msg = verify(src, ph.get("sha256", ""), ph.get("bytes"))
            print(("OK    " if ok else "FAIL  ") + f"{where} {src}: {msg}")
            working += ok
        count += 1
        if working == 0:
            bad += 1
            print(f"ERROR {where}: no working source")
        elif working == 1:
            print(f"NOTE  {where}: only one working source. Add a second so one host going down loses nothing.")
    print(f"\n{count} photo(s) checked, {bad} with no working source.")
    return 1 if bad else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(64)
    sys.exit(main(sys.argv[1]))
