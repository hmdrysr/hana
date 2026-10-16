# Hana

Hana is the Chittagonian word for food. Hana is a free, open directory of restaurants and grocery stores in Chittagong, Bangladesh, and a tool for preparing orders. It lists businesses, shows which ones deliver to your area, and prepares an order message that you send yourself, by WhatsApp, text message, email or whichever app the business uses. You pay the business on delivery or at pickup, in cash, by Bangla QR, by card on a terminal or by mobile wallet transfer.

Created by [Hamid Yasir & Co.](https://hamidyasir.com) for the people of Chittagong. Managed by the [Hana Community](https://github.com/hmdrysr/hana). See [`AUTHORS.md`](AUTHORS.md).

**[Open Hana](https://hmdrysr.github.io/hana/)** · [Business tools](https://hmdrysr.github.io/hana/business.html) · [Try the demo tea stall](https://hmdrysr.github.io/hana/restaurants/tong/)

Questions about why Hana exists, how delivery works and how it stays free are answered in the [FAQ](FAQ.md).

## Documents

Every document in this repository, in one place. Each link opens on GitHub.

**Start here**
- [FAQ](FAQ.md): why Hana exists, how delivery works and how it stays free
- [Terms of Use](TERMS.md): the rules for businesses and customers, records, disputes and privacy
- [Roadmap](ROADMAP.md): planned upgrades and the conditions each must meet first

**For businesses and volunteers**
- [Claiming a listing](CLAIMS.md): how a business claims its listing and how the community verifies it
- [Volunteers](VOLUNTEERS.md): who entered which listing, and the vouchers
- [Contributing](CONTRIBUTING.md): how to list a business, report a mistake or improve the code
- [Report or add a listing](https://github.com/hmdrysr/hana/issues/new/choose): forms for new listings, corrections, claims, area changes, phone tests and bugs

**For hosts and other regions**
- [Setting up Hana on GitHub](SETUP.md): step by step
- [Hosting a copy (mirroring)](MIRRORING.md): every copy is a full, tamper-evident backup
- [Running Hana in another region](ADOPTING.md)

**For AI assistants**
- [Ordering with an AI assistant](AGENTS.md) and [llms.txt](llms.txt)
- [Improving Hana with AI tools](AI-IMPROVING.md)

**Design and rules**
- [Specification](SPEC.md): the full design, with open items and what is still unverified
- [Governance](GOVERNANCE.md): the promises that protect Hana, and how decisions are made
- [Uniformity rules](theme/UNIFORMITY.md) and [theme checks](THEME-CHECKS.md): the one fixed look
- [Dependencies and licences](DEPENDENCIES.md), [icon credits](icons/README.md) and [Beer CSS licence](theme/beer-LICENSE.md)

**People and safety**
- [Authors](AUTHORS.md), [Code of Conduct](CODE_OF_CONDUCT.md) and [Security](SECURITY.md)
- [Licence (MIT)](LICENSE)

## Terms

Hana is a directory and an order-preparation tool. Each order is a contract between the customer and the business alone; Hamid Yasir & Co. and the Hana Community are not parties to it and do not handle payments, food or deliveries. The full terms, including the rules for businesses and the limitation of liability, are in [`TERMS.md`](TERMS.md) and on the app's Terms page.

## Status

Working and tested in browsers; not yet tested on enough real phones. For customers, the app:

- lists restaurants and grocery stores alphabetically, with typo-tolerant search that shows items first ("what is available where"), then places; each menu has its own search;
- matches places to your zone (thana), found from your location or your map pin, with an optional ward at checkout;
- offers delivery or pickup, with the delivery fee set by the business and capped;
- keeps one basket for one business, saved addresses, favourites, an "Open now" filter and "Order again";
- prepares a polite order message, sent from your own phone by WhatsApp, text message, email or another app, or sends it in Hana, encrypted, with live status, chat and alerts;
- takes a note for each item (such as "no onion"), shows a "Check before you pay" list when the order arrives, and passes on the business's "running late" notices;
- shows when each listing's prices were last confirmed, and says so when a volunteer entered them;
- adds a map pin for the rider (OpenStreetMap), and works in English or Bangla, light or dark, at any text size;
- works offline after the first visit, and can be downloaded as one offline file or as a JSON or PDF phone book.

Every claimed business's confirmation, status update and message is signed, and so is every message the customer sends in Hana, so neither side can invent the other's words in a dispute. Listings entered by volunteers skip the order codes: the customer and the business agree on prices and the total in their chat.

The directory starts with two demo listings, **TONG: NOT A REAL PLACE** (a tea stall) and **DUWAN: NOT A REAL PLACE** (a grocery store), so anyone can try Hana. They use typical Bangladeshi retail prices from 2026 market reports. Orders to them are just for fun, like the pretend-shopping sites people use for a little dopamine hit: nothing is sent, the order is confirmed at once, Rice Uddin brings it, and it is "delivered" in about a minute. Every screen labels them as demos. The full design is in [`SPEC.md`](SPEC.md); planned upgrades, with the conditions for each, are in [`ROADMAP.md`](ROADMAP.md).

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
8. **Problems go to the proper public bodies.** The app points customers to the consumer rights authority, the police and others. See [`SPEC.md`](SPEC.md) section 9.
9. **Every price change is public.** Changes to prices, delivery fees and minimum orders are announced inside the menu file and kept in its history. See [`SPEC.md`](SPEC.md) section 5.4.
10. **One delivery charge, set by the business and capped.** Hana adds no fee of its own and has no surge or distance pricing. An order is for one restaurant at a time.
11. **Cash on delivery only.** Pay on delivery or at pickup, in cash, by Bangla QR, by card on a POS terminal or by mobile wallet transfer. No business may ask for payment in advance.
12. **All charges included.** Every price includes VAT and every other charge; the delivery fee is the only addition.
13. **Orders are confirmed by the business.** An order counts only once the business confirms it, within 15 minutes; otherwise it is cancelled automatically.
14. **Records are kept.** Businesses keep all order communications for at least six months, and twelve months when there is a dispute. See [`TERMS.md`](TERMS.md).

These promises are protected by [`GOVERNANCE.md`](GOVERNANCE.md). A change that adds fees, paid placement, tracking or lock-in is not accepted.

## Follow Hana on the Fediverse

New listings and price changes are published as an Atom feed, [`feed.xml`](feed.xml) (https://hmdrysr.github.io/hana/feed.xml). Nobody needs a new account to follow it:

- **From Mastodon or another Fediverse app:** look up the feed address at RSS Parrot (https://rss-parrot.net), a free bridge that gives every feed its own followable account, then follow that account from the account you already have.
- **From a feed reader:** add the feed address.

The feed is rebuilt with `python3 tools/build.py`; [`tools/check.py`](tools/check.py) reports when it is out of date. Businesses need nothing beyond the GitHub account they already use for their listing.

## Ordering through an AI assistant

An AI assistant can find businesses, read menus and prepare an order from the public files, following the rules in [`AGENTS.md`](AGENTS.md) (summary in [`llms.txt`](llms.txt)). It can open the customer's messaging app with the order filled in, or give them a link that opens Hana's checkout with the basket ready. The customer approves and sends every order. [`AI-IMPROVING.md`](AI-IMPROVING.md) explains how to use an AI assistant to improve Hana itself.

## Downloading the directory

In the app, Settings, then Download the directory, saves the directory as JSON or as a PDF laid out like a telephone book. You choose which businesses (all, restaurants or grocery stores; a delivery zone; a category) and which details (contact details, address, cuisine, hours, delivery fees, menus).

## For businesses

Listing costs nothing and Hana takes no commission. The business tools ([`business.html`](business.html)) work on any phone browser:

- **Sign-in:** a passkey (fingerprint, face or screen lock) or a five-word recovery phrase unlocks the business key, kept encrypted as `vault.json` in the business's own repository. Staff get their own sign-in and can confirm and update orders, but cannot change the menu.
- **Orders:** orders sent in Hana arrive encrypted, with a sound, through ntfy (free, open source, no account). Confirm, decline, mark ready or out for delivery (rider details required) and message the customer, all signed. Orders pasted from other apps are checked against the published menu.
- **Today:** mark items sold out, add busy minutes or switch to pickup only; customers see it at once, and it resets at midnight.
- **Menu:** a visual editor publishes signed menu versions with a public price history.
- **More:** point of sale with receipts and statements, rider dispatch, encrypted backups, an own website, a QR poster, a Get started checklist and community reports.

Only the menu, the listing and the encrypted vault are published. Everything else stays on the business's device. See [`SPEC.md`](SPEC.md), sections 18 and 21 to 23.

## Hosting a copy

Every copy of Hana carries the full directory and acts as a backup. See [`MIRRORING.md`](MIRRORING.md).

## Listing addresses

Every listing can have a handle, such as @tong, and a clean address: https://hmdrysr.github.io/hana/restaurants/tong/ (grocery stores: https://hmdrysr.github.io/hana/groceries/duwan/). Run `python3 tools/build.py` after changing a listing to rebuild these pages and the feed.

## How to help

Read [`CONTRIBUTING.md`](CONTRIBUTING.md). You can list a restaurant, report a wrong listing, fix an area, test on a real phone, write code or improve the spec. Most routes need no GitHub account.

## What is in this repo

| Path | What it holds |
|---|---|
| [`index.html`](index.html), [`core.js`](core.js), [`app.js`](app.js), [`sw.js`](sw.js), [`site.json`](site.json), [`manifest.webmanifest`](manifest.webmanifest), `icon*` | The customer app. Plain files, no build step |
| [`business.html`](business.html), [`business.js`](business.js), [`pos.js`](pos.js), [`vault.js`](vault.js), [`vault-words.txt`](vault-words.txt) | Business tools: sign-in, orders, menu, point of sale, staff |
| [`direct.js`](direct.js) | Orders sent in Hana: ntfy relay, end-to-end encryption, presence |
| [`i18n/bn.json`](i18n/bn.json) | Bangla interface labels, loaded only when chosen |
| [`vendor/`](vendor) | Third-party code loaded only where needed (the QR library) |
| [`list.json`](list.json), [`search.json`](search.json), [`feed.xml`](feed.xml), [`restaurants/`](restaurants), [`groceries/`](groceries) | Built by [`tools/build.py`](tools/build.py): the home-page list, dish search, the Atom feed and clean listing pages |
| [`ROADMAP.md`](ROADMAP.md) | Planned upgrades and the conditions each must meet first |
| [`rules.json`](rules.json) | Rules every listing follows: cash on delivery only, all-inclusive prices, the delivery fee limit |
| [`ADOPTING.md`](ADOPTING.md), [`regions.json`](regions.json) | How another region runs its own Hana, and the list of regional directories |
| [`TERMS.md`](TERMS.md) | Terms of Use: rules for businesses and customers, records, disputes and liability |
| [`CLAIMS.md`](CLAIMS.md), `claims/` | How claims are verified by the community, and the claim records |
| [`SPEC.md`](SPEC.md) | The full design, with open items and what is still unverified |
| [`SETUP.md`](SETUP.md) | How to put this on GitHub, step by step |
| [`LICENSE`](LICENSE) | MIT licence |
| [`index.json`](index.json), [`peers.json`](peers.json), [`areas.json`](areas.json) | The directory, other directories, and Chittagong areas (city, Stations and wards) |
| [`menus/`](menus) | Menus hosted in this repo by volunteers (signed by the owners) |
| [`vouches/`](vouches), [`vouchers.json`](vouchers.json) | Signed vouch notes and the list of approved vouchers |
| [`theme/`](theme) | The one fixed look: Beer CSS, the Hana theme and the uniformity rules ([`theme/UNIFORMITY.md`](theme/UNIFORMITY.md)) |
| [`tools/`](tools) | `check.py` (the check every pull request must pass), `selftest.py`, `browser_test.py`, `build.py`, `place_order.py`, `order_line.py`, `hana_sign.py`, `ed25519.py`, `verify_images.py`, `unpack.py`, `autofill.py` |
| [`.github/`](.github) | Issue forms, the pull request template and the check workflow |
| [`AUTHORS.md`](AUTHORS.md), [`GOVERNANCE.md`](GOVERNANCE.md), [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), [`SECURITY.md`](SECURITY.md), [`VOLUNTEERS.md`](VOLUNTEERS.md) | People, rules and contacts |

## Licence

MIT. See [`LICENSE`](LICENSE). Third-party files keep their own licences: Beer CSS (MIT, [`theme/beer-LICENSE.md`](theme/beer-LICENSE.md)) Material Symbols (Apache License 2.0, [`theme/material-symbols-LICENSE.txt`](theme/material-symbols-LICENSE.txt)) the Twemoji food icons (CC BY 4.0, [`icons/README.md`](icons/README.md)), qrcode-generator (MIT) and the BIP-39 word list (MIT). Map data is © OpenStreetMap contributors (ODbL). See [`DEPENDENCIES.md`](DEPENDENCIES.md).

Every part of Hana is free and open source, and every update must stay backwards compatible (see [`ROADMAP.md`](ROADMAP.md)).

Contributors keep their copyright and release their work under the same MIT licence (see [`CONTRIBUTING.md`](CONTRIBUTING.md)).
