import {
  type Language,
  LessonKind,
  type Operation,
  type OperationSetup,
  SetupKind,
  type WordKind,
  type WordLessonSetup,
} from "./types";

export type Grade = 1 | 2 | 3 | 4;

/**
 * Lessons ship a fully-formed setup. Tapping a lesson navigates straight to a
 * practice route; the setup is attached as router state and does not overwrite
 * the profile's per-operation setup that /setup edits. `setup.guide` is left
 * undefined here so the column-practice "Vodič" defaults to ON for kids
 * learning the procedure; a parent can still turn it off in /setup for the
 * horizontal/manual flow without affecting lesson runs.
 *
 * Two lesson kinds:
 *   - "arith": a numeric add/sub/mul/div round, dispatched to /practice/:op
 *   - "word":  a Croatian word-problem round, dispatched to /word-practice/:id
 *
 * Word lessons are HR-only by design (Croatian school vocabulary is the
 * lesson). Lessons with `languages` set are filtered out for other languages.
 */
export type ArithLesson = {
  kind: typeof LessonKind.Arith;
  id: string;
  grade: Grade;
  nameKey: string;
  op: Operation;
  setup: OperationSetup;
  languages?: Language[];
};

export type WordLesson = {
  kind: typeof LessonKind.Word;
  id: string;
  grade: Grade;
  nameKey: string;
  /** Mirrored on `setup.wordKinds`; kept here for ergonomic access. */
  wordKinds: WordKind[];
  setup: WordLessonSetup;
  languages?: Language[];
};

export type Lesson = ArithLesson | WordLesson;

export const GRADES: Grade[] = [1, 2, 3, 4];

const range = (lo: number, hi: number): number[] =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

const ROUNDS = 20;

const TABLE_FACTORS = range(1, 10);
const TABLE_NONTRIVIAL = range(2, 10);

const arith = (l: Omit<ArithLesson, "kind">): ArithLesson => ({
  kind: LessonKind.Arith,
  ...l,
});

const word = (l: {
  id: string;
  grade: Grade;
  nameKey: string;
  /** One kind, or several to pool into one combined round. */
  wordKind: WordKind | WordKind[];
  languages?: Language[];
  rounds?: number;
  timeMs?: number;
  /** Grade-scoping bound for range-aware templates (vocab, muldiv). */
  maxNumber?: number;
}): WordLesson => {
  const wordKinds = Array.isArray(l.wordKind) ? l.wordKind : [l.wordKind];
  return {
    kind: LessonKind.Word,
    id: l.id,
    grade: l.grade,
    nameKey: l.nameKey,
    wordKinds,
    languages: l.languages ?? ["hr"],
    setup: {
      kind: SetupKind.Word,
      wordKinds,
      rounds: l.rounds ?? ROUNDS,
      ...(l.timeMs !== undefined ? { timeMs: l.timeMs } : {}),
      ...(l.maxNumber !== undefined ? { maxNumber: l.maxNumber } : {}),
    },
  };
};

