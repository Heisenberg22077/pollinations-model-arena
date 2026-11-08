import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { CORS, delay, fulfillChat, IDS, mockApp } from "../e2e/fixtures.ts";

// These are authored QA fixtures, never saved as the README's live screenshots.
const question = "A goose becomes CEO of a startup. What is its first company-wide memo?";
const answers = [
  "Team, we are adopting a strict bread-first strategy. Meetings move to the pond, your quarterly goals are now honk-based, and anyone who says ‘circle back’ must physically circle the lake.\n\nOur mission remains simple: find the crumbs the competition missed. No one flies south until the product ships.\n\nThe company picnic is now our largest acquisition opportunity. Legal has asked me to stop referring to customers as bread dispensers. I will review that request after lunch.\n\nPlease update your status before leaving the pond. ‘Floating’ counts as available; ‘hissing at a bicycle’ means do not disturb.",
  "Subject: A new era of aggressive pond expansion\n\nWe have three priorities: protect the nest, improve breadcrumb conversion, and establish territorial dominance over the picnic market.\n\nAll-hands meetings are now all-wings. Bring your own bread; the seed round has been eaten.",
  "Effective immediately, the office dress code is feathers. Performance will be measured by the volume of your honk and your ability to look productive while floating.\n\nThe company retreat will be a migration. HR asks you to stop biting visitors; Sales has requested an exception.",
  "Congratulations: the org chart is now a V formation.\n\nI have reviewed our runway and can confirm that it is a literal runway. We are pivoting from artificial intelligence to natural intimidation.\n\nThe new corporate values are loyalty, initiative, and biting anyone who approaches the nest.",
  "Team, our greatest asset is the flock. From today, no employee migrates alone.\n\nReplace ‘disruption’ with ‘splashing’ in all presentations. The CEO office is the patch of grass nearest the pond.\n\nThe catering budget has been doubled. This is unrelated to my personal interest in breadcrumbs.",
];

const output = ".local/visual-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: "http://127.0.0.1:5173",
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: output, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
const video = page.video();
const report = {
  dataSource: "Authored mock responses. The image is a local garden fixture. No live API calls.",
  desktop: undefined,
  widths: [],
  motion: {},
  keyboard: {},
  errors: [],
};

