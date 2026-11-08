import { API_BASE, CHAT_URL, type ModelDef, type Pricing, SYSTEM_PROMPT } from "../config";
import type { ChatUsage } from "../types";
import {
  asRecord,
  nonnegativeNumber,
  PollinationsError,
  parseJson,
  type RequestOptions,
  requestWithRetry,
} from "./request";

export { PollinationsError } from "./request";

const CREDIT_MESSAGE_RE =
  /(?:account|api key).*(?:doesn['’]t|does not) have enough credits|(?:this model|model needs|requires).*paid Pollen/i;

function parseUsage(value: unknown): ChatUsage | undefined {
  const usage = asRecord(value);
  if (!usage) return undefined;
  const promptDetails = asRecord(usage.prompt_tokens_details);
  const completionDetails = asRecord(usage.completion_tokens_details);
  const checkpoint = asRecord(usage.latency_checkpoint);
  return {
    prompt_tokens: nonnegativeNumber(usage.prompt_tokens),
    completion_tokens: nonnegativeNumber(usage.completion_tokens),
    total_tokens: nonnegativeNumber(usage.total_tokens),
    prompt_tokens_details: { cached_tokens: nonnegativeNumber(promptDetails?.cached_tokens) },
    completion_tokens_details: {
      reasoning_tokens: nonnegativeNumber(completionDetails?.reasoning_tokens),
    },
    latency_checkpoint: {
      user_visible_ttft_ms: nonnegativeNumber(checkpoint?.user_visible_ttft_ms),
      service_ttft_ms: nonnegativeNumber(checkpoint?.service_ttft_ms),
    },
  };
}

function retryAfter(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = nonnegativeNumber(value);
  if (seconds !== undefined) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function responseError(response: Response, payload: unknown): PollinationsError {
  const json = asRecord(payload);
  const error = asRecord(json?.error);
  const details = asRecord(error?.details);
  const upstream = asRecord(
    typeof details?.upstreamBody === "string" ? parseJson(details.upstreamBody) : undefined,
  );
  const message =
    typeof error?.message === "string"
      ? error.message
      : typeof json?.message === "string"
        ? json.message
        : `Request failed (${response.status}).`;
  const code = typeof error?.code === "string" ? error.code : "";
  const diagnostic = `${code} ${message} ${JSON.stringify(upstream ?? {})}`;
  const usage = parseUsage(json?.usage ?? upstream?.usage);
  if (response.status === 429 || /rate_limit|too many requests/i.test(code)) {
    return new PollinationsError(
      "Rate limited after one retry. Try this model again shortly.",
      "rate",
      response.status,
      retryAfter(response),
      usage,
    );
  }
  if (response.status === 402 || CREDIT_MESSAGE_RE.test(message)) {
    return new PollinationsError(
      "This model needs paid Pollen. Top up, or choose another model.",
      "credits",
      response.status,
    );
  }
  if (response.status === 401 || response.status === 403) {
    return new PollinationsError(
      "Your Pollen connection does not authorize this request. Reconnect in the top bar.",
      "auth",
      response.status,
    );
  }
  if (
    /output_token_limit|output token limit|exhausted.*(?:output|token)|token.*exhausted/i.test(
      diagnostic,
    )
  ) {
    return new PollinationsError(
      "The model used its output budget before answering. Try a shorter question or another model.",
      "output-limit",
      response.status,
      undefined,
      usage,
    );
  }
  if (/content_filter|response content blocked|content.*filtered/i.test(diagnostic)) {
    return new PollinationsError(
      "The provider filtered this response. Try a different question.",
      "filtered",
      response.status,
      undefined,
      usage,
    );
  }
  return new PollinationsError(
    response.status >= 500
      ? "Pollinations is temporarily unavailable. Try this model again shortly."
      : message,
    "api",
    response.status,
    undefined,
    usage,
  );
}

export interface ChatResult {
  text: string;
  usage?: ChatUsage;
  servedModel?: string;
}

export async function askText(
  model: ModelDef,
  prompt: string,
  apiKey: string,
  signal: AbortSignal,
  options: RequestOptions = {},
): Promise<ChatResult> {
  return requestWithRetry(
    signal,
    75_000,
    async (requestSignal) => {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.id,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          max_tokens: model.maxTokens ?? 4000,
          temperature: 0.8,
        }),
        signal: requestSignal,
      });
      const payload = parseJson(await response.text());
      requestSignal.throwIfAborted();
      if (!response.ok) throw responseError(response, payload);
      const json = asRecord(payload);
      const choice = asRecord(Array.isArray(json?.choices) ? json.choices[0] : undefined);
      const message = asRecord(choice?.message);
      const content =
        typeof message?.content === "string"
          ? message.content
          : Array.isArray(message?.content)
            ? message.content
                .map((part: unknown) => {
                  const text = asRecord(part)?.text;
                  return typeof text === "string" ? text : "";
                })
                .join("")
            : "";
      if (CREDIT_MESSAGE_RE.test(content)) {
        throw new PollinationsError(
          "This model needs paid Pollen. Top up, or choose another model.",
          "credits",
          response.status,
        );
      }
      const usage = parseUsage(json?.usage);
      if (!content.trim()) {
        if (choice?.finish_reason === "content_filter") {
          throw new PollinationsError(
            "The provider filtered this response. Try a different question.",
            "filtered",
            response.status,
            undefined,
            usage,
          );
        }
        if (choice?.finish_reason === "length") {
          throw new PollinationsError(
            "The model used its output budget before answering. Try a shorter question or another model.",
            "output-limit",
            response.status,
            undefined,
            usage,
          );
        }
        throw new PollinationsError(
          "The model returned an empty answer. Try this model again.",
          "api",
          response.status,
          undefined,
          usage,
        );
      }
      return {
        text: content.trim(),
        usage,
        servedModel: typeof json?.model === "string" ? json.model : undefined,
      };
    },
    options,
  );
}

