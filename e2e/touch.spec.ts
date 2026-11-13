import { devices, expect, test } from "@playwright/test";
import { delay, fulfillChat, fulfillImage, IDS, mockApp, observeMotion } from "./fixtures";

declare global {
  interface Window {
    __scrambleSeen?: boolean;
  }
}

// Touch parity: hover-only feedback made phones feel dead. Taps now earn the same
// context commentary (at the bee's calmer touch cadence) and press feedback.
test.use({ ...devices["Pixel 7"] });

test("tapping the closing garden blooms once and pause clears the lens", async ({ page }) => {
  const state = await mockApp(page);
  const garden = page.locator(".garden-scene-closing");
  await garden.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await garden.tap();
  const lens = garden.locator(".garden-lens");
  await expect
    .poll(() => lens.evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBeGreaterThan(0.2);
  await expect
    .poll(() => lens.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 4000 })
    .toBe(0);
  await garden.tap();
  await page.locator(".header-account .motion-button").dispatchEvent("click");
  await expect(lens).toHaveCount(0);
  expect(state.pageErrors).toEqual([]);
});

test("tapping an answer card stays quiet and never feeds or starts a story", async ({ page }) => {
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
  const state = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/arena-motion.ts"))?.name;
    if (!url) throw new Error("Missing motion module");
    return (await import(url)).beeDiagnostics();
  });
  expect(state.fruits).toBe(0);
  expect(state.story).toBe(-1);
  expect(state.boops).toBe(0);
  await expect(card).toHaveAttribute("data-status", "done");
  // Intentional pet input remains available when the visitor returns to its home.
  await page.locator(".bee-home summary").click();
  const boop = page.getByRole("button", { name: "Boop the bee", exact: true });
  await boop.tap();
  await expect
    .poll(
      () =>
        page
          .locator(".bee-bubble")
          .evaluate(
            (el) =>
              el.classList.contains("is-visible") && el.getAttribute("data-trigger") === "boop",
          ),
      { timeout: 8000 },
    )
    .toBe(true);
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

test("touch lineup pixels are visible and ripple without mouse hover", async ({ page }) => {
  const state = await mockApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "gsap");
  const signal = page.locator(".model-signal");
  await expect(signal).toBeVisible();
  const observed = await observeMotion(page, ".model-signal i");
  await signal.tap();
  expect(await observed()).toHaveLength(6);
  const question = await observeMotion(page, ".question-input");
  await page.locator(".composer-chip").nth(1).tap();
  expect(await question()).toEqual([0]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(state.pageErrors).toEqual([]);
});

test("pausing mobile aura releases compositor hints and leaves it still", async ({ page }) => {
  await mockApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "gsap");
  await page.getByRole("button", { name: "Menu", exact: true }).tap();
  await page.getByRole("button", { name: "Pause animations", exact: true }).tap();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  const hints = await page.locator(".aura-blob").evaluateAll((nodes) =>
    nodes.map((node) => ({
      moving: window.gsap?.getTweensOf(node).some((tween) => tween.isActive()) ?? false,
      reserved: getComputedStyle(node).willChange.includes("transform"),
    })),
  );
  expect(hints.length).toBeGreaterThan(0);
  expect(hints.every(({ moving, reserved }) => !moving && !reserved)).toBe(true);
});

test("launching the full lineup keeps distant answer contents deferred during layout motion", async ({
  page,
}) => {
  await mockApp(page);
  await page.getByRole("button", { name: "All models", exact: true }).tap();
  await expect(page.locator(".model-signal i")).toHaveCount(13);
  await page.waitForTimeout(850);
  await page.getByRole("button", { name: "Run the table", exact: true }).dispatchEvent("click");
  await expect(page.locator("article[data-model-id]")).toHaveCount(13);
  const distant = await page
    .locator("article[data-model-id]")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getBoundingClientRect().top > innerHeight * 2)
        .map((node) => getComputedStyle(node).contentVisibility),
    );
  expect(distant.length).toBeGreaterThan(0);
  expect(distant.every((visibility) => visibility === "auto")).toBe(true);
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
    .getByRole("button", { name: "Background music", exact: true })
    .tap();
  await expect
    .poll(() => page.evaluate(() => document.querySelector("audio")?.paused ?? true))
    .toBe(true);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test("layout capture skips distant card geometry in Flip", async ({ page }) => {
  await mockApp(page);
  await page.getByRole("button", { name: "All models", exact: true }).tap();
  await expect(page.locator(".comparison-grid > .model-column")).toHaveCount(13);
  await page.waitForTimeout(1000);
  const captured = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/arena-motion.ts"))?.name;
    if (!url) throw new Error("Missing motion module");
    const flip = (window as unknown as { Flip: { getState: (...args: unknown[]) => unknown } })
      .Flip;
    const original = flip.getState;
    const distant: string[] = [];
    flip.getState = function (...args) {
      for (const node of args[0] as HTMLElement[]) {
        if (node.matches(".model-column") && node.getBoundingClientRect().top > innerHeight * 2)
          distant.push(node.dataset.flipId ?? "");
      }
      return original.apply(this, args);
    };
    try {
      (await import(url)).captureLayout();
    } finally {
      flip.getState = original;
    }
    return distant;
  });
  expect(captured).toEqual([]);
});

