import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  CORS,
  catalog,
  delay,
  fulfillChat,
  fulfillImage,
  IDS,
  mockApp,
  TEST_KEY,
} from "./fixtures";

test("compares six models with stable cards, correct costs, sorting, export, and private history", async ({
  page,
}) => {
  const prices = catalog.map((model, index) =>
    index === 0
      ? {
          ...model,
          pricing: { ...model.pricing, promptTextTokens: "0", completionTextTokens: "0" },
        }
      : model,
  );
  const state = await mockApp(page, {
    catalog: prices,
    chat: async (route, request) => {
      await delay(request.model === IDS[0] ? 600 : 80);
      if (request.model === IDS[3])
        await fulfillChat(route, request, {
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 200,
            completion_tokens_details: { reasoning_tokens: 80 },
          },
        });
      else if (request.model === IDS[1])
        await fulfillChat(route, request, {
          usage: {
            prompt_tokens: 100,
            completion_tokens: 200,
            total_tokens: 300,
            prompt_tokens_details: { cached_tokens: 30 },
          },
        });
      else await fulfillChat(route, request);
    },
    image: async (route) => {
      await delay(80);
      await fulfillImage(route);
    },
  });
  const run = page.getByRole("button", { name: "Run the table", exact: true });
  await expect(run).toBeEnabled();
  await run.click();
  const cards = page.locator("article[data-model-id]");
  await expect(cards).toHaveCount(6);
  const pendingHeights = await cards.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().height),
  );
  await expect(page.locator('article[data-status="done"]')).toHaveCount(6);
  const finalHeights = await cards.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().height),
  );
  finalHeights.forEach((height, index) => {
    expect(height).toBeCloseTo(pendingHeights[index], 2);
  });
  const card = (id: string) => page.locator(`article[data-model-id="${id}"]`);
  expect(Number(await card(IDS[0]).getAttribute("data-cost"))).toBe(0);
  expect(Number(await card(IDS[3]).getAttribute("data-cost"))).toBeCloseTo(0.0003, 10);
  expect(Number(await card(IDS[4]).getAttribute("data-cost"))).toBeCloseTo(0.0005, 10);
  expect(Number(await card(IDS[1]).getAttribute("data-cost"))).toBeCloseTo(0.000473, 10);
  await expect(card(IDS[3])).toContainText("+80 reasoning");
  await expect(card(IDS[0])).toContainText("served:");
  await expect(page.getByText("6/6 answered", { exact: true })).toBeVisible();
  const firstDispatches = state.dispatches.filter(
    (item, index, all) => all.findIndex((other) => other.model === item.model) === index,
  );
  for (let index = 1; index < firstDispatches.length; index++)
    expect(firstDispatches[index].at - firstDispatches[index - 1].at).toBeGreaterThanOrEqual(175);

  await card(IDS[0]).getByRole("button", { name: "Expand", exact: true }).click();
  await expect
    .poll(async () => (await card(IDS[0]).boundingBox())?.height ?? 0)
    .toBeGreaterThan(pendingHeights[0]);
  await card(IDS[0]).getByRole("button", { name: "Collapse", exact: true }).click();
  await expect
    .poll(async () => (await card(IDS[0]).boundingBox())?.height ?? 0)
    .toBeCloseTo(pendingHeights[0], 2);
  const sort = page.getByRole("combobox", { name: "Sort results" });
  await sort.selectOption("cost");
  await expect(cards.first()).toHaveAttribute("data-model-id", IDS[0]);
  await sort.selectOption("provider");
  await expect(cards.first()).toHaveAttribute("data-model-id", IDS[5]);
  await sort.selectOption("latency");
  const values = await cards.evaluateAll((items) =>
    items.map((item) => Number(item.getAttribute("data-latency-ms"))),
  );
  expect(values).toEqual([...values].sort((a, b) => a - b));
  await sort.selectOption("finish");
  await expect(cards.first()).toHaveAttribute("data-model-id", IDS[1]);
  await sort.selectOption("roster");
  await expect(cards.first()).toHaveAttribute("data-model-id", IDS[0]);
  await page.getByRole("button", { name: "GLM 5.3 Flash", exact: true }).click();
  await expect(cards).toHaveCount(6);
  await expect(page.getByText("6/6 answered", { exact: true })).toBeVisible();

  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          window.__copiedMarkdown = text;
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Copy as Markdown", exact: true }).click();
  expect(await page.evaluate(() => window.__copiedMarkdown)).toContain("Reasoning tokens: 80");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  expect(await readFile(path ?? "", "utf8")).toContain("Served model:");

  for (let index = 0; index < 5; index++) {
    await page.getByRole("button", { name: "Re-run GPT-5.4 Nano", exact: true }).click();
    await expect(run).toBeEnabled();
    await expect(card(IDS[0])).toHaveAttribute("data-status", "done");
  }
  const history = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("model-table:recent:v1") ?? "[]"),
  );
  expect(history).toHaveLength(5);
  expect(JSON.stringify(history)).not.toContain(TEST_KEY);
  expect(JSON.stringify(history)).not.toContain("A useful, thoughtful answer");
  expect(history[0].models[0]).not.toHaveProperty("text");
  await page.getByLabel("Your question", { exact: true }).fill("A different question");
  await page.locator(".recent-questions summary").click();
  await page
    .getByRole("button", { name: /^Restore recent question:/ })
    .first()
    .click();
  await expect(page.getByLabel("Your question", { exact: true })).toHaveValue(
    "What do you really think of humans?",
  );
  await expect(page.getByLabel("Your question", { exact: true })).toBeFocused();
  await page.locator(".recent-questions summary").click();
  await page.getByRole("button", { name: "Clear recent questions", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("model-table:recent:v1"))).toBeNull();
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});

