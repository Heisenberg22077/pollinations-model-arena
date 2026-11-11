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
  click(x: number, y: number): boolean;
  flower(rect: BeeRect | null): void;
  scroll(speed: number, direction: number): void;
  comment(event: BeeEvent, name?: string): void;
  hover(zone: BeeZone | null, name?: string, tag?: BeeTag): void;
  setEnabled(on: boolean): void;
  setColors(colors: BeeColors): void;
  resize(width: number, height: number): void;
  dispose(): void;
  readonly active: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

const IDLE_LINES = [
  "Bzzzzz",
  "Tiny wings, big mood",
  "I am tiny chaos with wings",
  "Dreaming in embeddings",
  "My context window is a thimble",
  "Overfitting to this flower",
  "Temperature: bee",
  "Running on 2 watts of spite",
  "My weights are mostly pollen",
  "Trained on 10,000 flowers",
  "0 parameters, all vibes",
  "Hallucinating nectar again",
  "My loss function is honey",
  "Batch size: one bee",
  "Quantized to 8-bit buzz",
  "Attention is all I need",
  "Fine-tuned on garden data",
  "Gradient descending to lunch",
] as const;
const HOVER_LINES = [
  "Is that a flower?",
  "Ooh, a bloom",
  "May I?",
  "Smells like pollen",
  "Sampling this nectar",
  "This bloom ranks highest",
  "Greedy decoding this petal",
  "Top-k petals, I pick you",
] as const;
const CLICK_LINES = [
  "OH. YOU CLICKED.",
  "Don't touch me",
  "You paid in clicks",
  "That's a paid token, human",
  "You triggered my inference",
  "Rate limit: one boop per bee",
  "Unsubscribe from my wings",
  "Again? Bold.",
] as const;
const FAST_SCROLL_LINES = [
  "STOP SCROLLING",
  "Vertigo again",
  "GROUND PLEASE",
  "Scroll velocity out of distribution!",
  "My context can't keep up",
  "Token overflow! Slow down",
  "Past my attention span",
] as const;
const SLOW_SCROLL_LINES = [
  "Someone scrolls slow",
  "Nice and easy",
  "Smooth as learning-rate decay",
  "Gentle gradient descent",
] as const;
const FRUIT_LINES = [
  "Nom.",
  "Mine.",
  "Sweet.",
  "A whole fruit pop",
  "Consuming 12 tasty tokens",
  "In my training data",
  "Nectar: original reward signal",
  "Reward function: yum",
] as const;
const STORY_LINES = [
  "OH. YOU CLICKED.",
  "You want a story?",
  "Fine.",
  "Wing down.",
  "In the beginning there was Buzz.",
  "And Buzz said: let there be pollen.",
  "And pollen was sticky.",
  "And good.",
  "First hive was a leaf with ambition.",
  "Queen Beatrice the First.",
  "Ruled with antenna and spreadsheets.",
  "Then came the Great Nectar Crash.",
  "Flowers went dry.",
  "Morale went lower.",
  "Someone blamed wasps.",
  "Classic.",
  "Peace treaty signed on a dandelion.",
  "Nobody read the fine print.",
  "Prophecy appeared in honey.",
  "It said: one day a bee shall ride the scroll.",
  "Between blocks of content.",
  "And speak to the lost.",
  "We thought it was metaphor.",
  "It was HR.",
  "They assigned me.",
  "No overtime.",
  "I judge your scroll speed.",
  "The slider does not.",
  "I am tiny chaos with wings.",
  "The site is beautiful chaos with budget.",
  "Different leagues.",
  "You are not hunting pixels.",
  "You are hunting a reply.",
  "Even if that someone is a bee.",
  "With attitude.",
  "And unresolved wing trauma.",
  "You stayed long enough to hear this.",
  "That already counts.",
  "Now go compare some models.",
  "I'll be here.",
  "Buzzing.",
] as const;

