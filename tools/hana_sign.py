#!/usr/bin/env python3
"""Owner signatures on menu files (SPEC.md section 4.1). Standard library only.

The signature is Ed25519 (RFC 8032) over the canonical form of the menu: the JSON
object without its "signature" key, with keys sorted, no spaces, and UTF-8 text.
The business tools page (business.html) produces the same canonical form in the
browser, signs it there, and writes the result into "signature" (unpadded base64url).

    python3 tools/hana_sign.py verify menus/<id>/menu.json
"""
import hashlib
import json
import sys

import ed25519


def canonical(menu):
    body = {k: v for k, v in menu.items() if k != "signature"}
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def owner_key(menu):
    owner = menu.get("owner") if isinstance(menu.get("owner"), dict) else {}
    try:
        raw = ed25519.unb64u(owner.get("public_key", ""))
    except Exception:
        return None
    return raw if len(raw) == 32 else None


def listing_id(public_raw):
    return hashlib.sha256(public_raw).hexdigest()


def verify_menu(menu):
    """Returns None when the signature is valid, otherwise the reason it is not."""
    pub = owner_key(menu)
    if pub is None:
        return "owner.public_key must be a 32-byte Ed25519 public key in unpadded base64url"
    sig = menu.get("signature")
    try:
        sig_raw = ed25519.unb64u(sig) if isinstance(sig, str) else b""
    except Exception:
        sig_raw = b""
    if len(sig_raw) != 64:
        return "signature must be a 64-byte Ed25519 signature in unpadded base64url"
    if not ed25519.verify(pub, canonical(menu), sig_raw):
        return "signature does not match the menu: it was changed after signing, or signed with another key"
    return None


def sign_menu(menu, secret):
    menu = dict(menu)
    menu.pop("signature", None)
    menu["signature"] = ed25519.b64u(ed25519.sign(secret, canonical(menu)))
    return menu


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "verify":
        m = json.load(open(sys.argv[2], encoding="utf-8"))
        problem = verify_menu(m)
        print("valid signature" if problem is None else "INVALID: " + problem)
        sys.exit(0 if problem is None else 1)
    print(__doc__)
    sys.exit(64)
