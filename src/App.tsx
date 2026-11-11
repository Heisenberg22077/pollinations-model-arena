import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GardenBanner } from "./components/GardenBanner";
import { Header } from "./components/Header";
import { PromptComposer } from "./components/PromptComposer";
import { ResultsPanel } from "./components/ResultsPanel";
import { STORAGE_TOKEN_KEY } from "./config";
import { useColorMode } from "./hooks/useColorMode";
import { useModelTable } from "./hooks/useModelTable";
import {
  captureLayout,
  commitLayout,
  connectionFeedback,
  launchArena,
  scrollArena,
} from "./lib/arena-motion";
import { armMusicGesture } from "./lib/music";

function readStoredKey(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(readStoredKey);
  const [guideOpen, setGuideOpen] = useState(false);
  const guideRequested = useRef(false);
  const launchRequested = useRef(false);
  const table = useModelTable();
  const { colorMode, toggleColorMode } = useColorMode();

  useEffect(() => {
    armMusicGesture();
  }, []);

  const canRun =
    table.prompt.trim().length > 0 && table.selectedModels.length > 0 && !table.isRunning;

  const handleRun = useCallback(() => {
    if (!apiKey) {
      connectionFeedback();
      return;
    }
    captureLayout();
    launchRequested.current = true;
    void table.run(apiKey);
  }, [apiKey, table.run]);

  const handleKey = useCallback(
    (key: string | null) => {
      setApiKey(key);
      if (!key) table.stop();
    },
    [table.stop],
  );

  const handleRerun = useCallback(
    (id: string) => {
      if (apiKey) void table.rerunModel(id, apiKey);
    },
    [apiKey, table.rerunModel],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        // A modal owns its keyboard interaction until it closes.
        if (document.querySelector("dialog[open]")) return;
        event.preventDefault();
        if (table.isRunning) table.stop();
        else if (canRun) handleRun();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canRun, handleRun, table.isRunning, table.stop]);

  const handleOpenGuide = useCallback(() => {
    guideRequested.current = true;
    setGuideOpen(true);
  }, []);

  useLayoutEffect(() => {
    commitLayout();
    if (launchRequested.current) {
      launchRequested.current = false;
      launchArena();
    }
    if (guideRequested.current && guideOpen) {
      guideRequested.current = false;
      document.querySelector<HTMLElement>("#how summary")?.focus({ preventScroll: true });
      scrollArena("#how", true);
    }
  });

  return (
    <div id="top" className="relative min-h-screen">
      <Header
        apiKey={apiKey}
        onKey={handleKey}
        colorMode={colorMode}
        onToggleColorMode={toggleColorMode}
        onOpenGuide={handleOpenGuide}
        guideOpen={guideOpen}
        canRun={canRun}
        isRunning={table.isRunning}
        onRun={handleRun}
        onStop={table.stop}
      />

      <main id="main" tabIndex={-1} className="workspace shell">
        <PromptComposer
          prompt={table.prompt}
          setPrompt={table.setPrompt}
          selectedIds={table.selectedIds}
          models={table.roster}
          health={table.health}
          history={table.history}
          onClearHistory={table.clearHistory}
          onToggle={(id) => {
            captureLayout();
            table.toggleModel(id);
          }}
          onPreset={(preset) => {
            captureLayout();
            if (preset === "core") table.selectCore();
            else if (preset === "free") table.selectFree();
            else table.selectAll();
          }}
          guideOpen={guideOpen}
          onGuideToggle={setGuideOpen}
          colorMode={colorMode}
        />
        <ResultsPanel
          models={table.resultModels}
          runs={table.runs}
          isRunning={table.isRunning}
          lastQuestion={table.lastQuestion}
          nextQuestion={table.prompt}
          onRerun={handleRerun}
          canRerun={Boolean(apiKey) && !table.isRunning}
          health={table.health}
          onClear={() => {
            captureLayout();
            table.clear();
          }}
        />
      </main>

      <footer className="site-footer relative">
        <div className="shell footer-shell">
          <GardenBanner colorMode={colorMode} />
          <div className="footer-content">
            <div className="footer-credits">
              <p className="text-xs text-quiet">Independent AI model comparison.</p>
              <a
                href="https://pollinations.ai/?ref=badge"
                target="_blank"
                rel="noreferrer"
                className="badge-link"
              >
                <img
                  src="https://raw.githubusercontent.com/pollinations/pollinations/main/packages/ui/src/brand/badge-made-with.svg"
                  alt="Made with pollinations.ai"
                  className="h-6"
                />
              </a>
            </div>
          </div>
        </div>
      </footer>
      <div className="grain" aria-hidden="true" />
    </div>
  );
}
