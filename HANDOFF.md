# Model Table handoff

Completed locally on 2026-11-08. The frontend now combines large Pollinations day/night gardens, softer cream/blue surfaces, Geist pixel typography and visible page motion with the working BYOP comparison app. The project remains MIT licensed with its official badge, publishable App Key, redirect settings and API behavior intact.

## Local preview

The development server is running at **http://127.0.0.1:5173/**. After restarting the workspace:

```powershell
npm ci
npm run dev -- --port 5173 --host 127.0.0.1 --strictPort
```

Requires Node.js 24. Connect using the official Pollen control, choose a lineup and click **Run the table**. Cmd/Ctrl+Enter runs or stops. Pause animations and the day/night control are in the header; mobile navigation includes the motion control.

## Final changes

- Large hero and closing gardens use eight original, pinned Pollinations WebP assets with day/night variants, responsive resolution, retained MIT notice and reproducible provenance.
- Researched CSS spring curves power tap compression, hover lift, checkmark/copy pops, the Surprise dice roll and composer focus glow. Page arrivals, 40ms staggered card deals, scroll-linked artwork, pointer springs, pollen drift, contained image zoom, disclosure momentum and preset movement provide motion. Offscreen ambient artwork pauses.
- Persistent pause and system reduced motion apply before first paint and react immediately to preference changes. Native scrolling and image-dialog keyboard behavior remain intact.
- Contained horizontal scrolling has 16px edge gutters, the preset uses Motion's native shared layout spring, and offscreen panes retain their rendered sizes. Hover effects animate transforms/opacity; pause also resets provider rules and navigation hover transforms.
- Six readable panes fit at 1920×1080. Mobile keeps Run/Stop visible, contains model-chip/table scrolling and supports the actual official account widget.
- The comparison retains catalog pricing and health, cancellation/retries, stable submitted questions, sorting, expansion, export and local question/metric history. Surprise me has 36 original questions and spends no Pollen when drawing one.
- All thirteen models have current local SVG logos in selection controls, waiting cards and completed cards. Fixed 18px/22px icon boxes preserve colors, proportions and day/night contrast. Eleven marks come from the verified current LobeHub snapshot; Mistral uses its official Small 4 model emblem. Extraction and source hashes are reproducible.
- The preset is now **Standard models**, the footer describes the independent comparison tool, and the account menu retains only the source link.

[DESIGN.md](DESIGN.md) records the final palette, layout, measurements and reference choices. [THIRD_PARTY.md](THIRD_PARTY.md) records artwork/font/library notices; [docs/surprise-questions.md](docs/surprise-questions.md) records prompt research. The imported Anthropic design skills are credited in the design documentation.

## Validation

| Check                                 | Result                                                                                                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript and Biome                  | Passed.                                                                                                                                                                                                                                     |
| Browser regressions                   | 18 passed; two opt-in live checks skipped. Includes all-model SVG decoding/sizing, theme contrast, scrolling, preset alignment, offscreen expansion, compositor-only feedback and pause/reduced motion.                                     |
| Live core run (initial visual pass)   | 6/6 successful in 13.73s, including a real FLUX image. Reported usage matched the app's cost calculations.                                                                                                                                  |
| Responsive review                     | Day/night and widths 320, 390, 768, 1024, 1440, 1680 and 1920px; no page overflow.                                                                                                                                                          |
| Account control (initial visual pass) | Signed-in widget/menu bounds and colors checked at 1920, 390 and 320px in both themes.                                                                                                                                                      |
| Motion review                         | 25 profiles covering springs, interrupted drawers, copy/selection feedback, focus, theme, pending cards, artwork and navigation; no animated layout properties or browser errors. Pause and reduced motion produced zero active animations. |
| Root build                            | Passed; JavaScript 145,036 bytes gzip, CSS 10,458 bytes gzip.                                                                                                                                                                               |
| Pages build                           | Passed; JavaScript 145,046 bytes gzip, CSS 10,471 bytes gzip.                                                                                                                                                                               |
| Artifact verification                 | All twelve logo hashes and eight original garden hashes, three font paths, 192/512px icons, 1200×630 preview, matching `404.html` and no embedded credentials verified.                                                                     |