test("retries network, 5xx and image 429 once, honors Retry-After, and reuses the image seed", async ({
  page,
}) => {
  const state = await mockApp(page, {
    chat: async (route, request, attempt) => {
      if (request.model === IDS[0] && attempt === 1) await route.abort("internetdisconnected");
      else if (request.model === IDS[1] && attempt === 1)
        await route.fulfill({
          status: 503,
          headers: CORS,
          json: { error: { message: "Unavailable" } },
        });
      else if (request.model === IDS[2])
        await route.fulfill({
          status: 429,
          headers: CORS,
          json: { error: { message: "Rate limit" } },
        });
      else await fulfillChat(route, request);
    },
    image: async (route, attempt) => {
      if (attempt === 1)
        await route.fulfill({
          status: 429,
          headers: { ...CORS, "retry-after": "2" },
          json: { error: { message: "Rate limit" } },
        });
      else await fulfillImage(route);
    },
  });
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.locator('article[data-status="pending"]')).toHaveCount(0);
  await expect(page.locator('article[data-status="done"]')).toHaveCount(5);
  await expect(page.locator(`article[data-model-id="${IDS[2]}"]`)).toContainText("Rate limited");
  for (const id of [IDS[0], IDS[1], IDS[2], IDS[5]]) expect(state.attempts.get(id)).toBe(2);
  const imageCalls = state.dispatches.filter((item) => item.model === IDS[5]);
  expect(imageCalls[1].at - imageCalls[0].at).toBeGreaterThanOrEqual(1900);
  expect(imageCalls[1].url).toBe(imageCalls[0].url);
  await page.getByRole("button", { name: "Re-run FLUX.1 Schnell", exact: true }).click();
  await expect(page.locator(`article[data-model-id="${IDS[5]}"]`)).toHaveAttribute(
    "data-status",
    "done",
  );
  expect(state.dispatches.filter((item) => item.model === IDS[5])[2].url).toBe(imageCalls[0].url);
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});

