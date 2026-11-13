import type { gsap as Gsap } from "gsap";
import type { CustomEase } from "gsap/CustomEase";
import type { Flip } from "gsap/Flip";
import type { ScrollTrigger } from "gsap/ScrollTrigger";
import type { SplitText } from "gsap/SplitText";
import type Lenis from "lenis";
import {
  type BeeAction,
  type BeeColors,
  type BeeEvent,
  type BeeHandle,
  type BeeTag,
  type BeeZone,
  createBee,
} from "./bee";

declare global {
  interface Window {
    gsap?: typeof Gsap;
    Flip?: typeof Flip;
    ScrollTrigger?: typeof ScrollTrigger;
    SplitText?: typeof SplitText;
    CustomEase?: typeof CustomEase;
    Lenis?: typeof Lenis;
  }
}

export function motionStack() {
  const { gsap, Flip, ScrollTrigger, SplitText, CustomEase, Lenis } = window;
  return gsap && Flip && ScrollTrigger && SplitText && CustomEase && Lenis
    ? { gsap, Flip, ScrollTrigger, SplitText, CustomEase, Lenis }
    : undefined;
}

type Stack = NonNullable<ReturnType<typeof motionStack>>;
type Listener = (now: number, delta: number) => void;
const clockListeners = new Set<Listener>();
let clockInstances = 0;
export function motionDiagnostics() {
  return {
    clocks: clockInstances,
    subscriptions: clockListeners.size,
    smoothing: Boolean(lenis),
    choreographed: Boolean(context),
  };
}
let context: gsap.Context | undefined;
let stack: Stack | undefined;
let lenis: Lenis | undefined;
let settleTheme: (() => void) | undefined;
let flipAnimation: gsap.core.Timeline | undefined;
let captured: ReturnType<typeof Flip.getState> | undefined;
let departed: { id: string; node: HTMLElement; rect: DOMRect }[] = [];
const exitNodes = new Set<HTMLElement>();
let burstAt: ((x: number, y: number, count?: number, tint?: string) => void) | undefined;
let introPlayed = false;

// The bee mascot lives on the celebration canvas and shares the single motion clock.
let beeEnabled = (() => {
  try {
    return localStorage.getItem("model-table:bee") !== "false";
  } catch {
    return true;
  }
})();
let liveBee: BeeHandle | null = null;
export function setBeeEnabled(on: boolean) {
  beeEnabled = on;
  liveBee?.setEnabled(on);
}
export function isBeeEnabled() {
  return beeEnabled;
}
/** Sassy play-by-play from the mascot during the model arena (no-op until it is alive). */
export function beeComment(event: BeeEvent, name?: string) {
  liveBee?.comment(event, name);
}
export function beeAction(action: BeeAction) {
  liveBee?.action(action);
}
export function beeDiagnostics() {
  return liveBee?.diagnostics;
}
/** Touch-primary devices get tap equivalents and lighter tween counts; desktop keeps the full show. */
export const coarsePointer = window.matchMedia("(pointer: coarse)");

/** All application frame work shares this subscription; no independent animation loop. */
export function subscribeClock(listener: Listener) {
  clockListeners.add(listener);
  return () => {
    clockListeners.delete(listener);
  };
}

export function withMotion(work: (api: Stack) => void) {
  if (!context || !stack || document.documentElement.dataset.motion === "off") return;
  const api = stack;
  context.add(() => work(api));
}

export function refreshMotion() {
  stack?.ScrollTrigger.refresh();
}

/** Reduced motion: the ScrollTrigger UMD build self-registers at CDN load and leaves
    a paused internal refresh call in the timeline; kill housekeeping too. */
export function quiesceMotion() {
  const api = motionStack();
  if (!api) return;
  for (const tween of api.gsap.globalTimeline.getChildren(true, true, true)) tween.kill();
}

function clearExits() {
  for (const node of exitNodes) node.remove();
  exitNodes.clear();
}

/**
 * quickTo re-records its start value on every re-target, so when several tweens share
 * one element's transform (hover lift + tactile press) matchMedia revert can leave a
 * residual offset behind. Scenes call this from cleanup — which runs after revert — to
 * guarantee a clean resting state when motion is paused or reduced.
 */
function restTransforms(nodes: Iterable<Element | null | undefined>) {
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    node.style.removeProperty("transform");
    node.style.removeProperty("translate");
    node.style.removeProperty("rotate");
    node.style.removeProperty("scale");
  }
}

function makeDeparture(node: HTMLElement) {
  const clone = document.createElement("div");
  clone.className = node.className;
  clone.style.cssText = node.style.cssText;
  clone.innerHTML = node.innerHTML;
  return clone;
}

const layoutSelector = ".comparison-grid > [data-flip-id], .preset-highlight";
export function captureLayout() {
  withMotion(({ Flip }) => {
    flipAnimation?.progress(1).kill();
    clearExits();
    const nodes = [...document.querySelectorAll<HTMLElement>(layoutSelector)];
    departed = nodes
      .filter((node) => node.classList.contains("model-column"))
      .map((node) => ({
        id: node.dataset.flipId ?? "",
        node,
        rect: node.getBoundingClientRect(),
      }));
    const visible = new Set(
      departed
        .filter(({ rect }) => rect.bottom > 0 && rect.top < innerHeight)
        .map(({ node }) => node),
    );
    for (const { node, rect } of departed)
      node.classList.toggle("is-flipping", rect.bottom > 0 && rect.top < innerHeight);
    captured = Flip.getState(
      nodes.filter((node) => !node.classList.contains("model-column") || visible.has(node)),
    );
  });
}

/** Called in layout effects after React writes the real next layout. */
export function commitLayout() {
  if (!captured) return;
  const state = captured;
  const old = departed;
  captured = undefined;
  departed = [];
  withMotion(({ gsap, Flip, ScrollTrigger }) => {
    const targets = [...document.querySelectorAll<HTMLElement>(layoutSelector)];
    const ids = new Set(targets.map((node) => node.dataset.flipId));
    const leaving = old.filter(
      ({ id, rect }) => !ids.has(id) && rect.bottom > 0 && rect.top < innerHeight,
    );
    const exitClones: HTMLElement[] = [];
    for (const { node, rect } of leaving) {
      // Clone only cards that actually leave: serializing all 13 innerHTMLs on
      // every toggle was the single biggest task on low-end phones.
      const clone = makeDeparture(node);
      clone.removeAttribute("id");
      clone.removeAttribute("data-flip-id");
      clone.removeAttribute("data-model-id");
      clone.querySelectorAll("[id]").forEach((node) => {
        node.removeAttribute("id");
      });
      clone.inert = true;
      clone.setAttribute("aria-hidden", "true");
      clone.classList.add("flip-departure");
      Object.assign(clone.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        transform: "none",
        zIndex: "30",
      });
      document.body.append(clone);
      exitNodes.add(clone);
      exitClones.push(clone);
    }
    const previouslyVisible = new Set(
      old.filter(({ rect }) => rect.bottom > 0 && rect.top < innerHeight).map(({ id }) => id),
    );
    const animated = targets.filter((node) => {
      if (!node.classList.contains("model-column")) return true;
      const rect = node.getBoundingClientRect();
      return (
        (rect.bottom > 0 && rect.top < innerHeight) ||
        previouslyVisible.has(node.dataset.flipId ?? "")
      );
    });
    for (const node of animated)
      if (node.classList.contains("model-column")) node.classList.add("is-flipping");
    const releaseGrid = () => {
      for (const node of document.querySelectorAll(".model-column.is-flipping"))
        node.classList.remove("is-flipping");
    };
    flipAnimation = Flip.from(state, {
      targets: animated,
      duration: 0.65,
      ease: "arenaExpo",
      scale: true,
      stagger: { amount: 0.18, grid: "auto", from: "center" },
      onEnter: (nodes) =>
        gsap.fromTo(
          nodes,
          { autoAlpha: 0, scale: 0.92, y: 20 },
          { autoAlpha: 1, scale: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.05 },
        ),
      onLeave: () =>
        gsap.to(exitClones, {
          autoAlpha: 0,
          scale: 0.88,
          y: -16,
          duration: 0.35,
          ease: "power2.in",
          onComplete: clearExits,
        }),
      onComplete: () => {
        releaseGrid();
        clearExits();
        ScrollTrigger.refresh();
      },
      onInterrupt: () => {
        releaseGrid();
        clearExits();
      },
    });
  });
}

export function scrollArena(target: string, nearest = false) {
  const node = document.querySelector(target);
  if (lenis && context && node) {
    // Lenis resolves element targets against its own animatedScroll, which lags a
    // native jump (keyboard focus, scrollbar drag) by a frame and would overshoot.
    // Anchor to live geometry, then re-sync Lenis before the eased run.
    const docTop = node.getBoundingClientRect().top + window.scrollY;
    lenis.scrollTo(window.scrollY, { immediate: true });
    lenis.scrollTo(docTop, { duration: 0.9, lerp: 0, offset: -(nearest ? 90 : 110) });
  } else node?.scrollIntoView({ block: nearest ? "nearest" : "start" });
}

export function launchArena() {
  withMotion(({ gsap }) => {
    gsap.fromTo(
      ".launch-shockwave",
      { autoAlpha: 1, scale: 0.98 },
      {
        autoAlpha: 0,
        scale: 1.08,
        duration: 0.7,
        ease: "power2.out",
        overwrite: true,
      },
    );
  });
  scrollArena("#comparison-grid");
}

