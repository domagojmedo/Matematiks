import type { Theme } from "../lib/themes";

/**
 * A horizontal bar split into `parts` equal segments, the first `shaded`
 * filled with the theme color. Pure/presentational — drives fraction-
 * recognition problems. `data-shaded` / `data-parts` are exposed for tests.
 */
export function FractionVisual({
  parts,
  shaded,
  theme,
}: {
  parts: number;
  shaded: number;
  theme: Theme;
}) {
  const segments = Array.from({ length: parts }, (_, i) => i);
  return (
    <div
      data-testid="fraction-visual"
      data-parts={parts}
      data-shaded={shaded}
      className="flex w-full max-w-sm gap-1"
      role="img"
      aria-label={`${shaded} od ${parts} dijelova obojano`}
    >
      {segments.map((i) => (
        <div
          key={i}
          className={`h-16 flex-1 rounded-md ring-2 ring-inset ${
            i < shaded
              ? `${theme.primary} ring-transparent`
              : "bg-white ring-stone-300 dark:bg-stone-900 dark:ring-stone-700"
          }`}
        />
      ))}
    </div>
  );
}
