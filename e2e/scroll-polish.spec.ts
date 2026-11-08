import { expect, test } from "@playwright/test";
import { catalog, IDS, mockApp } from "./fixtures";

test("glides a single preset highlight through interruptions, resizing and manual selections", async ({
  page,
}) => {
  const state = await mockApp(page);
  await page.evaluate(() => document.fonts.ready);
  const presets = page.getByRole("group", { name: "Lineup presets", exact: true });
  const highlight = presets.locator(".preset-highlight");
  const aligned = async (preset: string) => {
    await expect(highlight).toHaveCount(1);
    await expect
      .poll(() =>
        presets.evaluate((fieldset, active) => {
          const button = fieldset.querySelector(`[data-preset="${active}"]`);
          const marker = fieldset.querySelector(".preset-highlight");
          if (!button || !marker) return false;
          const target = button.getBoundingClientRect();
          const actual = marker.getBoundingClientRect();
          return (
            Math.abs(actual.left - target.left - 1) < 1 &&
            Math.abs(actual.top - target.top - 1) < 1 &&
            Math.abs(actual.width - target.width + 2) < 1 &&
            Math.abs(actual.height - target.height + 2) < 1
          );
        }, preset),
      )
      .toBe(true);
  };
  await aligned("core");
  const motion = await presets.evaluate(async (fieldset) => {
    const marker = fieldset.querySelector(".preset-highlight");
    const target = fieldset.querySelector<HTMLButtonElement>('[data-preset="free"]');
    if (!marker || !target) throw new Error("Preset controls missing.");
    const start = marker.getBoundingClientRect().left;
    const end = target.getBoundingClientRect().left + 1;
    target.click();
    const frames: number[] = [];
    await new Promise<void>((resolve) => {
      const started = performance.now();
      const sample = () => {
        const current = fieldset.querySelector(".preset-highlight");
        if (current) frames.push(current.getBoundingClientRect().left);
        if (performance.now() - started < 450) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return { start, end, frames };
  });
  expect(motion.frames.some((left) => left > motion.start + 1 && left < motion.end - 1)).toBe(true);
  await aligned("free");
  await expect(page.getByText("9 selected", { exact: true })).toBeVisible();
  for (const name of ["All models", "Core 6", "Standard models"]) {
    await page.getByRole("button", { name, exact: true }).press("Enter");
    await page.waitForTimeout(80);
  }
  await aligned("free");
  for (const width of [1024, 390, 1920]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
    await aligned("free");
  }
  await page.getByRole("button", { name: "GPT-5.4 Nano", exact: true }).click();
  await expect(highlight).toHaveCount(0);
  await page.getByRole("button", { name: "All models", exact: true }).click();
  await aligned("all");
  await expect(page.getByText("13 selected", { exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await page.getByRole("button", { name: "Core 6", exact: true }).click();
  await aligned("core");
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});

test("keeps expanded offscreen answers stable and image dialogs usable while scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockApp(page);
  await page.getByRole("button", { name: "All models", exact: true }).click();
  const run = page.getByRole("button", { name: "Run the table", exact: true });
  await run.click();
  await expect(page.locator('article[data-status="done"]')).toHaveCount(13);
  const card = page.locator(`article[data-model-id="${IDS[12]}"]`);
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator(".answer-copy")).toBeVisible();
  await card.getByRole("button", { name: "Expand", exact: true }).click();
  await expect(card.getByRole("button", { name: "Collapse", exact: true })).toBeVisible();
  await expect
    .poll(() => card.evaluate((element) => element.getAnimations({ subtree: true }).length))
    .toBe(0);
  const expanded = await card.evaluate((element) => element.getBoundingClientRect().height);
  expect(expanded).toBeGreaterThan(500);
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await run.focus();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect
    .poll(() =>
      card
        .locator(".answer-copy")
        .evaluate((element) => element.checkVisibility({ contentVisibilityAuto: true })),
    )
    .toBe(false);
  expect(
    Math.abs((await card.evaluate((element) => element.getBoundingClientRect().height)) - expanded),
  ).toBeLessThan(1);
  expect(
    Math.abs((await page.evaluate(() => document.documentElement.scrollHeight)) - pageHeight),
  ).toBeLessThanOrEqual(1);
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator(".answer-copy")).toBeVisible();
  expect(
    Math.abs((await card.evaluate((element) => element.getBoundingClientRect().height)) - expanded),
  ).toBeLessThan(1);
  await card.getByRole("button", { name: "Collapse", exact: true }).click();
  await expect
    .poll(() => card.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(500);
  const image = page.getByRole("button", { name: "View FLUX.1 Schnell image", exact: true });
  await image.focus();
  await image.press("Enter");
  const dialog = page.getByRole("dialog", { name: "FLUX.1 Schnell image", exact: true });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(image).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});

test("contains mobile roster swipes with edge space and suppresses toggle hover when motion is off", async ({
  page,
}) => {
  const state = await mockApp(page, {
    catalog: catalog.map((model, index) =>
      index === 0 ? { ...model, health: { status: "down" } } : model,
    ),
  });
  const core = page.getByRole("group", { name: "Core models", exact: true });
  const disabled = core.getByRole("button", { name: "GPT-5.4 Nano", exact: true });
  const enabled = core.getByRole("button", { name: "DeepSeek V4.1 Flash", exact: true });
  await expect(disabled).toBeDisabled();
  const restingHeight = await enabled.evaluate((element) => element.clientHeight);
  await enabled.hover();
  // A spring crosses its target before overshooting; sample the settled transform.
  await expect
    .poll(() =>
      enabled.evaluate((element) =>
        element.getAnimations().some((animation) => animation.playState === "running"),
      ),
    )
    .toBe(false);
  await expect
    .poll(() =>
      enabled.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42),
    )
    .toBeCloseTo(-2, 1);
  expect(
    await enabled.evaluate(
      (element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m11,
    ),
  ).toBeCloseTo(1.015, 3);
  expect(await enabled.evaluate((element) => element.clientHeight)).toBe(restingHeight);
  await disabled.hover();
  expect(await disabled.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  await page.getByRole("button", { name: "Pause animations", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await enabled.hover();
  expect(await enabled.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  const pane = page.locator(".model-column").filter({
    has: page.getByRole("heading", { name: "DeepSeek V4.1 Flash", exact: true }),
  });
  await pane.hover();
  expect(await pane.evaluate((element) => getComputedStyle(element).translate)).toBe("none");
  expect(
    await pane
      .locator(".model-heading")
      .evaluate((element) => getComputedStyle(element, "::before").transform),
  ).toBe("none");
  const navigation = page.locator(".main-navigation .nav-link").first();
  await navigation.hover();
  expect(
    await navigation.evaluate((element) => getComputedStyle(element, "::after").transform),
  ).toBe("none");
  await page.getByRole("button", { name: "Resume animations", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await enabled.hover();
  expect(await enabled.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  await page.setViewportSize({ width: 390, height: 844 });
  await core.scrollIntoViewIfNeeded();
  const firstGap = await core.evaluate((fieldset) => {
    const first = fieldset.querySelector("button");
    if (!first) throw new Error("Core model missing.");
    return first.getBoundingClientRect().left - fieldset.getBoundingClientRect().left - 1;
  });
  expect(firstGap).toBe(16);
  await core.hover();
  const scrollTop = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(500, 0);
  await expect.poll(() => core.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollTop);
  await core.evaluate((element) =>
    element.scrollTo({ left: element.scrollWidth, behavior: "instant" }),
  );
  await expect
    .poll(() =>
      core.evaluate((fieldset) => {
        const last = fieldset.querySelector("button:last-child");
        if (!last) throw new Error("Core model missing.");
        return fieldset.getBoundingClientRect().right - 1 - last.getBoundingClientRect().right;
      }),
    )
    .toBe(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});
