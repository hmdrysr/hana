# Governance

Status: proposed. The numbers below are starting points. Change them by the process in section 4.

Hana has no owner and no required host. Anyone can fork or mirror it. These rules govern only the canonical repo and its shared directory (`index.json`, `areas.json`, `menus/`, `vouches/`).

## 1. Founding commitments

These come from the reasons Hana exists (see `README.md`):

1. No commission and no listing fee.
2. No paid placement, paid ranking or featured restaurants. Lists are alphabetical.
3. No exclusivity or lock-in. A restaurant can leave, and customers can export their data.
4. Restaurants set their own prices, fees, delivery zones and hours.
5. Customers choose how to order and what to share.
6. No accounts, tracking or collection of customer data.
7. Open source and open formats only.
8. The creator is credited (`AUTHORS.md`).
9. Every price change is public, announced inside the menu file and kept in its history.
10. One delivery charge per area, fixed by the business and within the limit in `rules.json`. The app adds no fee, surge or distance pricing.
11. Cash on delivery only. Prepayment is never allowed.
12. Every price includes VAT and every other charge.
13. An order is valid only when the business confirms it.

The community verifies claimed listings and reviews them regularly (`CLAIMS.md`).

A pull request that breaks one of these is closed. Changing a commitment needs all maintainers to agree and a public notice open for 30 days.

## 2. Roles

- **Maintainers** review code, spec and docs, and merge. Proposed: at least three, from more than one organization or household, so no single person controls the repo.
- **Vouchers** are local members who check that a restaurant is real, for example by visiting it. They sign vouch files. A maintainer approves a new voucher after two existing vouchers back them. The list is `vouchers.json`.
- **Contributors** are everyone else.

A voucher cannot vouch for a business they own, work for or are related to. Maintainers declare conflicts on any review.

## 3. Decisions

| Change | Needs | Notes |
|---|---|---|
| Add a restaurant listing | 1 voucher | Owner's signature on the menu is required |
| Update a listing | Owner's new signed version, 1 voucher | |
| Remove a listing at the owner's request | 1 maintainer | |
| Remove a listing for a false pledge or fake zones | 2 vouchers, owner told, 14 days to respond | Immediate for a safety reason, with a recorded explanation |
| Change `areas.json` | 2 local reviewers | Source and licence of boundary data stated |
| Code, theme, docs | 1 maintainer | |
| Behaviour change in `SPEC.md` | 2 maintainers, open 7 days | |
| Add a dependency | 1 maintainer | Must follow `SPEC.md` section 2.1 |
| Theme change (frozen for version 1) | 2 maintainers and a recorded decision | |
| Add a voucher | 2 vouchers and 1 maintainer | |
| Change this file | All maintainers, open 30 days if it touches section 1 | |

## 4. Records

Every decision is in the repo history. Do not rewrite history. A removal states a reason. A reversal is a new commit.

## 5. Disputes about listings

Hana does not settle disputes between customers and restaurants. Customers go to the public bodies in `SPEC.md` section 9. Maintainers act only on the directory: warning, flagging or removing a listing that breaks the rules.

An owner can appeal a removal by opening an issue. Two people who were not involved in the removal review it.

## 6. Conduct and safety

See `CODE_OF_CONDUCT.md`. A report that a person is in danger goes to the police, not to a maintainer. See `SPEC.md` section 9.

## 7. Forks

A fork is free to follow its own rules. A fork that wants to share the directory with the canonical repo keeps the founding commitments in section 1, otherwise it should not list itself in `peers.json`.
