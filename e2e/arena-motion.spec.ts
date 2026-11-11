import { expect, test } from "@playwright/test";
import { CORS, delay, fulfillChat, IDS, mockApp } from "./fixtures";

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
