import { expect, test } from "@playwright/test";
import { mockApp } from "./fixtures";

const WIDTHS = [320, 359, 360, 375, 390];

const headerReport = () => {
  const header = document.querySelector(".site-header-inner") as HTMLElement;
  const bounds = header.getBoundingClientRect();
  const style = getComputedStyle(header);
  const left = bounds.left + Number.parseFloat(style.paddingLeft);
  const right = bounds.right - Number.parseFloat(style.paddingRight);
  const nodes = [
    ...document.querySelectorAll(
      ".site-header-inner button, .site-header-inner a, .site-header-inner polli-connect",
    ),
  ].filter((el) => {
    const rect = el.getBoundingClientRect();
    return !el.closest(".table-actions") && rect.width > 0 && rect.height > 0;
  });
  const outsideHeader = nodes
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.left < left - 1 ||
        rect.right > right + 1 ||
        rect.top < bounds.top - 1 ||
        rect.bottom > bounds.bottom + 1
      );
    })
    .map((el) => el.getAttribute("aria-label") || el.className || el.tagName);
  const overlaps: string[] = [];
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].contains(nodes[j]) || nodes[j].contains(nodes[i])) continue;
      const a = nodes[i].getBoundingClientRect();
      const b = nodes[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 2 && oy > 2)
        overlaps.push(
          `${nodes[i].className || nodes[i].tagName} x ${nodes[j].className || nodes[j].tagName}`,
        );
    }
  const wordmark = document.querySelector(".brand-wordmark");
  const brand =
    !wordmark || getComputedStyle(wordmark).display === "none"
      ? "icon-only"
      : wordmark.getBoundingClientRect().height <= 20
        ? "single-line"
        : "wrapped";
  return {
    outsideHeader,
    overlaps,
    brand,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
  };
};

for (const connected of [true, false]) {
  for (const width of WIDTHS) {
    test(`${connected ? "connected" : "unconnected"} header fits at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await mockApp(page, { connected });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(700);
      const report = await page.evaluate(headerReport);
      expect(report.outsideHeader).toEqual([]);
      expect(report.overlaps).toEqual([]);
      expect(report.brand).not.toBe("wrapped");
      expect(report.overflowX).toBeLessThanOrEqual(1);
    });
  }
}

test("branding follows available header space and returns when it grows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await mockApp(page, { connected: false, motion: false });
  await page.evaluate(() => document.fonts.ready);
  const wordmark = page.locator(".brand-wordmark");
  await expect(wordmark).toBeVisible();
  await page.locator(".site-header").evaluate((el) => {
    (el as HTMLElement).style.width = "340px";
  });
  await expect(wordmark).toBeHidden();
  expect((await page.evaluate(headerReport)).outsideHeader).toEqual([]);
  await expect(page.getByRole("link", { name: "Model Table home", exact: true })).toBeVisible();
  await page.locator(".site-header").evaluate((el) => {
    (el as HTMLElement).style.removeProperty("width");
  });
  await expect(wordmark).toBeVisible();
});

test("branding reclaims space when text is enlarged", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await mockApp(page, { connected: false, motion: false });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: `
      :root { font-size: 20px; }
      .brand-wordmark { font-size: 17.5px; }
      .mobile-menu-button { font-size: 13.75px; }
      .header-account polli-connect button { font-size: 16.25px; }
    `,
  });
  await expect(page.locator(".brand-wordmark")).toBeHidden();
  const report = await page.evaluate(headerReport);
  expect(report.outsideHeader).toEqual([]);
  expect(report.overlaps).toEqual([]);
});

test("branding uses space released by a shorter connection control", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await mockApp(page, { connected: false, motion: false, connectDelayMs: 300 });
  await page.evaluate(() => document.fonts.ready);
  const widget = page.locator("polli-connect");
  await expect(widget.getByRole("button", { name: "Connect Pollinations" })).toBeVisible();
  await expect(page.locator(".brand-wordmark")).toBeHidden();
  await widget.evaluate((el) => {
    (el as HTMLElement & { apiKey: string }).apiKey = "model-table-test-key";
  });
  await expect(page.locator(".brand-wordmark")).toBeVisible();
  expect((await page.evaluate(headerReport)).outsideHeader).toEqual([]);
});

test("phones keep the theme switch in the menu and it flips the curtain", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await mockApp(page, { connected: false });
  await expect(page.locator(".header-account .theme-button")).toBeHidden();
  await page.locator(".mobile-menu-button").click();
  const row = page.locator(".mobile-navigation .menu-theme-button");
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "night");
  await expect(page.locator("#mobile-navigation")).toBeHidden();
});

test("mobile menu focuses its first link and restores Menu after Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApp(page);
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.click();
  await expect(page.locator("#mobile-navigation a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
});

test("bee and music toggles keep constant names while pressed changes", async ({ page }) => {
  await mockApp(page);
  const bee = page.getByRole("button", { name: "Garden bee", exact: true });
  const sound = page.getByRole("button", { name: "Background music", exact: true });
  await expect(bee).toHaveAttribute("aria-pressed", "true");
  await bee.click();
  await expect(bee).toHaveAttribute("aria-pressed", "false");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
});

test("desktop resizing restores Menu focus until the visitor tabs away", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApp(page);
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.click();
  await expect(page.locator("#mobile-navigation a").first()).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator("#mobile-navigation")).toBeHidden();
  await expect(menu).toBeFocused();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
});
