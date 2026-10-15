# Food icons

`food.svg` holds the food and drink icons used for search categories, menu section tabs and dishes without a picture. Each `<symbol>` is an unmodified Twemoji graphic.

- Graphics: Twemoji, Copyright 2019 Twitter, Inc. and other contributors, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Project: https://github.com/jdecked/twemoji
- Taken from the npm package `@twemoji/svg` 15.0.0, whose package licence (MIT, for the packaging) is in `twemoji-package-LICENSE.txt`.

To add an icon, copy the SVG for the emoji's code point from that package into a new `<symbol id="name" viewBox="0 0 36 36">`, and add a row to `FOOD` in `core.js`.