export function connectionFeedback() {
  const hint = document.querySelector<HTMLElement>(".connection-hint");
  if (hint) hint.hidden = false;
  document.querySelector<HTMLElement>("polli-connect button")?.focus({ preventScroll: true });
  withMotion(({ gsap }) => {
    gsap.fromTo(
      ".run-button",
      { x: -6 },
      {
        x: 6,
        repeat: 5,
        yoyo: true,
        duration: 0.05,
        overwrite: true,
        onComplete: () => {
          gsap.set(".run-button", { x: 0 });
        },
      },
    );
    gsap.fromTo(
      hint,
      { autoAlpha: 0, y: -8 },
      { autoAlpha: 1, y: 0, duration: 0.35, ease: "arenaExpo", overwrite: true },
    );
    gsap.fromTo(
      "polli-connect",
      { boxShadow: "0 0 0 0px #ffe680" },
      { boxShadow: "0 0 0 12px transparent", duration: 0.8, repeat: 1, overwrite: true },
    );
  });
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export function pixelTheme(
  next: "day" | "night",
  apply: () => void,
  origin?: { x: number; y: number },
  ready?: Promise<unknown>,
) {
  settleTheme?.();
  let animated = false;
  withMotion(({ gsap }) => {
    const grid = document.querySelector<HTMLElement>(".pixel-transition-grid");
    if (!grid) return;
    animated = true;
    const matrix = grid.querySelector<HTMLElement>(".pixel-transition-matrix");
    const cols = Number(matrix?.getAttribute("data-cols") ?? 12);
    const side = Math.ceil(Math.max(innerWidth / cols, innerHeight / 8));
    grid.style.setProperty("--pixel-side", `${side}px`);
    grid.style.color = next === "day" ? "#f4efe6" : "#1c1b18";
    grid.hidden = false;
    const blocks = Array.from(grid.querySelectorAll<HTMLElement>(".pixel-transition-matrix > i"));
    const bloom = grid.querySelector<HTMLElement>(".pixel-transition-bloom");
    const ox = origin?.x ?? innerWidth / 2;
    const oy = origin?.y ?? innerHeight / 2;
    // One batched geometry read. On a portrait phone the square matrix overhangs the
    // screen and about half its pixels are off-canvas: they skip animation, and the
    // ripple is normalised to the visible pixels so it spans the whole screen.
    const rects = blocks.map((block) => block.getBoundingClientRect());
    const onScreen = rects.map(
      (r) => r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight,
    );
    const shown = blocks.filter((_, index) => onScreen[index]);
    const distances = rects
      .filter((_, index) => onScreen[index])
      .map((r) => Math.hypot(r.left + r.width / 2 - ox, r.top + r.height / 2 - oy));
    const farthest = Math.max(...distances, 1);
    const wave = (index: number) => (distances[index] / farthest) * 0.3;
    // Convex spacing: the lift ripple leaves the toggle quickly and slows as it
    // reaches the far edges, so the transition settles instead of snapping off.
    const liftWave = (index: number) => (distances[index] / farthest) ** 1.6 * 0.34;
    if (bloom) {
      bloom.style.setProperty("--bloom-x", `${ox}px`);
      bloom.style.setProperty("--bloom-y", `${oy}px`);
      bloom.style.background =
        next === "day"
          ? "radial-gradient(circle at var(--bloom-x) var(--bloom-y), rgb(255 205 105 / 0.55), rgb(255 205 105 / 0.16) 34%, transparent 70%)"
          : "radial-gradient(circle at var(--bloom-x) var(--bloom-y), rgb(126 156 255 / 0.42), rgb(126 156 255 / 0.12) 34%, transparent 70%)";
    }
    gsap.set(blocks, { scale: 0, opacity: 0 });
    if (bloom) gsap.set(bloom, { opacity: 0, scale: 0.7 });
    let applied = false;
    let cancelled = false;
    const swap = () => {
      if (!applied) {
        applied = true;
        apply();
      }
    };
    // Hold full cover until the new theme's art is decoded (bounded, so a dead
    // network never traps the screen), commit it, and lift only after it painted:
    // the restyle and image swap must never land inside the lift frames.
    const reveal = async () => {
      await Promise.race([ready, new Promise((resolve) => setTimeout(resolve, 800))]);
      if (cancelled) return;
      swap();
      await nextFrame();
      await nextFrame();
      if (!cancelled) timeline.resume();
    };
    const timeline = gsap.timeline({
      onComplete: () => {
        grid.hidden = true;
        settleTheme = undefined;
      },
    });
    timeline
      .to(shown, { scale: 1.01, opacity: 1, duration: 0.16, ease: "back.out(2.2)", delay: wave }, 0)
      .to(bloom, { opacity: 1, scale: 1.15, duration: 0.4, ease: "power2.out" }, 0.08)
      .addPause(0.46, () => void reveal())
      .to(bloom, { opacity: 0, scale: 1.5, duration: 0.8, ease: "sine.out" }, 0.47)
      // Coverage falls with scale squared, so a gentler curve preserves a visible tail.
      .to(shown, { scale: 0, duration: 0.9, ease: "themeLift", delay: liftWave }, 0.47)
      .to(shown, { opacity: 0, duration: 0.9, ease: "power2.in", delay: liftWave }, 0.47);
    settleTheme = () => {
      cancelled = true;
      timeline.kill();
      swap();
      grid.hidden = true;
      settleTheme = undefined;
    };
  });
  if (!animated) apply();
}

export function surprisePollen() {
  const bounds = document.querySelector(".surprise-button")?.getBoundingClientRect();
  if (bounds) burstAt?.(bounds.left + bounds.width / 2, bounds.bottom, 18);
}

export function celebrate(card: HTMLElement) {
  withMotion(({ gsap }) => {
    const bounds = card.getBoundingClientRect();
    if (bounds.bottom <= 0 || bounds.top >= innerHeight) return;
    const pill = card.querySelector(".answer-award-fastest");
    gsap.fromTo(
      pill,
      { autoAlpha: 0, scale: 0.6, y: 8 },
      { autoAlpha: 1, scale: 1, y: 0, duration: 0.5, ease: "arenaSnap" },
    );
    const header = card.querySelector(".model-heading")?.getBoundingClientRect();
    if (header) burstAt?.(header.left + header.width / 2, header.top + 25, 15);
  });
  beeComment("winner", card.querySelector(".model-heading h3")?.textContent?.trim());
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  age: number;
  color: string;
}
function canvasScene(api: Stack) {
  const canvas = document.querySelector<HTMLCanvasElement>("#pollen-stage");
  const fireworks = document.querySelector<HTMLCanvasElement>("#pollen-celebration");
  const hero = document.querySelector<HTMLElement>(".prompt-workspace");
  const ctx = canvas?.getContext("2d");
  const burstCtx = fireworks?.getContext("2d");
  if (!canvas || !fireworks || !hero || !ctx || !burstCtx) return () => {};
  let width = 0,
    height = 0,
    visible = true;
  let pointerX = -999,
    pointerY = -999,
    velocity = 0;
  let pointerRect: DOMRect | null = null;
  const colors = ["#ffe680", "#f59e0b", "#8eaf9d", "#7a9bc9"];
  // Low-end phones get a lighter particle budget; the scene reads the same.
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowPower =
    coarsePointer.matches && ((nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4);
  const pollen: Particle[] = Array.from({ length: lowPower ? 22 : 40 }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    vx: 0,
    vy: 8 + Math.random() * 9,
    size: 3 + (i % 4),
    age: Math.random() * 8,
    color: colors[i % colors.length],
  }));
  const confetti: Particle[] = [];
  // Touch devices have no pointer parallax; scroll velocity drives the same depth
  // layers so scrolling carries the garden's dimensionality on phones.
  const gardenLayer = coarsePointer.matches
    ? document.querySelector<HTMLElement>(".garden-scene-hero .garden-pointer")
    : null;
  const pollenLayer = coarsePointer.matches
    ? document.querySelector<HTMLElement>(".garden-scene-hero .garden-pollen")
    : null;
  const gardenY = gardenLayer
    ? api.gsap.quickTo(gardenLayer, "y", { duration: 0.7, ease: "power3.out" })
    : undefined;
  const pollenY = pollenLayer
    ? api.gsap.quickTo(pollenLayer, "y", { duration: 0.9, ease: "power3.out" })
    : undefined;
  let parallaxRest = 0;
  const bee = liveBee;
  if (!bee) return () => {};
  const readBeeColors = (): BeeColors => {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string) => cs.getPropertyValue(name).trim();
    const ink = v("--accent-ink");
    return {
      body: "#f8c63d",
      stripe: "#4a3620",
      wing: "#bcd9f5",
      head: "#2a2417",
      accent: ink ? `rgb(${ink})` : "#f59e0b",
      bubbleBg: v("--foreground") ? `rgb(${v("--foreground")})` : "rgba(28,27,24,0.92)",
      bubbleInk: v("--canvas") ? `rgb(${v("--canvas")})` : "#f4efe6",
      bubbleLine: ink ? `rgb(${ink} / 0.6)` : "rgba(245,158,11,0.6)",
    };
  };
  bee.setColors(readBeeColors());
  bee.setEnabled(beeEnabled);
  const themeObserver = new MutationObserver(() => bee.setColors(readBeeColors()));
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-color-mode"],
  });
  const resize = () => {
    width = hero.clientWidth;
    height = hero.clientHeight;
    pointerRect = null;
    // CSS-pixel resolution keeps every square crisp and bounds fill cost on high-DPI screens.
    canvas.width = width;
    canvas.height = height;
    fireworks.width = innerWidth;
    fireworks.height = innerHeight;
    bee.resize(innerWidth, innerHeight);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(hero);
  window.addEventListener("resize", resize);
  api.ScrollTrigger.create({
    trigger: hero,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => {
      visible = self.isActive;
    },
  });
  const pointer = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (!pointerRect) pointerRect = hero.getBoundingClientRect();
    pointerX = event.clientX - pointerRect.left;
    pointerY = event.clientY - pointerRect.top;
    velocity = Math.min(18, Math.hypot(event.movementX, event.movementY));
  };
  const leave = () => {
    pointerX = pointerY = -999;
  };
  const invalidatePointerRect = () => {
    pointerRect = null;
  };
  hero.addEventListener("pointermove", pointer);
  hero.addEventListener("pointerleave", leave);
  window.addEventListener("scroll", invalidatePointerRect, { passive: true });
  burstAt = (x, y, count = 15, tint) => {
    if (document.hidden) return;
    const total = lowPower ? Math.ceil(count / 2) : count;
    const cap = lowPower ? 30 : 60;
    for (let i = 0; i < total && confetti.length < cap; i++) {
      const angle = Math.random() * Math.PI * 2;
      confetti.push({
        x,
        y,
        vx: Math.cos(angle) * 95,
        vy: Math.sin(angle) * 95 - 45,
        age: 0,
        size: 3 + (i % 4),
        color: tint && i % 3 !== 2 ? tint : colors[i % colors.length],
      });
    }
  };
  // --- bee mascot input (viewport space, mouse only) ---
  const flowerSelector =
    ".model-toggle, .preset-button, .brand-link, .surprise-button, .badge-link, .garden-caption span";
  let currentFlower: Element | null = null;
  let currentHoverKey = "";
  // Cache the flower's document position so scrolling never forces a layout read.
  let flowerDoc: { left: number; top: number; width: number; height: number } | null = null;
  let flowerDirty = false;
  let celebrationDirty = false;
  const beePointer = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    bee.pointer(event.clientX, event.clientY, Math.hypot(event.movementX, event.movementY));
  };
  const beeLeave = () => bee.pointerLeave();
  // Resolve what the pointer is over into a commentary target: a model card/toggle
  // (with a fastest/cheapest tag when its award badge is present) or a site region.
  const resolveHover = (
    target: Element | null,
  ): { key: string; zone: BeeZone | null; name?: string; tag?: BeeTag } => {
    if (
      !target ||
      target.closest("input, textarea, select, dialog, polli-connect, .history-popover")
    )
      return { key: "", zone: null };
    const card = target.closest<HTMLElement>(".model-column:not(.flip-departure)");
    if (card) {
      const name = card.querySelector(".model-heading h3")?.textContent?.trim();
      const tag: BeeTag | undefined = target.closest(".answer-award-fastest")
        ? "fastest"
        : target.closest(".answer-award:not(.answer-award-fastest)")
          ? "cheapest"
          : undefined;
      return { key: `m:${name ?? ""}:${tag ?? ""}`, zone: "model", name, tag };
    }
    const toggle = target.closest<HTMLElement>(".model-toggle");
    if (toggle) {
      const name = toggle.getAttribute("aria-label") ?? undefined;
      return { key: `m:${name ?? ""}:`, zone: "model", name };
    }
    const zone: BeeZone | null = target.closest(".site-header")
      ? "header"
      : target.closest(".site-footer, .garden-scene-closing")
        ? "footer"
        : target.closest("#results")
          ? "results"
          : target.closest(".model-roster")
            ? "roster"
            : target.closest(".prompt-workspace")
              ? "hero"
              : null;
    return zone ? { key: `a:${zone}`, zone } : { key: "", zone: null };
  };
  let lastTapKey = "";
  let lastTapAt = -1e9;
  const beeOver = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const target = event.target instanceof Element ? event.target : null;
    const flower = target?.closest(flowerSelector) ?? null;
    if (flower !== currentFlower) {
      currentFlower = flower;
      if (flower) {
        const rect = flower.getBoundingClientRect();
        flowerDoc = {
          left: rect.left + window.scrollX,
          top: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
        };
        bee.flower(rect);
      } else {
        flowerDoc = null;
        bee.flower(null);
      }
    }
    const hover = resolveHover(target);
    if (hover.key !== currentHoverKey) {
      currentHoverKey = hover.key;
      bee.hover(hover.zone, hover.name, hover.tag);
    }
  };
  const beeClick = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest(
        "button, a, input, textarea, select, summary, [role=button], dialog, polli-connect, .history-popover, .bee-home",
      )
    ) {
      // A specific award tap has context; ordinary control activation cannot feed or boop.
      const award = target?.closest(".answer-award, .model-toggle");
      if (award && coarsePointer.matches) {
        const hover = resolveHover(award);
        bee.hover(hover.zone, hover.name, hover.tag);
      }
      return;
    }
    if (event.detail === 0) return;
    bee.click(event.clientX, event.clientY, Boolean(target?.closest(".garden-pet, .ghost-card")));
    // Touch parity: a tap on a card/toggle/area earns the same context line as a
    // mouse hover, deduped and rate-limited by the bee's calm touch cadence.
    if (!coarsePointer.matches) return;
    const hover = resolveHover(target);
    const now = performance.now();
    // Region jokes stay hover-only; a tap earns model context, never area lines.
    if (hover.zone !== "model" || (hover.key === lastTapKey && now - lastTapAt < 6000)) return;
    lastTapKey = hover.key;
    lastTapAt = now;
    bee.hover(hover.zone, hover.name, hover.tag);
  };
  let lastScrollY = window.scrollY;
  let lastScrollT = performance.now();
  const beeScroll = () => {
    const now = performance.now();
    const scrollY = window.scrollY;
    const dy = scrollY - lastScrollY;
    const dt = Math.max(0.016, (now - lastScrollT) / 1000);
    bee.scroll();
    if (gardenY || pollenY) {
      const push = Math.max(-16, Math.min(16, (dy / dt) * 0.018));
      gardenY?.(push);
      pollenY?.(-push * 0.6);
      window.clearTimeout(parallaxRest);
      parallaxRest = window.setTimeout(() => {
        gardenY?.(0);
        pollenY?.(0);
      }, 160);
    }
    lastScrollY = scrollY;
    lastScrollT = now;
    if (!currentFlower?.isConnected) {
      if (currentFlower) {
        currentFlower = null;
        flowerDoc = null;
        bee.flower(null);
      }
      return;
    }
    // Re-measure only after a resize/layout shift, never on every scroll frame.
    if (flowerDirty || !flowerDoc) {
      const rect = currentFlower.getBoundingClientRect();
      flowerDoc = {
        left: rect.left + window.scrollX,
        top: rect.top + scrollY,
        width: rect.width,
        height: rect.height,
      };
      flowerDirty = false;
    }
    bee.flower({
      left: flowerDoc.left - window.scrollX,
      top: flowerDoc.top - scrollY,
      width: flowerDoc.width,
      height: flowerDoc.height,
    });
  };
  const invalidateFlower = () => {
    flowerDirty = true;
  };
  document.addEventListener("pointermove", beePointer);
  document.documentElement.addEventListener("pointerleave", beeLeave);
  document.addEventListener("pointerover", beeOver);
  document.addEventListener("click", beeClick);
  window.addEventListener("scroll", beeScroll, { passive: true });
  window.addEventListener("resize", invalidateFlower);
  const unsubscribe = subscribeClock((time, delta) => {
    if (document.hidden) return;
    const dt = Math.min(delta / 1000, 0.04);
    if (visible) {
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 0.58;
      for (const particle of pollen) {
        particle.y -= (particle.vy * dt) / height;
        if (particle.y < 0) particle.y = 1;
        const x = particle.x * width + Math.sin((time / 1000) * 0.6 + particle.age) * 12;
        const y = particle.y * height;
        const distance = Math.hypot(x - pointerX, y - pointerY);
        if (distance < 110 && distance > 0)
          particle.vx += ((x - pointerX) / distance) * velocity * dt * 8;
        particle.vx *= 0.96;
        particle.x = (particle.x + (particle.vx * dt) / width + 1) % 1;
        ctx.fillStyle = particle.color;
        ctx.fillRect(Math.round(x), Math.round(y), particle.size, particle.size);
      }
      velocity *= 0.94;
    }
    if (confetti.length || bee.active || celebrationDirty) {
      burstCtx.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 160 * dt;
        burstCtx.globalAlpha = Math.max(0, 1 - p.age / 0.95);
        burstCtx.fillStyle = p.color;
        burstCtx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        if (p.age > 0.95) confetti.splice(i, 1);
      }
      burstCtx.globalAlpha = 1;
      bee.draw(burstCtx);
      celebrationDirty = confetti.length > 0 || bee.active;
    }
  });
  return () => {
    unsubscribe();
    observer.disconnect();
    themeObserver.disconnect();
    window.clearTimeout(parallaxRest);
    for (const layer of [gardenLayer, pollenLayer]) {
      if (!layer) continue;
      api.gsap.killTweensOf(layer);
      layer.style.removeProperty("transform");
    }
    window.removeEventListener("resize", resize);
    window.removeEventListener("resize", invalidateFlower);
    window.removeEventListener("scroll", invalidatePointerRect);
    window.removeEventListener("scroll", beeScroll);
    document.removeEventListener("pointermove", beePointer);
    document.documentElement.removeEventListener("pointerleave", beeLeave);
    document.removeEventListener("pointerover", beeOver);
    document.removeEventListener("click", beeClick);
    hero.removeEventListener("pointermove", pointer);
    hero.removeEventListener("pointerleave", leave);
    ctx.clearRect(0, 0, width, height);
    burstCtx.clearRect(0, 0, innerWidth, innerHeight);
    burstAt = undefined;
  };
}

