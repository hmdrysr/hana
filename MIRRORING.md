# Hosting a copy of Hana

Anyone can host Hana. Every hosted copy carries the whole app and the whole directory, so each one is also a backup: if the main site is down, the app on a customer's phone tries the mirrors listed in `peers.json`, and every offline copy and business website keeps working with the directory it carries.

## Host a full mirror

1. Copy the whole repository, unchanged, to any static web host with HTTPS (GitHub Pages, Codeberg Pages, GitLab Pages, Netlify, your own server). Keep the folder structure; do not edit the menu files.
2. Keep it current: pull from the main repository at least daily (a scheduled `git pull`, or a scheduled workflow on your forge).
3. Check it: `python3 tools/verify_mirror.py https://your.mirror/hana/`. It confirms every listing is present and every menu matches its SHA-256 hash.
4. Ask to be listed: open a pull request adding your address (ending in `/`) to `peers.json`.

## A copy inside one file

Settings, Download offline copy, and the business tools' Your own website each make a single HTML file that contains the app and the complete directory at that moment. Opened or hosted anywhere, it works offline and refreshes itself from the main site whenever it can.

## How copies are protected

The directory is public information, so it is not encrypted at rest: an encrypted copy could not be read by the app and would be no use as a backup. Instead, copies are protected against tampering:

- every page is served over HTTPS, which encrypts it in transit;
- `index.json` records the SHA-256 hash of every menu file, and the app rejects a menu that does not match;
- a claimed listing is signed by its owner's Ed25519 key, which the app and `tools/check.py` verify, so a mirror cannot change a claimed business's prices without the change being detected;
- the app refuses a menu older than one the phone has already seen.

Private business records (sales, receipts, customer details) are never part of a mirror. Businesses can encrypt their own backups in the business tools; see `SPEC.md`, section 17.
