import {
  Check,
  ClipboardCopy,
  Clock3,
  LoaderCircle,
  Maximize2,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import { type CSSProperties, memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type ModelDef, TOP_UP_URL } from "../config";
import {
  beeComment,
  captureLayout,
  celebrate,
  coarsePointer,
  commitLayout,
  subscribeClock,
  withMotion,
} from "../lib/arena-motion";
import { formatLatency, formatMsTick, formatPollen, formatTokens } from "../lib/format";
import { animateFeedback } from "../lib/motion";
import { billableCompletionTokens, textCostBreakdown } from "../lib/pollinations";
import type { ErrorCode, Run } from "../types";
import { ModelLogo } from "./ModelLogo";
import { useMotionSettings } from "./MotionProvider";
import { PixelImage } from "./PixelImage";

function Metric({
  label,
  value,
  sub,
  title,
}: {
  label: string;
  value: string;
  sub?: string;
  title?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const { reduce } = useMotionSettings();
  useEffect(() => {
    const node = ref.current;
    if (node) node.textContent = value;
    // Count-up tweens write text every frame; on phones the settle pop and award
    // carry the feedback, so the number lands instantly instead of owning frames.
    if (reduce || coarsePointer.matches) return;
    const numeric = Number(value.replaceAll(",", ""));
    if (!node || !Number.isFinite(numeric) || numeric <= 0) return;
    let tween: gsap.core.Tween | undefined;
    withMotion(({ gsap }) => {
      const counter = { value: 0 };
      const decimals = value.includes(".") ? value.split(".")[1].length : 0;
      tween = gsap.to(counter, {
        value: numeric,
        duration: 0.45,
        ease: "arenaExpo",
        onUpdate: () => {
          node.textContent = counter.value.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          });
        },
        onComplete: () => {
          node.textContent = value;
        },
      });
    });
    return () => {
      tween?.kill();
      node.textContent = value;
    };
  }, [value, reduce]);
  return (
    <div
      className={`min-w-0${label === "Latency" ? " metric-latency" : ""}`}
      title={title ?? value}
    >
      <p className="metric-label">{label}</p>
      <p className="metric-value">
        <span className="sr-only">{value}</span>
        <span ref={ref} aria-hidden="true">
          {value}
        </span>
      </p>
      <p className="metric-sub">{sub ?? "\u00a0"}</p>
    </div>
  );
}

const ERROR_LABELS: Record<ErrorCode, string> = {
  credits: "Needs paid Pollen",
  rate: "Rate limited",
  api: "No answer",
  stopped: "Stopped",
  network: "Connection failed",
  timeout: "Timed out",
  "output-limit": "Output limit reached",
  filtered: "Filtered by provider",
  auth: "Reconnect Pollen",
};

function costTitle(run: Run | undefined): string {
  if (!run || run.cost === undefined || !run.pricing)
    return "Estimate unavailable: usage or pricing was not reported.";
  if (run.imageTokens !== undefined)
    return (
      run.imageTokens +
      " image token × " +
      formatPollen(run.pricing.image) +
      " = " +
      formatPollen(run.cost) +
      " Pollen"
    );
  const breakdown = textCostBreakdown(run.usage, run.pricing);
  if (!breakdown) return "Estimate unavailable.";
  const cached = run.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  return (
    "Prompt " +
    formatTokens(run.usage?.prompt_tokens) +
    " tokens" +
    (cached ? ` (${cached} cached)` : "") +
    ": " +
    formatPollen(breakdown.prompt) +
    " + completion " +
    formatTokens(billableCompletionTokens(run.usage)) +
    " tokens: " +
    formatPollen(breakdown.completion) +
    " = " +
    formatPollen(run.cost) +
    " Pollen. Reasoning is included in billed output."
  );
}

