import type { ModelDef } from "../config";

const LOGOS: Record<string, string> = {
  OAI: "openai",
  OSS: "openai",
  DSK: "deepseek-color",
  META: "meta-color",
  XAI: "grok",
  ZAI: "zai",
  BFL: "bfl",
  NV: "nvidia-color",
  MM: "minimax-color",
  ANT: "claude-color",
  QW: "qwen-color",
  GGL: "gemini-color",
  MST: "mistral-small-4",
};
const MONO = new Set(["openai", "grok", "zai", "bfl"]);

/** Local, original SVG marks. Adjacent model/provider names supply accessible labels. */
export function ModelLogo({
  model,
  size = "card",
}: {
  model: Pick<ModelDef, "short">;
  size?: "card" | "control";
}) {
  const logo = LOGOS[model.short];
  if (!logo)
    return (
      <span className={`model-logo model-logo-${size}`} aria-hidden="true">
        {model.short.slice(0, 2)}
      </span>
    );
  const url = `${import.meta.env.BASE_URL}logos/${logo}.svg`;
  return (
    <span className={`model-logo model-logo-${size}`} data-logo={logo} aria-hidden="true">
      {MONO.has(logo) ? (
        <span className="model-logo-mono" style={{ maskImage: `url("${url}")` }} />
      ) : (
        <img
          className={`model-logo-image${logo === "mistral-small-4" ? " model-logo-illustration" : ""}`}
          src={url}
          alt=""
          width={24}
          height={24}
          draggable={false}
        />
      )}
    </span>
  );
}
