# Arena motion: research and implementation contract

## Continuation evidence — 2026-11-13

The continuation used official documentation through Context7 and the Firecrawl developer index. These decisions extend the existing garden interactions and preserve the single GSAP ticker, native touch scrolling, pause and reduced-motion contracts.

| Source                                                                                                                                                                                       | Adopted and verified locally                                                                                                                                                                 | Limit                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [React Component reference](https://react.dev/reference/react/Component#getsnapshotbeforeupdate)                                                                                             | A small `SortedLayout` boundary captures positions immediately before a DOM reorder. The distinct-latency regression first recorded five unanimated reorders, then passed after the fix.     | Layout effects cannot capture the prior DOM; no speculative deferred rendering was added.                                             |
| [GSAP staggers](https://gsap.com/resources/getting-started/Staggers/) and [context revert](https://gsap.com/docs/v3/GSAP/gsap.context()/)                                                    | The new model progress pixels reflect actual run states, pop on settlement and perform one center-out completion wave. Cleanup reverts the finite animation.                                 | No extra animation clock or endless progress pulse. Offscreen feedback is skipped.                                                    |
| [GSAP matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/)                                                                                                                          | Existing context ownership and teardown remain responsible for the garden tap bloom and manual pause.                                                                                        | A passing browser test is evidence for Chromium, not real iOS.                                                                        |
| [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action) and [pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Using_Pointer_Events) | Closing-garden taps trigger a finite lens bloom. Passive pointer listeners, movement rejection and pointercancel preserve browser panning.                                                   | No `touch-action:none`, pointer capture or scroll suppression.                                                                        |
| [content-visibility guidance](https://web.dev/articles/content-visibility) and [GSAP Flip targets](https://gsap.com/docs/v3/Plugins/Flip/static.from()/)                                     | Capture only visible columns; delay pending skeleton animation and answer overflow measurements until visibility; skip offscreen settle tweens. Each added regression failed before its fix. | Production arrival timing still misses the approved budget. Avoiding these reads is not proof of an aggregate frame-rate improvement. |

The approved double-rAF settlement experiment passed cancellation/history/deadline checks and a suspended-rAF hidden-tab check. Its unprofiled production probe still showed p95 66.7 ms, 8 long tasks and 355 ms blocking; it was removed. The established 90 ms queue remains. Audio already unlocks on pointerdown plus touchend/click/keydown, so a duplicate prewarm was not added. Selective `@property` registration was deferred because these custom properties already have an imperative GSAP owner and no measured CSS interpolation need. Pixel rendering and integer canvas coordinates were already present.

Phase 0 completed before implementation, 2026-11-09. Research used the frontend-design and Firecrawl skills, official documentation, registry metadata and direct CDN checks.

## 1. Repository and selector audit

Read index.html, application components, hooks, libraries, the full stylesheet, configuration, browser fixtures and review scripts. React owns the DOM; capture Flip state before actions and animate after its commit. Preserve submitted results while the next lineup changes.

| Area       | Verified selectors                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation | .site-header, .main-navigation .nav-link, #mobile-navigation, .header-account polli-connect, .theme-button, .motion-button, .run-button                                       |
| Hero       | .workspace-intro, .slogan .scramble-label, .workspace-lede, .model-signal                                                                                                     |
| Composer   | .question-band, #prompt, .question-counter, .surprise-button, .composer-chip, .history-popover                                                                                |
| Garden     | .garden-scene-hero, .garden-scene-closing, .garden-pointer, .garden-scroll, .garden-drift, img.garden-image, .garden-pollen                                                   |
| Lineup     | #roster, .roster-presets, .preset-button[data-preset], .preset-highlight, .model-toggle[aria-pressed], #extra-models                                                          |
| Guide      | #how, summary, .disclosure-body, .guide-content                                                                                                                               |
| Results    | #results, .comparison-grid, .model-column.ghost-card, article.model-column.model-card[data-model-id][data-status]                                                             |
| Card       | .model-heading, .answer-copy, .pending-answer, .pending-pixels, .run-phase, .answer-award-fastest, .model-metrics, .metric-value, .answer-image-viewport, dialog.image-dialog |
| Footer     | .site-footer, .garden-banner, .garden-caption                                                                                                                                 |

The artwork is a flattened WebP. No SVG groups can be independently animated. Original files and provenance remain intact. New canvas, cursor and Flip hooks must be deliberately added to these components.

## 2. Live library verification

Registry latest stable: GSAP **3.15.1**, Lenis **1.3.27**. GSAP standard no-charge license; Lenis MIT. All six JS URLs and the CSS URL returned HTTP 200 with correct content types:

- https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js
- https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/Flip.min.js
- https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/ScrollTrigger.min.js
- https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/SplitText.min.js
- https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/CustomEase.min.js
- https://unpkg.com/lenis@1.3.27/dist/lenis.min.js
- https://unpkg.com/lenis@1.3.27/dist/lenis.css

Sources: https://registry.npmjs.org/gsap/latest and https://registry.npmjs.org/lenis/latest.

Verified signatures: Flip.getState(targets), Flip.from(state, {targets, absolute:true, scale:true, onEnter, onLeave}); stable data-flip-id for replaced React nodes. SplitText.create(target,{type:'lines,words,chars',mask:'lines',autoSplit:true,onSplit(self)}), returning an animation and reverting on cleanup. quickTo setters expose .tween. matchMedia captures animations but custom listeners and ticker callbacks require cleanup. ticker callback receives seconds and delta milliseconds. Lenis uses autoRaf:false, raf(time*1000), scroll event to ScrollTrigger.update, destroy(), and prevent for nested native scrollers.

Authority:

- https://gsap.com/docs/v3/Plugins/Flip
- https://gsap.com/docs/v3/Plugins/SplitText
- https://gsap.com/docs/v3/GSAP/gsap.quickTo()/
- https://gsap.com/docs/v3/GSAP/gsap.matchMedia/
- https://gsap.com/docs/v3/GSAP/gsap.context()/
- https://gsap.com/docs/v3/GSAP/gsap.ticker/
- https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.batch()/
- https://gsap.com/docs/v3/Eases/CustomEase
- https://unpkg.com/lenis@1.3.27/README.md

## 3. Motion references and design

Olivier Larose magnetic tutorial verifies quickTo with elastic.out(1,0.3) and pointer-center geometry: https://blog.olivierlarose.com/tutorials/magnetic-button . Pixel tutorial verifies shuffled blocks and square cells computed from viewport dimensions: https://blog.olivierlarose.com/tutorials/pixel-transition . Adapt to the requested 12×8 grid with side=max(width/12,height/8), centered and cropped to cover portrait screens.

https://carterogunsola.com/lab/rotating-gallery was fetched but the lab code was unavailable; official Flip docs are the implementation authority. https://www.awwwards.com/sites/trionn-2 records SOTD July 27, 2026 and GSAP/Next.js/Three.js. Reference patterns inform this implementation; their unpublished timings are not claimed as verified.

Design: warm paper #f4efe6, charcoal #1c1b18, pollen #ffe680, amber #f59e0b, existing blue composer. Preserve Geist Pixel/Sans/Mono, left-aligned workbench composition and original art. Concentrate identity in square pollen, masked pixel text, geometric lineup changes and a theme curtain. Keep reading surfaces legible throughout.

## 4. Pollinations lifecycle

Generation uses https://gen.pollinations.ai: POST /v1/chat/completions, GET /image/{prompt}, GET /models. enter.pollinations.ai is account/top-up. Preserve official @pollinations/ui@0.1.0-alpha.20 auth widget and per-tab key storage. Never log user keys.

Requests queue with common queuedAt and dispatch 250ms apart; startedAt marks actual dispatch. Deadlines: text 75s, image 120s. Existing retry, abort/run-id guards, image seeds and object URL cleanup remain authoritative. Text currently reads complete JSON; show a pending block cursor without pretending to display streamed tokens. Fastest means measured request latency, including retries, not earliest wall-clock completion. Usage/cost remains provider-reported or estimated from the live catalog.

## Validation contract

One application-owned GSAP ticker drives Lenis, pollen, visual decoding and pending telemetry. Remove Motion, WAAPI and CSS animation clocks. Gate visual choreography through matchMedia and persistent pause. Native scrolling and readable content must survive CDN failure. Test runtime reduced motion, rapid theme/Flip reversal, keyboard/dialog flows, dispatch timing and real image reveal using pinned vendor fixtures without spending Pollen. Inspect desktop/mobile themes, run typecheck/lint/browser tests and both deployment builds plus artifact verification. Report CDN payload separately; do not claim sustained frame rate without measurement.

## Implementation follow-up

Installed types and Lenis 1.3.27 source confirmed that scrollTo already accounts for CSS scroll-margin and scroll-padding. Programmatic offsets compensate for those values instead of subtracting twice. Official quickTo documentation warns that alias conversion is skipped; scale uses separate scaleX/scaleY setters. Arrival, tilt and Flip use separate transform planes. Request timers write only their text from shared clock subscriptions. The CDN-failure path uses one coarse telemetry timer without decorative animation.