function pointerScene(api: Stack) {
  const { gsap } = api;
  const cursor = document.querySelector<HTMLElement>(".arena-cursor");
  if (!cursor) return () => {};
  // Hover owns the lift; the tactile press scene owns scale, so the two never fight.
  const secondary = new Map<HTMLElement, gsap.QuickToFunc>();
  let secondaryTarget: HTMLElement | null = null;
  let heroRect: DOMRect | null = null;
  const invalidateGeometry = () => {
    heroRect = null;
  };
  const setters = new Map<HTMLElement, { x: gsap.QuickToFunc; y: gsap.QuickToFunc }>();
  const tilts = new Map<HTMLElement, { x: gsap.QuickToFunc; y: gsap.QuickToFunc }>();
  const xCursor = gsap.quickTo(cursor, "x", { duration: 0.18, ease: "power3" });
  const yCursor = gsap.quickTo(cursor, "y", { duration: 0.18, ease: "power3" });
  const garden = document.querySelector<HTMLElement>(".garden-scene-hero .garden-pointer");
  const back = document.querySelector<HTMLElement>(".garden-scene-hero .garden-pollen");
  const gx = garden ? gsap.quickTo(garden, "x", { duration: 0.8, ease: "power3" }) : undefined;
  const gy = garden ? gsap.quickTo(garden, "y", { duration: 0.8, ease: "power3" }) : undefined;
  const bx = back ? gsap.quickTo(back, "x", { duration: 0.8, ease: "power3" }) : undefined;
  const by = back ? gsap.quickTo(back, "y", { duration: 0.8, ease: "power3" }) : undefined;
  const magneticSelector =
    ".run-button, .theme-button, .surprise-button, .composer-chip, polli-connect > div > button, polli-connect > button";
  let currentMagnet: HTMLElement | null = null;
  let currentCard: HTMLElement | null = null;
  const resetMagnet = () => {
    if (currentMagnet) {
      const to = setters.get(currentMagnet);
      to?.x(0);
      to?.y(0);
    }
    currentMagnet = null;
  };
  const resetCard = () => {
    if (currentCard) {
      const to = tilts.get(currentCard);
      to?.x(0);
      to?.y(0);
      currentCard.style.removeProperty("--spotlight-opacity");
    }
    currentCard = null;
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || document.querySelector("dialog[open]")) return;
    cursor.hidden = false;
    xCursor(event.clientX);
    yCursor(event.clientY);
    const target = event.target instanceof Element ? event.target : null;
    const control =
      target?.closest<HTMLElement>(
        ".model-toggle, .nav-link, .more-models-button, .preset-button, .expand-button",
      ) ?? null;
    if (control !== secondaryTarget) {
      if (secondaryTarget) secondary.get(secondaryTarget)?.(0);
      secondaryTarget = control;
    }
    if (control && !control.matches(":disabled")) {
      let to = secondary.get(control);
      if (!to) {
        to = gsap.quickTo(control, "y", { duration: 0.35, ease: "arenaExpo" });
        secondary.set(control, to);
      }
      to(-2);
    }
    const magnet = target?.closest<HTMLElement>(magneticSelector) ?? null;
    if (magnet !== currentMagnet) {
      resetMagnet();
      currentMagnet = magnet;
    }
    if (magnet && !magnet.matches(":disabled")) {
      let to = setters.get(magnet);
      if (!to) {
        // A smooth, critically-damped lean rather than a bouncy elastic: a magnet that
        // oscillates for ~1s reads as jitter and keeps the control "moving" for pointer
        // tooling, so repeated clicks (e.g. Surprise draws) stall waiting for stability.
        to = {
          x: gsap.quickTo(magnet, "x", { duration: 0.3, ease: "power3.out" }),
          y: gsap.quickTo(magnet, "y", { duration: 0.3, ease: "power3.out" }),
        };
        setters.set(magnet, to);
      }
      const rect = magnet.getBoundingClientRect();
      // Subtract the current translation so the magnetic anchor cannot drift.
      const dx = event.clientX - rect.left - rect.width / 2 + Number(gsap.getProperty(magnet, "x"));
      const dy = event.clientY - rect.top - rect.height / 2 + Number(gsap.getProperty(magnet, "y"));
      // A center dead-zone lets the button rest exactly at origin once the pointer is
      // close to its middle. Without it, a pointer aiming at the *translated* center
      // (as automated clicks do) re-targets the magnet forever in a converging loop.
      to.x(Math.abs(dx) < 8 ? 0 : dx * 0.22);
      to.y(Math.abs(dy) < 8 ? 0 : dy * 0.22);
    }
    const card = target?.closest<HTMLElement>(".model-column:not(.flip-departure)") ?? null;
    if (card !== currentCard) {
      resetCard();
      currentCard = card;
    }
    cursor.dataset.target = magnet?.classList.contains("run-button") ? "run" : card ? "card" : "";
    if (cursor.dataset.target === "run" && magnet) {
      const label = cursor.querySelector<HTMLElement>(".arena-cursor-label");
      if (label) {
        // Hang the tag off the button's bottom edge: at pointer height it would
        // cover the button's own label and read as garbled double text.
        const rect = magnet.getBoundingClientRect();
        const width = label.offsetWidth || 46;
        label.style.top = `${rect.bottom - event.clientY + 10}px`;
        label.style.left =
          event.clientX + 22 + width > window.innerWidth - 8 ? `${-width - 14}px` : "22px";
      }
    }
    if (card) {
      const plane = card.querySelector<HTMLElement>(".card-tilt");
      if (plane) {
        let to = tilts.get(card);
        if (!to) {
          to = {
            x: gsap.quickTo(plane, "rotationX", { duration: 0.5, ease: "power3" }),
            y: gsap.quickTo(plane, "rotationY", { duration: 0.5, ease: "power3" }),
          };
          tilts.set(card, to);
        }
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left,
          y = event.clientY - rect.top;
        to.x(Math.max(-4, Math.min(4, (0.5 - y / rect.height) * 8)));
        to.y(Math.max(-4, Math.min(4, (x / rect.width - 0.5) * 8)));
        card.style.setProperty("--mouse-x", `${x}px`);
        card.style.setProperty("--mouse-y", `${y}px`);
        card.style.setProperty("--spotlight-opacity", "1");
      }
    }
    const hero = target?.closest(".question-workbench");
    if (hero && !heroRect) heroRect = hero.getBoundingClientRect();
    const rect = hero ? heroRect : null;
    if (rect) {
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      gx?.(x * 14);
      gy?.(y * 10);
      bx?.(x * -6);
      by?.(y * -4);
    } else {
      gx?.(0);
      gy?.(0);
      bx?.(0);
      by?.(0);
    }
  };
  const pruneTargets = () => {
    for (const [node, to] of secondary) {
      if (node.isConnected) continue;
      to.tween.kill();
      secondary.delete(node);
    }
    for (const targets of [setters, tilts]) {
      for (const [node, to] of targets) {
        if (node.isConnected) continue;
        to.x.tween.kill();
        to.y.tween.kill();
        targets.delete(node);
      }
    }
    if (secondaryTarget && !secondaryTarget.isConnected) secondaryTarget = null;
    if (currentMagnet && !currentMagnet.isConnected) currentMagnet = null;
    if (currentCard && !currentCard.isConnected) currentCard = null;
  };
  const observer = new MutationObserver((records) => {
    if (records.some((record) => [...record.removedNodes].some((node) => node instanceof Element)))
      pruneTargets();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  // These maps own transient tweens so the scene context cannot retain removed targets.
  const onMove = move;
  const leave = () => {
    cursor.hidden = true;
    if (secondaryTarget) secondary.get(secondaryTarget)?.(0);
    secondaryTarget = null;
    resetMagnet();
    resetCard();
    gx?.(0);
    gy?.(0);
    bx?.(0);
    by?.(0);
  };
  document.addEventListener("pointermove", onMove);
  document.documentElement.addEventListener("pointerleave", leave);
  window.addEventListener("blur", leave);
  window.addEventListener("scroll", invalidateGeometry, { passive: true });
  window.addEventListener("resize", invalidateGeometry);
  return () => {
    document.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", leave);
    window.removeEventListener("blur", leave);
    window.removeEventListener("scroll", invalidateGeometry);
    window.removeEventListener("resize", invalidateGeometry);
    observer.disconnect();
    for (const to of secondary.values()) to.tween.kill();
    for (const targets of [setters, tilts]) {
      for (const to of targets.values()) {
        to.x.tween.kill();
        to.y.tween.kill();
      }
    }
    cursor.hidden = true;
    restTransforms([cursor, garden, back, ...secondary.keys(), ...setters.keys()]);
    for (const [node] of tilts) {
      node.style.removeProperty("--spotlight-opacity");
      node.style.removeProperty("--mouse-x");
      node.style.removeProperty("--mouse-y");
      restTransforms([node.querySelector(".card-tilt")]);
    }
    secondary.clear();
    setters.clear();
    tilts.clear();
    secondaryTarget = null;
    currentMagnet = null;
    currentCard = null;
  };
}

const DECODE_GLYPHS = "01<>+";

/**
 * Delegated tactile feedback: every pressable control squishes under the pointer and
 * rebounds with a soft elastic release; clicks emit a provider-tinted pollen burst from
 * the shared celebration canvas. One set of document-level listeners covers every current
 * and future control — no per-node bindings, no extra animation loop, no added DOM nodes.
 */
function tactileScene(api: Stack) {
  const { gsap } = api;
  const pressable =
    "button:not(:disabled), a.nav-link, summary, [role='button'], .composer-chip, .model-column";
  let pressed: HTMLElement | null = null;

  const release = (bounce: boolean) => {
    const node = pressed;
    pressed = null;
    if (!node) return;
    withMotion(() => {
      gsap.to(node, {
        scale: 1,
        // A single springy overshoot reads as life; prolonged elastic oscillation
        // keeps the control "moving" for pointer tooling and reads as jitter.
        duration: bounce ? 0.34 : 0.18,
        ease: bounce ? "arenaSnap" : "power2.out",
        overwrite: "auto",
      });
    });
  };

  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".bee-home")) return;
    const node = target?.closest<HTMLElement>(pressable) ?? null;
    if (!node || node.matches(":disabled") || node.getAttribute("aria-disabled") === "true") return;
    if (pressed && pressed !== node) release(false);
    pressed = node;
    withMotion(() => {
      gsap.to(node, {
        scale: node.classList.contains("run-button") ? 0.93 : 0.955,
        duration: 0.12,
        ease: "power2.out",
        overwrite: "auto",
      });
    });
  };
  const up = () => release(true);
  const cancel = () => release(false);

  const click = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".bee-home")) return;
    const node = target?.closest<HTMLElement>(pressable) ?? null;
    if (!node || node.matches(":disabled")) return;
    withMotion(() => {
      const host = node.closest<HTMLElement>("[data-model-id]");
      const tint = host?.style.getPropertyValue("--provider-color").trim() || undefined;
      const isRun = node.classList.contains("run-button");
      burstAt?.(
        event.clientX,
        event.clientY,
        isRun ? 30 : 12,
        tint ?? (isRun ? "#f59e0b" : undefined),
      );
    });
  };

  document.addEventListener("pointerdown", down);
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", cancel);
  document.addEventListener("click", click);
  window.addEventListener("blur", cancel);
  return () => {
    document.removeEventListener("pointerdown", down);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", cancel);
    document.removeEventListener("click", click);
    window.removeEventListener("blur", cancel);
    // Kill, don't animate: cleanup runs inside matchMedia revert, so a new tween here would survive it.
    if (pressed) gsap.killTweensOf(pressed);
    restTransforms([pressed]);
    pressed = null;
  };
}