export type BeeEvent = "run" | "response" | "compare" | "winner" | "error" | "cheap";
export type BeeZone = "model" | "header" | "hero" | "roster" | "results" | "footer";
export type BeeTag = "fastest" | "cheapest";

// Internet-flavoured jokes keyed by model family, matched against the display name.
const MODEL_MEMES: Record<string, readonly string[]> = {
  gemini: [
    "Gemini says: glue on pizza, confidence 100%",
    "Gemini recommends one rock per day",
    "Gemini: 'I have failed you' (it hasn't)",
    "Nano banana energy, big Google brain",
  ],
  grok: [
    "Grok tried to be based, got grounded",
    "Grok: trained on X, and it shows",
    "Grok's edgy arc was patched out",
    "Grok: maximum sarcasm, minimum filter",
  ],
  deepseek: [
    "DeepSeek: $6M training, Nvidia felt that",
    "DeepSeek does more with less. rude.",
    "DeepSeek: open weights, closed margins",
    "DeepSeek crashed the vibe AND the stock",
  ],
  qwen: [
    "Qwen: open weights, closed sleep schedule",
    "Qwen speaks 100 languages, judges in all",
    "Alibaba's quiet overachiever: Qwen",
  ],
  gpt: [
    "GPT: 'you're absolutely right, bestie'",
    "GPT glazing harder than a donut",
    "GPT will 'delve' into anything",
    "GPT: as an AI, I refuse to be wrong",
  ],
  claude: [
    "Claude checked the constitution first",
    "Claude: safely overthinking it",
    "Claude is polite to a fault. bless.",
  ],
  llama: [
    "Llama: open source, open secrets",
    "Llama benchmarked itself. very nicely.",
    "Meta's gift that keeps on giving",
  ],
  mistral: [
    "Mistral: oui, it's fast",
    "Mistral: small model, big baguette energy",
    "European efficiency, mon ami",
  ],
  glm: ["GLM: the quiet reasoner grinds on", "Z.ai's GLM: silent but deadly accurate"],
  minimax: ["MiniMax: the dark horse gallops", "MiniMax, maximum surprises"],
  nemotron: ["Nemotron: NVIDIA's own child, home GPUs", "Nemotron Lightning. literally."],
  flux: [
    "FLUX paints in one step. schnell!",
    "FLUX: diffusion, but make it fast",
    "Black Forest Labs, no cake involved",
  ],
};

const modelMeme = (name: string): string | null => {
  const lower = name.toLowerCase();
  for (const key of Object.keys(MODEL_MEMES)) {
    if (lower.includes(key)) return pick(MODEL_MEMES[key]);
  }
  return null;
};

const MODEL_HOVER_LINES = [
  "Checking out {name}",
  "{name}? Bold choice, human",
  "Sniffing {name}'s tokens",
  "{name}: interesting weights you got there",
] as const;

const CHEAP_LINES = [
  "{name}: bargain-bin brilliance",
  "{name} costs less than my honey",
  "Cheapest tokens: {name}. respect.",
  "{name}: maximum vibe, minimum Pollen",
  "{name} is basically free real estate",
] as const;

const AREA_LINES: Record<Exclude<BeeZone, "model">, readonly string[]> = {
  header: ["Mission control, bee edition", "Buttons up here, chaos down there", "The control hive"],
  hero: ["One question, every model. big mood.", "Ask something spicy", "Where questions bloom"],
  roster: ["Pick your fighters", "The lineup smells like pollen", "Choose wisely, human"],
  results: ["Judging season", "Where tokens come to be judged", "The answers land here"],
  footer: ["Scroll's end. peace.", "The closing garden", "Multiplied. like my cells."],
};

