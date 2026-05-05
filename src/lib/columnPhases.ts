import type { Problem } from "./problemGen";

export type LayoutKind = "simple" | "mulPartials" | "division";

export type PhaseKind =
  | "answer" // simple add/sub/mul (single answer line)
  | "mulPartial" // a partial product row in column mul
  | "mulSum" // the final sum row in column mul
  | "divQuotientDigit" // one digit of the quotient (long division)
  | "divProduct" // divisor × quotient digit (long division)
  | "divRemainder"; // chunk - product (long division)

export type Phase = {
  /** The numeric value the kid must enter for this phase. */
  value: number;
  /** "rtl" = type ones digit first; "ltr" = type leftmost digit first. */
  direction: "rtl" | "ltr";
  /** Which structural slot this phase fills (used by the layouts). */
  kind: PhaseKind;
  /** Step index for long division (0-based). */
  step?: number;
  /** Shift offset (in cells) for partial-product rendering. */
  shift?: number;
  /**
   * Long-division only: the chunk currently being divided. Stored so the
   * layout can render it without re-running the division loop.
   */
  chunk?: number;
};

export function pickLayout(problem: Problem): LayoutKind {
  if (problem.op === "/") return "division";
  if (problem.op === "*" && String(problem.b).length >= 2) return "mulPartials";
  return "simple";
}

export function buildPhases(problem: Problem): Phase[] {
  if (problem.op === "/") return buildDivisionPhases(problem);
  if (problem.op === "*" && String(problem.b).length >= 2)
    return buildMulPartialsPhases(problem);
  return [{ value: problem.answer, direction: "rtl", kind: "answer" }];
}

function buildMulPartialsPhases(problem: Problem): Phase[] {
  const bStr = String(problem.b);
  // Croatian convention: start with the highest-place digit of the multiplier.
  // For 53 × 47, fill 53 × 4 (shifted) first, then 53 × 7.
  const partials: Phase[] = [];
  for (let i = bStr.length - 1; i >= 0; i--) {
    const digit = Number(bStr[bStr.length - 1 - i]);
    partials.push({
      value: problem.a * digit,
      direction: "rtl",
      kind: "mulPartial",
      shift: i,
    });
  }
  return [
    ...partials,
    { value: problem.answer, direction: "rtl", kind: "mulSum" },
  ];
}

/**
 * Build the long-division phase sequence.
 *
 * Procedure (for divisor d, dividend D):
 *   - Pick the smallest leftmost chunk c of D so that c >= d (gives the first
 *     quotient digit). Quotient digit q1 = floor(c / d). Product = q1 * d.
 *     Remainder = c - product.
 *   - For each remaining digit of D: bring it down to form a new chunk.
 *     If chunk < d, quotient digit is 0, product = 0, remainder = chunk.
 *     Else quotient digit q = floor(chunk / d), product = q * d, remainder = chunk - product.
 *
 * Each step produces three phases: quotientDigit, product, remainder, and
 * each phase records its `chunk` so layouts can render without re-deriving.
 */
function buildDivisionPhases(problem: Problem): Phase[] {
  const dividend = problem.a;
  const divisor = problem.b;
  const dividendStr = String(dividend);
  const phases: Phase[] = [];
  let chunk = 0;
  let step = 0;
  let started = false;
  for (let i = 0; i < dividendStr.length; i++) {
    chunk = chunk * 10 + Number(dividendStr[i]);
    if (!started && chunk < divisor) continue; // skip until first usable chunk
    started = true;
    const stepChunk = chunk;
    const q = Math.floor(chunk / divisor);
    const product = q * divisor;
    const remainder = chunk - product;
    phases.push({
      value: q,
      direction: "ltr",
      kind: "divQuotientDigit",
      step,
      chunk: stepChunk,
    });
    phases.push({
      value: product,
      direction: "rtl",
      kind: "divProduct",
      step,
      chunk: stepChunk,
    });
    phases.push({
      value: remainder,
      direction: "rtl",
      kind: "divRemainder",
      step,
      chunk: stepChunk,
    });
    chunk = remainder;
    step += 1;
  }
  return phases;
}
