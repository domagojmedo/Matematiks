import type { Theme } from "../lib/themes";

/**
 * A small read-only bar chart for data lessons. Bars are scaled to the max
 * value; each is labelled below. Pure/presentational. `data-values` exposes the
 * series for tests.
 */
export function MiniBarChart({
  labels,
  values,
  theme,
}: {
  labels: string[];
  values: number[];
  theme: Theme;
}) {
  const max = Math.max(1, ...values);
  return (
    <div
      data-testid="mini-bar-chart"
      data-values={values.join(",")}
      className="flex h-40 items-end gap-3"
    >
      {labels.map((label, i) => {
        const v = values[i] ?? 0;
        const pct = Math.round((v / max) * 100);
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-bold text-stone-500 tabular-nums dark:text-stone-400">
              {v}
            </span>
            <div
              style={{ height: `${pct}%` }}
              className={`w-full min-h-1 rounded-t-md ${theme.primary}`}
            />
            <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
