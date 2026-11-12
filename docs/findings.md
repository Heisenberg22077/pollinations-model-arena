# Findings — Model Table mobile fluidity, music autoplay & layout audit

Date: 2026-11-12. Scope: the owner's two reported problems — (1) the site feels
smoother on PC than on mobile, and (2) music on mobile only started after a
mute/unmute cycle — plus the carried layout/touch defects and the verification
gate. Every fix below was traced to its mechanism before changing code, then
proven with a regression test or a runtime probe. No paid live API calls were
made during validation; Playwright traces stayed off; no secrets were committed.

## 1. Mobile music needed a mute/unmute cycle — fixed

**Symptom.** On phones the background music stayed silent on load and only began
after the user muted and unmuted. On desktop it started on the first click.

**Root cause.** The unlock was a single `pointerdown` listener removed after the
first gesture (`{ once: true }`). Two things break that on mobile:

- WebKit (iOS Safari) does not reliably treat `touchstart`/`pointerdown` as a
  user gesture that authorizes `HTMLMediaElement.play()`; a `click`/`touchend`
  is the dependable gesture. A pointer-only arm therefore often missed.
- The first `play()` can be rejected while the codec is still loading
  (`preload="none"` until the gesture). With the listener already removed, there
  was no second chance — so the only way to re-trigger `start()` was to toggle
  mute, which calls `setMusicEnabled` → `apply()` again. That is exactly the
  mute/unmute dance the owner saw.

**Fix** (`src/lib/music.ts`):

