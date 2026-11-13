// Repeatable local QA. Mock API calls; no traces, recording, or credentials.
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, devices } from "@playwright/test";
import { delay, fulfillChat, fulfillImage, mockApp } from "../e2e/fixtures.ts";

const label = process.argv[2] ?? "after";
const output = `.local/bee-review/${label}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = {
  label,
  method:
    "Headless Chromium; rAF intervals + Long Tasks; 3 repeats, 2.4s each. 4x CPU emulation is not a phone.",
  profiles: [],
  observations: [],
};
for (const [device, options, rate] of [
  ["desktop", { viewport: { width: 1440, height: 1000 } }, 1],
  ["phone", devices["iPhone 13"], 1],
  ["phone-cpu4", devices["iPhone 13"], 4],
]) {
  const context = await browser.newContext({ ...options, baseURL: "http://127.0.0.1:5173" });
  const page = await context.newPage();
  const state = await mockApp(page, {
    chat: async (route, request) => {
      await delay(180);
      await fulfillChat(route, request);
    },
    image: async (route) => {
      await delay(220);
      await fulfillImage(route);
    },
  });
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.translate;
    CanvasRenderingContext2D.prototype.translate = function (x, y) {
      if (this.canvas.id === "pollen-celebration" && this.getTransform().isIdentity)
        window.__petPosition = { x, y };
      return original.call(this, x, y);
    };
  });
  await page.reload();
  await page.waitForTimeout(1700);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  const interact = async (kind) => {
    const home = page.locator(".bee-home");
    if ((await home.count()) && !(await home.getAttribute("open")))
      await home.locator("summary").click();
    const button = page.getByRole("button", {
      name: kind === "boop" ? "Boop the bee" : "Feed the bee",
      exact: true,
    });
    if (await button.count()) {
      await button.click();
      return;
    }
    if (kind === "boop")
      await page.evaluate(() => {
        const p = window.__petPosition;
        if (p)
          document.body.dispatchEvent(
            new MouseEvent("click", { bubbles: true, clientX: p.x, clientY: p.y }),
          );
      });
    else await page.mouse.click(80, 470);
  };
  for (const scenario of ["idle", "scroll", "boop", "feeding", "completion", "theme"]) {
    // Isolate scenarios: the old auto-story must not turn subsequent feeding into Next.
    await page.reload();
    await page.waitForTimeout(1700);
    const combined = { frames: [], tasks: [], bubbleTravel: [] };
    for (let repeat = 0; repeat < 3; repeat++) {
      const measurement = page.evaluate(async () => {
        const frames = [],
          tasks = [],
          bubbleTravel = [];
        const observer = new PerformanceObserver((list) =>
          tasks.push(...list.getEntries().map((e) => e.duration)),
        );
        observer.observe({ entryTypes: ["longtask"] });
        await new Promise((resolve) => {
          let previous, lastBubble;
          const start = performance.now();
          const sample = (now) => {
            if (previous) frames.push(now - previous);
            previous = now;
            const bubble = document.querySelector(".bee-bubble.is-visible");
            if (bubble) {
              const t = getComputedStyle(bubble).transform;
              if (t !== "none") {
                const m = new DOMMatrix(t);
                if (lastBubble)
                  bubbleTravel.push(Math.hypot(m.m41 - lastBubble.x, m.m42 - lastBubble.y));
                lastBubble = { x: m.m41, y: m.m42 };
              }
            } else lastBubble = undefined;
            if (now - start < 2400) requestAnimationFrame(sample);
            else resolve();
          };
          requestAnimationFrame(sample);
        });
        observer.disconnect();
        return { frames, tasks, bubbleTravel };
      });
      if (scenario === "scroll")
        await page.evaluate(() =>
          window.scrollBy({ top: scrollY > 500 ? -650 : 650, behavior: "smooth" }),
        );
      if (scenario === "boop") await interact("boop");
      if (scenario === "feeding") {
        for (let i = 0; i < 3; i++) {
          await interact("feed");
          await page.waitForTimeout(180);
        }
      }
      if (scenario === "completion")
        await page
          .getByRole("button", { name: "Run the table", exact: true })
          .dispatchEvent("click");
      if (scenario === "theme") await page.locator(".theme-button").dispatchEvent("click");
      const data = await measurement;
      for (const key of Object.keys(combined)) combined[key].push(...data[key]);
    }
    const sorted = combined.frames.sort((a, b) => a - b);
    const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    report.profiles.push({
      device,
      rate,
      scenario,
      samples: sorted.length,
      median: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      max: sorted.at(-1),
      over25: sorted.filter((x) => x > 25).length,
      over34: sorted.filter((x) => x > 34).length,
      longTasks: combined.tasks,
      bubbleTravelPx: combined.bubbleTravel.reduce((a, b) => a + b, 0),
    });
  }
  await page.screenshot({ path: `${output}/${device}.png` });
  report.observations.push({
    device,
    errors: [...state.consoleErrors, ...state.pageErrors],
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  });
  await context.close();
}
await browser.close();
await writeFile(`${output}/profile.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
