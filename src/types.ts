import type { Pricing } from "./config";

export type RunStatus = "idle" | "pending" | "done" | "error";
export type ErrorCode =
  | "credits"
  | "rate"
  | "api"
  | "stopped"
  | "network"
  | "timeout"
  | "output-limit"
  | "filtered"
  | "auth";
export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number | null };
  latency_checkpoint?: {
    user_visible_ttft_ms?: number;
    service_ttft_ms?: number;
  };
}

export interface Run {
  status: RunStatus;
  phase?: "queued" | "running" | "retrying";
  queuedAt?: number;
  startedAt?: number;
  finishedAt?: number;
  /** Request wall time including retries, excluding the dispatch delay. */
  latencyMs?: number;
  /** Server-reported first-token time for the successful attempt. */
  ttftMs?: number;
  text?: string;
  imageUrl?: string;
  seed?: number;
  usage?: ChatUsage;
  imageTokens?: number;
  servedModel?: string;
  /** Prices captured for this request. */
  pricing?: Pricing;
  cost?: number;
  error?: string;
  errorCode?: ErrorCode;
}

export type Runs = Record<string, Run>;

export interface RecentRun {
  id: string;
  timestamp: number;
  prompt: string;
  models: {
    id: string;
    status: "done" | "error";
    latencyMs?: number;
    cost?: number;
  }[];
}
