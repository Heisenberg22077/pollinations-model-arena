import {
  BEE_LINES,
  type BeeMood,
  type BeeSpeech,
  type BeeTrigger,
  beeFamily,
  beeReadTime,
  createBeeDialogue,
} from "./bee-dialogue";

/**
 * A steering-behaviour bee for the pollen garden.
 *
 * Behaviour extracted from leoparpeix.com (YUKA pursuit + Lissajous wander, speed-banked
 * orientation, speed-reactive wing flap, gravity fruit falls the bee orbits, and a sassy
 * personality). Re-implemented in 2D pixel space so it shares the arena's single motion
 * clock and celebration canvas instead of adding a renderer or an animation loop.
 */

export interface BeeColors {
  body: string;
  stripe: string;
  wing: string;
  head: string;
  accent: string;
  bubbleBg: string;
  bubbleInk: string;
  bubbleLine: string;
}

export interface BeeHandle {
  update(dt: number, time: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  pointer(x: number, y: number, speed: number): void;
  pointerLeave(): void;
  click(x: number, y: number, feed?: boolean): boolean;
  action(action: BeeAction): void;
  flower(rect: BeeRect | null): void;
  scroll(): void;
  comment(event: BeeEvent, name?: string): void;
  hover(zone: BeeZone | null, name?: string, tag?: BeeTag): void;
  setEnabled(on: boolean): void;
  setColors(colors: BeeColors): void;
  resize(width: number, height: number): void;
  dispose(): void;
  readonly active: boolean;
  readonly diagnostics: {
    boops: number;
    meals: number;
    fruits: number;
    story: number;
    queued: number;
    recent: number;
    mood: BeeMood;
    pointerActive: boolean;
    flower: boolean;
    hoverKey: string;
    restUntil: number;
    perched: boolean;
    speed: number;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
export type BeeAction = "boop" | "feed" | "story" | "close";
export type BeeEvent =
  | "run"
  | "response"
  | "compare"
  | "winner"
  | "error"
  | "cheap"
  | "cancel"
  | "complete"
  | "day"
  | "night"
  | "select"
  | "deselect"
  | "preset-core"
  | "preset-free"
  | "preset-all"
  | "surprise"
  | "starter"
  | "copy"
  | "export";
export type BeeZone = "model" | "header" | "hero" | "roster" | "results" | "footer";
export type BeeTag = "fastest" | "cheapest";

export interface BeeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Fruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  kind: number;
  groundY: number;
  landed: boolean;
  squash: number;
  age: number;
  life: number;
  scale: number;
  collected: boolean;
  eaten: boolean;
  explicit: boolean;
  approached: boolean;
}

// Garden-themed collectibles: orange, strawberry, blueberry, flower, honey pot, apple.
const FRUIT_TINTS = ["#f59e0b", "#ef4444", "#8b5cf6", "#f472b6", "#fbbf24", "#84cc16"] as const;

const DEFAULT_COLORS: BeeColors = {
  body: "#f8c63d",
  stripe: "#4a3620",
  wing: "#bcd9f5",
  head: "#2a2417",
  accent: "#f59e0b",
  bubbleBg: "rgba(28,27,24,0.92)",
  bubbleInk: "#f4efe6",
  bubbleLine: "rgba(245,158,11,0.6)",
};

export function createBee(
  onBurst: (x: number, y: number, count: number, tint?: string) => void,
  random: () => number = Math.random,
): BeeHandle {
  let width = window.innerWidth;
  let height = window.innerHeight;
  let colors = DEFAULT_COLORS;
  let enabled = true;
  let opacity = 0;
  let disposed = false;
  const touchPrimary = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const dialogue = createBeeDialogue(touchPrimary, random);
  const home = document.querySelector<HTMLElement>(".bee-home");
  const feedback = home?.querySelector(".bee-feedback");
  let blocked = false;
  let reduced = document.documentElement.dataset.motion === "off";
  let boops = 0,
    meals = 0;
  let mood: BeeMood = "curious";
  let reactionUntil = 0;
  let restUntil = 0;
  let busy = false,
    waitingAt = 0;
  let arrived = false;
  const garden = { x: width * 0.6, y: height * 0.4 };
  const staticBee = { ...garden };
  const observer = home
    ? new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) dialogue.clear("hover");
      })
    : null;
  if (home) observer?.observe(home);
  const measureHome = () => {
    const rect = document.querySelector(".garden-scene-hero")?.getBoundingClientRect();
    if (rect) {
      garden.x = rect.left + rect.width * 0.6;
      garden.y = rect.top + rect.height * 0.65;
      // The reduced-motion pet is the bee already painted into the garden art.
      staticBee.x = rect.left + rect.width * 0.65;
      staticBee.y = rect.top + rect.height * 0.32;
    }
  };
  measureHome();
  const announce = (text: string) => {
    if (feedback) feedback.textContent = text;
  };

  const pos = { x: width * 0.5, y: -50 };
  const vel = { x: 0, y: 0 };
  const anchor = { x: width * 0.5, y: height * 0.4 };
  const pointerPos = { x: width * 0.5, y: height * 0.4 };
  let pointerActive = false;
  let pointerSpeed = 0;
  let heading = 0;
  let bank = 0;
  let facing = 1;
  let flapPhase = 0;
  let boost = 0;
  let mode: "cruise" | "flower" | "fruit" = "cruise";
  let perched = false;
  let flowerRect: BeeRect | null = null;
  let flowerDwell = 0;
  let orbitPhase = 0;
  let storyIndex = -1;
  let storyCycle = 0;
  let nextTeaser = 6;
  let clock = 0;
  let previousUpdateTime: number | undefined;
  let scrollQuietAt = 0;
  let hoverKey = "";

  const fruits: Fruit[] = [];
  const sparkles: { x: number; y: number; age: number; life: number; size: number }[] = [];
  let sparkleTimer = 0;

  // ---- personality bubble -------------------------------------------------
  const bubble = document.createElement("div");
  bubble.className = "bee-bubble";
  bubble.setAttribute("aria-hidden", "true");
  const bubbleText = document.createElement("span");
  bubbleText.className = "bee-bubble-text";
  bubble.appendChild(bubbleText);
  document.body.appendChild(bubble);
  let bubbleVisible = false;
  let bubbleHideAt = 0;
  let bubbleW = 0,
    bubbleH = 0;
  let bubbleX = -999,
    bubbleY = -999;
  let bubbleShown = false;
  let bubbleGeometryDirty = false;
  let speechTarget: { x: number; y: number } | null = null;
  let bubbleBounds = { left: 8, top: 8, right: width - 8, bottom: height - 8 };
  let bubbleObstacles: DOMRect[] = [];

  const applyBubbleColors = () => {
    bubble.style.setProperty("--bee-bubble-bg", colors.bubbleBg);
    bubble.style.setProperty("--bee-bubble-ink", colors.bubbleInk);
    bubble.style.setProperty("--bee-bubble-line", colors.bubbleLine);
  };
  applyBubbleColors();

  const hush = () => {
    bubble.classList.remove("is-visible");
    bubbleShown = false;
    bubbleVisible = false;
    speechTarget = null;
  };
  const present = (speech: BeeSpeech) => {
    bubbleText.textContent = speech.text;
    bubble.dataset.lineId = speech.line.id;
    bubble.dataset.trigger = speech.line.trigger;
    bubble.classList.add("is-visible");
    bubbleShown = true;
    bubbleVisible = true;
    measureBubble();
    followBubble();
    bubbleHideAt = speech.until;
    mood = speech.line.mood;
    restUntil = clock + beeReadTime(speech.text) + 1.4;
    if (
      speech.explicit &&
      ["boop", "boop-repeat", "discover", "eat", "feed-repeat", "story"].includes(
        speech.line.trigger,
      )
    )
      announce(speech.text);
  };
  const storyControls = () => {
    const button = home?.querySelector<HTMLButtonElement>("[data-pet-story]");
    if (button) {
      button.textContent = storyIndex < 0 ? "Joke" : storyIndex === 2 ? "Finish" : "Next";
      button.setAttribute(
        "aria-label",
        storyIndex < 0
          ? "Tell a tiny bee story"
          : storyIndex === 2
            ? "Finish bee story"
            : "Next bee story line",
      );
    }
    const close = home?.querySelector<HTMLButtonElement>("[data-pet-close]");
    if (close) {
      if (storyIndex < 0 && document.activeElement === close)
        button?.focus({ preventScroll: true });
      close.hidden = storyIndex < 0;
    }
  };
  const endStory = () => {
    if (storyIndex < 0) return;
    storyCycle = (storyCycle + 1) % 4;
    storyIndex = -1;
    storyControls();
    hush();
    dialogue.clear();
    nextTeaser = (touchPrimary ? 13 : 7) + random() * (touchPrimary ? 9 : 6);
  };
  const react = (next: BeeMood) => {
    mood = next;
    reactionUntil = clock + 0.65;
  };
  // Cache dimensions and protected UI once per line; following needs no layout reads.
  const measureBubble = () => {
    bubbleGeometryDirty = false;
    const viewport = window.visualViewport;
    const left = (viewport?.offsetLeft ?? 0) + 8;
    const top = (viewport?.offsetTop ?? 0) + 8;
    const right = left + (viewport?.width ?? width) - 16;
    const bottom = top + (viewport?.height ?? height) - 16;
    bubbleBounds = { left, top, right, bottom };
    bubble.style.maxWidth = `${Math.min(240, right - left)}px`;
    bubbleW = bubble.offsetWidth;
    bubbleH = bubble.offsetHeight;
    bubbleObstacles = [];
    const cardRects = new Map<Element, DOMRect>();
    const inViewport = (r: DOMRect) =>
      r.right > left && r.left < right && r.bottom > top && r.top < bottom;
    for (const node of document.querySelectorAll(
      ".question-band, .answer-copy, .model-heading, .answer-metrics, .answer-image, .results-toolbar, .table-actions, button, a, summary, select, dialog[open]",
    )) {
      const card = node.closest(".model-card");
      if (card) {
        let rect = cardRects.get(card);
        if (!rect) {
          rect = card.getBoundingClientRect();
          cardRects.set(card, rect);
        }
        // Measuring skipped descendants defeats content-visibility: auto.
        // The containing card's box is enough to reject offscreen obstacles.
        if (!inViewport(rect)) continue;
      }
      const rect = node.getBoundingClientRect();
      if (rect.width && rect.height && inViewport(rect)) bubbleObstacles.push(rect);
    }
    speechTarget = null;
    if (!reduced) {
      // Find the nearest readable pose once per line/layout change. The bubble
      // stays attached to the actual bee while it settles there; no detached lane.
      const xs = [
        pos.x,
        pos.x - bubbleW - 40,
        pos.x + bubbleW + 40,
        width / 2,
        left + 24,
        right - 24,
      ];
      const ys = [pos.y, pos.y + 80, pos.y + 160, pos.y + 240, height * 0.4, garden.y];
      let best = Infinity;
      for (const x of xs) {
        for (const y of ys) {
          const candidate = {
            x: clamp(x, left + 24, right - 24),
            y: clamp(y, top + bubbleH + 24, bottom - 24),
          };
          if (!bubblePosition(candidate.x, candidate.y)) continue;
          const distance = Math.hypot(candidate.x - pos.x, candidate.y - pos.y);
          if (distance < best) {
            best = distance;
            speechTarget = candidate;
          }
        }
      }
    }
  };
  const bubblePosition = (beeX: number, beeY: number) => {
    const { left, top, right, bottom } = bubbleBounds;
    // A little more headroom keeps multi-line phone replies above the Bzz
    // disclosure without covering it or detaching speech from the character.
    for (const gap of [24, 56, 88]) {
      const y = clamp(beeY - bubbleH - gap, top, bottom - bubbleH);
      for (const candidate of [beeX + 20, beeX - bubbleW - 20, beeX - bubbleW / 2]) {
        const x = clamp(candidate, left, right - bubbleW);
        if (
          bubbleObstacles.every(
            (r) =>
              x + bubbleW + 6 <= r.left ||
              x - 6 >= r.right ||
              y + bubbleH + 6 <= r.top ||
              y - 6 >= r.bottom,
          )
        )
          return { x, y };
      }
    }
    return null;
  };
  const followBubble = () => {
    if (!bubbleVisible || bubbleGeometryDirty || clock < scrollQuietAt) return;
    const position = bubblePosition(reduced ? staticBee.x : pos.x, reduced ? staticBee.y : pos.y);
    const shown = Boolean(position);
    if (shown !== bubbleShown) {
      bubble.classList.toggle("is-visible", shown);
      bubbleShown = shown;
    }
    if (!position) return;
    const { x, y } = position;
    if (Math.abs(x - bubbleX) > 0.5 || Math.abs(y - bubbleY) > 0.5) {
      bubbleX = x;
      bubbleY = y;
      bubble.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  };
  const ask = (
    trigger: BeeTrigger,
    explicit = false,
    name?: string,
    count?: number,
    key?: string,
  ) => {
    dialogue.request(
      trigger,
      { name, count, family: name ? beeFamily(name) : undefined },
      clock,
      explicit,
      key,
    );
  };
  const suspend = () => {
    blocked =
      Boolean(
        document.querySelector(
          "dialog[open], #mobile-navigation:popover-open, #recent-questions[open]",
        ),
      ) ||
      Boolean(
        document.activeElement?.matches(
          "input, textarea, select, summary:not(.bee-home > summary)",
        ),
      );
    if (blocked) {
      endStory();
      dialogue.clear();
      hush();
    }
  };
  const motionChange = () => {
    reduced = document.documentElement.dataset.motion === "off";
    fruits.length = 0;
    sparkles.length = 0;
    endStory();
    dialogue.clear();
    hush();
  };
  document.addEventListener("focusin", suspend);
  document.addEventListener("focusout", suspend);
  document.addEventListener("toggle", suspend, true);
  const beforeToggle = (event: Event) => {
    // Opening top-layer UI hides comedy before its first paint.
    if ((event as ToggleEvent).newState === "open") {
      endStory();
      dialogue.clear();
      hush();
      blocked = true;
    }
  };
  document.addEventListener("beforetoggle", beforeToggle, true);
  const closeWithEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && storyIndex >= 0) {
      endStory();
      announce("Story closed.");
    }
  };
  document.addEventListener("keydown", closeWithEscape);
  window.addEventListener("model-table:motion-change", motionChange);
  const hideOnViewportChange = () => {
    // Layout can change after an app action (roster FLIP, prompt height, scroll).
    // Hide during that movement, but retain the live line until its real expiry.
    bubble.classList.remove("is-visible");
    bubbleShown = false;
    bubbleGeometryDirty = true;
    dialogue.clear("hover");
    scrollQuietAt = clock + 0.3;
  };
  window.addEventListener("scroll", hideOnViewportChange, { passive: true });
  window.visualViewport?.addEventListener("resize", hideOnViewportChange);
  window.visualViewport?.addEventListener("scroll", hideOnViewportChange);

  // ---- steering -----------------------------------------------------------
  const target = { x: pos.x, y: pos.y };
  const computeTarget = (time: number) => {
    const n = time * 0.001;
    if (mode === "fruit" && fruits.length) {
      const fruit = fruits[fruits.length - 1];
      const dx = pos.x - fruit.x;
      const dy = pos.y - fruit.y;
      if (Math.hypot(dx, dy) < 90) {
        target.x = fruit.x + Math.cos(orbitPhase) * 34;
        target.y = fruit.y + Math.sin(orbitPhase) * 30 - 6;
      } else {
        target.x = fruit.x;
        target.y = fruit.y - 10;
      }
      return;
    }
    if (bubbleVisible && speechTarget) {
      target.x = speechTarget.x;
      target.y = speechTarget.y;
      return;
    }
    if (mode === "flower" && flowerRect) {
      target.x = flowerRect.left + flowerRect.width / 2;
      target.y = flowerRect.top - 26;
      return;
    }
    if (clock < restUntil) {
      target.x = pos.x;
      target.y = pos.y;
      return;
    }
    if (!pointerActive && clock > 14) {
      target.x = clamp(garden.x, 24, width - 24);
      target.y = clamp(garden.y, 24, height - 24) + Math.sin(clock * 1.2) * 2;
      return;
    }
    // Cruise: a cursor anchor that lags, plus a Lissajous wander so the bee drifts alive.
    const wx = Math.cos(n) * Math.sin(n * 0.2) * 78;
    const wy = Math.sin(n * 0.8) * 48;
    const baseX = pointerActive ? anchor.x : width * 0.5 + Math.cos(n * 0.3) * width * 0.22;
    const baseY = pointerActive ? anchor.y : height * 0.42 + Math.sin(n * 0.4) * height * 0.16;
    target.x = clamp(baseX + wx + 26, 24, width - 24);
    target.y = clamp(baseY + wy - 64, 24, height - 24);
  };

  const steer = (dt: number, maxSpeed: number) => {
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const dist = Math.hypot(dx, dy) || 1;
    const arrive = 150;
    const desiredSpeed = maxSpeed * Math.min(1, dist / arrive);
    const dvx = (dx / dist) * desiredSpeed;
    const dvy = (dy / dist) * desiredSpeed;
    let sx = dvx - vel.x;
    let sy = dvy - vel.y;
    const sLen = Math.hypot(sx, sy);
    const maxForce = 3400;
    if (sLen > maxForce) {
      sx = (sx / sLen) * maxForce;
      sy = (sy / sLen) * maxForce;
    }
    const mass = 0.22;
    vel.x += (sx / mass) * dt;
    vel.y += (sy / mass) * dt;
    const vLen = Math.hypot(vel.x, vel.y);
    if (vLen > maxSpeed) {
      vel.x = (vel.x / vLen) * maxSpeed;
      vel.y = (vel.y / vLen) * maxSpeed;
    }
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
  };

  // ---- fruit --------------------------------------------------------------
  const spawnFruit = (x: number, y: number, explicit = false) => {
    if (fruits.length >= 3) fruits.shift();
    const kind = Math.floor(random() * FRUIT_TINTS.length);
    fruits.push({
      x: clamp(x, 20, width - 20),
      y: clamp(y - 8, 20, height - 60),
      vx: (random() - 0.5) * 60,
      vy: -40,
      rot: (random() - 0.5) * 0.6,
      vr: (random() - 0.5) * 3,
      kind,
      groundY: clamp(y + 130 + random() * 60, 60, height - 22),
      landed: false,
      squash: 0,
      age: 0,
      life: 1 + random() * 2,
      scale: 0.2,
      collected: false,
      eaten: false,
      explicit,
      approached: false,
    });
    mode = "fruit";
    perched = false;
  };

  const updateFruits = (dt: number, elapsed: number) => {
    for (let i = fruits.length - 1; i >= 0; i--) {
      const f = fruits[i];
      f.age += elapsed;
      f.scale = Math.min(1, f.scale + dt * 5);
      if (f.age >= f.life) {
        fruits.splice(i, 1);
        continue;
      }
      f.vy += 1500 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      f.squash = Math.max(0, f.squash - dt * 4);
      if (f.y >= f.groundY) {
        f.y = f.groundY;
        if (!f.landed) {
          f.landed = true;
          f.squash = 1;
          onBurst(f.x, f.y, 6, FRUIT_TINTS[f.kind]);
        }
        f.vy *= -0.3;
        f.vx *= 0.6;
        f.vr *= 0.5;
        if (Math.abs(f.vy) < 50) f.vy = 0;
      }
      if (!f.approached && Math.hypot(pos.x - f.x, pos.y - f.y) < 90) {
        f.approached = true;
        ask("approach");
      }
      // The bee eats a fruit it reaches; otherwise it ripens away after 1-3 seconds.
      if (!f.eaten && !f.collected && f.age > 0.2 && Math.hypot(pos.x - f.x, pos.y - f.y) < 36) {
        f.eaten = true;
        meals = Math.min(9, meals + 1);
        dialogue.clear("discover");
        dialogue.clear("approach");
        react("content");
        ask(meals > 1 ? "feed-repeat" : "eat", f.explicit, undefined, meals);
      }
      if (f.eaten || f.age > f.life) {
        f.scale = Math.max(0, f.scale - dt * (f.eaten ? 6 : 2.6));
        if (f.scale <= 0.02 && !f.collected) {
          f.collected = true;
          onBurst(f.x, f.y, f.eaten ? 12 : 16, FRUIT_TINTS[f.kind]);
          fruits.splice(i, 1);
          if (!fruits.length && mode === "fruit") mode = "cruise";
        }
      }
    }
    if (!fruits.length && mode === "fruit") mode = "cruise";
  };

  // ---- pixel-art drawing --------------------------------------------------
  // Drawn on a logical pixel grid (1 unit = 1 chunky pixel) so the mascot matches the
  // Pollinations garden sprite: dark outline, base fill, shade, highlight. draw() scales
  // the context to screen pixels and flips it to face the direction of travel.
  const px = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const pxEllipse = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: string,
  ) => {
    const ax = Math.max(1, Math.round(rx));
    const ay = Math.max(1, Math.round(ry));
    ctx.fillStyle = color;
    for (let y = -ay; y <= ay; y++) {
      const hw = Math.round(ax * Math.sqrt(Math.max(0, 1 - (y * y) / (ay * ay))));
      if (hw > 0) ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1);
    }
  };

  const drawBee = (ctx: CanvasRenderingContext2D, flap: number) => {
    const outline = colors.head;
    const gold = colors.body;
    const stripe = colors.stripe;
    const wingEdge = "#8fb8e0";
    const cheek = "#f9a8d4";
    const cheekLight = "#fbcfe8";
    const shine = "#fff7e0";

    // Pale wings trailing up-left, kept separate from the dark outline; flap at the root.
    const wing = (ox: number, oy: number, rx: number, ry: number, angle: number) => {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(angle);
      pxEllipse(ctx, -rx + 1, 0, rx, ry, wingEdge);
      pxEllipse(ctx, -rx + 1, 0, rx - 1, ry - 1, colors.wing);
      ctx.restore();
    };
    ctx.save();
    ctx.globalAlpha *= 0.95;
    wing(-2, -6, 5, 3, -0.5 - flap * 0.6);
    wing(-4, -3, 4, 2, -0.15 - flap * 0.4);
    ctx.restore();

    // Rounded body, a touch slimmer than the garden sprite; outline then gold.
    pxEllipse(ctx, 0, 0, 8, 9, outline);
    pxEllipse(ctx, 0, 0, 7, 8, gold);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 8, 0, 0, Math.PI * 2);
    ctx.clip();
    px(ctx, -8, 2, 16, 3, stripe);
    px(ctx, -8, 6, 16, 2, stripe);
    px(ctx, -5, -6, 3, 2, "#ffdf7e");
    ctx.restore();

    // Side-angle face: a dominant eye plus a thinner far eye, both looking ahead.
    px(ctx, 2, -4, 2, 3, outline);
    px(ctx, 2, -4, 1, 1, shine);
    px(ctx, 5, -4, 1, 3, outline);
    px(ctx, 5, -4, 1, 1, shine);
    // One round blush dot on the cheek.
    px(ctx, 1, 0, 2, 2, cheek);
    px(ctx, 1, 0, 1, 1, cheekLight);
    // Tiny smile.
    px(ctx, 4, 1, 1, 1, outline);
    px(ctx, 5, 2, 1, 1, outline);
    px(ctx, 6, 1, 1, 1, outline);

    // Antennae with bulb tips.
    px(ctx, 2, -9, 1, 1, outline);
    px(ctx, 1, -10, 1, 1, outline);
    px(ctx, 0, -11, 2, 2, outline);
    px(ctx, 5, -9, 1, 1, outline);
    px(ctx, 6, -10, 1, 1, outline);
    px(ctx, 6, -11, 2, 2, outline);

    // Reaching arm and feet.
    px(ctx, 7, 0, 2, 1, outline);
    px(ctx, 9, -1, 1, 2, outline);
    px(ctx, -3, 8, 2, 2, outline);
    px(ctx, 2, 8, 2, 2, outline);
  };

  const drawFruit = (ctx: CanvasRenderingContext2D, f: Fruit) => {
    const outline = colors.head;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(f.x), Math.round(f.y));
    ctx.rotate(f.rot);
    const sq = f.squash;
    const u = 1.7 * f.scale;
    ctx.scale(u * (1 + sq * 0.3), u * (1 - sq * 0.3));
    if (f.kind === 0) {
      // orange
      pxEllipse(ctx, 0, 0, 6, 6, outline);
      pxEllipse(ctx, 0, 0, 5, 5, "#f59e0b");
      px(ctx, -3, -3, 2, 2, "#fcd34d");
      px(ctx, 0, -7, 1, 2, "#3f6212");
      px(ctx, 1, -7, 3, 2, "#65a30d");
    } else if (f.kind === 1) {
      // strawberry
      pxEllipse(ctx, 0, 1, 5, 5, outline);
      px(ctx, -2, 5, 4, 2, outline);
      pxEllipse(ctx, 0, 1, 4, 4, "#ef4444");
      px(ctx, -1, 5, 2, 1, "#ef4444");
      px(ctx, -2, 0, 1, 1, "#fde68a");
      px(ctx, 1, 1, 1, 1, "#fde68a");
      px(ctx, -1, 3, 1, 1, "#fde68a");
      px(ctx, 2, -1, 1, 1, "#fde68a");
      px(ctx, -3, -4, 6, 2, "#16a34a");
      px(ctx, -1, -6, 2, 2, "#15803d");
    } else if (f.kind === 2) {
      // blueberry cluster
      pxEllipse(ctx, -2, 1, 3, 3, outline);
      pxEllipse(ctx, 3, 0, 3, 3, outline);
      pxEllipse(ctx, 0, -3, 3, 3, outline);
      pxEllipse(ctx, -2, 1, 2, 2, "#8b5cf6");
      pxEllipse(ctx, 3, 0, 2, 2, "#7c3aed");
      pxEllipse(ctx, 0, -3, 2, 2, "#a78bfa");
      px(ctx, -3, 0, 1, 1, "#ddd6fe");
      px(ctx, 2, -1, 1, 1, "#ddd6fe");
      px(ctx, -1, -4, 1, 1, "#ddd6fe");
    } else if (f.kind === 3) {
      // flower
      const petals = [
        [0, -4],
        [4, -1],
        [2, 4],
        [-2, 4],
        [-4, -1],
      ];
      for (const [x, y] of petals) pxEllipse(ctx, x, y, 3, 3, outline);
      for (const [x, y] of petals) pxEllipse(ctx, x, y, 2, 2, "#f472b6");
      pxEllipse(ctx, 0, 0, 2, 2, outline);
      pxEllipse(ctx, 0, 0, 1, 1, "#fde047");
    } else if (f.kind === 4) {
      // honey pot
      px(ctx, -4, -5, 8, 2, outline);
      px(ctx, -3, -4, 6, 1, "#b45309");
      pxEllipse(ctx, 0, 1, 5, 5, outline);
      pxEllipse(ctx, 0, 1, 4, 4, "#fbbf24");
      px(ctx, -3, -1, 2, 2, "#fde68a");
      px(ctx, -2, 1, 4, 1, "#d97706");
      px(ctx, -1, 3, 2, 1, "#b45309");
    } else {
      // green apple
      pxEllipse(ctx, 0, 1, 5, 5, outline);
      pxEllipse(ctx, 0, 1, 4, 4, "#84cc16");
      pxEllipse(ctx, -1, 2, 2, 2, "#65a30d");
      px(ctx, -3, -2, 2, 2, "#d9f99d");
      px(ctx, 0, -5, 1, 2, "#3f6212");
      px(ctx, 1, -5, 3, 2, "#16a34a");
    }
    ctx.restore();
  };

  // ---- main loop ----------------------------------------------------------
  const update = (dt: number, time: number) => {
    if (disposed) return;
    // Physics uses the capped frame step; reading/expiry use elapsed time from
    // the same clock so a slow frame or background tab cannot keep fruit or jokes alive.
    const elapsed =
      previousUpdateTime === undefined ? dt : Math.max(0, (time - previousUpdateTime) / 1000);
    previousUpdateTime = time;
    clock += elapsed;
    opacity += ((enabled ? 1 : 0) - opacity) * damp(6, dt);
    if (!enabled && opacity < 0.01) {
      if (bubbleVisible) hush();
      return;
    }
    if (!enabled) return;
    if (bubbleVisible && storyIndex < 0 && clock >= bubbleHideAt) hush();
    if (bubbleVisible && bubbleGeometryDirty && !blocked && clock >= scrollQuietAt) {
      measureHome();
      measureBubble();
    }
    if (!blocked && storyIndex < 0) {
      const speech = dialogue.tick(clock, clock >= scrollQuietAt);
      if (speech) present(speech);
    }
    if (reduced) {
      for (let i = fruits.length - 1; i >= 0; i--) {
        fruits[i].age += elapsed;
        if (fruits[i].age >= fruits[i].life) fruits.splice(i, 1);
      }
      home?.classList.toggle("has-snack", fruits.length > 0);
      followBubble();
      return;
    }
    pointerSpeed *= 0.02 ** dt;
    boost += (clamp(pointerSpeed * 0.02, 0, 1) - boost) * damp(18, dt);

    // anchor lags the cursor
    const a = damp(4, dt);
    anchor.x += (pointerPos.x - anchor.x) * a;
    anchor.y += (pointerPos.y - anchor.y) * a;

    // flower dwell → perch
    if (flowerRect && mode !== "fruit") {
      flowerDwell += dt;
      mode = "flower";
      const px = flowerRect.left + flowerRect.width / 2;
      const py = flowerRect.top - 26;
      const near = Math.hypot(pos.x - px, pos.y - py) < 16 && Math.hypot(vel.x, vel.y) < 70;
      if (flowerDwell > 0.22 && near && !perched) {
        perched = true;
        ask("flower");
      }
    } else if (mode === "flower") {
      mode = "cruise";
      perched = false;
      flowerDwell = 0;
    }

    orbitPhase += 6 * dt;
    computeTarget(time);
    const maxSpeed = 560 + boost * 460;
    if (perched && flowerRect) {
      // settle onto the bloom with a gentle sip bob
      const px = flowerRect.left + flowerRect.width / 2;
      const py = flowerRect.top - 26 + Math.sin(clock * 2.4) * 2;
      pos.x += (px - pos.x) * damp(10, dt);
      pos.y += (py - pos.y) * damp(10, dt);
      const decay = 1 - damp(-Math.log(0.8) * 60, dt);
      vel.x *= decay;
      vel.y *= decay;
    } else {
      steer(dt, maxSpeed);
    }

    // orientation: face travel, dorsal side up, bank into the turn
    const speed = Math.hypot(vel.x, vel.y);
    if (speed > 4) {
      const desired = Math.atan2(vel.y, vel.x);
      let delta = desired - heading;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      heading += delta * damp(14, dt);
      const turn = clamp(delta / Math.max(dt, 0.001), -6, 6);
      bank += (clamp(turn * 0.05, -0.5, 0.5) - bank) * damp(6, dt);
    } else {
      bank += (0 - bank) * damp(6, dt);
    }
    const flapFreq = perched || clock < restUntil ? 7 : 40 + (speed / 560) * 30 + boost * 26;
    flapPhase += dt * flapFreq;

    updateFruits(dt, elapsed);

    // a bounded trail of pink pollen dots when the bee zips around
    sparkleTimer -= dt;
    if (speed > 150 && sparkleTimer <= 0 && sparkles.length < 10) {
      sparkleTimer = 0.16 + random() * 0.06;
      sparkles.push({
        x: pos.x - vel.x * 0.02 + (random() - 0.5) * 10,
        y: pos.y - vel.y * 0.02 + (random() - 0.5) * 10,
        age: 0,
        life: 0.5 + random() * 0.3,
        size: 1 + Math.floor(random() * 2),
      });
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.age += elapsed;
      s.y -= 16 * dt;
      if (s.age >= s.life) sparkles.splice(i, 1);
    }

    // One waiting aside at most; otherwise give the reading task room.
    if (busy && clock >= waitingAt) {
      waitingAt = Infinity;
      ask("waiting");
    }
    nextTeaser -= elapsed;
    if (nextTeaser <= 0 && !busy && storyIndex < 0 && !blocked && !perched && mode === "cruise") {
      nextTeaser = (touchPrimary ? 13 : 7) + random() * (touchPrimary ? 9 : 6);
      ask(arrived ? "idle" : "arrival");
      arrived = true;
    }

    followBubble();
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    if (disposed || !enabled || reduced || opacity < 0.01) return;
    if (sparkles.length) {
      ctx.save();
      ctx.fillStyle = "#f9a8d4";
      for (const s of sparkles) {
        ctx.globalAlpha = opacity * (1 - s.age / s.life) * 0.85;
        ctx.fillRect(Math.round(s.x - s.size / 2), Math.round(s.y - s.size / 2), s.size, s.size);
      }
      ctx.restore();
    }
    for (const f of fruits) drawFruit(ctx, f);
    const speed = Math.hypot(vel.x, vel.y);
    // Face the direction of horizontal travel (with hysteresis so it doesn't flicker).
    if (vel.x > 24) facing = 1;
    else if (vel.x < -24) facing = -1;
    const sn = clamp(speed / 560, 0, 1);
    const lean = clamp(bank, -0.3, 0.3);
    // Five pixel-art poses avoid sub-frame wing shimmer while preserving the cadence.
    const flap = (Math.round(Math.sin(flapPhase) * 2) / 2) * (perched ? 0.25 : 0.9);
    const reaction = Math.max(0, (reactionUntil - clock) / 0.65);
    const squash = mood === "startled" ? Math.sin(reaction * Math.PI) * 0.14 : 0;
    const hop = mood === "excited" ? Math.sin(reaction * Math.PI) * 5 : 0;
    const u = 1.7;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(pos.x), Math.round(pos.y - hop));
    ctx.rotate(lean);
    ctx.scale(facing * u * (1 + sn * 0.12 + squash), u * (1 - sn * 0.06 - squash));
    drawBee(ctx, flap);
    ctx.restore();
  };

  const action = (kind: BeeAction) => {
    if (!enabled || disposed || blocked) return;
    measureHome();
    if (kind === "close") {
      endStory();
      announce("Story closed.");
      return;
    }
    if (kind === "story") {
      if (storyIndex < 0 && busy) {
        announce("The models are working. Tiny story later.");
        return;
      }
      dialogue.clear();
      storyIndex++;
      if (storyIndex >= 3) {
        endStory();
        announce("Story finished.");
        return;
      }
      const stories = BEE_LINES.filter((l) => l.trigger === "story");
      const line = stories[(storyCycle % (stories.length / 3)) * 3 + storyIndex];
      present({ line, text: line.text, at: clock, until: Infinity, explicit: true });
      storyControls();
      react("curious");
      return;
    }
    endStory();
    if (kind === "boop") {
      boops = Math.min(9, boops + 1);
      react("startled");
      ask(boops > 1 ? "boop-repeat" : "boop", true, undefined, boops);
      announce("Bee booped.");
    } else {
      spawnFruit(garden.x + 26, garden.y - 12, true);
      restUntil = 0;
      react("curious");
      ask("discover", true);
      announce("Snack placed in the garden.");
      if (reduced) home?.classList.add("has-snack");
    }
  };
  return {
    update,
    action,
    draw,
    pointer(x, y, speed) {
      pointerPos.x = x;
      pointerPos.y = y;
      pointerActive = true;
      pointerSpeed = Math.max(pointerSpeed, speed);
    },
    pointerLeave() {
      pointerActive = false;
    },
    click(x, y, feed) {
      if (!enabled || opacity < 0.4 || reduced || blocked) return false;
      if (Math.hypot(x - pos.x, y - pos.y) >= 34) {
        if (!feed) return false;
        endStory();
        spawnFruit(x, y, true);
        restUntil = 0;
        react("curious");
        ask("discover", true);
        return true;
      }
      action("boop");
      return true;
    },
    flower(rect) {
      flowerRect = rect;
      flowerDwell = 0;
      if (!rect) perched = false;
    },
    scroll() {
      dialogue.clear("hover");
      hoverKey = "";
    },
    comment(event, name) {
      if (!enabled || disposed) return;
      if (event === "complete") {
        busy = false;
        dialogue.clear("response");
        dialogue.clear("waiting");
        return;
      }
      if (event === "run" || event === "error" || event === "cancel" || event === "compare") {
        endStory();
        dialogue.clearPending();
      }
      if (event === "run") {
        busy = true;
        waitingAt = clock + 10;
      }
      if (event === "cancel") busy = false;
      const trigger = event === "winner" ? "fastest" : event;
      const explicit = [
        "select",
        "deselect",
        "preset-core",
        "preset-free",
        "preset-all",
        "surprise",
        "starter",
        "copy",
        "export",
        "day",
        "night",
      ].includes(event);
      if (explicit) {
        endStory();
        dialogue.clear("hover");
        dialogue.clear("idle");
        dialogue.clear("arrival");
      }
      react(
        event === "error"
          ? "startled"
          : event === "run" || event === "winner"
            ? "excited"
            : "curious",
      );
      ask(trigger, explicit, name, undefined, explicit ? "action" : undefined);
    },
    hover(zone, name, tag) {
      if (!enabled || disposed) return;
      const next = zone === "model" ? `${name ?? ""}:${tag ?? ""}` : "";
      if (next === hoverKey) return;
      hoverKey = next;
      dialogue.clear("hover");
      if (!next || storyIndex >= 0 || blocked) return;
      ask(
        tag === "fastest" ? "fastest" : tag === "cheapest" ? "cheap" : "model",
        false,
        name,
        undefined,
        "hover",
      );
    },
    setEnabled(on) {
      enabled = on;
      if (home) {
        home.hidden = !on;
        home.dataset.enabled = String(on);
      }
      if (!on) {
        hush();
        dialogue.reset();
        announce("");
        boops = meals = 0;
        storyCycle = 0;
        busy = false;
        arrived = false;
        home?.classList.remove("has-snack");
        storyIndex = -1;
        storyControls();
        home?.removeAttribute("open");
        fruits.length = 0;
        sparkles.length = 0;
        mode = "cruise";
        perched = false;
        flowerRect = null;
        flowerDwell = 0;
        pointerActive = false;
        pointerSpeed = 0;
        hoverKey = "";
        restUntil = 0;
        reactionUntil = 0;
        boost = 0;
      } else if (opacity < 0.05) {
        pos.x = width * 0.5;
        pos.y = -40;
        vel.x = 0;
        vel.y = 0;
      }
    },
    setColors(next) {
      colors = next;
      applyBubbleColors();
    },
    resize(w, h) {
      width = w;
      height = h;
      measureHome();
      hideOnViewportChange();
    },
    dispose() {
      disposed = true;
      bubbleObstacles = [];
      bubble.remove();
      observer?.disconnect();
      document.removeEventListener("focusin", suspend);
      document.removeEventListener("focusout", suspend);
      document.removeEventListener("toggle", suspend, true);
      document.removeEventListener("beforetoggle", beforeToggle, true);
      document.removeEventListener("keydown", closeWithEscape);
      window.removeEventListener("model-table:motion-change", motionChange);
      window.removeEventListener("scroll", hideOnViewportChange);
      window.visualViewport?.removeEventListener("resize", hideOnViewportChange);
      window.visualViewport?.removeEventListener("scroll", hideOnViewportChange);
      dialogue.reset();
      announce("");
      storyIndex = -1;
      storyControls();
      home?.classList.remove("has-snack");
      fruits.length = 0;
      sparkles.length = 0;
    },
    get active() {
      return enabled && !reduced && (opacity > 0.01 || fruits.length > 0 || sparkles.length > 0);
    },
    get diagnostics() {
      return {
        boops,
        meals,
        fruits: fruits.length,
        story: storyIndex,
        queued: dialogue.diagnostics.queued,
        recent: dialogue.diagnostics.recent,
        mood,
        pointerActive,
        flower: Boolean(flowerRect),
        hoverKey,
        restUntil,
        perched,
        speed: Math.hypot(vel.x, vel.y),
      };
    },
  };
}
