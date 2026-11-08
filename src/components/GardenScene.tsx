import { useSpring } from "motion/react";
import * as m from "motion/react-m";
import { type CSSProperties, useEffect, useRef } from "react";
import type { ColorMode } from "../hooks/useColorMode";
import { useEntrance } from "../hooks/useEntrance";
import { useMotionSettings } from "./MotionProvider";

/** Original Pollinations pixels, with local composition and decorative movement. */
export function GardenScene({
  colorMode,
  closing = false,
}: {
  colorMode: ColorMode;
  closing?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { reduce } = useMotionSettings();
  const entrance = useEntrance(1);
  const x = useSpring(0, { stiffness: 95, damping: 24 });
  const y = useSpring(0, { stiffness: 95, damping: 24 });
  const scale = useSpring(1, { stiffness: 110, damping: 26 });
  const base = `${import.meta.env.BASE_URL}art/pollinations-${closing ? "closing" : "garden"}-${colorMode}`;

  useEffect(() => {
    if (!reduce) return;
    x.jump(0);
    y.jump(0);
    scale.jump(1);
  }, [reduce, x, y, scale]);

  useEffect(() => {
    let intersecting = false;
    const update = () => {
      if (ref.current) ref.current.dataset.sceneVisible = String(intersecting && !document.hidden);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting;
        update();
      },
      { rootMargin: "40px" },
    );
    const scene = ref.current;
    if (scene) observer.observe(scene);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <m.div
      ref={ref}
      {...entrance}
      className={`garden-scene${closing ? " garden-scene-closing" : " garden-scene-hero"}`}
      aria-hidden="true"
      onPointerMove={(event) => {
        if (
          reduce ||
          event.pointerType !== "mouse" ||
          !window.matchMedia("(hover: hover) and (pointer: fine)").matches
        )
          return;
        const rect = event.currentTarget.getBoundingClientRect();
        x.set(((event.clientX - rect.left) / rect.width - 0.5) * 20);
        y.set(((event.clientY - rect.top) / rect.height - 0.5) * 14);
        scale.set(1.025);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
        scale.set(1);
      }}
    >
      <m.div
        className="garden-pointer"
        style={{ x: reduce ? 0 : x, y: reduce ? 0 : y, scale: reduce ? 1 : scale }}
      >
        <div className="garden-scroll">
          <div className="garden-drift">
            <img
              src={closing ? `${base}-1024.webp` : `${base}.webp`}
              srcSet={
                closing
                  ? `${base}-1024.webp 1024w, ${base}.webp 2048w`
                  : `${base}.webp 1024w, ${base}-2048.webp 2048w`
              }
              sizes={
                closing
                  ? "(min-width: 1680px) 65vw, (min-width: 900px) 75vw, 100vw"
                  : "(min-width: 1680px) 36vw, (min-width: 900px) 45vw, (min-width: 640px) 50vw, 100vw"
              }
              width={2048}
              height={854}
              alt=""
              loading={closing ? "lazy" : "eager"}
              fetchPriority={closing ? "low" : "high"}
              decoding="async"
              draggable={false}
              className="garden-image"
            />
          </div>
        </div>
      </m.div>
      <div className="garden-pollen">
        {[0, 1, 2, 3, 4, 5].map((pixel) => (
          <span key={pixel} style={{ "--pollen": pixel } as CSSProperties} />
        ))}
      </div>
    </m.div>
  );
}
