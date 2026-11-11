import { withMotion } from "./arena-motion";

type Frame = Partial<Pick<Keyframe, "transform" | "opacity" | "offset" | "easing">>;
/** Existing action feedback now uses the shared GSAP context and clock. */
export function animateFeedback(
  element: Element | null,
  frames: Frame[],
  duration = 380,
  profile = "snappy",
) {
  if (!element || frames.length < 2) return;
  withMotion(({ gsap }) => {
    gsap.killTweensOf(element);
    const properties = (frame: Frame) => ({
      ...(frame.transform ? { transform: frame.transform } : {}),
      ...(frame.opacity != null ? { opacity: frame.opacity } : {}),
    });
    gsap.set(element, properties(frames[0]));
    gsap.to(element, {
      keyframes: frames.slice(1).map(properties),
      duration: duration / 1000,
      ease: profile === "bouncy" ? "arenaSnap" : "arenaExpo",
      clearProps: "transform,opacity",
    });
  });
}
