import {
  Check,
  ChevronDown,
  ClipboardCopy,
  Download,
  Image as ImageIcon,
  MessageSquare,
  Table2,
  X,
} from "lucide-react";
import {
  Component,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ModelDef } from "../config";
import { beeComment, captureLayout, commitLayout } from "../lib/arena-motion";
import { formatLatency, formatPollen, formatTokens } from "../lib/format";
import { animateFeedback } from "../lib/motion";
import type { HealthStatus, Run, Runs } from "../types";
import { CollapsibleRegion } from "./AnimatedDisclosure";
import { MetricsComparison } from "./MetricsComparison";
import { ModelCard } from "./ModelCard";
import { ModelLogo } from "./ModelLogo";
import { RunTrail } from "./RunTrail";

type SortOrder = "roster" | "finish" | "latency" | "cost" | "provider";

// Snapshot before React mutates the grid. A layout effect runs after that mutation
// and cannot recover the previous positions for arrivals that change live sorting.
class SortedLayout extends Component<{ order: string; children: ReactNode }> {
  getSnapshotBeforeUpdate(previous: Readonly<{ order: string; children: ReactNode }>) {
    if (previous.order === this.props.order) return false;
    captureLayout();
    return true;
  }
  componentDidUpdate() {
    commitLayout();
  }
  render() {
    return this.props.children;
  }
}

function scrollComparison(event: KeyboardEvent<HTMLElement>) {
  if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key))
    return;
  const grid = event.currentTarget;
  if (grid.scrollWidth <= grid.clientWidth) return;
  event.preventDefault();
  grid.scrollBy({
    left: (event.key === "ArrowRight" ? 1 : -1) * Math.max(120, grid.clientWidth * 0.75),
    behavior: "instant",
  });
}

