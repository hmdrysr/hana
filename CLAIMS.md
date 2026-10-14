# Claiming a listing and community verification

These rules decide when a business is shown as claimed on Hana, and how the community keeps checking it. They apply to new businesses and to businesses claiming a listing that a volunteer entered.

## What the business does

1. **Create an account on an open forge.** GitHub, Codeberg, GitLab or a self-hosted Forgejo or Gitea all work. Use an account in the business's name, not a personal one, if possible. Create a public repository for the menu.
2. **Fill in the form** on the business tools page (`business.html`, "List or claim"): business details, zone, hours, delivery areas and fees, pickup, ways to pay at delivery, the menu, and the three pledges (courier identity, data handling and fair pricing).
3. **Create a key** on the same page. The key file stays on the business's device. Keep a private backup: without it, the business cannot sign updates or confirmations, and a recovery needs the full verification again.
4. **Upload `menu.json`** to the repository.
5. **Submit the verification request.** The page opens it as a GitHub issue on the Hana repository. Without a GitHub account, copy the request and send it to a volunteer in `VOLUNTEERS.md`, or open it on a mirror. The request contains no private information.
6. **Answer the vouchers' call** and read the claim code shown on the page.

## What two vouchers check

A claim needs two vouchers from `vouchers.json`, each working separately. Each voucher ticks the checklist in the issue and records what they did, in plain words, in the claim record. They check:

1. **Phone.** The voucher finds the business phone number from an independent source (the shop sign, a printed menu, an existing public page with a history) and calls it. The person who answers reads the claim code. A number that appears only in the request is not enough.
2. **Premises.** The business exists at the stated address: a visit, or a public listing with the same name, address and phone that existed before the claim. For a delivery-only kitchen, the kitchen address must be confirmed by a visit or by a second independent source.
3. **Account.** The forge account and repository belong to the business: the claim code or the listing ID appears in the repository, committed from that account.
4. **File.** The `menu.json` in the repository has the hash in the request and a valid signature (`python3 tools/hana_sign.py verify menu.json`), and `python3 tools/check.py` passes once it is added.
5. **Rules.** Prices include every charge; delivery fees are within the limit in `rules.json`; the business takes payment only on delivery or at pickup; the three pledges are signed.

## What vouchers must not do

- Ask for or accept any payment, gift or favour.
- Ask for, copy or record NID numbers, trade licence numbers, bank details or other private documents. A voucher may look at a document in person but does not keep a copy or write down its number.
- Vouch for their own business, a relative's or an employer's. Any other connection must be declared in the issue.
- Write customer or courier phone numbers anywhere in the repository.

## When a claim is approved

A maintainer, who is not one of the two vouchers:

1. adds the listing to `index.json` with `"claimed": true`, the location of the menu file and the `reviewed` date;
2. adds `claims/<listing id>.json` with the account, the menu repository, the claim date, the two vouchers, the checks they did and the first review;
3. removes the unclaimed listing from `index.json`, if there was one (its files stay in the repository, with their history); and
4. closes the issue with a link to the commit.

## Regular review

- Every claimed listing is reviewed at least every 180 days (`community_review_days` in `rules.json`). `tools/check.py` warns when a review is overdue.
- A review repeats checks 1, 2 and 5. It is added to the end of `reviews` in the claim record, with the date, the voucher and the result (`confirmed` or `problem`). Earlier reviews are never edited or removed.
- An immediate review follows any report that a business asked for prepayment, added hidden charges, exceeded the delivery fee limit, broke a pledge or is not real.
- If a review fails, or a request for prepayment is confirmed, the listing is removed from `index.json` with the reason in the commit message. The business may claim again after fixing the problem; a confirmed request for prepayment means a waiting period decided by the maintainers.

## Lost or stolen keys

The business reports it at once, by phone to two vouchers. The listing is removed from `index.json` until the business creates a new key and the full verification is repeated. The new listing replaces the old one, and its history is carried over.