The application JavaScript budget is **under 150,000 bytes gzip**; the Pages build has 4,954 bytes of headroom. The Pages workflow enforces this budget and verifies published assets.

The final isolated motion review used headless Chromium requestAnimationFrame samples with geometry instrumentation, separately from capture. Profile medians ranged from approximately 16.7ms to 33.3ms and p95 from 16.7ms to 50.1ms. There were 31 intervals above 34ms, an 83.4ms maximum during theme switching, and one 53ms long task during pending-card arrivals. Interaction, interruption and compositor checks passed, but these measurements do not establish sustained 60fps or 120fps. No Firefox, Safari or physical-device performance claim is made. CSS scroll timelines have a feature-detected fallback.

The scrolling, spring and logo passes were checked with authored fixtures and the regular browser suite. The live comparison and signed-in account inspection above were completed during the initial visual pass.

## Screenshot provenance and review evidence

The following checked-in screenshots show the current interface, including model logos, with authored QA responses and a local garden image fixture. They are not live model output.

- [Day](docs/screenshot.png): 1920×1080.
- [Night](docs/screenshot-night.png): 1920×1080.
- [Mobile answers](docs/screenshot-mobile.png): 390×844.
- [Mobile composer](docs/screenshot-mobile-composer.png): 390×844.

Still captures disable animations. The account control and responses are mocked; no live balance or credentials are included. Earlier live screenshots are retained only under ignored `.local/previous-live-screenshots/`.

Authored fixtures support repeatable QA. Additional screenshots, intermediate frames, 1080p recordings and reports remain local diagnostics under ignored paths:

- `.local/visual-review/`: responsive screenshots, layout/keyboard measurements and video.
- `.local/motion-review/`: timing report, `interactions-1080p.webm`, hover/disclosure contact sheets and the large closing scene.
- `.local/account-inspection.json`: actual widget inspection.
- `.local/artifact-root.json` and `.local/artifact-pages.json`: build verification results.
- `.local/logo-review.json`: decoded vector assets and optical bounds, plus day/night lineup captures.
- `.firecrawl/`: live reference captures and animation/design research.

Reproduce the ordinary checks with the commands in [README.md](README.md). `npm run review:frontend` and `npm run review:motion` use authored fixtures and make no live generation requests. `npm run assets:reference` and `npm run assets:logos` reproduce asset extraction. Live tests are explicitly opt-in and require an environment-provided test key.

## Git and publication handoff

Source commits on `main` are authored by `Heisenberg22077 <195410802+Heisenberg22077@users.noreply.github.com>`. Intended source, configuration, documentation, screenshots, artwork and license notices are included. Private credentials, the owner's private prompt, research captures, diagnostics, dependencies, test output and builds remain ignored. Global Git configuration was not changed.

The current `dist/` contains the Pages build with base `/pollinations-model-arena/`. Public destinations:

- Repository: https://github.com/Heisenberg22077/pollinations-model-arena
- Site: https://heisenberg22077.github.io/pollinations-model-arena/

The public repository has been created through the GitHub API, and Pages is configured to build with **GitHub Actions**. The included workflow validates, tests, builds, verifies and deploys on `main`. Deployment results are available on the repository's Actions page. For a root-domain static host, use `npm run build`; its default base is `/`. Canonical and social URLs target the Pages URL.

Pollinations Sites can also host a static build after the owner grants the required `machines` permission. No new keys or global Git settings were created for this work.

## Publication details

| Field       | Draft                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Name        | Model Table                                                                                                         |
| Category    | `chat`                                                                                                              |
| Platform    | `web`                                                                                                               |
| Language    | `en`                                                                                                                |
| URL         | `https://heisenberg22077.github.io/pollinations-model-arena/`                                                       |
| Source      | `https://github.com/Heisenberg22077/pollinations-model-arena`                                                       |
| Description | Compare Pollinations models side by side with BYOP, live timing, token and Pollen costs, plus a FLUX visual answer. |

The description is under 200 characters.
