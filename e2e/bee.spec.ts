import { devices, expect, test } from "@playwright/test";
import { catalog, delay, fulfillChat, fulfillImage, IDS, mockApp } from "./fixtures";

declare global {
  interface Window {
    __beeLines?: { text: string; at: number }[];
    __feedStart?: number;
    __oscillators?: number;
  }
}

const ROSTER_LINES = [
  "Pick your fighters",
  "The lineup smells like pollen",
  "Choose wisely, human",
];
const RESULTS_LINES = ["Judging season", "Where tokens come to be judged", "The answers land here"];
const GEMINI_PATTERN = /Gemini|Nano banana/;
const FRUIT_LINES = [
  "Nom.",
  "Mine.",
  "Sweet.",
  "A whole fruit pop",
  "Consuming 12 tasty tokens",
  "In my training data",
  "Nectar: original reward signal",
  "Reward function: yum",
];
const IDLE_LINES = [
  "Bzzzzz",
  "Tiny wings, big mood",
  "I am tiny chaos with wings",
  "Dreaming in embeddings",
  "My context window is a thimble",
  "Overfitting to this flower",
  "Temperature: bee",
  "Running on 2 watts of spite",
  "My weights are mostly pollen",
  "Trained on 10,000 flowers",
  "0 parameters, all vibes",
  "Hallucinating nectar again",
  "My loss function is honey",
  "Batch size: one bee",
  "Quantized to 8-bit buzz",
  "Attention is all I need",
  "Fine-tuned on garden data",
  "Gradient descending to lunch",
];

async function bubbleState(page: import("@playwright/test").Page) {
  return page.locator(".bee-bubble").evaluate((el) => ({
    visible: el.classList.contains("is-visible"),
    text: el.querySelector(".bee-bubble-text")?.textContent ?? "",
  }));
}