export interface ImageResult {
  objectUrl: string;
  imageTokens?: number;
}

export async function askImage(
  model: ModelDef,
  prompt: string,
  apiKey: string,
  signal: AbortSignal,
  options: RequestOptions & { seed?: number } = {},
): Promise<ImageResult> {
  const seed = options.seed ?? Math.floor(Math.random() * 1_000_000_000);
  const imagePrompt = `An editorial illustration that answers the question: ${prompt}. Bold, surreal, high contrast, dramatic light, no text, no watermark.`;
  const url = `${API_BASE}/image/${encodeURIComponent(imagePrompt)}?${new URLSearchParams({
    model: model.id,
    width: "1024",
    height: "640",
    nologo: "true",
    private: "true",
    seed: String(seed),
  })}`;
  return requestWithRetry(
    signal,
    120_000,
    async (requestSignal) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: requestSignal,
      });
      if (!response.ok) throw responseError(response, parseJson(await response.text()));
      const blob = await response.blob();
      requestSignal.throwIfAborted();
      if (!blob.type.startsWith("image/") || blob.size === 0) {
        throw new PollinationsError(
          "Pollinations did not return an image. Try this model again.",
          "api",
          response.status,
        );
      }
      const imageTokens = nonnegativeNumber(
        response.headers.get("x-usage-completion-image-tokens"),
      );
      return { objectUrl: URL.createObjectURL(blob), imageTokens };
    },
    options,
  );
}

export function billableCompletionTokens(usage: ChatUsage | undefined): number | undefined {
  const completion = usage?.completion_tokens;
  if (completion === undefined) return undefined;
  const reasoning = usage?.completion_tokens_details?.reasoning_tokens ?? 0;
  // xAI Chat Completions reports reasoning separately; other providers include it.
  return reasoning > 0 &&
    usage?.prompt_tokens !== undefined &&
    usage.total_tokens === usage.prompt_tokens + completion + reasoning
    ? completion + reasoning
    : completion;
}

export function textCostBreakdown(
  usage: ChatUsage | undefined,
  pricing: Pricing,
): { prompt: number; completion: number } | undefined {
  if (!usage || (usage.prompt_tokens === undefined && usage.completion_tokens === undefined))
    return undefined;
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = billableCompletionTokens(usage) ?? 0;
  if (
    (promptTokens > 0 && pricing.prompt === undefined) ||
    (completionTokens > 0 && pricing.completion === undefined)
  )
    return undefined;
  const cached = Math.min(promptTokens, usage.prompt_tokens_details?.cached_tokens ?? 0);
  return {
    prompt:
      (promptTokens - cached) * (pricing.prompt ?? 0) +
      cached * (pricing.cachedPrompt ?? pricing.prompt ?? 0),
    completion: completionTokens * (pricing.completion ?? 0),
  };
}

export function textCost(usage: ChatUsage | undefined, pricing: Pricing): number | undefined {
  const breakdown = textCostBreakdown(usage, pricing);
  return breakdown ? breakdown.prompt + breakdown.completion : undefined;
}

export function imageCost(imageTokens: number | undefined, pricing: Pricing): number | undefined {
  return imageTokens !== undefined && pricing.image !== undefined
    ? imageTokens * pricing.image
    : undefined;
}
