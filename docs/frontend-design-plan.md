# Frontend design plan

## Brief

Model Table compares one submitted question across independent models with real timing and Pollen costs. The owner wants dottxt's pixel typography and square framing, Pollinations' softer colors and large garden artwork, plus visible, fluid movement. Retain **One Question. Every Model.** and **Curiosity, Multiplied.**

Follow the imported [Anthropic frontend-design guidance](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/frontend-design): plan, critique, implement, inspect rendered output. The owner authorized the reference-based custom theme and implementation decisions.

## Evidence

- Firecrawl captured Pollinations' current homepage, HTML, image inventory, branding and downloaded screenshot on 2026-11-08. Its garden sits beside the main copy; a separate wide garden closes the page.
- Read-only GitHub CLI calls extracted original MIT-licensed day/night artwork at 1024 and 2048 pixels from `pollinations/pollinations@62d7cc4df19aef8a68363046330ab584fc2f6921`. `scripts/fetch-reference-art.mjs` reproduces the new extraction.
- dottxt was inspected at 1920×1080 and 390×844, including three navigation hover menus, four terminal interactions, scroll sections and video. Its terminal uses mock calls. Its commercial fonts remain references.
- Current Context7 Motion documentation supports lightweight LazyMotion, pointer springs, once-only entrances and reduced motion. [web.dev's animation guide](https://web.dev/articles/animations-guide) supports composited transform/opacity effects and measured frame behavior.
- Reference captures stay in ignored `.firecrawl/`; authored visual fixtures and motion recordings stay in ignored `.local/`.

## Tokens and type

| Role             | Day       | Night     |
| ---------------- | --------- | --------- |
| Canvas           | `#D8CFC0` | `#161411` |
| Main surface     | `#E9E2D4` | `#211E19` |
| Recessed surface | `#DCD3C3` | `#2A261F` |
| Question input   | `#DCE5EF` | `#232C32` |
| Text             | `#272117` | `#E9E2D4` |
| Secondary text   | `#665B4A` | `#B4AA97` |
| Borders          | `#8C816F` | `#574F44` |
| Pollen           | `#FFD76D` | `#FFD76D` |

Geist Pixel Square carries the headline, wordmark and signature; Geist Sans carries questions and answers; Geist Mono carries controls and measurements. Three original local WOFF2 files share their upstream OFL. At 1920px the headline is about 90px, questions 24px, model names 20px, answers 16px with 1.6 line height. Phones retain 44px touch targets.

## Composition

```text
+----------------------------------------------------------------+
| Model Table   Lineup / Guide / Source   Motion Theme Connect Run |
+----------------------------------------------------------------+
| One Question.       [large pixel garden]   Your question         |
| Every Model.        [day / night scene]    Surprise / starters   |
| Compare answers, speed and Pollen cost                          |
| Model lineup / presets / extra models                           |
| Submitted question / progress / sort / metrics / export         |
| [OpenAI] [DeepSeek] [Meta] [xAI] [Z.ai] [FLUX visual answer]       |
+----------------------------------------------------------------+
| Curiosity,                 [wide garden workbench artwork]      |
| Multiplied.                [scroll and pointer response]        |
| Quest credit and official Pollinations badge                    |
+----------------------------------------------------------------+
```

At 1680px and above, three hero columns keep six answer panes in one row. At smaller desktop widths the garden sits below the headline beside the composer. Tablets place headline and garden side by side above the composer; phones place the garden between headline and composer. The ending scene is large, responsive and lazy loaded.

Artwork is decorative brand material, separate from generated FLUX answers. Feathered edges and theme-specific blending integrate its existing backgrounds with muted surfaces. Document scrolling stays native.

## Motion

- An ordered arrival connects the headline, artwork, composer and lineup. Answer panes appear once on entering view, staggered by roster order.
- Artwork has slow drift, six pollen particles, spring pointer response and native CSS scroll-linked movement where supported. Offscreen and hidden scenes pause.
- Card hover raises the pane 4px and strengthens its provider rule and header tint. Explicit sorting refreshes opacity in place, preserving answer containment.
- Generated images fit at rest. Hover provides bounded zoom and a view control; image click or Expand opens the native dialog. Focus containment, Escape and focus return remain intact.
- Disclosures animate actual height, presets glide, Surprise me decodes, pending pixels reflect requests, and themes crossfade.
- A persistent Pause animations control stops ambient and interaction motion; the mobile menu includes it. System reduced motion takes precedence. Both preferences apply before first paint.

## Critique

The old 112px footer artwork could not carry Pollinations' character. A tall marketing hero would push the comparison down at 1080p. Keep the wide hero near 244px tall and place a separate large scene at the ending. Concentrate continuous movement in artwork and small signals; preserve readable answers and native scrolling. Composition and motion are local adaptations, not claims of exact reference behavior.

## Verification

Inspect day/night 1920×1080 and mobile screenshots, intermediate hover/scroll frames, spring interruptions, image expansion and keyboard handling. Profile frame intervals separately from capture. Check widths 320–1920px, the actual official account widget, reduced motion and pause persistence. Run browser regressions and a fresh real comparison, root/Pages builds, artifact checks, documentation and a local-only Git handoff.
