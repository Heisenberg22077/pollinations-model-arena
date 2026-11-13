import { devices, expect, test } from "@playwright/test";
import { delay, fulfillChat, mockApp } from "./fixtures";

declare global {
  interface Window {
    __oscillators?: number;
    __beePosition?: { x: number; y: number };
  }
}
async function trackBee(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const translate = CanvasRenderingContext2D.prototype.translate;
    CanvasRenderingContext2D.prototype.translate = function (x, y) {
      if (this.canvas.id === "pollen-celebration" && this.getTransform().isIdentity)
        window.__beePosition = { x, y };
      return translate.call(this, x, y);
    };
  });
}
const attachment = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const bubble = document.querySelector(".bee-bubble")?.getBoundingClientRect();
    const bee = window.__beePosition;
    if (!bubble || !bee) throw Error("Missing bee speech geometry");
    return { x: bubble.x, y: bubble.y, right: bubble.right, bottom: bubble.bottom, beeY: bee.y };
  });
async function prepare(
  page: import("@playwright/test").Page,
  options: Parameters<typeof mockApp>[1] = {},
) {
  const state = await mockApp(page, options);
  await page.locator(".bee-home summary").click();
  return state;
}
const petState = (page: import("@playwright/test").Page) =>
  page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/arena-motion.ts"))?.name;
    if (!url) throw Error("Missing motion module");
    return (await import(url)).beeDiagnostics();
  });
const trigger = (page: import("@playwright/test").Page) =>
  page
    .locator(".bee-bubble")
    .evaluate((el) =>
      el.classList.contains("is-visible") ? el.getAttribute("data-trigger") : null,
    );

test("recent questions suppress commentary for the whole open disclosure", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.getByText("6/6 answered", { exact: true })).toBeVisible();
  const recent = page.locator("#recent-questions");
  await recent.locator("summary").click();
  await expect(recent).toHaveAttribute("open", "");
  await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>("#recent-questions button")?.focus();
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/arena-motion.ts"))?.name;
    if (!url) throw Error("Missing motion module");
    const { beeAction } = await import(url);
    beeAction("story");
  });
  await page.waitForTimeout(500);
  await expect(page.locator(".bee-bubble")).not.toHaveClass(/is-visible/);
  expect((await petState(page)).story).toBe(-1);
});

test("injected bee randomness owns both fruit and dialogue choices", async ({ page }) => {
  await prepare(page);
  const result = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/bee.ts"))?.name;
    if (!url) throw Error("Missing bee module");
    const { createBee } = await import(url);
    let calls = 0;
    const bee = createBee(
      () => {},
      () => {
        calls++;
        return 0.25;
      },
    );
    const original = Math.random;
    Math.random = () => {
      throw Error("Unexpected global RNG");
    };
    try {
      bee.update(0.04, 1000);
      bee.action("feed");
      bee.update(0.04, 1300);
      return { calls, fruits: bee.diagnostics.fruits };
    } finally {
      Math.random = original;
      bee.dispose();
    }
  });
  expect(result.calls).toBeGreaterThan(6);
  expect(result.fruits).toBe(1);
});

test("bee wings use a bounded stepped pose on the shared clock", async ({ page }) => {
  await prepare(page);
  const poses = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/bee.ts"))?.name;
    if (!url) throw Error("Missing bee module");
    const { createBee } = await import(url);
    const bee = createBee(
      () => {},
      () => 0,
    );
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("No canvas");
    const rotate = ctx.rotate.bind(ctx);
    const wings: number[] = [];
    let rotations = 0;
    ctx.rotate = (angle) => {
      if (rotations++ === 1) wings.push(angle);
      rotate(angle);
    };
    try {
      for (let i = 0; i < 60; i++) {
        bee.update(1 / 60, 1000 + (i * 1000) / 60);
        rotations = 0;
        bee.draw(ctx);
      }
      return new Set(wings.map((v) => v.toFixed(3))).size;
    } finally {
      bee.dispose();
    }
  });
  expect(poses).toBeGreaterThan(1);
  expect(poses).toBeLessThanOrEqual(5);
});

