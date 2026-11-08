import { MODELS, type Pricing } from "../config";
import type { HealthStatus } from "../types";
import { asRecord, nonnegativeNumber } from "./request";

export interface ModelCatalog {
  pricing: Record<string, Pricing>;
  health: Record<string, HealthStatus>;
  paidOnly: Record<string, boolean>;
  live: boolean;
}

export const EMPTY_CATALOG: ModelCatalog = { pricing: {}, health: {}, paidOnly: {}, live: false };

export function parseCatalog(value: unknown): ModelCatalog {
  if (!Array.isArray(value)) return EMPTY_CATALOG;
  const catalog: ModelCatalog = { pricing: {}, health: {}, paidOnly: {}, live: true };
  const roster = new Set(MODELS.map((model) => model.id));
  for (const entry of value) {
    const model = asRecord(entry);
    if (typeof model?.name !== "string" || !roster.has(model.name)) continue;
    const pricing = asRecord(model.pricing);
    const parsed: Pricing = {};
    for (const [field, source] of [
      ["prompt", "promptTextTokens"],
      ["cachedPrompt", "promptCachedTokens"],
      ["completion", "completionTextTokens"],
      ["image", "completionImageTokens"],
    ] as const) {
      const price = nonnegativeNumber(pricing?.[source]);
      if (price !== undefined) parsed[field] = price;
    }
    catalog.pricing[model.name] = parsed;
    const status = asRecord(model.health)?.status;
    catalog.health[model.name] =
      status === "healthy" || status === "degraded" || status === "down" ? status : "unknown";
    if (typeof model.paid_only === "boolean") catalog.paidOnly[model.name] = model.paid_only;
  }
  return catalog;
}

export function pricingFor(modelId: string, live: Record<string, Pricing>): Pricing {
  return { ...MODELS.find((model) => model.id === modelId)?.pricing, ...live[modelId] };
}
