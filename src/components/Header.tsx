import {
  ChevronDown,
  Github,
  Moon,
  Pause,
  Play,
  Sparkles,
  Square,
  Sun,
  Table2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect } from "react";
import { REPO_URL } from "../config";
import { useBee } from "../hooks/useBee";
import type { ColorMode } from "../hooks/useColorMode";
import { animateFeedback } from "../lib/motion";
import { useMotionSettings } from "./MotionProvider";
import { PolliConnect } from "./PolliConnect";
import { ScrambleText } from "./ScrambleText";

function BeeGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="10.5" cy="13.5" rx="5.5" ry="4" />
      <path d="M8.5 10v7M11.5 9.7v7.6" />
      <circle cx="17" cy="12" r="2.3" />
      <path d="M18.2 10l1.6-2.2M16.2 9.8l.2-2.6" />
      <path d="M7.5 10c-2.2-2.6-5-1.4-3.8 1.2M11 9.6c.2-3.2 3.2-3.6 4-1" />
    </svg>
  );
}

export function Header({
  apiKey,
  onKey,
  colorMode,
  onToggleColorMode,
  onOpenGuide,
  guideOpen,
  canRun,
  isRunning,
  onRun,
  onStop,
}: {
  apiKey: string | null;
  onKey: (key: string | null) => void;
  colorMode: ColorMode;
  onToggleColorMode: () => void;
  onOpenGuide: () => void;
  guideOpen: boolean;
  canRun: boolean;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
}) {
  const { paused, togglePaused } = useMotionSettings();
  const { beeEnabled, soundOn, toggleBee, toggleSound } = useBee();
  const motionLabel = paused ? "Resume animations" : "Pause animations";
  const beeLabel = beeEnabled ? "Send the bee away" : "Release the garden bee";
  const soundLabel = soundOn ? "Mute sound" : "Unmute sound";
  useEffect(() => {
    const hint = document.querySelector<HTMLElement>(".connection-hint");
    if (apiKey && hint) hint.hidden = true;
  }, [apiKey]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeMobileMenu = () => {
      if (desktop.matches) document.getElementById("mobile-navigation")?.hidePopover();
    };
    desktop.addEventListener("change", closeMobileMenu);
    return () => desktop.removeEventListener("change", closeMobileMenu);
  }, []);
  return (
    <header className="site-header">
      <a href="#main" className="skip-link">
        Skip to the table
      </a>
      <div className="shell site-header-inner">
        <a href="#top" className="brand-link" aria-label="Model Table home">
          <span className="brand-symbol" aria-hidden="true">
            <Table2 className="h-5 w-5" />
          </span>
          <span className="brand-wordmark">Model Table</span>
        </a>

        <nav className="main-navigation" aria-label="Main navigation">
          <a href="#roster" className="nav-link" aria-label="Lineup">
            <span className="nav-token nav-token-pollen" aria-hidden="true">
              <Table2 className="h-3 w-3" />
            </span>
            <ScrambleText>Lineup</ScrambleText>
          </a>
          <button
            type="button"
            onClick={onOpenGuide}
            aria-controls="how"
            aria-expanded={guideOpen}
            aria-label="How it works"
            className="nav-link"
          >
            <span className="nav-token nav-token-sage" aria-hidden="true">
              <ChevronDown className={`guide-chevron h-3 w-3${guideOpen ? " rotate-180" : ""}`} />
            </span>
            <ScrambleText>How it works</ScrambleText>
          </button>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="nav-link"
            aria-label="Source"
          >
            <span className="nav-token nav-token-source" aria-hidden="true">
              <Github className="h-3 w-3" />
            </span>
            <ScrambleText>Source</ScrambleText>
          </a>
        </nav>

        <button type="button" popoverTarget="mobile-navigation" className="mobile-menu-button">
          Menu <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
        <nav
          id="mobile-navigation"
          popover="auto"
          className="mobile-navigation"
          aria-label="Mobile navigation"
        >
          {/* biome-ignore lint/a11y/useValidAnchor: This href navigates to the lineup; the handler only dismisses the popover. */}
          <a
            href="#roster"
            onClick={() => document.getElementById("mobile-navigation")?.hidePopover()}
          >
            Lineup <Table2 className="h-4 w-4" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => {
              document.getElementById("mobile-navigation")?.hidePopover();
              onOpenGuide();
            }}
          >
            How it works <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source <Github className="h-4 w-4" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => {
              togglePaused();
              document.getElementById("mobile-navigation")?.hidePopover();
            }}
          >
            {motionLabel}
            {paused ? (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Pause className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              toggleBee();
              document.getElementById("mobile-navigation")?.hidePopover();
            }}
          >
            {beeLabel}
            <BeeGlyph className="h-4 w-4" />
          </button>
          <button type="button" onClick={toggleSound}>
            {soundLabel}
            {soundOn ? (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </nav>

        <div className="header-account">
          <button
            type="button"
            onClick={togglePaused}
            aria-label={motionLabel}
            title={motionLabel}
            className="icon-button motion-button"
          >
            {paused ? (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Pause className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={(event) => {
              animateFeedback(
                event.currentTarget.firstElementChild,
                [
                  { transform: "rotate(-90deg) scale(0.6)", opacity: 0.4 },
                  { transform: "rotate(0deg) scale(1)", opacity: 1 },
                ],
                undefined,
                "fluid",
              );
              onToggleColorMode();
            }}
            aria-label={colorMode === "day" ? "Switch to night mode" : "Switch to day mode"}
            title={colorMode === "day" ? "Night mode" : "Day mode"}
            className="icon-button theme-button"
          >
            <span className="theme-icon" aria-hidden="true">
              {colorMode === "day" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              animateFeedback(
                event.currentTarget.firstElementChild,
                [
                  { transform: "rotate(-12deg) scale(0.8)" },
                  { transform: "rotate(10deg) scale(1.12)" },
                  { transform: "rotate(0deg) scale(1)" },
                ],
                undefined,
                "bouncy",
              );
              toggleBee();
            }}
            aria-label={beeLabel}
            aria-pressed={beeEnabled}
            title={beeLabel}
            className="icon-button bee-button"
          >
            <BeeGlyph className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundLabel}
            aria-pressed={soundOn}
            title={soundLabel}
            className="icon-button bee-sound-button"
          >
            {soundOn ? (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <PolliConnect onKey={onKey} />
        </div>

        <div className="table-actions">
          <span className="connection-hint" role="status" hidden>
            Connect Pollinations to unlock the arena
          </span>
          <button
            type="button"
            onClick={isRunning ? onStop : onRun}
            disabled={!isRunning && !canRun}
            aria-label={isRunning ? "Stop the table" : "Run the table"}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            title={!apiKey ? "Connect your Pollen to run." : "Ctrl or Command + Enter"}
            className={`run-button${isRunning ? " run-button-stop" : ""}`}
          >
            <span className="run-token" aria-hidden="true">
              {isRunning ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </span>
            {isRunning ? "Stop the table" : "Run the table"}
            <kbd className="run-shortcut">Ctrl ↵</kbd>
            <span className="run-glint" aria-hidden="true" />
          </button>
          <span className="mobile-connection-note">
            {apiKey ? "Your key stays in this tab." : "Connect your Pollen to run."}
          </span>
        </div>
      </div>
      <span className="scroll-progress" aria-hidden="true" />
    </header>
  );
}
