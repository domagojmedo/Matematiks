/**
 * A labelled rectangle for perimeter/area problems. Pure/presentational: draws
 * a box with width (bottom) and height (left) labels in cm. `data-width` /
 * `data-height` are exposed for tests.
 */
export function ShapeDiagram({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  // Visual size is decoupled from the math: clamp the drawn box to a pleasant
  // range while the labels carry the real values.
  const vw = 120 + Math.min(width, 12) * 8;
  const vh = 60 + Math.min(height, 12) * 8;
  return (
    <div
      data-testid="shape-diagram"
      data-width={width}
      data-height={height}
      className="flex items-center gap-2"
    >
      <span className="text-sm font-bold text-stone-500 tabular-nums dark:text-stone-400">
        {height} cm
      </span>
      <div className="flex flex-col items-center gap-1">
        <div
          style={{ width: `${vw}px`, height: `${vh}px` }}
          className="rounded-md border-4 border-stone-400 bg-stone-50 dark:border-stone-500 dark:bg-stone-800"
        />
        <span className="text-sm font-bold text-stone-500 tabular-nums dark:text-stone-400">
          {width} cm
        </span>
      </div>
    </div>
  );
}
