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

Horizontal model rows contain inline overscroll and use 16px scroll padding. Mobile rows also have real 16px edge gutters so the first and last models keep their spacing at the scroll limits. Snap stops remain normal; the metrics scroller also contains inline overscroll.

The actual `.model-card` panes use `content-visibility: auto` and remembered intrinsic sizes. Fallback content heights are 548px on desktop and 498px on phones, accounting for borders and preserving the established 550/500px card heights. Expanded panes retain their rendered height when skipped, and focused content/native image dialogs remain usable. [web.dev's content-visibility guide](https://web.dev/articles/content-visibility) explains that the browser can "remember the last-rendered size" with `auto`.

| Element       | Final behavior                                                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page arrival  | Ordered headline, artwork, composer and lineup entrance; panes reveal once on entering view with a bouncy spring and 40ms roster stagger.                                                                   |
| Garden scenes | Slow 9-second drift, six rising pollen particles, spring pointer response and CSS view-timeline movement during native document scrolling. Hidden and offscreen ambient scenes pause.                       |
| Model panes   | Hover lifts the pane 2px and strengthens the provider rule and header tint. Sorting refreshes opacity in place over 180ms, keeping answers contained.                                                       |
| FLUX image    | Image fits its frame at rest. Hover zooms within the frame and reveals View image. Clicking it or Expand opens a native dialog with Escape, focus containment and focus return.                             |
| Disclosures   | Guide, extra models, history and metrics use transform/opacity springs with one native layout change. Exiting content is inert. Answer expansion retains native sizing and fades/translates the text layer. |
| Small signals | Preset highlight glides; model checks and copy icons pop; Surprise dice rolls; starter pills float and compress; the composer glow fades; pending indicators breathe. Navigation/headline decoding remains. |
| Theme         | Surfaces and artwork crossfade; the theme icon springs through rotation/scale. The brand symbol wobbles on hover. Theme preference persists before first paint.                                             |

Motion 14 uses lightweight `m` components and `LazyMotion` with `domMax`, enabling the preset's shared `layoutId` spring. The highlight lives inside the active button; manual DOM measurements and resize observers are removed. A single active preset prevents duplicate shared IDs when provider outages make preset lineups equivalent. Motion's [layout documentation](https://motion.dev/docs/react-layout-animations) states: "Motion performs all layout animations using the CSS `transform` property".

Model toggles lift 2px with 1.015 scale on fine pointers and compress to 0.96 on tap. Three exact CSS spring curves were extracted from the live Jake Archibald / Adam Argyle generator; [docs/spring-motion.md](docs/spring-motion.md) records inputs, mathematical overshoot and playback durations. Provider rules scale instead of changing height; color/border/shadow state changes are immediate. Disclosures change native flow once and animate translation/opacity. A layout group lets results follow the roster through position projection. Answer expansion animates the text layer without resizing it each frame. The browser's root view-transition geometry interpolation is disabled; theme snapshots crossfade opacity. `overflow: clip` crops artwork without introducing a nested scroll source that would break its view timeline. Browsers without timeline support retain ambient and pointer motion.

The persistent **Pause animations** control is available in the desktop header and mobile menu. It and the system reduced-motion preference disable CSS, native animations, decoding and springs, including when preferences change during a session. A native media-query subscription updates the interface immediately. Both settings apply before first paint.

## Critique and verification

The small footer garden did not carry enough of Pollinations' character. A full-screen hero would move the comparison out of the requested 1080p view, so the final composition uses a compact but substantial hero scene and a separate wide ending. Ambient motion is concentrated in artwork and small signals; answers stay readable while interaction effects explain changes.

Day/night screenshots and intermediate motion frames were visually inspected. Layout checks covered 320, 390, 768, 1024, 1440, 1680 and 1920px without page overflow. The real official account widget and its menus were also checked at 1920, 390 and 320px in both themes. Image-dialog keyboard behavior, rapid expansion reversals, pause persistence and runtime reduced-motion changes passed.

The final 25 instrumented headless Chromium motion profiles passed compositor-only animation, interruption recovery, pause and reduced-motion checks. Profile medians ranged from approximately 16.7ms to 33.3ms; p95 reached 50.1ms, with 31 intervals above 34ms, an 83.4ms theme-switch maximum and one 53ms long task during pending-card arrivals. Timing was collected separately from screenshots and video. These local measurements do not establish sustained 60fps or 120fps.

Every model now has a current local SVG mark in its selector and card. Fixed 18px control and 22px card boxes preserve proportions; monochrome marks switch between black and white, while color marks retain their original artwork. [docs/model-logos.md](docs/model-logos.md) records the verified LobeHub snapshot and official Mistral Small 4 emblem.

Browser regression results, the initial live six-model comparison, build budgets, screenshot provenance and the local handoff are recorded in [HANDOFF.md](HANDOFF.md).