test("handles paid notices, output limits, provider filters and invalid responses without extra requests", async ({
  page,
}) => {
  const state = await mockApp(page, {
    chat: async (route, request) => {
      if (request.model === IDS[9])
        await fulfillChat(route, request, {
          choices: [
            {
              message: {
                content:
                  "The account behind this API key doesn't have enough credits. This model needs paid Pollen. Please top up.",
              },
            },
          ],
        });
      else if (request.model === IDS[10])
        await route.fulfill({
          status: 400,
          headers: CORS,
          json: {
            error: {
              code: "output_token_limit_exceeded",
              message: "The model exhausted its output token limit before producing an answer.",
            },
          },
        });
      else if (request.model === IDS[11])
        await route.fulfill({
          status: 400,
          headers: CORS,
          json: {
            error: {
              message: "400 Bad Request",
              details: {
                upstreamBody: JSON.stringify({ choices: [{ finish_reason: "content_filter" }] }),
              },
            },
          },
        });
      else if (request.model === IDS[12])
        await route.fulfill({
          status: 401,
          headers: CORS,
          json: { error: { message: "Unauthorized" } },
        });
      else if (request.model === IDS[6])
        await route.fulfill({
          headers: CORS,
          contentType: "application/json",
          body: "{broken json",
        });
      else await fulfillChat(route, request);
    },
  });
  await page.getByRole("button", { name: "All models", exact: true }).click();
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(13);
  await expect(page.locator('article[data-status="pending"]')).toHaveCount(0);
  await expect(page.getByText("Needs paid Pollen", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("link", { name: "Top up Pollen", exact: true })).toHaveAttribute(
    "href",
    "https://enter.pollinations.ai/top-up",
  );
  await expect(page.getByText("Output limit reached", { exact: true })).toBeVisible();
  await expect(page.getByText("Filtered by provider", { exact: true })).toBeVisible();
  await expect(page.getByText("Reconnect Pollen", { exact: true })).toBeVisible();
  for (const id of [IDS[6], IDS[9], IDS[10], IDS[11], IDS[12]])
    expect(state.attempts.get(id)).toBe(1);
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});

test("enforces text and image deadlines and leaves no pending cards", async ({ page }) => {
  await page.clock.install();
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const state = await mockApp(page, {
    chat: async (route, request) => {
      await held;
      await fulfillChat(route, request).catch(() => {});
    },
    image: async (route) => {
      await held;
      await fulfillImage(route).catch(() => {});
    },
  });
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect.poll(() => state.dispatches.length).toBe(6);
  await page.clock.fastForward(76_000);
  await expect(page.getByText("Timed out", { exact: true })).toHaveCount(5);
  await expect(page.locator('article[data-status="pending"]')).toHaveCount(1);
  await page.clock.fastForward(45_000);
  await expect(page.getByText("Timed out", { exact: true })).toHaveCount(6);
  await expect(page.locator('article[data-status="pending"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run the table", exact: true })).toBeEnabled();
  release();
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});

test("stops queued requests and prevents old responses replacing a new run", async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const state = await mockApp(page, {
    chat: async (route, request, attempt) => {
      if (attempt === 1) {
        await held;
        await fulfillChat(route, request).catch(() => {});
      } else
        await fulfillChat(route, request, {
          choices: [{ message: { content: "The new run's answer." } }],
        });
    },
    image: async (route) => {
      await held;
      await fulfillImage(route).catch(() => {});
    },
  });
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect.poll(() => state.dispatches.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Stop the table", exact: true }).click();
  const callsAtStop = state.dispatches.length;
  await expect(page.getByText("Stopped", { exact: true })).toHaveCount(6);
  await delay(600);
  expect(state.dispatches.length).toBe(callsAtStop);
  for (const name of [
    "DeepSeek V4.1 Flash",
    "Llama 3.3 70B",
    "Grok 4.3",
    "GLM 5.3 Flash",
    "FLUX.1 Schnell",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await page.getByLabel("Your question", { exact: true }).fill("A new run");
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect(page.locator('article[data-status="done"]')).toHaveCount(1);
  release();
  await expect(page.locator("article")).toContainText("The new run's answer.");
  await expect(page.getByRole("heading", { name: "“A new run”", exact: true })).toBeVisible();
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});

test("disconnecting Pollen stops active and queued requests", async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const state = await mockApp(page, {
    chat: async (route, request) => {
      await held;
      await fulfillChat(route, request).catch(() => {});
    },
    image: async (route) => {
      await held;
      await fulfillImage(route).catch(() => {});
    },
  });
  await page.getByRole("button", { name: "Run the table", exact: true }).click();
  await expect.poll(() => state.dispatches.length).toBeGreaterThan(0);
  await page.evaluate(() => {
    const element = document.querySelector("polli-connect") as HTMLElement & {
      apiKey: string | null;
    };
    element.apiKey = null;
  });
  await expect(page.getByText("Stopped", { exact: true })).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Run the table", exact: true })).toBeDisabled();
  const atDisconnect = state.dispatches.length;
  await delay(600);
  expect(state.dispatches.length).toBe(atDisconnect);
  release();
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});

test("uses live health, preserves auth during a delayed element upgrade, and works on mobile with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const models = catalog.map((model, index) =>
    index === 2
      ? { ...model, health: { status: "down" } }
      : index === 4
        ? { ...model, health: { status: "degraded" } }
        : model,
  );
  const state = await mockApp(page, { catalog: models, connectDelayMs: 1200 });
  const run = page.getByRole("button", { name: "Run the table", exact: true });
  await expect(run).toBeEnabled();
  await expect(page.getByRole("button", { name: "Llama 3.3 70B", exact: true })).toBeDisabled();
  await expect(page.getByText("5 selected", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "GLM 5.3 Flash", exact: true })).toHaveAttribute(
    "title",
    /degraded/,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const bar = await run.boundingBox();
  expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual(844);
  await page.evaluate(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      configurable: true,
      value: () => {
        throw new Error("Storage unavailable");
      },
    });
  });
  await run.click();
  await expect(page.locator('article[data-status="done"]')).toHaveCount(5);
  expect(
    await page
      .locator("article")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const gridColumns = await page
    .locator("article")
    .first()
    .evaluate(
      (element) =>
        getComputedStyle(element.parentElement ?? element).gridTemplateColumns.split(" ").length,
    );
  expect(gridColumns).toBe(1);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
});
