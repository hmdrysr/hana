# Ordering with an AI assistant

This file is for AI assistants and other programs that help a person find food or groceries in Chittagong and order from Hana. Hana has no server and no account: everything is in public files, and an order is a message the customer sends to the business.

## Where the data is

Published copy: https://hmdrysr.github.io/hana/ (the same files are in the repository at https://github.com/hmdrysr/hana).

| File | What it holds |
|---|---|
| `index.json` | Every listing: `id`, `name`, `menu_hash` and the location of its menu file |
| `menus/<id>/menu.json` | One listing: kind, zone, address, phone, ordering channels (`contact`), hours, delivery zones and fees, pickup, ways to pay on delivery, and items with prices |
| `areas.json` | Zones (thanas) and wards. A customer's zone id is needed for delivery |
| `rules.json` | Rules every listing follows, such as the delivery fee limit and the confirmation window |

Listings with a `handle` also have a readable page at `https://hmdrysr.github.io/hana/restaurants/<handle>/` (grocery stores: `groceries/<handle>/`), which includes the menu as plain HTML.

Check each menu file against `menu_hash` in `index.json` (SHA-256 of the file's bytes). Do not use a menu that does not match. A person can also download everything as one file from the app: Settings, then Download the directory, then JSON.

## Rules an assistant must follow

1. **Show before sending.** Show the customer the business, every item with its quantity and price, the delivery fee and the total, and get their clear approval before anything is sent.
2. **No prepayment, ever.** Payment is only on delivery or at pickup: cash, Bangla QR, card on a POS terminal or mobile wallet transfer. Never pay, promise or arrange payment in advance. If a business asks for advance payment, tell the customer not to pay.
3. **One business per order.** Each order goes to one business.
4. **Prices come from the menu file only.** Prices include VAT and every other charge. The delivery fee is the only addition and never exceeds `rules.json` `max_delivery_fee`. If a fee is not stated, say so. An item whose price is `null` has no listed price: say so, and the order message asks the business for each price and the total.
5. **Listings marked `"demo": true`** (TONG and DUWAN) are pretend places for trying the app. Never send an order to them or present them as real.
6. **Listings marked `"claimed": false`** were entered by volunteers and are not confirmed by the business. Tell the customer that prices may have changed.
7. **Check opening hours** in the customer's local time (Asia/Dhaka). Order from a closed business only if the listing has `"scheduled_orders": true`, and say when the order is for.
8. **Use the customer's own channel and details.** Send only from the customer's own account, with the name and address they gave. Do not invent details.
9. **Wait for confirmation.** The business must reply `CONFIRMED <order code>` (or a signed `CONFIRMED hana1 ...` line) within `confirmation_window_minutes` (15). Otherwise the order is cancelled and the customer owes nothing. Volunteer-entered listings (`"claimed": false`) have no order code: the customer and the business agree on prices, the delivery charge and the total in their chat.

## Preparing the order message

The message must match the app's format exactly, ending with the check line that lets the business verify items and prices against its signed menu (`SPEC.md`, section 6.4). The simplest way is the reference tool, which needs only Python 3:

```
python3 tools/place_order.py --site https://hmdrysr.github.io/hana/ list --zone khulshi --search pizza
python3 tools/place_order.py --site https://hmdrysr.github.io/hana/ menu "Sliced"
python3 tools/place_order.py --site https://hmdrysr.github.io/hana/ order "Sliced" --item <item key>*2 --zone khulshi --name "<name>" --address "<address>"
```

It prints the message, a link for each of the business's channels (WhatsApp, text message, email and others) that opens the customer's app with the message filled in, and an app link.

Without running code, give the customer an **app link**. It opens Hana with the basket filled in, so the customer only adds their details and taps Send:

```
https://hmdrysr.github.io/hana/#/order?r=<listing id>&items=<item key>*<quantity>,<item key>*<quantity>&mode=delivery&zone=<zone id>
```

Item keys are an item's `id`, or `id.option-id` for an item with sizes or options. Use `mode=pickup` (and no zone) for pickup. An optional `note=` adds a note for the business.

## Orders sent in Hana

Listings with `"direct"` take orders in the Hana app itself, encrypted for the business. An assistant should give the customer an app link (above): the customer adds their mobile number and taps Send, and the business's reply appears in the app.

## Sending directly

If a listing has a contact with `"app": "endpoint"`, the business accepts orders by HTTPS POST of the message as plain text to that address. `place_order.py ... --send` does this, after the customer has approved the order. For every other channel, the message is sent from the customer's own messaging app.
