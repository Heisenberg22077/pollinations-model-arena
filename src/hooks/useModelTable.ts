import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CORE_IDS, DEFAULT_PROMPT, MAX_PROMPT_LENGTH, MODELS, type ModelDef } from "../config";
import { pricingFor } from "../lib/catalog";
import { HISTORY_KEY, readHistory, rememberRun, writeHistory } from "../lib/history";
import { askImage, askText, imageCost, PollinationsError, textCost } from "../lib/pollinations";
import { abortableDelay } from "../lib/request";
import type { HealthStatus, RecentRun, Run, Runs } from "../types";
import { usePricing } from "./usePricing";

export interface ModelTable {
  roster: ModelDef[];
  selectedIds: string[];
  selectedModels: ModelDef[];
  resultModels: ModelDef[];
  health: Record<string, HealthStatus>;
  prompt: string;
  setPrompt: (prompt: string) => void;
  runs: Runs;
  isRunning: boolean;
  lastQuestion: string;
  history: RecentRun[];
  clearHistory: () => void;
  toggleModel: (id: string) => void;
  selectCore: () => void;
  selectFree: () => void;
  selectAll: () => void;
  run: (apiKey: string) => Promise<void>;
  rerunModel: (id: string, apiKey: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
}

export function useModelTable(): ModelTable {
  const [selectedIds, setSelectedIds] = useState<string[]>(CORE_IDS);
  const [prompt, setPromptState] = useState(DEFAULT_PROMPT);
  const [runs, setRunsState] = useState<Runs>({});
  const [isRunning, setIsRunning] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");
  const [history, setHistory] = useState(readHistory);
  const catalog = usePricing();
  const runIdRef = useRef(0);
  const busyRef = useRef(false);
  const runsRef = useRef<Runs>({});
  const questionRef = useRef("");
  const historyRef = useRef(history);
  const controllersRef = useRef(new Map<string, AbortController>());
  const imageUrlsRef = useRef(new Map<string, string>());

  const roster = useMemo(
    () =>
      MODELS.map((model) => ({
        ...model,
        paidOnly: catalog.paidOnly[model.id] ?? model.paidOnly,
      })),
    [catalog.paidOnly],
  );
  const selectedModels = useMemo(
    () =>
      roster.filter(
        (model) => selectedIds.includes(model.id) && catalog.health[model.id] !== "down",
      ),
    [catalog.health, roster, selectedIds],
  );
  // The results belong to the submitted lineup, even while the next lineup changes.
  const resultModels = useMemo(
    () => (lastQuestion ? roster.filter((model) => Object.hasOwn(runs, model.id)) : selectedModels),
    [lastQuestion, roster, runs, selectedModels],
  );

  const replaceRuns = useCallback((next: Runs) => {
    runsRef.current = next;
    setRunsState(next);
  }, []);
  const patchRun = useCallback(
    (runId: number, id: string, patch: Partial<Run>) => {
      if (runIdRef.current !== runId) return;
      replaceRuns({
        ...runsRef.current,
        [id]: { ...runsRef.current[id], ...patch },
      });
    },
    [replaceRuns],
  );
  const releaseImages = useCallback(() => {
    for (const url of imageUrlsRef.current.values()) URL.revokeObjectURL(url);
    imageUrlsRef.current.clear();
  }, []);
  const recordHistory = useCallback(() => {
    const next = rememberRun(historyRef.current, questionRef.current, runsRef.current);
    historyRef.current = next;
    setHistory(next);
    writeHistory(next);
  }, []);
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* Optional storage. */
    }
  }, []);
  const setPrompt = useCallback(
    (value: string) => setPromptState(value.slice(0, MAX_PROMPT_LENGTH)),
    [],
  );

  const runOne = useCallback(
    async (runId: number, model: ModelDef, question: string, apiKey: string, delayMs: number) => {
      const controller = new AbortController();
      controllersRef.current.set(model.id, controller);
      let started: number | undefined;
      const pricing = pricingFor(model.id, catalog.pricing);
      try {
        await abortableDelay(delayMs, controller.signal);
        controller.signal.throwIfAborted();
        started = performance.now();
        patchRun(runId, model.id, { startedAt: Date.now(), phase: "running", pricing });
        const options = { onRetry: () => patchRun(runId, model.id, { phase: "retrying" }) };
        let answer: Partial<Run>;
        if (model.kind === "image") {
          const result = await askImage(model, question, apiKey, controller.signal, {
            ...options,
            seed: runsRef.current[model.id]?.seed,
          });
          if (controller.signal.aborted || runIdRef.current !== runId) {
            URL.revokeObjectURL(result.objectUrl);
            return;
          }
          const previous = imageUrlsRef.current.get(model.id);
          if (previous) URL.revokeObjectURL(previous);
          imageUrlsRef.current.set(model.id, result.objectUrl);
          answer = {
            imageUrl: result.objectUrl,
            imageTokens: result.imageTokens,
            cost: imageCost(result.imageTokens, pricing),
          };
        } else {
          const result = await askText(model, question, apiKey, controller.signal, options);
          answer = {
            text: result.text,
            usage: result.usage,
            servedModel: result.servedModel,
            ttftMs:
              result.usage?.latency_checkpoint?.user_visible_ttft_ms ??
              result.usage?.latency_checkpoint?.service_ttft_ms,
            cost: textCost(result.usage, pricing),
          };
        }
        patchRun(runId, model.id, {
          ...answer,
          status: "done",
          phase: undefined,
          latencyMs: Math.round(performance.now() - started),
          finishedAt: Date.now(),
        });
      } catch (error) {
        if (controller.signal.aborted || runIdRef.current !== runId) return;
        const failure =
          error instanceof PollinationsError
            ? error
            : new PollinationsError("Unexpected error while calling this model.", "api");
        patchRun(runId, model.id, {
          status: "error",
          phase: undefined,
          error: failure.message,
          errorCode: failure.code,
          usage: failure.usage,
          pricing,
          cost: textCost(failure.usage, pricing),
          latencyMs: started === undefined ? undefined : Math.round(performance.now() - started),
          finishedAt: Date.now(),
        });
      } finally {
        if (controllersRef.current.get(model.id) === controller)
          controllersRef.current.delete(model.id);
      }
    },
    [catalog.pricing, patchRun],
  );

  const finish = useCallback(
    (runId: number) => {
      if (runIdRef.current !== runId) return;
      busyRef.current = false;
      setIsRunning(false);
      recordHistory();
    },
    [recordHistory],
  );

  const run = useCallback(
    async (apiKey: string) => {
      const question = prompt.trim();
      if (!apiKey || !question || !selectedModels.length || busyRef.current) return;
      busyRef.current = true;
      const runId = ++runIdRef.current;
      controllersRef.current.forEach((controller) => {
        controller.abort();
      });
      controllersRef.current.clear();
      releaseImages();
      const queuedAt = Date.now();
      const fresh: Runs = {};
      for (const model of selectedModels)
        fresh[model.id] = {
          status: "pending",
          phase: "queued",
          queuedAt,
          seed: model.kind === "image" ? Math.floor(Math.random() * 1_000_000_000) : undefined,
        };
      replaceRuns(fresh);
      questionRef.current = question;
      setLastQuestion(question);
      setIsRunning(true);
      try {
        await Promise.allSettled(
          selectedModels.map((model, index) => runOne(runId, model, question, apiKey, index * 250)),
        );
      } finally {
        finish(runId);
      }
    },
    [finish, prompt, releaseImages, replaceRuns, runOne, selectedModels],
  );

  const rerunModel = useCallback(
    async (id: string, apiKey: string) => {
      const model = roster.find((entry) => entry.id === id);
      if (
        !apiKey ||
        !model ||
        !questionRef.current ||
        !runsRef.current[id] ||
        busyRef.current ||
        catalog.health[id] === "down"
      )
        return;
      busyRef.current = true;
      const runId = ++runIdRef.current;
      const previous = runsRef.current[id];
      const image = imageUrlsRef.current.get(id);
      if (image) {
        URL.revokeObjectURL(image);
        imageUrlsRef.current.delete(id);
      }
      replaceRuns({
        ...runsRef.current,
        [id]: { status: "pending", phase: "queued", queuedAt: Date.now(), seed: previous.seed },
      });
      setIsRunning(true);
      try {
        await runOne(runId, model, questionRef.current, apiKey, 0);
      } finally {
        finish(runId);
      }
    },
    [catalog.health, finish, replaceRuns, roster, runOne],
  );

  const stop = useCallback(() => {
    const wasRunning = busyRef.current;
    ++runIdRef.current;
    controllersRef.current.forEach((controller) => {
      controller.abort();
    });
    controllersRef.current.clear();
    busyRef.current = false;
    setIsRunning(false);
    const next: Runs = { ...runsRef.current };
    for (const [id, result] of Object.entries(next)) {
      if (result.status === "pending")
        next[id] = {
          ...result,
          status: "error",
          phase: undefined,
          error: "Stopped before an answer arrived.",
          errorCode: "stopped",
          finishedAt: Date.now(),
          latencyMs:
            result.startedAt === undefined ? undefined : Math.max(0, Date.now() - result.startedAt),
        };
    }
    replaceRuns(next);
    if (wasRunning) recordHistory();
  }, [recordHistory, replaceRuns]);
  const clear = useCallback(() => {
    stop();
    releaseImages();
    replaceRuns({});
    questionRef.current = "";
    setLastQuestion("");
  }, [releaseImages, replaceRuns, stop]);

  const toggleModel = useCallback(
    (id: string) => {
      if (!roster.some((model) => model.id === id) || catalog.health[id] === "down") return;
      setSelectedIds((previous) =>
        previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id],
      );
    },
    [catalog.health, roster],
  );
  const selectCore = useCallback(
    () =>
      setSelectedIds(
        roster
          .filter((model) => model.core && catalog.health[model.id] !== "down")
          .map((model) => model.id),
      ),
    [catalog.health, roster],
  );
  const selectFree = useCallback(
    () =>
      setSelectedIds(
        roster
          .filter((model) => !model.paidOnly && catalog.health[model.id] !== "down")
          .map((model) => model.id),
      ),
    [catalog.health, roster],
  );
  const selectAll = useCallback(
    () =>
      setSelectedIds(
        roster.filter((model) => catalog.health[model.id] !== "down").map((model) => model.id),
      ),
    [catalog.health, roster],
  );
  useEffect(() => {
    setSelectedIds((previous) => previous.filter((id) => catalog.health[id] !== "down"));
  }, [catalog.health]);
  useEffect(
    () => () => {
      ++runIdRef.current;
      controllersRef.current.forEach((controller) => {
        controller.abort();
      });
      controllersRef.current.clear();
      releaseImages();
    },
    [releaseImages],
  );

  return {
    roster,
    selectedIds,
    selectedModels,
    resultModels,
    health: catalog.health,
    prompt,
    setPrompt,
    runs,
    isRunning,
    lastQuestion,
    history,
    clearHistory,
    toggleModel,
    selectCore,
    selectFree,
    selectAll,
    run,
    rerunModel,
    stop,
    clear,
  };
}
