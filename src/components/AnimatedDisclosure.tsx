import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { refreshMotion, withMotion } from "../lib/arena-motion";
import { useMotionSettings } from "./MotionProvider";
export function CollapsibleRegion({
  open,
  children,
  id,
  className = "",
  overlay = false,
  onExitComplete,
}: {
  open: boolean;
  children: ReactNode;
  id?: string;
  className?: string;
  overlay?: boolean;
  onExitComplete?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [retained, setRetained] = useState(open);
  const { reduce } = useMotionSettings();
  const callback = useRef(onExitComplete);
  callback.current = onExitComplete;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let tween: gsap.core.Tween | undefined;
    let entrance: gsap.core.Tween | undefined;
    const finish = () => {
      setRetained(open);
      if (!open) callback.current?.();
      refreshMotion();
    };
    if (open) setRetained(true);
    let animated = false;
    if (!reduce)
      withMotion(({ gsap }) => {
        animated = true;
        tween = gsap.to(node, {
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
          duration: overlay ? 0.25 : 0.42,
          ease: "arenaExpo",
          overwrite: true,
          onComplete: finish,
        });
        if (open)
          entrance = gsap.fromTo(
            node.querySelectorAll(".guide-content > *, .model-toggle, .metrics-group"),
            { y: 8, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.35, delay: 0.12, stagger: 0.025, ease: "arenaExpo" },
          );
      });
    if (!animated) {
      node.style.gridTemplateRows = open ? "1fr" : "0fr";
      node.style.opacity = open ? "1" : "0";
      finish();
    }
    return () => {
      tween?.kill();
      entrance?.revert();
    };
  }, [open, overlay, reduce]);
  return (
    <div
      ref={ref}
      id={id}
      className={`${className} accordion-grid${overlay ? " accordion-overlay" : ""}`}
      hidden={!open && !retained}
      inert={!open}
      aria-hidden={!open}
    >
      <div className="accordion-inner">{children}</div>
    </div>
  );
}
export function AnimatedDetails({
  id,
  className,
  bodyClassName,
  open,
  onOpenChange,
  summary,
  children,
  overlay = false,
}: {
  id?: string;
  className: string;
  bodyClassName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ReactNode;
  children: ReactNode;
  overlay?: boolean;
}) {
  const [retained, setRetained] = useState(open);
  useLayoutEffect(() => {
    if (open) setRetained(true);
  }, [open]);
  return (
    <details id={id} className={className} open={open || retained}>
      {/* biome-ignore lint/a11y/useSemanticElements: Native summary retains details semantics during animated closure. */}
      <summary
        role="button"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          onOpenChange(!open);
        }}
      >
        {summary}
      </summary>
      <CollapsibleRegion
        open={open}
        overlay={overlay}
        className={bodyClassName}
        onExitComplete={() => setRetained(false)}
      >
        {children}
      </CollapsibleRegion>
    </details>
  );
}
