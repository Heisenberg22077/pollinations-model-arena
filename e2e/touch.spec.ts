import { devices, expect, test } from "@playwright/test";
import { mockApp } from "./fixtures";

declare global {
  interface Window {
    __scrambleSeen?: boolean;
  }
}

// Touch parity: hover-only feedback made phones feel dead. Taps now earn the same
// context commentary (at the bee's calmer touch cadence) and press feedback.
test.use({ ...devices["Pixel 7"] });

test("tapping a model card earns a paced commentary line", async ({ page }) => {
  test.setTimeout(60_000);
  await mockApp(page);
  await page.getByRole("button", { name: "Run the table", exact: true }).tap();
  await page.waitForFunction(
    () => document.querySelectorAll('article[data-status="done"]').length === 6,
    null,
    { timeout: 20_000 },
  );
  const card = page.locator("article[data-model-id]").first();
  await card.scrollIntoViewIfNeeded();
  await card.tap();
  await expect
    .poll(
      () =>
        page
          .locator(".bee-bubble")
          .evaluate((el) =>
            el.classList.contains("is-visible")
              ? (el.querySelector(".bee-bubble-text")?.textContent ?? "")
              : "",
          ),
      { timeout: 15_000 },
    )
    .not.toBe("");
});

test("tapping Surprise me decodes its label on touch", async ({ page }) => {
  await mockApp(page);
  const label = page.locator(".surprise-button .scramble-label");
  await label.waitFor();
  await page.evaluate(() => {
    window.__scrambleSeen = false;
    const node = document.querySelector(".surprise-button .scramble-label");
    if (!node) return;
    const original = node.textContent;
    new MutationObserver(() => {
      if (node.textContent !== original) window.__scrambleSeen = true;
    }).observe(node, { childList: true, characterData: true, subtree: true });
  });
  await page.locator(".surprise-button").tap();
  await expect.poll(() => page.evaluate(() => window.__scrambleSeen), { timeout: 5000 }).toBe(true);
  await expect(label).toHaveText("Surprise me", { timeout: 5000 });
});

test("pressing a card squishes it under touch", async ({ page }) => {
  test.setTimeout(60_000);
  await mockApp(page);
  await page.getByRole("button", { name: "Run the table", exact: true }).tap();
  await page.waitForFunction(
    () => document.querySelectorAll('article[data-status="done"]').length === 6,
    null,
    { timeout: 20_000 },
  );
  const card = page.locator("article[data-model-id]").first();
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error("card has no box");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await page.waitForTimeout(180);
  const scale = await card.evaluate((el) => Number(window.gsap?.getProperty(el, "scale") ?? 1));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(scale).toBeLessThan(1);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("answers still land with motion off and no gsap tweens", async ({ page }) => {
    test.setTimeout(60_000);
    await mockApp(page);
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await page.getByRole("button", { name: "Run the table", exact: true }).tap();
    await page.waitForFunction(
      () => document.querySelectorAll('article[data-status="done"]').length === 6,
      null,
      { timeout: 20_000 },
    );
    const tweens = await page.evaluate(() =>
      (window.gsap?.globalTimeline.getChildren(false, true, true) ?? [])
        .filter((tween) => !(tween.paused() && tween.duration() === 0))
        .map((tween) =>
          tween
            .targets()
            .map(
              (target: unknown) =>
                (target as HTMLElement).className || (target as HTMLElement).tagName,
            )
            .join(","),
        ),
    );
    expect(tweens).toEqual([]);
  });
});

test("music starts on the first tap without a mute cycle", async ({ page }) => {
  const state = await mockApp(page);
  await page.touchscreen.tap(195, 260);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const audio = document.querySelector("audio");
          return !!audio && !audio.paused && audio.currentTime > 0;
        }),
      { timeout: 10_000 },
    )
    .toBe(true);
  // On phones the header sound button is hidden; the master mute lives in the menu.
  await page.locator(".mobile-menu-button").tap();
  await page
    .locator(".mobile-navigation")
    .getByRole("button", { name: "Mute sound", exact: true })
    .tap();
  await expect
    .poll(() => page.evaluate(() => document.querySelector("audio")?.paused ?? true))
    .toBe(true);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});
