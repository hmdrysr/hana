# Hana: Chittagong Food Directory and Order App. Draft Spec v0.6

Created by Hamid Yasir & Co.

Status: draft. Items marked UNVERIFIED are from memory and must be checked against current official sources before launch.

## 1. What this is

A static progressive web app (PWA) that lists restaurants and formats orders. It does not take payments, run deliveries, store orders on a server or settle disputes. Customers pay cash on delivery or by Bangla QR directly to the restaurant. Orders are sent by the customer's own messaging app to the restaurant's preferred channel.

Anything the app does not do is stated plainly in the app.

### 1.1 Scope: Chittagong only

This app is purpose-made for Chittagong. It does not cover other cities, and nothing in the design is built around a multi-city directory.

- The city is always written "Chittagong". The alternative official spelling is never used anywhere in the app, the data files or the documentation.
- There is one directory for Chittagong. If it grows large, it is split by zone (thana), not by city.
- Neighbourhood names come from one shared file, `areas.json`, so every restaurant and every customer uses the same spellings (see section 5.1).

### 1.2 Name

The app is called **Hana**, the Chittagonian word for food.

- Written "Hana" everywhere: the page title, the PWA manifest (`name` and `short_name`), the repo, the documentation and the home-screen label.
- The app shows one line about the name, for example "Hana is the Chittagonian word for food." The app stays English only, so no other script or spelling is shown.
- Other software and businesses may already use the name. Check this before publishing (see open items).

### 1.3 Why Hana exists

Large delivery platforms such as Uber Eats sit between a restaurant and its customers. A platform with that much market power sets the fees and the terms, and neither side has much say. Restaurants hand over a large share of each sale. Customers pay added fees. Both can be pushed into choices they would not make on their own.

Hana is an alternative that is run by no company, takes no cut and leaves the choices with the customer and the restaurant.

This is the reason the project exists. It is not an audit. Hana has not measured any platform's fees, and the app and the documents make no claims about a specific company.

### 1.4 Founding commitments

These are design rules, not features. Governance protects them (`GOVERNANCE.md` section 1).

1. No commission and no listing fee.
2. No paid placement, paid ranking or featured restaurants. Every list is in alphabetical order, the same for everyone (section 5.1).
3. No exclusivity or lock-in. A restaurant can list elsewhere and leave at any time. Customers can export their own data.
4. Restaurants set their own prices, fees, delivery zones and hours.
5. Customers choose the restaurant, the way to order and how much contact detail to share.
6. No accounts, tracking or collection of customer data.
7. Open source and open formats only.
8. The creator is credited in `README.md`, `AUTHORS.md` and the About screen.
9. Every price change is public, announced inside the menu file and kept in its history (section 5.4).
10. One delivery charge per area, fixed by the business and never above the limit in `rules.json` (proposed: BDT 150). The app adds no fee of its own, and there is no surge, distance or per-customer pricing.
11. Cash on delivery only. The customer pays the business on delivery or at pickup: in cash, by Bangla QR, by card on a POS terminal, or by mobile wallet transfer. Prepayment is never allowed, under any circumstances.
12. Every price includes VAT and every other charge (packaging, service, platform or anything else). The delivery fee is the only addition.
13. An order is valid only when the business confirms it within 15 minutes (section 6.5). Otherwise it is cancelled automatically.
14. Businesses keep all order communications for at least six months, and twelve months when there is a dispute (section 6.6 and `TERMS.md`).

A change that breaks one of these is not accepted. `tools/check.py` rejects menu fields for commission, sponsorship, tracking, prepayment and extra charges, enforces the delivery fee limit, and checks `rules.json`.

### 1.5 About screen and Terms of Use

One About screen, reachable from the navigation. It shows, in plain sentences: that Hana is the Chittagonian word for food; the credit ("Built by Hamid Yasir & Co. for the people of Chittagong. Managed by the Hana Community."); how Hana works; the rules for every listing; a button for businesses to add or claim a listing; why Hana exists; the commitments; privacy; a short statement that each order is a contract between the customer and the business alone; and a link to the Terms of Use.

