/** Physical inputs verified against Motion's spring API; CSS curves: docs/spring-motion.md. */
export const SPRINGS = {
  snappy: { type: "spring", stiffness: 480, damping: 28, mass: 1 },
  fluid: { type: "spring", stiffness: 380, damping: 34, mass: 1 },
  bouncy: { type: "spring", stiffness: 400, damping: 20, mass: 1 },
  preset: { type: "spring", stiffness: 480, damping: 32, mass: 0.8 },
} as const;

type FeedbackProfile = "snappy" | "fluid" | "bouncy";
type CompositorKeyframe = Partial<Pick<Keyframe, "transform" | "opacity" | "offset" | "easing">>;

const activeAnimations = new Set<Animation>();
const elementAnimations = new WeakMap<Element, Animation>();
let preference: MediaQueryList | undefined;

function motionPreference(): MediaQueryList {
  if (!preference) {
    preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    preference.addEventListener("change", () => {
      if (preference?.matches) {
        for (const animation of activeAnimations) animation.cancel();
      }
    });
    window.addEventListener("model-table:motion-change", () => {
      if (document.documentElement.dataset.motion === "off") {
        for (const animation of activeAnimations) animation.cancel();
      }
    });
  }
  return preference;
}

export function animateFeedback(
  element: Element | null,
  frames: CompositorKeyframe[],
  duration?: number,
  profile: FeedbackProfile = "snappy",
): Animation | undefined {
  if (
    !element?.animate ||
    motionPreference().matches ||
    document.documentElement.dataset.motion === "off"
  ) {
    return;
  }
  elementAnimations.get(element)?.cancel();
  const tokens = getComputedStyle(document.documentElement);
  const curve = tokens.getPropertyValue(`--spring-${profile}`).trim();
  const animation = element.animate(frames, {
    duration:
      duration ?? Number.parseFloat(tokens.getPropertyValue(`--spring-${profile}-duration`)),
    easing: CSS.supports("animation-timing-function", curve) ? curve : "ease-out",
  });
  activeAnimations.add(animation);
  elementAnimations.set(element, animation);
  const cleanup = () => {
    activeAnimations.delete(animation);
    if (elementAnimations.get(element) === animation) elementAnimations.delete(element);
  };
  void animation.finished.then(cleanup, cleanup);
  return animation;
}
