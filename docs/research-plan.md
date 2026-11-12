# Research plan — Model Table mobile motion & layout audit

Owner mandate: deep inspection of the whole project, own intuition, a written research
plan, and implemented improvements. Hard invariants kept throughout: headline hover
decode preserved; no CSS `@keyframes`; one application-owned GSAP ticker (`subscribeClock`
multiplexes every frame consumer); bee commentary calmly paced on touch; music on by
default with one master mute; JS gzip < 150,000 bytes; no paid live API calls during
validation (live e2e opt-in via `POLLINATIONS_TEST_KEY`, self-skips); Playwright traces
OFF; no secrets committed; git config only `--local`, no commit/push unless asked.

## Phase 0 — Baseline in both auth states

- Gates: `lint`, `typecheck`, `test:e2e`, `build:pages`, `verify:artifact`,
  `review:frontend`, `review:motion`.
- `.local/header-probe.mjs`: header geometry + pairwise control overlap at 320/360/390/412
  in the **unconnected** state (the state a first-time visitor sees).
- `.local/mobile-matrix.mjs`: Android + iOS device matrix (ratios, overflow, header fit,
  menu fit, run-bar reachability, CDP CPU-throttled frame pacing at 1x/4x/6x) in both
  connected and unconnected states.
- Gap found in the old tooling: `mockApp` always seeded a session token (connected) and
  the mock Connect widget always rendered its short connected label, so the wide
  unconnected widget was never exercised; `headerControlsFit` checked viewport bounds
  only, never pairwise overlap. Both gaps closed in `e2e/fixtures.ts` and the matrix.

## Phase 1 — Real devices

No cloud real-device farm is available in this environment. Emulated device profiles
(Galaxy S24, Pixel 9, iPhone 13 mini, Fold/Flip covers) plus CDP CPU throttling stand in;
the limitation is stated explicitly in the owner summary. Friend-reported Android
screenshot used as ground truth for defect #1.

## Phase 2 — Trace where frames go

- CDP `Emulation.setCPUThrottlingRate` (1x/4x/6x) + rAF delta census + `longtask`
  PerformanceObserver during load, settle and theme toggle.
- GSAP tween census (`globalTimeline.getChildren`) per state, including a
  `prefers-reduced-motion: reduce` census to prove the motion-off path is truly quiescent.
- Code-level audit of per-frame writers: count-up metrics, skeleton repeats, per-char
  headline decode, pointer-driven tweens.

## Phase 3 — Root causes, not symptoms

Each defect traced to its mechanism before any fix (systematic debugging):
pixel evidence → DOM/CSS mechanism → single minimal fix → regression test.

## Phase 4 — Implement, verify, document

Fixes + new regression specs (`e2e/header.spec.ts`, `e2e/touch.spec.ts`), full gate rerun,
both-state matrix rerun, frame captures of the new theme transition, then
`docs/findings.md` and the owner-facing summary.

## Online research applied (2026-11-12)

| Question                      | Finding                                                                                                                                                                                                                                                                                                                                                                       | Action                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Pointer-driven tweens         | `gsap.quickTo` re-uses one tween per property instead of allocating per `mousemove` ([GSAP docs](https://gsap.com/docs/v3/GSAP/gsap.quickTo()/))                                                                                                                                                                                                                              | Already used across pointerScene; audited and kept                                                                                |
| Smooth scroll on phones       | Keep touch momentum native (`syncTouch: false`), smooth wheel only; Lenis honors reduced motion ([Lenis README](https://github.com/darkroomengineering/lenis), [Lenis + GSAP guide](https://www.madeforaward.com/blog/lenis-smooth-scroll-gsap-scrolltrigger-nextjs))                                                                                                         | Config verified: `syncTouch:false`, `autoRaf:false` (one ticker), `anchors:true`                                                  |
| Fixed bar jumping into header | A transformed ancestor becomes the containing block for `position:fixed` descendants ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position), [meyerweb](http://meyerweb.com/eric/thoughts/2011/09/12/un-fixing-fixed-elements-with-css-transforms/), [Chromium issue](https://issues.chromium.org/41131675))                                  | Intro no longer transforms `.site-header-inner`; fade shell + slide fixed-free rows                                               |
| Offscreen render cost         | `content-visibility:auto` + `contain-intrinsic-size` skips offscreen layout; Flip needs real sizes ([web.dev](https://web.dev/articles/content-visibility), [CSS-Tricks](https://css-tricks.com/more-on-content-visibility/))                                                                                                                                                 | Kept on cards with `is-flipping`/departure overrides; specs scroll post-run cards                                                 |
| Compositor budget             | Animate transform/opacity only; 300–500ms phases; `will-change` sparingly; reduced-motion overrides ([web.dev animations guide](https://web.dev/articles/animations-guide), [Motion tier list](https://motion.dev/magazine/web-animation-performance-tier-list), [MDN](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance)) | Theme curtain uses scale/opacity only; bloom is one gradient layer; glide limited to large surfaces and disabled under motion-off |
| Sticky `:hover` on touch      | Hover-only feedback must sit behind `@media (hover:hover) and (pointer:fine)`                                                                                                                                                                                                                                                                                                 | Last ungated rule (`.nav-link` underline) split; keyboard focus keeps it                                                          |

## Mobile fluidity & music autoplay (2026-11-12, owner follow-up)

Owner: PC feels smooth and alive; mobile feels flatter, and music only started
after a mute/unmute cycle. Research questions and applied actions:

| Question                           | Finding                                                                                                                                                                                                                                                                                                                 | Action                                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Why mobile music needs mute/unmute | WebKit does not reliably accept `touchstart`/`pointerdown` as a media-play gesture, and a first `play()` can be refused while the codec loads ([MDN play()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play), [WebKit video policies](https://webkit.org/blog/6784/new-video-policies-for-ios/)) | Arm `pointerdown`/`touchend`/`click`/`keydown`, stay armed until playback begins, retry on `canplay` (`src/lib/music.ts`) |
| Desktop depth missing on touch     | Pointer parallax has no hover equivalent on phones; scroll velocity is the natural touch depth cue ([web.dev animations guide](https://web.dev/articles/animations-guide))                                                                                                                                              | Scroll-velocity parallax on garden/pollen layers, transform-only, coarse-pointer gated                                    |
| Low-end particle budget            | Adaptive quality keyed on `navigator.hardwareConcurrency`/`deviceMemory` bounds fill cost on weak GPUs ([Motion tier list](https://motion.dev/magazine/web-animation-performance-tier-list))                                                                                                                            | Low-power tier: pollen 40→22, confetti halved with a 30 cap on coarse + ≤4 cores/≤4GB                                     |
| Mobile render cost                 | Compositor-only transform/opacity, CSS-pixel canvases, baked gradient softness, no blur/backdrop-filter ([MDN animation performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance))                                                                             | Audited and kept; verified scroll-glide holds 16.7ms median at 6× throttle                                                |

Probe corrections made during verification (false positives, not site defects):
brand line-count classification (28px desktop wordmark vs 14px phone), the
unconnected Run guard (Run stays enabled and surfaces the connection hint by
design), and a theme-curtain choreography tap that left the popover backdrop over
the next target. Each was traced to code, fixed in `.local/mobile-matrix.mjs`,
and re-verified before the matrix rerun.

## Sign-off criteria

All gates green; header overlap-free at 320/360/390 in both auth states; touch parity
(tap commentary, surprise decode, press squish) proven on emulated Pixel 7; reduced-motion
census empty of animating tweens; theme transition captured frame-by-frame on desktop and
phone; gzip budget and artifact credential scan unchanged.