The Terms of Use (`TERMS.md`, shown on the app's Terms page) hold the legal text: the nature of the Service, the obligations of businesses and customers, preservation of records, disputes, the disclaimer of warranties, the limitation of liability, privacy, third-party services, governing law and changes. Legal text stays there and in `CLAIMS.md`; screens show only the one rule that matters at that point (for example, "never pay in advance" at checkout). UNVERIFIED: the terms have not been reviewed by a lawyer qualified in Bangladesh (open item 1).

### 1.6 Logo and footer

- The logo is the french fries emoji 🍟, shown beside the word "Hana". In the app it is drawn by the phone's emoji font. The home screen icon (`icon-192.png`, `icon-512.png`) and `icon.svg` use the same emoji.
- Every page has the same footer: "Built by Hamid Yasir & Co. for the people of Chittagong. Managed by the Hana Community.", followed by links to the Terms and to the business tools (or back to the restaurant list). "Hamid Yasir & Co." links to https://hamidyasir.com. "Hana Community" links to the project repository. The repository address is filled in by `tools/autofill.py` and, on GitHub Pages, worked out by the app from its own address.

## 2. Principles

1. Offline-first and mobile-first. It must work on a low-end phone with a weak connection.
2. Static hosting only. No server, no database, no API keys. Any static host works (GitHub Pages, Codeberg Pages, GitLab Pages, a plain web server).
3. Open standards and open-source code only. No licensed, paid or key-gated APIs or SDKs. Section 2.1 sets the rules.
4. Nothing is lost or silently changed. Every addition, edit and removal is a new signed version. Old versions are kept.
5. Plain honesty. The app says what was verified and what was only declared.
6. Personal data stays on the user's own device. The public directory holds no customer or courier data.

## 2.1 Dependencies and licensing rules

- No licensed, paid, key-gated or account-gated API or SDK anywhere in the app or its tools. This covers map, geocoding, translation, messaging-platform, analytics, error-tracking and payment APIs.
- Allowed building blocks: web platform standards (HTML, CSS, JavaScript, service workers, IndexedDB, Web Crypto, the Geolocation API), plain files, and open-source libraries.
- Every library is open source under a licence compatible with the app's own licence. It is copied (vendored) into the repo at a pinned version with its licence file. No CDN loading and no package fetched at run time.
- Candidate libraries, all UNVERIFIED for current maintenance and licence: Leaflet or MapLibre GL JS for the owner's map tool; PMTiles for map tiles; an open signature library such as TweetNaCl or noble-ed25519 if the browser's built-in Web Crypto does not support Ed25519 on the target phones.
- Map data comes from OpenStreetMap (ODbL), with attribution. No Google, Apple or Mapbox maps, tiles or links. No heavy use of the main OpenStreetMap tile servers. Tiles come from a Chittagong extract served from the project's own static hosting. UNVERIFIED: the size of the extract, and whether the chosen host supports the range requests PMTiles needs.
- System fonts only. No analytics, no tracking, no third-party scripts.
- The app calls no translation service. Users translate with their own browser.
- Hosting is plain file serving on any static host. Hosts that run open-source software (Codeberg, or a self-hosted server) are preferred. No host-specific API is used.
- Messaging channels: SMS (an open standard) and phone calls are the baseline and need no company's platform. WhatsApp, Messenger and Telegram are proprietary or partly proprietary services. The app uses only their public chat links, which need no key, licence or SDK, and it sends nothing to them itself. They are optional, listed only if a restaurant chooses, and labelled "not open source" in the app. They can be removed without changing anything else if a stricter rule is wanted. Open options include email and Matrix (UNVERIFIED: check link behaviour).
- Browser location: the app uses the browser's standard Geolocation API. With GPS this reads the phone locally. How a browser finds a location without GPS is up to the browser and may involve its vendor's services. The neighbourhood picker avoids this entirely.
- Every dependency is recorded in `DEPENDENCIES.md` (name, version, licence, source address, date reviewed). Each change is a recorded commit.
- Nothing in this section has been checked against current licences. Check each one when it is added.

## 3. Language

The app is English only. Text must be real text (not images) so browser translation works. Rules:

- Set `lang="en"` on the page.
- Do not block translation, except for codes and IDs.
- Use short, plain sentences. Avoid idioms and slang.
- Pair key actions with icons.
- Keep every user-facing string in one file so it is easy to review.

## 3.1 Theme: one fixed look

The app has one fixed theme. Nobody designs screens. Restaurants and customers supply data and make choices. They never style anything.

### Base

- **Beer CSS 5.0.3** (MIT), a Material Design 3 framework with no build step. The minified file is copied into `theme/` at a pinned version with its licence file, and nothing is loaded from a CDN. The four Material Symbols `@font-face` rules that point to a CDN were removed from the copy.
- Beer CSS draws checkboxes, radio buttons and switches with a 2 KB Material Symbols subset font, shipped in its package and copied into `theme/` (Apache License 2.0). This is the only font file. Text uses the phone's system font.
- Every other icon is an inline SVG outline from Material Symbols (`@material-symbols/svg-400` 0.47.5, Apache License 2.0), stored in `app.js`.
- Beer CSS makes wide use of `:is()` and some `:has()`. Phone browsers released before 2023 may drop those rules. This must be tested on real low-end phones (see the checklist).

### Rules

The full rules, with the allowed classes, are in `theme/UNIFORMITY.md`. In short:

1. One layout for every screen: a top bar with the brand mark, a single content column no wider than 45rem, the footer credit, and the navigation (a bottom bar on phones, a side rail on wider screens) with four destinations: Restaurants, Basket, Orders and About.
2. One type scale with four levels (page title, section title, group title, card title), set once in `theme.css`. Pages never set font sizes.
3. One spacing grid in steps of 0.5rem. Pages never use Beer CSS margin helpers (see `theme/UNIFORMITY.md` for the reason) or inline styles.
4. One colour scheme in Material 3 roles, generated from the seed colour #9a3412. Light and dark follow the phone's setting by default; a toggle in the top bar switches between following the phone, light and dark, and the choice is kept on the device.
5. Only the components listed in `theme/UNIFORMITY.md` are used: cards, lists, chips, buttons, text fields, selects, radio buttons, checkboxes, switches, the snackbar and the dialog.
6. A short, fixed list of screen types: restaurant list, restaurant page, basket and checkout, orders and complaint summary, settings, about, terms of use, and the business tools (start, new listing, claim a listing, confirm an order, update prices, your own website) (start, list or claim, confirm an order, update prices). The courier card comes later. New screen types need a recorded decision.
7. Menu files carry data only. The app shows every value from a menu file as plain text. It never renders HTML, CSS or scripts from a menu file, and ignores them if present.
8. Every change to the theme is a recorded commit.

### Checklist before the theme is called verified

Record the result of each item, with the date, device and browser, in `THEME-CHECKS.md`.

- Works with no network after the first visit.
- Readable and usable on a low-end Android phone with a small screen, and on an older Android browser.
- Text contrast meets WCAG 2.2 level AA.
- Tap targets are at least 40 by 40 pixels (WCAG 2.2 level AA requires 24 by 24).
- Works at 200 percent text size without hidden or overlapping text and without sideways scrolling.
- Usable with a screen reader and with a keyboard alone.
- Works with the browser's own translation turned on.
- Page weight stays small (the budget is set once the first screens are stable).

`THEME-CHECKS.md` records what has been checked in a desktop browser so far. Nothing has been checked on a real phone. Until it has, the theme is "chosen", not "verified".

## 4. Directory network

- Each deployment publishes `index.json` (restaurants in Chittagong, split by zone if it grows large) and `peers.json` (other indexes, on any host).
- The client starts from the copy the user opened, fetches peers up to a depth limit, caches results and shows every reachable listing. Each listing shows which index it came from.
- Anyone can add a peer by pull request. Users can block a peer.
- Fetch peers lazily and by area to keep load small on weak phones.

### 4.1 Restaurant identity and duplicates

- Each restaurant has a public key. Its ID is the hash of that key.
- The same ID in two indexes is the same restaurant.
- The owner signs each menu version. The client keeps the highest version with a valid signature and discards copies with invalid signatures.
- If two different menus claim the same version, show the owner-signed one and flag the conflict.
- A volunteer may enter a listing before the owner has a key. This is an **unclaimed listing**:
  - `claimed` is `false`, there is no signature, and the pledges are unsigned. Only the owner can sign them.
  - Its ID is the SHA-256 of the lowercase name, a vertical bar, and the business phone (name in lowercase, then the phone number in the +880 form). The area is left out on purpose, so it can be corrected later without changing the ID.
  - It must carry a `listing_note` that says who entered it, from what source, and that the restaurant has not confirmed it. The app shows this note on the listing and on checkout.
  - Fees, minimum order, delivery time and opening hours may be `null`, shown as "not stated". The app never guesses them.
  - It is never shown with the courier-verified badge.
  - Prices follow the same safeguards as any other listing (section 5.4).
- **Claiming a listing** (full rules in `CLAIMS.md`):
  1. The owner uses the business tools page (`business.html`, "List or claim"). One form covers the business details, zone, hours, delivery areas and fees, pickup, ways to pay at delivery, the menu, and the three pledges.
  2. The owner must have an account on GitHub or another open forge (Codeberg, GitLab, a self-hosted Forgejo or Gitea) and a public repository for the menu file. That account is how the business updates its listing from then on, so only the business can change it.
  3. The page creates an Ed25519 key on the owner's device (Web Crypto API) and signs the menu. The private key file stays with the owner. The listing ID is the SHA-256 of the public key.
  4. The page prepares a verification request with a claim code and opens it as a GitHub issue (or the owner copies it to a volunteer or a mirror). The request holds no private information.
  5. Two community vouchers check the claim independently (section 4.2 and `CLAIMS.md`). When both confirm, a maintainer adds the listing to `index.json` and records the claim in `claims/<id>.json`.
- A claimed listing's first version has `replaces` set to the unclaimed listing's ID and `replaces_hash` set to the hash of its last menu file. Every price and fee that differs from the unclaimed listing is announced, and the price history is carried over. The unclaimed folder is kept; it is removed from `index.json` only.
- A claimed menu carries `owner` (account, menu_source, public_key) and a `signature` over its canonical form (keys sorted, no spaces, without the `signature` key). `tools/hana_sign.py` and `tools/check.py` check it.
- **Regular review:** the community reviews every claimed listing at least every 180 days (`rules.json`), and at once after any report of prepayment, hidden charges or a fake listing. Each review is appended to the claim record; `index.json` carries the date of the latest one, and the app shows it.
- Near-duplicates with different IDs are shown as "possible duplicate". Only a vouched member's signed merge note resolves them. Nothing merges silently.
- Key rotation: the old key signs the new key. If the old key is lost, vouched members can sign a recovery.

### 4.2 Vouching and community verification

The full rules are in `CLAIMS.md`. In short:

- A claim is approved only when **two vouchers**, working separately, confirm it. Vouchers are listed in `vouchers.json`; a voucher must not be the owner, a relative or an employee of the business, and must declare any other connection.
- Each voucher checks that the business controls its phone (they call the number found from an independent source, such as the shop sign or an existing public page, and hear the claim code), that the business exists at the stated address, that the forge account and repository belong to the business, that the menu file's hash and signature match, and that the listing follows the rules (prices include every charge, fees within the limit, no prepayment).
- Vouchers never ask for or record payment, NID numbers, trade licence numbers or other private documents. They may look at a document in person but do not copy it.
- The community reviews every claimed listing at least every 180 days, and at once after any report of prepayment, hidden charges, a fake listing or a false pledge. A failed review, or a confirmed request for prepayment, removes the listing from `index.json` with a recorded reason; the files and history stay.
- Unclaimed listings are labelled "not yet confirmed by the business" until claimed.

## 5. Menu file

Menus are identified by their content hash. The index entry carries the hash and a list of locations (any host). The client accepts a file only if its hash matches.

Fast-changing data such as "sold out" is not stored in the menu file. The restaurant tells customers in the order chat.

```json
{
  "id": "<hash of public key, or the temporary id of an unclaimed listing>",
  "claimed": true,
  "replaces": "<temporary id, only on the first claimed version>",
  "version": 12,
  "previous": "<SHA-256 of version 11>",
  "name": "...",
  "kind": "Restaurant",
  "neighbourhood": "<area id from areas.json: the city, a Station or a ward>",
  "address": "...",
  "plus_code": "7MJH9R66+7MF",
  "location": {"lat": 0.0, "lon": 0.0},
  "business_phone": "+8801XXXXXXXXX",
  "listing_note": "Only on an unclaimed listing: who entered it, from what, not confirmed by the restaurant.",
  "hours": {
    "mon": [["11:00", "23:00"]],
    "tue": [["19:00", "04:00"]],
    "wed": [], "thu": [], "fri": [], "sat": [], "sun": []
  },
  "delivery": {
    "zones": [
      {"id": "khulshi", "shape": "named", "areas": ["<id>", "<id>"], "fee": 60, "min_order": 300, "eta_min": 40},
      {"id": "near", "shape": "circle", "lat": 0.0, "lon": 0.0, "radius_m": 2000, "fee": 40, "min_order": 200, "eta_min": 25},
      {"id": "wide", "shape": "polygon", "geojson": {"type": "Polygon", "coordinates": []}, "fee": 80, "min_order": 400, "eta_min": 50}
    ]
  },
  "contact": [
    {"app": "whatsapp", "id": "8801XXXXXXXXX", "preferred": true},
    {"app": "sms", "id": "8801XXXXXXXXX"},
    {"app": "telegram", "id": "username"},
    {"app": "messenger", "id": "pagename"},
    {"app": "phone", "id": "8801XXXXXXXXX"}
  ],
  "links": {"osm": "https://www.openstreetmap.org/...", "geo": "geo:0.0,0.0", "other": ["..."]},
  "photos": [
    {"alt": "Front of the shop", "sources": ["https://..."], "sha256": "<64 hex>", "width": 1200, "height": 800, "bytes": 150000}
  ],
  "pledges": {
    "rider_identity": {"signed": true, "date": "YYYY-MM-DD"},
    "data_handling": {"signed": true, "date": "YYYY-MM-DD"}
  },
  "items": [
    {"id": "singara", "name": "Singara", "section": "Snacks", "category": "Snacks",
     "description": "optional plain text", "price": 220},
    {"id": "margherita", "name": "Margherita Pizza", "options": [
      {"id": "9-inch", "label": "9 inch", "price": 500},
      {"id": "12-inch", "label": "12 inch", "price": 600}],
     "photos": []}
  ],
  "announcement": {
    "published": "2026-10-15T09:00:00+06:00",
    "summary": "Plain-text reason or note from the owner.",
    "changes": [
      {"key": "item:singara", "label": "Singara", "old": 10, "new": 12}
    ]
  },
  "price_history": [
    {"version": 12, "published": "2026-10-15T09:00:00+06:00", "summary": "...",
     "changes": [{"key": "item:singara", "label": "Singara", "old": 10, "new": 12}]}
  ],
  "signature": "..."
}
```

Rules:

- `business_phone` is required. A listing without it is not published.
- Money is always **whole taka**, written as an integer. No decimals, no text, no currency symbols in the data.
- Every item, option and delivery zone has a stable `id` (lowercase letters, digits and hyphens). An item has either a `price` or two or more `options`, never both. The ID never changes, even if the name does, so price history can follow the item.
- `section`, `category`, `description` and `kind` are optional plain text.
- `plus_code` is an Open Location Code (an open standard). Store the full code, not the short form. The check tool decodes it and confirms it matches `location` to within about 60 metres.
- Opening hours that cross midnight are written with the end earlier than the start: `["19:00", "04:00"]` means 7 p.m. to 4 a.m. the next morning, and belongs to the day it starts.
- A `locations` entry in the index that is a plain path (no `https://`) is relative to the address the index was loaded from. This is how a menu hosted in the same repo or site is found on any mirror.
- Photos follow section 5.3.
- Every change is a new version that points to the previous one.
- The menu hash is SHA-256, written as 64 lowercase hex characters, over the exact bytes of the menu file. Do not reformat a file after hashing it.
- `hours` are in Asia/Dhaka time. An empty list means closed that day. Times are the restaurant's declared hours, not a guarantee.

## 5.1 Delivery zones and suggesting restaurants

### Zone shapes

A restaurant draws its delivery perimeter in its menu file. Each zone has a shape plus its own fee, minimum order and estimated time. Three shapes are allowed, so owners can choose by skill:

1. **named:** a list of area IDs from `areas.json`. Easiest for owners, and no map drawing is needed. A named zone also covers every area inside it (see `part_of` below).
2. **circle:** a centre point and a radius in metres. Quick, but rough.
3. **polygon:** a GeoJSON Polygon. Most accurate. Preferred where the road network or the river makes a circle wrong.

Rules:

- Coordinates use WGS 84 (latitude and longitude). GeoJSON (RFC 7946) stores each point as longitude first, then latitude. The spec and the tools must keep that order straight.
- If a customer's point falls in more than one zone, the client uses the first matching zone in the order listed. The owner controls the order.
- A restaurant with no `delivery` block is shown as "delivery area not stated" and is never suggested as delivering to the customer.

### Areas: the city, zones and wards

The city is the Chittagong City Corporation (CCC). It is divided into **zones**, which are the police station areas (thanas), and 41 wards. In the app and the files, zones are named without a suffix: "Khulshi", not "Khulshi Station".

- **Businesses** choose where they deliver: the whole city (`ccc`), which covers every zone, or a list of zones. They cannot choose wards. Each delivery area has one fee, minimum order and time. A typical set-up is the business's own zone with one fee and the whole city with a flat fee for every other zone; the first matching area in the list wins. Businesses can also set a fee for each zone. Fees can be changed at any time with a new menu version, which is announced automatically (section 5.4).
- **Customers** choose their zone, never "anywhere in the city", because the whole city is a delivery area, not a place to deliver to. At checkout they may also choose their ward, from the wards in that zone. The ward is optional and only added to the order message.

### `areas.json`

One shared file with three levels: the city (`ccc`), 15 zones (`khulshi`, for example), and 41 wards (`ward-14`, for example). Each area has an ID, a `kind` (city, zone or ward), an English name, a `source` and, once one exists, a boundary (GeoJSON). Each zone is `part_of` the city and each ward is `part_of` one or more zones. `tools/check.py` enforces the levels.

The ward list and the ward-to-zone assignments come from the English Wikipedia article on the City Corporation, read on October 15, 2026. That article predates the Sadarghat and EPZ thanas, so some assignments may be out of date. UNVERIFIED against Chittagong Metropolitan Police and City Corporation records. Karnaphuli thana lies outside the City Corporation and is not listed. No area has a boundary yet, so matching is by name.

### How the customer is placed

All matching runs on the customer's phone. The customer's location is never sent anywhere and is never part of any file.

1. **Use my location:** the browser asks permission and reads the device position. The point-in-zone check runs locally.
2. **Pick my zone:** a zone (thana) from `areas.json`, and optionally a ward at checkout. Works without location permission or mobile data.
3. **Saved home area:** optional, stored on the device only.

### What the customer sees

- Restaurants that deliver to the customer's point, in **alphabetical order by name** (A to Z, ignoring case and accents). The order is the same for every customer and every visit. Nothing is featured, pinned, promoted or boosted, and there is no "recommended" or "popular" section. Open now, fee and time are shown on each card as information. They never change the order.
- Show the fee, minimum order and time for the matching zone. A value the restaurant has not stated shows as "not stated".
- Restaurants that do not deliver there are hidden by default, with a "show restaurants that do not deliver here" switch. They appear greyed out with the reason, still in alphabetical order.
- Zones are labelled "delivery area declared by the restaurant". The restaurant can still decline an order, and the customer can still ask.

### Search

- One search box finds restaurants and dishes. It runs on the device, offline, with no search library and no network call.
- It is **fuzzy**: it ignores case, accents and punctuation, forgives a missing, extra, swapped or wrong letter (so "biriyani", "briyani" and "biryani" all find Biryani), and matches the start of a word, any word in a name, and the restaurant's section and category names. Method: normalize the text, split into words, accept a word when it is a prefix match or within a small edit distance (none for words of 1 or 2 letters, 1 for 3 to 7 letters, 2 for longer ones; swapping two neighbouring letters counts as one edit). The reference code goes in `tools/` with test cases, so every client behaves the same.
- Results stay in **alphabetical order**. Matching never ranks one restaurant above another. A dish result shows its restaurant's name and opens that restaurant's page. Restaurants with a matching dish are listed A to Z, with the matching dishes under each name.
- Search only filters what the customer's area already allows, unless the "show restaurants that do not deliver here" switch is on.

### Why zones, not straight-line distance

Straight-line distance misleads in Chittagong. Hills and the Karnaphuli river can make a nearby point a long trip. Zones drawn by the restaurant reflect where its couriers actually go. Do not rank by straight-line distance alone.

### Owner tooling

Owners are not expected to write coordinates by hand. Provide a small standalone web page for owners:

- Pick named areas from a list, or draw a circle or polygon on a map.
- It outputs a ready-made `delivery` block to paste into the menu file.
- The map uses an open-source library and OpenStreetMap-based tiles served from the project's own hosting (section 2.1). The map is only for this owner tool. The customer app needs no map.

### Abuse and honesty

- A restaurant could claim the whole city to appear in every search. Mitigations: the vouching check includes a look at the claimed zones, an "oversized zone" warning for polygons covering a very large share of the city, and a customer button "This restaurant did not deliver to my area" that records the report on the device and shows the routes in section 9.
- The app does not verify that a restaurant really delivers where it says. It states this plainly.

## 5.2 Onboarding

The app does not scrape. It fetches the exact file addresses listed in the index and accepts a file only if its hash and signature match.

### Customers: no sign-up

- No account, no email, no password.
- Open the page, then either allow location or pick their area. The restaurant list appears. That is three taps or fewer.
- A short privacy screen is shown once, before the first order (section 8). It can be skipped, and defaults are the most private working option.
- After the first order, offer "Add to home screen" and a reminder to export orders. Nothing else is asked.

### Businesses: one guided page

A single offline-capable page, "Add my restaurant". Progress saves on the device after every step, so an owner can stop and come back.

1. Basics: name, zone, address, business phone, hours.
2. Contact channels: tick the apps the restaurant uses, enter each ID, mark the preferred one.
3. Delivery zones: pick named areas, or draw a circle or polygon (section 5.1).
4. Menu items: name, price, short description, optional photo (compressed automatically).
5. Pledges: read the two pledges in section 7 and tick to sign.
6. Restaurant key: created in the browser. The owner saves one key file. The private key never leaves the device. The page warns that losing the file means losing control of the listing, and asks the owner to keep a backup copy.
7. The page produces a signed `menu.json`. The owner downloads it.
8. Choose where to put the file (below).
9. Check my link (below).
10. Submit to the directory (below).

A "Help me" path lets a volunteer do steps 1 to 10 with the owner, or for the owner. The owner's key still signs the file, so a volunteer cannot change it unnoticed.

### Where a business can put its file

The page shows these options with short plain steps for each. A business can use more than one, and listing in several places is recommended so one host going down does not remove the listing.

| Option | Skill needed | Notes |
|---|---|---|
| A local volunteer hosts it in the directory's own repo | None | Easiest. The file is signed by the owner, so the volunteer cannot alter it unnoticed. |
| GitHub Pages | Some | Free. Needs an account. |
| Codeberg Pages | Some | Free, nonprofit host. Needs an account. |
| GitLab Pages | Some | Free. Needs an account. |
| The restaurant's own website or web hosting | Some | Upload the file to any public address. |
| Proprietary file-sharing services (Google Drive, Dropbox and similar) | Not offered | Not used. They are not open, and their links can break or block the app from reading the file. |
| Facebook page | None | Cannot hold the file. Add the page as a link in the listing only. |

Hosts that run open-source software (Codeberg, or a self-hosted server) are shown first. GitHub is a proprietary service. It is listed because many owners already use it, and only plain file serving is used, never its API.

The host must let a web page read the file from another website (a setting called CORS). UNVERIFIED: GitHub Pages is expected to allow this, and Codeberg and GitLab Pages need testing. The "Check my link" step is what decides, not this table.

### Check my link

The owner pastes the file address. The page checks, and reports each result in plain words:

- The address can be reached.
- The host allows the app to read it.
- The file is valid and has all required fields (business phone, hours, delivery zones, pledges).
- The hash and signature match the owner's key.
- Photos are small enough.

If a check fails, the page says what to change.

### Submit to the directory

No account is needed for the simplest route:

- **Message a volunteer:** the page builds a ready message with the file address, the hash and the restaurant name, and opens it in WhatsApp or SMS. A vouched volunteer adds it to the index after vouching (section 4.2).
- **Pull request:** for owners who use GitHub, the page links to the directory repo with the index entry prefilled.

Until a volunteer has vouched, the listing appears as unverified.

## 5.3 Photos

Photos are optional. The app stores links, not images.

- A restaurant may link photos hosted anywhere over https, including free image hosts such as ImgBB. UNVERIFIED: check each host's terms, how long it keeps images, and whether its direct links work without ads, blocking or login. Link to the image file itself, not to a web page that shows it.
- Each photo has: `alt` (a plain description, required), `sources` (one or more https addresses of the same file, so a second host can back up the first), `sha256` (hash of the exact image bytes), `width`, `height` and `bytes`.
- Limits (proposed): JPEG, WebP or PNG; no more than 1,600 pixels on the long side, no larger than 300 KB and no more than 12 photos per restaurant. `tools/check.py` enforces the declared values.
- Photos show food, the premises or the menu. Not customers or couriers. Do not use pictures copied from another business or site unless the owner has the right to use them (UNVERIFIED: get a legal view).

**The hash is the safeguard.** The app shows a photo only after it has fetched it, and found that the size and SHA-256 match the menu. A host cannot swap in a different picture, and a mirror can serve the same file. `tools/verify_images.py` fetches every source and reports which still work. If a host does not let the app read the file (CORS), the hash cannot be checked. The app then shows a placeholder, and the customer can tap to load the photo unverified, after a warning.

**Privacy.** Loading an image from a third-party host tells that host the customer's network address, device type and the time. So:

- Photos are not loaded until the customer taps "Show photos" for that restaurant. The default is off.
- Once a photo is loaded and verified it is saved on the phone and is not requested again. Saved photos work offline.
- The owner tool tells owners that the photo host sees their customers' requests, and lists hosts that run open-source software first.

## 5.4 Prices and the safeguards against tampering

A price is a price only if it comes from a signed, public menu version. Every change to an amount of money that a customer relies on is announced inside the file, by an automatic step the owner cannot skip.

**Money fields covered:** every item price and option price, every zone's delivery fee, and every zone's minimum order.

### Business end

1. **Whole taka only.** Integers, no decimals.
2. **Versions are kept and chained.** Every version is a file (`menus/<id>/versions/<N>.json`). Each carries `previous`, the SHA-256 of the file before it. `menu.json` is always byte-for-byte the latest version. Nothing is overwritten.
3. **Automatic announcement.** When an owner saves a new version, the owner tool compares it with the previous version and writes `announcement.changes` itself: for each changed amount, the key, the label, the old value and the new value. Items and options that are added or removed appear too (old or new is `null`). The owner can add a plain-text note (`announcement.summary`) and a publication time, and cannot delete or edit the generated list.
4. **Append-only price history.** Each version carries `price_history`, which is the earlier history plus this version's announced changes. Earlier entries cannot be edited or removed.
5. **Checked on every pull request.** `tools/check.py` recomputes the difference between each version and the one before it. It rejects: a changed amount that was not announced, an announcement listing a change that did not happen, a history that was edited, a broken hash chain, and a `menu.json` that is not the latest version.
6. **Hosts and mirrors cannot change prices.** The index holds the menu hash, so any altered copy is rejected. The owner's signature (not yet verified by the tools) adds a second lock.
7. **Customers see it.** Each restaurant page shows "Prices last changed on <date>" and a short list of recent changes from `price_history`.

### Customer end

1. **Only signed, hash-matched prices are shown.** The app takes prices from a menu whose hash matches the index. It never lets a price be typed or edited. Totals are always worked out on the phone from those prices.
2. **Rollback protection.** The phone remembers the highest version it has seen for each restaurant and rejects an older one. A mirror cannot serve an old menu to trick a customer.
3. **Version shown at checkout.** Checkout shows "Prices from version 3, published 15 Oct 2026", and warns if a newer version has appeared since the customer opened the menu.
4. **The customer keeps proof.** With each order the phone saves the exact signed menu file (a few kilobytes) that the order was priced from. It is the restaurant's own published, signed price, and it goes into the complaint export (section 9.1).
5. **Order check line.** Every order message ends with a check line (section 6.4). The restaurant's tool decodes it and works out the items and prices again from the restaurant's own signed menu, ignoring any total the customer typed.

### What this does not stop

- A restaurant can still raise prices. The safeguards make every change public, dated and kept. They do not make it impossible.
- The price asked at the door can still differ from the order. The customer then has the signed menu and the order message, and the complaint route in section 9.
- The check code is not secret. Someone who edits an order and recomputes the code gets a valid line, but the restaurant's tool still prices the items from the signed menu. The restaurant must read the decoded view, not the typed text.
- WhatsApp and SMS messages are not signed by Hana.
- A modified or malicious copy of the app could misbehave. Use the official app or one you trust. Anyone can compare it with the source.
- Signature verification is not built yet, so for now these safeguards rest on hashes and on `tools/check.py`.

Proposed, not built: a minimum notice period before a price increase takes effect (for example 24 hours; decreases immediately). It needs a decision (open items).

## 6. Ordering

### 6.1 Flow

1. The customer builds an order from **one restaurant's** menu. An order is for one restaurant at a time. If the customer adds a dish from a second restaurant, the app asks whether to empty the basket and start a new order there. It never mixes restaurants in one order.
2. At checkout the customer chooses **delivery** or **pickup**. Pickup is offered unless the menu says `"pickup": false`; it has no delivery fee. For delivery, the customer chooses their zone and, optionally, their ward.
3. The customer picks a channel. An order is written, so checkout offers WhatsApp, text message and other written channels only; a business phone number is offered as a text message, never as a call.
4. The delivery charge is the one fee the business set for the matching area (section 5.1). The app shows it as its own line and adds nothing. If the business has not stated a fee, checkout says so and does not guess.
5. Checkout states the rules: all prices include every charge, payment is on delivery or at pickup only, and the customer must never pay in advance.
6. The client builds a polite order message in this order: a greeting naming the business ("Hello, I'd like to order from <business>."), the items with quantities and prices, the subtotal, delivery charge and total where known, a request to confirm whatever is not known ("Could you please confirm the item prices, the delivery charge to <zone> and the total amount?"), name, mobile number, delivery address or pickup, time, note, the payment terms ("I'll pay by cash on delivery. No advance payment, please.") and "Thank you!". For claimed listings it also carries the confirmation request ("To confirm, please reply: CONFIRMED <code>") and, last, the order reference with the check line (section 6.4). The customer presses send in their own app. There is no courier slip; the business sends courier details when it confirms (section 7.3).
7. **Volunteer-entered (unclaimed) listings** skip the protocol: no code, no check line, no confirmation window and no automatic cancellation. The message also asks the business to confirm prices and the delivery charge, since volunteer data may be out of date. The customer and the business arrange the order in their chat, and the customer notes the outcome in the app ("The business confirmed", recorded as an unsigned confirmation, or "Cancel the order").
7. The client saves the order on the device as **waiting for confirmation**, with a timestamp and the signed menu file it was priced from.

### 6.2 Link formats

Plain links, no API:

- WhatsApp: `https://wa.me/<number>?text=<encoded text>`
- SMS: `sms:<number>?body=<encoded text>` (iOS and Android differ slightly: test both)
- Phone: `tel:<number>`
- Messenger: `https://m.me/<pagename>`
- Telegram: `https://t.me/<username>`

Messenger and Telegram links may not accept pre-filled text (UNVERIFIED). For these, the client copies the text to the clipboard and tells the customer to paste it.

### 6.2a Other channels (optional for businesses)

WhatsApp and text messages are enough for most businesses. A business that already uses other channels may add them to its listing; nothing pushes businesses towards them:

- **Email** (`mailto:` with the order filled in) and **XMPP** (`xmpp:` with the message body filled in).
- **Matrix**, **Signal**, **Telegram** and **Messenger**: these links cannot carry a prepared message, so the app copies the order and the customer pastes it.
- **Order endpoint**: an https address that accepts the order as plain text by POST and allows requests from the Hana site (CORS). The app sends the order directly, without opening another app. A self-hosted ntfy topic is one free, open-source option. A plain-text POST needs no special server set-up. The order still needs the business's confirmation within 15 minutes.

### 6.3 Order status

An order is **waiting for confirmation** until the customer pastes the business's reply (section 6.5). It then becomes **confirmed** or **declined**. With no confirmation within 15 minutes it is **cancelled automatically**. The customer can also cancel while waiting. Only confirmed orders can produce a complaint summary.

### 6.4 Order check line

The last line of the kitchen block:

```
CHECK hana1 H=<first 12 hex of the menu hash> Z=<zone id> I=<items> S=<subtotal> F=<fee or ?> C=<code>
```

- `I` is `item-id[.option-id]*quantity`, comma separated and sorted, for example `dahi-bara*2,kulcha*1`. Quantity is a whole number from 1 to 99.
- `S` is the items subtotal in whole taka. `F` is the zone's delivery fee in whole taka, or `?` if the restaurant has not stated it.
- `C` is the first 8 characters of the Crockford base32 of SHA-256 over `hana1|<full menu hash>|<zone id>|<items>|<S>|<F>`.
- The restaurant's tool decodes the line, finds the menu version by its hash, prices every item from the signed menu, and flags: a subtotal or fee that does not match, a code that does not match (the line was edited or mistyped), an unknown item or zone, and an order made on an older version (with the price differences to compare).
- `tools/order_line.py` is the reference implementation, with tests in `tools/selftest.py`. The app must produce exactly this format.

Limits are in section 5.4.

### 6.5 Business confirmation

An order is valid only when the business confirms it within **15 minutes** (`confirmation_window_minutes` in `rules.json`). This protects both sides: an order that was never sent cannot be confirmed, only confirmed orders produce a complaint summary, and a customer is never left waiting on an order nobody answered.

- The business replies in the same chat. With the business tools page ("Confirm an order"), it pastes the customer's message; the page re-prices it from the published menu, flags any mismatch, and prepares the reply:
  `CONFIRMED hana1 O=<order code> C=<check code> E=<minutes> T=<time> K=<key id> S=<signature>`
  T is the confirmation time in whole minutes since 1970 (UTC). S is an Ed25519 signature by the business's key over `hana1-confirm|<check line>|<order code>|<E>|<T>`.
- The business can also decline: `DECLINED <order code>`.
- The customer pastes the reply into the order on the Orders page. The app checks the signature against the public key in the saved menu file (Web Crypto API) and that T falls within the window after the order was prepared.
- An unclaimed listing has no key. Its confirmation is the plain reply "CONFIRMED <order code>", accepted only within the window and marked **confirmed by message (not signed)**. A claimed listing must sign: the app refuses an unsigned confirmation for it.
- **Automatic cancellation:** an order with no confirmation 15 minutes after it was prepared is marked **cancelled automatically**. The customer does nothing. If a signed confirmation dated inside the window is pasted later, the order is restored to confirmed. Cancelled, declined and expired records are removed after 24 hours. Every change is written to the activity record on the phone.
- While waiting, the customer can send a reminder through the same channel, or cancel.
- The app cannot see the customer's chats, so it cannot learn of a confirmation by itself; pasting the reply is the one step the customer takes. A business with an order endpoint (section 6.2) still confirms in a chat or by its own reply channel.
- `tools/order_line.py` builds and checks confirmation lines in the same format, for vouchers, authorities and tests.

What this does not stop: a customer can still forge an unsigned confirmation for an unclaimed listing, and nothing stops a business from confirming and then not delivering. Signed confirmations, the chat history and the public complaint bodies cover those cases.

### 6.6 Keeping records

Businesses keep all communications about orders placed through Hana (order messages, confirmations, courier details and payment records) for at least six months from the order date, and for at least twelve months when a complaint or dispute has been raised or is reasonably anticipated. Customers are encouraged to do the same; the app keeps confirmed orders and a downloadable record. Deleting, unsending or altering material communications may lead the deciding authority to draw an adverse inference against the party responsible. This is a suggested rule; decisions rest with the competent authorities under the law of Bangladesh (`TERMS.md`, section 6). The fourth pledge (section 7.4) commits claimed businesses to it.

## 7. Couriers and the restaurant pledge

Each restaurant uses its own couriers. Courier reputation is the restaurant's reputation.

### 7.1 Courier identity pledge

A restaurant must sign this to be listed with the "courier-verified" badge:

> I confirm that every courier who delivers for this business uses a mobile number registered in their own name under their own NID. I have checked this myself. I will not use a number registered to another person. I keep my own records of these checks. I understand that a false pledge can lead to removal from this directory.

Notes:

- The app never stores or transmits NID numbers or copies.
- How to check: a courier's SIM registration is tied to their NID. The restaurant checks the registration with the courier and, where available, through the operator. UNVERIFIED: confirm the current official way to check numbers registered against an NID, and write the exact steps into this section before launch.
- This is a declaration, not verification. The app must say so.

### 7.2 Data handling pledge

> I will give couriers only what they need to deliver: the customer's first name or nickname, the address or landmark, the order code and the amount to collect. I will not share a customer's phone number or order history with couriers or anyone else. I will delete customer details when they are no longer needed.

### 7.3 Fair pricing pledge

> Every price I list includes VAT and every other charge. The delivery fee is the only addition, and it never exceeds the Hana limit. I take payment only on delivery or at pickup, and I will never ask a customer to pay in advance.

### 7.4 Record-keeping pledge

> I will confirm or decline every order within 15 minutes. I will keep all communications about orders placed through Hana for at least six months, and for at least twelve months when there is a complaint or dispute, and I will not delete, unsend or alter them.

### 7.5 Courier card

The business sends a courier card in the order chat when it confirms the order, or before delivery: courier name, courier phone number, and optionally a photo or bike plate. The app does not prepare a slip for the courier.

Client behaviour:

- The customer saves the card against the order. It shows Call and "Courier arrived" actions.
- If no courier card is received, the order shows "No courier details yet. Ask the restaurant before delivery." and stays marked incomplete.
- The business phone number and the courier's number are always shown on the order screen and in the complaint export.
- The card is deleted from the phone one to two days after delivery, to protect the courier's privacy.
- Contact is one-way by default: the customer can contact the courier, and the courier has no need for the customer's number. If a courier cannot find the address, the courier calls the restaurant, which relays.
- At handover the customer shows the order code.
- Report button: "Courier number does not match." It records the report on the device and shows the police and consumer-rights routes (section 9).

### 7.6 Tracking

No live map. The courier may share live location in the order chat using the messaging app's own feature. Otherwise the restaurant sends plain status messages. A server relay is out of scope unless users ask for it.

## 8. Privacy education

Short plain-English screens, shown once per role and again at key moments (for example, before the first send). Defaults are the most private option that still works.

- **Customers:** who sees what. The restaurant sees your contact details and address. The courier sees your address and code. Each contact method reveals different things.
- **Restaurants:** what you receive, what a courier needs, what you must not keep or share, and the two pledges.
- **Couriers:** use details only for the delivery and delete them after.

Contact setting, saved on the device: phone number, username, or call-only through the restaurant. The client builds the message with only the chosen detail and warns when a choice reveals a lot.

Channel labels (keep short; UNVERIFIED, check each platform's current features before publishing):

- SMS: the carrier can read it.
- WhatsApp: message content is encrypted, but the company can see who messages whom and when. Usernames are being introduced (UNVERIFIED: check availability).
- Telegram and Signal: usernames are available. Check which chat types are end-to-end encrypted.

State plainly that the app cannot stop a restaurant or courier from misusing details they have already received.

## 9. Problems and where to take them

The app does not settle disputes. It tells the customer to contact the restaurant first, then shows where to go. It also shows a countdown from the date of the problem.

| Problem | Where it goes |
|---|---|
| Money, undelivered, wrong or overpriced order, refund refused | Directorate of National Consumer Rights Protection (DNCRP): hotline 16121, written complaint, or online through the MyGov portal |
| Theft, assault, threats, immediate danger | Police, 999 (UNVERIFIED) |
| Unsafe or contaminated food | Bangladesh Food Safety Authority (UNVERIFIED: confirm agency and process) |
| Violence against women or children | National helpline 109 (UNVERIFIED) |
| Online fraud or harassment | Police cyber unit (UNVERIFIED) |

Verified from published sources: complaints under the Consumer Rights Protection Act 2009 must be filed within 30 days of the cause arising, filing is free, and complaints can be made in writing, by hotline 16121, or through the MyGov portal. The Chittagong divisional office is at TCB Bhaban, Bandartila.

### 9.1 Complaint export

The client fills a complaint only from a **confirmed** order: complainant, seller, order ID and hash, date, items, prices, payment method, the business's confirmation (signed or not), the menu version ordered from (with the saved signed menu file and its price announcements attached), courier card, what went wrong, the date the problem arose, what the customer already tried, evidence list and remedy sought. It exports as a printable file and a plain text file. The customer must check it against the current official DNCRP form before filing.

## 10. Data on the device

- Orders, favourites and courier cards are stored locally (IndexedDB).
- Each order keeps the exact signed menu file it was priced from, so the customer has proof of the published price.
- The phone keeps the highest menu version seen for each restaurant (rollback protection, section 5.4) and any photos the customer chose to load.
- Browsers can clear storage. The Orders page offers one-tap download and restore (restore adds missing orders and never overwrites), and the app asks the browser to keep its storage (persistent storage).
- **Updates without clearing anything:** GitHub Pages lets browsers cache files for about 10 minutes and cannot be configured otherwise. The service worker therefore fetches every file with "no-cache" (the browser asks the server whether the file changed; an unchanged file costs a short 304 reply) and keeps the last copy only for offline use. The worker itself is registered with `updateViaCache: "none"` and checked on every visit. While a page stays open, it re-checks the code files whenever it comes back into view and reloads itself, unless the person is typing, in which case the new version loads next time.
- Updates replace only the app's code and design. Orders, the basket, saved details and the activity record live in the browser's local storage, which updates never touch.
- Load no third-party scripts, fonts or analytics.

## 11. Repository and contributions

The project lives in an open git repo that anyone can fork or mirror. Full rules are in `CONTRIBUTING.md` and `GOVERNANCE.md`.

- **Routes:** list a restaurant, update or remove a listing, report a wrong listing, vouch, fix an area, code, theme, docs, and phone test reports. Most routes need no GitHub account: an owner or volunteer can send the ready message from the onboarding page to a volunteer.
- **Forms:** issue forms for each route and a pull request template, in `.github/`. Forgejo-based hosts such as Codeberg may need these copied to their own template folder (UNVERIFIED).
- **Check:** `python3 tools/check.py` must pass on every pull request. It checks that data files are well-formed: the Chittagong spelling, hashes, https locations, menu fields, pledges, zone shapes, coordinate order, no HTML in menu text, and no fee or paid-placement fields. It also checks the price safeguards (whole-taka prices, stable ids, kept version files, hash chain, announced price changes matching the real changes, append-only price history), photo entries, `rules.json` (cash on delivery only, all-inclusive prices, the delivery fee limit), owner signatures on claimed listings, claim records and review dates, and the interface uniformity rules. `tools/selftest.py` proves the checker catches each of these.
- **People:** maintainers (code, spec, docs), vouchers (real-world checks of restaurants) and contributors. Starting numbers for approvals are proposed in `GOVERNANCE.md`.
- **Privacy:** no customer or courier data, no NID numbers and no screenshots with private details in issues, pull requests or files.
- **Records:** history is kept. A removal is a new commit with a reason.
- **Credit:** Hamid Yasir & Co. is credited as creator (`README.md`, `AUTHORS.md`, About screen). Contributors are credited through commit sign-offs.
- **Licence:** not chosen yet (open item 14).

## 12. Open items

1. Legal check for Bangladesh: any duty on a directory that requires pledges, handles courier details or lists businesses (e-commerce rules, data protection, food safety).
2. Confirm the official NID and SIM check process for restaurants.
3. Confirm each UNVERIFIED hotline, agency and messaging-app behaviour above.
4. Decide whether the voting and moderation layer discussed earlier stays, and if so, how it is kept separate from ordering.
5. A way for non-technical restaurant owners to produce a menu file (form that generates the file, or a volunteer).
6. Mirror plan so no single host can take the directory down.
7. Review `areas.json` for Chittagong (city, Stations and wards): spellings, boundaries, and who approves changes.
8. Choose a map source for the owner tool and confirm its usage and licence terms.
9. Decide the oversized-zone limit.
10. Test which free hosts allow the app to read files from another site (CORS), and update the hosting table.
11. Recruit and train the first local volunteers for the "Help me" path and for vouching.
12. Decide how an owner without a phone that can create and keep a key file is supported.
13. Decide whether proprietary chat apps (WhatsApp, Messenger, Telegram) stay as optional links or are removed (section 2.1).
14. ~~Choose the licence~~ Decided: MIT for the code and the directory data (`LICENSE`). Revisit only if a reason comes up.
15. Review every dependency against section 2.1 and record it in `DEPENDENCIES.md`.
16. Run the theme checklist (section 3.1) on real low-end Android phones, and fall back to a hand-written stylesheet if Beer CSS fails on them.
17. Choose the project colours and button size for `theme.css`, once.
18. Check the name "Hana" for conflicts with existing apps, businesses, domains and repository names, and choose the repo and any domain name.
19. Decide which repo is canonical, and who the first maintainers and vouchers are (fill in `VOLUNTEERS.md` and `vouchers.json`).
20. Choose the signature format and an open Ed25519 library, then add signature checks to `tools/check.py`.
21. Check whether the chosen hosts read issue and pull request templates from `.github/`, and copy them where they do not.
22. Decide the licence terms for credit, so the creator credit in section 1.4 has a legal basis in forks.
23. Decide the notice period before a price increase takes effect (proposed 24 hours, decreases immediately), and how clients show an upcoming change.
24. Check ImgBB and any other free image host the owner tool lists: terms, retention, direct-link behaviour, and whether the app can read files (CORS).
25. Build the restaurant's "Check an order" page on top of `tools/order_line.py` (offline, static).
26. List the first real businesses: enter them, confirm them with the owners, claim them with the owners' keys, and have the owners sign the pledges. (The first volunteer listings were withdrawn on October 16, 2026; see section 25.)
27. Draw boundaries for the city, the 15 zones and the 41 wards, from a source with a clear licence, and have two local reviewers confirm them. The OpenStreetMap lookup service blocked automated requests, so this needs a proper data download or manual drawing.
28. Confirm the ward-to-zone assignments in `areas.json` against Chittagong Metropolitan Police and City Corporation records, including the wards now in the Sadarghat and EPZ thanas.
29. ~~Decide what "whole Chittagong" means.~~ Decided: it means the Chittagong City Corporation area, which every listing covers by default.
30. Write and test the reference fuzzy-search code in `tools/` (section 5.1, Search).
31. Agree the delivery fee limit (proposed BDT 150 in `rules.json`) and review it yearly.
32. Test Ed25519 in the Web Crypto API on the phones customers and businesses use; older browsers cannot create keys or check signatures.
33. Decide how a business without a forge account is helped to create one (volunteers, a guide in Bengali-language community channels).

## 13. Settings, pictures, standalone copies, opening hours and regions

### 13.1 Settings (customers)

The top bar has a Settings button. Everything is kept on the device: colour scheme (Clay, Teal, Indigo, Green, Plum, High contrast; each checked for WCAG AA contrast by `tools/selftest.py`), light or dark, text size, whether to show pictures, an optional profile (name, address, usual zone) that fills in checkout, download, restore and delete of the person's data, an offline copy, and "Find the Hana for my area". A profile is never required; a customer can order without one.

### 13.2 Long lists

The restaurant list shows 12 listings per page and the Orders page 10 orders per page, with Previous and Next. A restaurant page has a row of section chips that jump to each menu section.

### 13.3 Pictures

- A listing may give a `cover` and each item an `image`: `{"src": "<https address>", "credit": "optional"}` on a host in `rules.json` `image_hosts` (Wikimedia Commons, GitHub, Codeberg, GitLab and ImgBB at first).
- A listing without a cover shows a fixed stock photo of plated restaurant food for its cuisine (`COVERS` in `core.js`, openly licensed files on Wikimedia Commons, credited with a link to the file page). The cuisine comes from the listing's `cuisine`, or else from its section and item names. Nothing is searched for, so no unrelated picture can appear.
- An item without its own picture shows a plain drawing of a covered dish. A picture appears only once the business supplies one.
- Pictures load only as they near the screen. If a picture fails, the drawing is shown instead.
- Safeguards: only https JPEG, PNG, WebP or AVIF files from the allowed hosts; shown with `<img>`, which never runs code; the page's Content Security Policy blocks every other image host; `tools/check.py` rejects anything else in menu files. Pictures can be turned off in Settings. Unsplash is not used because its service requires an API key and its own terms.

### 13.4 Standalone copies and a business's own website

- Settings offers "Download offline copy": one HTML file with the app, styles and a snapshot of the directory. Opened from the phone's files it works offline; whenever it is online it refreshes from the directory it came from and keeps the newest data on the device.
- The business tools offer "Your own website": the same single file in business mode, showing one listing with ordering and confirmations, and the credit "Created using Hana by Hamid Yasir & Co." with a link to the full directory. The business uploads it to any host. Its listing stays in the Hana directory, so both always show the same menu, prices and hours.
- Standalone files carry a Content Security Policy with hashes of their own inline code, so nothing else can run in them.

### 13.5 Opening hours and scheduled orders

When a business is closed, its order buttons are disabled and a notice gives the next opening time. A business may allow scheduled orders (`scheduled_orders: true`): customers then choose a time while the business is open over the next two days, even when it is closed now. The 15-minute confirmation window for an order placed while the business is closed starts when it opens.

### 13.6 Claims and merges

The business tools never list unclaimed businesses. An owner finds their own listing by entering its business phone ("Claim a listing"). Someone creating a new listing whose phone matches an unclaimed listing is offered a merge, so the history is kept and no duplicate appears.

### 13.7 Automatic confirmation (optional for businesses)

A claimed business may name a `confirmation_feed`: an https ntfy topic it controls (ntfy is free, open-source and self-hostable). The Confirm page then publishes each signed confirmation to it, and customers' phones pick it up by themselves while the order waits. Only signed confirmations are accepted from a feed. Without a feed, the customer pastes the reply.

### 13.8 Regions

`regions.json` lists public regional Hana directories; `ADOPTING.md` sets the requirements for a new region. "Find the Hana for my area" uses only the browser's own Geolocation, compares the position with the regions on the phone itself, and offers a link. No position leaves the phone and no third-party location service is used.

### 13.9 Abuse and how it is handled

| Abuse | Safeguard |
|---|---|
| Fake or prank orders | An order counts only when the business confirms it; the business sees the customer's real chat account or number; no more than three orders may wait for replies at once, and one per business |
| Customer edits prices in the message | The check line is re-priced from the signed menu on the business tools page |
| Forged confirmations | Claimed listings sign confirmations; time window checked; unsigned replies refused for claimed listings; feeds accept signed lines only |
| Unsent or never-confirmed orders used for complaints | Only confirmed orders produce a complaint summary; unconfirmed orders are cancelled automatically |
| Business changes prices silently | Version chain, public price history and announcements checked by `tools/check.py`; customers' phones refuse older menus |
| Fake claims or impersonation | Two independent vouchers, phone check with a claim code, owner key, regular reviews |
| Prepayment or hidden charges | Forbidden fields rejected by `tools/check.py`; checkout warning; reports trigger an immediate review and removal |
| Malicious text or links in menus | Plain text only; links only to allowed image hosts; Content Security Policy |
| Tampered offline copies | Standalone files refresh from the directory when online; claimed menus are signed |
| Deleted evidence | Record-keeping rule and pledge; adverse-inference guidance in `TERMS.md` |

## 14. Grocery stores, downloads, AI assistants and the Fediverse

- **Grocery stores** list the same way as restaurants, with the kind "Grocery store" or "Supermarket". Every rule is the same: prices include all charges, payment is only on delivery or at pickup, and each order goes to one business. The app shows them under the Groceries tab, sorts their products into grocery categories (`GROCERY` in `core.js`), and calls their items products. Sizes such as "1 kg: 120; 5 kg: 590" use the same option format as menu sizes.
- **Zone from location.** "Use my location" asks the browser for the position, rounds it to about 100 metres and asks OpenStreetMap's Nominatim service (free, no key, no account) which area it is in. The names it returns are matched against the zone and ward names in `areas.json`. Nothing happens unless the customer taps the button. When areas have boundaries, matching can move onto the phone and Nominatim will no longer be needed.
- **Directory downloads.** Settings offers the whole directory as JSON (`directoryData()` in `app.js`, format `hana-directory-1`) and as a PDF laid out like a telephone book (`phonebook.js`, which writes the PDF in the browser with the standard Helvetica fonts and no library).
- **AI assistants** follow `AGENTS.md`. They read the public files, prepare the same order message as the app (`tools/place_order.py`), and either open the customer's messaging app with it or give the customer an app link, `#/order?r=<id>&items=<key>*<qty>,...&mode=delivery|pickup&zone=<zone id>`, which fills the basket. The customer approves and sends every order.
- **Fediverse.** `feed.xml` is an Atom feed of new listings and price changes, rebuilt by `tools/build.py` and checked by `tools/check.py`. Fediverse users follow it through a feed bridge such as RSS Parrot, with the account they already have. Nobody needs a new account, and businesses need nothing beyond their forge account.

## 15. Handles, listing pages, business connections and download choices

- **Handles.** A listing may have a `handle`: 3 to 30 lowercase letters or numbers, unique across the directory, repeated in its `index.json` row. Customers can search for `@handle`, and `#/@handle` opens the listing.
- **Clean addresses.** `tools/build.py` writes `restaurants/<handle>/index.html` (or `groceries/<handle>/index.html` for grocery stores) for every listing with a handle, so `@mealmaster` is at `<site>/restaurants/mealmaster/`. Each page is the app itself, opening on that listing, with the listing's details and menu written into the page for readers without JavaScript, search engines and AI assistants. `tools/check.py` reports a missing or out-of-date page. A business hosting its own site uses the one-file website from the business tools instead.
- **Pickup** is offered by every business unless its listing says `"pickup": false`.
- **Business tools are fully visual.** Menus are edited as sections and items with prices and sizes, not as text (a text import remains for pasting a whole menu). Drafts, keys and connection settings stay on the business's device. Without connections, the business downloads its files and uploads them to its repository.
- **Connections (optional).** With a token for its own repository on GitHub, Codeberg, Forgejo or Gitea, the business publishes new versions with one tap through the forge's API. With an ntfy topic as its order endpoint, new orders appear on the Orders page by themselves, are checked against the menu, and are confirmed or declined with one tap; signed confirmations go to the confirmation feed automatically. The key can be kept in the browser's own database. Tokens and keys never leave the device except to the business's own forge.
- **Download choices.** The directory download lets the customer choose the format (PDF telephone book or JSON), which businesses (type, delivery zone, category) and which details (contact, address, cuisine, hours, delivery, menu). Name, type and zone are always included.

## 16. Logo and app icon

The logo is a smiling rice ball, drawn for Hana as a vector file (`logo.svg`, transparent background, released with the project under the MIT Licence). In the app it appears beside the word "Hana" with no background. The standard icons put it on a teal background (#0F766E): `icon.svg` and `favicon-32.png` for browser tabs, `apple-touch-icon.png` for iPhone and iPad, and `icon-192.png`, `icon-512.png` and `icon-maskable-512.png` in `manifest.webmanifest`. In Settings, a person can choose another background colour; the icon is then drawn on their device and used for the browser tab, Add to Home Screen and a manifest written on the device (hence `manifest-src data:` in the page's security policy). An app installed before the change keeps its old icon until it is removed and installed again.

## 17. Closed businesses, scheduled orders, arrival times and cancelling

- Items in a closed business are never greyed out. Tapping one explains that the business is closed and when it opens. If the business takes scheduled orders, the customer chooses a time while it is open and the order is prepared for then; otherwise they are asked to come back when it is open.
- The confirmation window for an order placed while the business is closed starts when the business opens: the business has 15 minutes from opening to confirm or decline, after which the order is cancelled automatically.
- Each delivery zone has the business's own delivery time (`eta_min`). Customers see an estimated arrival of that time plus the 15-minute confirmation window, at checkout and on the order. A signed confirmation can give a new estimate (E=).
- A customer can cancel an order within 15 minutes of placing it (or of opening, for a scheduled order). The app prepares a cancellation, `CANCEL <order code>`, for the same channel as the order: a prefilled WhatsApp, text or email message, or, for an order sent directly to the business's order address, the cancellation is sent automatically. The business tools recognise cancellations and mark the order as cancelled.

## 17a. Items without a listed price

An item's price (or a size's price) may be `null`: the listing does not state it. Volunteers use this when they know a business's dishes but not its current prices, and Tava Restaurant's listing has no prices for this reason. The app shows "Price on request", the basket shows the subtotal of listed prices only, and the order message lists such items as "price not listed" and asks the business to state the price of each item and the total, including the delivery fee, when it confirms. The check line counts these items at 0 in S=, and the business tools flag them so that the business prices them in its reply.

## 18. Point of sale, records, riders and backups (optional, for businesses)

- **Where the data lives.** Only the menu and listing are published. Sales, receipts, customer details, riders, keys and tokens are kept in the business's browser database (IndexedDB) and leave the device only to services the business connects.
- **Sales and receipts.** Counter, pickup and delivery sales, or a confirmed Hana order recorded with one tap. Receipts have a serial number, date and time, business details (and BIN, if given), items, delivery fee, total and payment method, and print on 80 mm thermal paper or A4, or save as PDF through the browser. They are customer receipts, not VAT tax invoices: a business that must issue Mushak-6.3 invoices or use an NBR electronic fiscal device must keep doing so.
- **Statements.** Totals for any period by payment method and by item, printable or as CSV for spreadsheets.
- **Riders.** A rider list on the device; a job goes to a rider as a WhatsApp message containing only what the courier pledge allows. Optionally, jobs are posted as JSON to a dispatch address the business runs (for example Node-RED or its own server, which can use a courier company's merchant service). Courier services' secret keys never go in the app.
- **Backups.** A backup file at any time; and, optionally, Supabase (hosted or self-hosted, through its standard REST interface) or a self-hosted CouchDB database (through its standard HTTP interface). With a passphrase, records are encrypted on the device with AES-GCM using a key derived by PBKDF2-SHA-256 before they are sent. Restoring merges records and keeps the newest copy of each.

## 19. Mirrors

Every hosted copy and every one-file copy carries the whole directory and serves as a backup. The app remembers the mirrors in `peers.json` and uses them when the main copy cannot be reached. See `MIRRORING.md` and `tools/verify_mirror.py`.

## 20. Speed budget

- The home page loads `list.json`, one small summary per listing (name, handle, zone, kind, categories, hours, delivery fees, contact), built by `tools/build.py`. Full menus load only when someone opens a listing, and each is checked against its hash as before. Dish search loads `search.json` the first time someone searches or picks a category.
- Cards are built only for the page on screen (12 per page).
- `tools/check.py` enforces size limits: `list.json` (warning at 250 KB, error at 500 KB, when it must be split by zone), `search.json` (1 MB and 2 MB), each menu (100 KB and 400 items), and the app's code and styles. Generated files that are out of date are errors.
- The service worker serves saved copies when the network is slow, mirrors take over when the main copy is down, and every copy works offline.

## 21. Orders sent in Hana

- **Setup.** In the business tools, Connections, "Set up orders in Hana" creates a random ntfy.sh topic (no account). The business's key file gains a P-256 encryption key. The next published menu version carries `"direct": { "topic": ..., "enc_key": <public key> }`. Only claimed listings may have it (`tools/check.py`).
- **Sending.** At checkout, "Send in Hana" is the recommended channel and requires the customer's mobile number. The app derives an AES-GCM key from a one-off P-256 key pair and the business's public key (ECDH, then HKDF-SHA-256), and posts `HANA1 <public key>.<sealed order>` to the business's topic. The sealed order names a new random topic for this order. ntfy sees only ciphertext.
- **Replies.** The business tools listen live (Server-Sent Events) with a sound and an optional notification. Confirm and Decline are posted, sealed, on the order's topic as `HANA1R ...`, and the customer's app picks them up within 15 seconds while it is open. Cancellations travel the same way.
- **Presence.** While the business tools are open and orders are not paused, they post "online" to `<topic>-online` every 5 minutes and "offline" when closed. A business with no "online" in the last 12 minutes is shown as temporarily unavailable, and new orders in Hana are refused with a short notice. If ntfy itself cannot be reached, the business is not marked unavailable.
- **Today's details.** The "online" message may carry JSON: `online {"sold": [item ids], "busy": minutes, "pickup_only": true}`. The business sets these under Orders, "Today"; they reset at midnight and need no new menu version. Customers' apps mark sold-out items, add the busy minutes to the estimated arrival, and refuse delivery while the business takes pickup only.
- **Customer alerts.** "Alert me about this order" subscribes the customer's browser through ntfy web push to its open order topics (`hana-o-...`). The notification says only that there is an update; the update itself stays encrypted and is read in the app.
- **Limits.** ntfy.sh keeps messages for about 12 hours and limits how many messages each sender can post per day. A busy business or the community can run its own ntfy server instead.
- **Order steps.** After Confirm (with a preparation time), the business moves an order sent in Hana through Ready, Out for delivery and Delivered and paid (or Ready for pickup and Picked up and paid). Each step reaches the customer's app at once. Out for delivery cannot be sent without the rider's name and mobile number, which the customer sees with a Call the rider button. The business tools sound a reminder when a preparation time runs out before the order is marked ready. The customer can no longer cancel once the order is out.
- **Alerts while closed.** "Alerts while Hana is closed" subscribes the business's browser to ntfy's own web push (its public `web_push_public_key` and `/v1/webpush`), with no ntfy app or account. The service worker shows "New Hana order"; the order itself is opened, still encrypted, in the business tools. iPhones need Hana on the home screen. Not yet tested against ntfy.sh from another website; if it is refused, the live connection while the tools are open still works.
- **Chat.** While an order sent in Hana is open, the customer and the business can exchange short text messages, with quick replies. Messages are sealed on the order's topic, kept on both devices with the order, and included in the complaint summary. There are no photos and no in-app calls; the Call buttons use the phone's normal dialer.
- **Signed updates.** Every follow-up on an order sent in Hana is signed, so neither side can later invent a message from the other. The business signs confirmations, declines, order steps (with rider details) and chat with its listing's Ed25519 key. The customer's app makes an Ed25519 key for each order, sends its public half (`cpub`) inside the sealed order, and signs its chat and cancellation with it. The signed bytes are `"hana-update-1\n" + order code + "\n" + canonical JSON of the message without "sig"`. The customer's app ignores a business update without a valid signature (anyone holding the order's key could have written it); the business tools ignore unsigned customer messages when the order named a key. A browser that cannot check Ed25519 keeps the update and marks it "not verified". The complaint summary labels each update and lists the signed records in canonical JSON, so a mediator can check them against the business's public key.

## 22. Business sign-in

- **No key file to carry.** The business key file (Ed25519 signing key and P-256 order key) is published, encrypted, as `vault.json` next to `menu.json` in the business's repository. The business tools unlock it with a passkey (fingerprint, face or screen lock) or a five-word recovery phrase, then keep the key in the browser's IndexedDB while "Stay signed in on this device" is on.
- **Why not authenticator codes.** A one-time code is checked by whoever holds its secret. Hana has no server, so a code checked in the browser would mean storing the secret beside the thing it protects, and it would add nothing.
- **Format.** `{"hana_vault": 1, "key_id", "data": {iv, ct}, "unlock": [...]}`. A random 256-bit data key encrypts the key file with AES-GCM. Each `unlock` entry wraps the data key with AES-GCM:
  - `"type": "phrase"`: the key is PBKDF2-SHA-256 of the normalized phrase, 600,000 rounds, 16-byte salt.
  - `"type": "passkey"`: the WebAuthn `prf` extension output for that credential and its `prf_salt`, through HKDF-SHA-256 (info `hana-vault-passkey-1`). Entries carry `rp` (the site's host name); a passkey works only on that address, so mirrors use the phrase.
- **Recovery phrase.** Five words from the BIP-39 English list (about 55 bits), chosen with the browser's random generator and shown once. Sign-in accepts any case, spacing and the first four letters of each word. With 600,000 rounds, guessing a phrase from the public vault would take on the order of thousands of years on one current graphics card. The phrase must be kept private; Hana cannot recover it.
- **Setup.** Connections or the listing form: create a key (new business) or load the old key file, then "Set up sign-in", write down the phrase, optionally "Add a passkey on this device", and publish `vault.json`. Each new device can add its own passkey after signing in with the phrase; the updated `vault.json` is published again.
- **Limits.** Passkeys need a browser with the `prf` extension (current Chrome on Android, Windows and macOS; Safari 18 and later). Others use the phrase. The key file can still be loaded and downloaded under "Other ways".
- **Staff.** The owner adds staff under Connections, Sign-in, Staff. Each staff member gets their own Ed25519 key (sharing the owner's order encryption key) in `vault.staff[]`, with their own phrase and passkeys, and signs in on the same screen. The owner's next menu version lists them in `owner.staff` ({name, public_key}); customers' apps accept confirmations and updates signed by the owner or a listed staff key. Only the owner's key can publish the menu.

## 23. Getting started, poster, reports and Bangla

- **Get started** (business tools, `#/setup`): the first-time steps in order, ticked from what the device already knows, with progress kept on the phone.
- **QR poster** (`#/poster`): a printable poster with a QR code for the listing's clean address. The QR library (`vendor/qrcode-generator-2.0.4.min.js`, MIT, about 20 KB) loads only on that page.
- **Community reports:** if `site.json` has `"reports": {"topic", "enc_key"}`, each listing page offers "Report a problem with this listing". The report is sealed like an order (section 21) and posted to that ntfy topic; volunteers open reports under More, Community reports, with their key.
- **Bangla:** Settings, Language. `i18n/bn.json` (about 4 KB) loads only when chosen and replaces fixed interface labels as they appear. Business names, dishes and order messages stay as written.

## 24. Small reliability features (October 2026)

- **Item notes:** each basket line may carry a note (up to 80 characters), written into the order message as "(note: ...)" after the item. Orders without notes are unchanged.
- **Check before you pay:** confirmed orders show each item with a tick box; the customer pays once everything is ticked. Kept on the phone only.
- **Running late:** the business tools post a signed status update with step `late` ("Running about 15 minutes late"). Older apps show it as an ordinary update; it never changes the order's step.
- **Confirmation date:** listings show "Prices confirmed" with the date of the menu's latest publication, or, for volunteer listings, "Not confirmed by the business" with the date they were entered. Volunteer listings' opening times are marked "(hours not confirmed)".

## 25. Demo listings

- `"demo": true` on an unclaimed listing marks it as a demo. Its only contact is `{"app": "demo"}`, which `tools/check.py` accepts only on demo listings. Every screen shows "Demo, just for fun: not a real place".
- A demo order is never sent anywhere. It is confirmed after about 4 seconds, then moves through Accepted, Ready, Out for delivery (rider Rice Uddin, 012RICEUDDIN, whose Call button only shows a message) and Delivered at about 75 seconds ("Hope you enjoyed your dopamine hit"), with a countdown. Progress is worked out from the order's creation time, so it survives reloads.
- Demo orders never expire, never count toward the limit of waiting orders and offer no complaint summary.
- The live directory holds only TONG and DUWAN. The earlier volunteer listings (Meal Master, Sliced, Tava Restaurant) are kept in `tools/fixtures/` as test data; `tools/browser_test.py` serves a temporary copy of the repository with them added.
- **After placing an order** (any listing), the app goes straight to Orders. For orders sent from the customer's own app, the top of Orders shows the message and the button that opens that app; the basket is emptied. Each order shows live countdowns: time left for the business to confirm, the estimated arrival (plus any "running late" notices) and, for demo orders, one per upcoming step.
- **Colour scheme:** the default is now black and white (`scheme-mono`); Clay and the others stay in Settings. People who chose a scheme before keep it.
- **Covers:** tea stalls and coffee places use "Masala tea" by Sarkar Sayantan (CC BY-SA 4.0); grocery stores use "BD Mohanganj 7" (a rice shop in Mohanganj, Bangladesh), both from Wikimedia Commons.
- **Price confirmation date:** `prices_confirmed_at` (optional) records when prices were last confirmed. The business tools set it when a price or fee changes, or when the owner ticks "Every price and delivery fee is current"; other edits keep the earlier date. Older menus without it use the latest price-history entry with real changes, else the first publication. The customer label, the "prices updated most recently" sort and the business listing-health check all use this one rule (`pricesConfirmedAt()` in core.js; `prices_confirmed_at()` in tools/build_list.py).
- **Orders page:** active orders are all shown first, never split across pages; only past orders page. The status headline says only what is known ("Confirmed. Waiting for the business's next update" until a preparation update arrives), and the timeline lists recorded events with their times, marking unsigned ones "Not verified".
- **Order again:** the basket is rebuilt from the current menu, and a notice lists any item that left the menu, changed price or lost its listed price since the earlier order.
- **Bangla search:** common Bangla food and grocery words (চা, বিরিয়ানি, ডিম and others in `BN_WORDS`, core.js) find the English words menus use; an unknown Bangla word finds nothing.

