import { expect, test } from "@playwright/test";
import { mockApp } from "./fixtures";

test("keeps answers readable in both themes, remembers the preference, and supports keyboard navigation", async ({
  page,
}) => {
  const state = await mockApp(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to the table", exact: true });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.locator('article[data-status="done"]')).toHaveCount(6);

  const answerContrast = () =>
    page
      .locator("article")
      .first()
      .evaluate((card) => {
        const style = getComputedStyle(card);
        const luminance = (color: string) => {
          const channels = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
            const channel = Number(value) / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          });
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return (
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
        );
      });
  expect(await answerContrast()).toBeGreaterThanOrEqual(4.5);
  await page.getByRole("button", { name: "Switch to night mode", exact: true }).click();
  await expect(page.getByRole("button", { name: "Switch to day mode", exact: true })).toBeVisible();
  expect(await answerContrast()).toBeGreaterThanOrEqual(4.5);
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.reload();
  await expect(page.getByRole("button", { name: "Switch to day mode", exact: true })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    background,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: "Run the table", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(
    await page
      .locator(".garden-scene-hero .garden-drift")
      .evaluate((scene) => getComputedStyle(scene).animationName),
  ).toBe("none");
  await page.getByRole("button", { name: "Switch to day mode", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  const loadedFonts = await page.evaluate(() =>
    [...document.fonts]
      .filter((font) => font.status === "loaded")
      .map((font) => font.family.replaceAll('"', "")),
  );
  expect(loadedFonts).toEqual(expect.arrayContaining(["Geist Sans", "Geist Pixel", "Geist Mono"]));
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});
