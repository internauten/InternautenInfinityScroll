# internauteninfinityscroll

[![Release Workflow](https://img.shields.io/github/actions/workflow/status/internauten/InternautenInfinityScroll/tag-release.yml?label=release%20workflow)](https://github.com/internauten/InternautenInfinityScroll/actions/workflows/tag-release.yml)
[![Latest Release](https://img.shields.io/github/v/release/internauten/InternautenInfinityScroll?display_name=tag)](https://github.com/internauten/InternautenInfinityScroll/releases)
[![Release Date](https://img.shields.io/github/release-date/internauten/InternautenInfinityScroll)](https://github.com/internauten/InternautenInfinityScroll/releases)
[![Tag](https://img.shields.io/github/v/tag/internauten/InternautenInfinityScroll)](https://github.com/internauten/InternautenInfinityScroll/tags)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[![Last Commit](https://img.shields.io/github/last-commit/internauten/InternautenInfinityScroll)](https://github.com/internauten/InternautenInfinityScroll/commits/main)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/internauten/InternautenInfinityScroll)](https://github.com/internauten/InternautenInfinityScroll/graphs/commit-activity)
[![Contributors](https://img.shields.io/github/contributors/internauten/InternautenInfinityScroll)](https://github.com/internauten/InternautenInfinityScroll/graphs/contributors)
[![Open Issues](https://img.shields.io/github/issues/internauten/InternautenInfinityScroll)](https://github.com/internauten/InternautenInfinityScroll/issues)
[![Open PRs](https://img.shields.io/github/issues-pr/internauten/InternautenInfinityScroll)](https://github.com/internauten/InternautenInfinityScroll/pulls)

[![Stars](https://img.shields.io/github/stars/internauten/InternautenInfinityScroll?style=flat)](https://github.com/internauten/InternautenInfinityScroll/stargazers)
[![Forks](https://img.shields.io/github/forks/internauten/InternautenInfinityScroll?style=flat)](https://github.com/internauten/InternautenInfinityScroll/network/members)
[![Repo Size](https://img.shields.io/github/repo-size/internauten/InternautenInfinityScroll)](https://github.com/internauten/InternautenInfinityScroll)
[![Code Size](https://img.shields.io/github/languages/code-size/internauten/InternautenInfinityScroll)](https://github.com/internauten/InternautenInfinityScroll)
[![Top Language](https://img.shields.io/github/languages/top/internauten/InternautenInfinityScroll)](https://github.com/internauten/InternautenInfinityScroll)

[![PrestaShop](https://img.shields.io/badge/PrestaShop-1.7%2B-blue)](https://www.prestashop.com/)
[![PHP](https://img.shields.io/badge/PHP-7.2%2B-777BB4?logo=php&logoColor=white)](https://www.php.net/)
[![Module Type](https://img.shields.io/badge/type-front--office%20module-0A7B83)](https://github.com/internauten/InternautenInfinityScroll)
[![Feature](https://img.shields.io/badge/feature-infinite%20scroll-1f8b4c)](https://github.com/internauten/InternautenInfinityScroll)

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

## Release and Tags

This repository includes:

- A GitHub Action that creates releases from valid version tags
- A helper script to create tags from the module version automatically

### Allowed release tags

- `v1.2.3`
- `v1.2.3-rc.1`

Workflow file: `.github/workflows/tag-release.yml`

### Tag helper script

Script file: `scripts/create-tags-from-module-version.sh`

The script reads `$this->version` from `internauteninfinityscroll/internauteninfinityscroll.php`, creates an annotated tag like `v0.0.1`, and pushes it to `origin`.

Examples:

```bash
# Validate without creating tags
./scripts/create-tags-from-module-version.sh --dry-run

# Create and push tag v<version>
./scripts/create-tags-from-module-version.sh

# Also create plain tag <version> in addition to v<version>
./scripts/create-tags-from-module-version.sh --also-plain-tag
```

### Safety checks in script

- Fails if module version is missing or not valid semver (`1.2.3` or `1.2.3-rc.1`)
- Fails if target tag already exists
- Fails on non-dry-run if repository has uncommitted changes

## License

This project is licensed under the MIT License. See details [`LICENSE`](LICENSE).

Copyright (c) 2026 die.internauten.ch GmbH
