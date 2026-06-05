import type { ShapeGlyphKind } from "../lib/wordTypes";

/**
 * Draws one 2D shape as an SVG, for shape-recognition problems. Pure/
 * presentational. `data-glyph` is exposed for tests.
 */
export function ShapeGlyph({
  kind,
  size = 96,
}: {
  kind: ShapeGlyphKind;
  size?: number;
}) {
  const stroke = "currentColor";
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 4,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg
      data-testid="shape-glyph"
      data-glyph={kind}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={kind}
      className="text-stone-700 dark:text-stone-200"
    >
      {kind === "circle" && <circle cx="50" cy="50" r="42" {...common} />}
      {kind === "square" && (
        <rect x="12" y="12" width="76" height="76" rx="4" {...common} />
      )}
      {kind === "rectangle" && (
        <rect x="8" y="28" width="84" height="44" rx="4" {...common} />
      )}
      {kind === "triangle" && (
        <polygon points="50,12 90,86 10,86" {...common} />
      )}
    </svg>
  );
}
