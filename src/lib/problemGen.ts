import type { Operation, OperationSetup } from "./types";

export type Problem = {
  a: number;
  b: number;
  op: "+" | "-" | "*" | "/";
  answer: number;
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function isAsymmetric(setup: Extract<OperationSetup, { kind: "range" }>) {
  return setup.min2 !== undefined || setup.max2 !== undefined;
}

function crossesTenAdd(a: number, b: number): boolean {
  return (a % 10) + (b % 10) >= 10;
}

function crossesTenSub(a: number, b: number): boolean {
  return a % 10 < b % 10;
}

type RangeSetup = Extract<OperationSetup, { kind: "range" }>;
type CrossMode = "never" | "always" | "any";

function matchesCrossesTen(p: Problem, mode: CrossMode): boolean {
  if (mode === "any") return true;
  let crosses: boolean;
  if (p.op === "+") crosses = crossesTenAdd(p.a, p.b);
  else if (p.op === "-") crosses = crossesTenSub(p.a, p.b);
  else return true;
  return mode === "always" ? crosses : !crosses;
}

function addCandidates(setup: RangeSetup): Problem[] {
  const out: Problem[] = [];
  if (isAsymmetric(setup)) {
    // max/max2 bound each operand independently; the sum is unbounded.
    const bMin = setup.min2 ?? setup.min;
    const bMax = setup.max2 ?? setup.max;
    for (let a = setup.min; a <= setup.max; a++)
      for (let b = bMin; b <= bMax; b++)
        out.push({ a, b, op: "+", answer: a + b });
  } else {
    // Symmetric: max bounds the SUM, both operands are >= min.
    const minResult = Math.min(2 * setup.min, setup.max);
    for (let s = minResult; s <= setup.max; s++)
      for (let a = setup.min; s - a >= setup.min; a++)
        out.push({ a, b: s - a, op: "+", answer: s });
  }
  return out;
}

function subCandidates(setup: RangeSetup): Problem[] {
  const bMin = setup.min2 ?? setup.min;
  const bMax = setup.max2 ?? setup.max;
  const out: Problem[] = [];
  const seen = new Set<string>();
  for (let a = setup.min; a <= setup.max; a++)
    for (let b = bMin; b <= bMax; b++) {
      // Generator orders so the minuend >= subtrahend; dedupe the ordered pair
      // so overlapping ranges don't double-weight a split. String key so it
      // stays collision-free regardless of operand magnitude.
      const [x, y] = a >= b ? [a, b] : [b, a];
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a: x, b: y, op: "-", answer: x - y });
    }
  return out;
}

/**
 * Group candidate splits by answer, dropping those that don't match the cross
 * constraint. Returns null when nothing qualifies (infeasible setup → caller
 * falls back to plain sampling).
 */
function groupByAnswer(
  candidates: Problem[],
  mode: CrossMode,
): Map<number, Problem[]> | null {
  const byAnswer = new Map<number, Problem[]>();
  for (const p of candidates) {
    if (mode !== "any" && !matchesCrossesTen(p, mode)) continue;
    const list = byAnswer.get(p.answer);
    if (list) list.push(p);
    else byAnswer.set(p.answer, [p]);
  }
  return byAnswer.size > 0 ? byAnswer : null;
}

/** Pick a UNIFORM answer, then a uniform split for it. */
function sampleByAnswer(byAnswer: Map<number, Problem[]>): Problem {
  const splits = byAnswer.get(pick([...byAnswer.keys()])) as Problem[];
  return pick(splits);
}

/**
 * Build a memoized sampler over a range setup's candidate splits. Picking a
 * uniform answer first makes every feasible answer equally likely — the cheap
 * "pick a result, then a split, reject if it doesn't cross" approach skews
 * hard (sum 10 and 20 cross almost always; sum 18 only via 9+9; sum 19 never),
 * so after rejection the surviving answers pile up at 10/20 — ~40% of "do 20 s
 * prijelazom" problems.
 *
 * The grouping is a pure function of (setup, mode), but generateProblem may
 * call the sampler up to 100x in one call (re-rolling to dodge `previous`). A
 * WeakMap keyed by the setup object enumerates + groups once and re-picks from
 * the cache; ranges here are ≤20 so the one-time enumeration is trivial.
 */
function makeSampler(build: (setup: RangeSetup) => Problem[]) {
  const cache = new WeakMap<
    RangeSetup,
    Map<CrossMode, Map<number, Problem[]> | null>
  >();
  return (setup: RangeSetup, mode: CrossMode): Problem | null => {
    let byMode = cache.get(setup);
    if (!byMode) {
      byMode = new Map();
      cache.set(setup, byMode);
    }
    let groups = byMode.get(mode);
    if (groups === undefined) {
      groups = groupByAnswer(build(setup), mode);
      byMode.set(mode, groups);
    }
    return groups ? sampleByAnswer(groups) : null;
  };
}

const sampleAdd = makeSampler(addCandidates);
const sampleSub = makeSampler(subCandidates);

