import { ChevronDown, Dices, History } from "lucide-react";
import * as m from "motion/react-m";
import { useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_PROMPT, MAX_PROMPT_LENGTH, type ModelDef, STARTER_PROMPTS } from "../config";
import { SURPRISE_PROMPTS } from "../data/surpriseQuestions";
import type { ColorMode } from "../hooks/useColorMode";
import { useEntrance } from "../hooks/useEntrance";
import { formatLatency, formatPollen } from "../lib/format";
import { animateFeedback } from "../lib/motion";
import type { HealthStatus, RecentRun } from "../types";
import { AnimatedDetails } from "./AnimatedDisclosure";
import { GardenScene } from "./GardenScene";
import { ModelRoster } from "./ModelRoster";
import { ScrambleText } from "./ScrambleText";

const STARTER_LABELS = ["Humans", "Love", "Inventions", "Ask us"];

export function PromptComposer({
  prompt,
  setPrompt,
  selectedIds,
  models,
  health,
  history,
  onClearHistory,
  onToggle,
  onPreset,
  guideOpen,
  onGuideToggle,
  colorMode,
}: {
  prompt: string;
  setPrompt: (p: string) => void;
  selectedIds: string[];
  models: ModelDef[];
  health: Record<string, HealthStatus>;
  history: RecentRun[];
  onClearHistory: () => void;
  onToggle: (id: string) => void;
  onPreset: (preset: "core" | "free" | "all") => void;
  guideOpen: boolean;
  onGuideToggle: (open: boolean) => void;
  colorMode: ColorMode;
}) {
  const introEntrance = useEntrance(0);
  const composerEntrance = useEntrance(2);
  const surpriseQueue = useRef<string[]>([]);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [recentOpen, setRecentOpen] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Remeasure after React writes each prompt to the textarea.
  useLayoutEffect(() => {
    const input = promptRef.current;
    if (!input) return;
    const resize = () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [prompt]);

  const surprise = () => {
    const queue = surpriseQueue.current;
    if (!queue.length) {
      queue.push(...SURPRISE_PROMPTS);
      for (let index = queue.length - 1; index > 0; index--) {
        const swap = Math.floor(Math.random() * (index + 1));
        [queue[index], queue[swap]] = [queue[swap], queue[index]];
      }
    }
    // Preserve every question in the cycle, including at cycle boundaries.
    if (queue.length > 1 && queue[queue.length - 1] === prompt) {
      [queue[0], queue[queue.length - 1]] = [queue[queue.length - 1], queue[0]];
    }
    setPrompt(queue.pop() ?? DEFAULT_PROMPT);
  };

  return (
    <section className="prompt-workspace" aria-label="Question and model lineup">
      <div className="question-workbench">
        <m.div className="workspace-intro" {...introEntrance}>
          <h1 className="slogan" aria-label="One Question. Every Model.">
            <span>
              <ScrambleText autoPlay duration={720}>
                One Question.
              </ScrambleText>
            </span>
            <span>
              <ScrambleText autoPlay duration={840} repeatEvery={14000}>
                Every Model.
              </ScrambleText>
            </span>
          </h1>
          <p className="workspace-lede">
            <span>Compare answers, speed and Pollen cost.</span>
            <span className="model-signal" aria-hidden="true">
              {models
                .filter((model) => selectedIds.includes(model.id))
                .map((model, index) => (
                  <i
                    key={model.id}
                    style={{ background: model.color, animationDelay: `${index * 110}ms` }}
                  />
                ))}
            </span>
          </p>
        </m.div>

        <GardenScene colorMode={colorMode} />

        <m.div className="question-band" {...composerEntrance}>
          <div className="question-label-row">
            <label htmlFor="prompt">Your question</label>
            <span className="question-counter">
              {prompt.length}/{MAX_PROMPT_LENGTH}
            </span>
            <button
              type="button"
              onClick={(event) => {
                animateFeedback(
                  event.currentTarget.querySelector("svg"),
                  [
                    { transform: "rotate(0deg) scale(1)", offset: 0 },
                    { transform: "rotate(-25deg) scale(1.25)", offset: 0.25 },
                    { transform: "rotate(20deg) scale(0.95)", offset: 0.5 },
                    { transform: "rotate(-10deg) scale(1)", offset: 0.75 },
                    { transform: "rotate(0deg) scale(1)", offset: 1 },
                  ],
                  380,
                  "bouncy",
                );
                surprise();
                animateFeedback(
                  promptRef.current,
                  [
                    { opacity: 0.5, transform: "translateY(4px)" },
                    { opacity: 1, transform: "translateY(0)" },
                  ],
                  undefined,
                  "fluid",
                );
              }}
              className="surprise-button"
              aria-label="Surprise me"
            >
              <Dices className="h-4 w-4" aria-hidden="true" />
              <ScrambleText>Surprise me</ScrambleText>
            </button>
          </div>
          <textarea
            ref={promptRef}
            id="prompt"
            aria-label="Your question"
            aria-describedby="prompt-limit"
            value={prompt}
            maxLength={MAX_PROMPT_LENGTH}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            placeholder="Ask every model the same thing…"
            className="question-input"
          />
          <p id="prompt-limit" className="sr-only">
            Maximum {MAX_PROMPT_LENGTH} characters.
          </p>
          <div className="question-bottom-row">
            <div className="starter-questions">
              <span className="starter-label">Try</span>
              {STARTER_PROMPTS.slice(0, 4).map((question, index) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => setPrompt(question)}
                  aria-label={question}
                  title={question}
                  className="composer-chip"
                >
                  {STARTER_LABELS[index]}
                </button>
              ))}
            </div>
            {history.length > 0 ? (
              <AnimatedDetails
                className="recent-questions"
                bodyClassName="history-popover"
                open={recentOpen}
                onOpenChange={setRecentOpen}
                overlay
                summary={
                  <>
                    <History className="h-3.5 w-3.5" aria-hidden="true" />
                    Recent questions
                    <ChevronDown className="guide-chevron h-3 w-3" aria-hidden="true" />
                  </>
                }
              >
                <div className="flex items-center justify-between gap-4 pb-2">
                  <span>On this device</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecentOpen(false);
                      onClearHistory();
                    }}
                    className="soft-button px-2 py-1"
                    aria-label="Clear recent questions"
                  >
                    Clear
                  </button>
                </div>
                {history.map((recent) => (
                  <button
                    key={recent.id}
                    type="button"
                    onClick={() => {
                      setPrompt(recent.prompt);
                      setRecentOpen(false);
                      promptRef.current?.focus({ preventScroll: true });
                    }}
                    aria-label={`Restore recent question: ${recent.prompt}`}
                    title={
                      recent.models.filter((model) => model.status === "done").length +
                      "/" +
                      recent.models.length +
                      " answered, " +
                      formatLatency(
                        Math.max(...recent.models.map((model) => model.latencyMs ?? 0)),
                      ) +
                      " / " +
                      formatPollen(
                        recent.models.reduce((sum, model) => sum + (model.cost ?? 0), 0),
                      ) +
                      " Pollen"
                    }
                    className="history-question"
                  >
                    {recent.prompt}
                  </button>
                ))}
              </AnimatedDetails>
            ) : null}
          </div>
        </m.div>
      </div>

      <ModelRoster
        models={models}
        health={health}
        selectedIds={selectedIds}
        onToggle={onToggle}
        onPreset={onPreset}
      />

      <AnimatedDetails
        id="how"
        open={guideOpen}
        onOpenChange={onGuideToggle}
        className="composer-guide"
        bodyClassName="disclosure-body"
        summary={
          <>
            How it works
            <ChevronDown className="guide-chevron h-3.5 w-3.5" aria-hidden="true" />
          </>
        }
      >
        <div className="guide-content">
          <p>
            Connect your Pollinations account, choose a lineup and run your question. Each model
            answers independently; FLUX creates an image.
          </p>
          <p>
            Latency covers the full request. First-token timing comes from the provider. Pollen
            estimates use live prices and reported usage, including reasoning.
          </p>
          <p>
            Your connection is budget capped and revocable. Recent questions stay on this device;
            their history excludes full answers and your key.
          </p>
        </div>
      </AnimatedDetails>
    </section>
  );
}
