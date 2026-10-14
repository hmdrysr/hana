# Theme checks

Results of the theme checklist in `SPEC.md`, section 3.1. Each entry gives the date, the device and browser, what was checked and the result. Nothing here was checked on a real phone.

## October 15, 2026 (updated): desktop Chromium 141 (headless, Playwright), phone-sized windows

| Check | How | Result |
|---|---|---|
| No sideways scrolling | `tools/browser_test.py`: the five customer screens and the four business tools screens at 320, 360, 768 and 1280 pixels wide, light and dark | Pass |
| 200 percent text | Same screens with the root font size set to 200 percent | Pass: no sideways scrolling. On the bottom bar, labels are shortened with an ellipsis and the icons shrink. |
| Text contrast (WCAG 2.2 AA) | Contrast ratios computed from `theme/theme.css` for every text and background pair the app uses | Pass: lowest text pair is 6.63:1 (light, primary on surface-container-low); the outline colour is 4.28:1 (light), above the 3:1 needed for borders |
| Tap targets | Measured height of add buttons, navigation items, quantity buttons | Pass: at least 40 pixels |
| Script errors | Page errors recorded during the browser test | None |
| Colour-mode toggle | Browser test: the toggle cycles through phone setting, light and dark | Pass |
| Signatures in the browser | Chromium 141: a key created and a menu and confirmation signed on the business tools page were accepted by `tools/hana_sign.py` and `tools/order_line.py`; a changed confirmation was refused | Pass in Chromium only. Older browsers may not support Ed25519. |
| Works offline after the first visit | Not tested | Not checked |
| Low-end Android phone and older Android browser | Not tested | Not checked. Beer CSS uses `:is()` and `:has()`; browsers released before 2023 may ignore those rules. |
| Screen reader | Not tested | Not checked. Landmarks, labels and `aria-label`s are in place, but no screen reader was run. |
| Keyboard only | Not tested end to end | Not checked. A visible focus ring is set in `theme/theme.css`. |
| Browser translation | Not tested | Not checked |
| Page weight | Measured file sizes | About 150 KB uncompressed for the page, script, styles and font, before menu files. No budget has been set yet. |
