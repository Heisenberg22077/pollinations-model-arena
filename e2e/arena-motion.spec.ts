import { expect, test } from "@playwright/test";
import { CORS, delay, fulfillChat, IDS, mockApp, observeMotion } from "./fixtures";

const diagnostics = (page: import("@playwright/test").Page) =>
  page.evaluate(async () => {
    // Inspect the application's own clock, independently of GSAP/ScrollTrigger internal listeners.
    const url = performance
      .getEntriesByType("resource")
      .find((entry) => entry.name.includes("/src/lib/arena-motion.ts"))?.name;
    if (!url) throw new Error("Motion runtime module was not loaded");
    const runtime = await import(url);
    return runtime.motionDiagnostics();
  });

test("pixel progress follows actual settlements and rests when paused", async ({ page }) => {
  await mockApp(page, {
    chat: async (route, request) => {
      await delay(900);
      await fulfillChat(route, request);
    },
  });
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  const trail = page.getByRole("list", { name: "Model progress", exact: true });
  await expect(trail.locator("li")).toHaveCount(6);
  await expect(trail.locator('li[data-status="pending"]')).not.toHaveCount(0);
  await expect(trail.locator('li[data-status="done"]')).toHaveCount(6);
  await page.getByRole("button", { name: "Pause animations", exact: true }).click();
  const moving = await trail.evaluate(
    (el) =>
      window.gsap?.getTweensOf([...el.querySelectorAll("span,i")]).some((t) => t.isActive()) ??
      false,
  );
  expect(moving).toBe(false);
  await expect(trail.locator('li[data-status="done"]')).toHaveCount(6);
});

test("lineup pixels respond directly after adding, removing and readding models", async ({
  page,
}) => {
  const state = await mockApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "gsap");
  const signal = page.locator(".model-signal");
  for (const preset of ["All models", "Core 6", "All models"]) {
    await page.getByRole("button", { name: preset, exact: true }).click();
    const count = preset === "Core 6" ? 6 : 13;
    await expect(signal.locator("i")).toHaveCount(count);
    await page.waitForTimeout(1000);
    await page.mouse.move(1, 1);
    const observed = await observeMotion(page, ".model-signal i");
    await signal.hover();
    expect(await observed()).toHaveLength(count);
  }
  expect(state.pageErrors).toEqual([]);
});

test("keyboard preset changes ripple the live lineup without hover", async ({ page }) => {
  await mockApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "gsap");
  const all = page.getByRole("button", { name: "All models", exact: true });
  await all.focus();
  const observed = await observeMotion(page, ".model-signal i");
  await all.press("Enter");
  await expect(page.locator(".model-signal i")).toHaveCount(13);
  expect(await observed()).toHaveLength(13);
});

test("preset additions stamp the newly selected model checks", async ({ page }) => {
  await mockApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "gsap");
  const observed = await observeMotion(page, ".extra-models .selection-check");
  await page.getByRole("button", { name: "All models", exact: true }).click();
  expect(await observed()).toEqual([0, 1, 2, 3, 4, 5, 6]);
});

test("starter questions arrive with feedback and remain immediately editable", async ({ page }) => {
  await mockApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "gsap");
  const chip = page.locator(".composer-chip").nth(1);
  await expect(chip).toBeVisible();
  await chip.focus();
  await expect(chip).toBeFocused();
  const observed = await observeMotion(page, ".question-input");
  await chip.press("Enter");
  await expect(page.locator("#prompt")).toHaveValue((await chip.getAttribute("aria-label")) ?? "");
  expect(await observed()).toEqual([0]);
  const sweep = await observeMotion(page, ".question-transfer i");
  await page.locator(".composer-chip").nth(2).click();
  expect(await sweep()).toHaveLength(12);
  await page.locator("#prompt").fill("My own question, without a delayed overwrite");
  await expect(page.locator("#prompt")).toHaveValue("My own question, without a delayed overwrite");
});

test("restored questions get the same arrival feedback and keep editor focus", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "model-table:recent:v1",
      JSON.stringify([
        {
          id: "saved-question",
          timestamp: 1,
          prompt: "Which invention would surprise a bee?",
          models: [{ id: "openai/gpt-5.4-nano", status: "done", latencyMs: 120, cost: 0.001 }],
        },
      ]),
    );
  });
  await mockApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "gsap");
  await page.locator(".recent-questions summary").click();
  const observed = await observeMotion(page, ".question-input");
  await page
    .getByRole("button", {
      name: "Restore recent question: Which invention would surprise a bee?",
      exact: true,
    })
    .click();
  await expect(page.locator("#prompt")).toHaveValue("Which invention would surprise a bee?");
  await expect(page.locator("#prompt")).toBeFocused();
  expect(await observed()).toEqual([0]);
});

