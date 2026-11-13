import { Check, ChevronDown, Coins, Image as ImageIcon } from "lucide-react";
import { type CSSProperties, useState } from "react";
import type { ModelDef } from "../config";
import { beeComment } from "../lib/arena-motion";
import type { HealthStatus } from "../types";
import { CollapsibleRegion } from "./AnimatedDisclosure";
import { ModelLogo } from "./ModelLogo";

function ModelToggle({
  model,
  selected,
  onToggle,
  health,
}: {
  model: ModelDef;
  selected: boolean;
  onToggle: () => void;
  health: HealthStatus | undefined;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={model.name}
      disabled={health === "down"}
      title={
        health === "down"
          ? "Currently down; excluded from the lineup."
          : health === "degraded"
            ? "Provider health is degraded; responses may be slower."
            : model.blurb
      }
      onClick={() => {
        onToggle();
        beeComment(selected ? "deselect" : "select", model.name);
      }}
      className="model-toggle"
      data-health={health}
      data-model-id={model.id}
      style={{ "--provider-color": model.color } as CSSProperties}
    >
      <ModelLogo model={model} size="control" />
      <span className="model-toggle-name">
        <span>{model.name}</span>
        {health === "down" ? (
          <span className="model-toggle-note text-orange">Down</span>
        ) : model.paidOnly ? (
          <span className="model-toggle-note text-orange">
            <Coins className="h-3 w-3" aria-hidden="true" /> Paid
          </span>
        ) : model.kind === "image" ? (
          <ImageIcon className="h-3 w-3 text-quiet" aria-label="Image model" />
        ) : null}
      </span>
      <span className="selection-check" aria-hidden="true">
        <Check className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

export function ModelRoster({
  models,
  health,
  selectedIds,
  onToggle,
  onPreset,
}: {
  models: ModelDef[];
  health: Record<string, HealthStatus>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onPreset: (preset: "core" | "free" | "all") => void;
}) {
  const [open, setOpen] = useState(false);
  const core = models.filter((model) => model.core);
  const moreFree = models.filter((model) => !model.core && !model.paidOnly);
  const premium = models.filter((model) => model.paidOnly);
  const selected = (id: string) => selectedIds.includes(id);
  const presetActive = (preset: "core" | "free" | "all") => {
    const ids = models
      .filter((model) => health[model.id] !== "down")
      .filter((model) => preset === "all" || (preset === "core" ? model.core : !model.paidOnly))
      .map((model) => model.id);
    return ids.length === selectedIds.length && ids.every(selected);
  };
  const activePreset = (["core", "free", "all"] as const).find(presetActive);
  const toggle = (model: ModelDef) => (
    <ModelToggle
      key={model.id}
      model={model}
      selected={selected(model.id)}
      health={health[model.id]}
      onToggle={() => onToggle(model.id)}
    />
  );

  return (
    <section id="roster" className="model-roster">
      <div className="roster-toolbar">
        <div className="roster-title">
          <h2>Model lineup</h2>
          <span className="selection-count">
            <span className="count-roll">
              <span className="count-value" key={selectedIds.length}>
                {selectedIds.length}
              </span>
            </span>{" "}
            selected
          </span>
        </div>
        <fieldset className="roster-presets min-w-0" aria-label="Lineup presets">
          {(
            [
              ["core", `Core ${core.length}`],
              ["free", "Standard models"],
              ["all", "All models"],
            ] as const
          ).map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                onPreset(preset);
                beeComment(`preset-${preset}`);
                setOpen(preset !== "core");
              }}
              aria-pressed={presetActive(preset)}
              data-preset={preset}
              className="preset-button"
            >
              {activePreset === preset && (
                <span
                  data-flip-id="active-roster-preset"
                  className="preset-highlight"
                  aria-hidden="true"
                />
              )}
              <span className="preset-label">{label}</span>
            </button>
          ))}
        </fieldset>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="extra-models"
          className="more-models-button"
        >
          {open ? "Hide extra models" : `More models (${moreFree.length + premium.length})`}
          <ChevronDown
            className={`guide-chevron h-3.5 w-3.5${open ? " rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      <fieldset className="roster-grid min-w-0" aria-label="Core models">
        {core.map(toggle)}
      </fieldset>

      <CollapsibleRegion open={open} id="extra-models" className="extra-models">
        <div className="extra-models-content">
          <fieldset className="roster-grid min-w-0" aria-label="More models">
            {moreFree.map(toggle)}
          </fieldset>
          <div className="premium-lineup">
            <p>Needs paid Pollen</p>
            <fieldset className="roster-grid min-w-0" aria-label="Paid models">
              {premium.map(toggle)}
            </fieldset>
          </div>
        </div>
      </CollapsibleRegion>
      {selectedIds.length === 0 ? (
        <p className="roster-notice">Pick a model to join the table.</p>
      ) : null}
      {Object.values(health).includes("down") ? (
        <p className="roster-notice">Models marked down are excluded automatically.</p>
      ) : null}
    </section>
  );
}
