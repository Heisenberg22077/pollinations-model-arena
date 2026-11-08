import { expect, test } from "@playwright/test";
import { IDS, TOKEN_STORAGE } from "./fixtures";

test.skip(
  !process.env.POLLINATIONS_TEST_KEY,
  "Set POLLINATIONS_TEST_KEY for opt-in live API checks.",
);

test("live core table settles six successful cards within 30 seconds", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  const responses: Promise<void>[] = [];
  const usageByModel = new Map<
    string,
    {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
      prompt_tokens_details?: { cached_tokens?: number };
    }
  >();
  const prices = new Map<string, Record<string, string>>();
  let imageTokens: number | undefined;
  page.on("pageerror", (error) =>
    errors.push(error.message.replace(/(sk_|ghp_)[A-Za-z0-9_-]{16,}/g, "[REDACTED]")),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      errors.push(message.text().replace(/(sk_|ghp_)[A-Za-z0-9_-]{16,}/g, "[REDACTED]"));
  });
  page.on("response", (response) => {
    if (!response.url().startsWith("https://gen.pollinations.ai/")) return;
    responses.push(
      (async () => {
        if (response.url().endsWith("/models")) {
          const models: { name: string; pricing?: Record<string, string> }[] =
            await response.json();
          for (const model of models) if (model.pricing) prices.set(model.name, model.pricing);
        } else if (response.url().includes("/v1/chat/completions") && response.ok()) {
          const request: { model: string } = response.request().postDataJSON();
          const json = await response.json();
          usageByModel.set(request.model, json.usage);
        } else if (response.url().includes("/image/") && response.ok()) {
          imageTokens = Number(await response.headerValue("x-usage-completion-image-tokens"));
        }
      })(),
    );
  });
  await page.addInitScript(
    ({ storage, key }) => {
      sessionStorage.setItem(storage, key);
      window.__unhandledRejections = [];
      window.addEventListener("unhandledrejection", (event) =>
        window.__unhandledRejections?.push(String(event.reason)),
      );
    },
    { storage: TOKEN_STORAGE, key: process.env.POLLINATIONS_TEST_KEY ?? "" },
  );
  await page.goto("/", { waitUntil: "networkidle" });
  const run = page.getByRole("button", { name: "Run the table", exact: true });
  await expect(run).toBeEnabled();
  await page
    .getByRole("textbox", { name: "Your question", exact: true })
    .fill("A goose becomes CEO of a startup. What is its first company-wide memo?");
  const started = Date.now();
  await run.click();
  await expect(page.locator('article[data-status="done"]')).toHaveCount(6, { timeout: 125_000 });
  await expect(run).toBeEnabled();
  const wallClockMs = Date.now() - started;
  expect(wallClockMs).toBeLessThanOrEqual(30_000);
  await Promise.all(responses);
  for (const [id, usage] of usageByModel) {
    const pricing = prices.get(id);
    expect(pricing).toBeDefined();
    const prompt = usage.prompt_tokens ?? 0;
    const completion = usage.completion_tokens ?? 0;
    const reasoning = usage.completion_tokens_details?.reasoning_tokens ?? 0;
    const billed =
      reasoning > 0 && usage.total_tokens === prompt + completion + reasoning
        ? completion + reasoning
        : completion;
    const cached = Math.min(prompt, usage.prompt_tokens_details?.cached_tokens ?? 0);
    const expected =
      (prompt - cached) * Number(pricing?.promptTextTokens ?? 0) +
      cached * Number(pricing?.promptCachedTokens ?? pricing?.promptTextTokens ?? 0) +
      billed * Number(pricing?.completionTextTokens ?? 0);
    const actual = Number(
      await page.locator(`article[data-model-id="${id}"]`).getAttribute("data-cost"),
    );
    expect(actual).toBeCloseTo(expected, 10);
  }
  expect(
    Number(await page.locator(`article[data-model-id="${IDS[5]}"]`).getAttribute("data-cost")),
  ).toBeCloseTo((imageTokens ?? 0) * Number(prices.get(IDS[5])?.completionImageTokens), 10);
  await expect
    .poll(() =>
      page
        .locator(".answer-image img")
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
  console.log(
    "Live core: 6/6 done in " +
      (wallClockMs / 1000).toFixed(2) +
      "s; all prices matched live usage.",
  );
  if (process.env.POLLINATIONS_CAPTURE === "1") {
    // Use the real pause control so repeating headline decoding cannot spoil a still.
    await page.getByRole("button", { name: "Pause animations", exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "docs/screenshot.png", fullPage: false, animations: "disabled" });
    await page.getByRole("button", { name: "Switch to night mode", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Switch to day mode", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".garden-scene-hero .garden-image")
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.screenshot({
      path: "docs/screenshot-night.png",
      fullPage: false,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Switch to day mode", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Switch to night mode", exact: true }),
    ).toBeVisible();
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByRole("button", { name: "App user menu", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const bar = await run.boundingBox();
  expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual(844);
  if (process.env.POLLINATIONS_CAPTURE === "1") {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "docs/screenshot-mobile-composer.png", animations: "disabled" });
    await page.evaluate(() => {
      const results = document.querySelector('section[aria-label="Results"]');
      if (results) window.scrollTo(0, results.getBoundingClientRect().top + window.scrollY - 80);
    });
    await page.screenshot({ path: "docs/screenshot-mobile.png", animations: "disabled" });
  }
});

test("live full roster handles the test account's paid-only notices", async ({ page }) => {
  test.skip(
    process.env.POLLINATIONS_TEST_ALL !== "1",
    "Only enable this for a funded account without access to paid-only models.",
  );
  test.setTimeout(150_000);
  await page.addInitScript(({ storage, key }) => sessionStorage.setItem(storage, key), {
    storage: TOKEN_STORAGE,
    key: process.env.POLLINATIONS_TEST_KEY ?? "",
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "All models", exact: true }).click();
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(13);
  await expect(page.locator('article[data-status="pending"]')).toHaveCount(0, { timeout: 125_000 });
  await expect(page.locator('article[data-status="done"]')).toHaveCount(9);
  await expect(page.locator("article").getByText("Needs paid Pollen", { exact: true })).toHaveCount(
    4,
  );
  console.log("Live roster: 9 answers and 4 expected paid-Pollen notices; all 13 cards settled.");
});