/**
 * The headline keeps its glyph-decode hover and adds a per-character pollen wave:
 * nearby letters lift and tint toward pollen as the pointer crosses them. Splitting
 * lives here (not in the one-time intro) so the interaction survives pause/resume.
 */
function sloganScene(api: Stack, animateArrival: boolean) {
  const { gsap, SplitText } = api;
  const slogan = document.querySelector<HTMLElement>(".slogan");
  if (!slogan) return () => {};
  const cleanups: (() => void)[] = [];
  const labels = [...slogan.querySelectorAll<HTMLElement>(".scramble-label")];
  labels.forEach((label, lineIndex) => {
    const state: { chars: HTMLElement[]; originals: string[] } = { chars: [], originals: [] };
    const lifts = new Map<HTMLElement, gsap.QuickToFunc>();
    let decodeTween: gsap.core.Tween | undefined;
    let arrived = false;
    let centers: { x: number; y: number }[] = [];
    let centersDirty = true;
    const lastProximity = new Map<HTMLElement, number>();
    // One batched geometry read per enter/scroll, never per pointermove (avoids layout thrash).
    const measure = () => {
      centers = state.chars.map((char) => {
        const rect = char.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      centersDirty = false;
    };

    const restore = () => {
      decodeTween?.kill();
      decodeTween = undefined;
      lastProximity.clear();
      state.chars.forEach((char, index) => {
        char.textContent = state.originals[index] ?? char.textContent;
        char.style.removeProperty("color");
        lifts.get(char)?.(0);
      });
      delete label.dataset.scrambling;
    };

    const decode = () => {
      if (!state.chars.length) return;
      decodeTween?.kill();
      const proxy = { progress: 0 };
      label.dataset.scrambling = "true";
      decodeTween = gsap.to(proxy, {
        progress: 1,
        duration: 0.55,
        ease: "none",
        onUpdate: () => {
          state.chars.forEach((char, index) => {
            const original = state.originals[index] ?? "";
            char.textContent =
              original === " " || index / state.chars.length < proxy.progress
                ? original
                : DECODE_GLYPHS[(index + Math.floor(proxy.progress * 18)) % DECODE_GLYPHS.length];
          });
        },
        onComplete: () => {
          state.chars.forEach((char, index) => {
            char.textContent = state.originals[index] ?? "";
          });
          delete label.dataset.scrambling;
          decodeTween = undefined;
        },
      });
    };

    const split = SplitText.create(label, {
      type: "lines,words,chars",
      mask: "lines",
      autoSplit: true,
      charsClass: "kinetic-char",
      wordsClass: "kinetic-word",
      aria: "none",
      onSplit: (self) => {
        state.chars = self.chars as HTMLElement[];
        state.originals = state.chars.map((char) => char.textContent ?? "");
        lifts.clear();
        if (!animateArrival || arrived) return;
        arrived = true;
        const chars = state.chars;
        const originals = state.originals;
        const proxy = { progress: 0 };
        const arrival = gsap.timeline({ delay: 0.12 + lineIndex * 0.08 });
        arrival
          .from(
            chars,
            { yPercent: 115, rotationZ: 3, duration: 0.85, ease: "arenaExpo", stagger: 0.025 },
            0,
          )
          .to(
            proxy,
            {
              progress: 1,
              duration: 0.7,
              ease: "none",
              onUpdate: () => {
                chars.forEach((char, index) => {
                  char.textContent =
                    index / chars.length < proxy.progress
                      ? originals[index]
                      : DECODE_GLYPHS[
                          (index + Math.floor(proxy.progress * 18)) % DECODE_GLYPHS.length
                        ];
                });
              },
              onComplete: () => {
                chars.forEach((char, index) => {
                  char.textContent = originals[index];
                });
              },
            },
            0,
          );
        return arrival;
      },
    });

    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      centersDirty = true;
      withMotion(decode);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      withMotion(() => {
        if (centersDirty) measure();
        const radius = 120;
        const { clientX, clientY } = event;
        state.chars.forEach((char, index) => {
          const center = centers[index];
          if (!center) return;
          const distance = Math.hypot(center.x - clientX, center.y - clientY);
          const proximity = Math.max(0, 1 - distance / radius);
          // Skip chars whose influence is unchanged: no redundant tween or style write.
          const bucket = Math.round(proximity * 100);
          if (lastProximity.get(char) === bucket) return;
          lastProximity.set(char, bucket);
          let lift = lifts.get(char);
          if (!lift) {
            lift = gsap.quickTo(char, "y", { duration: 0.45, ease: "power3" });
            lifts.set(char, lift);
          }
          lift(-14 * proximity);
          char.style.color =
            proximity > 0.02
              ? `color-mix(in srgb, rgb(var(--accent-ink)) ${Math.round(proximity * 85)}%, rgb(var(--foreground)))`
              : "";
        });
      });
    };
    const leave = () => withMotion(restore);
    const invalidate = () => {
      centersDirty = true;
    };
    label.addEventListener("pointerenter", enter);
    label.addEventListener("pointermove", move);
    label.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate);
    cleanups.push(() => {
      label.removeEventListener("pointerenter", enter);
      label.removeEventListener("pointermove", move);
      label.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
      decodeTween?.kill();
      split.revert();
      label.textContent = label.dataset.text ?? label.textContent;
      delete label.dataset.scrambling;
    });
  });
  return () => {
    cleanups.forEach((fn) => {
      fn();
    });
  };
}