- Arm four gesture kinds and stay armed until playback actually begins:
  `GESTURE_EVENTS = ["pointerdown","touchend","click","keydown"]`
  ([music.ts:166](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/music.ts#L166)),
  passive listeners in `armMusicGesture`
  ([music.ts:178](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/music.ts#L178)).
- `unlock()` only disarms once `playing` is true (or sound is off)
  ([music.ts:172](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/music.ts#L172));
  `start()` disarms on a resolved `play()` promise
  ([music.ts:119](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/music.ts#L119)).
- A `canplay` handler retries `start()` if a gesture arrived before the codec was
  ready ([music.ts:69](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/music.ts#L69));
  the codec-fallback path disarms on success too
  ([music.ts:44](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/music.ts#L44)).
- Muting disarms so a muted session never keeps listeners alive
  ([music.ts:157](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/music.ts#L157)).

Sound stays on by default (`read()` returns `true` when no preference is stored,
[sound.ts:7](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/sound.ts#L7)),
applied at module init ([sound.ts:54](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/sound.ts#L54)),
and the gesture arm runs once on mount
([App.tsx:34](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/App.tsx#L34)).
Autoplay-without-any-gesture remains impossible by browser policy; the fix makes
the **first real tap** start music reliably instead of requiring a mute cycle.

**Regression test.** `e2e/touch.spec.ts:113` ("music starts on the first tap
without a mute cycle", emulated Pixel 7): one tap → poll asserts the `<audio>`
element is playing with `currentTime > 0` → open the phone menu → tap the master
mute → poll asserts the element pauses. The phone mute lives in the menu popover
because the header sound button is hidden on phones
([index.css:1754](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/index.css#L1754),
menu row [Header.tsx:197](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/components/Header.tsx#L197)).

**Before/after.** Before: first tap frequently silent on WebKit; music required
mute→unmute. After: first tap starts playback (test poll returns true), one mute
in the menu fades it out. No console/page errors.

## 2. Mobile motion lacked desktop's depth — fixed

**Symptom.** Desktop feels alive because the garden layers drift with the
pointer (parallax). Phones have no hover pointer, so that depth cue was simply
absent, and the particle budget was identical on a low-end phone and a desktop.

**Root cause.** `pointerScene` is gated to fine pointers; on coarse pointers
nothing drove the garden/pollen depth layers. The canvas particle counts were
fixed regardless of device capability.

**Fix** (`src/lib/arena-motion.ts`, `canvasScene`):

- **Scroll-velocity parallax** is the touch equivalent of pointer parallax: on
  coarse pointers the garden and pollen layers get `gsap.quickTo` y-tweens
  ([arena-motion.ts:425](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/arena-motion.ts#L425))
  driven by scroll velocity, clamped to ±16px, easing back to rest 160ms after
  scrolling stops
  ([arena-motion.ts:627](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/arena-motion.ts#L627)).
  Transform-only, so it stays on the compositor; cleanup kills the tweens and
  clears the transform
  ([arena-motion.ts:718](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/arena-motion.ts#L718)).
- **Adaptive quality tier**: on coarse pointers with ≤4 cores or ≤4GB RAM
  (`navigator.hardwareConcurrency` / `deviceMemory`), pollen drops 40→22 and
  confetti bursts halve with a 30 cap instead of 60
  ([arena-motion.ts:410](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/arena-motion.ts#L410),
  [arena-motion.ts:503](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/arena-motion.ts#L503)).

The render stack was already compositor-clean and was kept that way: canvases
render at CSS-pixel resolution (DPR 1) to bound fill cost, softness is baked into
radial gradients (no `filter: blur`), no `backdrop-filter`, `will-change` only on
`.aura-blob`, Lenis keeps native touch momentum (`syncTouch:false`). These are the
mobile-performance practices from web.dev's animation guide and the Motion
performance tier list (see Sources).

**Verification.** The matrix `scroll-glide` scenario (which now exercises the
touch parallax) holds a 16.7ms median with 0 frames over 34ms even at 6× CPU
throttle on Pixel 9, Galaxy S24 and small-android. The reduced-motion census
(`e2e/touch.spec.ts` reduced-motion test) confirms zero animating GSAP tweens when
motion is off, so the new parallax respects `prefers-reduced-motion`.

**Honest limitation.** Emulated Chromium does not reliably lower
`navigator.hardwareConcurrency`/`deviceMemory`, so the low-power particle tier is
keyed for real low-end devices and is not fully reproduced by the emulator; the
scroll parallax (keyed on `pointer:coarse`) is exercised by the matrix.

## 3. Theme reload flash — fixed (carried)

**Root cause.** In dev, Vite injects the app stylesheet after first paint, so the
body glided from transparent to the palette on every reload (a night reload was
caught mid-glide at `rgba(28,27,24,0.95)` instead of the settled `rgb(28,27,24)`).
`useLayoutEffect` alone ran too late.

**Fix.** Critical inline CSS sets the body background pre-paint for both themes
([index.html:28](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/index.html#L28)),
and the inline boot script adds `.dark` for night
([index.html:16](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/index.html#L16)).
`useColorMode` applies the stored mode in `useLayoutEffect` before paint. The
theme spec now waits for the pixel curtain to settle and asserts the settled
palette; the phone toggle goes through the menu (`.menu-theme-button`).

## 4. Header & touch parity — fixed (carried)

- Header fits without overlap at 320/360/390 in **both** auth states; the wide
  unconnected Connect widget is exercised by `e2e/fixtures.ts` and the matrix.
  Phones keep theme/motion/sound in the menu so the Connect widget always fits
  ([index.css:1873](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/index.css#L1873)).
  Regression: `e2e/header.spec.ts` (six width/state combos + phone menu curtain).
- Touch parity: tap earns paced model commentary (region jokes stay hover-only,
  [arena-motion.ts:589](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/arena-motion.ts#L589)),
  Surprise decodes its label on tap, press squishes the card. Regression:
  `e2e/touch.spec.ts`, `e2e/bee.spec.ts` touch suite.
- The 72-click Surprise workspace test gets a 60s budget because each click waits
  out the intentional 0.34s spring release before Playwright considers the button
  stable; 72 × settle exceeds the default 30s. The motion itself is unchanged.

## 5. Diagnostic probe corrections (not site defects)

The mobile matrix initially reported failures that were traced to the probe
itself, verified against the code, and corrected:

- **brandWrap false positive.** `brandProbe` used a fixed `height ≤ 20px`
  threshold, which only fits the 14px phone wordmark. Above 639px the brand uses
  the base 28px font ([index.css:216](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/index.css#L216)),
  so a single line is 28px tall and was misread as wrapped. Fixed to count lines
  (`height / computed line-height`). Verified: iPad Mini, iPhone 16 landscape and
  Pixel 7 landscape all read `single-line, lines:1`.
- **unconnected runDisabled false positive.** The probe expected Run disabled
  without a key, but the app intentionally keeps Run enabled
  (`canRun` ignores the key, [App.tsx:38](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/App.tsx#L38));
  clicking it reveals the connection hint and focuses Connect instead of running
  ([App.tsx:42](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/App.tsx#L42),
  [arena-motion.ts:262](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/lib/arena-motion.ts#L262),
  hint markup [Header.tsx:283](file:///C:/Users/obito/.gemini/antigravity/scratch/pollinations-model-arena/src/components/Header.tsx#L283)).
  The probe now asserts the true invariant. Verified on Pixel 9 unconnected:
  `runEnabled:true, hintShown:true, runStarted:false`.
- **theme-curtain tap timeout.** The profile reopened the menu after toggling the
  theme, leaving the popover backdrop over the next profile's target under CPU
  throttle. Removed the redundant reopen; the theme row hides the popover itself,
  so the measurement is now a pure curtain.

## 6. Gate results (2026-11-12)

| Gate              | Result                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `biome check`     | 47 files, no issues                                                                                      |
| `tsc --noEmit`    | clean                                                                                                    |
| `test:e2e`        | 40 passed, 2 live-skipped (opt-in), 0 failed                                                             |
| `build:pages`     | JS gzip 113,552 B (< 150,000 budget), CSS gzip 11,259 B                                                  |
| `verify:artifact` | embeddedCredentials 0; 12 logos; identical 404; 3 fonts; 8 garden assets; 192/512 icons; 1200×630 social |
| `review:frontend` | 14 width×theme combos, no horizontal overflow; columns 1/2/3 correct                                     |
| `review:motion`   | 6 profiles, all 16.7ms median; only isolated frames in one-shot transitions                              |
| mobile matrix     | 13 devices + 6 unconnected, both auth states; see §7                                                     |

## 7. Mobile performance evidence (CDP CPU throttling)

Final matrix: **19 devices** (13 connected + 6 unconnected), **60 frame-pacing
profiles**, **0 layout failures**, **0 console/page errors**. Every one of the 60
profiles holds a **16.7ms median (60fps)** — the median range across all devices
and throttle rates is 16.7–16.7ms. Layout: no horizontal overflow and no header
control overlap on any device in either auth state.

Pacing across Pixel 9, Galaxy S24, small-android (320×568) and iPhone 16 Pro Max
at 1×/4×/6× CPU throttle:

- **ambient, scroll-glide, roster-flip:** 16.7ms median; ambient and scroll-glide
  hold 0 frames over 34ms even at 6×. The new touch parallax adds no measurable
  jank.
- **run (six streaming cards):** 16.7ms median everywhere; at 1× it is clean
  (0–1 frames over 34ms). At 4×/6× the p95/max tail rises (long tasks up to ~0.7s
  at 6×) from streaming-response JSON parsing, React renders and count-up metrics
  on the throttled main thread. 8 profiles cross the 10%-dropped-frame ratio at
  4×/6×; this tail matches the pre-change baseline and is inherent to streaming
  six responses on a low-end CPU — the median frame rate stays at 60fps.
- **theme-curtain:** 16.7ms median; the deliberate full-screen pixel transition
  drops a handful of frames under heavy throttle (5 profiles cross the ratio at
  4×/6×, p95 50–117ms), then recovers immediately. This is a one-shot spectacle,
  not sustained jank, and matches the desktop motion review's curtain profile.

The 13 ratio flags are therefore all tail-only (8 run + 5 curtain) on throttled
low-end CPUs; none reflects a sustained frame-rate drop, and none is a regression
from the mobile changes.

## 8. Real-device limitation

No cloud real-device farm is available in this environment. Validation uses
emulated device profiles (iPhone 13 Mini/16 Pro Max, Pixel 7/9, Galaxy S24,
Fold/Flip covers, iPad Mini/Pro, a 320×568 low-end Android) plus CDP CPU
throttling at 1×/4×/6×. Emulation reproduces geometry, touch and main-thread
throttling, but **not** real GPU drivers, thermal throttling, or iOS Safari's
exact media-gesture quirks. The music unlock was hardened against WebKit's
gesture rules by construction and proven on emulated touch Chromium; a quick
check on a physical iPhone and Android phone is still recommended before release.

## Sources

- [web.dev — Animations guide (compositor-only, will-change, reduced motion)](https://web.dev/articles/animations-guide)
- [Motion — Web animation performance tier list](https://motion.dev/magazine/web-animation-performance-tier-list)
- [MDN — CSS/JavaScript animation performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance)
- [MDN — position:fixed containing block (transformed ancestor)](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position)
- [web.dev — content-visibility](https://web.dev/articles/content-visibility)
- [GSAP — gsap.quickTo()](https://gsap.com/docs/v3/GSAP/gsap.quickTo()/)
- [Lenis — smooth scroll (syncTouch, reduced motion)](https://github.com/darkroomengineering/lenis)
- [MDN — HTMLMediaElement.play() / autoplay policy](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)
- [WebKit — user gesture requirements for media playback](https://webkit.org/blog/6784/new-video-policies-for-ios/)
