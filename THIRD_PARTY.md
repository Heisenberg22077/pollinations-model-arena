# Third-party assets

Model Table is MIT licensed. Reused assets retain their original notices.

## Pollinations artwork

Source: [pollinations/pollinations](https://github.com/pollinations/pollinations/tree/62d7cc4df19aef8a68363046330ab584fc2f6921), revision `62d7cc4df19aef8a68363046330ab584fc2f6921`. Extraction uses read-only GitHub CLI calls; [scripts/fetch-reference-art.mjs](scripts/fetch-reference-art.mjs) reproduces it.

| Local files, for both day and night     | Upstream files in `pollinations.ai/public/art` |
| --------------------------------------- | ---------------------------------------------- |
| `pollinations-garden-{mode}.webp`       | `home-hero-{mode}-1024.webp`                   |
| `pollinations-garden-{mode}-2048.webp`  | `home-hero-{mode}.webp`                        |
| `pollinations-closing-{mode}-1024.webp` | `home-closing-{mode}-1024.webp`                |
| `pollinations-closing-{mode}.webp`      | `home-closing-{mode}.webp`                     |

All eight WebP files remain byte-for-byte identical to their upstream sources. Their original Git blob hashes and paths are recorded in [public/art/PROVENANCE.json](public/art/PROVENANCE.json) and checked after building. The upstream MIT notice is included at [public/art/POLLINATIONS-LICENSE.txt](public/art/POLLINATIONS-LICENSE.txt). Crops, masks, blending, pointer movement and scroll effects are local implementation choices.

The Made with pollinations.ai badge uses the official upstream SVG. The favicon and app icons are Model Table assets. The social preview combines the project's layout with the credited garden and fonts; it contains no invented model responses.

## Geist fonts

Source: [vercel/geist-font](https://github.com/vercel/geist-font/tree/ef2597cfc42f4797676df105517ccc0a1cfa6569), revision `ef2597cfc42f4797676df105517ccc0a1cfa6569`. The three unmodified local WOFF2 files share the SIL Open Font License 1.1 notice in [public/fonts/Geist-OFL.txt](public/fonts/Geist-OFL.txt).

| Font               | Local file                             | Role                             |
| ------------------ | -------------------------------------- | -------------------------------- |
| Geist Pixel Square | `public/fonts/GeistPixel-Square.woff2` | Headline, wordmark and signature |
| Geist variable     | `public/fonts/Geist-Variable.woff2`    | Questions and answer text        |
| Geist Mono Regular | `public/fonts/GeistMono-Regular.woff2` | Controls and measurements        |

Uncut Sans, LCT Mogi and Fraunces are no longer distributed or loaded.

## Libraries and references

React, Motion and Lucide are MIT-licensed dependencies identified in `package.json` and its lockfile. Their original notices, including the bundled Motion helpers, are distributed in [public/licenses/LIBRARIES.txt](public/licenses/LIBRARIES.txt). Motion uses `domAnimation`; drag and layout feature bundles are not required.

Pollinations, dottxt, URV AI and Anthropic's imported design skills are credited as references in [DESIGN.md](DESIGN.md). No dottxt commercial fonts, URV AI assets or skill runtime are shipped. Surprise me questions are original writing; their conceptual research sources are in [docs/surprise-questions.md](docs/surprise-questions.md).
