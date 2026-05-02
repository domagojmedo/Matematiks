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

function generateAdd(
  setup: Extract<OperationSetup, { kind: "range" }>,
): Problem {
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

function generateSub(
  setup: Extract<OperationSetup, { kind: "range" }>,
): Problem {
  let a = randInt(setup.min, setup.max);
  let b = randInt(setup.min2 ?? setup.min, setup.max2 ?? setup.max);
  if (a < b) [a, b] = [b, a];
  return { a, b, op: "-", answer: a - b };
}

function generateOnce(operation: Operation, setup: OperationSetup): Problem {
  switch (operation) {
    case "add": {
      if (setup.kind !== "range") throw new Error("Bad setup for add");
      return generateAdd(setup);
    }
    case "sub": {
      if (setup.kind !== "range") throw new Error("Bad setup for sub");
      return generateSub(setup);
    }
    case "addsub": {
      if (setup.kind !== "range") throw new Error("Bad setup for addsub");
      const useAdd = Math.random() < 0.5;
      return useAdd ? generateAdd(setup) : generateSub(setup);
    }
    case "mul": {
      if (setup.kind !== "multiplicands") throw new Error("Bad setup for mul");
      const a = pick(setup.values);
      const b = pick(setup.values);
      return { a, b, op: "*", answer: a * b };
    }
    case "div": {
      if (setup.kind !== "multiplicands") throw new Error("Bad setup for div");
      const divisor = pick(setup.values);
      const quotient = pick(setup.values);
      return { a: divisor * quotient, b: divisor, op: "/", answer: quotient };
    }
    case "muldiv": {
      if (setup.kind !== "multiplicands")
        throw new Error("Bad setup for muldiv");
      const useMul = Math.random() < 0.5;
      if (useMul) {
        const a = pick(setup.values);
        const b = pick(setup.values);
        return { a, b, op: "*", answer: a * b };
      }
      const divisor = pick(setup.values);
      const quotient = pick(setup.values);
      return { a: divisor * quotient, b: divisor, op: "/", answer: quotient };
    }
  }
}

function isSameProblem(p: Problem, prev: Problem): boolean {
  return p.a === prev.a && p.b === prev.b && p.op === prev.op;
}

export function generateProblem(
  operation: Operation,
  setup: OperationSetup,
  previous: Problem | null = null,
): Problem {
  if (!previous) return generateOnce(operation, setup);
  for (let i = 0; i < 8; i++) {
    const p = generateOnce(operation, setup);
    if (!isSameProblem(p, previous)) return p;
  }
  return generateOnce(operation, setup);
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