/** Ambient atmosphere and scroll feedback; every moving layer is GSAP-owned. */
function ambientScene(api: Stack) {
  const { gsap, ScrollTrigger } = api;
  const cleanups: (() => void)[] = [];

  const aura = document.querySelector<HTMLElement>(".hero-aura");
  if (aura) {
    const driftA = gsap.to(aura.querySelector(".aura-blob-a"), {
      x: 60,
      y: 40,
      scale: 1.15,
      duration: 9,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    const driftB = gsap.to(aura.querySelector(".aura-blob-b"), {
      x: -50,
      y: -30,
      scale: 1.1,
      duration: 12,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    const trigger = ScrollTrigger.create({
      trigger: ".prompt-workspace",
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => {
        const play = self.isActive && !document.hidden;
        if (play) {
          driftA.play();
          driftB.play();
        } else {
          driftA.pause();
          driftB.pause();
        }
      },
    });
    const visibility = () => {
      const play = trigger.isActive && !document.hidden;
      if (play) {
        driftA.play();
        driftB.play();
      } else {
        driftA.pause();
        driftB.pause();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    cleanups.push(() => {
      document.removeEventListener("visibilitychange", visibility);
      trigger.kill();
      driftA.kill();
      driftB.kill();
    });
  }

  const progress = document.querySelector(".scroll-progress");
  if (progress) {
    gsap.fromTo(
      progress,
      { scaleX: 0 },
      { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } },
    );
  }

  // Cinematic parallax zoom as the hero leaves the viewport.
  gsap.to(".garden-scene-hero .garden-image", {
    scale: 1.08,
    yPercent: -5,
    ease: "none",
    scrollTrigger: {
      trigger: ".prompt-workspace",
      start: "top top",
      end: "bottom top",
      scrub: 0.6,
    },
  });
  gsap.to(".workspace-intro", {
    y: -36,
    ease: "none",
    scrollTrigger: {
      trigger: ".prompt-workspace",
      start: "top top",
      end: "bottom top",
      scrub: 0.6,
    },
  });
  gsap.fromTo(
    ".garden-scene-closing .garden-image",
    { scale: 0.96 },
    {
      scale: 1.04,
      ease: "none",
      scrollTrigger: {
        trigger: ".site-footer",
        start: "top bottom",
        end: "bottom bottom",
        scrub: 1,
      },
    },
  );

  // A periodic glint invites the primary action while it is ready.
  const run = document.querySelector<HTMLElement>(".run-button");
  const glint = run?.querySelector<HTMLElement>(".run-glint");
  if (run && glint) {
    const sweep = gsap
      .timeline({ repeat: -1, repeatDelay: 3.4, paused: true })
      .fromTo(
        glint,
        { xPercent: -160, skewX: -18, opacity: 0 },
        { xPercent: 260, skewX: -18, opacity: 0.55, duration: 0.9, ease: "power2.inOut" },
      )
      .set(glint, { opacity: 0 });
    const update = () => {
      const ready = !run.matches(":disabled") && !run.classList.contains("run-button-stop");
      ready ? sweep.play() : sweep.pause(0);
    };
    const observer = new MutationObserver(update);
    observer.observe(run, { attributes: true, attributeFilter: ["disabled", "class"] });
    update();
    cleanups.push(() => {
      observer.disconnect();
      sweep.kill();
      gsap.set(glint, { clearProps: "all" });
    });
  }

  return () => {
    cleanups.forEach((fn) => {
      fn();
    });
  };
}

function choreography(api: Stack) {
  const { gsap, SplitText, ScrollTrigger } = api;
  const cleanup: (() => void)[] = [];
  let alive = true;
  const makeIntro = () => {
    if (!alive || introPlayed) return;
    introPlayed = true;
    const timeline = gsap.timeline({
      onComplete: () => {
        gsap.set(
          ".site-header-inner, .brand-link, .main-navigation, .mobile-menu-button, .header-account, .garden-scene-hero, .question-band, .model-roster",
          {
            clearProps: "transform,opacity,visibility,clipPath",
          },
        );
      },
    });
    // Never transform the header shell: a transformed ancestor becomes the
    // containing block for the fixed .table-actions bar and traps it over the
    // header controls on phones. Fade the shell, slide only fixed-free rows.
    timeline
      .from(".site-header-inner", { autoAlpha: 0, duration: 0.55, ease: "arenaExpo" })
      .from(
        ".brand-link, .main-navigation, .mobile-menu-button, .header-account",
        { y: -14, autoAlpha: 0, duration: 0.5, ease: "arenaExpo", stagger: 0.05 },
        0.05,
      )
      .from(
        ".garden-scene-hero",
        {
          scale: 0.94,
          clipPath: "inset(12% 12% 12% 12%)",
          autoAlpha: 0,
          duration: 0.65,
          ease: "arenaExpo",
        },
        0.18,
      )
      .from(".question-band", { x: 30, autoAlpha: 0, duration: 0.65, ease: "arenaExpo" }, 0.32)
      .from(".model-roster", { y: 12, autoAlpha: 0, duration: 0.55, ease: "arenaExpo" }, 0.5);
    document
      .querySelectorAll<HTMLElement>(".workspace-lede > span:first-child")
      .forEach((label, i) => {
        const split = SplitText.create(label, {
          type: coarsePointer.matches ? "lines,words" : "lines,words,chars",
          mask: "lines",
          autoSplit: true,
          charsClass: "kinetic-char",
          wordsClass: "kinetic-word",
          aria: "none",
          onSplit: (self) => {
            // Per-character decode writes textContent every frame; on throttled
            // phone CPUs that alone owns the load long-task. Words bloom instead.
            if (coarsePointer.matches) {
              const words = self.words as HTMLElement[];
              return gsap.from(words, {
                yPercent: 115,
                duration: 0.7,
                ease: "arenaExpo",
                stagger: 0.05,
                delay: 0.12 + i * 0.08,
              });
            }
            const chars = self.chars as HTMLElement[];
            const originals = chars.map((char) => char.textContent ?? "");
            const decode = { progress: 0 };
            const arrival = gsap.timeline({ delay: 0.12 + i * 0.08 });
            arrival
              .from(
                chars,
                { yPercent: 115, rotationZ: 3, duration: 0.85, ease: "arenaExpo", stagger: 0.025 },
                0,
              )
              .to(
                decode,
                {
                  progress: 1,
                  duration: 0.7,
                  ease: "none",
                  onUpdate: () => {
                    chars.forEach((char, index) => {
                      char.textContent =
                        index / chars.length < decode.progress
                          ? originals[index]
                          : "01<>+"[(index + Math.floor(decode.progress * 18)) % 5];
                    });
                  },
                  onComplete: () => {
                    chars.forEach((char, index) => {
                      char.textContent = originals[index];
                    });
                  },
                },
                0,
              );
            return arrival;
          },
        });
        cleanup.push(() => split.revert());
      });
  };
  void document.fonts.ready.then(() =>
    withMotion(() => {
      if (!alive) return;
      cleanup.push(sloganScene(api, !introPlayed));
      makeIntro();
    }),
  );
  cleanup.push(ambientScene(api));
  const garden = document.querySelector(".garden-scene-hero .garden-drift");
  const float = gsap.to(garden, {
    y: -5,
    duration: 3.8,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });
  ScrollTrigger.create({
    trigger: ".garden-scene-hero",
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => {
      self.isActive ? float.play() : float.pause();
    },
  });
  gsap.from(".garden-scene-closing .garden-scroll", {
    y: 28,
    ease: "none",
    scrollTrigger: { trigger: ".site-footer", start: "top bottom", end: "bottom bottom", scrub: 1 },
  });
  gsap.from(".garden-caption", {
    y: 18,
    autoAlpha: 0,
    ease: "none",
    scrollTrigger: { trigger: ".site-footer", start: "top bottom", end: "center bottom", scrub: 1 },
  });
  const cardTriggers = new Map<Element, ScrollTrigger[]>();
  const mountCards = () => {
    const fresh = [
      ...document.querySelectorAll<HTMLElement>(".comparison-grid > .model-column"),
    ].filter((node) => !cardTriggers.has(node));
    for (const [node, triggers] of cardTriggers) {
      if (!node.isConnected) {
        triggers.forEach((trigger) => {
          trigger.kill();
        });
        cardTriggers.delete(node);
      }
    }
    if (!fresh.length) return;
    const offscreen = fresh.filter((node) => node.getBoundingClientRect().top > innerHeight);
    fresh.forEach((node) => {
      cardTriggers.set(node, []);
    });
    if (offscreen.length) {
      for (const node of offscreen) {
        const plane = node.querySelector<HTMLElement>(".card-arrival");
        if (plane) {
          plane.style.transform = "translate3d(0, 40px, 0) rotateX(12deg)";
          plane.style.opacity = "0";
        }
      }
      const triggers = ScrollTrigger.batch(offscreen, {
        start: "top 96%",
        once: true,
        interval: 0.08,
        onEnter: (nodes) => {
          return gsap.to(
            nodes.map((node) => node.querySelector(".card-arrival")),
            {
              y: 0,
              rotationX: 0,
              opacity: 1,
              duration: 0.65,
              stagger: 0.08,
              ease: "arenaExpo",
              overwrite: true,
            },
          );
        },
      });
      offscreen.forEach((node, i) => {
        cardTriggers.set(node, [triggers[i]]);
      });
    }
  };
  mountCards();
  const observer = new MutationObserver(() => withMotion(mountCards));
  const results = document.querySelector("#results");
  if (results) observer.observe(results, { childList: true, subtree: true });
  const scrambles = new WeakMap<HTMLElement, gsap.core.Tween>();
  const hoverScramble = (event: PointerEvent) => {
    const target =
      event.target instanceof Element ? event.target.closest(".nav-link, .surprise-button") : null;
    if (!target || target.contains(event.relatedTarget as Node | null)) return;
    // Touch taps decode the Surprise label; nav links stay mouse-only.
    if (event.pointerType !== "mouse" && !target.classList.contains("surprise-button")) return;
    const label = target.querySelector<HTMLElement>(".scramble-label");
    if (!label) return;
    withMotion(() => {
      const text = label.dataset.text ?? label.textContent ?? "";
      label.dataset.text = text;
      scrambles.get(label)?.kill();
      const decode = { progress: 0 };
      scrambles.set(
        label,
        gsap.to(decode, {
          progress: 1,
          duration: 0.32,
          onUpdate: () => {
            label.textContent = [...text]
              .map((char, i) =>
                char === " " || i / text.length < decode.progress
                  ? char
                  : "01[]+"[(i + Math.floor(decode.progress * 12)) % 5],
              )
              .join("");
          },
          onComplete: () => {
            label.textContent = text;
            scrambles.delete(label);
          },
        }),
      );
    });
  };
  document.addEventListener("pointerover", hoverScramble);
  const visibility = () => {
    const rect = document.querySelector(".garden-scene-hero")?.getBoundingClientRect();
    if (document.hidden || !rect || rect.bottom <= 0 || rect.top >= innerHeight) float.pause();
    else float.play();
  };
  document.addEventListener("visibilitychange", visibility);
  return () => {
    alive = false;
    observer.disconnect();
    for (const [node, triggers] of cardTriggers) {
      triggers.forEach((trigger) => {
        trigger.kill();
      });
      const plane = node.querySelector<HTMLElement>(".card-arrival");
      plane?.style.removeProperty("transform");
      plane?.style.removeProperty("opacity");
    }
    cardTriggers.clear();
    document.removeEventListener("pointerover", hoverScramble);
    document.removeEventListener("visibilitychange", visibility);
    cleanup.forEach((fn) => {
      fn();
    });
    document.querySelectorAll<HTMLElement>(".scramble-label[data-text]").forEach((label) => {
      label.textContent = label.dataset.text ?? "";
    });
  };
}

/**
 * Split a short label into characters that bloom upward and tint toward pollen when the
 * pointer enters its trigger, then settle back on leave. Splitting lives here so the
 * interaction survives pause/resume; autoSplit keeps it correct across font swaps/resizes.
 */
function kineticLabel(
  api: Stack,
  el: HTMLElement,
  trigger: HTMLElement,
  lift: number,
  onEnter?: () => void,
) {
  const { gsap, SplitText } = api;
  let chars: HTMLElement[] = [];
  const split = SplitText.create(el, {
    type: "chars",
    charsClass: "bloom-char",
    aria: "none",
    autoSplit: true,
    onSplit: (self) => {
      chars = self.chars as HTMLElement[];
    },
  });
  const enter = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    withMotion(() => {
      if (!chars.length) return;
      const accent = getComputedStyle(el)
        .getPropertyValue("--accent-ink")
        .trim()
        .replace(/\s+/g, ",");
      const base = getComputedStyle(el).color;
      gsap.to(chars, {
        y: -lift,
        rotationZ: () => gsap.utils.random(-6, 6),
        color: accent ? `rgb(${accent})` : base,
        duration: 0.4,
        ease: "arenaSnap",
        stagger: 0.02,
        overwrite: "auto",
      });
      onEnter?.();
    });
  };
  const leave = () =>
    withMotion(() => {
      if (!chars.length) return;
      const base = getComputedStyle(el).color;
      gsap.to(chars, {
        y: 0,
        rotationZ: 0,
        color: base,
        duration: 0.35,
        ease: "arenaExpo",
        stagger: 0.012,
        overwrite: "auto",
        onComplete: () => {
          for (const char of chars) char.style.removeProperty("color");
        },
      });
    });
  trigger.addEventListener("pointerenter", enter);
  trigger.addEventListener("pointerleave", leave);
  return () => {
    trigger.removeEventListener("pointerenter", enter);
    trigger.removeEventListener("pointerleave", leave);
    gsap.killTweensOf(chars);
    for (const char of chars) char.style.removeProperty("color");
    restTransforms(chars);
    split.revert();
  };
}

/**
 * Signature hover/click flourishes for the brand, subtitle, presets, lineup count, footer
 * and closing garden. Every effect is mouse-guarded, withMotion-gated and GSAP-owned, so
 * pausing or reducing motion rests everything cleanly. No new animation loop is created.
 */
function flourishScene(api: Stack) {
  const { gsap } = api;
  const cleanups: (() => void)[] = [];

  // Brand: the wordmark blooms while the table glyph spins and sheds pollen.
  const brandLink = document.querySelector<HTMLElement>(".brand-link");
  const wordmark = document.querySelector<HTMLElement>(".brand-wordmark");
  const brandSymbol = document.querySelector<HTMLElement>(".brand-symbol");
  if (brandLink && wordmark) {
    cleanups.push(
      kineticLabel(api, wordmark, brandLink, 5, () => {
        if (!brandSymbol) return;
        gsap.to(brandSymbol, {
          rotation: "+=360",
          duration: 0.7,
          ease: "arenaExpo",
          overwrite: "auto",
        });
        const rect = brandSymbol.getBoundingClientRect();
        burstAt?.(rect.left + rect.width / 2, rect.top + rect.height / 2, 10);
      }),
    );
    cleanups.push(() => {
      gsap.killTweensOf(brandSymbol);
      restTransforms([brandSymbol]);
    });
  }

  // Roster title: a lighter character bloom.
  const rosterTitle = document.querySelector<HTMLElement>(".roster-title h2");
  if (rosterTitle) cleanups.push(kineticLabel(api, rosterTitle, rosterTitle, 4));

  const lede = document.querySelector<HTMLElement>(".workspace-lede > span:first-child");
  const signal = document.querySelector<HTMLElement>(".model-signal");
  let signalTimeline: gsap.core.Timeline | undefined;
  const rippleSignal = (from = 0) => {
    if (!signal) return;
    withMotion(() => {
      signalTimeline?.revert();
      const dots = [...signal.querySelectorAll<HTMLElement>("i")];
      if (!dots.length) return;
      const stagger = { amount: 0.26, from: Math.min(from, dots.length - 1) };
      signalTimeline = gsap
        .timeline()
        .to(dots, {
          y: -7,
          rotation: 45,
          scale: 1.45,
          opacity: 1,
          duration: 0.18,
          stagger,
          ease: "power2.out",
        })
        .to(
          dots,
          {
            y: 0,
            rotation: 0,
            scale: 1,
            opacity: 0.65,
            duration: 0.48,
            stagger,
            ease: "arenaSnap",
            clearProps: "transform,opacity",
          },
          0.18,
        );
    });
  };
  if (signal) {
    const rippleAtPointer = (event: PointerEvent) => {
      if (event.type === "pointerenter" && event.pointerType !== "mouse") return;
      if (event.type === "pointerdown" && event.pointerType === "mouse") return;
      const rect = signal.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      rippleSignal(Math.round(fraction * (signal.childElementCount - 1)));
    };
    const observer = new MutationObserver(() => rippleSignal());
    observer.observe(signal, { childList: true });
    signal.addEventListener("pointerenter", rippleAtPointer);
    signal.addEventListener("pointerdown", rippleAtPointer);
    cleanups.push(() => {
      observer.disconnect();
      signal.removeEventListener("pointerenter", rippleAtPointer);
      signal.removeEventListener("pointerdown", rippleAtPointer);
      signalTimeline?.revert();
    });
  }

  const roster = document.querySelector<HTMLElement>(".model-roster");
  if (roster) {
    let selectionTimeline: gsap.core.Timeline | undefined;
    const observer = new MutationObserver((records) => {
      const changed = [...new Set(records.map((record) => record.target))].filter(
        (node): node is HTMLElement => node instanceof HTMLElement && node.matches(".model-toggle"),
      );
      if (!changed.length) return;
      withMotion(() => {
        selectionTimeline?.revert();
        const checks = changed.flatMap((node) => [...node.querySelectorAll(".selection-check")]);
        const logos = changed.flatMap((node) => [...node.querySelectorAll(".model-logo")]);
        const stagger = { amount: changed.length > 1 ? 0.22 : 0 };
        selectionTimeline = gsap
          .timeline()
          .fromTo(
            checks,
            { scale: 0.35, rotation: -90 },
            {
              scale: 1,
              rotation: 0,
              duration: 0.5,
              stagger,
              ease: "arenaSnap",
              clearProps: "transform",
            },
            0,
          )
          .fromTo(
            logos,
            { y: -5, rotation: -12 },
            {
              y: 0,
              rotation: 0,
              duration: 0.5,
              stagger,
              ease: "arenaSnap",
              clearProps: "transform",
            },
            0.06,
          );
      });
    });
    observer.observe(roster, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-pressed"],
    });
    cleanups.push(() => {
      observer.disconnect();
      selectionTimeline?.revert();
    });
  }

  if (lede) {
    let chars: HTMLElement[] = [];
    let centers: { x: number; y: number }[] = [];
    let dirty = true;
    const lastBucket = new Map<HTMLElement, number>();
    const measure = () => {
      chars = [...lede.querySelectorAll<HTMLElement>(".kinetic-char")];
      centers = chars.map((char) => {
        const rect = char.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      dirty = false;
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      dirty = true;
      rippleSignal();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      withMotion(() => {
        if (dirty) measure();
        if (!chars.length) return;
        const accent = getComputedStyle(lede)
          .getPropertyValue("--accent-ink")
          .trim()
          .replace(/\s+/g, ",");
        const tint = accent ? `rgb(${accent})` : "rgb(245,158,11)";
        const radius = 90;
        chars.forEach((char, index) => {
          const center = centers[index];
          if (!center) return;
          const proximity = Math.max(
            0,
            1 - Math.hypot(center.x - event.clientX, center.y - event.clientY) / radius,
          );
          const bucket = Math.round(proximity * 50);
          if (lastBucket.get(char) === bucket) return;
          lastBucket.set(char, bucket);
          char.style.color =
            proximity > 0.02
              ? `color-mix(in srgb, ${tint} ${Math.round(proximity * 90)}%, rgb(var(--quiet)))`
              : "";
        });
      });
    };
    const leave = () => {
      lastBucket.clear();
      for (const char of chars) char.style.removeProperty("color");
    };
    const invalidate = () => {
      dirty = true;
    };
    lede.addEventListener("pointerenter", enter);
    lede.addEventListener("pointermove", move);
    lede.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate);
    cleanups.push(() => {
      lede.removeEventListener("pointerenter", enter);
      lede.removeEventListener("pointermove", move);
      lede.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
      for (const char of chars) char.style.removeProperty("color");
    });
  }

  // Presets: the label gives a crisp bounce on hover (independent of the button press).
  for (const button of document.querySelectorAll<HTMLElement>(".preset-button")) {
    const label = button.querySelector<HTMLElement>(".preset-label");
    if (!label) continue;
    const bounce = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      withMotion(() => {
        gsap.fromTo(
          label,
          { scale: 1 },
          {
            scale: 1.14,
            duration: 0.22,
            ease: "arenaSnap",
            yoyo: true,
            repeat: 1,
            overwrite: "auto",
          },
        );
      });
    };
    button.addEventListener("pointerenter", bounce);
    cleanups.push(() => {
      button.removeEventListener("pointerenter", bounce);
      gsap.killTweensOf(label);
      restTransforms([label]);
    });
  }

  // Lineup count: an odometer roll whenever the selected number changes.
  const count = document.querySelector<HTMLElement>(".selection-count");
  if (count) {
    const roll = () => {
      const value = count.querySelector<HTMLElement>(".count-value");
      if (!value) return;
      withMotion(() => {
        gsap.from(value, {
          yPercent: 115,
          opacity: 0,
          duration: 0.45,
          ease: "arenaSnap",
          overwrite: "auto",
        });
      });
    };
    const observer = new MutationObserver(roll);
    observer.observe(count, { childList: true, subtree: true });
    cleanups.push(() => {
      observer.disconnect();
      const value = count.querySelector<HTMLElement>(".count-value");
      if (value) {
        gsap.killTweensOf(value);
        restTransforms([value]);
        value.style.removeProperty("opacity");
      }
    });
  }

  // Footer: "Multiplied." fans out a trail of echoing ghosts on hover, harder on click.
  const captionSpan = document.querySelector<HTMLElement>(".garden-caption span");
  if (captionSpan) {
    const text = captionSpan.textContent ?? "";
    const face = document.createElement("span");
    face.className = "multiply-face";
    face.textContent = text;
    captionSpan.textContent = "";
    captionSpan.appendChild(face);
    const ghosts: HTMLElement[] = [];
    for (let i = 0; i < 4; i++) {
      const ghost = document.createElement("span");
      ghost.className = "multiply-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.textContent = text;
      captionSpan.appendChild(ghost);
      ghosts.push(ghost);
    }
    const fan = (strength: number) =>
      withMotion(() => {
        gsap.to(ghosts, {
          x: (i) => (i + 1) * 16 * strength,
          y: (i) => (i + 1) * -10 * strength,
          rotation: (i) => (i + 1) * -3 * strength,
          opacity: (i) => Math.max(0, 0.5 - i * 0.1) * strength,
          duration: 0.5,
          ease: "arenaExpo",
          stagger: 0.04,
          overwrite: "auto",
        });
      });
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      fan(1);
    };
    const leave = () =>
      withMotion(() => {
        gsap.to(ghosts, {
          x: 0,
          y: 0,
          rotation: 0,
          opacity: 0,
          duration: 0.4,
          ease: "arenaExpo",
          stagger: 0.02,
          overwrite: "auto",
        });
      });
    const click = () => {
      fan(1.6);
      const rect = captionSpan.getBoundingClientRect();
      burstAt?.(rect.left + rect.width / 2, rect.top + rect.height / 2, 14);
    };
    captionSpan.addEventListener("pointerenter", enter);
    captionSpan.addEventListener("pointerleave", leave);
    captionSpan.addEventListener("click", click);
    cleanups.push(() => {
      captionSpan.removeEventListener("pointerenter", enter);
      captionSpan.removeEventListener("pointerleave", leave);
      captionSpan.removeEventListener("click", click);
      gsap.killTweensOf(ghosts);
      for (const ghost of ghosts) ghost.remove();
      captionSpan.textContent = text;
    });
  }

  // Badge: a jelly wobble on hover.
  const badge = document.querySelector<HTMLElement>(".badge-link");
  if (badge) {
    const jelly = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      withMotion(() => {
        gsap
          .timeline({ overwrite: "auto" })
          .to(badge, {
            scaleX: 1.12,
            scaleY: 0.86,
            rotation: -2,
            duration: 0.12,
            ease: "power2.out",
          })
          .to(badge, {
            scaleX: 0.94,
            scaleY: 1.08,
            rotation: 2,
            duration: 0.14,
            ease: "power2.inOut",
          })
          .to(badge, {
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            duration: 0.6,
            ease: "elastic.out(1,0.45)",
          });
      });
    };
    badge.addEventListener("pointerenter", jelly);
    cleanups.push(() => {
      badge.removeEventListener("pointerenter", jelly);
      gsap.killTweensOf(badge);
      restTransforms([badge]);
    });
  }

  // Closing garden: a bloom lens follows the pointer while the plane tilts in 3D.
  const closing = document.querySelector<HTMLElement>(".garden-scene-closing");
  if (closing) {
    const plane = closing.querySelector<HTMLElement>(".garden-pointer");
    const lens = document.createElement("div");
    lens.className = "garden-lens";
    lens.setAttribute("aria-hidden", "true");
    closing.appendChild(lens);
    const lensPos = { x: 0, y: 0 };
    const applyLens = () => {
      lens.style.setProperty("--lens-x", `${lensPos.x}px`);
      lens.style.setProperty("--lens-y", `${lensPos.y}px`);
    };
    const lx = gsap.quickTo(lensPos, "x", { duration: 0.4, ease: "power3", onUpdate: applyLens });
    const ly = gsap.quickTo(lensPos, "y", { duration: 0.4, ease: "power3", onUpdate: applyLens });
    const rx = plane
      ? gsap.quickTo(plane, "rotationX", { duration: 0.6, ease: "power3" })
      : undefined;
    const ry = plane
      ? gsap.quickTo(plane, "rotationY", { duration: 0.6, ease: "power3" })
      : undefined;
    let rect: DOMRect | null = null;
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      rect = closing.getBoundingClientRect();
      withMotion(() => {
        gsap.to(lens, { opacity: 1, duration: 0.4, ease: "arenaExpo", overwrite: "auto" });
        burstAt?.(event.clientX, event.clientY, 8);
      });
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      withMotion(() => {
        if (!rect) rect = closing.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        lx(x);
        ly(y);
        rx?.((0.5 - y / rect.height) * 12);
        ry?.((x / rect.width - 0.5) * 12);
      });
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      withMotion(() => {
        gsap.to(lens, { opacity: 0, duration: 0.4, ease: "arenaExpo", overwrite: "auto" });
        rx?.(0);
        ry?.(0);
      });
    };
    const invalidate = () => {
      rect = null;
    };
    let touchStart: { id: number; x: number; y: number } | undefined;
    let tapBloom: gsap.core.Timeline | undefined;
    const touchDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const touchCancel = () => {
      touchStart = undefined;
    };
    const touchUp = (event: PointerEvent) => {
      const start = touchStart;
      touchStart = undefined;
      if (
        !start ||
        start.id !== event.pointerId ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
      )
        return;
      withMotion(() => {
        const bounds = closing.getBoundingClientRect();
        tapBloom?.revert();
        lx.tween.pause();
        ly.tween.pause();
        lensPos.x = Math.round(event.clientX - bounds.left);
        lensPos.y = Math.round(event.clientY - bounds.top);
        applyLens();
        tapBloom = gsap
          .timeline()
          .fromTo(
            lens,
            { opacity: 0, scale: 0.65 },
            {
              opacity: 1,
              scale: 1,
              duration: 0.3,
              ease: "arenaSnap",
            },
          )
          .to(lens, {
            opacity: 0,
            scale: 1.15,
            duration: 0.45,
            delay: 0.5,
            ease: "arenaExpo",
            clearProps: "transform",
          });
        burstAt?.(event.clientX, event.clientY, 8);
      });
    };
    closing.addEventListener("pointerenter", enter);
    closing.addEventListener("pointermove", move);
    closing.addEventListener("pointerleave", leave);
    closing.addEventListener("pointerdown", touchDown, { passive: true });
    closing.addEventListener("pointerup", touchUp, { passive: true });
    closing.addEventListener("pointercancel", touchCancel, { passive: true });
    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate);
    cleanups.push(() => {
      closing.removeEventListener("pointerenter", enter);
      closing.removeEventListener("pointermove", move);
      closing.removeEventListener("pointerleave", leave);
      closing.removeEventListener("pointerdown", touchDown);
      closing.removeEventListener("pointerup", touchUp);
      closing.removeEventListener("pointercancel", touchCancel);
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
      gsap.killTweensOf(lens);
      tapBloom?.revert();
      lens.remove();
      restTransforms([plane]);
    });
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}

