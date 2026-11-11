// Background music: the user's own recording, trimmed to a 90s loop and self-hosted in
// three web codecs. The player picks the best one the browser truly supports — Opus (WebM)
// where it reports full support, AAC (M4A) on Apple/legacy, MP3 as the universal floor —
// and falls back to the next codec if a source fails to decode. Playback unlocks on the
// first real user gesture (autoplay policy); one master mute in sound.ts fades it out.

const TARGET = 0.6;

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

function handleError() {
  if (el && sourceIndex < sources.length - 1) {
    sourceIndex += 1;
    el.src = sources[sourceIndex];
    if (enabled && gestured) {
      el.preload = "auto";
      const attempt = el.play();
      if (attempt) attempt.then(() => (playing = true)).catch(() => {});
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

function start() {
  if (playing) return;
  const element = ensureElement();
  const hasGraph = ensureGraph();
  element.preload = "auto";
  if (hasGraph && ctx && master) {
    void ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(TARGET, ctx.currentTime, 0.4);
  } else {
    element.volume = TARGET;
  }
  const attempt = element.play();
  if (attempt) attempt.then(() => (playing = true)).catch(() => {});
  else playing = true;
}

function stop() {
  playing = false;
  if (!el) return;
  const element = el;
  if (graphReady && ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.18);
  } else {
    element.volume = 0;
  }
  window.setTimeout(() => {
    if (enabled) return;
    element.pause();
    if (ctx && ctx.state === "running") void ctx.suspend();
  }, 260);
}

function apply() {
  if (enabled && gestured) start();
  else stop();
}

export function setMusicEnabled(on: boolean) {
  enabled = on;
  apply();
}

const unlock = () => {
  gestured = true;
  apply();
  window.removeEventListener("pointerdown", unlock);
  window.removeEventListener("keydown", unlock);
};

export function armMusicGesture() {
  if (armed) return;
  armed = true;
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}
