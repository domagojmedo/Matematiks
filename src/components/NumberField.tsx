import { useState } from "react";

/**
 * Numeric text field for setup screens.
 *
 * Why the local draft: binding a controlled input straight to a number makes
 * the box unusable while typing. Clearing it yields "", `Number("")` is 0, so
 * the field snaps back to "0" and a fresh multi-digit value can never be
 * entered. We hold the raw text while the kid edits, push only in-range
 * numbers up, and clamp once on blur — an empty field left empty reverts to
 * the last good value instead of committing 0.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  focus,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  focus: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const n = Number.parseInt(draft, 10);
    setDraft(null);
    if (!Number.isFinite(n)) return;
    onChange(Math.min(max, Math.max(min, n)));
  };

  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2 px-1 text-xs font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
        {label}
        {/* Spelling out the cap makes the blur-clamp read as the rule being
            applied rather than the box behaving oddly. aria-hidden keeps the
            input's accessible name to the label alone. */}
        <span aria-hidden="true" className="tabular-nums normal-case">
          {min}–{max}
        </span>
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft ?? String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const n = Number.parseInt(raw, 10);
          // Out-of-range text stays a draft until blur clamps it, so typing
          // toward a bigger number isn't fought on every keystroke.
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={commit}
        className={`mt-1 h-12 w-full rounded-2xl bg-white px-4 text-base font-black text-stone-900 ring-2 ring-stone-200 tabular-nums focus:outline-none focus-visible:ring-4 dark:bg-stone-900 dark:text-white dark:ring-stone-800 ${focus}`}
      />
    </label>
  );
}
