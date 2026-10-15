# Uniformity rules

Every Hana screen follows these rules so that the app looks and behaves the same everywhere, on every phone. `tools/check.py` enforces the class list and the bans below for `index.html`, `business.html`, `core.js`, `app.js` and `business.js`.

## Layout

- One frame for every screen: the top bar with the brand mark and the colour-mode toggle, one content column (no wider than 45rem), the footer credit, and the main navigation.
- The top bar holds the Settings button and the colour-mode toggle (`#theme-toggle`, cycling through follow the phone, light, dark). People choose a colour scheme and text size in Settings; pages never set colours or sizes themselves.
- Long lists are split into pages with the shared `pager()` control.
- The business tools page (`business.html`) uses the same frame, with its own four destinations: Start, List or claim, Confirm, Update prices.
- Main navigation has exactly four destinations, in this order: Restaurants, Basket, Orders, About. Phones show a bottom bar (`nav.bottom.s`); tablets and computers show a side rail (`nav.left.m.l`).
- The brand mark is the 🥡 emoji and the word "Hana", set by `.brand`, `.brand-mark` and `.brand-name`. The emoji box is 2rem and the wordmark 1.375rem bold, centred on one line. Do not resize either one on a single screen.
- The footer reads: "Built by Hamid Yasir & Co. for the people of Chittagong. Managed by the Hana Community." The two names are links.

## Type

Four heading levels only. Pages never set font sizes. Sizes are fluid (the Utopia method): each grows smoothly between a 320px and a 1280px screen, as set in `theme/theme.css`.

| Use | Element and class | Size |
|---|---|---|
| Page title (one per screen) | `h1.page-title` | 1.5rem, semibold |
| Section title | `h2.section-title` | 1.125rem, semibold |
| Group title inside a section (a menu section) | `h3.group-title` | 1rem, semibold, primary colour |
| Card title | `h2.card-title` | 1.125rem, semibold |
| Small label above a group (a menu category) | `.overline-label` | 0.75rem, capitals |
| Secondary text | `.muted`, `.small-text` | |

## No text is cut off

Text wraps; it is never clipped, hidden or shortened with an ellipsis, at any screen width or text size. `tools/browser_test.py` checks every screen for clipped text.

## Spacing

- One grid in steps of 0.5rem. The page gutter is 1rem.
- Do not use Beer CSS margin helpers (`margin`, `top-margin`, `no-margin` and the rest). Beer CSS gives any container whose child has a class containing "margin" a padding of 0.1px, which removes the container's real padding. Use `.gap-top` (1rem above) or `.flush` (no margin) instead, or `div.space` for a vertical gap.
- No inline styles (`style="..."`).

## Colour

- Colours come only from the Material 3 roles in `theme/theme.css`. Pages never name a colour.
- Notices: `article.tertiary-container` for something that needs attention, `article.surface-container-high` for neutral information. Both carry an icon (warning or info) and plain text.
- Status chips: `primary-container` for a positive state (Open now), `tertiary-container` for a caution (Not yet confirmed), `surface-container-highest` for neutral (Hours not stated).

## Components

Use only these, in the forms shown in `app.js`:

- Card: `article.round.border.no-elevate` for a listing or an order.
- List: `ul.list` or `ul.list.border`.
- Chip: `span.chip.small.no-border` for status; `button.chip.medium.border` for an "add" action with a price.
- Button: `button` (filled, the main action on a screen; no more than one per section), `button.border` (secondary), `button.circle.transparent` (icon-only, with an `aria-label`), `a.button` for a link styled as a button.
- Text field, text area, select: a `label.field-label` above a `div.field.border.round` (`.suffix` with an arrow icon for a select, `.textarea` for a text area), built with `textField()` and `selectField()` in `core.js`. Labels are never placed inside fields, so they can wrap. Search: `div.field.prefix.round.fill`.
- Radio button, checkbox, switch: `label.radio`, `label.checkbox`, `label.switch`.
- Snackbar (`#snackbar`) for short confirmations; dialog (`#dialog`) for a decision that cannot be undone or that empties the basket.

## Icons

Inline SVG from Material Symbols (outlined), through `icon(name)` in `app.js`. Add a new icon only by adding its path to `ICONS` from the same package version. Icons are decorative (`aria-hidden`); the text or `aria-label` next to them carries the meaning.

## Legal text

Legal text lives in `TERMS.md` (shown on the Terms page) and `CLAIMS.md`. Other screens state only the one rule that matters at that point, in plain words, without warning styling unless the person must act.

## Writing

Canadian English, plain and professional:

- Canadian spelling (colour, centre, licence as a noun, neighbourhood, organize).
- Money: `BDT 1,290` (ISO code, comma for thousands, whole taka).
- Time: `7 p.m.`, `3:30 a.m.`, `midnight`, `noon`. Dates: `October 15, 2026`.
- "zone" for a police station area (thana), written without a suffix ("Khulshi"); "ward" for a City Corporation ward; "courier" or "delivery person" for the person who delivers, "business" when the text covers restaurants and delivery-only kitchens alike.
- Sentence case for headings and buttons. No exclamation marks.

## Allowed classes

`tools/check.py` rejects any class in those files that is not on this list:

active, badge, bold, border, bottom, brand, brand-mark, brand-name, button, card-title, center-align, checkbox, chip, circle, dark, field, fill, flush, gap-top, group-title, l, label, left, left-align, link, list, m, max, medium, muted, no-border, no-elevate, no-space, overline-label, page-title, prefix, price, primary-container, radio, responsive, right-align, round, row, s, section-title, small, small-space, small-text, snackbar, space, suffix, surface-container-high, surface-container-highest, switch, tertiary-container, textarea, top-align, transparent, vertical, vertical-padding, wrap, light, field-label, cover, thumb, credit, text-large, text-larger, scheme-teal, scheme-indigo, scheme-green, scheme-plum, scheme-contrast

Adding a class to this list is a theme change: it needs a recorded decision and a commit that updates this file and `tools/check.py` together.