export const LESSONS: Lesson[] = [
  // 1. razred
  arith({
    id: "g1-add-10",
    grade: 1,
    nameKey: "lessons.g1.add10",
    op: "add",
    setup: { kind: "range", min: 1, max: 10, rounds: ROUNDS },
  }),
  arith({
    id: "g1-sub-10",
    grade: 1,
    nameKey: "lessons.g1.sub10",
    op: "sub",
    setup: { kind: "range", min: 1, max: 10, rounds: ROUNDS },
  }),
  arith({
    id: "g1-add-20-no-cross",
    grade: 1,
    nameKey: "lessons.g1.add20NoCross",
    op: "add",
    setup: {
      // Teen + single-digit so the lesson actually exercises the tens range.
      // crossesTen: never additionally caps b so a%10 + b%10 < 10, i.e. the
      // sum stays in the same ten as a (12+5=17 yes; 12+9=21 no).
      kind: "range",
      min: 11,
      max: 19,
      min2: 1,
      max2: 9,
      crossesTen: "never",
      rounds: ROUNDS,
    },
  }),
  arith({
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
  }),
  arith({
    id: "g1-sub-20-no-cross",
    grade: 1,
    nameKey: "lessons.g1.sub20NoCross",
    op: "sub",
    setup: {
      // Teen − single-digit so the lesson actually exercises the tens range.
      // crossesTen: never additionally caps b so a%10 >= b%10, i.e. the
      // result stays in the same ten as a (15−3=12 yes; 15−7=8 no).
      kind: "range",
      min: 11,
      max: 19,
      min2: 1,
      max2: 9,
      crossesTen: "never",
      rounds: ROUNDS,
    },
  }),
  arith({
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
  }),
  arith({
    id: "g1-addsub-20",
    grade: 1,
    nameKey: "lessons.g1.addsub20",
    op: "addsub",
    setup: { kind: "range", min: 1, max: 20, rounds: ROUNDS },
  }),

  // 1. razred — zadaci s riječima (HR only)
  word({
    id: "g1-word-vocab",
    grade: 1,
    nameKey: "lessons.g1.wordVocab",
    wordKind: "vocab",
  }),
  word({
    id: "g1-word-missing",
    grade: 1,
    nameKey: "lessons.g1.wordMissing",
    wordKind: "missing",
  }),
  word({
    id: "g1-word-compound",
    grade: 1,
    nameKey: "lessons.g1.wordCompound",
    wordKind: "compound",
  }),
  word({
    id: "g1-word-story",
    grade: 1,
    nameKey: "lessons.g1.wordStory",
    wordKind: "story",
  }),
  word({
    id: "g1-word-mixed",
    grade: 1,
    nameKey: "lessons.g1.wordMixed",
    wordKind: ["vocab", "missing", "compound", "story"],
  }),
  word({
    id: "g1-compare",
    grade: 1,
    nameKey: "lessons.g1.compare",
    wordKind: "compare",
  }),
  word({
    id: "g1-shapes",
    grade: 1,
    nameKey: "lessons.g1.shapes",
    wordKind: "shapes",
  }),

  // 2. razred
  arith({
    id: "g2-add-100",
    grade: 2,
    nameKey: "lessons.g2.add100",
    op: "add",
    setup: { kind: "range", min: 10, max: 100, rounds: ROUNDS },
  }),
  arith({
    id: "g2-sub-100",
    grade: 2,
    nameKey: "lessons.g2.sub100",
    op: "sub",
    setup: { kind: "range", min: 10, max: 100, rounds: ROUNDS },
  }),
  arith({
    id: "g2-addsub-100",
    grade: 2,
    nameKey: "lessons.g2.addsub100",
    op: "addsub",
    setup: { kind: "range", min: 10, max: 100, rounds: ROUNDS },
  }),
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map<ArithLesson>((n) =>
    arith({
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
    }),
  ),
  arith({
    id: "g2-mul-mixed",
    grade: 2,
    nameKey: "lessons.g2.mulMixed",
    op: "mul",
    setup: {
      kind: "multiplicands",
      values: TABLE_NONTRIVIAL,
      rounds: ROUNDS,
    },
  }),
  arith({
    id: "g2-div-table",
    grade: 2,
    nameKey: "lessons.g2.divTable",
    op: "div",
    setup: {
      kind: "multiplicands",
      values: TABLE_NONTRIVIAL,
      rounds: ROUNDS,
    },
  }),

  // 2. razred — pretvaranje novca (HR only)
  word({
    id: "g2-units-money",
    grade: 2,
    nameKey: "lessons.g2.unitsMoney",
    wordKind: "convertMoney",
  }),

  // 2. razred — zadaci s riječima (HR only)
  word({
    id: "g2-word-vocab",
    grade: 2,
    nameKey: "lessons.g2.wordVocab",
    wordKind: "vocab",
    maxNumber: 100,
  }),
  word({
    id: "g2-word-muldiv",
    grade: 2,
    nameKey: "lessons.g2.wordMulDiv",
    wordKind: "muldivword",
  }),
  word({
    id: "g2-compare",
    grade: 2,
    nameKey: "lessons.g2.compare",
    wordKind: "compare",
    maxNumber: 100,
  }),
  word({
    id: "g2-parts",
    grade: 2,
    nameKey: "lessons.g2.parts",
    wordKind: "partsOfWhole",
  }),
  word({
    id: "g2-probability",
    grade: 2,
    nameKey: "lessons.g2.probability",
    wordKind: "probability",
  }),

  // 3. razred
  arith({
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
  }),
  arith({
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
  }),
  arith({
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
  }),
  arith({
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
  }),
  arith({
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
  }),

  // 3. razred — pretvaranje mjernih jedinica (HR only)
  word({
    id: "g3-units-mass",
    grade: 3,
    nameKey: "lessons.g3.unitsMass",
    wordKind: "convertMass",
  }),
  word({
    id: "g3-units-volume",
    grade: 3,
    nameKey: "lessons.g3.unitsVolume",
    wordKind: "convertVolume",
  }),
  word({
    id: "g3-units-mass-volume",
    grade: 3,
    nameKey: "lessons.g3.unitsMassVolume",
    wordKind: ["convertMass", "convertVolume"],
  }),
  word({
    id: "g3-units-length",
    grade: 3,
    nameKey: "lessons.g3.unitsLength",
    wordKind: "convertLength",
  }),
  word({
    id: "g3-units-time",
    grade: 3,
    nameKey: "lessons.g3.unitsTime",
    wordKind: "convertTime",
  }),
  word({
    id: "g3-word-vocab",
    grade: 3,
    nameKey: "lessons.g3.wordVocab",
    wordKind: "vocab",
    maxNumber: 1000,
  }),
  word({
    id: "g3-word-muldiv",
    grade: 3,
    nameKey: "lessons.g3.wordMulDiv",
    wordKind: "muldivword",
    maxNumber: 1000,
  }),
  word({
    id: "g3-place-value",
    grade: 3,
    nameKey: "lessons.g3.placeValue",
    wordKind: "placeValue",
  }),
  word({
    id: "g3-perimeter",
    grade: 3,
    nameKey: "lessons.g3.perimeter",
    wordKind: "perimeter",
  }),
  word({
    id: "g3-data",
    grade: 3,
    nameKey: "lessons.g3.data",
    wordKind: "dataChart",
  }),

  // 4. razred
  arith({
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
  }),
  arith({
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
  }),
  arith({
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
  }),
  arith({
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
  }),
  arith({
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
  }),

  // 4. razred — zadaci s riječima (HR only)
  word({
    id: "g4-word-vocab",
    grade: 4,
    nameKey: "lessons.g4.wordVocab",
    wordKind: "vocab",
    maxNumber: 1000,
  }),
  word({
    id: "g4-word-muldiv",
    grade: 4,
    nameKey: "lessons.g4.wordMulDiv",
    wordKind: "muldivword",
    maxNumber: 1000,
  }),
  word({
    id: "g4-rounding",
    grade: 4,
    nameKey: "lessons.g4.rounding",
    wordKind: "rounding",
    maxNumber: 1000,
  }),
  word({
    id: "g4-place-value",
    grade: 4,
    nameKey: "lessons.g4.placeValue",
    wordKind: "placeValue",
    maxNumber: 1000,
  }),
  word({
    id: "g4-fractions",
    grade: 4,
    nameKey: "lessons.g4.fractions",
    wordKind: "fraction",
  }),
  word({
    id: "g4-perimeter-area",
    grade: 4,
    nameKey: "lessons.g4.perimeterArea",
    wordKind: ["perimeter", "area"],
  }),
];

