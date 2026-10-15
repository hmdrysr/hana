# Adopting Hana for another region

Hana is built for Chittagong, but anyone may run it for another city or district under the MIT licence. These guidelines keep every regional version open, community-run and compatible, so that customers and businesses can trust any of them in the same way.

## Requirements

A regional version must:

1. **Be a separate, public repository.** Fork or copy this repository into a new public repository named for the region (for example `hana-sylhet`). Never run a region from a private repository or from a branch of another region.
2. **Be managed by its local community.** At least two maintainers who live in or work closely with the region, and at least two vouchers, listed in `VOLUNTEERS.md` and `vouchers.json` before the first business is listed. No single person, company or business may control the repository alone.
3. **Keep the founding commitments unchanged.** No commission, listing fee, paid placement or featured listing; cash on delivery only with no prepayment; all-inclusive prices; a capped delivery fee; confirmation within the set time; record keeping; no accounts, tracking or collection of customer data. A region may change the values in `rules.json` (the fee cap, for example) only by a recorded community decision.
4. **Keep the formats compatible.** Menu files, the order check line, confirmation lines and signatures stay exactly as specified in `SPEC.md`, so the business tools, `tools/check.py` and other regions' tools work unchanged.
5. **Use its own area list.** Replace `areas.json` with the region's city, zones and wards (or the local equivalents), each with a documented source and licence, reviewed by two local reviewers.
6. **Keep the credit and the licence.** Keep `LICENSE`, `AUTHORS.md` and the footer credit line ("Created using Hana by Hamid Yasir & Co." on a regional version).
7. **Adapt the legal text with local advice.** Rewrite `TERMS.md` for the region's law, consumer authority and courts, reviewed by someone qualified in that jurisdiction. Do not copy the Bangladesh terms unchanged into another country.
8. **Pass the checks.** `python3 tools/check.py` and `python3 tools/selftest.py` must pass on every change.
9. **Be served over https on a public host** (GitHub Pages, Codeberg Pages or any static host).

## Steps

1. Create the new public repository and copy this one into it.
2. Change `areas.json`, `rules.json` (if agreed), `TERMS.md`, `VOLUNTEERS.md`, `vouchers.json` and the region name in the README and the app's titles. Remove the Chittagong listings from `menus/` and `index.json`.
3. In `tools/check.py`, change the expected `city` value and the spelling rule to fit the region.
4. Publish the site and test it with `tools/browser_test.py`.
5. Ask to be listed: open a pull request on the Chittagong repository that adds the region to `regions.json` with its name, site address, repository and bounding box (west, south, east, north, in degrees). Two maintainers check that the requirements above are met.

## How customers reach the right region

`regions.json` lists every public regional directory. The app's Settings page has a "Find the Hana for my area" button: with the person's permission, the browser reads the phone's position, and the app compares it with the regions' boxes on the phone itself. No position is sent anywhere and no third-party location service is used. If the phone is inside another region's box, the app offers a link to that region.

## Removal

A region that stops meeting these requirements, for example by charging businesses or taking prepayment, is removed from `regions.json` by a recorded decision of the maintainers. The region's own repository stays under its licence, but it may not present itself as part of the Hana network.