test("slow frames expire the pollen trail using elapsed time", async ({ page }) => {
  await prepare(page);
  const result = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/bee.ts"))?.name;
    if (!url) throw Error("Missing bee module");
    const { createBee } = await import(url);
    const bee = createBee(
      () => {},
      () => 0,
    );
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) throw Error("No canvas");
    const fill = ctx.fillRect.bind(ctx);
    let pink = 0;
    ctx.fillRect = (...args) => {
      if (ctx.fillStyle === "#f9a8d4" && ctx.getTransform().isIdentity) pink++;
      fill(...args);
    };
    try {
      for (let i = 0; i < 20; i++) bee.update(0.04, 1000 + i * 40);
      bee.draw(ctx);
      const before = pink;
      pink = 0;
      bee.update(0.04, 4000);
      bee.draw(ctx);
      return { before, after: pink };
    } finally {
      bee.dispose();
    }
  });
  expect(result.before).toBeGreaterThan(0);
  expect(result.after).toBe(0);
});

test("disabling the pet clears old pointer, flower, hover and rest targets", async ({ page }) => {
  await prepare(page);
  const state = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/bee.ts"))?.name;
    if (!url) throw Error("Missing bee module");
    const { createBee } = await import(url);
    const bee = createBee(
      () => {},
      () => 0,
    );
    try {
      bee.pointer(250, 200, 100);
      bee.flower({ left: 200, top: 200, width: 30, height: 30 });
      bee.hover("model", "GPT-5.4 Nano");
      bee.action("story");
      bee.setEnabled(false);
      return bee.diagnostics;
    } finally {
      bee.dispose();
    }
  });
  expect(state).toMatchObject({
    pointerActive: false,
    flower: false,
    hoverKey: "",
    restUntil: 0,
    perched: false,
  });
});

test("scrolling clears the bee hover identity so the same model can be rediscovered", async ({
  page,
}) => {
  await prepare(page);
  const result = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/bee.ts"))?.name;
    if (!url) throw Error("Missing bee module");
    const { createBee } = await import(url);
    const bee = createBee(
      () => {},
      () => 0,
    );
    try {
      bee.hover("model", "GPT-5.4 Nano");
      const before = bee.diagnostics.hoverKey;
      bee.scroll();
      const after = bee.diagnostics.hoverKey;
      bee.hover("model", "GPT-5.4 Nano");
      return { before, after, rediscovered: bee.diagnostics.hoverKey };
    } finally {
      bee.dispose();
    }
  });
  expect(result.before).not.toBe("");
  expect(result.after).toBe("");
  expect(result.rediscovered).toBe(result.before);
});

test("a speech bubble taller than its viewport keeps its top reachable", async ({ page }) => {
  await prepare(page);
  const top = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/bee.ts"))?.name;
    if (!url) throw Error("Missing bee module");
    const { createBee } = await import(url);
    const root = document.getElementById("root");
    if (!root) throw Error("Missing application root");
    root.style.display = "none";
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 20,
        width: 390,
        offsetTop: 0,
        offsetLeft: 0,
        addEventListener() {},
        removeEventListener() {},
      },
    });
    document.documentElement.dataset.motion = "off";
    const bee = createBee(
      () => {},
      () => 0,
    );
    try {
      bee.action("story");
      const bubbles = document.querySelectorAll(".bee-bubble");
      return bubbles[bubbles.length - 1].getBoundingClientRect().top;
    } finally {
      bee.dispose();
    }
  });
  expect(top).toBeGreaterThanOrEqual(8);
});

test("perched velocity decays equally over the same time at 30 and 60 fps", async ({ page }) => {
  await prepare(page);
  const speeds = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/bee.ts"))?.name;
    if (!url) throw Error("Missing bee module");
    const { createBee } = await import(url);
    const bees = [
      createBee(
        () => {},
        () => 0,
      ),
      createBee(
        () => {},
        () => 0,
      ),
    ];
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) throw Error("No canvas");
    const translate = ctx.translate.bind(ctx);
    let pos = { x: 0, y: 0 };
    ctx.translate = (x, y) => {
      if (ctx.getTransform().isIdentity) pos = { x, y };
      translate(x, y);
    };
    try {
      for (const bee of bees) {
        for (let i = 0; i < 14; i++) bee.update(0.04, 1000 + i * 40);
        bee.draw(ctx);
        bee.flower({ left: pos.x - 5, top: pos.y + 26, width: 10, height: 10 });
        for (let i = 0; i < 30 && !bee.diagnostics.perched; i++) bee.update(0.04, 1560 + i * 40);
        if (!bee.diagnostics.perched || bee.diagnostics.speed === 0)
          throw Error("Perch setup failed");
      }
      const before = bees.map((b) => b.diagnostics.speed);
      bees[0].update(1 / 30, 4000);
      bees[1].update(1 / 60, 4000);
      bees[1].update(1 / 60, 4016.7);
      return bees.map((b, i) => b.diagnostics.speed / before[i]);
    } finally {
      bees.forEach((b) => {
        b.dispose();
      });
    }
  });
  expect(speeds[0]).toBeCloseTo(speeds[1], 6);
});

