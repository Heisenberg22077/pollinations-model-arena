import { expect, test } from "@playwright/test";
import { SURPRISE_PROMPTS } from "../src/data/surpriseQuestions";
import { mockApp } from "./fixtures";

const MAX_PROMPT_LENGTH = 280;

test("draws every Surprise question once per cycle, avoids a boundary repeat, and stays within the prompt limit", async ({
  page,
}) => {
  // 72 real clicks, each waiting out the intentional 0.34s spring release before
  // Playwright considers the button stable; the default 30s budget is too tight.
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  const state = await mockApp(page);
  const question = page.getByRole("textbox", { name: "Your question", exact: true });
  const surprise = page.getByRole("button", { name: "Surprise me", exact: true });
  let previous = "";
  for (let cycle = 0; cycle < 2; cycle++) {
    if (cycle === 1)
      await page.evaluate(() => {
        Math.random = () => 0.03;
      });
    const seen = new Set<string>();
    for (let draw = 0; draw < SURPRISE_PROMPTS.length; draw++) {
      await surprise.click();
      const value = await question.inputValue();
      expect(value).not.toBe(previous);
      expect(value.length).toBeLessThanOrEqual(MAX_PROMPT_LENGTH);
      expect(seen.has(value)).toBe(false);
      seen.add(value);
      previous = value;
    }
    expect(seen).toEqual(new Set(SURPRISE_PROMPTS));
  }
  await question.fill("a".repeat(MAX_PROMPT_LENGTH + 50));
  expect((await question.inputValue()).length).toBe(MAX_PROMPT_LENGTH);
  expect(state.dispatches).toEqual([]);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test("keeps Run visible with the full lineup and guide, and compares real metrics in a keyboard-scrollable table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const state = await mockApp(page);
  const run = page.getByRole("button", { name: "Run the table", exact: true });
  const guide = page.locator("#how");
  await page.getByRole("button", { name: "All models", exact: true }).click();
  await expect(page.getByText("13 selected", { exact: true })).toBeVisible();
  await expect(run).toBeInViewport({ ratio: 1 });
  await expect(run).toHaveCount(1);

  await expect(guide).not.toHaveAttribute("open");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "How it works", exact: true })
    .click();
  await expect(guide).toHaveAttribute("open");
  await expect(guide.locator("summary")).toBeFocused();
  await expect(run).toBeInViewport({ ratio: 1 });
  await guide.locator("summary").press("Enter");
  await expect(guide).not.toHaveAttribute("open");
  await page.getByRole("button", { name: "Core 6", exact: true }).click();
  await page.keyboard.press("Control+Enter");
  await expect(page.locator('article[data-status="done"]')).toHaveCount(6);
  const imageCard = page.locator("article").filter({ has: page.locator(".answer-image img") });
  const imageTrigger = imageCard.getByRole("button", { name: "Expand", exact: true });
  const previewHeight = (await imageCard.locator(".answer-image img").boundingBox())?.height ?? 0;
  await imageTrigger.click();
  const dialog = page.getByRole("dialog", { name: "FLUX.1 Schnell image", exact: true });
  await expect(dialog).toBeVisible();
  expect((await dialog.locator("img").boundingBox())?.height).toBeGreaterThan(previewHeight);
  await expect(dialog.getByRole("button", { name: "Collapse", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Collapse", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(imageTrigger).toBeFocused();
  await imageTrigger.click();
  await dialog.getByRole("button", { name: "Collapse", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(imageTrigger).toBeFocused();
  await page.getByRole("button", { name: "Compare metrics", exact: true }).click();
  const table = page.getByRole("table");
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(6);
  await expect(rows.first()).toContainText("GPT-5.4 Nano");
  await expect(rows.first().locator("td").nth(1)).toHaveText("12ms");
  await expect(rows.first().locator("td").nth(2)).toHaveText("300");
  await expect(rows.first().locator("td").last()).toHaveText("0.0005");
  await page.getByRole("combobox", { name: "Sort results", exact: true }).selectOption("provider");
  await expect(rows.first()).toContainText("FLUX.1 Schnell");

  await page.setViewportSize({ width: 390, height: 844 });
  const region = page.getByRole("region", { name: "Scroll comparison metrics", exact: true });
  await region.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test("brings phone users to their answers and keeps the Run action in view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockApp(page);
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  const results = page.getByRole("region", { name: "Results", exact: true });
  await expect.poll(async () => (await results.boundingBox())?.y ?? 999).toBeLessThanOrEqual(90);
  await expect(page.locator('article[data-status="done"]')).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Run the table", exact: true })).toBeInViewport({
    ratio: 0.99,
  });
  const runBounds = await page
    .getByRole("button", { name: "Run the table", exact: true })
    .boundingBox();
  expect(runBounds).not.toBeNull();
  expect(runBounds?.x).toBeGreaterThanOrEqual(0);
  expect(runBounds?.y).toBeGreaterThanOrEqual(0);
  expect((runBounds?.x ?? 0) + (runBounds?.width ?? 0)).toBeLessThanOrEqual(390);
  expect((runBounds?.y ?? 0) + (runBounds?.height ?? 0)).toBeLessThanOrEqual(844);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});
