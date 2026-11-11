import type { CSSProperties } from "react";
import type { ColorMode } from "../hooks/useColorMode";

/** Original Pollinations pixels, with local composition and decorative movement. */
export function GardenScene({
  colorMode,
  closing = false,
}: {
  colorMode: ColorMode;
  closing?: boolean;
}) {
  const base = `${import.meta.env.BASE_URL}art/pollinations-${closing ? "closing" : "garden"}-${colorMode}`;

  return (
    <div
      className={`garden-scene${closing ? " garden-scene-closing" : " garden-scene-hero"}`}
      aria-hidden="true"
    >
      <div className="garden-pointer">
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
      </div>
      <div className="garden-pollen">
        {[0, 1, 2, 3, 4, 5].map((pixel) => (
          <span key={pixel} style={{ "--pollen": pixel } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}