test("boops have short repeat callbacks; ordinary controls never feed or boop", async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole("button", { name: "Boop the bee", exact: true }).click();
  await expect.poll(() => trigger(page)).toBe("boop");
  const first = await page.locator(".bee-bubble").getAttribute("data-line-id");
  await page.waitForTimeout(4600);
  await page.getByRole("button", { name: "Boop the bee", exact: true }).click();
  await expect.poll(() => trigger(page)).toBe("boop-repeat");
  expect(await page.locator(".bee-bubble").getAttribute("data-line-id")).not.toBe(first);
  await page.locator(".surprise-button").click();
  await page.locator(".model-toggle").first().click();
  await page.locator(".theme-button").click();
  const state = await petState(page);
  expect(state.boops).toBe(2);
  expect(state.fruits).toBe(0);
  expect(state.story).toBe(-1);
});

test("tiny story is opt-in, manual, dismissible and interrupted by a real run", async ({
  page,
}) => {
  await prepare(page, {
    chat: async (route, request) => {
      await delay(600);
      await fulfillChat(route, request);
    },
  });
  const story = page.getByRole("button", { name: "Tell a tiny bee story", exact: true });
  await story.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => trigger(page)).toBe("story");
  const first = await page.locator(".bee-bubble").getAttribute("data-line-id");
  await page.waitForTimeout(3600);
  expect(await page.locator(".bee-bubble").getAttribute("data-line-id")).toBe(first);
  await page.locator(".workspace-lede").click();
  expect((await petState(page)).story).toBe(0);
  await page.getByRole("button", { name: "Next bee story line", exact: true }).click();
  expect((await petState(page)).story).toBe(1);
  await page.getByRole("button", { name: "Next bee story line", exact: true }).click();
  expect((await petState(page)).story).toBe(2);
  await page.getByRole("button", { name: "Finish bee story", exact: true }).click();
  expect((await petState(page)).story).toBe(-1);
  await story.click();
  await page.keyboard.press("Escape");
  expect((await petState(page)).story).toBe(-1);
  await story.click();
  await page.getByRole("button", { name: "Close bee story", exact: true }).click();
  await story.click();
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect.poll(async () => (await petState(page)).story).toBe(-1);
  await expect(page.getByText("6/6 answered", { exact: true })).toBeVisible();
  expect((await petState(page)).queued).toBeLessThanOrEqual(4);
});

test("intentional feeding stays transient, bounded and acknowledges actual eating", async ({
  page,
}) => {
  test.setTimeout(60_000);
  // Hold the injected entropy at the middle of the fruit contract (2 seconds).
  // A one-second fruit can legitimately ripen before reaching a distant bee;
  // this interaction checks actual eating and repeated acknowledgment deterministically.
  await page.addInitScript(() => {
    Math.random = () => 0.5;
  });
  await prepare(page);
  // Let the garden's quiet pose settle, then feed beside its home.
  await page.waitForTimeout(15000);
  const feed = page.getByRole("button", { name: "Feed the bee", exact: true });
  await feed.click();
  expect((await petState(page)).fruits).toBeGreaterThan(0);
  await expect.poll(async () => (await petState(page)).meals, { timeout: 7000 }).toBeGreaterThan(0);
  await page.waitForTimeout(6500);
  await feed.click();
  await expect.poll(async () => (await petState(page)).meals, { timeout: 7000 }).toBeGreaterThan(1);
  await expect.poll(() => trigger(page), { timeout: 10000 }).toBe("feed-repeat");
  for (let i = 0; i < 8; i++) await feed.click();
  expect((await petState(page)).fruits).toBeLessThanOrEqual(3);
  await page.waitForTimeout(3300);
  expect((await petState(page)).fruits).toBe(0);
});

