import { expect, test } from "@playwright/test";
import { IDS, mockApp } from "./fixtures";

test("pauses ongoing motion, remembers the choice, and follows changing system preferences", async ({
  page,
}) => {
  const state = await mockApp(page);
  await page.evaluate(() => document.fonts.ready);
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-motion", "on");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause animations", exact: true }).click();
  await expect(root).toHaveAttribute("data-motion", "off");
  await page.getByRole("button", { name: "Surprise me", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
  await expect(page.locator(".surprise-button .scramble-label")).toHaveText("Surprise me");
  await page.reload();
  await expect(root).toHaveAttribute("data-motion", "off");
  await page.getByRole("button", { name: "Resume animations", exact: true }).click();
  await expect(root).toHaveAttribute("data-motion", "on");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(root).toHaveAttribute("data-motion", "off");
  await page.getByRole("button", { name: "Surprise me", exact: true }).click();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(root).toHaveAttribute("data-motion", "on");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Pause animations", exact: true }).click();
  await expect(root).toHaveAttribute("data-motion", "off");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});

test("opens images directly by keyboard and restores answer height after interrupted expansion", async ({
  page,
}) => {
  const state = await mockApp(page);
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.locator('article[data-status="done"]')).toHaveCount(6);
  const card = page.locator(`article[data-model-id="${IDS[0]}"]`);
  const body = card.locator(".answer-body");
  const collapsedHeight = await body.evaluate((element) => element.getBoundingClientRect().height);
  const expand = card.getByRole("button", { name: "Expand", exact: true });
  await expand.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(90);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(90);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(90);
  await page.keyboard.press("Enter");
  await expect
    .poll(() => body.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(collapsedHeight);
  const image = page.getByRole("button", { name: "View FLUX.1 Schnell image", exact: true });
  await image.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(image).toBeFocused();
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});
