import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { motionStack, startChoreography, startMotionClock } from "../lib/arena-motion";

const MOTION_STORAGE = "model-table:motion-paused";
const MotionSettings = createContext({ reduce: false, paused: false, togglePaused: () => {} });
function readPaused() {
  try {
    return localStorage.getItem(MOTION_STORAGE) === "true";
  } catch {
    return false;
  }
}
export function useMotionSettings() {
  return useContext(MotionSettings);
}
export function MotionProvider({ children }: { children: ReactNode }) {
  const [systemReduce, setSystemReduce] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [paused, setPaused] = useState(readPaused);
  const [ready, setReady] = useState(() => Boolean(motionStack()));
  // Fewer curtain blocks on phones: 96 transformed nodes cost ~300ms of style
  // work on a 6x-throttled CPU; 64 keeps the effect and the frame budget.
  const [curtainCols, setCurtainCols] = useState(() =>
    window.matchMedia("(max-width: 639px)").matches ? 8 : 12,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setCurtainCols(query.matches ? 8 : 12);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const reduce = systemReduce || paused;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduce(preference.matches);
    const loaded = () => setReady(Boolean(motionStack()));
    preference.addEventListener("change", update);
    window.addEventListener("load", loaded);
    window.addEventListener("arena:stack-ready", loaded);
    loaded();
    return () => {
      preference.removeEventListener("change", update);
      window.removeEventListener("load", loaded);
      window.removeEventListener("arena:stack-ready", loaded);
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Restart the fallback clock when CDN scripts finish loading.
  useEffect(() => startMotionClock(), [ready]);
  useEffect(() => {
    document.documentElement.dataset.motion = reduce ? "off" : "on";
    window.dispatchEvent(new Event("model-table:motion-change"));
    try {
      localStorage.setItem(MOTION_STORAGE, String(paused));
    } catch {}
  }, [paused, reduce]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Readiness changes when deferred CDN scripts load.
  useEffect(() => startChoreography(paused), [paused, ready]);
  return (
    <MotionSettings.Provider
      value={{ reduce, paused, togglePaused: () => setPaused((value) => !value) }}
    >
      {children}
      <canvas id="pollen-celebration" tabIndex={-1} aria-hidden="true" />
      <div className="arena-cursor-layer" aria-hidden="true">
        <div className="arena-cursor" hidden aria-hidden="true">
          <span className="arena-cursor-label">RUN &#8629;</span>
        </div>
      </div>
      <div className="pixel-transition-grid" hidden aria-hidden="true">
        <div
          className="pixel-transition-matrix"
          data-cols={curtainCols}
          style={{ "--curtain-cols": curtainCols } as CSSProperties}
        >
          {Array.from({ length: curtainCols * 8 }, (_, index) => `curtain-${index}`).map(
            (pixel) => (
              <i key={pixel} />
            ),
          )}
        </div>
      </div>
    </MotionSettings.Provider>
  );
}
