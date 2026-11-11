# Model Table design

Model Table compares independent answers to one question, with real response times, tokens and Pollen costs. Its final frontend combines dottxt's expressive pixel typography and square framing with Pollinations' garden artwork, softer colors and playful movement. The comparison remains the primary workspace.

## References and extraction

References were inspected on 2026-11-08.

- [Pollinations](https://pollinations.ai/?ref=badge) supplied the pollen-yellow action color and large day/night gardens. Firecrawl captured its live homepage, HTML, image inventory, branding and screenshot. Its main garden sits beside the headline; a separate wide scene closes the page.
- Read-only GitHub CLI calls extracted eight original WebP assets from [pollinations/pollinations](https://github.com/pollinations/pollinations/tree/62d7cc4df19aef8a68363046330ab584fc2f6921), revision `62d7cc4df19aef8a68363046330ab584fc2f6921`. [scripts/fetch-reference-art.mjs](scripts/fetch-reference-art.mjs) reproduces the extraction; [public/art/PROVENANCE.json](public/art/PROVENANCE.json) records paths, bytes and Git blob hashes.
- [dottxt](https://dottxt.ai/) informed the thin frames, small square controls, pixel headline and decoding effects. Live inspection covered 1920×1080 and 390×844 layouts, three navigation hover menus, four terminal interactions, scrolling and video. Its terminal uses mock calls. Its commercial fonts and product copy were not reused.
- [URV AI](https://urv-ai.vercel.app/) informed the quiet night composition. Its live page and screenshot were inspected; no public source link was present. Its assets and copy were not reused.
- Anthropic's [frontend-design](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/frontend-design) and [theme-factory](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/theme-factory) were imported into the owner's local Codex skills directory. The supplied references and authorization guided the custom theme, followed by rendered critique.
- The current animation audit used live official GSAP and Lenis documentation, registry metadata and CDN verification; [docs/arena-motion-research.md](docs/arena-motion-research.md) logs all four discovery checks. Earlier Context7 Motion research belongs to the previous implementation. [web.dev's animation guide](https://web.dev/articles/animations-guide) informed transform/opacity choices and separate timing measurements. [MDN's view timeline reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline/view) informed native scroll-linked movement and its fallback.

Research captures remain in ignored `.firecrawl/`. The implementation plan is in [docs/frontend-design-plan.md](docs/frontend-design-plan.md); reuse and license details are in [THIRD_PARTY.md](THIRD_PARTY.md).

## Palette and typography

Muted cream surfaces reduce the glare of the earlier white page. A blue question field distinguishes the next prompt from submitted answers. Yellow identifies actions and selection; provider colors identify models. The night theme carries the same hierarchy with warm dark surfaces and cream text.

| Role             | Day       | Night     |
| ---------------- | --------- | --------- |
| Canvas           | `#F4EFE6` | `#1C1B18` |
| Main surface     | `#F8F4EC` | `#211E19` |
| Recessed surface | `#EEE8DB` | `#2A261F` |
| Question input   | `#DCE5EF` | `#232C32` |
| Text             | `#272117` | `#E9E2D4` |
| Secondary text   | `#665B4A` | `#B4AA97` |
| Border           | `#8C816F` | `#574F44` |
| Pollen action    | `#FFE680` | `#FFE680` |

Three locally hosted Geist files have distinct roles: Pixel Square for the headline, wordmark and closing signature; variable Sans for questions, names and answers; Mono Regular for controls and measurements. They retain the original OFL notice. Uncut Sans, LCT Mogi and Fraunces are no longer loaded or distributed.

At 1920px, the headline is approximately 90px, the question input 24px, model names 20px and answers 16px with a 1.6 line height. Answer lines are capped at 75 characters. The requested copy retains its capitalization and explicit line breaks: **One Question. Every Model.** and **Curiosity, Multiplied.** Word spacing and separate lines keep the phrases legible.

## Composition and responsive behavior

The page uses a framed workbench, capped at 2080px, with 16px outer margins on desktop. The header holds navigation, motion/theme controls, the official account widget and Run/Stop. The hero puts headline, garden and question composer together; the model lineup and comparison follow directly below.

- At 1680px and above, the hero has three columns with the comparison arranged in three columns. Smaller desktop widths place the garden below the headline beside the composer. Tablets put headline and artwork above the composer; phones stack all three.
- Comparison panes use one column below 680px, two from 680px, three from 1100px through wider desktop sizes, adjusted for smaller selected lineups. Mobile model chips scroll within their row without making the page overflow.
- The core lineup forms two rows of three cards on desktop. Reading panes keep their natural 550px desktop / 500px phone minimum height across pending, success and error states; Flip transforms explain layout changes and Expand reveals longer answers.
- The hero scene is approximately 423×244px at 1920px. The separate closing scene measures approximately 1213×440px. Its artwork is lazy loaded and scales down with the closing signature.
- A fixed mobile Run/Stop bar keeps the action accessible. Running a comparison brings answers into view. The native mobile navigation menu closes when resizing to desktop.
- The optional metrics table follows the answer sort order, uses aligned numerical columns and supports keyboard scrolling on small screens. The guide, extra models and recent questions expand in place.

Artwork uses original 1024/2048 variants selected through `srcset`. Feathered edges and day/night blending integrate the existing artwork backgrounds. The closing banner retains the canvas background so blending does not produce a bright rectangular surface. Decorative gardens are marked `aria-hidden` and remain separate from generated FLUX answers.

The submitted question stays attached to its comparison while the next prompt or lineup changes. Surprise me draws from 36 original researched questions without repeats until its cycle is exhausted; selecting a prompt makes no API request.

## Motion and interaction

One application-owned GSAP ticker drives Lenis, canvas pollen, visual decoding and passive request timers. Effects are created in matchMedia contexts; custom listeners, observers, Lenis and subscriptions clean up on pause, runtime reduced motion and unmount. A coarse timer maintains telemetry if the CDN fails.

| Scene    | Behavior                                                                                                                                                                                                                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrival  | Masked SplitText characters decode as they rise; navigation, garden, composer and lineup overlap. Settled transforms are cleared so mobile fixed controls retain their positioning.                                                                                                                                              |
| Garden   | Forty canvas pollen squares drift and respond to pointer velocity; Surprise and winners emit bounded pixel bursts. Existing artwork transform layers supply foreground/background parallax. Ambient work pauses offscreen or in hidden tabs.                                                                                     |
| Pointer  | Fine-pointer quickTo magnets and a pixel reticle; separate card arrival, tilt and outer Flip planes prevent transform conflicts. Provider colors drive a subtle spotlight.                                                                                                                                                       |
| Layout   | Stable model Flip IDs; state capture before React mutation and playback after commit. Departing visual clones are inert, aria-hidden and removed after interruption/completion. Resizing clears in-progress geometry. Submitted results retain their original lineup.                                                            |
| Drawers  | CSS Grid 0fr/1fr tweens, staggered content, inert closing panels and refreshed scroll measurements. Native summary, focus, popover and dialog interactions remain.                                                                                                                                                               |
| Theme    | Ninety-six square blocks cover the viewport; the target theme applies at the covered midpoint. Rapid reversals and pauses settle the latest request and hide the clipped curtain.                                                                                                                                                |
| Requests | Timers begin at dispatch, preserve queue/retry semantics and update text directly without whole-card rerenders. Pending cursors describe complete-response requests. Real blob images reveal through progressively finer canvas samples. Fastest means lowest measured request latency; provider usage/cost stays authoritative. |
| Footer   | Scroll-scrubbed workbench and closing signature.                                                                                                                                                                                                                                                                                 |

## Critique and verification

The motion pass preserves original garden/brand assets and Geist typography, adds the requested paper/charcoal/pollen palette, and uses three desktop comparison columns. The garden remains a flattened image; no invented SVG groups are claimed. Carter's lab code was unavailable, so official Flip documentation supplied the implementation signatures.

The visual review checks 320, 390, 768, 1024, 1440, 1680 and 1920px in both themes, with original local assets and authored mock responses. Current screenshots are in docs and detailed evidence in ignored .local/visual-review. Motion profiles are collected separately from captures in .local/motion-review; local headless measurements are not a sustained-frame-rate guarantee. Browser checks cover keyboard/dialog flows, resizing, interruptions, media/pause cleanup, authentic dispatch timers and complete CDN failure. See HANDOFF.md for final check results.
