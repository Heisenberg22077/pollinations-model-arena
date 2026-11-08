import { AnimatePresence, useIsPresent } from "motion/react";
import * as m from "motion/react-m";
import { type ReactNode, useEffect, useState } from "react";
import { SPRINGS } from "../lib/motion";
import { useMotionSettings } from "./MotionProvider";

function DisclosurePanel({
  children,
  id,
  className,
  overlay = false,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
  overlay?: boolean;
}) {
  const present = useIsPresent();
  const { reduce } = useMotionSettings();
  return (
    <m.div
      id={id}
      className={className}
      inert={!present}
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={
        reduce
          ? { duration: 0 }
          : {
              ...SPRINGS.fluid,
              // Let following panes move clear before revealing newly inserted reading content.
              opacity: { duration: 0.16, delay: present && !overlay ? 0.24 : 0 },
            }
      }
      style={{ overflow: overlay ? "visible" : "hidden", transformOrigin: "top right" }}
    >
      {children}
    </m.div>
  );
}

export function CollapsibleRegion({
  open,
  children,
  id,
  className,
  overlay,
  onExitComplete,
}: {
  open: boolean;
  children: ReactNode;
  id?: string;
  className?: string;
  overlay?: boolean;
  onExitComplete?: () => void;
}) {
  return (
    <AnimatePresence initial={false} onExitComplete={onExitComplete}>
      {open ? (
        <DisclosurePanel key="content" id={id} className={className} overlay={overlay}>
          {children}
        </DisclosurePanel>
      ) : null}
    </AnimatePresence>
  );
}

/** Keep native details semantics while allowing its closing motion to finish. */
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
  const [retainedOpen, setRetainedOpen] = useState(open);
  useEffect(() => {
    if (open) setRetainedOpen(true);
  }, [open]);

  return (
    <details id={id} className={className} open={open || retainedOpen}>
      {/* biome-ignore lint/a11y/useSemanticElements: Summary is the native details control; the button role exposes its closing state. */}
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
        onExitComplete={() => setRetainedOpen(false)}
      >
        {children}
      </CollapsibleRegion>
    </details>
  );
}
