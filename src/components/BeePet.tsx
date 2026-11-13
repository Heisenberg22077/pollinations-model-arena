import { beeAction } from "../lib/arena-motion";

/** A stationary alternative to hunting the decorative canvas bee. No frame-driven React state. */
export function BeePet() {
  return (
    <details className="bee-home" data-enabled="true">
      <summary aria-label="Play with the garden bee" title="Boop, feed, or hear a tiny joke">
        Bzz
      </summary>
      <div className="bee-controls">
        <button type="button" onClick={() => beeAction("boop")} aria-label="Boop the bee">
          Boop
        </button>
        <button type="button" onClick={() => beeAction("feed")} aria-label="Feed the bee">
          Feed
        </button>
        <button
          type="button"
          data-pet-story
          onClick={() => beeAction("story")}
          aria-label="Tell a tiny bee story"
        >
          Joke
        </button>
        <button
          type="button"
          data-pet-close
          hidden
          onClick={() => beeAction("close")}
          aria-label="Close bee story"
        >
          Close
        </button>
      </div>
      <span className="bee-feedback sr-only" role="status" aria-live="polite" aria-atomic="true" />
    </details>
  );
}
