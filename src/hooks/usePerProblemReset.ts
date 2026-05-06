import { useState } from "react";

/**
 * Run `reset` whenever `problem` identity changes, including the very first
 * change after mount. Does NOT fire on initial mount — the first render's
 * `useState` initializer captures the initial `problem` so the guard returns
 * false on render 1.
 *
 * Why this exists as a named hook rather than an inline `useState` + guard:
 * the previous implementation tried to do this work in a `useEffect` whose
 * dep array biome's `--unsafe` autofix trimmed away (because the body didn't
 * read `problem` directly). The reset stopped firing after mount, breaking
 * problem 2 onward of every multi-phase round. Centralising the pattern in a
 * named hook lets us test it once and audit it once.
 *
 * Implementation note: setting state during render on a different state slot
 * (`setLast`) is the React-blessed "derive state from props" pattern (see
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
 * React re-runs render synchronously with the updated value before committing.
 * Mutating refs inside `reset` is safe — refs are not reactive state and do
 * not schedule a re-render.
 */
export function usePerProblemReset<P>(problem: P, reset: () => void): void {
  const [last, setLast] = useState(problem);
  if (problem !== last) {
    setLast(problem);
    reset();
  }
}