function generateAdd(setup: RangeSetup, crossMode: CrossMode): Problem {
  if (crossMode !== "any") {
    const p = sampleAdd(setup, crossMode);
    if (p) return p;
  }
  if (isAsymmetric(setup)) {
    const a = randInt(setup.min, setup.max);
    const b = randInt(setup.min2 ?? setup.min, setup.max2 ?? setup.max);
    return { a, b, op: "+", answer: a + b };
  }
  const minResult = Math.min(2 * setup.min, setup.max);
  const result = randInt(minResult, setup.max);
  const aMax = Math.max(setup.min, result - setup.min);
  const a = randInt(setup.min, aMax);
  const b = result - a;
  return { a, b, op: "+", answer: result };
}

function generateSub(setup: RangeSetup, crossMode: CrossMode): Problem {
  if (crossMode !== "any") {
    const p = sampleSub(setup, crossMode);
    if (p) return p;
  }
  let a = randInt(setup.min, setup.max);
  let b = randInt(setup.min2 ?? setup.min, setup.max2 ?? setup.max);
  if (a < b) [a, b] = [b, a];
  return { a, b, op: "-", answer: a - b };
}

/**
 * Build a multiplication problem, showing either factor order for a table drill:
 * practicing 6 should serve 2 × 6 as readily as 6 × 2 (commutativity). Only
 * single-digit pairs commute — column mode reads `a` as the multiplicand and `b`
 * as the multiplier, so 45 × 7 must never surface as 7 × 45.
 */
function makeMul(a: number, b: number): Problem {
  const swap = a < 10 && b < 10 && Math.random() < 0.5;
  const [x, y] = swap ? [b, a] : [a, b];
  return { a: x, b: y, op: "*", answer: a * b };
}

function generateOnce(
  operation: Operation,
  setup: OperationSetup,
  crossMode: CrossMode,
): Problem {
  switch (operation) {
    case "add": {
      if (setup.kind !== "range") throw new Error("Bad setup for add");
      return generateAdd(setup, crossMode);
    }
    case "sub": {
      if (setup.kind !== "range") throw new Error("Bad setup for sub");
      return generateSub(setup, crossMode);
    }
    case "addsub": {
      if (setup.kind !== "range") throw new Error("Bad setup for addsub");
      const useAdd = Math.random() < 0.5;
      return useAdd
        ? generateAdd(setup, crossMode)
        : generateSub(setup, crossMode);
    }
    case "mul": {
      if (setup.kind !== "multiplicands") throw new Error("Bad setup for mul");
      return makeMul(pick(setup.values), pick(setup.values2 ?? setup.values));
    }
    case "div": {
      if (setup.kind !== "multiplicands") throw new Error("Bad setup for div");
      const divisor = pick(setup.values);
      const quotient = pick(setup.values2 ?? setup.values);
      return { a: divisor * quotient, b: divisor, op: "/", answer: quotient };
    }
    case "muldiv": {
      if (setup.kind !== "multiplicands")
        throw new Error("Bad setup for muldiv");
      const useMul = Math.random() < 0.5;
      if (useMul) {
        return makeMul(pick(setup.values), pick(setup.values2 ?? setup.values));
      }
      const divisor = pick(setup.values);
      const quotient = pick(setup.values2 ?? setup.values);
      return { a: divisor * quotient, b: divisor, op: "/", answer: quotient };
    }
  }
}

function isSameProblem(p: Problem, prev: Problem): boolean {
  if (p.op !== prev.op) return false;
  // Multiplication commutes, so 6 × 2 right after 2 × 6 still reads as a repeat:
  // compare the factor pair unordered.
  if (p.op === "*") {
    return (
      Math.min(p.a, p.b) === Math.min(prev.a, prev.b) &&
      Math.max(p.a, p.b) === Math.max(prev.a, prev.b)
    );
  }
  return p.a === prev.a && p.b === prev.b;
}

export function generateProblem(
  operation: Operation,
  setup: OperationSetup,
  previous: Problem | null = null,
): Problem {
  const crossMode =
    setup.kind === "range" ? (setup.crossesTen ?? "any") : "any";
  // Retries here only re-roll to avoid repeating `previous`; the cross
  // constraint is satisfied by construction (see makeSampler). For a
  // degenerate setup with a single possible problem we fall back to the last
  // attempt rather than loop forever.
  let last = generateOnce(operation, setup, crossMode);
  for (let i = 0; i < 100; i++) {
    const p = i === 0 ? last : generateOnce(operation, setup, crossMode);
    const okPrev = !previous || !isSameProblem(p, previous);
    const okCross = matchesCrossesTen(p, crossMode);
    if (okPrev && okCross) return p;
    last = p;
  }
  return last;
}

export function operationGlyph(op: Problem["op"]): string {
  switch (op) {
    case "+":
      return "+";
    case "-":
      return "−";
    case "*":
      return "×";
    case "/":
      return "÷";
  }
}
