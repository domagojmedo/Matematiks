import { describe, expect, it } from "vitest";
import { buildPhases, pickLayout } from "./columnPhases";
import type { Problem } from "./problemGen";

const problem = (
  a: number,
  b: number,
  op: Problem["op"],
  answer: number,
): Problem => ({ a, b, op, answer });

describe("pickLayout", () => {
  it("uses simple layout for add/sub", () => {
    expect(pickLayout(problem(2, 3, "+", 5))).toBe("simple");
    expect(pickLayout(problem(20, 7, "-", 13))).toBe("simple");
  });

  it("uses horizontal mul layout for any column multiplication", () => {
    // Single-digit multiplier still uses the horizontal "a × b = …" header.
    expect(pickLayout(problem(72, 9, "*", 648))).toBe("mulPartials");
    expect(pickLayout(problem(64, 25, "*", 1600))).toBe("mulPartials");
    expect(pickLayout(problem(99, 99, "*", 9801))).toBe("mulPartials");
  });

  it("uses division layout for division", () => {
    expect(pickLayout(problem(304, 8, "/", 38))).toBe("division");
  });
});

describe("buildPhases for simple ops", () => {
  it("returns one rtl phase with the answer", () => {
    const phases = buildPhases(problem(7, 5, "+", 12));
    expect(phases).toEqual([
      { value: 12, direction: "rtl", kind: "answer" },
    ]);
  });
});

describe("buildPhases for single-digit mul", () => {
  it("returns one mulSum phase (no partial products needed)", () => {
    // 72 × 9 = 648. No partial product breakdown, just type the answer.
    const phases = buildPhases(problem(72, 9, "*", 648));
    expect(phases).toEqual([
      { value: 648, direction: "ltr", kind: "mulSum" },
    ]);
  });
});

describe("buildPhases for mul partial products", () => {
  it("orders highest place first (Croatian convention)", () => {
    // 64 × 25 = 1600. partials: 64×2=128 (shift 1), 64×5=320 (shift 0)
    const phases = buildPhases(problem(64, 25, "*", 1600));
    expect(phases).toHaveLength(3);
    expect(phases[0]).toMatchObject({
      value: 128,
      kind: "mulPartial",
      shift: 1,
      direction: "ltr",
    });
    expect(phases[1]).toMatchObject({
      value: 320,
      kind: "mulPartial",
      shift: 0,
      direction: "ltr",
    });
    expect(phases[2]).toMatchObject({
      value: 1600,
      kind: "mulSum",
      direction: "ltr",
    });
  });

  it("handles 3-digit multipliers", () => {
    // 5 × 234 = 1170. partials: 5×2=10 (shift 2), 5×3=15 (shift 1), 5×4=20 (shift 0)
    const phases = buildPhases(problem(5, 234, "*", 1170));
    expect(phases.filter((p) => p.kind === "mulPartial")).toHaveLength(3);
    expect(phases[0]?.shift).toBe(2);
    expect(phases[1]?.shift).toBe(1);
    expect(phases[2]?.shift).toBe(0);
  });
});

describe("buildPhases for long division", () => {
  it("emits quotient/product/remainder per step with chunk metadata", () => {
    // 304 ÷ 8 = 38.
    // Step 0: 30 ÷ 8 = 3 r 6, chunk = 30
    // Step 1: 64 ÷ 8 = 8 r 0, chunk = 64
    const phases = buildPhases(problem(304, 8, "/", 38));
    expect(phases).toHaveLength(6);
    expect(phases[0]).toMatchObject({
      kind: "divQuotientDigit",
      value: 3,
      step: 0,
      chunk: 30,
      direction: "ltr",
    });
    expect(phases[1]).toMatchObject({
      kind: "divProduct",
      value: 24,
      step: 0,
      chunk: 30,
    });
    expect(phases[2]).toMatchObject({
      kind: "divRemainder",
      value: 6,
      step: 0,
      chunk: 30,
    });
    expect(phases[3]).toMatchObject({
      kind: "divQuotientDigit",
      value: 8,
      step: 1,
      chunk: 64,
    });
    expect(phases[5]).toMatchObject({
      kind: "divRemainder",
      value: 0,
      step: 1,
      chunk: 64,
    });
  });

  it("skips leading dividend digits that are smaller than the divisor", () => {
    // 156 ÷ 6 = 26. First chunk = 15 (not 1).
    const phases = buildPhases(problem(156, 6, "/", 26));
    expect(phases[0]?.chunk).toBe(15);
  });

  it("handles single-step division (chunk fully covers dividend)", () => {
    // 32 ÷ 8 = 4. One step, chunk = 32.
    const phases = buildPhases(problem(32, 8, "/", 4));
    expect(phases).toHaveLength(3);
    expect(phases[0]).toMatchObject({ value: 4, chunk: 32 });
    expect(phases[2]).toMatchObject({ value: 0 });
  });

  it("phase values reconstruct the answer (invariant)", () => {
    // For each step's quotient digit q_i, place value 10^(steps-1-i),
    // sum should equal the answer. Tests the entire phase math end-to-end.
    const cases: Array<[number, number, number]> = [
      [304, 8, 38],
      [156, 6, 26],
      [9999, 9, 1111],
      [4096, 4, 1024],
      [891, 9, 99],
      [100, 5, 20],
      [50, 2, 25],
      [9801, 99, 99],
      [1000, 25, 40],
      [7, 7, 1],
    ];
    for (const [a, b, ans] of cases) {
      const phases = buildPhases(problem(a, b, "/", ans));
      const quotientPhases = phases.filter(
        (p) => p.kind === "divQuotientDigit",
      );
      const reconstructed = quotientPhases.reduce((acc, p, i) => {
        const place = quotientPhases.length - 1 - i;
        return acc + p.value * 10 ** place;
      }, 0);
      expect(reconstructed).toBe(ans);
    }
  });

  it("each step's product equals divisor × quotient digit", () => {
    const cases: Array<[number, number, number]> = [
      [304, 8, 38],
      [156, 6, 26],
      [9801, 99, 99],
      [891, 9, 99],
    ];
    for (const [a, b, ans] of cases) {
      const phases = buildPhases(problem(a, b, "/", ans));
      const stepCount = phases.length / 3;
      for (let s = 0; s < stepCount; s++) {
        const q = phases[s * 3]?.value ?? 0;
        const product = phases[s * 3 + 1]?.value ?? 0;
        expect(product).toBe(q * b);
      }
    }
  });

  it("each step's remainder equals chunk - product", () => {
    const phases = buildPhases(problem(304, 8, "/", 38));
    const stepCount = phases.length / 3;
    for (let s = 0; s < stepCount; s++) {
      const chunk = phases[s * 3]?.chunk ?? 0;
      const product = phases[s * 3 + 1]?.value ?? 0;
      const remainder = phases[s * 3 + 2]?.value ?? 0;
      expect(remainder).toBe(chunk - product);
      expect(remainder).toBeLessThan(8);
    }
  });
});
