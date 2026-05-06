/**
 * Direct test of `usePerProblemReset`. The previous reviewer-flagged gap was
 * that an integration test of `useRoundMechanics` couldn't catch a regression
 * in the *caller-side* reset, because the test had its own (correct) consumer.
 * This test exercises the reset hook itself: any caller that uses this hook
 * for its per-problem state is regression-protected.
 */
import { act, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { usePerProblemReset } from "./usePerProblemReset";

describe("usePerProblemReset", () => {
  it("does NOT fire on initial mount", () => {
    let resetCount = 0;
    function Comp() {
      usePerProblemReset("a", () => {
        resetCount += 1;
      });
      return null;
    }
    render(<Comp />);
    expect(resetCount).toBe(0);
  });

  it("fires exactly once when `problem` identity changes", () => {
    let resetCount = 0;
    let setProblem: ((p: string) => void) | null = null;
    function Comp() {
      const [problem, set] = useState("a");
      setProblem = set;
      usePerProblemReset(problem, () => {
        resetCount += 1;
      });
      return null;
    }
    render(<Comp />);

    expect(resetCount).toBe(0);

    act(() => setProblem?.("b"));
    expect(resetCount).toBe(1);

    act(() => setProblem?.("c"));
    expect(resetCount).toBe(2);
  });

  it("does not re-fire when `problem` identity is unchanged across renders", () => {
    let resetCount = 0;
    let forceRerender: (() => void) | null = null;
    const stableProblem = { id: 1 };
    function Comp() {
      const [, setTick] = useState(0);
      forceRerender = () => setTick((n) => n + 1);
      usePerProblemReset(stableProblem, () => {
        resetCount += 1;
      });
      return null;
    }
    render(<Comp />);

    act(() => forceRerender?.());
    act(() => forceRerender?.());
    act(() => forceRerender?.());

    expect(resetCount).toBe(0);
  });

  it("invokes the latest reset closure (not a stale one)", () => {
    // Guards against the case where someone wraps the reset in useCallback
    // with a stale dep — the hook must always call the closure passed to it
    // on the render where the change is observed.
    const resets: string[] = [];
    let setProblem: ((p: string) => void) | null = null;
    function Comp() {
      const [problem, set] = useState("a");
      setProblem = set;
      usePerProblemReset(problem, () => {
        resets.push(problem);
      });
      return null;
    }
    render(<Comp />);

    act(() => setProblem?.("b"));
    // The reset closure runs during the render where the guard fires, after
    // `problem` has already updated to "b". So the closure sees the *new*
    // problem identity. Callers that need the previous value should capture
    // it before calling `usePerProblemReset` (e.g. in another ref).
    expect(resets).toEqual(["b"]);
    act(() => setProblem?.("c"));
    expect(resets).toEqual(["b", "c"]);
  });
});
