import { expect, test } from "@playwright/test";
import {
  BEE_LINES,
  type BeeTrigger,
  beeFamily,
  beeReadTime,
  createBeeDialogue,
} from "../src/lib/bee-dialogue";

test("dialogue metadata is unique, short, factual and session bounded", () => {
  expect(new Set(BEE_LINES.map((l) => l.id)).size).toBe(BEE_LINES.length);
  expect(BEE_LINES.length).toBeGreaterThanOrEqual(80);
  expect(BEE_LINES.length).toBeLessThanOrEqual(120);
  for (const line of BEE_LINES) {
    expect(line.text.length).toBeLessThanOrEqual(64);
    expect(beeReadTime(line.text)).toBeGreaterThanOrEqual(3);
    expect(beeReadTime(line.text)).toBeLessThanOrEqual(6);
    expect(line.text).not.toMatch(/\b(?:429|NaN|hallucinated|SOTA|\d+(?:\.\d+)?s|\d+ tokens)\b/);
    if (line.trigger === "fastest") expect(line.text).toMatch(/fastest|first|speed/i);
    if (line.trigger === "cheap") expect(line.text).toMatch(/cost/i);
  }
});

test("deterministic choices exhaust fresh boop lines and avoid boundary repetition", () => {
  const d = createBeeDialogue(false, () => 0);
  const ids: string[] = [];
  for (let i = 0; i < 18; i++) {
    d.request("boop", {}, i * 10, true);
    const speech = d.tick(i * 10 + 0.3);
    expect(speech).toBeDefined();
    if (speech) ids.push(speech.line.id);
  }
  const count = BEE_LINES.filter((l) => l.trigger === "boop").length;
  expect(new Set(ids.slice(0, count)).size).toBe(count);
  ids.forEach((id, i) => {
    if (i) expect(id).not.toBe(ids[i - 1]);
  });
  expect(d.diagnostics.recent).toBeLessThanOrEqual(8);
});

test("hold, cooldown and touch floor survive urgent priority and clustered arrivals", () => {
  const d = createBeeDialogue(true, () => 0);
  d.request("run", {}, 0);
  const run = d.tick(0.3);
  expect(run?.line.trigger).toBe("run");
  for (let i = 0; i < 50; i++) d.request("response", {}, 0.5 + i * 0.01);
  expect(d.diagnostics.queued).toBe(1);
  expect(d.tick(1)).toBeUndefined();
  d.request("error", {}, 1);
  expect(d.tick(2.7)).toBeUndefined();
  const error = d.tick(2.81);
  expect(error?.line.trigger).toBe("error");
  expect(d.tick(4.6)).toBeUndefined();
  d.request("boop", {}, 6, true);
  expect(d.tick(6.3)).toBeUndefined();
  const ready = Math.max(error?.until ?? 0, (error?.at ?? 0) + 4.5);
  expect(d.tick(ready - 0.01)).toBeUndefined();
  expect(d.tick(ready + 0.01)?.line.trigger).toBe("boop");
});

test("expiry, deduplication and queue caps discard stale contextual events", () => {
  const d = createBeeDialogue(false, () => 0);
  d.request("model", { name: "GPT", family: "gpt" }, 0, false, "hover");
  expect(d.tick(2)).toBeUndefined();
  for (let i = 0; i < 100; i++) d.request("response", {}, 3 + i * 0.001, false, `response-${i}`);
  expect(d.diagnostics.queued).toBe(4);
  d.request("error", {}, 4);
  expect(d.tick(4.3)?.line.trigger).toBe("error");
  expect(d.tick(20)).toBeUndefined();
  expect(d.diagnostics.queued).toBe(0);
});

test("missing facts and unknown families stay safe; callbacks require previous actions", () => {
  expect(beeFamily("NotGPT secret family")).toBeUndefined();
  expect(beeFamily("GPT-5.4 Nano")).toBe("gpt");
  const d = createBeeDialogue(false, () => 0);
  d.request("fastest", {}, 0);
  d.request("cheap", {}, 0);
  expect(d.diagnostics.queued).toBe(0);
  d.request("model", { name: "Unknown model" }, 0);
  expect(d.tick(0.3)?.text).toContain("Unknown model");
  d.request("boop-repeat", { count: 1 }, 10, true);
  expect(d.tick(10.3)).toBeUndefined();
  d.request("boop-repeat", { count: 2 }, 20, true);
  expect(d.tick(20.3)?.line.callback).toBe("boop");
});

test("response expiry cannot be prolonged indefinitely; clear/reset remove state", () => {
  const d = createBeeDialogue(false, () => 0);
  d.request("response", {}, 0);
  for (let i = 1; i <= 5; i++) d.request("response", {}, i);
  expect(d.tick(6.1)).toBeUndefined();
  d.request("boop", {}, 7, true);
  d.tick(7.3);
  d.request("error", {}, 8);
  d.clearPending();
  expect(d.current?.line.trigger).toBe("boop");
  expect(d.diagnostics.queued).toBe(0);
  d.reset();
  expect(d.current).toBeUndefined();
  expect(d.diagnostics).toEqual({ queued: 0, recent: 0, triggers: 0 });
});

test("intentional badge inspection keeps reading cadence after an automatic award", () => {
  const d = createBeeDialogue(true, () => 0);
  d.request("cheap", { name: "A model" }, 0);
  expect(d.tick(0.3)?.line.trigger).toBe("cheap");
  d.request("cheap", { name: "A model" }, 1, false, "hover");
  expect(d.tick(2)).toBeUndefined();
  expect(d.tick(4.81)?.line.trigger).toBe("cheap");
});

test("every explicit action bank can answer repeatedly without adjacent repeats", () => {
  for (const trigger of [
    "select",
    "deselect",
    "preset-core",
    "preset-free",
    "preset-all",
    "surprise",
    "starter",
    "copy",
    "export",
  ] as BeeTrigger[]) {
    const d = createBeeDialogue(false, () => 0);
    let previous: string | undefined;
    for (let i = 0; i < 12; i++) {
      d.request(trigger, { name: "A model" }, i * 10, true, "action");
      const speech = d.tick(i * 10 + 0.3);
      expect(speech?.line.trigger).toBe(trigger);
      expect(speech?.line.id).not.toBe(previous);
      previous = speech?.line.id;
    }
  }
});

test("a new explicit action replaces old context and can overtake ambient after the reading floor", () => {
  const d = createBeeDialogue(true, () => 0);
  d.request("idle", {}, 0);
  const idle = d.tick(0.3);
  d.request("preset-all", {}, 1, true, "action");
  d.request("surprise", {}, 6.9, true, "action");
  expect(d.tick(7)).toBeUndefined();
  expect(d.tick(7.2)?.line.trigger).toBe("surprise");
  expect(d.diagnostics.queued).toBe(0);
  const early = createBeeDialogue(false, () => 0);
  early.request("idle", {}, 0);
  early.tick(0.3);
  early.request("select", { name: "A model" }, 1, true, "action");
  expect(early.tick(2)).toBeUndefined();
  expect(early.tick(3.11)?.line.trigger).toBe("select");
  expect(idle?.line.trigger).toBe("idle");
});
