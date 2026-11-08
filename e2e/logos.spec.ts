import { expect, test } from "@playwright/test";
import { mockApp } from "./fixtures";

test("loads intact local logos for all models and keeps their boxes and theme contrast consistent", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const state = await mockApp(page);
  await page.getByRole("button", { name: "All models", exact: true }).click();
  const controls = page.locator(".model-roster .model-logo");
  const cards = page.locator(".ghost-card .model-logo");
  await expect(controls).toHaveCount(13);
  await expect(cards).toHaveCount(13);
  const assets = await controls.evaluateAll(async (logos) => {
    const sources = new Set<string>();
    const sizes = [];
    for (const logo of logos) {
      const image = logo.querySelector("img");
      const mark = logo.querySelector(".model-logo-mono");
      const source =
        image?.src ?? (mark && getComputedStyle(mark).maskImage.match(/url\("([^"]+)"\)/)?.[1]);
      if (!source) throw new Error("Model logo URL missing.");
      sources.add(source);
      const box = logo.getBoundingClientRect();
      sizes.push([box.width, box.height]);
    }
    const decoded = await Promise.all(
      [...sources].map(async (source) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        return { source, width: image.naturalWidth, height: image.naturalHeight };
      }),
    );
    return { decoded, sizes };
  });
  expect(assets.decoded).toHaveLength(12);
  for (const image of assets.decoded) {
    expect(image.source).toContain("http://127.0.0.1:5173/logos/");
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
  }
  expect(assets.sizes.every(([width, height]) => width === 18 && height === 18)).toBe(true);
  expect(
    await cards.evaluateAll((logos) =>
      logos.every((logo) => logo.getBoundingClientRect().width === 22),
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".model-roster .model-logo-mono")
      .first()
      .evaluate((logo) => getComputedStyle(logo).color),
  ).toBe("rgb(0, 0, 0)");
  await page.getByRole("button", { name: "Switch to night mode", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".model-roster .model-logo-mono")
        .first()
        .evaluate((logo) => getComputedStyle(logo).color),
    )
    .toBe("rgb(255, 255, 255)");
  expect(
    await controls
      .locator("img")
      .evaluateAll((images) => images.every((image) => getComputedStyle(image).filter === "none")),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await controls.evaluateAll((logos) =>
      logos.every((logo) => logo.getBoundingClientRect().width === 18),
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".model-toggle")
      .evaluateAll((buttons) =>
        buttons.every((button) => button.getBoundingClientRect().height >= 44),
      ),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(state.pageErrors).toEqual([]);
  expect(state.consoleErrors).toEqual([]);
});
