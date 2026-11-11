import { useEffect, useRef } from "react";
import { withMotion } from "../lib/arena-motion";
import { useMotionSettings } from "./MotionProvider";

/** Reveal the decoded, authenticated blob itself; never substitute a placeholder image. */
export function PixelImage({ src, alt }: { src: string; alt: string }) {
  const image = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const animation = useRef<gsap.core.Tween | undefined>(undefined);
  const { reduce } = useMotionSettings();
  useEffect(() => {
    if (reduce) {
      animation.current?.kill();
      if (canvas.current) canvas.current.hidden = true;
    }
    return () => {
      animation.current?.kill();
    };
  }, [reduce]);
  const reveal = () => {
    const source = image.current;
    const stage = canvas.current;
    if (!source || !stage || reduce || !source.naturalWidth) return;
    withMotion(({ gsap }) => {
      const output = stage.getContext("2d");
      const buffer = document.createElement("canvas");
      const pixels = buffer.getContext("2d");
      if (!output || !pixels) return;
      stage.width = Math.min(1024, source.naturalWidth);
      stage.height = Math.round((stage.width * source.naturalHeight) / source.naturalWidth);
      stage.hidden = false;
      output.imageSmoothingEnabled = false;
      const progress = { step: 0 };
      const draw = () => {
        const divisions = 8 * 2 ** Math.floor(progress.step);
        buffer.width = Math.min(stage.width, divisions);
        buffer.height = Math.max(1, Math.round((buffer.width * stage.height) / stage.width));
        pixels.drawImage(source, 0, 0, buffer.width, buffer.height);
        output.clearRect(0, 0, stage.width, stage.height);
        output.drawImage(buffer, 0, 0, stage.width, stage.height);
      };
      draw();
      animation.current = gsap.to(progress, {
        step: 7,
        duration: 0.55,
        ease: "steps(7)",
        onUpdate: draw,
        onComplete: () => {
          stage.hidden = true;
        },
      });
    });
  };
  return (
    <>
      <img ref={image} src={src} alt={alt} onLoad={reveal} />
      <canvas ref={canvas} className="image-mosaic" hidden tabIndex={-1} aria-hidden="true" />
    </>
  );
}
