import type { Operation, OperationSetup } from "./types";

export type Grade = 1 | 2 | 3 | 4;

// Lessons ship a fully-formed setup. Tapping a lesson navigates to /practice
// with this setup attached as router state — it does not overwrite the
// profile's per-operation setup that /setup edits. `setup.guide` is left
// undefined here so the column-practice "Vodič" defaults to ON for kids
// learning the procedure; a parent can still turn it off in /setup for the
// horizontal/manual flow without affecting lesson runs.
export type Lesson = {
  id: string;
  grade: Grade;
  nameKey: string;
  op: Operation;
  setup: OperationSetup;
};

export const GRADES: Grade[] = [1, 2, 3, 4];

const range = (lo: number, hi: number): number[] =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

const ROUNDS = 20;

const TABLE_FACTORS = range(1, 10);
const TABLE_NONTRIVIAL = range(2, 10);

export const LESSONS: Lesson[] = [
  // 1. razred
  {
    id: "g1-add-10",
    grade: 1,
    nameKey: "lessons.g1.add10",
    op: "add",
    setup: { kind: "range", min: 1, max: 10, rounds: ROUNDS },
  },
  {
    id: "g1-sub-10",
    grade: 1,
    nameKey: "lessons.g1.sub10",
    op: "sub",
    setup: { kind: "range", min: 1, max: 10, rounds: ROUNDS },
  },
  {
    id: "g1-add-20-no-cross",
    grade: 1,
    nameKey: "lessons.g1.add20NoCross",
    op: "add",
    setup: {
      kind: "range",
      min: 1,
      max: 20,
      crossesTen: "never",
      rounds: ROUNDS,
    },
  },
  {
    id: "g1-add-20-cross",
    grade: 1,
    nameKey: "lessons.g1.add20Cross",
    op: "add",
    setup: {
      kind: "range",
      min: 1,
      max: 20,
      crossesTen: "always",
      rounds: ROUNDS,
    },
  },
  {
    id: "g1-sub-20-no-cross",
    grade: 1,
    nameKey: "lessons.g1.sub20NoCross",
    op: "sub",
    setup: {
      kind: "range",
      min: 1,
      max: 20,
      crossesTen: "never",
      rounds: ROUNDS,
    },
  },
  {
    id: "g1-sub-20-cross",
    grade: 1,
    nameKey: "lessons.g1.sub20Cross",
    op: "sub",
    setup: {
      kind: "range",
      min: 1,
      max: 20,
      crossesTen: "always",
      rounds: ROUNDS,
    },
  },
  {
    id: "g1-addsub-20",
    grade: 1,
    nameKey: "lessons.g1.addsub20",
    op: "addsub",
    setup: { kind: "range", min: 1, max: 20, rounds: ROUNDS },
  },

  // 2. razred
  {
    id: "g2-add-100",
    grade: 2,
    nameKey: "lessons.g2.add100",
    op: "add",
    setup: { kind: "range", min: 10, max: 100, rounds: ROUNDS },
  },
  {
    id: "g2-sub-100",
    grade: 2,
    nameKey: "lessons.g2.sub100",
    op: "sub",
    setup: { kind: "range", min: 10, max: 100, rounds: ROUNDS },
  },
  {
    id: "g2-addsub-100",
    grade: 2,
    nameKey: "lessons.g2.addsub100",
    op: "addsub",
    setup: { kind: "range", min: 10, max: 100, rounds: ROUNDS },
  },
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map<Lesson>((n) => ({
    id: `g2-mul-${n}`,
    grade: 2,
    nameKey: `lessons.g2.mul${n}`,
    op: "mul",
    setup: {
      kind: "multiplicands",
      values: [n],
      values2: TABLE_FACTORS,
      rounds: ROUNDS,
    },
  })),
  {
    id: "g2-mul-mixed",
    grade: 2,
    nameKey: "lessons.g2.mulMixed",
    op: "mul",
    setup: {
      kind: "multiplicands",
      values: TABLE_NONTRIVIAL,
      rounds: ROUNDS,
    },
  },
  {
    id: "g2-div-table",
    grade: 2,
    nameKey: "lessons.g2.divTable",
    op: "div",
    setup: {
      kind: "multiplicands",
      values: TABLE_NONTRIVIAL,
      rounds: ROUNDS,
    },
  },

  // 3. razred
  {
    id: "g3-add-1000",
    grade: 3,
    nameKey: "lessons.g3.add1000",
    op: "add",
    setup: {
      kind: "range",
      min: 100,
      max: 1000,
      format: "column",
      rounds: ROUNDS,
    },
  },
  {
    id: "g3-sub-1000",
    grade: 3,
    nameKey: "lessons.g3.sub1000",
    op: "sub",
    setup: {
      kind: "range",
      min: 100,
      max: 1000,
      format: "column",
      rounds: ROUNDS,
    },
  },
  {
    id: "g3-mul-single-digit",
    grade: 3,
    nameKey: "lessons.g3.mulSingleDigit",
    op: "mul",
    setup: {
      kind: "multiplicands",
      values: range(10, 99),
      values2: range(2, 9),
      format: "column",
      rounds: ROUNDS,
    },
  },
  {
    id: "g3-div-single-digit",
    grade: 3,
    nameKey: "lessons.g3.divSingleDigit",
    op: "div",
    setup: {
      kind: "multiplicands",
      values: range(2, 9),
      values2: range(2, 99),
      format: "column",
      rounds: ROUNDS,
    },
  },
  {
    id: "g3-muldiv-single-digit",
    grade: 3,
    nameKey: "lessons.g3.muldivSingleDigit",
    op: "muldiv",
    setup: {
      kind: "multiplicands",
      values: range(2, 9),
      values2: range(10, 99),
      format: "column",
      rounds: ROUNDS,
    },
  },

  // 4. razred
  {
    id: "g4-add-large",
    grade: 4,
    nameKey: "lessons.g4.addLarge",
    op: "add",
    setup: {
      kind: "range",
      min: 100,
      max: 9999,
      format: "column",
      rounds: ROUNDS,
    },
  },
  {
    id: "g4-sub-large",
    grade: 4,
    nameKey: "lessons.g4.subLarge",
    op: "sub",
    setup: {
      kind: "range",
      min: 100,
      max: 9999,
      format: "column",
      rounds: ROUNDS,
    },
  },
  {
    id: "g4-mul-2x2",
    grade: 4,
    nameKey: "lessons.g4.mul2x2",
    op: "mul",
    setup: {
      kind: "multiplicands",
      values: range(10, 99),
      values2: range(10, 99),
      format: "column",
      rounds: ROUNDS,
    },
  },
  {
    id: "g4-div-2digit",
    grade: 4,
    nameKey: "lessons.g4.div2Digit",
    op: "div",
    setup: {
      kind: "multiplicands",
      values: range(10, 99),
      values2: range(2, 99),
      format: "column",
      rounds: ROUNDS,
    },
  },
  {
    id: "g4-addsub-large",
    grade: 4,
    nameKey: "lessons.g4.addsubLarge",
    op: "addsub",
    setup: {
      kind: "range",
      min: 100,
      max: 9999,
      format: "column",
      rounds: ROUNDS,
    },
  },
];

export function lessonsByGrade(grade: Grade): Lesson[] {
  return LESSONS.filter((l) => l.grade === grade);
}

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function isValidGrade(s: string): s is `${Grade}` {
  return s === "1" || s === "2" || s === "3" || s === "4";
}
