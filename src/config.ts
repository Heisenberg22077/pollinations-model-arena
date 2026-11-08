export const API_BASE = "https://gen.pollinations.ai";
export const CHAT_URL = `${API_BASE}/v1/chat/completions`;
export const MODELS_URL = `${API_BASE}/models`;

/**
 * Publishable BYOP App Key (pk_...). It only identifies this app on the
 * Pollinations consent screen; the user's secret key never ships with the app.
 * Override for local development with VITE_POLLINATIONS_APP_KEY.
 */
export const APP_KEY: string = import.meta.env.VITE_POLLINATIONS_APP_KEY ?? "pk_VoYaJ2SYnC4CDO1h";

export const STORAGE_TOKEN_KEY = `polli:${APP_KEY}:token`;

export const CONNECT_BUDGET = "5";
export const CONNECT_EXPIRY = "7";

export const REPO_URL = "https://github.com/Heisenberg22077/pollinations-model-arena";
export const QUEST_URL = "https://github.com/pollinations/pollinations/issues/19183";
export const TOP_UP_URL = "https://enter.pollinations.ai/top-up";

export interface Pricing {
  /** Pollen per prompt text token. */
  prompt?: number;
  /** Discounted Pollen per cached prompt token, when published. */
  cachedPrompt?: number;
  /** Pollen per completion text token. */
  completion?: number;
  /** Pollen per generated image token (flat-rate image models). */
  image?: number;
}

export interface ModelDef {
  id: string;
  name: string;
  provider: string;
  short: string;
  color: string;
  kind: "text" | "image";
  /** Selected on first load. */
  core: boolean;
  /** Needs paid Pollen; shown in the premium group. */
  paidOnly?: boolean;
  blurb: string;
  maxTokens?: number;
  /** Fallback pricing, overridden by the live /models catalog. */
  pricing: Pricing;
}

/**
 * Curated roster. IDs are canonical Pollinations model IDs; prices below are a
 * fallback and are replaced at runtime by https://gen.pollinations.ai/models.
 */
export const MODELS: ModelDef[] = [
  {
    id: "openai/gpt-5.4-nano",
    name: "GPT-5.4 Nano",
    provider: "OpenAI",
    short: "OAI",
    color: "#10a37f",
    kind: "text",
    core: true,
    blurb: "The quick generalist",
    maxTokens: 2000,
    pricing: { prompt: 0.00000015, completion: 0.0000009375 },
  },
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    provider: "DeepSeek",
    short: "DSK",
    color: "#4d6bfe",
    kind: "text",
    core: true,
    blurb: "Reasoning at flash speed",
    maxTokens: 4000,
    pricing: { prompt: 0.00000015, completion: 0.0000006 },
  },
  {
    id: "meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "Meta",
    short: "META",
    color: "#0866ff",
    kind: "text",
    core: true,
    blurb: "The open-weight veteran",
    maxTokens: 2000,
    pricing: { prompt: 0.0000005325, completion: 0.0000005325 },
  },
  {
    id: "x-ai/grok-4.3",
    name: "Grok 4.3",
    provider: "xAI",
    short: "XAI",
    color: "#c8ccd4",
    kind: "text",
    core: true,
    blurb: "The contrarian",
    maxTokens: 4000,
    pricing: { prompt: 0.0000009375, completion: 0.000001875 },
  },
  {
    id: "z-ai/glm-5.3-flash",
    name: "GLM 5.3 Flash",
    provider: "Z.ai",
    short: "ZAI",
    color: "#8b5cf6",
    kind: "text",
    core: true,
    blurb: "The quiet reasoner",
    maxTokens: 4000,
    pricing: { prompt: 0.00000015, completion: 0.0000005 },
  },
  {
    id: "black-forest-labs/flux.1-schnell",
    name: "FLUX.1 Schnell",
    provider: "Black Forest Labs",
    short: "BFL",
    color: "#f59e0b",
    kind: "image",
    core: true,
    blurb: "The visual take",
    pricing: { image: 0.002 },
  },
  {
    id: "nvidia/nemotron-3.5-lightning",
    name: "Nemotron 3.5 Lightning",
    provider: "NVIDIA",
    short: "NV",
    color: "#76b900",
    kind: "text",
    core: false,
    blurb: "Small, fast, sharp",
    maxTokens: 4000,
    pricing: { prompt: 0.00000005, completion: 0.0000002 },
  },
  {
    id: "minimax/minimax-m3.1-flash",
    name: "MiniMax M3.1 Flash",
    provider: "MiniMax",
    short: "MM",
    color: "#ff5c35",
    kind: "text",
    core: false,
    blurb: "The dark horse",
    maxTokens: 4000,
    pricing: { prompt: 0.00000015, completion: 0.0000006 },
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B",
    provider: "OpenAI",
    short: "OSS",
    color: "#10a37f",
    kind: "text",
    core: false,
    blurb: "Open weights, open answers",
    maxTokens: 4000,
    pricing: { prompt: 0.00000005, completion: 0.00000018 },
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    short: "ANT",
    color: "#d97757",
    kind: "text",
    core: false,
    paidOnly: true,
    blurb: "Fast and careful",
    maxTokens: 2000,
    pricing: { prompt: 0.000001, completion: 0.000005 },
  },
  {
    id: "qwen/qwen3.8-flash",
    name: "Qwen 3.8 Flash",
    provider: "Qwen",
    short: "QW",
    color: "#615ced",
    kind: "text",
    core: false,
    paidOnly: true,
    blurb: "The multilingual challenger",
    maxTokens: 3000,
    pricing: { prompt: 0.00000015, completion: 0.00000047 },
  },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "Google",
    short: "GGL",
    color: "#4285f4",
    kind: "text",
    core: false,
    paidOnly: true,
    blurb: "Search-adjacent speed",
    maxTokens: 3000,
    pricing: { prompt: 0.00000075, completion: 0.00000375 },
  },
  {
    id: "mistralai/mistral-small-4",
    name: "Mistral Small 4",
    provider: "Mistral",
    short: "MST",
    color: "#ff7000",
    kind: "text",
    core: false,
    paidOnly: true,
    blurb: "The European option",
    maxTokens: 3000,
    pricing: { prompt: 0.00000015, completion: 0.0000006 },
  },
];

export const CORE_IDS = MODELS.filter((m) => m.core).map((m) => m.id);

export const STARTER_PROMPTS: string[] = [
  "What do you really think of humans?",
  "Is love a feature or a bug?",
  "What is the most overrated human invention?",
  "If you could ask humans one question, what would it be?",
  "What should humans build next — and why?",
];

export const DEFAULT_PROMPT = STARTER_PROMPTS[0];

export const SYSTEM_PROMPT =
  "Answer the question clearly and concisely in one short paragraph of up to 110 words. Use your usual style.";

export const MAX_PROMPT_LENGTH = 280;
