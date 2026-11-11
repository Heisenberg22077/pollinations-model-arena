# Model Table handoff

The requested motion upgrade is implemented locally, 2026-11-09. The working tree contains the changes; the previously published GitHub Pages site still reflects the earlier release. No generation requests were made against a paid account during validation.

## Resume locally

Repository: `C:\Users\obito\.gemini\antigravity\scratch\pollinations-model-arena`.

The development server is running at **http://127.0.0.1:5173/**. After restarting:

```powershell
npm ci
npm run dev -- --port 5173 --host 127.0.0.1 --strictPort
```

Use Node.js 24. Connect through the official Pollinations widget, choose a lineup and Run the table. Cmd/Ctrl+Enter runs or stops; persistent pause and theme controls remain available. Anonymous Run displays a connection hint and never generates a request.

## Current implementation

- Pinned GSAP 3.15.1 core/Flip/ScrollTrigger/SplitText/CustomEase and Lenis 1.3.27 use CDN runtime scripts and official development types. Motion, WAAPI feedback and CSS animation clocks have been removed.
- One application-owned ticker drives Lenis, forty canvas pollen squares, text decoding and dispatch timers. Fine-pointer magnets, a pixel reticle, layered garden parallax and provider spotlights use quickTo.
- Navigation, masked headline, garden, composer and lineup overlap on entrance. Three desktop comparison columns have separate Flip, scroll-arrival and pointer-tilt planes, preventing conflicting transforms.
- Presets, toggles, sorting and expansion capture state before React changes the DOM. Retained departure clones are inert and aria-hidden; interruption, resize and pause remove them. Submitted results remain attached to their original question and lineup.
- Drawers animate CSS Grid rows and preserve native summary, focus and inert closing content. Theme switching uses ninety-six square blocks, settles the latest reversal and clears immediately when motion pauses.
- Launch pulses, real dispatch timers, pending cursors/shimmer, decoded-blob mosaics and fastest-by-latency celebrations follow actual request state. Timers update their text without rerendering whole cards.
- Original day/night artwork, SVG logos, Geist fonts, official auth widget, retry/deadline/cancellation behavior, exports and history remain intact. Paper #f4efe6, charcoal #1c1b18 and pollen #ffe680 supply the requested palette.

Text still uses complete JSON responses, rather than SSE. The pending cursor describes an in-flight request. Queue time is excluded from request latency; retries are included. Generation uses gen.pollinations.ai; enter.pollinations.ai is account/top-up. The garden is a flattened original WebP, animated through existing transform layers.

## Evidence and checks

The mandatory four-part audit is recorded in [docs/arena-motion-research.md](docs/arena-motion-research.md). Current design decisions are in [DESIGN.md](DESIGN.md); notices and the GSAP Standard license are in [THIRD_PARTY.md](THIRD_PARTY.md).

- Typecheck and Biome checks pass.
- Root and GitHub Pages builds plus artifact checks pass: eight original garden files, twelve logo files, three local fonts, matching 404 entry, manifests and no embedded secret credentials.
- The regular browser suite passes **23 tests**, with two opt-in live tests skipped. It uses actual pinned vendor assets and mocked generation/auth, covering request errors/retries/deadlines/cancellation, keyboard/image dialogs, native nested scrolling, resize/Flip recovery, runtime reduced motion, pause persistence, one-clock cleanup, rapid pixel-curtain reversal, authentic dispatch timers, CDN failure and pausing a real-image mosaic.
- Visual review passes at 320, 390, 768, 1024, 1440, 1680 and 1920px in both themes. Updated docs screenshots use authored responses and the original local garden image. Detailed captures remain in `.local/visual-review`.
- Six headless motion profiles were measured separately from screenshots/video in `.local/motion-review`. Medians were approximately 16.7ms; the pending-request profile reached a 50ms p95 and 116.7ms maximum. These local development measurements do not establish sustained 60fps.

Application JavaScript: 98,268 gzip bytes for Pages (98,261 at root). Styles: 10,242 gzip bytes for Pages. The motion CDN assets are reported separately: 69,321 gzip bytes / 178,062 raw bytes. Application JS remains below the 150,000-byte budget.

Reproduce checks with `npm run lint`, `npm run typecheck`, `npm run test:e2e`, `npm run review:frontend`, `npm run review:motion`, `npm run build`, `npm run build:pages` and `npm run verify:artifact`. Live tests remain opt-in because they spend Pollen. Build output currently uses the Pages base path; `npm run build` generates the root variant.
