import { useLayoutEffect, useRef, useState } from "react";
import { pixelTheme } from "../lib/arena-motion";

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
  const requestedModeRef = useRef(colorMode);

  // Before first paint: a post-paint theme swap would glide the body from its
  // initial transparent background and flash the wrong palette on reload.
  useLayoutEffect(() => {
    document.documentElement.dataset.colorMode = colorMode;
    document.documentElement.classList.toggle("dark", colorMode === "night");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", colorMode === "day" ? "#f4efe6" : "#1c1b18");
    try {
      localStorage.setItem(COLOR_MODE_STORAGE, colorMode);
    } catch {
      // A theme change still works when browser storage is unavailable.
    }
  }, [colorMode]);

  return {
    colorMode,
    toggleColorMode: (origin?: { x: number; y: number }) => {
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
      pixelTheme(next, apply, origin);
    },
  };
}