test("copy success animates only after the clipboard accepts the answer", async ({ page }) => {
  await mockApp(page);
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  const card = page.locator(`article[data-model-id="${IDS[0]}"]`);
  await expect(card).toHaveAttribute("data-status", "done");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          new Promise<void>((resolve) => {
            window.__acceptCopy = resolve;
          }),
      },
    });
  });
  const copy = card.getByRole("button", { name: "Copy GPT-5.4 Nano answer", exact: true });
  const pending = await observeMotion(page, `article[data-model-id="${IDS[0]}"] .action-icon`);
  await copy.click();
  expect(await pending()).toEqual([]);
  const accepted = await observeMotion(page, `article[data-model-id="${IDS[0]}"] .action-icon`);
  await page.evaluate(() => window.__acceptCopy?.());
  await expect(copy).toHaveAttribute("title", "Copied");
  expect(await accepted()).toEqual([0]);
});

test("bulk copy waits for clipboard success before animating its check", async ({ page }) => {
  await mockApp(page);
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.locator('article[data-status="done"]')).toHaveCount(6);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          new Promise<void>((resolve) => {
            window.__acceptCopy = resolve;
          }),
      },
    });
  });
  const copy = page.getByRole("button", { name: "Copy as Markdown", exact: true });
  const selector = '.results-controls [aria-label="Copy as Markdown"] .action-icon';
  const pending = await observeMotion(page, selector);
  await copy.click();
  expect(await pending()).toEqual([]);
  const accepted = await observeMotion(page, selector);
  await page.evaluate(() => window.__acceptCopy?.());
  await expect(copy).toContainText("Copied");
  expect(await accepted()).toEqual([0]);
});

test("rapid lineup and prompt changes rest cleanly when motion is paused", async ({ page }) => {
  const state = await mockApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "gsap");
  for (const preset of ["All models", "Core 6", "All models"]) {
    await page.getByRole("button", { name: preset, exact: true }).dispatchEvent("click");
    await page.locator(".composer-chip").nth(2).dispatchEvent("click");
  }
  await page.getByRole("button", { name: "Pause animations", exact: true }).click();
  const observed = await observeMotion(
    page,
    ".model-signal i, .selection-check, .question-input, .question-transfer i",
  );
  await page.getByRole("button", { name: "Core 6", exact: true }).click();
  await page.locator(".composer-chip").first().click();
  expect(await observed()).toEqual([]);
  await expect(page.locator(".model-signal i")).toHaveCount(6);
  await page.getByRole("button", { name: "Resume animations", exact: true }).click();
  const resumed = await observeMotion(page, ".model-signal i");
  await page.getByRole("button", { name: "All models", exact: true }).click();
  expect(await resumed()).toHaveLength(13);
  expect(state.pageErrors).toEqual([]);
});

test("keeps one application clock through pause and media changes without leaking scene subscriptions", async ({
  page,
}) => {
  const state = await mockApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "gsap");
  await expect
    .poll(() => diagnostics(page))
    .toEqual({ clocks: 1, subscriptions: 2, smoothing: true, choreographed: true });
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Pause animations", exact: true }).click();
    await expect
      .poll(() => diagnostics(page))
      .toEqual({ clocks: 1, subscriptions: 0, smoothing: false, choreographed: false });
    await page.getByRole("button", { name: "Resume animations", exact: true }).click();
    await expect
      .poll(() => diagnostics(page))
      .toEqual({ clocks: 1, subscriptions: 2, smoothing: true, choreographed: true });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => diagnostics(page))
    .toEqual({ clocks: 1, subscriptions: 0, smoothing: false, choreographed: false });
  expect(state.pageErrors).toEqual([]);
});

