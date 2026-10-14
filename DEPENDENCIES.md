# Dependencies

Every dependency is listed here with its licence. See `SPEC.md` section 2.1. Nothing has been checked against current licences beyond what is noted.

| Name | Version | Licence | Source | Used for | Reviewed |
|---|---|---|---|---|---|
| Beer CSS | 5.0.3 (npm `beercss`, published August 4, 2026) | MIT (read from the package and its licence file, `theme/beer-LICENSE.md`) | https://github.com/beercss/beercss | Base styles for the fixed theme. `dist/cdn/beer.min.css` copied to `theme/beer.min.css`, with the four Material Symbols `@font-face` rules removed | 2026-10-15 |
| Material Symbols subset font | from the Beer CSS 5.0.3 package (`material-symbols-subset.woff2`, 1,908 bytes) | Apache License 2.0 (Material Symbols licence; UNVERIFIED that the subset file carries no other terms) | https://github.com/google/material-design-icons | Glyphs that Beer CSS uses to draw checkboxes, radio buttons and switches | 2026-10-15 |
| Material Symbols SVG outlines | 0.47.5 (npm `@material-symbols/svg-400`, published September 22, 2026) | Apache License 2.0 (read from the package, `theme/material-symbols-LICENSE.txt`) | https://github.com/marella/material-symbols | Path data for 22 interface icons, stored in `app.js` | 2026-10-15 |
| Noto Color Emoji (artwork of the takeout box 🥡 in `icon-192.png` and `icon-512.png`) | font file on the build machine | SIL Open Font License 1.1 (UNVERIFIED: read the licence of the font file that was installed) | https://github.com/googlefonts/noto-emoji | The home screen icon is a picture of the 🥡 emoji. In the app the emoji is drawn by the phone's own emoji font, which is not shipped here | 2026-10-15 |
