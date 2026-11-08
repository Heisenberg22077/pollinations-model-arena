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
- Page arrivals, once-only model-pane reveals, scroll-linked artwork, pointer springs, pollen drift, card lift, contained image zoom, disclosure springs, preset movement and decoding effects provide motion throughout the page. Offscreen ambient artwork pauses.
- Persistent pause and system reduced motion apply before first paint and react immediately to preference changes. Native scrolling and image-dialog keyboard behavior remain intact.
- Six readable panes fit at 1920×1080. Mobile keeps Run/Stop visible, contains model-chip/table scrolling and supports the actual official account widget.
- The comparison retains catalog pricing and health, cancellation/retries, stable submitted questions, sorting, expansion, export and local question/metric history. Surprise me has 36 original questions and spends no Pollen when drawing one.

[DESIGN.md](DESIGN.md) records the final palette, layout, measurements and reference choices. [THIRD_PARTY.md](THIRD_PARTY.md) records artwork/font/library notices; [docs/surprise-questions.md](docs/surprise-questions.md) records prompt research. The imported Anthropic design skills are credited in the design documentation.

## Validation

| Check                  | Result                                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript and Biome   | Passed.                                                                                                                                                                                      |
| Browser regressions    | 13 passed in 45.4s; two opt-in live checks skipped in the regular run. Covers pricing, retries, cancellation, layout, sorting, export, history, dialogs, disclosures and motion preferences. |
| Fresh live core run    | 6/6 successful in 13.73s, including a real FLUX image. Reported usage matched the app's cost calculations.                                                                                   |
| Responsive review      | Day/night and widths 320, 390, 768, 1024, 1440, 1680 and 1920px; no page overflow.                                                                                                           |
| Actual account control | Signed-in widget/menu bounds and colors checked at 1920, 390 and 320px in both themes.                                                                                                       |
| Motion review          | 14 profiles, including interrupted springs, hover, scrolling and the mobile menu; no recorded errors. Pause and reduced motion produced zero active animations.                              |
| Root build             | Passed; JavaScript 128,985 bytes gzip, CSS 9,690 bytes gzip.                                                                                                                                 |
| Pages build            | Passed; JavaScript 128,987 bytes gzip, CSS 9,702 bytes gzip.                                                                                                                                 |
| Artifact verification  | Original hashes for all eight gardens, all three font paths, 192/512px icons, 1200×630 preview, matching `404.html` and no embedded credentials.                                             |

The application JavaScript budget is **under 150,000 bytes gzip**; the Pages build has 21,013 bytes of headroom. The Pages workflow enforces this budget and verifies published assets.

Motion timing used headless Chromium requestAnimationFrame samples with geometry instrumentation, separately from capture. Median intervals were approximately 16.7ms, p95 16.7–16.8ms; no sampled frame exceeded 34ms and no long tasks were observed. This confirms the recorded local run; device and browser performance can differ. No Firefox, Safari or physical-device performance claim is made. CSS scroll timelines have a feature-detected fallback.

## Screenshot provenance and review evidence

The following checked-in screenshots show actual live Pollinations answers to:

> A goose becomes CEO of a startup. What is its first company-wide memo?

- [Day](docs/screenshot.png): 1920×1080.
- [Night](docs/screenshot-night.png): 1920×1080.
- [Mobile answers](docs/screenshot-mobile.png): 390×844.
- [Mobile composer](docs/screenshot-mobile-composer.png): 390×844.

The real Pause animations control was used for still captures. The live account name and balance are visible; no secret key is shown. The default application prompt remains unchanged.

Separate authored fixtures support repeatable QA. Their screenshots, intermediate frames, 1080p recordings and reports are local diagnostics, not live model output, and are excluded from Git:

- `.local/visual-review/`: responsive screenshots, layout/keyboard measurements and video.
- `.local/motion-review/`: timing report, `interactions-1080p.webm`, hover/disclosure contact sheets and the large closing scene.
- `.local/account-inspection.json`: actual widget inspection.
- `.local/artifact-root.json` and `.local/artifact-pages.json`: build verification results.
- `.firecrawl/`: live reference captures and animation/design research.

Reproduce the ordinary checks with the commands in [README.md](README.md). `npm run review:frontend` and `npm run review:motion` use authored fixtures and make no live generation requests. `npm run assets:reference` reproduces read-only artwork extraction. Live tests are explicitly opt-in and require an environment-provided test key.

## Git and publication handoff

The work is recorded as an initial local commit on `main`, authored by `Heisenberg22077 <195410802+Heisenberg22077@users.noreply.github.com>`. Intended source, configuration, documentation, screenshots, artwork and license notices are included. Private credentials, the owner's private prompt, research captures, diagnostics, dependencies, test output and builds remain ignored.

The current `dist/` contains the Pages build with base `/pollinations-model-arena/`. Planned public destinations:

- Repository: https://github.com/Heisenberg22077/pollinations-model-arena
- Site: https://heisenberg22077.github.io/pollinations-model-arena/

Repository creation, push, Pages configuration, deployment and quest submission remain owner actions. Select **GitHub Actions** as the Pages source; the included workflow validates, tests, builds, verifies and deploys on `main`. For a root-domain static host, use `npm run build`; its default base is `/`. Canonical and social URLs currently target the planned Pages URL.

Pollinations Sites can also host a static build after the owner grants the required `machines` permission. No new keys or global Git settings were created for this work.

## Submission draft

For [quest #19183](https://github.com/pollinations/pollinations/issues/19183), after publication:

| Field       | Draft                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Name        | Model Table                                                                                                         |
| Category    | `chat`                                                                                                              |
| Platform    | `web`                                                                                                               |
| Language    | `en`                                                                                                                |
| URL         | `https://heisenberg22077.github.io/pollinations-model-arena/`                                                       |
| Source      | `https://github.com/Heisenberg22077/pollinations-model-arena`                                                       |
| Description | Compare Pollinations models side by side with BYOP, live timing, token and Pollen costs, plus a FLUX visual answer. |

The description is under 200 characters. The draft has not been submitted.
