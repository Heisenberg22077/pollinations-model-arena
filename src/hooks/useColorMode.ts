import { useEffect, useRef, useState } from "react";

export type ColorMode = "day" | "night";
const COLOR_MODE_STORAGE = "model-table:color-mode";

function readColorMode(): ColorMode {
  try {
    return localStorage.getItem(COLOR_MODE_STORAGE) === "night" ? "night" : "day";
  } catch {
    return "day";
  }
}

export function useColorMode() {
  const [colorMode, setColorMode] = useState<ColorMode>(readColorMode);
  const transitionRef = useRef<ViewTransition | undefined>(undefined);
  const requestedModeRef = useRef(colorMode);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      if (preference.matches || document.documentElement.dataset.motion === "off")
        transitionRef.current?.skipTransition();
    };
    preference.addEventListener("change", stop);
    window.addEventListener("model-table:motion-change", stop);
    return () => {
      preference.removeEventListener("change", stop);
      window.removeEventListener("model-table:motion-change", stop);
      transitionRef.current?.skipTransition();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.colorMode = colorMode;
    document.documentElement.classList.toggle("dark", colorMode === "night");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", colorMode === "day" ? "#d8cfc0" : "#161411");
    try {
      localStorage.setItem(COLOR_MODE_STORAGE, colorMode);
    } catch {
      // A theme change still works when browser storage is unavailable.
    }
  }, [colorMode]);

  return {
    colorMode,
    toggleColorMode: () => {
      const next = requestedModeRef.current === "day" ? "night" : "day";
      requestedModeRef.current = next;
      try {
        localStorage.setItem(COLOR_MODE_STORAGE, next);
      } catch {}
      const apply = () => {
        if (requestedModeRef.current !== next) return;
        document.documentElement.dataset.colorMode = next;
        document.documentElement.classList.toggle("dark", next === "night");
        setColorMode(next);
      };
      transitionRef.current?.skipTransition();
      if (
        document.startViewTransition &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        document.documentElement.dataset.motion !== "off"
      ) {
        const transition = document.startViewTransition(apply);
        transitionRef.current = transition;
        void transition.ready.catch(() => {});
        void transition.finished.catch(() => {});
      } else apply();
    },
  };
}
