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

FILES = ["README.md", "site.json", "index.html", "regions.json", "business.html", "SECURITY.md", "CONTRIBUTING.md", "SETUP.md",
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
    for rel in FILES:
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