test("offscreen scroll entrances wait before initializing card contents", async ({ page }) => {
  await mockApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "gsap");
  const touched = await page.evaluate(async () => {
    const gsap = window.gsap;
    if (!gsap) throw new Error("Missing GSAP");
    const original = gsap.set;
    const distant: string[] = [];
    gsap.set = function (targets, vars) {
      for (const target of Array.isArray(targets) ? targets : [targets]) {
        if (!(target instanceof HTMLElement) || !target.matches(".card-arrival")) continue;
        const card = target.closest<HTMLElement>(".model-column");
        if (card && card.getBoundingClientRect().top > innerHeight * 2)
          distant.push(card.dataset.flipId ?? "");
      }
      return original.call(this, targets, vars);
    };
    try {
      document.querySelector<HTMLButtonElement>(".run-button")?.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      gsap.set = original;
    }
    return distant;
  });
  expect(touched).toEqual([]);
});

test("distant pending cards do not animate their skipped skeletons", async ({ page }) => {
  await mockApp(page, {
    chat: async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    },
  });
  await page.getByRole("button", { name: "Run the table", exact: true }).dispatchEvent("click");
  await expect(page.locator('article[data-status="pending"]')).toHaveCount(6);
  await page.waitForTimeout(350);
  const distant = await page.locator('article[data-status="pending"]').evaluateAll((cards) =>
    cards
      .filter((card) => card.getBoundingClientRect().top > innerHeight * 2)
      .map((card) => ({
        id: card.getAttribute("data-model-id"),
        moving:
          window.gsap
            ?.getTweensOf(card.querySelector(".skeleton-shimmer"))
            .some((t) => t.isActive()) ?? false,
      })),
  );
  expect(distant.length).toBeGreaterThan(0);
  expect(distant.every((card) => !card.moving)).toBe(true);
});

test("offscreen settlements keep card contents deferred", async ({ page }) => {
  await mockApp(page);
  const touched = await page.evaluate(async () => {
    const gsap = window.gsap;
    if (!gsap) throw Error("Missing GSAP");
    const original = gsap.fromTo;
    const distant: string[] = [];
    gsap.fromTo = function (targets, from, to) {
      if (targets instanceof HTMLElement && targets.matches(".card-tilt")) {
        const card = targets.closest<HTMLElement>(".model-column");
        if (card && card.getBoundingClientRect().top > innerHeight * 2)
          distant.push(card.dataset.modelId ?? "");
      }
      return Reflect.apply(original, this, [targets, from, to]);
    };
    try {
      document.querySelector<HTMLButtonElement>(".run-button")?.click();
      await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          if (document.querySelectorAll('article[data-status="done"]').length === 6) {
            clearInterval(timer);
            resolve();
          }
        }, 50);
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      gsap.fromTo = original;
    }
    return distant;
  });
  expect(touched).toEqual([]);
});

test("offscreen answers wait for visibility before measuring text overflow", async ({ page }) => {
  await mockApp(page);
  const reads = await page.evaluate(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight");
    if (!descriptor?.get) throw Error("Missing scroll height accessor");
    const original = descriptor.get;
    const distant: string[] = [];
    Object.defineProperty(Element.prototype, "scrollHeight", {
      ...descriptor,
      get() {
        if (this instanceof HTMLElement && this.matches(".answer-copy")) {
          const card = this.closest<HTMLElement>(".model-column");
          if (card && card.getBoundingClientRect().top > innerHeight * 2)
            distant.push(card.dataset.modelId ?? "");
        }
        return original.call(this);
      },
    });
    try {
      document.querySelector<HTMLButtonElement>(".run-button")?.click();
      await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          if (document.querySelectorAll('article[data-status="done"]').length === 6) {
            clearInterval(timer);
            resolve();
          }
        }, 50);
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
    } finally {
      Object.defineProperty(Element.prototype, "scrollHeight", descriptor);
    }
    return distant;
  });
  expect(reads).toEqual([]);
});

test("an offscreen fastest award keeps its badge without initializing skipped contents", async ({
  page,
}) => {
  await mockApp(page, {
    chat: async (route, request) => {
      await delay(request.model === IDS[4] ? 10 : 300);
      await fulfillChat(route, request);
    },
    image: async (route) => {
      await delay(500);
      await fulfillImage(route);
    },
  });
  const touched = await page.evaluate(async () => {
    const gsap = window.gsap;
    if (!gsap) throw Error("Missing GSAP");
    const original = gsap.fromTo;
    const distant: string[] = [];
    gsap.fromTo = function (targets, from, to) {
      if (targets instanceof HTMLElement && targets.matches(".answer-award-fastest")) {
        const card = targets.closest<HTMLElement>(".model-column");
        if (card && card.getBoundingClientRect().top > innerHeight * 2)
          distant.push(card.dataset.modelId ?? "");
      }
      return Reflect.apply(original, this, [targets, from, to]);
    };
    try {
      document.querySelector<HTMLButtonElement>(".run-button")?.click();
      await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          if (document.querySelectorAll('article[data-status="done"]').length === 6) {
            clearInterval(timer);
            resolve();
          }
        }, 50);
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
    } finally {
      gsap.fromTo = original;
    }
    return distant;
  });
  expect(touched).toEqual([]);
  const winner = page.locator(`article[data-model-id="${IDS[4]}"]`);
  await winner.scrollIntoViewIfNeeded();
  await expect(winner.locator(".answer-award-fastest")).toBeVisible();
});
