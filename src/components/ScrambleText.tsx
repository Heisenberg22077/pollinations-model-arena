import { useEffect, useRef } from "react";

const GLYPHS = "<>/[]{}*+-_01";

/** The parent keeps a stable accessible name while this visual label decodes. */
export function ScrambleText({
  children,
  autoPlay = false,
  duration = 420,
  repeatEvery,
}: {
  children: string;
  autoPlay?: boolean;
  duration?: number;
  repeatEvery?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const label = ref.current;
    const control = label?.closest("a, button, .slogan");
    if (!label || !control) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let active = true;
    const reset = () => {
      cancelAnimationFrame(frame);
      label.textContent = children;
      delete label.dataset.scrambling;
    };
    const play = () => {
      reset();
      if (
        preference.matches ||
        document.documentElement.dataset.motion === "off" ||
        (!autoPlay && !window.matchMedia("(hover: hover)").matches)
      )
        return;
      const start = performance.now();
      label.dataset.scrambling = "true";
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        const revealed = Math.floor(progress * children.length);
        label.textContent = [...children]
          .map((character, index) =>
            character === " " || index < revealed
              ? character
              : GLYPHS[(index + Math.floor(progress * 18)) % GLYPHS.length],
          )
          .join("");
        if (progress < 1) frame = requestAnimationFrame(tick);
        else reset();
      };
      frame = requestAnimationFrame(tick);
    };
    control.addEventListener("pointerenter", play);
    control.addEventListener("pointerleave", reset);
    preference.addEventListener("change", reset);
    window.addEventListener("resize", reset);
    window.addEventListener("model-table:motion-change", reset);
    if (autoPlay)
      void document.fonts.ready.then(() => {
        if (active) play();
      });
    const interval = repeatEvery
      ? window.setInterval(() => {
          if (!document.hidden) play();
        }, repeatEvery)
      : undefined;
    return () => {
      active = false;
      if (interval !== undefined) window.clearInterval(interval);
      reset();
      control.removeEventListener("pointerenter", play);
      control.removeEventListener("pointerleave", reset);
      preference.removeEventListener("change", reset);
      window.removeEventListener("resize", reset);
      window.removeEventListener("model-table:motion-change", reset);
    };
  }, [children, autoPlay, duration, repeatEvery]);

  return (
    <span ref={ref} className="scramble-label" aria-hidden="true">
      {children}
    </span>
  );
}
