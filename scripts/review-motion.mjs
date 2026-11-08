import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { CORS, delay, fulfillChat, IDS, mockApp } from "../e2e/fixtures.ts";

// Authored fixtures only. Profiling is separate from screenshot/video capture.
const output = ".local/motion-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: "http://127.0.0.1:5173",
  viewport: { width: 1920, height: 1080 },
});
const page = await context.newPage();
const report = {
  dataSource: "Authored mock responses; no live API calls.",
  profiling:
    "Headless Chromium rAF samples with geometry instrumentation; no capture during timing.",
  profiles: [],
  captures: [],
  checks: {},
};

async function prepare(target) {
  const state = await mockApp(target, {
    chat: async (route, request) => {
      await delay(650);
      await fulfillChat(route, request);
    },
    image: async (route) => {
      await delay(800);
      await route.fulfill({
        headers: { ...CORS, "x-usage-completion-image-tokens": "1" },
        path: "public/art/pollinations-garden-day.webp",
        contentType: "image/webp",
      });
    },
  });
  await target.evaluate(() => document.fonts.ready);
  await target.waitForTimeout(1000);
  return state;
}

async function profile(name, selector, action, duration = 1000, pseudo) {
  await page.evaluate(
    ({ selector, duration, pseudo }) => {
      const capture = { frames: [], longTasks: [], animatedLayoutProperties: [], done: false };
      window.__motionCapture = capture;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) capture.longTasks.push(entry.duration);
      });
      observer.observe({ type: "longtask" });
      const start = performance.now();
      let previous = start;
      const sample = (now) => {
        for (const animation of document.getAnimations()) {
          if (!(animation.effect instanceof KeyframeEffect)) continue;
          for (const frame of animation.effect.getKeyframes()) {
            for (const property of Object.keys(frame)) {
              if (
                /^(width|height|left|right|top|bottom|padding|margin|clipPath)/.test(property) &&
                !capture.animatedLayoutProperties.includes(property)
              )
                capture.animatedLayoutProperties.push(property);
            }
          }
        }
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        const style = element && getComputedStyle(element, pseudo);
        capture.frames.push({
          at: now - start,
          interval: now - previous,
          x: rect?.x,
          y: rect?.y,
          width: rect?.width,
          height: rect?.height,
          layoutHeight: element?.offsetHeight,
          layoutWidth: element?.offsetWidth,
          opacity: style?.opacity,
          transform: style?.transform,
          translate: style?.translate,
        });
        previous = now;
        if (now - start < duration) requestAnimationFrame(sample);
        else {
          observer.disconnect();
          capture.done = true;
        }
      };
      requestAnimationFrame(sample);
    },
    { selector, duration, pseudo },
  );
  await action();
  await page.waitForFunction(() => window.__motionCapture.done);
  const capture = await page.evaluate(() => window.__motionCapture);
  const intervals = capture.frames.slice(1).map((frame) => frame.interval);
  const sorted = [...intervals].sort((a, b) => a - b);
  const result = {
    name,
    selector,
    samples: capture.frames.length,
    medianFrameMs: sorted[Math.floor(sorted.length * 0.5)],
    p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
    maxFrameMs: Math.max(...intervals),
    framesOver34Ms: intervals.filter((interval) => interval > 34).length,
    longTasks: capture.longTasks,
    animatedLayoutProperties: capture.animatedLayoutProperties,
    frames: capture.frames,
  };
  report.profiles.push(result);
  assert.deepEqual(result.animatedLayoutProperties, []);
  return result;
}

const distinct = (profile, property) =>
  new Set(profile.frames.map((frame) => frame[property]).filter((value) => value !== undefined))
    .size;