try {
  const state = await mockApp(page, {
    chat: async (route, request) => {
      await delay(1200);
      const answer = answers[IDS.indexOf(request.model)] ?? "A model answer fixture.";
      await fulfillChat(route, request, { choices: [{ message: { content: answer } }] });
    },
    image: async (route) => {
      await delay(1200);
      await route.fulfill({
        headers: { ...CORS, "x-usage-completion-image-tokens": "1" },
        contentType: "image/webp",
        body: await readFile("public/art/pollinations-garden-day.webp"),
      });
    },
  });
  await page.evaluate(() => document.fonts.ready);
  for (const time of [60, 300, 900]) {
    await page.waitForTimeout(time === 60 ? 60 : time === 300 ? 240 : 600);
    await page.screenshot({ path: `${output}/headline-${time}ms.png` });
  }
  await page.getByRole("textbox", { name: "Your question", exact: true }).fill(question);
  await page.screenshot({ path: `${output}/desktop-empty.png`, animations: "disabled" });
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await page.screenshot({ path: `${output}/desktop-pending.png` });
  await page.waitForFunction(
    () => document.querySelectorAll('article[data-status="done"]').length === 6,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/desktop-day.png`, animations: "disabled" });
  report.desktop = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    pageHeight: document.documentElement.scrollHeight,
    mainWidth: document.querySelector("main").getBoundingClientRect().width,
    cards: [...document.querySelectorAll("article")].map((card) => {
      const box = card.getBoundingClientRect();
      const answer = card.querySelector(".answer-body").getBoundingClientRect();
      return {
        id: card.dataset.modelId,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        answerHeight: answer.height,
        answerFont: getComputedStyle(
          card.querySelector(".answer-copy") ?? card.querySelector("figcaption"),
        ).fontSize,
      };
    }),
  }));
  assert.equal(new Set(report.desktop.cards.map((card) => card.y)).size, 1);
  assert.equal(report.desktop.cards.length, 6);
  assert(report.desktop.cards.every((card) => card.answerHeight >= 300));
  assert(report.desktop.cards.every((card) => card.y + card.height <= 1080));

  await page.locator(".garden-banner").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${output}/desktop-garden-day.png`, animations: "disabled" });
  await page.evaluate(() => window.scrollTo(0, 0));

  const sort = page.getByRole("combobox", { name: "Sort results", exact: true });
  await sort.selectOption("provider");
  report.motion.sort = await page.evaluate(() => {
    window.__reviewAnimations = document.querySelector(".comparison-grid").getAnimations();
    for (const animation of window.__reviewAnimations) {
      animation.pause();
      animation.currentTime = 0;
    }
    return window.__reviewAnimations.map((animation) => ({
      duration: animation.effect.getTiming().duration,
      easing: animation.effect.getTiming().easing,
      frames: animation.effect
        .getKeyframes()
        .map((frame) => ({ opacity: frame.opacity, transform: frame.transform })),
    }));
  });
  assert(report.motion.sort.length > 0, "Sorting should provide a short continuity transition.");
  const sortedGeometry = await page.locator("article").evaluateAll((cards) =>
    cards.map((card) => ({
      id: card.dataset.modelId,
      x: card.getBoundingClientRect().x,
      y: card.getBoundingClientRect().y,
    })),
  );
  for (const time of [0, 90, 180]) {
    await page.evaluate((time) => {
      for (const animation of window.__reviewAnimations) animation.currentTime = time;
    }, time);
    await page.screenshot({ path: `${output}/sort-${time}ms.png` });
    assert.deepEqual(
      await page.locator("article").evaluateAll((cards) =>
        cards.map((card) => ({
          id: card.dataset.modelId,
          x: card.getBoundingClientRect().x,
          y: card.getBoundingClientRect().y,
        })),
      ),
      sortedGeometry,
      "Sorting must never move answer text across adjacent panes.",
    );
  }
  await page.evaluate(() => {
    for (const animation of window.__reviewAnimations) animation.finish();
  });
  await sort.selectOption("roster");
  await page.evaluate(async () => {
    await Promise.all(
      document
        .querySelector(".comparison-grid")
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    );
  });

  const run = page.getByRole("button", { name: "Run the table", exact: true });
  await run.hover();
  await page.screenshot({ path: `${output}/run-hover.png` });
  await page.mouse.move(30, 100);
  const surprise = page.getByRole("button", { name: "Surprise me", exact: true });
  await surprise.hover();
  await page.screenshot({ path: `${output}/surprise-hover.png` });
  await page.waitForTimeout(480);
  assert.equal(await surprise.locator(".scramble-label").textContent(), "Surprise me");
  await surprise.click();
  report.motion.surprise = await surprise
    .locator("svg")
    .evaluate((icon) =>
      icon.getAnimations().map((animation) => animation.effect.getTiming().duration),
    );
  await page.getByRole("textbox", { name: "Your question", exact: true }).fill(question);

  const imageTrigger = page
    .locator(`article[data-model-id="${IDS[5]}"]`)
    .getByRole("button", { name: "Expand", exact: true });
  await imageTrigger.click();
  await page.screenshot({ path: `${output}/image-dialog.png`, animations: "disabled" });
  await page.keyboard.press("Tab");
  report.keyboard.dialogFocusContained = await page
    .getByRole("dialog")
    .evaluate((dialog) => dialog.contains(document.activeElement));
  assert(report.keyboard.dialogFocusContained);
  await page.keyboard.press("Escape");
  report.keyboard.dialogFocusReturned = await imageTrigger.evaluate(
    (button) => button === document.activeElement,
  );
  assert(report.keyboard.dialogFocusReturned);

  await page.getByRole("button", { name: "Switch to night mode", exact: true }).click();
  await page.screenshot({ path: `${output}/desktop-night.png`, animations: "disabled" });
  await page.locator(".garden-banner").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${output}/desktop-garden-night.png`, animations: "disabled" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Switch to day mode", exact: true }).click();

  const metrics = page.getByRole("button", { name: "Compare metrics", exact: true });
  await metrics.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${output}/desktop-metrics.png`, animations: "disabled" });
  await page.getByRole("table").locator("tbody tr").nth(2).hover();
  await page.screenshot({ path: `${output}/metrics-hover.png` });
  await metrics.click();
  await page.waitForTimeout(700);

  for (const width of [320, 390, 768, 1024, 1440, 1680, 1920]) {
    await page.setViewportSize({ width, height: width >= 1680 ? 1080 : 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      content: document.documentElement.scrollWidth,
      columns: getComputedStyle(
        document.querySelector(".comparison-grid"),
      ).gridTemplateColumns.split(" ").length,
      runCount: [...document.querySelectorAll("button")].filter(
        (button) => button.getAttribute("aria-label") === "Run the table",
      ).length,
    }));
    assert.equal(geometry.width, geometry.content);
    assert.equal(geometry.runCount, 1);
    report.widths.push(geometry);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/phone-composer.png`, animations: "disabled" });
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.focus();
  await page.keyboard.press("Enter");
  await page.screenshot({ path: `${output}/phone-menu.png`, animations: "disabled" });
  assert(await page.getByRole("navigation", { name: "Mobile navigation" }).isVisible());
  await page.keyboard.press("Escape");
  assert(await menu.evaluate((button) => button === document.activeElement));
  await page.locator("#results").evaluate((results) => results.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: `${output}/phone-answers.png`, animations: "disabled" });
  await metrics.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${output}/phone-metrics.png`, animations: "disabled" });
  await metrics.click();
  await page.waitForTimeout(700);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await sort.selectOption("provider");
  await surprise.click();
  report.motion.reducedMotionActiveAnimations = await page.evaluate(
    () => document.getAnimations().filter((animation) => animation.playState === "running").length,
  );
  assert.equal(report.motion.reducedMotionActiveAnimations, 0);
  report.errors = [
    ...state.consoleErrors,
    ...state.pageErrors,
    ...(await page.evaluate(() => window.__unhandledRejections ?? [])),
  ];
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await context.close();
  if (video) await video.saveAs(`${output}/desktop-interactions.webm`);
  await browser.close();
}
console.log(`Mocked 1080p, phone, motion-frame and video review saved to ${output}`);
console.log(JSON.stringify(report, null, 2));