function ModelCardView({
  model,
  run,
  index,
  isFastest,
  isCheapest,
  canRerun,
  onRerun,
  question,
}: {
  model: ModelDef;
  run: Run | undefined;
  index: number;
  isFastest: boolean;
  isCheapest: boolean;
  canRerun: boolean;
  onRerun: (id: string) => void;
  question: string;
}) {
  const { reduce } = useMotionSettings();
  const now = Date.now();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const imageDialogRef = useRef<HTMLDialogElement>(null);
  const answerRef = useRef<HTMLParagraphElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const status = run?.status ?? "idle";
  const reasoning = run?.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
  const answerId = `answer-${model.short}-${index}`;

  useEffect(() => {
    const card = cardRef.current;
    const started = run?.startedAt;
    if (!card || status !== "pending" || started === undefined) return;
    const header = card.querySelector<HTMLElement>(".live-stopwatch");
    const values = card.querySelectorAll<HTMLElement>(".metric-latency .metric-value span");
    let last = 0;
    return subscribeClock((time) => {
      if (document.hidden || time - last < 100) return;
      last = time;
      const value = formatMsTick(Math.max(0, time - started));
      if (header) header.textContent = value;
      for (const node of values) node.textContent = value;
    });
  }, [run?.startedAt, status]);

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = setTimeout(() => setCopyState("idle"), 1500);
    return () => clearTimeout(timer);
  }, [copyState]);
  useEffect(() => {
    if (!run?.text) return;
    const answer = answerRef.current;
    if (!answer) return;
    const measure = () => setOverflows(answer.scrollHeight > answer.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(answer);
    return () => observer.disconnect();
  }, [run?.text]);

  const copyText = async () => {
    if (!run?.text) return;
    try {
      await navigator.clipboard.writeText(run.text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const toggleExpanded = () => {
    captureLayout();
    setExpanded((value) => !value);
    animateFeedback(
      answerRef.current,
      [
        { opacity: 0.65, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      undefined,
      "fluid",
    );
  };

  const showImage = () => {
    const dialog = imageDialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    setImageOpen(true);
    animateFeedback(
      dialog,
      [
        { opacity: 0, transform: "translateY(6px) scale(0.98)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      undefined,
      "fluid",
    );
  };

  useEffect(() => {
    if (status !== "pending" || reduce || !cardRef.current) return;
    const card = cardRef.current;
    const effects: gsap.core.Tween[] = [];
    withMotion(({ gsap }) => {
      effects.push(
        gsap.to(card.querySelector(".skeleton-shimmer"), {
          xPercent: 200,
          duration: 1.1,
          repeat: -1,
          ease: "none",
        }),
      );
      if (!coarsePointer.matches) {
        effects.push(
          gsap.to(card.querySelectorAll(".pending-pixels > span:not(.skeleton-shimmer)"), {
            opacity: 0.25,
            duration: 0.6,
            repeat: -1,
            yoyo: true,
            stagger: 0.08,
            ease: "sine.inOut",
          }),
        );
        effects.push(
          gsap.to(card.querySelector(".pending-cursor"), {
            opacity: 0.25,
            duration: 0.45,
            repeat: -1,
            yoyo: true,
            ease: "steps(1)",
          }),
        );
      }
    });
    return () => {
      for (const effect of effects) effect.kill();
    };
  }, [status, reduce]);
  useLayoutEffect(() => {
    commitLayout();
  });
  useEffect(() => {
    if (isFastest && status === "done" && cardRef.current) celebrate(cardRef.current);
  }, [isFastest, status]);
  useEffect(() => {
    if (isCheapest && status === "done") beeComment("cheap", model.name);
  }, [isCheapest, status, model.name]);
  useEffect(() => {
    const card = cardRef.current;
    if (status !== "done" || reduce || !card) return;
    withMotion(({ gsap }) => {
      const plane = card.querySelector(".card-tilt");
      if (plane)
        gsap.fromTo(
          plane,
          { scale: 0.985 },
          { scale: 1, duration: 0.5, ease: "arenaSnap", clearProps: "scale" },
        );
      const award = card.querySelector(".answer-award:not(.answer-award-fastest)");
      if (award)
        gsap.fromTo(
          award,
          { scale: 0.5, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.5,
            ease: "arenaSnap",
            delay: 0.05,
            clearProps: "scale,opacity",
          },
        );
    });
  }, [status, reduce]);

  return (
    <article
      ref={cardRef}
      data-flip-id={model.id}
      data-model-id={model.id}
      data-status={status}
      data-cost={run?.cost}
      data-latency-ms={run?.latencyMs}
      aria-busy={status === "pending"}
      style={{ "--provider-color": model.color } as CSSProperties}
      className={`model-column model-card${expanded ? " model-card-expanded" : ""}`}
    >
      <div className="card-arrival">
        <div className="card-tilt">
          <header className="model-heading">
            <div className="model-provider-row">
              <div className="model-provider">
                <ModelLogo model={model} />
                <span>{model.provider}</span>
              </div>
              <div className="flex shrink-0 items-center">
                {run?.text && status === "done" ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      animateFeedback(
                        event.currentTarget.firstElementChild,
                        [{ transform: "scale(0.8)" }, { transform: "scale(1)" }],
                        undefined,
                        "bouncy",
                      );
                      void copyText();
                    }}
                    aria-label={`Copy ${model.name} answer`}
                    title={
                      copyState === "failed"
                        ? "Clipboard unavailable. Select the answer to copy."
                        : copyState === "copied"
                          ? "Copied"
                          : "Copy answer"
                    }
                    className="icon-button"
                  >
                    <span className="action-icon" aria-hidden="true">
                      {copyState === "copied" ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onRerun(model.id)}
                  disabled={!canRerun}
                  aria-label={`Re-run ${model.name}`}
                  title="Ask this model the same question again"
                  className="icon-button disabled:opacity-30"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <h3 title={model.id}>{model.name}</h3>
            {status === "pending" && run?.startedAt !== undefined ? (
              <span className="live-stopwatch" aria-hidden="true">
                {formatMsTick(Math.max(0, now - run.startedAt))}
              </span>
            ) : null}
          </header>

          <div className="answer-body">
            {status === "pending" ? (
              <div className="pending-answer">
                <p className="run-phase" role="status">
                  {run?.phase === "queued" ? (
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <span className="live-status" aria-hidden="true">
                      <LoaderCircle className="status-spin h-3.5 w-3.5" />
                    </span>
                  )}
                  {run?.phase === "queued"
                    ? "Waiting for dispatch…"
                    : run?.phase === "retrying"
                      ? "Trying again…"
                      : model.kind === "image"
                        ? "Creating an image…"
                        : "Thinking…"}
                </p>
                <span className="pending-cursor" aria-hidden="true">
                  ?
                </span>
                <div className="pending-pixels" aria-hidden="true">
                  <span className="skeleton-shimmer" />
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((pixel) => (
                    <span key={pixel} style={{ "--pixel": pixel } as CSSProperties} />
                  ))}
                </div>
              </div>
            ) : status === "error" ? (
              <div className="error-answer">
                <p className="flex items-center gap-2 text-xs font-semibold text-orange">
                  <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {ERROR_LABELS[run?.errorCode ?? "api"]}
                </p>
                <p>{run?.error}</p>
                {run?.errorCode === "credits" ? (
                  <a
                    href={TOP_UP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="soft-button w-fit border border-orange/25 px-3 py-2 text-xs text-orange"
                  >
                    Top up Pollen
                  </a>
                ) : null}
              </div>
            ) : status === "done" && model.kind === "image" && run?.imageUrl ? (
              <figure id={answerId} className="answer-image absolute inset-0">
                <button
                  type="button"
                  onClick={showImage}
                  aria-label={`View ${model.name} image`}
                  aria-haspopup="dialog"
                  aria-controls={`${answerId}-dialog`}
                  className="answer-image-trigger"
                >
                  <span className="answer-image-viewport">
                    <PixelImage src={run.imageUrl} alt={`Visual answer to: ${question}`} />
                  </span>
                  <span className="image-view-hint" aria-hidden="true">
                    <Maximize2 className="h-3.5 w-3.5" /> View image
                  </span>
                </button>
                <figcaption>FLUX&apos;s visual answer</figcaption>
              </figure>
            ) : status === "done" && run?.text ? (
              <>
                <p
                  ref={answerRef}
                  id={answerId}
                  className={
                    "answer-copy whitespace-pre-wrap break-words" +
                    (expanded ? "" : " absolute inset-0 overflow-hidden")
                  }
                >
                  {run.text}
                </p>
                {overflows && !expanded ? (
                  <span
                    className="answer-fade pointer-events-none absolute inset-x-0 bottom-0 h-10"
                    aria-hidden="true"
                  />
                ) : null}
              </>
            ) : (
              <p className="absolute inset-0 flex items-center text-sm text-quiet">
                Waiting for a question…
              </p>
            )}
          </div>

          <div className="answer-tools">
            {reasoning > 0 ? (
              <span
                className="answer-reasoning"
                title="Reasoning is part of the billed output token count."
              >
                +{formatTokens(reasoning)} reasoning
              </span>
            ) : null}
            {isFastest && status === "done" ? (
              <span className="answer-award answer-award-fastest">&#9889; Fastest</span>
            ) : null}
            {isCheapest && status === "done" ? (
              <span className="answer-award">Cheapest</span>
            ) : null}
            {status === "done" && ((run?.text && (overflows || expanded)) || run?.imageUrl) ? (
              <button
                type="button"
                onClick={run?.imageUrl ? showImage : toggleExpanded}
                aria-expanded={run?.imageUrl ? imageOpen : expanded}
                aria-controls={run?.imageUrl ? `${answerId}-dialog` : answerId}
                aria-haspopup={run?.imageUrl ? "dialog" : undefined}
                title={model.kind === "image" ? "View the full image" : "Read the full answer"}
                className="expand-button soft-button"
              >
                {expanded ? "Collapse" : "Expand"}
              </button>
            ) : null}
            {copyState === "failed" ? (
              <span role="status" className="text-[10px] text-orange">
                Copy failed
              </span>
            ) : null}
          </div>

          <div className="model-metrics">
            <Metric
              label="Latency"
              value={
                status === "pending"
                  ? run?.startedAt === undefined
                    ? "queued"
                    : formatMsTick(Math.max(0, now - run.startedAt))
                  : formatLatency(run?.latencyMs)
              }
              sub={
                run?.ttftMs === undefined ? undefined : `first token ${formatLatency(run.ttftMs)}`
              }
              title="Request wall time, including retries. First-token time is server-reported for the successful attempt."
            />
            <Metric
              label="Est. cost"
              value={status === "pending" ? "…" : formatPollen(run?.cost)}
              sub={run?.cost === undefined ? undefined : "Pollen"}
              title={costTitle(run)}
            />
            <Metric
              label="Tokens"
              value={
                status === "pending"
                  ? "…"
                  : run?.imageTokens !== undefined
                    ? `${run.imageTokens} img`
                    : formatTokens(run?.usage?.total_tokens)
              }
              title="Total tokens reported by the provider, including reasoning."
            />
          </div>
          <p className="served-model" title={run?.servedModel}>
            {run?.servedModel ? `served: ${run.servedModel}` : "\u00a0"}
          </p>
        </div>
      </div>
      {run?.imageUrl ? (
        <dialog
          ref={imageDialogRef}
          id={`${answerId}-dialog`}
          aria-labelledby={`${answerId}-dialog-title`}
          aria-describedby={`${answerId}-dialog-question`}
          aria-modal="true"
          className="image-dialog"
          onClose={() => setImageOpen(false)}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const controls = event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              event.currentTarget.close();
          }}
        >
          <div className="image-dialog-header">
            <h2 id={`${answerId}-dialog-title`}>{model.name} image</h2>
            <button
              type="button"
              onClick={() => imageDialogRef.current?.close()}
              className="icon-button"
              aria-label="Collapse"
              title="Close image"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <figure>
            <img src={run.imageUrl} alt={`Visual answer to: ${question}`} />
            <figcaption id={`${answerId}-dialog-question`}>{question}</figcaption>
          </figure>
        </dialog>
      ) : null}
    </article>
  );
}

// Settles patch one run at a time; memo keeps the other cards out of each
// reconciliation, which is most of the commit cost on throttled CPUs.
export const ModelCard = memo(ModelCardView);
