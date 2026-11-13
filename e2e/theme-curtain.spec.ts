import { devices, expect, test } from "@playwright/test";
import { mockApp } from "./fixtures";

interface CurtainFrame {
  t: number;
  cover: number;
  night: boolean;
  artReady: boolean;
}

test.use({ ...devices["Pixel 7"] });

test("theme curtain lifts only onto the decoded new theme and ends on a slow tail", async ({
  page,
}) => {
  const state = await mockApp(page);
  // A slow phone network: the night art must not pop in after the curtain lifts.
  await page.route("**/art/pollinations-garden-night*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 450));
    await route.continue();
  });
  await page.waitForFunction(() => document.documentElement.dataset.motionEngine === "gsap");
  await page.locator(".mobile-menu-button").tap();
  await expect(page.locator(".mobile-navigation .menu-theme-button")).toBeVisible();

  const frames = await page.evaluate(
    () =>
      new Promise<CurtainFrame[]>((resolve) => {
        const grid = document.querySelector<HTMLElement>(".pixel-transition-grid");
        const button = document.querySelector<HTMLElement>(".mobile-navigation .menu-theme-button");
        if (!grid || !button) throw new Error("Missing curtain or theme button");
        const blocks = [...grid.querySelectorAll<HTMLElement>(".pixel-transition-matrix > i")];
        const samples: CurtainFrame[] = [];
        let visible: HTMLElement[] = [];
        let t0 = 0;
        const sample = (now: number) => {
          if (!grid.hidden && visible.length === 0)
            visible = blocks.filter((block) => {
              const r = block.getBoundingClientRect();
              return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
            });
          let sum = 0;
          for (const block of visible) {
            const style = getComputedStyle(block);
            const scale = Number(style.transform.match(/matrix\(([^,]+)/)?.[1] ?? 1);
            sum += Number(style.opacity) * Math.min(1, scale * scale);
          }
          const art = document.querySelector<HTMLImageElement>(".garden-scene-hero img");
          samples.push({
            t: now - t0,
            cover: grid.hidden || !visible.length ? 0 : sum / visible.length,
            night: document.documentElement.dataset.colorMode === "night",
            artReady:
              !!art && art.complete && art.naturalWidth > 0 && art.currentSrc.includes("night"),
          });
          if (now - t0 < 3000 && !(samples.length > 5 && grid.hidden))
            requestAnimationFrame(sample);
          else resolve(samples);
        };
        requestAnimationFrame((now) => {
          t0 = now;
          button.click();
          requestAnimationFrame(sample);
        });
      }),
  );

  const covered = frames.findIndex((frame) => frame.cover >= 0.98);
  expect(covered).toBeGreaterThanOrEqual(0);
  const lift = frames.findIndex((frame, index) => index > covered && frame.cover < 0.98);
  expect(lift).toBeGreaterThan(covered);
  // The reveal never shows the old palette or a half-loaded garden.
  expect(frames[lift].night).toBe(true);
  expect(frames[lift].artReady).toBe(true);

  const start = frames[lift - 1].t;
  const half = frames.find((frame, index) => index >= lift && frame.cover <= 0.5);
  const end = frames.find((frame, index) => index >= lift && frame.cover <= 0.02);
  expect(half).toBeDefined();
  expect(end).toBeDefined();
  if (!half || !end) return;
  // Decelerating dissolve: the last half of the coverage takes clearly longer than
  // the first half, and the whole lift is unhurried.
  expect(end.t - half.t).toBeGreaterThanOrEqual(1.5 * (half.t - start));
  expect(end.t - start).toBeGreaterThanOrEqual(450);
  await expect(page.locator(".pixel-transition-grid")).toBeHidden();
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});
