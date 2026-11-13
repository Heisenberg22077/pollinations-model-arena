// Background music: the user's own recording, trimmed to a 90s loop and self-hosted in
// three web codecs. The player picks the best one the browser truly supports — Opus (WebM)
// where it reports full support, AAC (M4A) on Apple/legacy, MP3 as the universal floor —
// and falls back to the next codec if a source fails to decode. Music is on by default:
// once the page has loaded it tries to start on its own (allowed only where the browser's
// autoplay policy permits it); otherwise it starts on the first real user gesture.
// One master mute in sound.ts fades it out.

const TARGET = 0.6;
const FADE_OUT = 0.12;

// ---- codec ladder ---------------------------------------------------------
function sourceOrder(): string[] {
  const base = import.meta.env.BASE_URL;
  const probe = new Audio();
  const order: string[] = [];
  if (probe.canPlayType('audio/webm; codecs="opus"') === "probably") {
    order.push(`${base}audio/calm-garden.webm`);
  }
  if (probe.canPlayType('audio/mp4; codecs="mp4a.40.2"')) {
    order.push(`${base}audio/calm-garden.m4a`);
  }
  order.push(`${base}audio/calm-garden.mp3`);
  return order;
}

// ---- audio graph (gain only, for smooth mute/unmute fades) ----------------
let el: HTMLAudioElement | null = null;
let sources: string[] = [];
let sourceIndex = 0;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let graphReady = false;
let graphFailed = false;

let enabled = false;
let gestured = false;
let armed = false;
let playing = false;
let pageReady = false;

// After a no-gesture autoplay the listeners stay armed so the first gesture can move
// playback onto the gain graph (an AudioContext made before a gesture starts suspended).
function onPlaying() {
  playing = true;
  if (graphReady || graphFailed) disarm();
}

function handleError() {
  if (el && sourceIndex < sources.length - 1) {
    sourceIndex += 1;
    el.src = sources[sourceIndex];
    if (enabled && (gestured || pageReady)) {
      el.preload = "auto";
      const attempt = el.play();
      if (attempt) attempt.then(onPlaying).catch(() => {});
    }
    return;
  }
  playing = false;
}

function ensureElement(): HTMLAudioElement {
  if (el) return el;
  sources = sourceOrder();
  sourceIndex = 0;
  const element = new Audio();
  element.loop = true;
  element.preload = "none";
  element.src = sources[0];
  element.addEventListener("error", handleError);
  // A play() refused before the codec finished loading gets one more chance as
  // soon as the data is ready (Chrome keeps sticky activation after a tap).
  element.addEventListener("canplay", () => {
    if (enabled && gestured && !playing) start();
  });
  element.setAttribute("aria-hidden", "true");
  element.style.display = "none";
  document.body.appendChild(element);
  el = element;
  return element;
}

function ensureGraph(): boolean {
  if (graphReady) return true;
  if (graphFailed) return false;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    graphFailed = true;
    return false;
  }
  try {
    const element = ensureElement();
    ctx = new Ctor();
    const source = ctx.createMediaElementSource(element);
    master = ctx.createGain();
    master.gain.value = 0;
    source.connect(master);
    master.connect(ctx.destination);
    graphReady = true;
    return true;
  } catch {
    graphFailed = true;
    ctx = null;
    master = null;
    return false;
  }
}

// Already audible through the bare element: reroute into the graph at the same level.
function adoptGraph() {
  if (graphReady || graphFailed || !el) return;
  if (!ensureGraph() || !ctx || !master) return;
  el.volume = 1;
  master.gain.value = TARGET;
  void ctx.resume();
}

function start() {
  if (playing) return;
  const element = ensureElement();
  const hasGraph = gestured && ensureGraph();
  element.preload = "auto";
  if (hasGraph && ctx && master) {
    void ctx.resume();
    element.volume = 1;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(TARGET, ctx.currentTime, 0.4);
  } else {
    element.volume = TARGET;
  }
  const attempt = element.play();
  if (attempt)
    attempt.then(onPlaying).catch(() => {
      playing = false;
    });
  else onPlaying();
}

function stop() {
  playing = false;
  if (!el) return;
  const element = el;
  if (graphReady && ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, FADE_OUT);
  } else {
    element.volume = 0;
  }
  // setTargetAtTime is exponential: ~5 time constants is effectively silent.
  window.setTimeout(
    () => {
      if (enabled) return;
      element.pause();
      if (ctx && ctx.state === "running") void ctx.suspend();
    },
    FADE_OUT * 5000 + 50,
  );
}

function apply() {
  if (enabled && (gestured || pageReady)) start();
  else stop();
}

export function setMusicEnabled(on: boolean) {
  enabled = on;
  if (!on) disarm();
  apply();
}

// WebKit does not reliably accept touchstart-family events as media gestures, and
// a first play() can be refused while the codec loads. Stay armed across gesture
// kinds until playback actually begins, so music never needs a mute/unmute cycle.
const GESTURE_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

function disarm() {
  for (const event of GESTURE_EVENTS) window.removeEventListener(event, unlock);
}

function unlock() {
  gestured = true;
  if (playing) adoptGraph();
  apply();
  if ((playing && (graphReady || graphFailed)) || !enabled) disarm();
}

// The no-gesture attempt waits for the load event and an idle slot so the ~1.2 MB
// track never competes with the hero art and fonts for bandwidth.
function afterPageLoad(run: () => void) {
  const idle = () => {
    if (typeof window.requestIdleCallback === "function")
      window.requestIdleCallback(run, { timeout: 1500 });
    else window.setTimeout(run, 200);
  };
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}

export function armMusicGesture() {
  if (armed) return;
  armed = true;
  for (const event of GESTURE_EVENTS) window.addEventListener(event, unlock, { passive: true });
  afterPageLoad(() => {
    pageReady = true;
    if (enabled && !playing) apply();
  });
}
