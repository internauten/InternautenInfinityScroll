# internauteninfinityscroll

PrestaShop module that replaces product listing pagination with infinite scroll.

## Features

- Hides default pagination on listing pages
- Loads next page automatically when user reaches the end of list
- Requests product pages with `n=20` by default to append 20 products per fetch
- Works on category, search, new products, prices drop, best sales, manufacturer, and supplier pages
- Includes module configuration in back office
- Supports theme profiles (auto, generic, classic, hummingbird, warehouse)
- Allows custom CSS selectors without changing code

## Installation

1. Copy the folder `internauteninfinityscroll` into your PrestaShop `modules/` directory.
2. Install and enable **Internauten Infinity Scroll** in back office.
3. Clear cache (`Advanced Parameters -> Performance`) if needed.

## Notes

- The module relies on standard pagination markup from modern themes.
- You can configure all selectors in module settings: no template override is required.

## Configuration

Open the module configuration page in back office and set:

- Products per request: default is 20 (range 1-100)
- Theme profile: auto-detection or explicit profile
- Product list selectors: one CSS selector per line
- Product item selector: single selector or comma-separated selectors
- Next page link selectors: one CSS selector per line
- Pagination container selectors: one CSS selector per line

Custom selectors are prioritized. Profile selectors are still used as fallback.

## License

This project is licensed under the MIT License. See details [`LICENSE`](LICENSE).

Copyright (c) 2026 die.internauten.ch GmbH
