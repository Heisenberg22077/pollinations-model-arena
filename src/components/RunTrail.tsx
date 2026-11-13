import { type CSSProperties, useEffect, useRef } from "react";
import type { ModelDef } from "../config";
import { withMotion } from "../lib/arena-motion";
import type { Runs } from "../types";
import { useMotionSettings } from "./MotionProvider";

export function RunTrail({
  models,
  runs,
  running,
}: {
  models: ModelDef[];
  runs: Runs;
  running: boolean;
}) {
  const ref = useRef<HTMLOListElement>(null);
  const previous = useRef(new Map<string, string>());
  const completed = useRef(false);
  const { reduce } = useMotionSettings();
  useEffect(() => {
    const trail = ref.current;
    if (!trail) return;
    const landed = [...trail.querySelectorAll<HTMLElement>("li")].filter((node) => {
      const id = node.dataset.modelId ?? "";
      const status = runs[id]?.status ?? "idle";
      const before = previous.current.get(id);
      previous.current.set(id, status);
      return before === "pending" && status === "done";
    });
    const allSettled =
      !running && models.every((model) => ["done", "error"].includes(runs[model.id]?.status));
    const celebrate = allSettled && !completed.current;
    completed.current = allSettled;
    if (reduce || (!landed.length && !celebrate)) return;
    const rect = trail.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    let animation: gsap.Context | undefined;
    withMotion(({ gsap }) => {
      animation = gsap.context(() => {
        if (celebrate) {
          const pixels = trail.querySelectorAll(".trail-pixel");
          gsap
            .timeline()
            .fromTo(
              pixels,
              { y: 0 },
              {
                y: -6,
                duration: 0.2,
                stagger: { amount: 0.28, from: "center" },
                ease: "power2.out",
              },
            )
            .to(
              pixels,
              {
                y: 0,
                duration: 0.5,
                stagger: { amount: 0.28, from: "center" },
                ease: "arenaSnap",
                clearProps: "transform",
              },
              0.2,
            );
          return;
        }
        gsap.fromTo(
          landed
            .map((node) => node.querySelector<HTMLElement>(".trail-pixel"))
            .filter((node) => node !== null),
          { y: -5, rotation: -45, scale: 0.6 },
          {
            y: 0,
            rotation: 0,
            scale: 1,
            duration: 0.55,
            ease: "arenaSnap",
            stagger: 0.045,
            clearProps: "transform",
          },
        );
      });
    });
    return () => {
      animation?.revert();
    };
  }, [runs, reduce, models, running]);
  return (
    <ol ref={ref} className="run-trail" aria-label="Model progress">
      {models.map((model) => {
        const status = runs[model.id]?.status ?? "pending";
        const label =
          status === "done"
            ? "answered"
            : status === "error"
              ? "unavailable"
              : runs[model.id]?.phase === "queued"
                ? "queued"
                : "working";
        return (
          <li
            key={model.id}
            data-model-id={model.id}
            data-status={status}
            title={`${model.name}: ${label}`}
            style={{ "--provider-color": model.color } as CSSProperties}
          >
            <span className="trail-pixel" aria-hidden="true">
              {status === "done" ? "✓" : status === "error" ? "×" : ""}
            </span>
            <span className="sr-only">
              {model.name}: {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
