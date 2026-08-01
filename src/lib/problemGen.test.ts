import { describe, expect, it } from "vitest";
import { generateProblem } from "./problemGen";
import type { OperationSetup } from "./types";

function crossesTenAdd(a: number, b: number): boolean {
  return (a % 10) + (b % 10) >= 10;
}

function crossesTenSub(a: number, b: number): boolean {
  return a % 10 < b % 10;
}

describe("generateProblem with crossesTen filter", () => {
  it("never produces a crossing problem when crossesTen=never", () => {
    const setup: OperationSetup = {
      kind: "range",
      min: 1,
      max: 20,
      crossesTen: "never",
      rounds: 20,
    };
    for (let i = 0; i < 100; i++) {
      const p = generateProblem("add", setup);
      expect(crossesTenAdd(p.a, p.b)).toBe(false);
    }
  });

  it("always produces a crossing problem when crossesTen=always", () => {
    const setup: OperationSetup = {
      kind: "range",
      min: 1,
      max: 20,
      crossesTen: "always",
      rounds: 20,
    };
    for (let i = 0; i < 100; i++) {
      const p = generateProblem("add", setup);
      expect(crossesTenAdd(p.a, p.b)).toBe(true);
    }
  });

  it("spreads answers roughly evenly across crossing additions to 20", () => {
    // Regression: result-first sampling + crossing rejection used to pile ~40%
    // of answers onto 10 and 20 (and never produced 19's neighbours), making
    // "do 20 s prijelazom" feel like the same answers repeating.
    const setup: OperationSetup = {
      kind: "range",
      min: 1,
      max: 20,
      crossesTen: "always",
      rounds: 20,
    };
    const counts = new Map<number, number>();
    let prev = null as ReturnType<typeof generateProblem> | null;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const p = generateProblem("add", setup, prev);
      counts.set(p.answer, (counts.get(p.answer) ?? 0) + 1);
      prev = p;
    }
    // 10 feasible crossing sums (10–18 and 20); none should dominate.
    expect(counts.size).toBe(10);
    for (const share of [...counts.values()].map((c) => c / N)) {
      expect(share).toBeLessThan(0.2);
    }
  });

  it("never borrows in subtraction when crossesTen=never", () => {
    const setup: OperationSetup = {
      kind: "range",
      min: 1,
      max: 20,
      crossesTen: "never",
      rounds: 20,
    };
    for (let i = 0; i < 100; i++) {
      const p = generateProblem("sub", setup);
      // Generator orders so a >= b for subtraction.
      expect(crossesTenSub(p.a, p.b)).toBe(false);
    }
  });
});

