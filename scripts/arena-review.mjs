import assert from "node:assert/strict";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { CORS, delay, fulfillChat, IDS, mockApp } from "../e2e/fixtures.ts";

async function prepare(page) {
  const state = await mockApp(page, {
    chat: async (route, request) => {
      await delay(850);
      await fulfillChat(route, request, {
        choices: [
          {
            message: {
              content:
                "Every model brings a different lens. A useful comparison asks the same question, preserves the original answers, and makes the tradeoffs visible.\n\nSpeed tells you how soon an answer arrived. Tokens describe the reported usage. Pollen estimates use the live provider prices.\n\nTry a question that needs judgment, imagination, or a clear explanation, then compare what each model notices. ".repeat(
                  3,
                ),
            },
          },
        ],
      });
    },
    image: async (route) => {
      await delay(900);
      await route.fulfill({
        headers: { ...CORS, "x-usage-completion-image-tokens": "1" },
        path: "public/art/pollinations-garden-day.webp",
        contentType: "image/webp",
      });
    },
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1400);
  await expect(page.locator("html")).toHaveAttribute("data-motion-engine", "gsap");
  return state;
}

async function settle(page) {
  await page.waitForTimeout(1000);
  await page.waitForFunction(() => document.querySelector(".pixel-transition-grid")?.hidden);
}

export async function reviewFrontend() {
  const output = ".local/visual-review";
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const report = {
    dataSource: "Authored responses and the original local garden image; no live requests.",
    widths: [],
    captures: [],
    errors: [],
  };
  try {
    const state = await prepare(page);
    await page.getByRole("button", { name: "Run the table", exact: true }).click();
    await expect(page.locator('article[data-status="done"]')).toHaveCount(6);
    await settle(page);
    // Reveal every scroll entrance before capturing. Rendering is forced only in QA captures.
    for (const card of await page.locator(".comparison-grid > .model-column").all()) {
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(180);
    }
    await settle(page);
    await page.addStyleTag({ content: ".model-card { content-visibility: visible; }" });
    for (const theme of ["day", "night"]) {
      if (theme === "night") {
        await page.locator(".theme-button").dispatchEvent("click");
        await settle(page);
      }
      for (const width of [320, 390, 768, 1024, 1440, 1680, 1920]) {
        await page.setViewportSize({ width, height: width >= 1440 ? 1000 : 844 });
        await page.waitForTimeout(250);
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          content: document.documentElement.scrollWidth,
          columns: getComputedStyle(
            document.querySelector(".comparison-grid"),
          ).gridTemplateColumns.split(" ").length,
        }));
        assert.equal(geometry.content, width);
        report.widths.push({ theme, ...geometry });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.evaluate(() =>
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
      );
      await page.waitForTimeout(800);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${output}/desktop-${theme}.png`, fullPage: true });
      report.captures.push(`desktop-${theme}.png`);
      await copyFile(
        `${output}/desktop-${theme}.png`,
        theme === "day" ? "docs/screenshot.png" : "docs/screenshot-night.png",
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${output}/phone-composer-${theme}.png` });
      await page.locator("#results").evaluate((node) => node.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${output}/phone-answers-${theme}.png` });
      report.captures.push(`phone-composer-${theme}.png`, `phone-answers-${theme}.png`);
      if (theme === "day") {
        await copyFile(
          `${output}/phone-composer-${theme}.png`,
          "docs/screenshot-mobile-composer.png",
        );
        await copyFile(`${output}/phone-answers-${theme}.png`, "docs/screenshot-mobile.png");
      }
    }
    const image = page.getByRole("button", { name: "View FLUX.1 Schnell image", exact: true });
    await image.focus();
    await image.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(image).toBeFocused();
    report.errors = [
      ...state.pageErrors,
      ...state.consoleErrors,
      ...(await page.evaluate(() => window.__unhandledRejections ?? [])),
    ];
    assert.deepEqual(report.errors, []);
  } finally {
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
  }
  console.log(
    JSON.stringify({ widths: report.widths, captures: report.captures, evidence: output }),
  );
}

export async function reviewMotion() {
  const output = ".local/motion-review";
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
  });
  const report = {
    dataSource: "Mock requests; no live Pollen spent.",
    method:
      "Headless Chromium rAF interval samples. No screenshots or video during profiling. This does not establish sustained frame rate.",
    profiles: [],
    captures: [],
    errors: [],
  };
  const profile = async (name, action, duration = 1100) => {
    const measurement = page.evaluate(async (milliseconds) => {
      const intervals = [],
        tasks = [];
      const observer = new PerformanceObserver((list) => {
        tasks.push(...list.getEntries().map((entry) => entry.duration));
      });
      observer.observe({ entryTypes: ["longtask"] });
      await new Promise((resolve) => {
        let previous = performance.now();
        const start = previous;
        const sample = (now) => {
          intervals.push(now - previous);
          previous = now;
          if (now - start < milliseconds) requestAnimationFrame(sample);
          else resolve();
        };
        requestAnimationFrame(sample);
      });
      observer.disconnect();
      return { intervals: intervals.slice(1), longTasks: tasks };
    }, duration);
    await action();
    const data = await measurement;
    const sorted = [...data.intervals].sort((a, b) => a - b);
    report.profiles.push({
      name,
      samples: sorted.length,
      medianFrameMs: sorted[Math.floor(sorted.length / 2)],
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
      maxFrameMs: sorted.at(-1),
      framesOver34Ms: sorted.filter((value) => value > 34).length,
      longTasks: data.longTasks,
    });
  };
  try {
    const state = await prepare(page);
    await profile("ambient pollen", async () => {});
    await profile("lineup Flip and drawer", () =>
      page.getByRole("button", { name: "All models", exact: true }).dispatchEvent("click"),
    );
    await profile("lineup reversal", () =>
      page.getByRole("button", { name: "Core 6", exact: true }).dispatchEvent("click"),
    );
    await profile("pixel theme curtain", () =>
      page.locator(".theme-button").dispatchEvent("click"),
    );
    await profile(
      "actual pending requests",
      () => page.getByRole("button", { name: "Run the table", exact: true }).click(),
      2700,
    );
    await expect(page.locator('article[data-status="done"]')).toHaveCount(6);
    const card = page.locator(`article[data-model-id="${IDS[0]}"]`);
    await card.scrollIntoViewIfNeeded();
    await profile("pointer card tilt", async () => {
      const rect = await card.boundingBox();
      await page.mouse.move(rect.x + 20, rect.y + 30);
      await page.mouse.move(rect.x + rect.width - 20, rect.y + 100, { steps: 12 });
    });
    // Capture after all timing sessions have completed.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.locator(".theme-button").dispatchEvent("click");
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${output}/pixel-curtain.png` });
    await settle(page);
    await page.getByRole("button", { name: "Surprise me", exact: true }).dispatchEvent("click");
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${output}/pollen-burst.png` });
    report.captures.push("pixel-curtain.png", "pollen-burst.png");
    await page.getByRole("button", { name: "Pause animations", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    assert.equal(
      await page.evaluate(
        () =>
          window.gsap.globalTimeline
            .getChildren(true, true, false)
            .filter((animation) => animation.isActive()).length,
      ),
      0,
    );
    report.errors = [...state.pageErrors, ...state.consoleErrors];
    assert.deepEqual(report.errors, []);
  } finally {
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(
    JSON.stringify({ profiles: report.profiles, captures: report.captures, evidence: output }),
  );
}
