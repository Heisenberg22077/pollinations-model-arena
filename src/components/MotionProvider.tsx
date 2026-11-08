import { domMax, LazyMotion, MotionConfig } from "motion/react";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

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
  const reduce = Boolean(systemReduce || paused);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduce(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = reduce ? "off" : "on";
    window.dispatchEvent(new Event("model-table:motion-change"));
    try {
      localStorage.setItem(MOTION_STORAGE, String(paused));
    } catch {}
  }, [paused, reduce]);

  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig
        reducedMotion={reduce ? "always" : "never"}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }}
      >
        <MotionSettings.Provider
          value={{ reduce, paused, togglePaused: () => setPaused((value) => !value) }}
        >
          {children}
        </MotionSettings.Provider>
      </MotionConfig>
    </LazyMotion>
  );
}