export function lessonsByGrade(grade: Grade, language?: Language): Lesson[] {
  return LESSONS.filter((l) => {
    if (l.grade !== grade) return false;
    if (l.languages && language && !l.languages.includes(language))
      return false;
    return true;
  });
}

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

/**
 * Build one combined word-lesson setup from several word lessons the user
 * multi-selected in the UI. The round pools problems from the union of all
 * their `wordKinds` (de-duplicated, order preserved). `maxNumber` takes the
 * largest declared bound so the combined round isn't capped below any member.
 * This is what replaces baked "X and Y together" lessons.
 */
export function combinedWordSetup(lessons: WordLesson[]): WordLessonSetup {
  const wordKinds: WordKind[] = [];
  const seen = new Set<WordKind>();
  let maxNumber: number | undefined;
  for (const lesson of lessons) {
    for (const kind of lesson.wordKinds) {
      if (!seen.has(kind)) {
        seen.add(kind);
        wordKinds.push(kind);
      }
    }
    const m = lesson.setup.maxNumber;
    if (m !== undefined) maxNumber = Math.max(maxNumber ?? 0, m);
  }
  return {
    kind: SetupKind.Word,
    wordKinds,
    rounds: ROUNDS,
    ...(maxNumber !== undefined ? { maxNumber } : {}),
  };
}

export function isValidGrade(s: string): s is `${Grade}` {
  return s === "1" || s === "2" || s === "3" || s === "4";
}

/**
 * Type-guard helpers. Single source of truth for "is this a word-problem
 * lesson?" — runtime call sites should never compare against the `"word"`
 * literal directly.
 */
export function isWordLesson(
  lesson: Lesson | null | undefined,
): lesson is WordLesson {
  return lesson?.kind === LessonKind.Word;
}

export function isArithLesson(
  lesson: Lesson | null | undefined,
): lesson is ArithLesson {
  return lesson?.kind === LessonKind.Arith;
}

/**
 * True when a word lesson is allowed to be shown in the given language —
 * either it has no language restriction or the language is in its allow list.
 */
export function isLessonVisibleInLanguage(
  lesson: Lesson,
  language: Language,
): boolean {
  return !lesson.languages || lesson.languages.includes(language);
}