test("off clears all feedback immediately and re-enable starts a clean pet", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "Tell a tiny bee story", exact: true }).click();
  await page.locator(".bee-button").click();
  await expect(page.locator(".bee-home")).toBeHidden();
  expect(await page.locator(".bee-bubble").getAttribute("class")).not.toContain("is-visible");
  const off = await petState(page);
  expect(off.story).toBe(-1);
  expect(off.fruits).toBe(0);
  expect(off.queued).toBe(0);
  await page.locator(".bee-button").click();
  await page.locator(".bee-home summary").click();
  await page.getByRole("button", { name: "Boop the bee", exact: true }).click();
  await expect.poll(() => trigger(page)).toBe("boop");
  expect((await petState(page)).boops).toBe(1);
  await page.locator(".motion-button").click();
  await expect(page.locator(".bee-bubble")).toHaveCount(1);
});

test("slow frames cannot extend fruit lifetime or stale pet commentary", async ({ page }) => {
  await prepare(page);
  await page.locator(".bee-button").click();
  const result = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/bee.ts"))?.name;
    if (!url) throw Error("Missing bee module");
    const { createBee } = await import(url);
    const bee = createBee(
      () => {},
      () => 0,
    );
    try {
      bee.update(0.016, 1000);
      // Let the single arrival expire before isolating explicit actions.
      bee.update(0.04, 7100);
      bee.update(0.04, 12100);
      bee.action("feed");
      const placed = bee.diagnostics.fruits;
      // The animation step remains capped, but 3.1 real seconds have passed.
      bee.update(0.04, 15200);
      const expired = bee.diagnostics.fruits;
      bee.action("boop");
      bee.update(0.04, 22200);
      // A recurring idle may now be fresh; the seven-second-old boop must expire.
      bee.update(0.04, 22500);
      const speech = document.querySelectorAll<HTMLElement>(".bee-bubble")[1];
      return { placed, expired, queued: bee.diagnostics.queued, trigger: speech?.dataset.trigger };
    } finally {
      bee.dispose();
    }
  });
  expect(result.placed).toBe(1);
  expect(result.expired).toBe(0);
  expect(result.queued).toBe(0);
  expect(result.trigger).toBe("idle");
});

test("pet speech protects visible answers without measuring offscreen card contents", async ({
  page,
}) => {
  await prepare(page);
  const measurements = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/arena-motion.ts"))?.name;
    if (!url) throw Error("Missing motion module");
    const { beeAction } = await import(url);
    const card = document.createElement("article");
    card.className = "model-card";
    card.style.cssText = "position:absolute;top:10000px;left:20px;width:260px";
    const answer = document.createElement("div");
    answer.className = "answer-copy";
    answer.textContent = "A visible answer needs room to read.";
    card.appendChild(answer);
    document.body.appendChild(card);
    const original = Element.prototype.getBoundingClientRect;
    let reads = 0;
    Element.prototype.getBoundingClientRect = function () {
      if (card.contains(this) && this !== card) reads++;
      return original.call(this);
    };
    try {
      beeAction("story");
      const offscreenReads = reads;
      card.style.top = "230px";
      beeAction("story");
      const bubble = document.querySelector(".bee-bubble")?.getBoundingClientRect();
      const content = answer.getBoundingClientRect();
      return {
        offscreenReads,
        visibleReads: reads - offscreenReads - 1,
        overlaps:
          bubble &&
          bubble.right > content.left &&
          bubble.left < content.right &&
          bubble.bottom > content.top &&
          bubble.top < content.bottom,
      };
    } finally {
      Element.prototype.getBoundingClientRect = original;
      beeAction("close");
      card.remove();
    }
  });
  expect(measurements.offscreenReads).toBe(0);
  expect(measurements.visibleReads).toBeGreaterThan(0);
  expect(measurements.overlaps).toBe(false);
});

test("automatic idle commentary continues beyond the first two attempts", async ({ page }) => {
  await prepare(page);
  await page.locator(".bee-button").click();
  const triggers = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes("/src/lib/bee.ts"))?.name;
    if (!url) throw Error("Missing bee module");
    const { createBee } = await import(url);
    const random = Math.random;
    Math.random = () => 0;
    const bee = createBee(() => {});
    const spoken: string[] = [];
    try {
      bee.update(0.016, 1000);
      for (let i = 0; i < 6; i++) {
        const time = 7100 + i * 25000;
        bee.update(0.04, time);
        bee.update(0.04, time + 300);
        spoken.push(
          document.querySelectorAll<HTMLElement>(".bee-bubble")[1]?.dataset.trigger ?? "",
        );
      }
      return spoken;
    } finally {
      bee.dispose();
      Math.random = random;
    }
  });
  expect(triggers[0]).toBe("arrival");
  expect(triggers.slice(1)).toEqual(Array(5).fill("idle"));
});

