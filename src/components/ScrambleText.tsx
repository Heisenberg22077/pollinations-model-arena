/** Visual decoding uses the shared GSAP clock; accessible names stay stable. */
export function ScrambleText({
  children,
}: {
  children: string;
  autoPlay?: boolean;
  duration?: number;
  repeatEvery?: number;
}) {
  return (
    <span className="scramble-label" data-text={children} aria-hidden="true">
      {children}
    </span>
  );
}
