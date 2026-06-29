import type { Theme } from "../lib/themes";

/**
 * A small read-only bar chart for data lessons. The y-axis tops out one step
 * ABOVE the tallest bar (so no bar is pinned to the ceiling and there's always
 * a labelled gridline above it), and lets the kid read each bar's value off the
 * scale. Values are intentionally NOT printed on the bars — reading the height
 * is the whole exercise. Pure/presentational; `data-values` exposes the series
 * for tests.
 *
 * Assumes small integer series (the data lesson uses 1–10); the step widens for
 * larger values so the axis stays legible.
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
  const rawTop = Math.max(1, ...values);
  // Step is 1 for the small series this lesson uses (1–10) and widens for
  // larger values so the axis stays ≤ ~8 ticks instead of one line per unit.
  const step = rawTop <= 6 ? 1 : Math.ceil(rawTop / 6);
  // Top is the next step STRICTLY above the tallest bar — guarantees headroom
  // so no bar reaches the ceiling and there's always a gridline above it.
  const top = (Math.floor(rawTop / step) + 1) * step;
  // Ticks from `top` down to 0 so flex order matches top-to-bottom reading.
  const ticks = Array.from(
    { length: top / step + 1 },
    (_, i) => top - i * step,
  );
  // Shared column track so the bars and their labels line up by construction
  // instead of relying on two flex rows being hand-kept in sync.
  const columns = {
    gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))`,
  };
  return (
    <div
      data-testid="mini-bar-chart"
      data-values={values.join(",")}
      className="flex gap-2"
    >
      {/* y-axis scale */}
      <div
        data-testid="chart-yaxis"
        className="flex h-48 flex-col justify-between text-right text-xs font-semibold text-stone-500 tabular-nums dark:text-stone-400"
      >
        {ticks.map((t) => (
          <span key={t} className="leading-none">
            {t}
          </span>
        ))}
      </div>
      <div className="flex-1">
        <div className="relative h-48">
          {/* Horizontal gridlines, one per tick. */}
          {ticks.map((t) => (
            <div
              key={t}
              style={{ bottom: `${Math.round((t / top) * 100)}%` }}
              className="absolute inset-x-0 border-stone-200 border-t dark:border-stone-700"
            />
          ))}
          {/* Bars: grid-rows-1 makes the single row fill the height (a default
              auto row would be content-sized), so each stretched cell gives the
              bar's percentage height a definite parent to resolve against. */}
          <div className="grid h-full grid-rows-1 gap-3" style={columns}>
            {labels.map((label, i) => {
              const v = values[i] ?? 0;
              const pct = Math.round((v / top) * 100);
              return (
                <div key={label} className="relative z-10 flex items-end">
                  <div
                    style={{ height: `${pct}%` }}
                    className={`w-full min-h-0.5 rounded-t-md ${theme.primary}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
        {/* Labels share the bars' column track, so they stay aligned. */}
        <div className="grid gap-3 pt-1" style={columns}>
          {labels.map((label) => (
            <span
              key={label}
              className="text-center text-xs font-semibold text-stone-600 dark:text-stone-300"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