/** The only application-owned ticker callback. Passive timers share it even when effects pause. */
export function startMotionClock() {
  clockInstances++;
  const api = motionStack();
  const bee = createBee((x, y, count, tint) => burstAt?.(x, y, count, tint));
  liveBee = bee;
  bee.setEnabled(beeEnabled);
  const stopPet = () => {
    bee.dispose();
    if (liveBee === bee) liveBee = null;
  };
  const tick = (_time: number, delta: number) => {
    const now = Date.now();
    if (!document.hidden) bee.update(Math.min(delta / 1000, 0.04), now);
    for (const listener of clockListeners) listener(now, delta);
  };
  if (api) {
    api.gsap.ticker.lagSmoothing(0);
    api.gsap.ticker.add(tick);
    document.documentElement.dataset.motionEngine = "gsap";
    return () => {
      clockInstances--;
      stopPet();
      api.gsap.ticker.remove(tick);
      delete document.documentElement.dataset.motionEngine;
    };
  }
  // A coarse telemetry fallback, never a decorative animation loop, when CDN scripts fail.
  document.documentElement.dataset.motionEngine = "native";
  const timer = window.setInterval(() => tick(0, 100), 100);
  return () => {
    clockInstances--;
    stopPet();
    clearInterval(timer);
    delete document.documentElement.dataset.motionEngine;
  };
}

