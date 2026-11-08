import { MAX_PROMPT_LENGTH, MODELS } from "../config";
import type { RecentRun, Runs } from "../types";
import { asRecord, nonnegativeNumber, parseJson } from "./request";

export const HISTORY_KEY = "model-table:recent:v1";
const modelIds = new Set(MODELS.map((model) => model.id));

export function readHistory(): RecentRun[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw || raw.length > 100_000) return [];
    const stored = parseJson(raw);
    if (!Array.isArray(stored)) return [];
    const history: RecentRun[] = [];
    for (const value of stored.slice(0, 5)) {
      const entry = asRecord(value);
      if (
        typeof entry?.id !== "string" ||
        typeof entry.prompt !== "string" ||
        nonnegativeNumber(entry.timestamp) === undefined ||
        !Array.isArray(entry.models)
      )
        continue;
      const models: RecentRun["models"] = [];
      for (const value of entry.models.slice(0, MODELS.length)) {
        const model = asRecord(value);
        if (
          typeof model?.id !== "string" ||
          !modelIds.has(model.id) ||
          (model.status !== "done" && model.status !== "error")
        )
          continue;
        models.push({
          id: model.id,
          status: model.status,
          latencyMs: nonnegativeNumber(model.latencyMs),
          cost: nonnegativeNumber(model.cost),
        });
      }
      history.push({
        id: entry.id.slice(0, 100),
        timestamp: Number(entry.timestamp),
        prompt: entry.prompt.slice(0, MAX_PROMPT_LENGTH),
        models,
      });
    }
    return history;
  } catch {
    return [];
  }
}

export function writeHistory(history: RecentRun[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* History is optional when storage is unavailable or full. */
  }
}

export function rememberRun(history: RecentRun[], prompt: string, runs: Runs): RecentRun[] {
  const models: RecentRun["models"] = Object.entries(runs)
    .filter(([, run]) => run.status === "done" || run.status === "error")
    .map(([id, run]) => ({
      id,
      status: run.status === "done" ? "done" : "error",
      latencyMs: run.latencyMs,
      cost: run.cost,
    }));
  if (!prompt || !models.length) return history;
  return [
    {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      prompt: prompt.slice(0, MAX_PROMPT_LENGTH),
      models,
    },
    ...history,
  ].slice(0, 5);
}