test("model and composer actions get contextual replies without feeding", async ({ page }) => {
  test.setTimeout(60_000);
  for (const [selector, expected] of [
    [".model-toggle", "deselect"],
    ['.preset-button[data-preset="all"]', "preset-all"],
    [".surprise-button", "surprise"],
    [".composer-chip", "starter"],
  ]) {
    await prepare(page);
    await page.locator(selector).first().click();
    await expect.poll(() => trigger(page), { timeout: 8000 }).toBe(expected);
    const state = await petState(page);
    expect(state.fruits).toBe(0);
    expect(state.boops).toBe(0);
    expect(await page.locator(".bee-feedback").textContent()).toBe("");
  }
});

test("specific awards distinguish speed and cost; hovering card body is generic", async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.getByText("6/6 answered", { exact: true })).toBeVisible();
  await page.locator(".bee-controls").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1100);
  // Exercise existing badge routing independently of whichever model wins a mocked timing race.
  const award = page.locator(".answer-award-fastest").first();
  await expect(award).toBeVisible();
  await award.dispatchEvent("pointerover", { pointerType: "mouse" });
  await expect.poll(() => trigger(page), { timeout: 15000 }).toBe("fastest");
  expect(await page.locator(".bee-bubble-text").textContent()).toMatch(/fastest|first|speed/i);
  expect(await page.locator(".bee-bubble-text").textContent()).not.toMatch(/best|SOTA|quality/i);
  await page.waitForTimeout(12500);
  const cheap = page.locator(".answer-award:not(.answer-award-fastest)").first();
  await cheap.dispatchEvent("pointerover", { pointerType: "mouse" });
  await expect.poll(() => trigger(page), { timeout: 5000 }).toBe("cheap");
  expect(await page.locator(".bee-bubble-text").textContent()).toMatch(/cost/i);
});

test("pending model hover expires when leaving; areas do not narrate", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "Boop the bee", exact: true }).click();
  await expect.poll(() => trigger(page)).toBe("boop");
  await page
    .locator(".model-toggle")
    .first()
    .dispatchEvent("pointerover", { pointerType: "mouse" });
  await page.locator(".roster-title").dispatchEvent("pointerover", { pointerType: "mouse" });
  await page.waitForTimeout(4500);
  expect((await petState(page)).queued).toBe(0);
  expect(await page.locator(".bee-bubble").getAttribute("data-trigger")).not.toBe("model");
});

test("copy speaks only on success, export follows a local download, and comparison is intentional", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await prepare(page);
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.getByText("6/6 answered", { exact: true })).toBeVisible();
  await page.waitForTimeout(5500);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error("Mock clipboard denied");
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Copy as Markdown", exact: true }).click();
  await expect(page.getByText("Copy failed", { exact: true })).toBeVisible();
  expect(await page.locator(".bee-bubble").getAttribute("data-trigger")).not.toBe("copy");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    }),
  );
  await page.getByRole("button", { name: "Copy as Markdown", exact: true }).click();
  await page.locator(".bee-home summary").scrollIntoViewIfNeeded();
  await expect.poll(() => trigger(page), { timeout: 8000 }).toBe("copy");
  await page.waitForTimeout(5500);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.md$/);
  await page.locator(".bee-home summary").scrollIntoViewIfNeeded();
  await expect.poll(() => trigger(page), { timeout: 8000 }).toBe("export");
  await page.waitForTimeout(5500);
  await page.getByRole("button", { name: "Compare metrics", exact: true }).click();
  await expect.poll(() => trigger(page), { timeout: 8000 }).toBe("compare");
  expect((await petState(page)).fruits).toBe(0);
});

