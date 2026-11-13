import { expect, test } from "@playwright/test";
import { mockApp } from "./fixtures";

// Stands in for a browser whose policy already permits audible autoplay
// (returning visitor with media engagement, installed app, site allowlisted).
test.use({ launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });

const audible = () => {
  const audio = document.querySelector("audio");
  return !!audio && !audio.paused && audio.currentTime > 0;
};

test("music plays on load without any gesture, and the master mute still fades it", async ({
  page,
}) => {
  const state = await mockApp(page);
  await expect.poll(() => page.evaluate(audible), { timeout: 10_000 }).toBe(true);
  await page.getByRole("button", { name: "Background music", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.querySelector("audio")?.paused ?? true))
    .toBe(true);
  await page.getByRole("button", { name: "Background music", exact: true }).click();
  await expect.poll(() => page.evaluate(audible), { timeout: 10_000 }).toBe(true);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});
