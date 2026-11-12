import { expect, test } from "@playwright/test";
import { mockApp } from "./fixtures";

// A friend's Android phone showed the unconnected Connect widget painting over the
// theme button at 360px. The old matrix only seeded the connected state and only
// checked viewport bounds, so neither the state nor the overlap was ever exercised.
const WIDTHS = [320, 360, 390];

const headerReport = () => {
  const nodes = [
    ...document.querySelectorAll(".site-header button, .site-header a, .site-header polli-connect"),
  ].filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
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
      expect(report.overlaps).toEqual([]);
      expect(report.brand).not.toBe("wrapped");
      expect(report.overflowX).toBeLessThanOrEqual(1);
    });
  }
}

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