test("stop and actual errors interrupt stories; queued pet feedback remains bounded", async ({
  page,
}) => {
  await prepare(page, {
    chat: async (route) => {
      await delay(1000);
      await route.fulfill({ status: 400, json: { error: "Mock failure" } });
    },
  });
  await page.getByRole("button", { name: "Tell a tiny bee story", exact: true }).click();
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  expect((await petState(page)).story).toBe(-1);
  await page.getByRole("button", { name: "Stop the table", exact: true }).click();
  await page.locator(".bee-home summary").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await expect.poll(() => trigger(page), { timeout: 8000 }).toBe("cancel");
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.locator(".bee-home summary").scrollIntoViewIfNeeded();
  await expect.poll(() => trigger(page), { timeout: 10000 }).toBe("error");
  const text = await page.locator(".bee-bubble-text").textContent();
  expect(text).not.toMatch(/429|context|NaN|hallucinat/i);
  for (let i = 0; i < 14; i++)
    await page.getByRole("button", { name: "Boop the bee", exact: true }).click();
  const state = await petState(page);
  expect(state.boops).toBe(9);
  expect(state.queued).toBeLessThanOrEqual(4);
  expect(state.recent).toBeLessThanOrEqual(8);
});

test("master mute fades only the music and no bee synth remains", async ({ page }) => {
  await page.addInitScript(() => {
    window.__oscillators = 0;
    const Ctor = window.AudioContext;
    if (Ctor) {
      const original = Ctor.prototype.createOscillator;
      Ctor.prototype.createOscillator = function patched(this: AudioContext, ...args: []) {
        window.__oscillators = (window.__oscillators ?? 0) + 1;
        return original.apply(this, args);
      };
    }
  });
  await prepare(page);
  await page.goto("/");
  const mute = page.getByRole("button", { name: "Background music", exact: true });
  await expect(mute).toHaveAttribute("aria-pressed", "true");

  // A real gesture unlocks the self-hosted music loop.
  await page.locator(".workspace-lede").click();
  await expect
    .poll(() => page.evaluate(() => document.querySelector("audio")?.getAttribute("src") ?? ""))
    .toContain("audio/calm-garden");

  await mute.click();
  await expect(page.getByRole("button", { name: "Background music", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(await page.evaluate(() => localStorage.getItem("model-table:music"))).toBe("false");

  // Bee commentary and feeding must not synthesize any sound effects.
  await page.hover('.model-toggle[aria-label="Grok 4.3"]');
  await page.mouse.click(960, 500);
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => window.__oscillators)).toBe(0);

  await page.getByRole("button", { name: "Background music", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("model-table:music"))).toBe("true");

  // The bee visibility toggle stays independent from the music mute.
  await page.getByRole("button", { name: "Garden bee", exact: true }).click();
  await expect(page.getByRole("button", { name: "Garden bee", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(await page.evaluate(() => localStorage.getItem("model-table:bee"))).toBe("false");
});

test.describe("touch and reduced motion", () => {
  const phone = devices["iPhone 13"];
  test.use({
    viewport: phone.viewport,
    userAgent: phone.userAgent,
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: phone.isMobile,
    hasTouch: phone.hasTouch,
  });
  test("narrow and landscape pet controls are stable, readable and keyboard accessible", async ({
    page,
  }) => {
    await trackBee(page);
    await prepare(page);
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(600);
      const boop = page.getByRole("button", { name: "Boop the bee", exact: true });
      await boop.scrollIntoViewIfNeeded();
      await boop.tap();
      const box = await boop.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
      await expect.poll(() => trigger(page), { timeout: 7000 }).toMatch(/boop/);
      const a = await attachment(page);
      await page.waitForTimeout(600);
      const b = await attachment(page);
      for (const point of [a, b]) {
        expect(point.x).toBeGreaterThanOrEqual(8);
        expect(point.y).toBeGreaterThanOrEqual(8);
        expect(point.right).toBeLessThanOrEqual(viewport.width - 7);
        expect(point.bottom).toBeLessThanOrEqual(viewport.height - 7);
        if (point.y > 9) expect(point.bottom).toBeLessThanOrEqual(point.beeY - 14);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      await page.waitForTimeout(5000);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    const boop = page.getByRole("button", { name: "Boop the bee", exact: true });
    await boop.focus();
    await page.keyboard.press("Space");
    await expect.poll(() => trigger(page)).toMatch(/boop/);
    await expect(boop).toBeFocused();
    await page.getByRole("button", { name: "Feed the bee", exact: true }).tap();
    await expect(page.locator(".bee-home")).toHaveClass(/has-snack/);
    await page.waitForTimeout(3300);
    await expect(page.locator(".bee-home")).not.toHaveClass(/has-snack/);
    await page.locator(".mobile-menu-button").tap();
    await expect(page.locator(".bee-bubble")).not.toHaveClass(/is-visible/);
  });
});
