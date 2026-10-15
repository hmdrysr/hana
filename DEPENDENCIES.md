# Dependencies

Every dependency is listed here with its licence. See `SPEC.md` section 2.1. Nothing has been checked against current licences beyond what is noted.

| Name | Version | Licence | Source | Used for | Reviewed |
|---|---|---|---|---|---|
| Beer CSS | 5.0.3 (npm `beercss`, published August 4, 2026) | MIT (read from the package and its licence file, `theme/beer-LICENSE.md`) | https://github.com/beercss/beercss | Base styles for the fixed theme. `dist/cdn/beer.min.css` copied to `theme/beer.min.css`, with the four Material Symbols `@font-face` rules removed | 2026-10-15 |
| Material Symbols subset font | from the Beer CSS 5.0.3 package (`material-symbols-subset.woff2`, 1,908 bytes) | Apache License 2.0 (Material Symbols licence; UNVERIFIED that the subset file carries no other terms) | https://github.com/google/material-design-icons | Glyphs that Beer CSS uses to draw checkboxes, radio buttons and switches | 2026-10-15 |
| Hana logo (smiling rice ball, `logo.svg`, and the icons made from it) | drawn for Hana, October 2026 | MIT, with the rest of the project | this repository | Logo, favicon and app icons | 2026-10-15 |
| Twemoji food icons | 15.0.0 (npm `@twemoji/svg`) | Graphics CC BY 4.0 (Twitter, Inc. and contributors); packaging MIT (`icons/twemoji-package-LICENSE.txt`) | https://github.com/jdecked/twemoji | 38 food and drink icons in `icons/food.svg`, unmodified | 2026-10-15 |
| Material Symbols SVG outlines | 0.47.5 (fingerprint and logout added from 0.48.0) (npm `@material-symbols/svg-400`, published September 22, 2026) | Apache License 2.0 (read from the package, `theme/material-symbols-LICENSE.txt`) | https://github.com/marella/material-symbols | Path data for 40 interface icons, stored in `core.js` | 2026-10-15 |
| BIP-39 English word list (`vault-words.txt`) | 2,048 words, copied from the Python `mnemonic` 0.21 package (Trezor) | MIT (the list is from the Bitcoin BIP-39 proposal) | https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt | Five-word recovery phrases for business sign-in (`vault.js`) | 2026-10-15 |
| qrcode-generator (`vendor/qrcode-generator-2.0.4.min.js`) | 2.0.4 (npm, minified with terser 5.31.0) | MIT (licence header kept in the file) | https://github.com/kazuhikoarase/qrcode-generator | QR poster in the business tools, loaded only on that page | 2026-10-16 |
| OpenStreetMap map tiles (`tile.openstreetmap.org`) | live service, zoom 17, up to 6 tiles per map | Map data ODbL; tiles under the OpenStreetMap tile usage policy (attribution shown under the map) | https://operations.osmfoundation.org/policies/tiles/ | The map under "Add a map pin for the rider", loaded only after the customer adds a pin | 2026-10-16 |
