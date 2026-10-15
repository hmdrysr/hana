#!/usr/bin/env python3
"""Fill the repo's own address into the files that need it. Standard library only.

    python3 tools/autofill.py [--root DIR] [--repo OWNER/NAME]

--repo defaults to the GITHUB_REPOSITORY setting that GitHub provides to workflows.
Replaces these placeholders in the files listed in FILES:
    {{OWNER}}     the account or organisation name
    {{REPO}}      the repository name
    {{REPO_URL}}  https://github.com/OWNER/REPO
    {{SITE_URL}}  the GitHub Pages address, https://OWNER.github.io/REPO/
                  (https://OWNER.github.io/ when the repo is named OWNER.github.io)
It does nothing when no placeholder is left, so it is safe to run again.
If the site is hosted somewhere else, edit "repo_url" in site.json by hand.
"""
import argparse
import os
import re
import sys
from pathlib import Path

FILES = ["README.md", "site.json", "index.html", "regions.json", "feed.xml", "llms.txt", "AGENTS.md", "business.html", "SECURITY.md", "CONTRIBUTING.md", "SETUP.md",
         ".github/ISSUE_TEMPLATE/config.yml"]
NAME = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def values(repo):
    if not NAME.match(repo or ""):
        raise ValueError("repository must look like OWNER/NAME, got " + repr(repo))
    owner, name = repo.split("/")
    site = f"https://{owner.lower()}.github.io/" + ("" if name.lower() == f"{owner.lower()}.github.io" else name + "/")
    return {"{{OWNER}}": owner, "{{REPO}}": name, "{{REPO_URL}}": f"https://github.com/{owner}/{name}", "{{SITE_URL}}": site}


def run(root, repo):
    vals = values(repo)
    changed = []
    pages = [str(q.relative_to(root)) for d in ("restaurants", "groceries") for q in Path(root).glob(d + "/*/index.html")]
    for rel in FILES + pages:
        p = Path(root) / rel
        if not p.is_file():
            continue
        text = p.read_text(encoding="utf-8")
        new = text
        for k, v in vals.items():
            new = new.replace(k, v)
        if new != text:
            p.write_text(new, encoding="utf-8")
            changed.append(rel)
    return changed


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=".")
    ap.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY", ""))
    a = ap.parse_args(argv)
    try:
        changed = run(a.root, a.repo)
    except ValueError as e:
        print("ERROR", e)
        return 2
    print("filled in:", ", ".join(changed) if changed else "nothing to fill in")
    tidy(a.root)
    return 0


def tidy(root):
    """An uploaded zip can add and change files but not remove them. So, after each upload:
    remove listing folders that were moved to tools/fixtures (test data only), then rebuild the
    generated files, which also removes listing pages for handles that no longer exist."""
    import shutil
    import subprocess
    r = Path(root)
    fx = r / "tools" / "fixtures" / "menus"
    if fx.is_dir():
        for d in fx.iterdir():
            live = r / "menus" / d.name
            if d.is_dir() and live.is_dir():
                shutil.rmtree(live)
                print("removed", live.relative_to(r), "(now test data in tools/fixtures)")
    if (r / "tools" / "build.py").is_file():
        subprocess.run([sys.executable, str(r / "tools" / "build.py")], cwd=r, check=False)


if __name__ == "__main__":
    sys.exit(main())