test("settles rapid pixel-curtain reversals and a mid-transition pause without mobile overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockApp(page);
  await page.locator(".theme-button").dispatchEvent("click");
  await page.waitForTimeout(120);
  await expect(page.locator(".pixel-transition-grid")).toBeVisible();
  const geometry = await page.locator(".pixel-transition-matrix > i").evaluateAll((blocks) => ({
    count: blocks.length,
    square: blocks.every(
      (block) =>
        Math.abs(block.getBoundingClientRect().width - block.getBoundingClientRect().height) < 1,
    ),
    pageWidth: document.documentElement.scrollWidth,
  }));
  // Phones render an 8×8 curtain (64 blocks); desktop keeps 12×8.
  expect(geometry).toEqual({ count: 64, square: true, pageWidth: 390 });
  await page.locator(".theme-button").dispatchEvent("click");
  await page.waitForTimeout(90);
  await page.locator(".theme-button").dispatchEvent("click");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Pause animations", exact: true }).click();
  await expect(page.locator(".pixel-transition-grid")).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "night");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "night");
  expect(state.pageErrors).toEqual([]);
});

test("updates only dispatched request timers and preserves real final metrics when motion pauses", async ({
  page,
}) => {
  const state = await mockApp(page, {
    chat: async (route, request) => {
      await delay(1600);
      await fulfillChat(route, request);
    },
  });
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  const first = page.locator(`article[data-model-id="${IDS[0]}"]`);
  const later = page.locator(`article[data-model-id="${IDS[4]}"]`);
  await expect(first.locator(".live-stopwatch")).toContainText(/ms|s/);
  await expect(later.locator(".live-stopwatch")).toHaveCount(0);
  await expect(later.locator(".model-metrics")).toContainText("queued");
  await page.getByRole("button", { name: "Pause animations", exact: true }).click();
  const before = await first.locator(".live-stopwatch").textContent();
  await page.waitForTimeout(200);
  expect(await first.locator(".live-stopwatch").textContent()).not.toBe(before);
  await expect(page.locator('article[data-status="done"]')).toHaveCount(6);
  await expect(first.locator(".metric-value").nth(1).locator('[aria-hidden="true"]')).toHaveText(
    "0.0005",
  );
  await expect.poll(async () => (await diagnostics(page)).subscriptions).toBe(0);
  expect(state.pageErrors).toEqual([]);
});

test("remains readable and runs requests with native scrolling when the motion CDN is unavailable", async ({
  page,
}) => {
  const state = await mockApp(page, { motion: false });
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "native");
  await expect(page.getByRole("heading", { name: "One Question. Every Model." })).toBeVisible();
  await page.getByRole("button", { name: "All models", exact: true }).click();
  await expect(page.locator(".ghost-card")).toHaveCount(13);
  await page.getByRole("button", { name: "Switch to night mode", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "night");
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.locator('article[data-status="done"]')).toHaveCount(13);
  await expect(page.locator(".pixel-transition-grid")).not.toBeVisible();
  expect(state.pageErrors).toEqual([]);
  expect(state.consoleErrors).toEqual([]);
});

test("reveals the decoded blob image and keeps it usable when paused mid-mosaic", async ({
  page,
}) => {
  const state = await mockApp(page, {
    image: async (route) => {
      await delay(450);
      await route.fulfill({
        headers: { ...CORS, "x-usage-completion-image-tokens": "1" },
        path: "public/art/pollinations-garden-day.webp",
        contentType: "image/webp",
      });
    },
  });
  for (const name of [
    "GPT-5.4 Nano",
    "DeepSeek V4.1 Flash",
    "Llama 3.3 70B",
    "Grok 4.3",
    "GLM 5.3 Flash",
  ]) {
    await page.getByRole("button", { name, exact: true }).dispatchEvent("click");
  }
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  const card = page.locator(`article[data-model-id="${IDS[5]}"]`);
  const mosaic = card.locator(".image-mosaic");
  await expect(mosaic).toBeVisible();
  expect(
    await card.locator(".answer-image-viewport").evaluate((viewport) => {
      const image = viewport.querySelector("img");
      const canvas = viewport.querySelector("canvas");
      return (
        image?.src.startsWith("blob:") &&
        image.naturalWidth > 1 &&
        canvas?.width === Math.min(1024, image.naturalWidth)
      );
    }),
  ).toBe(true);
  await page.getByRole("button", { name: "Pause animations", exact: true }).dispatchEvent("click");
  await expect(mosaic).not.toBeVisible();
  const preview = card.getByRole("button", { name: "View FLUX.1 Schnell image", exact: true });
  await preview.focus();
  await preview.press("Enter");
  await expect(page.getByRole("dialog").locator("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toBeFocused();
  expect(state.pageErrors).toEqual([]);
});
