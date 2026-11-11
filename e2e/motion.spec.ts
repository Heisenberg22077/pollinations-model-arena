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
          window.gsap?.globalTimeline
            .getChildren(true, true, false)
            .filter((animation) => animation.isActive()).length ?? 0,
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
          window.gsap?.globalTimeline
            .getChildren(true, true, false)
            .filter((animation) => animation.isActive()).length ?? 0,
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

test("animates drawer flow and settles repeated clicks when motion stops", async ({ page }) => {
  const state = await mockApp(page);
  await page.evaluate(() => document.fonts.ready);
  const drawer = await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>(".more-models-button")?.click();
    const heights = new Set<number>();
    const transforms = new Set<string>();
    const invalid = new Set<string>();
    const overlaps: number[] = [];
    const layoutProperties = /^(width|height|left|right|top|bottom|padding|margin|clipPath)/;
    await new Promise<void>((resolve) => {
      const start = performance.now();
      const sample = (time: number) => {
        const panel = document.querySelector<HTMLElement>("#extra-models");
        if (panel) {
          heights.add(panel.offsetHeight);
          transforms.add(getComputedStyle(panel).transform);
          const results = document.querySelector("#results");
          if (results && Number(getComputedStyle(panel).opacity) > 0.1) {
            const overlap =
              panel.getBoundingClientRect().bottom - results.getBoundingClientRect().top;
            if (overlap > 1) overlaps.push(overlap);
          }
        }
        for (const animation of document.getAnimations()) {
          if (!(animation.effect instanceof KeyframeEffect)) continue;
          for (const frame of animation.effect.getKeyframes()) {
            for (const property of Object.keys(frame)) {
              if (layoutProperties.test(property)) invalid.add(property);
            }
          }
        }
        if (time - start < 550) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return { heights: [...heights], transforms: [...transforms], invalid: [...invalid], overlaps };
  });
  expect(drawer.heights.length).toBeGreaterThan(4);
  expect(drawer.transforms).toEqual(["none"]);
  expect(drawer.invalid).toEqual([]);
  expect(drawer.overlaps).toEqual([]);
  const extra = page.locator("#extra-models");
  await page.locator(".more-models-button").click();
  await expect(extra).toHaveAttribute("inert", "");
  await expect(extra).not.toBeVisible();

  const dice = page.locator(".surprise-button svg");
  for (let index = 0; index < 4; index++) {
    await page.getByRole("button", { name: "Surprise me", exact: true }).dispatchEvent("click");
    expect(await dice.evaluate((element) => element.getAnimations().length)).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button", { name: "Pause animations", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  expect(await dice.evaluate((element) => element.getAnimations().length)).toBe(0);
  expect(await dice.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  await page.getByRole("button", { name: "Resume animations", exact: true }).click();
  await page.locator(".more-models-button").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await expect(extra).toBeVisible();
  await expect
    .poll(() => extra.evaluate((element) => getComputedStyle(element).transform))
    .toBe("none");
  const toggle = page.getByRole("button", { name: "GPT-5.4 Nano", exact: true });
  await toggle.hover();
  expect(await toggle.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  await page.locator(".more-models-button").click();
  await expect(extra).not.toBeVisible();
  await page.getByRole("button", { name: "Surprise me", exact: true }).click();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});
