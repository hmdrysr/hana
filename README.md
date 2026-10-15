# Hana

Hana is the Chittagonian word for food. Hana is a free, open directory of restaurants and grocery stores in Chittagong, Bangladesh, and a tool for preparing orders. It lists businesses, shows which ones deliver to your area, and prepares an order message that you send yourself, by WhatsApp, text message, email or whichever app the business uses. You pay the business on delivery or at pickup, in cash, by Bangla QR, by card on a terminal or by mobile wallet transfer.

Created by [Hamid Yasir & Co.](https://hamidyasir.com) for the people of Chittagong. Managed by the [Hana Community](https://github.com/hmdrysr/hana). See `AUTHORS.md`.

Live site (once GitHub Pages is turned on; see `SETUP.md`): https://hmdrysr.github.io/hana/

## Terms

Hana is a directory and an order-preparation tool. Each order is a contract between the customer and the business alone; Hamid Yasir & Co. and the Hana Community are not parties to it and do not handle payments, food or deliveries. The full terms, including the rules for businesses and the limitation of liability, are in `TERMS.md` and on the app's Terms page.

## Status

This is the first working version. The app:

- lists restaurants alphabetically, with typo-tolerant search across restaurants and dishes;
- matches restaurants to your zone (thana), with an optional ward at checkout;
- offers delivery or pickup, with the delivery fee fixed by the business and capped;
- counts an order only once the business confirms it, with a signed confirmation for claimed listings;
- keeps one basket for one restaurant at a time;
- prepares the order message, which you send from your own phone; and
- works offline after the first visit, and can be downloaded as a single offline file that updates itself when online;
- lets each person choose a colour scheme, text size and pictures, with an optional profile kept on the phone.

Businesses use the business tools page (`business.html`) to list or claim a listing, confirm orders and publish price changes. Claims are verified by two community members (`CLAIMS.md`).

Not built yet: the courier card, photos and drawn area boundaries. The three listings (Meal Master, Sliced and Tava Restaurant) were entered by a volunteer from menu images and are **not yet confirmed by the businesses**. The full design, including every open item, is in `SPEC.md`.

## Why Hana exists

Large delivery platforms such as Uber Eats sit between restaurants and their customers. A platform with that much market power sets the fees and the terms, and neither side has much say. Restaurants give up a large share of each sale, and customers pay added fees.

Hana is an alternative. It takes no commission and leaves the choices with customers and businesses.

This explains why the project exists. It is not an audit: Hana has not measured any platform's fees and makes no claims about a specific company.

## What Hana promises

1. **No commission and no listing fee.** Hana never takes money from a sale or a restaurant.
2. **No featured restaurants.** Every list is in alphabetical order, the same for everyone. Nothing can be paid for, pinned or boosted.
3. **No exclusivity.** A restaurant can list anywhere else, and can leave at any time.
4. **The restaurant sets its own prices, fees, delivery zones and hours.** Nobody else can change them.
5. **The customer chooses.** The customer picks which restaurant, how to order, and how much contact detail to share.
6. **No accounts, no tracking and no collection of customer data.** Customer details stay on the customer's phone.
7. **Open and portable.** Open-source code, open file formats, signed menus that any host can serve, and one-tap download of your own data.
8. **Problems go to the proper public bodies.** The app points customers to the consumer rights authority, the police and others. See `SPEC.md` section 9.
9. **Every price change is public.** Changes to prices, delivery fees and minimum orders are announced inside the menu file and kept in its history. See `SPEC.md` section 5.4.
10. **One delivery charge, set by the business and capped.** Hana adds no fee of its own and has no surge or distance pricing. An order is for one restaurant at a time.
11. **Cash on delivery only.** Pay on delivery or at pickup, in cash, by Bangla QR, by card on a POS terminal or by mobile wallet transfer. No business may ask for payment in advance.
12. **All charges included.** Every price includes VAT and every other charge; the delivery fee is the only addition.
13. **Orders are confirmed by the business.** An order counts only once the business confirms it, within 15 minutes; otherwise it is cancelled automatically.
14. **Records are kept.** Businesses keep all order communications for at least six months, and twelve months when there is a dispute. See `TERMS.md`.

These promises are protected by `GOVERNANCE.md`. A change that adds fees, paid placement, tracking or lock-in is not accepted.

## Follow Hana on the Fediverse

New listings and price changes are published as an Atom feed, `feed.xml` (https://hmdrysr.github.io/hana/feed.xml). Nobody needs a new account to follow it:

- **From Mastodon or another Fediverse app:** look up the feed address at RSS Parrot (https://rss-parrot.net), a free bridge that gives every feed its own followable account, then follow that account from the account you already have.
- **From a feed reader:** add the feed address.

The feed is rebuilt with `python3 tools/build.py`; `tools/check.py` reports when it is out of date. Businesses need nothing beyond the GitHub account they already use for their listing.

## Ordering through an AI assistant

An AI assistant can find businesses, read menus and prepare an order from the public files, following the rules in `AGENTS.md` (summary in `llms.txt`). It can open the customer's messaging app with the order filled in, or give them a link that opens Hana's checkout with the basket ready. The customer approves and sends every order. `AI-IMPROVING.md` explains how to use an AI assistant to improve Hana itself.

## Downloading the directory

In the app, Settings, then Download the directory, saves the directory as JSON or as a PDF laid out like a telephone book. You choose which businesses (all, restaurants or grocery stores; a delivery zone; a category) and which details (contact details, address, cuisine, hours, delivery fees, menus).

## For businesses

The business tools (business.html) let a business confirm orders, edit its menu and publish signed updates. Optional tools, under More, add a point of sale with standard receipts and statements, rider dispatch, and encrypted backups to the business's own Supabase or CouchDB. Only the menu and the listing are ever published; everything else stays on the business's device or goes only where it sends it. See `SPEC.md`, section 18.

## Hosting a copy

Every copy of Hana carries the full directory and acts as a backup. See `MIRRORING.md`.

## Listing addresses

Every listing can have a handle, such as @mealmaster, and a clean address: https://hmdrysr.github.io/hana/restaurants/mealmaster/. Run `python3 tools/build.py` after changing a listing to rebuild these pages and the feed.

## How to help

Read `CONTRIBUTING.md`. You can list a restaurant, report a wrong listing, fix an area, test on a real phone, write code or improve the spec. Most routes need no GitHub account.

## What is in this repo

| Path | What it holds |
|---|---|
| `index.html`, `core.js`, `app.js`, `sw.js`, `site.json`, `manifest.webmanifest`, `icon*` | The customer app. Plain files, no build step |
| `business.html`, `business.js` | Business tools: list or claim, confirm orders, update prices |
| `rules.json` | Rules every listing follows: cash on delivery only, all-inclusive prices, the delivery fee limit |
| `ADOPTING.md`, `regions.json` | How another region runs its own Hana, and the list of regional directories |
| `TERMS.md` | Terms of Use: rules for businesses and customers, records, disputes and liability |
| `CLAIMS.md`, `claims/` | How claims are verified by the community, and the claim records |
| `SPEC.md` | The full design, with open items and what is still unverified |
| `SETUP.md` | How to put this on GitHub, step by step |
| `LICENSE` | MIT licence |
| `index.json`, `peers.json`, `areas.json` | The directory, other directories, and Chittagong areas (city, Stations and wards) |
| `menus/` | Menus hosted in this repo by volunteers (signed by the owners) |
| `vouches/`, `vouchers.json` | Signed vouch notes and the list of approved vouchers |
| `theme/` | The one fixed look: Beer CSS, the Hana theme and the uniformity rules (`theme/UNIFORMITY.md`) |
| `tools/` | `check.py` (the check every pull request must pass), `selftest.py`, `browser_test.py`, `order_line.py`, `hana_sign.py`, `ed25519.py`, `verify_images.py`, `unpack.py`, `autofill.py` |
| `.github/` | Issue forms, the pull request template and the check workflow |
| `AUTHORS.md`, `GOVERNANCE.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `VOLUNTEERS.md` | People, rules and contacts |

## Licence

MIT. See `LICENSE`. Third-party files keep their own licences: Beer CSS (MIT, `theme/beer-LICENSE.md`) Material Symbols (Apache License 2.0, `theme/material-symbols-LICENSE.txt`) and the Twemoji food icons (CC BY 4.0, `icons/README.md`). See `DEPENDENCIES.md`.

Contributors keep their copyright and release their work under the same MIT licence (see `CONTRIBUTING.md`).
