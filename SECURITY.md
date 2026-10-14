# Security

## Report a problem privately

Do not open a public issue for a security problem. Use the repo's private vulnerability reporting if the host offers it (UNVERIFIED: check that it is turned on), or the security contact in `VOLUNTEERS.md`.

## What counts

- A menu file that makes the app show scripts, HTML or styles (the app must show restaurant text as plain text only).
- A way to make the app accept a menu with a bad hash or bad signature.
- A way to take over a restaurant's listing without its key.
- Anything that sends a customer's location, address, phone number or orders off the device.
- A dependency with a known serious flaw.
- A leak of private data in the repo history.

## What to include

What you found, how to repeat it, and what it could do. Do not include anyone's real private data.

## What to expect

Reports are handled by volunteers. There is no bounty and no promised response time. Maintainers will aim to confirm a report and fix it promptly, and will credit you if you want to be named.

## Private data found in the repo

If personal data was committed by mistake, report it the same way. Removing it from history is the one case where history is rewritten, and the removal is recorded in a public note that says what kind of data was removed, without repeating it.
