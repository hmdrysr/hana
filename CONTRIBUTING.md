# Contributing to Hana

Hana is an open, static food directory and order formatter for Chittagong, created by Hamid Yasir. It exists so that customers and restaurants keep their own choices, with no platform taking a cut (see "Why Hana exists" in `README.md`). Anyone can help. You do not need to write code, and you do not need a GitHub account for the simplest routes.

Status: design stage. Read `SPEC.md` first. Anything marked UNVERIFIED there still needs checking, and checking it is a useful contribution.

## Ways to help

| I want to... | Do this | Who reviews |
|---|---|---|
| List my restaurant | Use the "Add my restaurant" page, then send the ready message to a volunteer (no account needed), or open an **Add a restaurant** issue | One voucher |
| Fix or remove my listing | Publish a new signed menu version, then open an **Update or remove a listing** issue | One voucher |
| Report a wrong or false listing | Open a **Report a listing** issue | Two vouchers |
| Vouch for a restaurant | Become a voucher (see `GOVERNANCE.md`), then add a vouch file | One other voucher |
| Fix an area (Station or ward) | Open an **Area change** issue or a pull request on `areas.json` | Two local reviewers |
| Fix a bug or build a feature | Open an issue first, then a pull request | One maintainer |
| Test on a real phone | Open a **Phone test report** issue using the theme checklist | One maintainer |
| Improve the spec or docs | Pull request on `SPEC.md` or the docs | One maintainer; two for behaviour changes |

If you only have a phone and no GitHub account, message a volunteer. The contact list is kept in `VOLUNTEERS.md` (to be filled in by the first maintainers).

## Rules that apply to everything

1. **No personal data, ever.** Do not put customer or courier names, phone numbers, addresses, NID numbers or order details in issues, pull requests, commits or files. The only phone numbers allowed are a restaurant's own business number. Redact screenshots before you upload them.
2. **English only.** Write the city as "Chittagong". Use Canadian spelling in documents. Use plain, short sentences.
3. **Open source only.** No licensed, paid or key-gated API or SDK, and no code or file loaded from a CDN. A new dependency must follow `SPEC.md` section 2.1 and be recorded in `DEPENDENCIES.md` in the same pull request (name, version, licence, source address, date reviewed).
4. **Nothing is silently changed or lost.** History is kept. Do not force-push to the main branch. A removal is a new commit with a reason, not an erased file.
5. **Be honest about what you checked.** Say what you verified and how. Mark anything you did not verify as UNVERIFIED.
6. **Use the fixed theme.** Do not add colours, fonts, classes or inline styles. See `theme/UNIFORMITY.md`.
7. **Keep the founding commitments.** No commission, listing fee, paid placement, tracking, exclusivity or lock-in, and no change that takes a choice away from the customer or the restaurant. A pull request that does this is closed. See `GOVERNANCE.md` section 1.

## Before you open a pull request

1. Run `python3 tools/check.py` from the repo root. It must pass. It checks that files are well-formed. It does not yet verify signatures. If you change anything in `tools/`, also run `python3 tools/selftest.py`.
2. Fill in the pull request template.
3. Sign off your commits (`git commit -s`). This adds a line saying you wrote the change, or have the right to submit it, under the Developer Certificate of Origin (an open, published statement).
4. Keep each pull request to one purpose.

## Listings: what a good submission has

- The menu file is signed by the owner's key. A volunteer may host or submit the file, but cannot change it.
- The menu file's SHA-256 hash (over the exact bytes of the file) matches the hash in the index entry.
- Business phone, hours and delivery zones are filled in.
- Both pledges are signed by the owner.
- At least one working location (an https address that allows the app to read the file).
- A reference to the vouch, or a note that the listing is unverified until someone vouches.

## Fixing an area or adding a boundary

- Give the source of the boundary. If it comes from OpenStreetMap, say so, because OpenStreetMap data needs attribution under its licence. Do not copy boundaries from sources with unclear licences.
- Coordinates are WGS 84, longitude first, as GeoJSON requires. `tools/check.py` rejects values that look swapped.

## Security problems

Do not open a public issue. Follow `SECURITY.md`.

## Mirrors and forks

Hana has no owner and no required host. You can mirror or fork the repo anywhere (Codeberg, GitLab, a plain server). Changes to the shared directory should come back through a pull request to the canonical repo, so every mirror can read them. Which repo is canonical is still to be decided (see open items in `SPEC.md`).

## Licence

Hana is released under the MIT licence (`LICENSE`). By contributing you agree that your contribution is released under the same licence. You keep your copyright, and the DCO sign-off is the record of your right to submit. Do not contribute anything you cannot release under the MIT licence.

## Review

Reviewers are volunteers. There is no promised response time. If nobody has responded in two weeks, comment on the pull request.
