import { expect, test } from "@playwright/test";
import { mockApp } from "./fixtures";

const audible = () => {
  const audio = document.querySelector("audio");
  return !!audio && !audio.paused && audio.currentTime > 0;
};

test("blocked autoplay waits quietly and starts on the first gesture", async ({ page }) => {
  const state = await mockApp(page);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(audible)).toBe(false);
  await page.locator(".workspace-lede").click();
  await expect.poll(() => page.evaluate(audible), { timeout: 10_000 }).toBe(true);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});
