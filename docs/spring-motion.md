# Spring motion research and implementation

Live research completed on 2026-11-08 before implementation. Sources were searched and read through Firecrawl and Context7; the public curve generator was operated in a remote browser. No new runtime dependency or external animation service is required.

## Exact curves and physical inputs

The exact multi-stop CSS strings in [src/index.css](../src/index.css) were extracted from [Jake Archibald and Adam Argyle's linear easing generator](https://linear-easing-generator.netlify.app/). Its [public source](https://github.com/jakearchibald/linear-easing-generator) includes the damped spring solver. To reproduce, retain its default JavaScript and change the mass, stiffness and damping inputs below, with initial velocity zero.

| Token             | Mass | Stiffness | Damping | Analytic overshoot | Generator duration | CSS playback |
| ----------------- | ---- | --------- | ------- | ------------------ | ------------------ | ------------ |
| `--spring-snappy` | 1    | 480       | 28      | ~7.3%              | 500ms              | 300ms        |
| `--spring-fluid`  | 1    | 380       | 34      | ~0.4%              | 500ms              | 420ms        |
| `--spring-bouncy` | 1    | 400       | 20      | ~16.3%             | 667ms              | 380ms        |

The generator's rest detector samples at 1/6-second steps and requires sustained error below 0.001. Its duration is therefore a sampled estimate. Overshoot follows the underdamped response: `zeta = damping / (2 * sqrt(stiffness * mass))`, then `exp(-pi * zeta / sqrt(1 - zeta²))`. The requested approximate stiffness, damping, overshoot and short settling times are not simultaneously exact physical properties. CSS normalizes the generated response into the shorter playback times above; Motion's physical springs retain their real settling behavior. [Josh Comeau's linear() guide](https://www.joshwcomeau.com/animation/linear-timing-function/) explains this duration distinction.

[Easing Wizard](https://easingwizard.com/) and its [public API](https://api.easingwizard.com/docs) were also inspected. Its presets use a different, normalized parameter scale, so their numbers were not substituted for Motion's stiffness/damping units. No MCP configuration was installed or altered.

## Verified APIs and interaction choices

- [Motion spring API](https://motion.dev/docs/spring): physical springs accept two numeric keyframes, and generator sampling uses milliseconds. The CSS generation API can stringify a spring into a duration and `linear()` curve. Physical profiles live in [src/lib/motion.ts](../src/lib/motion.ts).
- [Motion LazyMotion](https://motion.dev/docs/react-lazy-motion) and [layout documentation](https://motion.dev/docs/react-layout-animations): shared `layoutId` needs `domMax`; `domAnimation` excludes layout features. The existing `domMax` provider and lightweight `motion/react-m` imports are retained for Motion 14.10.1 / React 19. The preset uses `active-roster-preset` and the requested 480 stiffness, 32 damping, 0.8 mass. Motion performs its layout animation with transforms; horizontal resize suppresses projection animation while CSS keeps the final marker aligned.
- [Micro-interaction examples](https://www.ui-skills.com/skills/iart-ai/micro-interaction) and [squash/stretch guidance](https://www.joshwcomeau.com/animation/squash-and-stretch/): modest compression rather than exaggerated scaling. Buttons use 0.96 tap compression and, on fine pointers, a 2px lift with 1.015 scale. Reading cards lift 2px; their text is not compressed. Only the surprise icon uses the explicitly requested arcade roll and larger scaling.
- Multi-stop dice rotation/scale uses native keyframes with the researched CSS curve. It does not pass multiple keyframes to an unsupported physical spring. Repeated clicks cancel previous feedback on the same element, and final CSS state is restored without persistent inline transforms. Copy controls animate a retained icon wrapper so mouse, touch and Enter activation all give feedback, including when the clipboard icon changes to a checkmark.
- Card arrivals use a 40ms roster-index delay and the bouncy spring. `whileInView` runs once per mounted card; sorting keeps reading panes stationary and refreshes opacity. Pending indicators breathe through transform/opacity.
- Disclosures change native document flow once, animate content translation/opacity, retain native details semantics during exit, and make exiting content inert. `LayoutGroup` and position-only projection let results follow preceding drawer changes. Inline content fades in after a 240ms lead so following panes move clear before new rows become visible; popovers and exits have no reveal delay. Answer expansion changes flow once and animates the text layer's translation/opacity. Textarea autosizing still updates its height without animating geometry.
- The textarea focus glow is a static border/shadow on a pseudo-element whose opacity and transform animate. Hover color, border and shadow changes are immediate; animated geometry and clip-path reveals were removed.

## Native scrolling and accessibility

[MDN overscroll documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overscroll-behavior) confirms that `contain` prevents scroll chaining and navigation gestures while allowing platform overscroll effects; `none` suppresses those effects. [Elastic scrolling research](https://css-tricks.com/elastic-overflow-scrolling/) explains browser/platform differences. Roster rows retain native overflow scrolling, proximity snapping, normal snap stops, 16px scroll padding and real edge gutters. No JavaScript drag loop replaces touch momentum. Rubber-banding varies by OS/browser.

System reduced motion and persistent Pause animations stop CSS and native feedback, reset hover transforms and pointer springs, and give Motion transitions zero duration. Drawers remain functional, exiting content stays inert, and image dialogs preserve keyboard focus behavior. CSS `linear()` has an `ease-out` fallback for unsupported browsers.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm run test:e2e`, `npm run review:motion`, `npm run review:frontend`, `npm run build`, and `npm run verify:artifact`. The review scripts use authored fixtures and spend no Pollen. Current results and bundle bytes are recorded in [HANDOFF.md](../HANDOFF.md).

Timing uses headless Chromium requestAnimationFrame samples, separately from video/screenshots. These measurements describe that local browser run. A roughly 60Hz environment cannot establish 120fps performance or physical Safari/iOS scrolling behavior.