function GhostCard({ model }: { model: ModelDef }) {
  const Icon = model.kind === "image" ? ImageIcon : MessageSquare;
  return (
    <div
      data-kind={model.kind}
      data-model-id={model.id}
      data-flip-id={model.id}
      className="model-column ghost-card"
      style={{ "--provider-color": model.color } as CSSProperties}
    >
      <div className="card-arrival">
        <div className="card-tilt">
          <header className="model-heading">
            <div className="model-provider-row">
              <p className="model-provider">
                <ModelLogo model={model} />
                <span>{model.provider}</span>
              </p>
            </div>
            <h3>{model.name}</h3>
            <p>{model.blurb}</p>
          </header>
          <div className="empty-answer">
            <Icon className="h-5 w-5 opacity-50" aria-hidden="true" />
            <span>{model.kind === "image" ? "An image from your question" : "Text answer"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function rank(run: Run | undefined, sort: SortOrder): number {
  if (sort === "finish") return run?.finishedAt ?? Number.POSITIVE_INFINITY;
  if (run?.status !== "done") return Number.POSITIVE_INFINITY;
  return (sort === "latency" ? run.latencyMs : run.cost) ?? Number.POSITIVE_INFINITY;
}

function markdownFor(models: ModelDef[], runs: Runs, question: string): string {
  const lines = [
    "# Model Table",
    "",
    `## ${question}`,
    "",
    `_One question, ${models.length} Pollinations models._`,
    "",
  ];
  for (const model of models) {
    const run = runs[model.id];
    lines.push(`### ${model.name} (${model.provider})`, "");
    if (run?.status === "done")
      lines.push(run.text ?? "[Visual answer — view the image in Model Table.]", "");
    else lines.push(run?.error ?? "Answer pending.", "");
    lines.push(
      "Latency: " +
        formatLatency(run?.latencyMs) +
        " · Estimated cost: " +
        formatPollen(run?.cost) +
        " Pollen · Tokens: " +
        (run?.imageTokens !== undefined
          ? `${run.imageTokens} image`
          : formatTokens(run?.usage?.total_tokens)),
    );
    if (run?.ttftMs !== undefined)
      lines.push(`First token (server-reported): ${formatLatency(run.ttftMs)}`);
    const reasoning = run?.usage?.completion_tokens_details?.reasoning_tokens;
    if (reasoning) lines.push(`Reasoning tokens: ${formatTokens(reasoning)}`);
    if (run?.servedModel) lines.push(`Served model: ${run.servedModel}`);
    lines.push("");
  }
  lines.push("[Made with pollinations.ai](https://pollinations.ai/?ref=badge)", "");
  return lines.join("\n");
}

export function ResultsPanel({
  models,
  runs,
  isRunning,
  lastQuestion,
  nextQuestion,
  onRerun,
  canRerun,
  health,
  onClear,
}: {
  models: ModelDef[];
  runs: Runs;
  isRunning: boolean;
  lastQuestion: string;
  nextQuestion: string;
  onRerun: (id: string) => void;
  canRerun: boolean;
  health: Record<string, HealthStatus>;
  onClear: () => void;
}) {
  const [sort, setSort] = useState<SortOrder>("roster");
  const [metricsOpen, setMetricsOpen] = useState(false);
  // Mount the comparison table only once opened: keeping it out of the run commit
  // saves a 13-row table reconcile on every answer batch on slow phones.
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const gridRef = useRef<HTMLElement>(null);
  const copyIconRef = useRef<HTMLSpanElement>(null);
  const changeSort = (nextSort: SortOrder) => {
    if (nextSort === sort) return;
    captureLayout();
    setSort(nextSort);
  };
  useLayoutEffect(() => {
    commitLayout();
  });
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (copyState === "idle") return;
    const timer = setTimeout(() => setCopyState("idle"), 1500);
    return () => clearTimeout(timer);
  }, [copyState]);

  const done = models
    .map((model) => ({ model, run: runs[model.id] }))
    .filter((entry): entry is { model: ModelDef; run: Run } => entry.run?.status === "done");
  const errors = models.filter((model) => runs[model.id]?.status === "error").length;
  // Awards are only final once the race completes. Recomputing them on every arrival
  // flipped isFastest/isCheapest on the previous winners, re-rendering ~3 cards per
  // settle on throttled phones; freeze them until the run finishes so memo isolates
  // each commit to the single card that actually changed.
  const fastest = isRunning
    ? undefined
    : [...done]
        .filter((entry) => entry.run.latencyMs !== undefined)
        .sort((a, b) => (a.run.latencyMs ?? 0) - (b.run.latencyMs ?? 0))[0];
  const cheapest = isRunning
    ? undefined
    : [...done]
        .filter((entry) => entry.run.cost !== undefined)
        .sort((a, b) => (a.run.cost ?? 0) - (b.run.cost ?? 0))[0];
  const totalCost = models.reduce((sum, model) => sum + (runs[model.id]?.cost ?? 0), 0);
  const unknownCost = models.some((model) => {
    const run = runs[model.id];
    return (
      run?.cost === undefined &&
      (run?.status === "done" ||
        (run?.status === "error" && run.errorCode !== "credits" && run.errorCode !== "stopped"))
    );
  });
  const ordered = [...models].sort((a, b) => {
    if (sort === "roster") return 0;
    if (sort === "provider") return a.provider.localeCompare(b.provider);
    const left = rank(runs[a.id], sort),
      right = rank(runs[b.id], sort);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(markdownFor(ordered, runs, lastQuestion));
      setCopyState("copied");
      animateFeedback(
        copyIconRef.current,
        [
          { transform: "rotate(-35deg) scale(0.35)" },
          { transform: "rotate(10deg) scale(1.18)" },
          { transform: "rotate(0deg) scale(1)" },
        ],
        440,
        "bouncy",
      );
      beeComment("copy");
    } catch {
      setCopyState("failed");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([markdownFor(ordered, runs, lastQuestion)], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `model-table-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    beeComment("export");
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (!lastQuestion)
    return (
      <section id="results" className="results-surface" aria-label="Results">
        <div className="results-toolbar">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-base font-medium">
              {models.length ? "Your lineup is ready." : "Choose a model to begin."}
            </h2>
            <p className="text-xs text-quiet">Write a question, then run the table.</p>
          </div>
          <span className="text-xs tabular-nums text-quiet">{models.length} models</span>
        </div>
        {models.length ? (
          <section
            id="comparison-grid"
            className="comparison-grid"
            data-count={models.length}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users scroll this comparison region with arrow keys.
            tabIndex={0}
            onKeyDown={scrollComparison}
            aria-label="Model comparison"
          >
            {models.map((model) => (
              <GhostCard key={model.id} model={model} />
            ))}
          </section>
        ) : (
          <p className="my-8 text-sm text-quiet">Choose at least one model from the lineup.</p>
        )}
      </section>
    );

  return (
    <section id="results" className="results-surface" aria-label="Results">
      <div className="results-toolbar">
        <div className="results-summary">
          {nextQuestion !== lastQuestion ? (
            <p className="submitted-question-note">
              Answers below are for your submitted question.
            </p>
          ) : null}
          <h2 className="submitted-question">“{lastQuestion}”</h2>
          <RunTrail models={models} runs={runs} running={isRunning} />
          <div className="results-progress" role="status" aria-live="polite">
            <span className="inline-flex items-center gap-2 font-medium">
              <span
                className={`h-1.5 w-1.5 ${isRunning ? "live-status bg-accent-ink" : "bg-[#398462]"}`}
                aria-hidden="true"
              />
              {done.length}/{models.length} answered
            </span>
            {errors ? (
              <span className="text-orange">
                {errors} unavailable, {done.length + errors}/{models.length} settled
              </span>
            ) : null}
            <span
              title="Includes reported usage from failed requests. Reasoning and cached prompt pricing are included when reported."
              className="text-quiet"
            >
              {unknownCost ? "Known total" : "Est. total"}{" "}
              <span className="font-medium text-foreground">{formatPollen(totalCost)}</span> Pollen
            </span>
          </div>
        </div>
        <div className="results-controls">
          <label className="sort-control">
            <span className="sort-label">Sort</span>
            <select
              aria-label="Sort results"
              value={sort}
              onChange={(event) => changeSort(event.target.value as SortOrder)}
            >
              <option value="roster">Roster order</option>
              <option value="finish">Finish order</option>
              <option value="latency">Latency</option>
              <option value="cost">Cost</option>
              <option value="provider">Provider</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setMetricsLoaded(true);
              if (!metricsOpen) beeComment("compare");
              setMetricsOpen((open) => !open);
            }}
            aria-expanded={metricsOpen}
            aria-controls="metrics-comparison"
            aria-label="Compare metrics"
            title="Compare metrics"
            className="soft-button result-action"
          >
            <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="control-label">Metrics</span>
            <ChevronDown
              className={`guide-chevron h-3 w-3${metricsOpen ? " rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => void copyAll()}
            aria-label="Copy as Markdown"
            title={
              copyState === "failed"
                ? "Clipboard unavailable; download Markdown instead."
                : "Copy as Markdown"
            }
            className="soft-button result-action"
          >
            <span ref={copyIconRef} className="action-icon" aria-hidden="true">
              {copyState === "copied" ? (
                <Check className="h-3.5 w-3.5 text-accent-ink" aria-hidden="true" />
              ) : (
                <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>
            <span className="control-label">
              {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}
            </span>
          </button>
          <button
            type="button"
            onClick={download}
            aria-label="Download Markdown"
            title="Download Markdown"
            className="soft-button result-action"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="control-label">Download</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={isRunning}
            aria-label="Clear results"
            title="Clear results"
            className="soft-button result-action disabled:opacity-30"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <span className="sr-only" role="status">
        {copyState === "copied"
          ? "Markdown copied."
          : copyState === "failed"
            ? "Copy failed. Download Markdown instead."
            : ""}
      </span>
      <CollapsibleRegion open={metricsOpen} className="metrics-reveal">
        {metricsLoaded ? <MetricsComparison models={ordered} runs={runs} /> : null}
      </CollapsibleRegion>
      <SortedLayout order={ordered.map((model) => model.id).join(",")}>
        <section
          id="comparison-grid"
          className="comparison-grid"
          data-count={ordered.length}
          ref={gridRef}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users scroll this comparison region with arrow keys.
          tabIndex={0}
          onKeyDown={scrollComparison}
          aria-label="Model comparison"
        >
          {ordered.map((model) => (
            <ModelCard
              key={`${model.id}:${runs[model.id]?.queuedAt ?? 0}`}
              model={model}
              run={runs[model.id]}
              index={models.indexOf(model)}
              isFastest={fastest?.model.id === model.id}
              isCheapest={cheapest?.model.id === model.id}
              canRerun={canRerun && health[model.id] !== "down"}
              onRerun={onRerun}
              question={lastQuestion}
            />
          ))}
        </section>
      </SortedLayout>
    </section>
  );
}
