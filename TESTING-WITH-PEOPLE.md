# Testing Hana with people

Automated tests show that the code does what it is meant to do. Only people show whether it makes sense. Before adding features, run these short sessions and fix what they reveal.

## How to run a session

- **Who:** one person at a time who has never seen Hana. For the business sessions, a restaurant or grocery owner who has never used GitHub.
- **Device:** their own phone if possible; otherwise an inexpensive Android phone on mobile data, not Wi-Fi.
- **Rules:** give the task, then stay quiet. Do not explain the screen or help unless they are completely stuck. Note where they pause, tap the wrong thing or look unsure. Twenty minutes is enough.
- **Record:** write what happened, not what you think caused it. File each problem with the [phone test report form]({{REPO_URL}}/issues/new/choose).

## Customer tasks

1. Find something to eat for under BDT 300 and say where it is sold.
2. Find out whether that place delivers to your area and what the delivery charge is.
3. Order it from the demo tea stall TONG for delivery, with a note on one item. Then say, in your own words, whether the order has been sent, received or accepted.
4. Order from DUWAN for pickup. Check that no delivery questions were asked.
5. Close the browser halfway through a basket, reopen Hana and finish the order.
6. Turn on large text (Settings) and dark mode, and repeat task 1.
7. Switch to Bangla and say whether anything reads oddly.

## Business tasks

1. Open the business tools and explain, in your own words, what Hana costs and how orders would reach you.
2. Find your listing by phone number.
3. Change one price and say what customers will see, and when.
4. Mark one item sold out for today.
5. Set up sign-in, write down the recovery phrase, sign out and sign in again with it.

## Release-readiness checklist

Hana is ready for a wider public test when every box can be ticked from real sessions:

**Customer discovery**
- [ ] A first-time user finds a dish without knowing the business name.
- [ ] They can tell whether a business delivers to their zone.
- [ ] They can tell confirmed prices from unknown or out-of-date ones.

**Checkout**
- [ ] The subtotal, delivery fee and any unknown charges are clear.
- [ ] A pickup order asks no delivery questions.
- [ ] The unavailable-item choice and item notes appear in the message the business receives, on every channel.
- [ ] After a failed send or a late confirmation, the customer knows what to do next.

**Business owner**
- [ ] An owner finds and claims an existing listing without creating a duplicate.
- [ ] An owner updates a price and can say what customers will see.
- [ ] An owner accepts, declines and updates an order.
- [ ] An owner recovers access with the recovery phrase.

**Reliability and privacy**
- [ ] Saved baskets, addresses and orders survive an update.
- [ ] Hana opens offline after a visit and makes clear what may be out of date.
- [ ] A user understands when their location is sent to OpenStreetMap.
- [ ] The main flow works with large text and with a screen reader.
