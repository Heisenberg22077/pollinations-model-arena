import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { beeComment, pixelTheme } from "../lib/arena-motion";

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
        // Commit now, under the curtain, rather than in a later task that would
        // land inside the reveal frames on a slow phone.
        flushSync(() => setColorMode(next));
        beeComment(next);
      };
      pixelTheme(next, apply, origin, decodeThemeArt(next));
    },
  };
}

/** Decodes the on-screen garden art for the next theme, picking the same srcset candidate. */
function decodeThemeArt(next: ColorMode) {
  const swapTheme = (url: string) => url.replace(/-(day|night)(?=[-.])/g, `-${next}`);
  const visible = [...document.querySelectorAll<HTMLImageElement>(".garden-scene img")].filter(
    (img) => {
      const rect = img.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight && rect.width > 0;
    },
  );
  return Promise.all(
    visible.map((img) => {
      const probe = new Image();
      probe.sizes = img.sizes;
      probe.srcset = swapTheme(img.srcset);
      probe.src = swapTheme(img.getAttribute("src") ?? "");
      return probe.decode().catch(() => undefined);
    }),
  );
}
