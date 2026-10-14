# Hana

Hana is the Chittagonian word for food. Hana is a free, open directory of restaurants in Chittagong, Bangladesh, and a tool for preparing orders. It lists restaurants, shows which ones deliver to your area, and prepares an order message that you send yourself, by WhatsApp, text message, phone call or whichever app the business uses. You pay the business directly, in cash or by Bangla QR.

Created by [Hamid Yasir & Co.](https://hamidyasir.com) for the people of Chittagong. Managed by the [Hana Community](https://github.com/hmdrysr/hana). See `AUTHORS.md`.

Live site (once GitHub Pages is turned on; see `SETUP.md`): https://hmdrysr.github.io/hana/

## Responsibility

Hamid Yasir & Co. assumes no responsibility for anything. All transactions and relationships are between the customer and the restaurant. All disputes are handled by the appropriate local government authority and the community. Hana lists restaurants and prepares order messages; it does not take payments, prepare food or make deliveries.

## Status

This is the first working version. The app:

- lists restaurants alphabetically, with typo-tolerant search across restaurants and dishes;
- matches restaurants to your zone (thana), with an optional ward at checkout;
- offers delivery or pickup, with the delivery fee fixed by the business and capped;
- counts an order only once the business confirms it, with a signed confirmation for claimed listings;
- keeps one basket for one restaurant at a time;
- prepares the order message, which you send from your own phone; and
- works offline after the first visit.

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
13. **Orders are confirmed by the business.** An order counts only once the business confirms it.

These promises are protected by `GOVERNANCE.md`. A change that adds fees, paid placement, tracking or lock-in is not accepted.

## How to help

Read `CONTRIBUTING.md`. You can list a restaurant, report a wrong listing, fix an area, test on a real phone, write code or improve the spec. Most routes need no GitHub account.

## What is in this repo

| Path | What it holds |
|---|---|
| `index.html`, `core.js`, `app.js`, `sw.js`, `site.json`, `manifest.webmanifest`, `icon*` | The customer app. Plain files, no build step |
| `business.html`, `business.js` | Business tools: list or claim, confirm orders, update prices |
| `rules.json` | Rules every listing follows: cash on delivery only, all-inclusive prices, the delivery fee limit |
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

MIT. See `LICENSE`. Third-party files keep their own licences: Beer CSS (MIT, `theme/beer-LICENSE.md`) and Material Symbols (Apache License 2.0, `theme/material-symbols-LICENSE.txt`). See `DEPENDENCIES.md`.

Contributors keep their copyright and release their work under the same MIT licence (see `CONTRIBUTING.md`).
