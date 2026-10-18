"""Stamps sw.js with VERSION, a short hash of every app file it serves from the phone, so a
release that changes any of them is installed as a whole on the next visit (SPEC.md, section 20)."""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def files(root=ROOT):
    text = (root / "sw.js").read_text(encoding="utf-8")
    names = []
    for const in ("SHELL", "LATER"):
        m = re.search(r"const " + const + r" = \[(.*?)\];", text, re.S)
        names += re.findall(r'"([^"]+)"', m.group(1)) if m else []
    return [n for n in names if n not in ("./",)]


def build(root=ROOT):
    text = (root / "sw.js").read_text(encoding="utf-8")
    h = hashlib.sha256()
    for n in sorted(set(files(root))):
        p = root / n
        h.update(n.encode() + b"\0" + (p.read_bytes() if p.is_file() else b"") + b"\0")
    return re.sub(r'const VERSION = "[^"]*";', 'const VERSION = "' + h.hexdigest()[:12] + '";', text, count=1)


def write(root=ROOT):
    (root / "sw.js").write_text(build(root), encoding="utf-8")
