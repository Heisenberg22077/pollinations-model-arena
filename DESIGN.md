# Model Table design

Model Table compares independent answers to one question, with real response times, tokens and Pollen costs. Its final frontend combines dottxt's expressive pixel typography and square framing with Pollinations' garden artwork, softer colors and playful movement. The comparison remains the primary workspace.

## References and extraction

References were inspected on 2026-11-08.

- [Pollinations](https://pollinations.ai/?ref=badge) supplied the pollen-yellow action color and large day/night gardens. Firecrawl captured its live homepage, HTML, image inventory, branding and screenshot. Its main garden sits beside the headline; a separate wide scene closes the page.
- Read-only GitHub CLI calls extracted eight original WebP assets from [pollinations/pollinations](https://github.com/pollinations/pollinations/tree/62d7cc4df19aef8a68363046330ab584fc2f6921), revision `62d7cc4df19aef8a68363046330ab584fc2f6921`. [scripts/fetch-reference-art.mjs](scripts/fetch-reference-art.mjs) reproduces the extraction; [public/art/PROVENANCE.json](public/art/PROVENANCE.json) records paths, bytes and Git blob hashes.
- [dottxt](https://dottxt.ai/) informed the thin frames, small square controls, pixel headline and decoding effects. Live inspection covered 1920×1080 and 390×844 layouts, three navigation hover menus, four terminal interactions, scrolling and video. Its terminal uses mock calls. Its commercial fonts and product copy were not reused.
- [URV AI](https://urv-ai.vercel.app/) informed the quiet night composition. Its live page and screenshot were inspected; no public source link was present. Its assets and copy were not reused.
- Anthropic's [frontend-design](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/frontend-design) and [theme-factory](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/theme-factory) were imported into the owner's local Codex skills directory. The supplied references and authorization guided the custom theme, followed by rendered critique.
- Context7 supplied current Motion documentation. [web.dev's animation guide](https://web.dev/articles/animations-guide) informed transform/opacity choices and separate timing measurements. [MDN's view timeline reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline/view) informed native scroll-linked movement and its fallback.

Research captures remain in ignored `.firecrawl/`. The implementation plan is in [docs/frontend-design-plan.md](docs/frontend-design-plan.md); reuse and license details are in [THIRD_PARTY.md](THIRD_PARTY.md).

## Palette and typography

Muted cream surfaces reduce the glare of the earlier white page. A blue question field distinguishes the next prompt from submitted answers. Yellow identifies actions and selection; provider colors identify models. The night theme carries the same hierarchy with warm dark surfaces and cream text.

| Role             | Day       | Night     |
| ---------------- | --------- | --------- |
| Canvas           | `#D8CFC0` | `#161411` |
| Main surface     | `#E9E2D4` | `#211E19` |
| Recessed surface | `#DCD3C3` | `#2A261F` |
| Question input   | `#DCE5EF` | `#232C32` |
| Text             | `#272117` | `#E9E2D4` |
| Secondary text   | `#665B4A` | `#B4AA97` |
| Border           | `#8C816F` | `#574F44` |
| Pollen action    | `#FFD76D` | `#FFD76D` |

Three locally hosted Geist files have distinct roles: Pixel Square for the headline, wordmark and closing signature; variable Sans for questions, names and answers; Mono Regular for controls and measurements. They retain the original OFL notice. Uncut Sans, LCT Mogi and Fraunces are no longer loaded or distributed.

At 1920px, the headline is approximately 90px, the question input 24px, model names 20px and answers 16px with a 1.6 line height. Answer lines are capped at 75 characters. The requested copy retains its capitalization and explicit line breaks: **One Question. Every Model.** and **Curiosity, Multiplied.** Word spacing and separate lines keep the phrases legible.

## Composition and responsive behavior

The page uses a framed workbench, capped at 2080px, with 16px outer margins on desktop. The header holds navigation, motion/theme controls, the official account widget and Run/Stop. The hero puts headline, garden and question composer together; the model lineup and comparison follow directly below.

- At 1680px and above, the hero has three columns and the core lineup has six answer panes in one row. Smaller desktop widths place the garden below the headline beside the composer. Tablets put headline and artwork above the composer; phones stack all three.
- Comparison panes use one column below 680px, two from 680px, three from 1100px and six from 1680px, adjusted for smaller selected lineups. Mobile model chips scroll within their row without making the page overflow.
- At 1920×1080, the six core panes measure approximately 296.3×550px, beginning at y=527 and ending at y=1077. Each text answer has a 308.5px reading area. Cards retain their dimensions across empty, pending, success and error states; Expand reveals longer answers.
- The hero scene is approximately 423×244px at 1920px. The separate closing scene measures approximately 1213×440px. Its artwork is lazy loaded and scales down with the closing signature.
- A fixed mobile Run/Stop bar keeps the action accessible. Running a comparison brings answers into view. The native mobile navigation menu closes when resizing to desktop.
- The optional metrics table follows the answer sort order, uses aligned numerical columns and supports keyboard scrolling on small screens. The guide, extra models and recent questions expand in place.

Artwork uses original 1024/2048 variants selected through `srcset`. Feathered edges and day/night blending integrate the existing artwork backgrounds. The closing banner retains the canvas background so blending does not produce a bright rectangular surface. Decorative gardens are marked `aria-hidden` and remain separate from generated FLUX answers.

The submitted question stays attached to its comparison while the next prompt or lineup changes. Surprise me draws from 36 original researched questions without repeats until its cycle is exhausted; selecting a prompt makes no API request.

## Motion and interaction

| Element       | Final behavior                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page arrival  | Ordered headline, artwork, composer and lineup entrance; panes reveal once on entering view, staggered by roster order.                                                                                                  |
| Garden scenes | Slow 9-second drift, six rising pollen particles, spring pointer response and CSS view-timeline movement during native document scrolling. Hidden and offscreen ambient scenes pause.                                    |
| Model panes   | Hover lifts the pane 4px and strengthens the provider rule and header tint. Sorting refreshes opacity in place over 180ms, keeping answers contained.                                                                    |
| FLUX image    | Image fits its frame at rest. Hover zooms within the frame and reveals View image. Clicking it or Expand opens a native dialog with Escape, focus containment and focus return.                                          |
| Disclosures   | Height springs for guide, extra models, history and metrics; interrupted or reversed interactions return to the correct state. Answer expansion cancels stale animation work and restores its original collapsed height. |
| Small signals | Preset highlight glides between selections; navigation and Surprise me decode on hover; the headline decodes every 14 seconds; prompt and pending states provide feedback.                                               |
| Theme         | Surfaces and artwork crossfade between day and night. Theme preference persists and applies before first paint.                                                                                                          |

Motion 14 uses `LazyMotion` with `domAnimation`. The larger drag/layout feature bundle is unnecessary. Transform and opacity handle artwork and hover movement; disclosures animate actual height to show the space being opened. `overflow: clip` crops artwork without introducing a nested scroll source that would break its view timeline. Browsers without timeline support retain ambient and pointer motion.

The persistent **Pause animations** control is available in the desktop header and mobile menu. It and the system reduced-motion preference disable CSS, native animations, decoding and springs, including when preferences change during a session. A native media-query subscription updates the interface immediately. Both settings apply before first paint.

## Critique and verification

The small footer garden did not carry enough of Pollinations' character. A full-screen hero would move the comparison out of the requested 1080p view, so the final composition uses a compact but substantial hero scene and a separate wide ending. Ambient motion is concentrated in artwork and small signals; answers stay readable while interaction effects explain changes.

Day/night screenshots and intermediate motion frames were visually inspected. Layout checks covered 320, 390, 768, 1024, 1440, 1680 and 1920px without page overflow. The real official account widget and its menus were also checked at 1920, 390 and 320px in both themes. Image-dialog keyboard behavior, rapid expansion reversals, pause persistence and runtime reduced-motion changes passed.

Fourteen instrumented headless Chromium motion profiles recorded approximately 16.7ms median frame intervals and 16.7–16.8ms p95, with no sampled intervals over 34ms or observed long tasks. Timing was collected separately from screenshots and video. These are local Chromium measurements, not a guarantee for every device or browser.

Browser regression results, a fresh live six-model comparison, build budgets, screenshot provenance and the local handoff are recorded in [HANDOFF.md](HANDOFF.md).
