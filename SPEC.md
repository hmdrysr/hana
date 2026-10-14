# Hana: Chittagong Food Directory and Order App. Draft Spec v0.6

Created by Hamid Yasir.

Status: draft. Items marked UNVERIFIED are from memory and must be checked against current official sources before launch.

## 1. What this is

A static progressive web app (PWA) that lists restaurants and formats orders. It does not take payments, run deliveries, store orders on a server or settle disputes. Customers pay cash on delivery or by Bangla QR directly to the restaurant. Orders are sent by the customer's own messaging app to the restaurant's preferred channel.

Anything the app does not do is stated plainly in the app.

### 1.1 Scope: Chittagong only

This app is purpose-made for Chittagong. It does not cover other cities, and nothing in the design is built around a multi-city directory.

- The city is always written "Chittagong". The alternative official spelling is never used anywhere in the app, the data files or the documentation.
- There is one directory for Chittagong. If it grows large, it is split by Station, not by city.
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
10. One delivery charge per zone, fixed by the restaurant. The app adds no fee of its own, and no surge, distance or per-customer pricing.

A change that breaks one of these is not accepted. `tools/check.py` already rejects menu fields for commission, sponsorship and tracking.

### 1.5 About screen

One About screen, reachable from the footer of every page. It shows, in plain sentences:

- "Hana is the Chittagonian word for food."
- "Created by Hamid Yasir."
- Why Hana exists (section 1.3, shortened) and the commitments in section 1.4.
- That Hana lists restaurants and formats orders, and takes no payments and runs no deliveries.
- A link to the repo and to how to help.
- A **Responsibility** notice, in these words or plainer ones: "Hamid Yasir & Co. assumes no responsibility for anything. Every order, payment and relationship is between the customer and the restaurant. Disputes are handled by the appropriate local government authority and the community." The README repeats it. UNVERIFIED: whether this wording is enough under Bangladeshi law (open item 1).

### 1.6 Logo and footer

- The logo is the takeout box emoji 🥡, shown beside the word "Hana". In the app it is drawn by the phone's emoji font. The home screen icon (`icon-192.png`, `icon-512.png`) and `icon.svg` use the same emoji.
- Every page has the same footer: "Built by Hamid Yasir & Co. for the people of Chittagong. Managed by the Hana Community." "Hamid Yasir & Co." links to https://hamidyasir.com. "Hana Community" links to the project repository. The repository address is filled in by `tools/autofill.py` and, on GitHub Pages, worked out by the app from its own address.

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
4. One colour scheme in Material 3 roles, generated from the seed colour #9a3412. Light and dark follow the phone's setting. There is no theme switcher.
5. Only the components listed in `theme/UNIFORMITY.md` are used: cards, lists, chips, buttons, text fields, selects, radio buttons, checkboxes, switches, the snackbar and the dialog.
6. A short, fixed list of screen types: restaurant list, restaurant page, basket and checkout, orders and complaint summary, about, and later the courier card and owner onboarding. New screen types need a recorded decision.
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
- When the owner claims the listing, the first claimed version has the owner's key-hash ID, `replaces` set to the temporary ID, `previous` set to the hash of the last unclaimed version, and the full price history carried over. The old ID then points to the new one.
- Near-duplicates with different IDs are shown as "possible duplicate". Only a vouched member's signed merge note resolves them. Nothing merges silently.
- Key rotation: the old key signs the new key. If the old key is lost, vouched members can sign a recovery.

### 4.2 Vouching