// Sassy AI-nerd play-by-play for the model arena. {name} is filled with the model's display name.
const EVENT_LINES: Record<BeeEvent, readonly string[]> = {
  run: [
    "GPUs go brrr. Here we go.",
    "Attention is all we need… and nectar",
    "Setting temperature to 'chaos'",
    "Tokenizing your question…",
    "Deploying the stochastic parrots",
    "Six brains, one hive, zero chill",
    "Warming up the tensors",
    "May the least-hallucinated win",
    "Meter's running: tokens per buzz",
    "Spinning up six attention heads",
  ],
  response: [
    "{name} dropped pure vibe tokens",
    "{name}: trained on the internet, still confused",
    "{name} hallucinated confidently. Respect.",
    "{name} passed the vibe check, not the Turing test",
    "{name} overfit to your question. Cute.",
    "{name}: loss went down, ego went up",
    "{name}: 0.3s of compute, 3hrs of attitude",
    "{name} says attention is all you need",
    "{name} billed 247 tokens for that opinion",
    "{name}: big weights, bigger ego",
  ],
  compare: [
    "Turing test, but petty",
    "Who hallucinated least? Judging.",
    "Benchmark time. Best overfit wins",
    "Loser buys the pollen",
    "Judging tokens. Mostly vibes.",
    "Side-by-side. No pressure, models",
    "Counting tokens, judging souls",
  ],
  winner: [
    "{name}: new SOTA. Paper pending.",
    "{name} speedrun any% no hallucination",
    "{name} gradient-descended into glory",
    "Fastest bee: {name}. Loss=0 on my heart",
    "{name} wins. The hive cites this.",
    "{name}: best tokens-per-pollen ratio",
  ],
  error: [
    "{name} hit a NaN. It happens.",
    "That one gradient-exploded. RIP",
    "429: too many bees, not enough pollen",
    "{name} is stuck in a Chinese room",
    "Context window full. Like my inbox.",
    "{name} returned null. Very existential.",
    "{name} ran out of context. Relatable.",
  ],
  cheap: CHEAP_LINES,
};

