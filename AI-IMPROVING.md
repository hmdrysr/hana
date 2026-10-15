# Improving Hana with an AI assistant

Capable AI assistants, such as Claude, ChatGPT or Gemini on a paid plan, can review, fix and extend Hana well, because the project is small, uses plain files and has its own checks. This guide explains how to get good, safe results. The assistant does the typing; a person stays responsible for every change.

## 1. Give the assistant the whole picture

Give the assistant the repository: connect it to GitHub if it can read repositories, or upload the zip from **Code**, then **Download ZIP**. Ask it to read these first, in this order:

1. `README.md`: what Hana is
2. `SPEC.md`: how everything works, and why
3. `GOVERNANCE.md` and `TERMS.md`: the commitments that must not change without community agreement
4. `theme/UNIFORMITY.md`: the design rules
5. `AGENTS.md`: how assistants place orders

## 2. Rules to include in every request

Paste these with your request. They keep the assistant from breaking what makes Hana work:

```
Rules for this project:
- Payment is only on delivery or at pickup. Never add prepayment, online payment, deposits or wallets.
- Listed prices include all charges. The delivery fee is the only addition and is capped in rules.json.
- No accounts, no tracking, no analytics, no advertising and no paid or featured placement. Lists stay alphabetical.
- Only free, open-source code and open standards. No service that needs a sign-up or an API key.
- Keep it fast and offline-first: no frameworks or build step, plain HTML, CSS and JavaScript.
- Use only the classes allowed in theme/UNIFORMITY.md. No inline styles.
- Write in Canadian English with Canadian professional conventions: full sentences, plain words,
  "colour", "centre", "licence" (noun), dates like "October 15, 2026", times like "7 p.m.".
- Write the city as Chittagong.
- Never delete or rewrite past data, signatures or version history.
- Run python3 tools/check.py, python3 tools/selftest.py and the browser test before saying it is done,
  and report exactly what passed, what failed and what was not tested.
```

## 3. Ask for one change at a time

Small, specific requests give the best results. For example:

- "Read the restaurant page code in `app.js` and list layout problems on a 360-pixel-wide phone. Do not change anything yet."
- "Fix the first problem on that list. Show me the diff and the test results."
- "Add a test to `tools/browser_test.py` that would have caught that problem."
- "Review `TERMS.md` for unclear wording. Suggest changes; do not apply them."
- "Transcribe this menu photo into the menu line format in `business.js`, and list every price you could not read."

Avoid broad requests such as "make it better" or "rewrite the app". They produce large changes that are hard to review.

## 4. Check the work yourself

1. Run the checks, even if the assistant says it did:
   ```
   python3 tools/check.py
   python3 tools/selftest.py
   python3 -m http.server 8765   # in one terminal
   python3 tools/browser_test.py # in another
   ```
2. Open the app on a phone and try the change: search, open a business, add items, prepare an order, and switch between light and dark.
3. Read the diff. Reject anything that adds a tracker, an external service, a sign-up, a payment step or a dependency the assistant did not explain.
4. Check facts. Assistants can invent phone numbers, prices, laws and file names. Every fact in a listing needs a source, as `CONTRIBUTING.md` requires.

## 5. Submit it like any other change

Open a pull request as described in `CONTRIBUTING.md`. State in the description that an AI assistant helped, which one, and what you checked yourself. Maintainers review it the same way as any other contribution.

## What not to share with an assistant

Customer orders, phone numbers from orders, private keys (`hana_sign.py` key files) and anything from a business's private messages. The repository itself is public and safe to share.

## Free software and backwards compatibility

Every change must keep Hana free and open source, add no paid service or API key, and stay backwards compatible: older menus, orders, saved data and links keep working. New or untested tools go into `ROADMAP.md` first, with the conditions they must meet. See the rules at the top of `ROADMAP.md`.