- A new restaurant key is shown as verified only after a trusted local member signs a vouch, ideally after visiting the shop.
- Unverified listings are shown differently and labelled as such.
- A false pledge (section 7) is grounds for removal by a vouched member's signed note.

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
    {"id": "dahi-bara", "name": "Dahi Bara (2 pieces)", "section": "Indian", "category": "Starters",
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
      {"key": "item:dahi-bara", "label": "Dahi Bara (2 pieces)", "old": 200, "new": 220}
    ]
  },
  "price_history": [
    {"version": 12, "published": "2026-10-15T09:00:00+06:00", "summary": "...",
     "changes": [{"key": "item:dahi-bara", "label": "Dahi Bara (2 pieces)", "old": 200, "new": 220}]}
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

### Default area: the whole city

Every business delivers to the whole Chittagong City Corporation (CCC) area unless it reports a smaller one. A business may report its delivery area by police Station or, more precisely, by ward. The word used everywhere in Hana is "Station".

### `areas.json`

One shared file with three levels:

1. **City:** the Chittagong City Corporation (`ccc`).
2. **Stations:** the Chittagong Metropolitan Police Stations inside the City Corporation (`station-khulshi`, for example). Each is `part_of` the city.
3. **Wards:** the 41 City Corporation wards (`ward-14`, for example), each with its number and name. Each is `part_of` one or more Stations. Where the source places a ward in more than one Station, the ward lists all of them, so a business that delivers to any of those Stations is matched for that ward. The business can still decline an order.

Each area has an ID, a `kind` (city, station or ward), an English name, a `source` and, once one exists, a boundary (GeoJSON). An area without a boundary can only be matched by name, and its `source` says so. Matching a customer's GPS position requires boundaries. `tools/check.py` enforces the levels: a Station must be part of the city and a ward part of a Station.

The ward list and the ward-to-Station assignments come from the English Wikipedia article on the City Corporation, read on October 15, 2026. That article predates the Sadarghat and EPZ Stations, so some assignments may be out of date. UNVERIFIED against Chittagong Metropolitan Police and City Corporation records. Karnaphuli Station lies outside the City Corporation and is not listed. Boundaries can be built from OpenStreetMap data (UNVERIFIED: check the current licence and attribution rules before copying any boundaries). Local members review the list so that spellings and boundaries are agreed in one place.

### How the customer is placed

All matching runs on the customer's phone. The customer's location is never sent anywhere and is never part of any file.

1. **Use my location:** the browser asks permission and reads the device position. The point-in-zone check runs locally.
2. **Pick my area:** the whole city, a Station or a ward, from `areas.json`. Works without location permission or mobile data.
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

1. Basics: name, Station or ward, address, business phone, hours.
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
- Limits (proposed): JPEG, WebP or PNG; at most 1600 pixels on the long side; at most 300 KB; at most 12 photos per restaurant. `tools/check.py` enforces the declared values.
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
2. At checkout the customer picks a channel from the restaurant's list. The preferred one is pre-selected.
3. The delivery charge is the one fee the restaurant set for the customer's zone (section 5.1). The app shows it as its own line, adds nothing to it and never calculates a fee itself. If the restaurant has not stated a fee, checkout says "delivery fee not stated, confirm with the restaurant" and does not guess.
4. The client builds two text blocks and shows them before sending:
   - **Kitchen block:** items, quantities, total, order code.
   - **Courier slip:** order code, first name or nickname, delivery address or landmark, cash amount to collect. It has no full name, no phone number and no order history.
   - **Check line:** one machine-readable last line (section 6.4).
5. The client opens the chosen app with the kitchen block filled in. The customer presses send.
6. The client saves the order on the device with a timestamp and a hash.

### 6.2 Link formats

Plain links, no API:

- WhatsApp: `https://wa.me/<number>?text=<encoded text>`
- SMS: `sms:<number>?body=<encoded text>` (iOS and Android differ slightly: test both)
- Phone: `tel:<number>`
- Messenger: `https://m.me/<pagename>`
- Telegram: `https://t.me/<username>`

Messenger and Telegram links may not accept pre-filled text (UNVERIFIED). For these, the client copies the text to the clipboard and tells the customer to paste it.

### 6.3 Order status

The restaurant replies in chat. The customer can tick off "confirmed", "picked up" and "received" in the app. These ticks are local only and are not proof of anything.

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

### 7.3 Courier card

The restaurant sends a courier card in the order chat before delivery: courier name, courier phone number, and optionally a photo or bike plate.

Client behaviour:

- The customer saves the card against the order. It shows Call and "Courier arrived" actions.
- If no courier card is received, the order shows "No courier details yet. Ask the restaurant before delivery." and stays marked incomplete.
- The business phone number and the courier's number are always shown on the order screen and in the complaint export.
- The card is deleted from the phone one to two days after delivery, to protect the courier's privacy.
- Contact is one-way by default: the customer can contact the courier, and the courier has no need for the customer's number. If a courier cannot find the address, the courier calls the restaurant, which relays.
- At handover the customer shows the order code.
- Report button: "Courier number does not match." It records the report on the device and shows the police and consumer-rights routes (section 9).

### 7.4 Tracking

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

The client fills a complaint from the saved order: complainant, seller, order ID and hash, date, items, prices, payment method, the menu version ordered from (with the saved signed menu file and its price announcements attached), courier card, what went wrong, the date the problem arose, what the customer already tried, evidence list and remedy sought. It exports as a printable file and a plain text file. The customer must check it against the current official DNCRP form before filing.

## 10. Data on the device

- Orders, favourites and courier cards are stored locally (IndexedDB).
- Each order keeps the exact signed menu file it was priced from, so the customer has proof of the published price.
- The phone keeps the highest menu version seen for each restaurant (rollback protection, section 5.4) and any photos the customer chose to load.
- Browsers can clear storage. Provide one-tap export and import, and warn before data is cleared.
- Load no third-party scripts, fonts or analytics.

## 11. Repository and contributions

The project lives in an open git repo that anyone can fork or mirror. Full rules are in `CONTRIBUTING.md` and `GOVERNANCE.md`.

- **Routes:** list a restaurant, update or remove a listing, report a wrong listing, vouch, fix an area, code, theme, docs, and phone test reports. Most routes need no GitHub account: an owner or volunteer can send the ready message from the onboarding page to a volunteer.
- **Forms:** issue forms for each route and a pull request template, in `.github/`. Forgejo-based hosts such as Codeberg may need these copied to their own template folder (UNVERIFIED).
- **Check:** `python3 tools/check.py` must pass on every pull request. It checks that data files are well-formed: the Chittagong spelling, hashes, https locations, menu fields, pledges, zone shapes, coordinate order, no HTML in menu text, and no fee or paid-placement fields. It also checks the price safeguards (whole-taka prices, stable ids, kept version files, hash chain, announced price changes matching the real changes, append-only price history) and photo entries. It does not yet verify signatures. `tools/selftest.py` proves the checker catches each of these.
- **People:** maintainers (code, spec, docs), vouchers (real-world checks of restaurants) and contributors. Starting numbers for approvals are proposed in `GOVERNANCE.md`.
- **Privacy:** no customer or courier data, no NID numbers and no screenshots with private details in issues, pull requests or files.
- **Records:** history is kept. A removal is a new commit with a reason.
- **Credit:** Hamid Yasir is credited as creator (`README.md`, `AUTHORS.md`, About screen). Contributors are credited through commit sign-offs.
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
26. Confirm Tava Restaurant's, Meal Master's and Sliced's listings with the owners, claim them with the owners' keys, and have the owners sign the pledges.
27. Draw boundaries for the city, the 15 Stations and the 41 wards, from a source with a clear licence, and have two local reviewers confirm them. The OpenStreetMap lookup service blocked automated requests, so this needs a proper data download or manual drawing.
28. Confirm the ward-to-Station assignments in `areas.json` against Chittagong Metropolitan Police and City Corporation records, including the wards now in the Sadarghat and EPZ Stations.
29. ~~Decide what "whole Chittagong" means.~~ Decided: it means the Chittagong City Corporation area, which every listing covers by default.
30. Write and test the reference fuzzy-search code in `tools/` (section 5.1, Search).