export function startChoreography(paused: boolean) {
  const api = motionStack();
  if (!api || paused) return () => {};
  const media = api.gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", (ctx) => {
    // Register inside the motion gate: ScrollTrigger's init schedules an internal
    // refresh tween that would otherwise linger in the timeline under reduced motion.
    api.gsap.registerPlugin(api.Flip, api.ScrollTrigger, api.SplitText, api.CustomEase);
    api.CustomEase.create("arenaExpo", "M0,0 C0.16,1 0.3,1 1,1");
    api.CustomEase.create("arenaSnap", "M0,0 C0.34,1.56 0.64,1 1,1");
    // Material 3 emphasized-decelerate (androidx MotionTokens: 0.05, 0.7, 0.1, 1).
    api.CustomEase.create("themeLift", "M0,0 C0.16,0.5 0.3,1 1,1");
    context = ctx;
    stack = api;
    lenis = new api.Lenis({
      lerp: 0.1,
      wheelMultiplier: 0.95,
      smoothWheel: true,
      // Keep iOS/Android momentum scroll native: JS-smoothed touch fights the platform
      // and reads as lag on phones. Only wheel input is smoothed.
      syncTouch: false,
      autoRaf: false,
      anchors: true,
      prevent: (node) =>
        node.matches(
          "textarea, select, dialog, .roster-grid, .history-popover, .answer-copy, polli-connect, [data-lenis-prevent]",
        ),
    });
    lenis.on("scroll", api.ScrollTrigger.update);
    // This subscription uses the same clock as canvas and telemetry.
    const resizeLayout = () => {
      flipAnimation?.progress(1).kill();
      api.Flip.killFlipsOf(document.querySelectorAll(layoutSelector), true);
      api.gsap.set(document.querySelectorAll(layoutSelector), {
        clearProps: "transform,width,height,top,left,position",
      });
      for (const node of document.querySelectorAll(".model-column.is-flipping"))
        node.classList.remove("is-flipping");
      clearExits();
      api.ScrollTrigger.refresh();
    };
    window.addEventListener("resize", resizeLayout);
    const scrollClock = subscribeClock(() => lenis?.raf(api.gsap.ticker.time * 1000));
    const stopCanvas = canvasScene(api);
    const stopTactile = tactileScene(api);
    const stopFlourish = flourishScene(api);
    const stopChoreography = choreography(api);
    return () => {
      settleTheme?.();
      captured = undefined;
      departed = [];
      clearExits();
      for (const node of document.querySelectorAll(".model-column.is-flipping"))
        node.classList.remove("is-flipping");
      window.removeEventListener("resize", resizeLayout);
      scrollClock();
      stopCanvas();
      stopTactile();
      stopFlourish();
      stopChoreography();
      lenis?.destroy();
      lenis = undefined;
      context = undefined;
      stack = undefined;
    };
  });
  media.add("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)", () =>
    pointerScene(api),
  );
  return () => {
    media.revert();
  };
}
