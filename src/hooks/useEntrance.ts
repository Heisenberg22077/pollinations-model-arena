import { useMotionSettings } from "../components/MotionProvider";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** One ordered arrival; settled reading panes stay still on subsequent scrolls. */
export function useEntrance(index = 0) {
  const { reduce } = useMotionSettings();
  return {
    initial: reduce ? false : { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.08 },
    transition: reduce
      ? { duration: 0 }
      : { duration: 0.6, ease: EASE, delay: Math.min(index, 5) * 0.055 },
  } as const;
}