try {
  const state = await prepare(page);
  const preset = await profile("Interrupted preset spring", ".preset-highlight", async () => {
    await page.getByRole("button", { name: "Standard models", exact: true }).click();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "All models", exact: true }).click();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Core 6", exact: true }).click();
  });
  assert(distinct(preset, "x") > 4);
  assert(distinct(preset, "width") > 4);
  assert(distinct(preset, "layoutWidth") <= 3);
  const roster = await profile("Extra models transform spring", "#extra-models", () =>
    page.locator(".more-models-button").click(),
  );
  assert(distinct(roster, "transform") > 4);
  assert.equal(distinct(roster, "layoutHeight"), 1);
  const follow = await profile(
    "Results follow drawer through position projection",
    "#results",
    () => page.locator(".more-models-button").click(),
  );
  assert(distinct(follow, "transform") > 4);
  assert.equal(distinct(follow, "layoutHeight"), 1);
  await page.locator("#extra-models").waitFor({ state: "detached" });
  const toggle = page.locator(".model-toggle").first();
  const toggleHover = await profile("Model toggle hover spring", ".model-toggle", () =>
    toggle.hover(),
  );
  assert(distinct(toggleHover, "transform") > 4);
  assert.equal(distinct(toggleHover, "layoutHeight"), 1);
  const tap = await profile(
    "Model toggle press and checkmark spring",
    ".selection-check",
    async () => {
      await toggle.click();
      await page.waitForTimeout(100);
      await toggle.click();
    },
  );
  assert(distinct(tap, "transform") > 4);
  await page.mouse.move(10, 100);
  const dice = await profile("Interrupted surprise dice roll", ".surprise-button svg", async () => {
    await page.getByRole("button", { name: "Surprise me", exact: true }).click();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Surprise me", exact: true }).click();
  });
  assert(distinct(dice, "transform") > 4);
  const starter = page.locator(".composer-chip").first();
  const starterHover = await profile("Starter prompt hover spring", ".composer-chip", () =>
    starter.hover(),
  );
  assert(distinct(starterHover, "transform") > 4);
  const starterTap = await profile("Starter prompt tap compression", ".composer-chip", async () => {
    await page.mouse.down();
    await page.waitForTimeout(180);
    await page.mouse.up();
  });
  assert(distinct(starterTap, "transform") > 4);
  assert.equal(distinct(starterTap, "layoutHeight"), 1);
  await page.locator(".brand-link").focus();
  await page.waitForTimeout(500);
  const glow = await profile(
    "Composer focus glow",
    ".question-band",
    () => page.getByRole("textbox", { name: "Your question", exact: true }).focus(),
    1000,
    "::before",
  );
  assert(distinct(glow, "opacity") > 4);
  assert(distinct(glow, "transform") > 4);
  await page.getByRole("textbox", { name: "Your question", exact: true }).blur();
  const brand = await profile("Brand spring wobble", ".brand-symbol", () =>
    page.locator(".brand-link").hover(),
  );
  assert(distinct(brand, "transform") > 4);
  const theme = await profile("Theme icon spring flip", ".theme-icon", () =>
    page.getByRole("button", { name: "Switch to night mode", exact: true }).click(),
  );
  assert(distinct(theme, "transform") > 4);
  await page.getByRole("button", { name: "Switch to day mode", exact: true }).click();
  await page.waitForTimeout(500);
  const guide = await profile("Guide transform spring", "#how .disclosure-body", () =>
    page.getByRole("button", { name: "How it works", exact: true }).click(),
  );
  assert(distinct(guide, "transform") > 4);
  assert.equal(distinct(guide, "layoutHeight"), 1);
  const guideControl = page.locator("#how > summary");
  await profile("Interrupted guide spring", "#how .disclosure-body", async () => {
    await guideControl.focus();
    for (let index = 0; index < 3; index++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(80);
    }
  });
  assert.equal(await guideControl.getAttribute("aria-expanded"), "false");

  await profile(
    "Pending request wave and pane arrivals",
    ".pending-pixels span",
    async () => {
      await page.getByRole("button", { name: "Run the table", exact: true }).click();
    },
    2500,
  );
  await page.waitForFunction(
    () => document.querySelectorAll('article[data-status="done"]').length === 6,
  );
  const history = page.locator(".recent-questions summary");
  await profile("Recent question popover", ".history-popover", () => history.click());
  await profile("Interrupted recent question popover", ".history-popover", async () => {
    await history.focus();
    for (let index = 0; index < 3; index++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(80);
    }
  });
  assert.equal(await history.getAttribute("aria-expanded"), "false");

  const metrics = page.getByRole("button", { name: "Compare metrics", exact: true });
  const metricsMotion = await profile("Metrics transform spring", ".metrics-reveal", () =>
    metrics.click(),
  );
  assert(distinct(metricsMotion, "transform") > 4);
  assert.equal(distinct(metricsMotion, "layoutHeight"), 1);
  await profile("Interrupted metrics spring", ".metrics-reveal", async () => {
    await metrics.focus();
    for (let index = 0; index < 3; index++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(80);
    }
  });
  assert.equal(await metrics.getAttribute("aria-expanded"), "false");

  const card = page.locator(`article[data-model-id="${IDS[0]}"]`);
  const copyControl = card.getByRole("button", { name: "Copy GPT-5.4 Nano answer", exact: true });
  const copy = await profile(
    "Copy action keyboard spring feedback",
    `article[data-model-id="${IDS[0]}"] .action-icon`,
    async () => {
      await copyControl.focus();
      await page.keyboard.down("Enter");
      await page.waitForTimeout(180);
      await page.keyboard.up("Enter");
    },
  );
  assert(distinct(copy, "transform") > 4);
  const body = card.locator(".answer-body");
  const baseline = await body.evaluate((element) => element.getBoundingClientRect().height);
  const expand = card.getByRole("button", { name: "Expand", exact: true });
  const answer = await profile(
    "Interrupted answer expansion",
    `article[data-model-id="${IDS[0]}"] .answer-copy`,
    async () => {
      await expand.focus();
      for (let index = 0; index < 4; index++) {
        await page.keyboard.press("Enter");
        await page.waitForTimeout(80);
      }
    },
    1200,
  );
  assert(distinct(answer, "opacity") > 4);
  assert(distinct(answer, "layoutHeight") <= 2);
  assert.equal(await body.evaluate((element) => element.getBoundingClientRect().height), baseline);
  report.checks.answerHeightRestored = baseline;

  await page.mouse.move(10, 100);
  const hover = await profile("Model card hover", `article[data-model-id="${IDS[0]}"]`, () =>
    card.locator("h3").hover(),
  );
  assert(distinct(hover, "y") > 4);
  await page.mouse.move(10, 100);
  const image = page.locator(".answer-image-trigger");
  const imageMotion = await profile("Generated image hover", ".answer-image img", () =>
    image.hover(),
  );
  assert(distinct(imageMotion, "transform") > 4);
  await image.click();
  assert(await page.getByRole("dialog").isVisible());
  await page.keyboard.press("Escape");
  assert(await image.evaluate((element) => element === document.activeElement));
  report.checks.imageClickAndFocusReturn = true;

  await page.evaluate(() => window.scrollTo(0, 0));
  const scene = page.locator(".garden-scene-hero");
  const bounds = await scene.boundingBox();
  const pointer = await profile(
    "Garden pointer spring",
    ".garden-scene-hero .garden-pointer",
    async () => {
      await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.75);
      await page.waitForTimeout(160);
      await page.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * 0.3);
      await page.waitForTimeout(160);
      await page.mouse.move(10, 100);
    },
    1400,
  );
  assert(distinct(pointer, "transform") > 8);
  const scroll = await profile(
    "Native garden scroll movement",
    ".garden-scene-hero .garden-scroll",
    async () => {
      await page.evaluate(() => window.scrollTo({ top: 300, behavior: "smooth" }));
    },
  );
  report.checks.scrollTimelineSupported = await page.evaluate(() =>
    CSS.supports("animation-timeline", "view()"),
  );
  if (report.checks.scrollTimelineSupported) assert(distinct(scroll, "transform") > 4);
  await page.locator(".garden-banner").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  assert.equal(await scene.getAttribute("data-scene-visible"), "false");
  report.checks.offscreenGardenPaused = true;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  const menuMotion = await profile("Mobile menu opening", ".mobile-navigation", () => menu.click());
  assert(distinct(menuMotion, "opacity") > 4);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator(".header-account .motion-button").click();
  await page.waitForFunction(() => document.documentElement.dataset.motion === "off");
  report.checks.pausedActiveAnimations = await page.evaluate(() => document.getAnimations().length);
  assert.equal(report.checks.pausedActiveAnimations, 0);
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.motion === "off");
  assert(await page.getByRole("button", { name: "Resume animations", exact: true }).isVisible());
  report.checks.pauseSurvivesReload = true;
  await page.getByRole("button", { name: "Resume animations", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.documentElement.dataset.motion === "off");
  report.checks.reducedMotionActiveAnimations = await page.evaluate(
    () => document.getAnimations().length,
  );
  assert.equal(report.checks.reducedMotionActiveAnimations, 0);
  report.checks.errors = [...state.consoleErrors, ...state.pageErrors];
  assert.deepEqual(report.checks.errors, []);

  // Fresh context: captures cannot skew the timing pass above.
  const visualContext = await browser.newContext({
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: output, size: { width: 1920, height: 1080 } },
  });
  const visual = await visualContext.newPage();
  const video = visual.video();
  await prepare(visual);
  await visual.getByRole("button", { name: "Run the table", exact: true }).click();
  await visual.waitForFunction(
    () => document.querySelectorAll('article[data-status="done"]').length === 6,
  );
  await visual.waitForTimeout(600);
  const captures = [
    ["garden-pointer", () => visual.locator(".garden-scene-hero").hover()],
    ["card-hover", () => visual.locator("article h3").first().hover()],
    ["image-hover", () => visual.locator(".answer-image-trigger").hover()],
    ["roster-drawer", () => visual.locator(".more-models-button").click()],
    ["roster-close", () => visual.locator(".more-models-button").click()],
    ["dice", () => visual.getByRole("button", { name: "Surprise me", exact: true }).click()],
    ["focus", () => visual.getByRole("textbox", { name: "Your question", exact: true }).focus()],
    ["guide", () => visual.getByRole("button", { name: "How it works", exact: true }).click()],
    ["metrics", () => visual.getByRole("button", { name: "Compare metrics", exact: true }).click()],
  ];
  for (const [name, action] of captures) {
    await visual.mouse.move(10, 100);
    const start = await visual.evaluate(() => performance.now());
    await action();
    for (const [index, wait] of [0, 100, 450].entries()) {
      if (wait) await visual.waitForTimeout(wait);
      const elapsed = (await visual.evaluate(() => performance.now())) - start;
      const path = `${output}/${name}-${index}.png`;
      await visual.screenshot({ path });
      report.captures.push({ name, elapsedMs: elapsed, path, viewport: "1920×1080" });
    }
  }
  await visual.getByRole("button", { name: "Compare metrics", exact: true }).click();
  await visual.getByRole("button", { name: "Switch to night mode", exact: true }).click();
  await visual.getByRole("button", { name: "Switch to day mode", exact: true }).waitFor();
  await visual.waitForTimeout(650);
  await visual.locator(".garden-banner").scrollIntoViewIfNeeded();
  await visual.waitForTimeout(800);
  await visual.screenshot({ path: `${output}/garden-ending.png` });
  await visualContext.close();
  if (video) await video.saveAs(`${output}/interactions-1080p.webm`);

  const contact = await context.newPage();
  await contact.setViewportSize({ width: 1920, height: 1190 });
  const picked = [
    "garden-pointer-0",
    "garden-pointer-2",
    "card-hover-0",
    "card-hover-2",
    "image-hover-0",
    "image-hover-2",
  ];
  const images = await Promise.all(
    picked.map(async (name) => ({
      name,
      data: (await readFile(`${output}/${name}.png`)).toString("base64"),
    })),
  );
  await contact.setContent(
    `<style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#d8cfc0;color:#272117;font:16px monospace}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}figure{margin:0}img{display:block;width:100%;border:1px solid #8c816f}figcaption{padding:6px}</style><div class="grid">${images.map(({ name, data }) => `<figure><figcaption>${name}: authored fixture / 1080p original</figcaption><img src="data:image/png;base64,${data}"></figure>`).join("")}</div>`,
  );
  await contact.screenshot({ path: `${output}/contact-sheet.png`, fullPage: true });
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}

console.log(
  JSON.stringify(
    {
      checks: report.checks,
      profiles: report.profiles.map(
        ({ name, samples, medianFrameMs, p95FrameMs, maxFrameMs, framesOver34Ms, longTasks }) => ({
          name,
          samples,
          medianFrameMs,
          p95FrameMs,
          maxFrameMs,
          framesOver34Ms,
          longTasks,
        }),
      ),
      evidence: output,
    },
    null,
    2,
  ),
);