describe("generateProblem with values2 (asymmetric multiplicands)", () => {
  it("respects values2 for the partner factor in multiplication", () => {
    const setup: OperationSetup = {
      kind: "multiplicands",
      values: [7],
      values2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      rounds: 20,
    };
    for (let i = 0; i < 50; i++) {
      const p = generateProblem("mul", setup);
      // Single-digit factors may commute, so 7 can sit on either side.
      const partner = p.a === 7 ? p.b : p.a;
      expect(p.a === 7 || p.b === 7).toBe(true);
      expect(partner).toBeGreaterThanOrEqual(1);
      expect(partner).toBeLessThanOrEqual(10);
      expect(p.answer).toBe(p.a * p.b);
    }
  });

  it("shows a single-digit table drill in both factor orders", () => {
    const setup: OperationSetup = {
      kind: "multiplicands",
      values: [6],
      values2: [2, 3, 4, 5, 6, 7, 8, 9],
      rounds: 20,
    };
    const first = new Set<number>();
    const second = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const p = generateProblem("mul", setup);
      expect(p.answer).toBe(p.a * p.b);
      first.add(p.a);
      second.add(p.b);
    }
    // 6 × n and n × 6 both occur; every partner shows up on each side.
    expect([...first].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...second].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("keeps multi-digit multiplication in multiplicand × multiplier order", () => {
    const setup: OperationSetup = {
      kind: "multiplicands",
      values: [45, 72],
      values2: [2, 3, 4, 5, 6, 7, 8, 9],
      rounds: 20,
    };
    for (let i = 0; i < 100; i++) {
      const p = generateProblem("mul", setup);
      // Column mode reads `a` as the multiplicand — 45 × 7 must not flip to 7 × 45.
      expect([45, 72]).toContain(p.a);
      expect(p.b).toBeLessThan(10);
    }
  });

  it("falls back to values when values2 is undefined", () => {
    const setup: OperationSetup = {
      kind: "multiplicands",
      values: [3, 4, 5],
      rounds: 20,
    };
    for (let i = 0; i < 50; i++) {
      const p = generateProblem("mul", setup);
      expect([3, 4, 5]).toContain(p.a);
      expect([3, 4, 5]).toContain(p.b);
    }
  });
});

describe("generateProblem avoids repeating previous", () => {
  it("returns a different problem from the previous one when possible", () => {
    const setup: OperationSetup = {
      kind: "range",
      min: 1,
      max: 100,
      rounds: 20,
    };
    let prev = generateProblem("add", setup);
    for (let i = 0; i < 50; i++) {
      const p = generateProblem("add", setup, prev);
      const same = p.a === prev.a && p.b === prev.b && p.op === prev.op;
      expect(same).toBe(false);
      prev = p;
    }
  });

  it("treats a commuted multiplication as a repeat", () => {
    const setup: OperationSetup = {
      kind: "multiplicands",
      values: [6],
      values2: [2, 3, 4, 5, 6, 7, 8, 9],
      rounds: 20,
    };
    let prev = generateProblem("mul", setup);
    for (let i = 0; i < 100; i++) {
      const p = generateProblem("mul", setup, prev);
      expect(p.answer).not.toBe(prev.answer);
      prev = p;
    }
  });
});

describe("generateProblem edge cases", () => {
  it("respects asymmetric range (min2/max2) for add", () => {
    const setup: OperationSetup = {
      kind: "range",
      min: 1,
      max: 10,
      min2: 50,
      max2: 100,
      rounds: 20,
    };
    for (let i = 0; i < 50; i++) {
      const p = generateProblem("add", setup);
      expect(p.a).toBeGreaterThanOrEqual(1);
      expect(p.a).toBeLessThanOrEqual(10);
      expect(p.b).toBeGreaterThanOrEqual(50);
      expect(p.b).toBeLessThanOrEqual(100);
      expect(p.answer).toBe(p.a + p.b);
    }
  });

  it("respects asymmetric range for sub (a >= b after ordering)", () => {
    const setup: OperationSetup = {
      kind: "range",
      min: 50,
      max: 100,
      min2: 1,
      max2: 20,
      rounds: 20,
    };
    for (let i = 0; i < 50; i++) {
      const p = generateProblem("sub", setup);
      expect(p.a).toBeGreaterThanOrEqual(p.b);
      expect(p.answer).toBe(p.a - p.b);
    }
  });

  it("handles single-element values (e.g. ×2 table)", () => {
    const setup: OperationSetup = {
      kind: "multiplicands",
      values: [2],
      values2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      rounds: 20,
    };
    for (let i = 0; i < 50; i++) {
      const p = generateProblem("mul", setup);
      expect(p.a === 2 || p.b === 2).toBe(true);
      expect(p.answer).toBe(p.a * p.b);
    }
  });

  it("division produces exact quotients (no remainder)", () => {
    const setup: OperationSetup = {
      kind: "multiplicands",
      values: [2, 3, 4, 5, 6, 7, 8, 9],
      values2: [2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 99],
      rounds: 20,
    };
    for (let i = 0; i < 100; i++) {
      const p = generateProblem("div", setup);
      expect(p.a % p.b).toBe(0);
      expect(p.answer).toBe(p.a / p.b);
    }
  });

  it("muldiv produces both * and / problems", () => {
    const setup: OperationSetup = {
      kind: "multiplicands",
      values: [2, 3, 4, 5],
      rounds: 20,
    };
    const ops = new Set<string>();
    for (let i = 0; i < 200; i++) {
      ops.add(generateProblem("muldiv", setup).op);
    }
    expect(ops.has("*")).toBe(true);
    expect(ops.has("/")).toBe(true);
  });

  it("addsub produces both + and - problems", () => {
    const setup: OperationSetup = {
      kind: "range",
      min: 1,
      max: 20,
      rounds: 20,
    };
    const ops = new Set<string>();
    for (let i = 0; i < 200; i++) {
      ops.add(generateProblem("addsub", setup).op);
    }
    expect(ops.has("+")).toBe(true);
    expect(ops.has("-")).toBe(true);
  });
});