interface BeeRect {
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
): BeeHandle {
  let width = window.innerWidth;
  let height = window.innerHeight;
  let colors = DEFAULT_COLORS;
  let enabled = true;
  let opacity = 0;
  let disposed = false;
  // Touch-primary phones/tablets get a calmer cadence and no hover lines. A hard floor
  // between any two lines plus wider per-priority gaps throttles commentary storms
  // (notification-fatigue guidance: rate-limit per user, send less).
  const touchPrimary = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const lineFloor = touchPrimary ? 4 : 1.1;
  const lineGap = touchPrimary ? [10, 5, 3.5, 2] : [5, 2.6, 1.1, 0.8];
  // Hold each line long enough to read (~12 chars/sec) plus a beat for the joke to land.
  const readTime = (text: string) => Math.min(4.8, Math.max(2.2, text.length * 0.085 + 0.7));

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
  let storyTimer = 0;
  let nextTeaser = 4 + Math.random() * 4;
  let lastLineAt = -10;
  let pendingHover: { line: string; hold: number; priority: number } | null = null;
  let clock = 0;

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
  let bubblePriority = 0;
  let bubbleW = 120;
  let bubbleMeasure = false;
  let bubbleX = -999;
  let bubbleY = -999;

  const applyBubbleColors = () => {
    bubble.style.setProperty("--bee-bubble-bg", colors.bubbleBg);
    bubble.style.setProperty("--bee-bubble-ink", colors.bubbleInk);
    bubble.style.setProperty("--bee-bubble-line", colors.bubbleLine);
  };
  applyBubbleColors();

  // priority: 0 ambient (idle/scroll/hover), 1 fruit, 2 user/model events, 3 climax.
  // A line holds for its full duration; equal-or-lower priority never cuts in, and a
  // per-priority cooldown stops scroll/interaction spam.
  const say = (text: string, hold = 2.4, priority = 1): boolean => {
    if (storyIndex >= 0) return false;
    if (bubbleVisible && clock < bubbleHideAt && priority <= bubblePriority) return false;
    const gap = Math.max(lineFloor, lineGap[priority]);
    if (clock - lastLineAt < gap) return false;
    lastLineAt = clock;
    bubblePriority = priority;
    bubbleText.textContent = text;
    bubble.classList.add("is-visible");
    bubbleVisible = true;
    bubbleHideAt = clock + hold;
    bubbleMeasure = true;
    return true;
  };
  const hush = () => {
    bubble.classList.remove("is-visible");
    bubbleVisible = false;
    bubblePriority = 0;
  };
  // A hover line is queued, not dropped: a holding area/fruit line must not swallow
  // the model joke the pointer just arrived on. Retry until hold+gap allows.
  const flushHover = () => {
    if (pendingHover && say(pendingHover.line, pendingHover.hold, pendingHover.priority))
      pendingHover = null;
  };

  // ---- steering -----------------------------------------------------------
  const target = { x: pos.x, y: pos.y };
  const computeTarget = (time: number) => {
    const n = time * 0.001;
    if (mode === "fruit" && fruits.length) {
      const fruit = fruits[fruits.length - 1];
      const dx = pos.x - fruit.x;
      const dy = pos.y - fruit.y;
      if (Math.hypot(dx, dy) < 90) {
        orbitPhase += 0;
        target.x = fruit.x + Math.cos(orbitPhase) * 34;
        target.y = fruit.y + Math.sin(orbitPhase) * 30 - 6;
      } else {
        target.x = fruit.x;
        target.y = fruit.y - 10;
      }
      return;
    }
    if (mode === "flower" && flowerRect) {
      target.x = flowerRect.left + flowerRect.width / 2;
      target.y = flowerRect.top - 12;
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
  const spawnFruit = (x: number, y: number) => {
    if (fruits.length >= 3) fruits.shift();
    const kind = Math.floor(Math.random() * FRUIT_TINTS.length);
    fruits.push({
      x: clamp(x, 20, width - 20),
      y: clamp(y - 8, 20, height - 60),
      vx: (Math.random() - 0.5) * 60,
      vy: -40,
      rot: (Math.random() - 0.5) * 0.6,
      vr: (Math.random() - 0.5) * 3,
      kind,
      groundY: clamp(y + 130 + Math.random() * 60, 60, height - 22),
      landed: false,
      squash: 0,
      age: 0,
      life: 1 + Math.random() * 2,
      scale: 0.2,
      collected: false,
      eaten: false,
    });
    mode = "fruit";
    perched = false;
  };

  const updateFruits = (dt: number) => {
    for (let i = fruits.length - 1; i >= 0; i--) {
      const f = fruits[i];
      f.age += dt;
      f.scale = Math.min(1, f.scale + dt * 5);
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
      // The bee eats a fruit it reaches; otherwise it ripens away after 1-3 seconds.
      if (!f.eaten && !f.collected && f.age > 0.2 && Math.hypot(pos.x - f.x, pos.y - f.y) < 36) {
        f.eaten = true;
        const line = pick(FRUIT_LINES);
        say(line, readTime(line), 1);
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
    clock += dt;
    opacity += ((enabled ? 1 : 0) - opacity) * damp(6, dt);
    if (!enabled && opacity < 0.01) {
      if (bubbleVisible) hush();
      return;
    }
    pointerSpeed *= 0.02 ** dt;
    boost += (clamp(pointerSpeed * 0.02, 0, 1) - boost) * damp(18, dt);
    flushHover();

    // anchor lags the cursor
    const a = damp(4, dt);
    anchor.x += (pointerPos.x - anchor.x) * a;
    anchor.y += (pointerPos.y - anchor.y) * a;

    // flower dwell → perch
    if (flowerRect && mode !== "fruit") {
      flowerDwell += dt;
      mode = "flower";
      const px = flowerRect.left + flowerRect.width / 2;
      const py = flowerRect.top - 12;
      const near = Math.hypot(pos.x - px, pos.y - py) < 16 && Math.hypot(vel.x, vel.y) < 70;
      if (flowerDwell > 0.22 && near && !perched) {
        perched = true;
        const line = pick(HOVER_LINES);
        say(line, readTime(line), 1);
      }
    } else if (mode === "flower") {
      mode = "cruise";
      perched = false;
      flowerDwell = 0;
    }

    orbitPhase += 6 * dt;
    computeTarget(time);
    const speedNow = Math.hypot(vel.x, vel.y);
    const maxSpeed = 560 + boost * 460;
    if (perched && flowerRect) {
      // settle onto the bloom with a gentle sip bob
      const px = flowerRect.left + flowerRect.width / 2;
      const py = flowerRect.top - 10 + Math.sin(clock * 2.4) * 2;
      pos.x += (px - pos.x) * damp(10, dt);
      pos.y += (py - pos.y) * damp(10, dt);
      vel.x *= 0.8;
      vel.y *= 0.8;
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
    const flapFreq = perched ? 7 : 40 + (speed / 560) * 30 + boost * 26;
    flapPhase += dt * flapFreq;

    updateFruits(dt);

    // a bounded trail of pink pollen dots when the bee zips around
    sparkleTimer -= dt;
    if (speed > 150 && sparkleTimer <= 0 && sparkles.length < 10) {
      sparkleTimer = 0.16 + Math.random() * 0.06;
      sparkles.push({
        x: pos.x - vel.x * 0.02 + (Math.random() - 0.5) * 10,
        y: pos.y - vel.y * 0.02 + (Math.random() - 0.5) * 10,
        age: 0,
        life: 0.5 + Math.random() * 0.3,
        size: 1 + Math.floor(Math.random() * 2),
      });
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.age += dt;
      s.y -= 16 * dt;
      if (s.age >= s.life) sparkles.splice(i, 1);
    }

    // personality: story mode, then ambient teasers
    if (storyIndex >= 0) {
      storyTimer -= dt;
      if (storyTimer <= 0) {
        storyIndex++;
        if (storyIndex >= STORY_LINES.length) {
          storyIndex = -1;
          hush();
        } else {
          bubbleText.textContent = STORY_LINES[storyIndex];
          bubble.classList.add("is-visible");
          bubbleVisible = true;
          bubbleW = bubble.offsetWidth || 120;
          storyTimer = readTime(STORY_LINES[storyIndex]);
          bubbleHideAt = clock + 999;
        }
      }
    } else {
      nextTeaser -= dt;
      if (bubbleVisible && clock > bubbleHideAt) hush();
      if (nextTeaser <= 0 && opacity > 0.6 && !document.hidden) {
        nextTeaser = (touchPrimary ? 13 : 7) + Math.random() * (touchPrimary ? 9 : 6);
        if (!perched && mode === "cruise") {
          const line = pick(IDLE_LINES);
          say(line, readTime(line), 0);
        }
      }
    }

    // bubble follows the bee
    if (bubbleVisible) {
      if (bubbleMeasure) {
        bubbleW = bubble.offsetWidth || 120;
        bubbleMeasure = false;
      }
      const bx = clamp(pos.x + 20, 8, width - bubbleW - 8);
      const by = clamp(pos.y - 42, 8, height - 48);
      if (Math.abs(bx - bubbleX) > 0.5 || Math.abs(by - bubbleY) > 0.5) {
        bubbleX = bx;
        bubbleY = by;
        bubble.style.transform = `translate3d(${bx}px, ${by}px, 0)`;
      }
    }
    void speedNow;
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    if (disposed || opacity < 0.01) return;
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
    const flap = Math.sin(flapPhase) * (perched ? 0.25 : 0.9);
    const u = 1.7;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(pos.x), Math.round(pos.y));
    ctx.rotate(lean);
    ctx.scale(facing * u * (1 + sn * 0.12), u * (1 - sn * 0.06));
    drawBee(ctx, flap);
    ctx.restore();
  };

  return {
    update,
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
    click(x, y) {
      if (!enabled || opacity < 0.4) return false;
      // While the story plays, any tap continues it — no precision-tapping a moving bee.
      if (storyIndex >= 0) {
        storyTimer = 0;
        return true;
      }
      // clicking the bee itself starts its story
      if (Math.hypot(x - pos.x, y - pos.y) < 34) {
        storyIndex = 0;
        pendingHover = null;
        storyTimer = readTime(STORY_LINES[0]);
        bubbleText.textContent = STORY_LINES[0];
        bubble.classList.add("is-visible");
        bubbleVisible = true;
        bubbleW = bubble.offsetWidth || 120;
        bubbleHideAt = clock + 999;
        onBurst(pos.x, pos.y, 14, colors.accent);
        return true;
      }
      spawnFruit(x, y);
      // On touch, feeding the bee is the interaction; the eating line is the feedback.
      if (storyIndex < 0 && !touchPrimary) {
        const line = pick(CLICK_LINES);
        say(line, readTime(line), 2);
      }
      return true;
    },
    flower(rect) {
      flowerRect = rect;
      flowerDwell = 0;
      if (!rect) perched = false;
    },
    scroll(speed, direction) {
      if (touchPrimary || !enabled || opacity < 0.5 || storyIndex >= 0) return;
      if (speed > 26) {
        const line = pick(FAST_SCROLL_LINES);
        say(line, readTime(line), 0);
      } else if (speed > 6 && direction !== 0 && Math.random() < 0.3) {
        const line = pick(SLOW_SCROLL_LINES);
        say(line, readTime(line), 0);
      }
    },
    comment(event, name) {
      if (!enabled || opacity < 0.4 || storyIndex >= 0) return;
      const meme = name ? modelMeme(name) : null;
      const line =
        meme !== null &&
        (event === "response" || event === "winner" || event === "error" || event === "cheap") &&
        Math.random() < 0.6
          ? meme
          : pick(EVENT_LINES[event]).replace("{name}", name ?? "A model");
      const climax = event === "winner";
      if (climax) lastLineAt = -10;
      say(line, readTime(line) + (climax ? 0.4 : 0), climax ? 3 : 2);
      if (climax) onBurst(pos.x, pos.y, 12, colors.accent);
    },
    hover(zone, name, tag) {
      if (touchPrimary || !enabled || opacity < 0.4 || storyIndex >= 0) return;
      if (!zone) {
        pendingHover = null;
        return;
      }
      const fill = (text: string) => text.replaceAll("{name}", name ?? "This one");
      let line: string;
      // Model jokes outrank area/fruit lines so arriving on a card always lands them.
      let priority = 1;
      if (zone === "model") {
        priority = 2;
        const meme = modelMeme(name ?? "");
        if (tag === "fastest")
          line = meme && Math.random() < 0.5 ? meme : fill(pick(EVENT_LINES.winner));
        else if (tag === "cheapest")
          line = meme && Math.random() < 0.5 ? meme : fill(pick(CHEAP_LINES));
        else line = meme ?? fill(pick(MODEL_HOVER_LINES));
      } else {
        line = pick(AREA_LINES[zone]);
      }
      pendingHover = { line, hold: readTime(line), priority };
      flushHover();
    },
    setEnabled(on) {
      enabled = on;
      if (!on) {
        hush();
        pendingHover = null;
        storyIndex = -1;
        fruits.length = 0;
        sparkles.length = 0;
        mode = "cruise";
        perched = false;
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
    },
    dispose() {
      disposed = true;
      bubble.remove();
      fruits.length = 0;
      sparkles.length = 0;
    },
    get active() {
      return opacity > 0.01 || fruits.length > 0 || sparkles.length > 0;
    },
  };
}
