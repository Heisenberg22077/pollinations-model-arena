import type { ChatUsage, ErrorCode } from "../types";

export class PollinationsError extends Error {
  constructor(
    message: string,
    public code: Exclude<ErrorCode, "stopped">,
    public status?: number,
    public retryAfterMs?: number,
    public usage?: ChatUsage,
  ) {
    super(message);
    this.name = "PollinationsError";
  }
}

export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export interface RequestOptions {
  onRetry?: () => void;
}

/** A single deadline covers fetching, reading the body, and the one retry. */
export async function requestWithRetry<T>(
  userSignal: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(userSignal.reason);
  if (userSignal.aborted) onAbort();
  else userSignal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new PollinationsError(
          `Timed out after ${timeoutMs / 1000} seconds. You can try this model again.`,
          "timeout",
        ),
      ),
    timeoutMs,
  );
  try {
    for (let attempt = 0; ; attempt += 1) {
      controller.signal.throwIfAborted();
      try {
        return await operation(controller.signal);
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        const failure =
          error instanceof PollinationsError
            ? error
            : new PollinationsError(
                "Could not reach Pollinations. Check your connection.",
                "network",
              );
        const retryable =
          failure.code === "rate" ||
          failure.code === "network" ||
          (failure.status !== undefined && failure.status >= 500 && failure.status <= 599);
        if (attempt >= 1 || !retryable) throw failure;
        options.onRetry?.();
        await abortableDelay(
          Math.max(800 * 2 ** attempt, failure.retryAfterMs ?? 0),
          controller.signal,
        );
      }
    }
  } finally {
    clearTimeout(timer);
    userSignal.removeEventListener("abort", onAbort);
  }
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function nonnegativeNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}
