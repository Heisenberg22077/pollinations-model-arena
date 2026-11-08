export const UI_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const activeAnimations = new Set<Animation>();
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
  frames: Keyframe[],
  duration = 180,
): Animation | undefined {
  if (
    !element?.animate ||
    motionPreference().matches ||
    document.documentElement.dataset.motion === "off"
  ) {
    return;
  }
  const animation = element.animate(frames, { duration, easing: UI_EASE });
  activeAnimations.add(animation);
  void animation.finished.then(
    () => activeAnimations.delete(animation),
    () => activeAnimations.delete(animation),
  );
  return animation;
}
