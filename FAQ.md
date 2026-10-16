# Frequently asked questions

Answers for customers, businesses, riders, volunteers and anyone deciding whether to support Hana. For the full design, see [`SPEC.md`](SPEC.md); for the rules every listing follows, see [`TERMS.md`](TERMS.md).

## Contents

1. [The idea](#the-idea)
2. [Customers](#customers)
3. [Businesses](#businesses)
4. [Delivery and riders](#delivery-and-riders)
5. [Money, fees and discounts](#money-fees-and-discounts)
6. [Infrastructure and reliability](#infrastructure-and-reliability)
7. [Community and governance](#community-and-governance)
8. [Adoption and the long term](#adoption-and-the-long-term)

---

## The idea

### What is Hana, in one sentence?

Hana is a free, open directory of Chittagong's restaurants and grocery stores that lets you order straight from the business, with no middleman taking a cut.

### Is it just an index site?

In part, and on purpose. Hana works like a shared phone book with an order form attached. Every business is listed in one place, in the same format, and anyone can read that list. On top of the directory, Hana adds what a phone book cannot: menus with prices, delivery areas and fees, opening hours, a basket, a clearly worded order message, encrypted ordering inside the app, live order status and signed confirmations.

The directory is the heart of it because it solves the problem nobody else solves: customers should not need ten apps or ten websites to reach ten businesses.

### Is this another student project that nobody will use?

The difference is in what Hana is not. It is not a company, it does not run a delivery fleet, and it does not need investors or a marketing budget to stay alive. It is a set of plain files that cost almost nothing to host and that anyone can copy. A project like that does not shut down when funding runs out, because it has no running costs to fund.

Whether people use it depends on businesses listing themselves and customers finding them there. Hana is built to make both as easy as possible, and it starts small, in one city, on purpose.

### How is Hana different from the large delivery platforms?

| | Large platforms | Hana |
|---|---|---|
| Commission on each order | A share of every sale | None |
| Who sets prices | The business, often under pressure to discount | The business alone |
| Featured or paid placement | Yes | Never; every list is alphabetical |
| Exclusivity | Sometimes required | Never |
| Customer accounts and tracking | Required | None |
| Payment | Through the platform | Directly to the business, on delivery or at pickup |
| Who owns the customer relationship | The platform | The business and the customer |
| Can anyone copy and run it | No | Yes, it is open source |

### Why does Hana exist at all?

Large platforms sit between businesses and their customers. With that much market power, they set the fees and the terms, and neither side has much say. Hana removes the middle layer instead of becoming a new one. It does not compete to be a better middleman; it is designed so that no middleman is needed.

---

## Customers

### Why would I switch if I already use a delivery app?

You do not have to switch. Hana is for people who want to:

- order from a favourite place at its real prices;
- see every known charge, including delivery, before ordering; anything not listed is clearly flagged, and your message asks the business to confirm it;
- pay the business directly, on delivery, without handing payment details to anyone;
- skip ads, pop-up offers, surge pricing and pressure to tip;
- order without creating an account or being tracked.

Many people will use both for a while. That is fine. Hana only needs to be the easiest way to reach the places you already like.

### Are there discounts?

Hana itself never offers discounts, because it does not sell anything. A platform that discounts food it neither makes nor sells is spending money it has to recover somewhere, usually from businesses' margins or later price increases.

Businesses are free to offer their own deals, set their own prices and change them whenever they like. Every price change is public and recorded in the menu's history.

### Are the prices real?

Yes. Prices come only from the business's own published menu and include VAT and every other charge. The delivery fee is the only addition, it is set by the business for your area, and it can never exceed the cap in [`rules.json`](rules.json). There is no dynamic or surge pricing.

### Are there reviews or ratings?

No. Ratings are easy to fake, easy to buy and easy to weaponize. Instead, Hana shows facts: whether the business has confirmed its listing, when its prices were last confirmed and whether it is open now.

### Do I need to download an app or create an account?

No. Hana runs in your phone's browser and can be added to your home screen like an app. It works offline after the first visit. Your name, address and order history stay on your phone. The only person who receives your details is the business you order from, because it needs them to deliver.

### What if something goes wrong with my order?

Every order is confirmed by the business within 15 minutes, or it is cancelled automatically, and you owe nothing. Confirmations and updates from claimed businesses are signed, so they cannot be faked by either side. If there is a dispute, the app prepares a summary you can take to the consumer rights authority. Because you pay only on delivery, you never have to chase a refund.

### Can I try it without ordering anything real?

Yes. TONG and DUWAN are demo places. You can order from them, watch the order get confirmed, follow the pretend rider and see it "delivered" in about a minute. Nothing is sent and nobody comes to your door.

---

## Businesses

### Why should a restaurant or store list on Hana?

- **It costs nothing.** There is no listing fee, no commission and no monthly charge.
- **You keep your customers.** Customers contact you directly, and you can reach them again.
- **You keep your prices.** No one asks you to match dine-in prices, fund discounts or sign an exclusivity agreement.
- **You keep your other channels.** List on Hana and anywhere else you like.
- **You get the tools.** Hana includes free business tools: an encrypted order inbox, signed confirmations, a menu editor, a point of sale with receipts and statements, rider dispatch, backups, a QR poster and your own website.

### Why would a business pay a platform 15 to 30 per cent, or even 1 per cent?

That is the question Hana asks. A business sells food or groceries; it should not have to hand a share of every sale to whoever owns the software. Hana takes no percentage and no flat fee, now or later. That promise is protected in [`GOVERNANCE.md`](GOVERNANCE.md), and any change that adds fees is not accepted.

### Many restaurants are moving to a cheaper platform. Why not just do that?

A lower commission is better than a higher one, but it keeps the same arrangement: one company owns the customer relationship and can change its terms later. Once most businesses depend on one platform, it can raise its fees again. Hana's answer is structural rather than a better price: an open directory that no single company owns.

### Do I need technical skills?

Not for the everyday work. Taking orders, marking items sold out and setting busy times work in any phone browser, with a step-by-step Get started checklist, and sign-in uses your phone's fingerprint, face or screen lock, or a five-word recovery phrase.

Two steps are more technical today: claiming a listing and publishing menu changes need a free account on an open forge such as GitHub or Codeberg. A volunteer can enter your listing and help with that setup. A simpler, phone-only way to claim and publish is on the [roadmap](ROADMAP.md).

### Do I have to keep my dine-in and delivery prices the same?

No. You set your own prices. Hana only requires that the listed price is the full price, including VAT and every other charge.

### I already use two or three delivery apps. Do I have to manage another screen?

Hana is designed to reduce screens, not add one. It is an open directory, so any service can read it. Orders sent in Hana arrive in one inbox with a sound. Work on bringing notifications from other apps into the same list is planned once it can be done reliably with open-source tools (see [`ROADMAP.md`](ROADMAP.md)).

---

## Delivery and riders

### Isn't delivery the real problem, not the platform?

Both matter. Delivery is the harder physical problem, and Hana does not pretend otherwise. But the platform decides who pays for delivery, who sets the fee and who keeps the customer. Hana separates the two: the directory and ordering are shared and free, and each business chooses how to deliver.

### Who delivers Hana orders?

Whoever the business chooses:

- **its own riders**, as many restaurants already have;
- **a courier service** the business already works with;
- **freelance riders or rider groups**, paid a fee agreed directly with the business;
- **no one**, for pickup, which every business offers unless it says otherwise.

The business tools include free rider dispatch: a ready-made job message for WhatsApp or text, or an automatic hand-off to a dispatch address the business runs.

### Why is a restaurant's own delivery more expensive than a platform's?

Platforms often keep delivery fees low by subsidizing them with investor money, commissions taken from restaurants, or both. The cost does not disappear; it moves. When a business delivers on its own, the full cost shows up in the fee. Hana makes that cost visible and lets the business set it per area, with a public cap. Over time, shared rider networks can bring it down without anyone taking a cut of the food.

### Earlier attempts with their own delivery networks failed. Why would this be different?

Those attempts tried to be a platform and a delivery company at once: they hired or contracted riders, carried the losses and had to make the numbers work for everyone. Hana carries none of that. It has no fleet, no payroll and no losses to absorb. Delivery stays with the people who already do it, paid directly by the businesses they deliver for. If a rider group or a business stops delivering, the directory keeps working.

### Can riders organize themselves on Hana?

Yes, and that is encouraged. A group of riders, or a pool of workers who take on tasks, can agree on fees by area and offer them to businesses. The arrangement is between the riders and the businesses; Hana only provides the tools for orders and rider details. Fixed, transparent fees agreed in advance are fairer for riders than per-order commissions set by a platform.

### What is the BDT 150 cap?

It is the highest delivery fee any listing may charge for one order, set in [`rules.json`](rules.json). It is a ceiling, not a target. Businesses set their own fee for each area, and many will charge much less.

### Is rider safety and identity checked?

Every business pledges that its riders use mobile numbers registered in their own names, and that riders receive only what they need to deliver. For orders sent in Hana, the rider's name and number must be entered before an order is marked as out for delivery, and the customer sees them.

---

## Money, fees and discounts

### How does Hana make money?

It does not, and it does not need to. Hana is plain files hosted for free (on GitHub Pages and any mirror). There is no server to pay for, no staff and no investors expecting a return. That is exactly what keeps it free of commissions.

### If nobody profits, who pays for development?

Hana is built and maintained by volunteers and the community, like many open-source projects. Because it is small, built from time-tested open tools and needs no paid services, the cost of keeping it running is close to zero. Anyone can improve it, and every change must keep it free and open.

### Will Hana start charging later?

No. Free listing, no commission and no paid placement are core promises protected by [`GOVERNANCE.md`](GOVERNANCE.md). Because the code and the directory are open, anyone could copy Hana and continue it if that promise were ever broken.

### What about payments?

Customers pay the business directly, on delivery or at pickup: cash, Bangla QR, card on the business's own terminal or a mobile wallet transfer. No one may ask for payment in advance. Hana never touches money.

---

## Infrastructure and reliability

### Who runs the servers when thousands of people use it?

There are no servers to run. Hana is a set of static files. Each phone downloads a small copy of the directory and keeps it for offline use. Any number of people can host a copy (a mirror), and each copy is a full backup. If one host goes down, the others keep working. See [`MIRRORING.md`](MIRRORING.md).

### How big is it?

Small. Today the whole directory is a few kilobytes; size limits in `tools/check.py` keep each file small as it grows, and the app loads only what each screen needs. It is built to work on older phones and slow mobile connections.

### Can someone tamper with a copy?

Menus are signed by their owners and checked against published hashes, so an altered copy is detected and rejected. Mirrors are tamper-evident by design.

### What about orders sent inside the app?

They travel through ntfy, a free, open-source relay that needs no account, and they are encrypted end to end so that only the business can read them. If the relay is unavailable, customers can still send their order by any other channel the business lists, such as WhatsApp, text message or email.

Encryption hides what is in an order, but the relay can still see when messages are sent, how large they are and the network addresses involved. It keeps messages for about 12 hours. A business's "taking orders" status and today's sold-out items are signed by the business, so nobody else can change them, but they are not secret. The phone number on an order is the one the customer typed; Hana does not check it.

### Can it be followed on social media?

Yes. Hana publishes an open feed of new listings and price changes that can be followed from the Fediverse (Mastodon and similar networks) without signing up anywhere new.

---

## Community and governance

### Who owns Hana?

No one owns the directory. Hamid Yasir & Co. created Hana and credits it to the people of Chittagong; the Hana Community manages it. The code is open source under the MIT licence, and anyone may use, copy, adapt or run it.

### Can other cities or countries use it?

Yes. Any region can run its own Hana from the same code, and regional directories can link to one another. See [`ADOPTING.md`](ADOPTING.md).

### How do businesses get listed and verified?

Anyone can enter a listing. A business then claims its own listing with a free account on an open forge, such as GitHub or Codeberg, and two community members vouch for the claim. Claimed listings are marked as confirmed; volunteer entries are clearly marked as not confirmed. See [`CLAIMS.md`](CLAIMS.md).

### What stops Hana from becoming the next middleman?

Its design and its rules. Hana holds no customer data, takes no money and owns nothing it could later charge for. Its promises (no commission, no paid placement, no exclusivity, no tracking) are written into [`GOVERNANCE.md`](GOVERNANCE.md), and because everything is open, a broken promise could simply be forked away.

### How can I help?

List a business you know, test the app on your phone, report a wrong listing, help riders and businesses agree on fees in your area, translate, or improve the code. Most of these need no account. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Adoption and the long term

### Why would people change habits that the big apps built with offers and ads?

Most people will not switch because of a principle. They switch when the place they want is there, at its real price, and ordering is quick. Hana focuses on exactly that: real prices, a short checkout, no account and a clear order status. Businesses that list on Hana can tell their regular customers, print the QR poster for their counter and bags, and share their own Hana page.

### Isn't a fair, simple app less exciting than one full of offers?

Perhaps, but offers funded by commissions are not free; they come out of businesses' margins and, eventually, customers' pockets. Hana aims to feel calm and fast instead: one clean list, one basket, one message, and the food arrives.

### Where is this heading?

More and more people will ask an AI assistant to "order me this" rather than open an app. An assistant needs an open, reliable directory to do that, not ten closed apps. Hana is already readable by AI assistants (see [`AGENTS.md`](AGENTS.md)), so the businesses listed there can be found by whatever tool customers use next.

### What has to happen for Hana to succeed?

1. Real businesses in Chittagong list and claim their pages.
2. Riders and businesses agree on clear delivery fees by area.
3. Customers find their favourite places there and tell others.

None of these require Hana to raise money or win a price war. They require a directory that is free, open and good to use, which is what Hana is built to be.
