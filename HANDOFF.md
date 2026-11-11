# Model Table handoff

The bee, adaptive audio and GSAP/Lenis upgrade is committed and published on GitHub Pages, verified 2026-11-11. The feature commit is `435a55a`; the successful deployment of `e42dbac` is [Actions run 43049422538](https://github.com/Heisenberg22077/pollinations-model-arena/actions/runs/43049422538). The release verification also corrects the touch-feeding test: alternate distant feeding positions so later taps do not accidentally hit the pursuing bee and open its story.

## Resume locally

Repository: `C:\Users\obito\.gemini\antigravity\scratch\pollinations-model-arena`.

Start the development server at **http://127.0.0.1:5173/**:

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
- The garden bee uses pursuit/arrival and Lissajous wander steering, reactive wings, flower perching, fruit collection, paced model/area commentary and a tap-to-continue story. Touch devices suppress hover jokes; bee visibility and music are separate preferences.
- The owner's self-hosted audio recording is available in Opus/WebM, AAC/M4A and MP3. Browser support and decode failures determine the fallback order. Playback requires a real gesture; GainNode fades and a persistent master preference control music without bee sound effects.

Text still uses complete JSON responses, rather than SSE. The pending cursor describes an in-flight request. Queue time is excluded from request latency; retries are included. Generation uses gen.pollinations.ai; enter.pollinations.ai is account/top-up. The garden is a flattened original WebP, animated through existing transform layers.

## Evidence and checks

The mandatory four-part audit is recorded in [docs/arena-motion-research.md](docs/arena-motion-research.md). Current design decisions are in [DESIGN.md](DESIGN.md); notices and the GSAP Standard license are in [THIRD_PARTY.md](THIRD_PARTY.md).

- Typecheck and Biome checks pass.
- Root and GitHub Pages builds plus artifact checks pass: eight original garden files, twelve logo files, three local fonts, matching 404 entry, manifests and no embedded secret credentials.
- All **28 regular browser checks pass**, with two opt-in live tests skipped in that run. It uses actual pinned vendor assets and mocked generation/auth, covering request errors/retries/deadlines/cancellation, keyboard/image dialogs, native nested scrolling, resize/Flip recovery, runtime reduced motion, pause persistence, one-clock cleanup, rapid pixel-curtain reversal, authentic dispatch timers, CDN failure, pausing a real-image mosaic, bee commentary/story interactions and master audio mute. The corrected touch-feeding check also passed three consecutive targeted runs. Live checks require a funded testing key and are reported separately.
- Direct production checks returned HTTP 200, matched the published application assets and all three audio codecs against the Pages build, verified the official BYOP component upgrade and theme/Surprise controls, and found no horizontal overflow at 320, 390, 768 and 1440px. All thirteen configured IDs were present in the live model catalog. The private local reports are `.local/production-release.json` and `.local/live-catalog-release.json`.
- A separate funded live core check passed on 2026-11-11: all six default models, including FLUX, returned successful results in 9.90 seconds, and card costs matched the live catalog and reported usage. The full paid-only live roster check was not run.
- Visual review passes at 320, 390, 768, 1024, 1440, 1680 and 1920px in both themes. Updated docs screenshots use authored responses and the original local garden image. Detailed captures remain in `.local/visual-review`.
- Six headless motion profiles were measured separately from screenshots/video in `.local/motion-review`. Medians were approximately 16.7ms; the pending-request profile reached a 50ms p95 and 116.7ms maximum. These local development measurements do not establish sustained 60fps.

Application JavaScript: 112,676 gzip bytes for Pages. Styles: 11,168 gzip bytes for Pages. The motion CDN assets are reported separately: 69,321 gzip bytes / 178,062 raw bytes. Fonts, artwork, the BYOP widget and audio are additional assets; the 150,000-byte budget applies to application JavaScript.

Reproduce checks with `npm run lint`, `npm run typecheck`, `npm run test:e2e`, `npm run review:frontend`, `npm run review:motion`, `npm run build`, `npm run build:pages` and `npm run verify:artifact`. Live tests remain opt-in because they spend Pollen. Build output currently uses the Pages base path; `npm run build` generates the root variant.
