import { useMotionSettings } from "../components/MotionProvider";
import { SPRINGS } from "../lib/motion";

/** One ordered arrival; settled reading panes stay still on subsequent scrolls. */
export function useEntrance(index = 0, deal = false) {
  const { reduce } = useMotionSettings();
  return {
    initial: reduce ? false : { opacity: 0, y: deal ? 18 : 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.08 },
    transition: reduce
      ? { duration: 0 }
      : {
          ...(deal ? SPRINGS.bouncy : SPRINGS.fluid),
          delay: index * 0.04,
          opacity: { duration: 0.2 },
        },
  } as const;
}
