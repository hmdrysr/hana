#!/usr/bin/env python3
"""Safely unpack zips into the repo (stdlib only). Used by the unzip workflow, which carries a copy.
   python3 tools/unpack.py [--root DIR] [--report FILE] ZIP...
Refuses: '..', absolute or backslash names, links, .git, over 3000 files or 60 MB.
Skips: .github/workflows/ (paste those by hand), top-level .zip files, junk.
Removes one common top folder. Overwrites same-name files (git keeps the old ones). Deletes nothing."""
import argparse, posixpath, re, stat, sys, zipfile
from pathlib import Path


def clean_name(n):
    if "\\" in n or n.startswith("/") or re.match(r"^[A-Za-z]:", n) or "\x00" in n:
        raise ValueError("unsafe name " + repr(n))
    parts = [p for p in n.split("/") if p not in ("", ".")]
    if ".." in parts:
        raise ValueError("unsafe name " + repr(n))
    return "/".join(parts)


def unpack(zip_path, root):
    """Returns (added, changed, unchanged, skipped). Raises ValueError if the zip is refused."""
    root = Path(root).resolve()
    added, changed, same, skipped = [], [], [], []
    with zipfile.ZipFile(zip_path) as z:
        infos = [i for i in z.infolist() if not i.is_dir()]
        names = [clean_name(i.filename) for i in infos]
        if len(infos) > 3000 or sum(i.file_size for i in infos) > 60 * 2**20 or any(i.file_size > 20 * 2**20 for i in infos):
            raise ValueError("zip is over the size limits")
        if any(stat.S_ISLNK(i.external_attr >> 16) for i in infos):
            raise ValueError("links are not allowed")
        tops = {n.split("/")[0] for n in names if "/" in n}
        strip = len(tops) == 1 and all("/" in n for n in names)
        for i, n in zip(infos, names):
            rel = n.split("/", 1)[1] if strip else n
            if rel == ".git" or rel.startswith(".git/") or "/.git/" in rel:
                raise ValueError("a .git folder is not allowed: " + rel)
            why = (".github/workflows/ is pasted by hand" if rel.startswith(".github/workflows/")
                   else "top-level zip" if "/" not in rel and rel.lower().endswith(".zip")
                   else "junk" if "__pycache__/" in rel or rel.endswith(".pyc") or rel == ".DS_Store" or rel.startswith("__MACOSX/")
                   else "")
            if why:
                skipped.append(rel + " (" + why + ")")
                continue
            dest = (root / posixpath.normpath(rel)).resolve()
            if root not in dest.parents:
                raise ValueError("path leaves the repo: " + rel)
            data = z.read(i)
            if dest.exists() and dest.read_bytes() == data:
                same.append(rel)
                continue
            (changed if dest.exists() else added).append(rel)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
    return added, changed, same, skipped


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--report")
    ap.add_argument("zips", nargs="+")
    a = ap.parse_args(argv)
    out, bad = [], 0
    for zp in a.zips:
        try:
            ad, ch, same, sk = unpack(zp, a.root)
        except (ValueError, zipfile.BadZipFile) as e:
            bad += 1
            out.append(f"REFUSED {zp}: {e}")
            continue
        out.append(f"{zp}: {len(ad)} added, {len(ch)} changed, {len(same)} unchanged, {len(sk)} skipped")
        out += ["  changed: " + f for f in ch[:100]] + ["  skipped: " + f for f in sk]
    print("\n".join(out))
    if a.report:
        Path(a.report).write_text("\n".join(out) + "\n", encoding="utf-8")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
