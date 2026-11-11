import type { Page, Route } from "@playwright/test";

export const IDS = [
  "openai/gpt-5.4-nano",
  "deepseek/deepseek-v4.1-flash",
  "meta/llama-3.3-70b-instruct",
  "x-ai/grok-4.3",
  "z-ai/glm-5.3-flash",
  "black-forest-labs/flux.1-schnell",
  "nvidia/nemotron-3.5-lightning",
  "minimax/minimax-m3.1-flash",
  "openai/gpt-oss-20b",
  "anthropic/claude-haiku-4.5",
  "qwen/qwen3.8-flash",
  "google/gemini-3.8-flash",
  "mistralai/mistral-small-4",
] as const;
export const TOKEN_STORAGE = "polli:pk_VoYaJ2SYnC4CDO1h:token";
export const TEST_KEY = "model-table-test-key";
export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-expose-headers": "*",
};
export const catalog = IDS.map((name, index) => ({
  name,
  paid_only: index >= 9,
  health: { status: "healthy" },
  pricing: {
    promptTextTokens: "0.000001",
    promptCachedTokens: "0.0000001",
    completionTextTokens: "0.000002",
    completionImageTokens: "0.002",
  },
}));
const IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
  "base64",
);
export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface ChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  max_tokens: number;
}

declare global {
  interface Window {
    gsap?: typeof import("gsap").gsap;
    __unhandledRejections?: string[];
    __copiedMarkdown?: string;
  }
}

export function completion(model: string, extra: Record<string, unknown> = {}) {
  return {
    model: `${model}-snapshot`,
    choices: [{ message: { content: `A useful, thoughtful answer from ${model}. `.repeat(24) } }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 200,
      total_tokens: 300,
      completion_tokens_details: { reasoning_tokens: 40 },
      latency_checkpoint: { user_visible_ttft_ms: 12 },
    },
    ...extra,
  };
}

export async function fulfillChat(
  route: Route,
  request: ChatRequest,
  extra: Record<string, unknown> = {},
) {
  await route.fulfill({ headers: CORS, json: completion(request.model, extra) });
}
export async function fulfillImage(route: Route) {
  await route.fulfill({
    headers: { ...CORS, "x-usage-completion-image-tokens": "1" },
    contentType: "image/png",
    body: IMAGE,
  });
}

export async function mockApp(
  page: Page,
  options: {
    motion?: boolean;
    catalog?: unknown;
    connectDelayMs?: number;
    chat?: (route: Route, request: ChatRequest, attempt: number) => Promise<void>;
    image?: (route: Route, attempt: number) => Promise<void>;
  } = {},
) {
  const attempts = new Map<string, number>();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const dispatches: { model: string; at: number; url: string }[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(
    ({ tokenStorage, testKey }) => {
      sessionStorage.setItem(tokenStorage, testKey);
      window.__unhandledRejections = [];
      window.addEventListener("unhandledrejection", (event) =>
        window.__unhandledRejections?.push(String(event.reason)),
      );
    },
    { tokenStorage: TOKEN_STORAGE, testKey: TEST_KEY },
  );
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("http://127.0.0.1:5173/")) {
      await route.continue();
      return;
    }
    if (
      options.motion === false &&
      (url.includes("/gsap@3.15.1/") || url.includes("/lenis@1.3.27/"))
    ) {
      await route.fulfill({ status: 204, body: "" });
    } else if (url.includes("/gsap@3.15.1/dist/")) {
      const filename = new URL(url).pathname.split("/").pop();
      if (
        !filename ||
        ![
          "gsap.min.js",
          "Flip.min.js",
          "ScrollTrigger.min.js",
          "SplitText.min.js",
          "CustomEase.min.js",
        ].includes(filename)
      )
        throw new Error("Unexpected GSAP asset");
      await route.fulfill({
        path: `node_modules/gsap/dist/${filename}`,
        contentType: "application/javascript",
      });
    } else if (url.includes("/lenis@1.3.27/dist/")) {
      const filename = new URL(url).pathname.split("/").pop();
      if (!filename || !["lenis.min.js", "lenis.css"].includes(filename))
        throw new Error("Unexpected Lenis asset");
      await route.fulfill({
        path: `node_modules/lenis/dist/${filename}`,
        contentType: filename.endsWith(".css") ? "text/css" : "application/javascript",
      });
    } else if (url.includes("/dist/connect.js")) {
      const body =
        "setTimeout(() => { class TestConnect extends HTMLElement {" +
        "get apiKey() { return sessionStorage.getItem('" +
        TOKEN_STORAGE +
        "'); }" +
        "set apiKey(value) { if(value) sessionStorage.setItem('" +
        TOKEN_STORAGE +
        "',value); else sessionStorage.removeItem('" +
        TOKEN_STORAGE +
        "'); this.dispatchEvent(new Event('change')); }" +
        "connectedCallback() { this.innerHTML = '<button type=button aria-label=\"Pollen-test-connection\">Pollen connected</button>'; }" +
        "} customElements.define('polli-connect', TestConnect); }, " +
        (options.connectDelayMs ?? 0) +
        ");";
      await route.fulfill({ contentType: "application/javascript", body });
    } else if (url.includes("fonts.googleapis.com")) {
      await route.fulfill({ contentType: "text/css", body: "" });
    } else if (url.includes("badge-made-with.svg")) {
      await route.fulfill({ path: "public/favicon.svg", contentType: "image/svg+xml" });
    } else await route.fulfill({ status: 204, body: "" });
  });
  await page.route("https://gen.pollinations.ai/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    if (request.url().endsWith("/models")) {
      await route.fulfill({ headers: CORS, json: options.catalog ?? catalog });
      return;
    }
    const data = request.method() === "POST" ? (request.postDataJSON() as ChatRequest) : undefined;
    const model = data?.model ?? IDS[5];
    const attempt = (attempts.get(model) ?? 0) + 1;
    attempts.set(model, attempt);
    dispatches.push({ model, at: Date.now(), url: request.url() });
    if (data) await (options.chat ? options.chat(route, data, attempt) : fulfillChat(route, data));
    else await (options.image ? options.image(route, attempt) : fulfillImage(route));
  });
  await page.goto("/");
  return { attempts, consoleErrors, pageErrors, dispatches };
}
