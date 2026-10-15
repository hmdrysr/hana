# Setup: put Hana on GitHub

Everything below can be done from a phone browser. Nothing needs to be installed.
Your repository address is https://github.com/hmdrysr/hana and your site will be https://hmdrysr.github.io/hana/
(these two lines fill themselves in after the first unzip).

## One-time steps

1. Make a new public repository on GitHub. Leave it empty (no README, no licence, because the zip has them).
2. Open **Settings, then Actions, then General**, and under **Workflow permissions** choose **Read and write permissions**. Save.
3. Add the unzip workflow by hand. **Add file, then Create new file**. Name it `.github/workflows/unzip.yml`. Paste the contents of `.github/workflows/unzip.yml` from the zip (the copybox in the chat has it). Commit.
4. Optional: add `.github/workflows/check.yml` the same way. It runs the repo checks on every pull request.
5. **Add file, then Upload files**. Drag in `hana-repo.zip` at the top level of the repo (not in a folder). Commit.
6. Open the **Actions** tab. The "unzip" run unpacks the zip, fills in the repo address, runs the checks and commits the result. When it is green, refresh the repo page. You will see the files.
7. Publish the site. Either: (a) add `.github/workflows/pages.yml` by hand as in step 3, then in **Settings, then Pages**, set **Source** to **GitHub Actions** (the site is redeployed on every change to `main`); or (b) in **Settings, then Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`. Use one method, not both. After a minute the site is live at the address above.

## Why workflow files are added by hand

GitHub does not let an automatic commit change workflow files, so the unzip workflow skips `.github/workflows/` inside any zip. The same protection means a zip can never swap in a different workflow.

## Later updates

Upload a new zip at the top level. Files with the same name are replaced, and git keeps every old version. Files that are not in the zip are never deleted. A zip can be a whole new copy of the repo, or only the files that changed, for example a new menu folder.

## If the site is not on GitHub Pages

Put the same files on any static host. Then edit `repo_url` in `site.json` to your repository address, so the "Hana Community" link in the footer works.

## What you still need to decide

See open items in `SPEC.md` section 12. The first ones for a launch: list the first real businesses and confirm them with their owners (the directory now starts with two demo listings, TONG and DUWAN), fill in `VOLUNTEERS.md` and `vouchers.json`, draw the area boundaries, and take legal advice on the Responsibility notice.