// Hover a target until its line actually shows; cooldowns and idle teasers can block
// the first attempt, so re-enter the zone after the desktop gap (2.6s) expires.
async function hoverLine(page: import("@playwright/test").Page, selector: string, pattern: RegExp) {
  const target = page.locator(selector).first();
  const deadline = Date.now() + 24_000;
  for (;;) {
    await page.mouse.move(8, 8);
    await page.waitForTimeout(2800);
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error(`No bounding box for ${selector}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    try {
      await expect
        .poll(
          async () => {
            const state = await bubbleState(page);
            return state.visible && pattern.test(state.text) ? state.text : null;
          },
          { timeout: 1500 },
        )
        .not.toBeNull();
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
    }
  }
}

test("mouse hover tells model memes and area jokes without spamming", async ({ page }) => {
  test.setTimeout(90_000);
  await mockApp(page);
  await page.goto("/");
  await page.locator(".model-toggle").first().waitFor();

  await hoverLine(page, ".roster-title", new RegExp(`^(${ROSTER_LINES.join("|")})$`));

  // Gemini lives in the collapsed extra-models region.
  await page.getByRole("button", { name: /^More models/ }).click();
  await page.locator('.model-toggle[aria-label="Gemini 3.8 Flash"]').waitFor({ state: "visible" });
  await hoverLine(page, '.model-toggle[aria-label="Gemini 3.8 Flash"]', GEMINI_PATTERN);
  const geminiLine = (await bubbleState(page)).text;

  // Rapidly hovering other models must not cut in while the Gemini line holds.
  for (const name of ["GPT-5.4 Nano", "Grok 4.3", "DeepSeek V4.1 Flash"]) {
    const box = await page.locator(`.model-toggle[aria-label="${name}"]`).boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.waitForTimeout(900);
  const afterSpam = await bubbleState(page);
  expect(afterSpam.visible).toBe(true);
  expect(afterSpam.text).toBe(geminiLine);

  await hoverLine(page, "#results .results-toolbar", new RegExp(`^(${RESULTS_LINES.join("|")})$`));
});

test("fastest and cheapest badges get speed and cost commentary", async ({ page }) => {
  test.setTimeout(90_000);
  const prices = catalog.map((model, index) =>
    index === 1
      ? {
          ...model,
          pricing: Object.fromEntries(
            Object.entries(model.pricing).map(([key, value]) => [key, String(Number(value) * 0.1)]),
          ),
        }
      : model,
  );
  await mockApp(page, {
    catalog: prices,
    chat: async (route, request) => {
      await delay(request.model === IDS[0] ? 60 : 350);
      await fulfillChat(route, request);
    },
    image: async (route) => {
      // Keep the image well behind the 60ms text winner: under CI load, timer
      // jitter can otherwise invert an 80ms-vs-60ms latency race.
      await delay(300);
      await fulfillImage(route);
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.getByText("6/6 answered", { exact: true })).toBeVisible();
  const fastest = page.locator(`article[data-model-id="${IDS[0]}"]`);
  const cheapest = page.locator(`article[data-model-id="${IDS[1]}"]`);
  await expect(fastest.locator(".answer-award-fastest")).toBeVisible();
  await expect(cheapest.locator(".answer-award:not(.answer-award-fastest)")).toBeVisible();
  // Let the winner climax line finish so badge hovers start from a quiet bubble.
  await expect(page.locator(".bee-bubble")).not.toHaveClass(/is-visible/, { timeout: 10_000 });

  await hoverLine(page, `article[data-model-id="${IDS[0]}"] .answer-award-fastest`, /GPT/);
  await hoverLine(
    page,
    `article[data-model-id="${IDS[1]}"] .answer-award:not(.answer-award-fastest)`,
    /DeepSeek/,
  );
});

test("story mode opens readable and any tap continues it at a readable pace", async ({ page }) => {
  test.setTimeout(60_000);
  await mockApp(page);
  await page.goto("/");
  await page.locator(".model-toggle").first().waitFor();
  const bubble = page.locator(".bee-bubble");
  const text = page.locator(".bee-bubble-text");

  // A ghost card is open surface: clicks there feed the bee without touching controls.
  const ghost = page.locator(".ghost-card").first();
  await ghost.scrollIntoViewIfNeeded();
  const ghostBox = await ghost.boundingBox();
  if (!ghostBox) throw new Error("No ghost card box");
  const tap = { x: ghostBox.x + ghostBox.width / 2, y: ghostBox.y + ghostBox.height / 2 };

  // Feed the bee so its bubble reveals where it is (bubble sits +20x, -42y from the bee).
  await page.mouse.click(tap.x, tap.y);
  await expect(bubble).toHaveClass(/is-visible/, { timeout: 8000 });
  await expect
    .poll(
      async () => {
        const state = await bubbleState(page);
        if (state.visible && state.text === "OH. YOU CLICKED.") return state.text;
        const box = await bubble.boundingBox();
        if (box) await page.mouse.click(box.x - 20, box.y + 42);
        return (await bubbleState(page)).text;
      },
      { timeout: 12_000, intervals: [400] },
    )
    .toBe("OH. YOU CLICKED.");

  // Regression: the opening line used to flash for a single frame.
  await page.waitForTimeout(1500);
  expect((await bubbleState(page)).text).toBe("OH. YOU CLICKED.");

  // Tap-to-continue: each tap on open surface advances exactly one line, immediately.
  await page.mouse.click(tap.x, tap.y);
  await expect(text).toHaveText("You want a story?", { timeout: 1000 });
  await page.mouse.click(tap.x, tap.y);
  await expect(text).toHaveText("Fine.", { timeout: 1000 });

  // Without taps, each line holds a readable beat (readTime floor is 2.2s).
  const heldFrom = Date.now();
  await expect(text).toHaveText("Wing down.", { timeout: 6000 });
  expect(Date.now() - heldFrom).toBeGreaterThanOrEqual(1900);
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
  await mockApp(page);
  await page.goto("/");
  const mute = page.getByRole("button", { name: "Mute sound", exact: true });
  await expect(mute).toHaveAttribute("aria-pressed", "true");

  // A real gesture unlocks the self-hosted music loop.
  await page.locator(".workspace-lede").click();
  await expect
    .poll(() => page.evaluate(() => document.querySelector("audio")?.getAttribute("src") ?? ""))
    .toContain("audio/calm-garden");

  await mute.click();
  await expect(page.getByRole("button", { name: "Unmute sound", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(await page.evaluate(() => localStorage.getItem("model-table:music"))).toBe("false");

  // Bee commentary and feeding must not synthesize any sound effects.
  await page.hover('.model-toggle[aria-label="Grok 4.3"]');
  await page.mouse.click(960, 500);
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => window.__oscillators)).toBe(0);

  await page.getByRole("button", { name: "Unmute sound", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("model-table:music"))).toBe("true");

  // The bee visibility toggle stays independent from the music mute.
  await page.getByRole("button", { name: "Send the bee away", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Release the garden bee", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => localStorage.getItem("model-table:bee"))).toBe("false");
});

test.describe("touch devices", () => {
  const iphone = devices["iPhone 13"];
  test.use({
    viewport: iphone.viewport,
    userAgent: iphone.userAgent,
    deviceScaleFactor: iphone.deviceScaleFactor,
    isMobile: iphone.isMobile,
    hasTouch: iphone.hasTouch,
  });

  test("feeding comments stay paced and hover jokes never fire on tap", async ({ page }) => {
    test.setTimeout(60_000);
    await mockApp(page);
    await page.goto("/");
    expect(
      await page.evaluate(() => matchMedia("(hover: none) and (pointer: coarse)").matches),
    ).toBe(true);
    await page.locator(".model-toggle").first().waitFor();
    await page.evaluate(() => {
      window.__beeLines = [];
      const bubble = document.querySelector(".bee-bubble");
      const text = bubble?.querySelector(".bee-bubble-text");
      if (!bubble || !text) return;
      new MutationObserver(() => {
        if (bubble.classList.contains("is-visible")) {
          window.__beeLines?.push({ text: text.textContent ?? "", at: performance.now() });
        }
      }).observe(text, { childList: true, characterData: true, subtree: true });
    });

    // Tap below the bee's wander zone so feeding never accidentally starts the story.
    // Keep feeding across the whole window: the 5s touch gap means a burst of taps
    // correctly yields one comment, so spaced taps are what prove the pacing.
    const size = page.viewportSize();
    if (!size) throw new Error("No viewport");
    await page.evaluate(() => {
      window.__feedStart = performance.now();
    });
    for (let index = 0; index < 9; index++) {
      await page.touchscreen.tap(size.width / 2, size.height * 0.68);
      await page.waitForTimeout(1800);
    }
    await page.waitForFunction(() => performance.now() - (window.__feedStart ?? 0) > 18_000);

    const lines = await page.evaluate(() => window.__beeLines ?? []);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const allowed = new Set([...FRUIT_LINES, ...IDLE_LINES]);
    for (const line of lines) expect(allowed.has(line.text)).toBe(true);
    expect(lines.some((line) => FRUIT_LINES.includes(line.text))).toBe(true);
    for (let index = 1; index < lines.length; index++) {
      expect(lines[index].at - lines[index - 1].at).toBeGreaterThanOrEqual(3900);
    }
  });
});
