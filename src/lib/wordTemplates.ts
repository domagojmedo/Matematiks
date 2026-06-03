import type { WordKind } from "./types";
import {
  declineNoun,
  NAME_KEYS,
  NAMES,
  NOUN_KEYS,
  NOUNS,
  nounPlural,
} from "./wordDeclension";
import type { Unit, WordPhase, WordProblem } from "./wordTypes";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function pickKey<T>(
  record: Record<string, T>,
  keys: readonly string[],
): {
  key: string;
  value: T;
} {
  const key = pick(keys);
  return { key, value: record[key] as T };
}

function pickKeyExcept<T>(
  record: Record<string, T>,
  keys: readonly string[],
  except: string,
): { key: string; value: T } {
  const filtered = keys.filter((k) => k !== except);
  return pickKey(record, filtered);
}

/**
 * Template definition. Each template knows how to generate a complete
 * WordProblem (numbers, vars, phases) and how to render its prose for both
 * live practice and session-history re-display.
 */
export type WordTemplate = {
  id: string;
  type: Exclude<WordKind, "mixed">;
  generate: () => WordProblem;
  /** Render the problem prose (excluding per-step labels carried by phases). */
  renderProse: (problem: WordProblem) => string;
};

// ---------------------------------------------------------------------------
// Vocab templates
// ---------------------------------------------------------------------------

const vocabSum: WordTemplate = {
  id: "vocab_sum",
  type: "vocab",
  generate: () => {
    const a = randInt(2, 18);
    const bMax = Math.min(18, 20 - a);
    const b = randInt(2, Math.max(2, bMax));
    const phases: WordPhase[] = [
      { kind: "pickOp", a, b, expected: "+" },
      {
        kind: "answer",
        slot: "result",
        a,
        b,
        op: "+",
        result: a + b,
        expected: a + b,
      },
    ];
    return { templateId: vocabSum.id, numbers: [a, b], phases };
  },
  renderProse: (p) =>
    `Izračunaj zbroj brojeva ${p.numbers[0]} i ${p.numbers[1]}.`,
};

const vocabDiff: WordTemplate = {
  id: "vocab_diff",
  type: "vocab",
  generate: () => {
    const a = randInt(3, 20);
    const b = randInt(1, a - 1);
    const phases: WordPhase[] = [
      { kind: "pickOp", a, b, expected: "-" },
      {
        kind: "answer",
        slot: "result",
        a,
        b,
        op: "-",
        result: a - b,
        expected: a - b,
      },
    ];
    return { templateId: vocabDiff.id, numbers: [a, b], phases };
  },
  renderProse: (p) =>
    `Izračunaj razliku brojeva ${p.numbers[0]} i ${p.numbers[1]}.`,
};

// ---------------------------------------------------------------------------
// Missing-operand templates
//
// These are single-phase: the operation in the equation is given (the prose
// names "zbroj" / "razlika"), so the kid skips pickOp and types the unknown
// directly. The slot reflects which equation position is unknown.
// ---------------------------------------------------------------------------

const missingFirstAddend: WordTemplate = {
  id: "missing_first_addend",
  type: "missing",
  generate: () => {
    const sum = randInt(5, 20);
    const second = randInt(1, sum - 1);
    const first = sum - second;
    const phases: WordPhase[] = [
      {
        kind: "answer",
        slot: "a",
        a: first,
        b: second,
        op: "+",
        result: sum,
        expected: first,
      },
    ];
    return {
      templateId: missingFirstAddend.id,
      numbers: [sum, second],
      phases,
    };
  },
  renderProse: (p) =>
    `Ako je zbroj ${p.numbers[0]}, a drugi pribrojnik ${p.numbers[1]}, koliki je prvi pribrojnik?`,
};

const missingSecondAddend: WordTemplate = {
  id: "missing_second_addend",
  type: "missing",
  generate: () => {
    const sum = randInt(5, 20);
    const first = randInt(1, sum - 1);
    const second = sum - first;
    const phases: WordPhase[] = [
      {
        kind: "answer",
        slot: "b",
        a: first,
        b: second,
        op: "+",
        result: sum,
        expected: second,
      },
    ];
    return {
      templateId: missingSecondAddend.id,
      numbers: [sum, first],
      phases,
    };
  },
  renderProse: (p) =>
    `Ako je zbroj ${p.numbers[0]}, a prvi pribrojnik ${p.numbers[1]}, koliki je drugi pribrojnik?`,
};

const missingMinuend: WordTemplate = {
  id: "missing_minuend",
  type: "missing",
  generate: () => {
    const diff = randInt(1, 19);
    const subMax = 20 - diff;
    const subtrahend = randInt(1, Math.max(1, subMax));
    const minuend = diff + subtrahend;
    const phases: WordPhase[] = [
      {
        kind: "answer",
        slot: "a",
        a: minuend,
        b: subtrahend,
        op: "-",
        result: diff,
        expected: minuend,
      },
    ];
    return {
      templateId: missingMinuend.id,
      numbers: [diff, subtrahend],
      phases,
    };
  },
  renderProse: (p) =>
    `Ako je razlika ${p.numbers[0]}, a umanjitelj ${p.numbers[1]}, koliki je umanjenik?`,
};

const missingSubtrahend: WordTemplate = {
  id: "missing_subtrahend",
  type: "missing",
  generate: () => {
    const diff = randInt(1, 19);
    const minuend = randInt(diff + 1, 20);
    const subtrahend = minuend - diff;
    const phases: WordPhase[] = [
      {
        kind: "answer",
        slot: "b",
        a: minuend,
        b: subtrahend,
        op: "-",
        result: diff,
        expected: subtrahend,
      },
    ];
    return {
      templateId: missingSubtrahend.id,
      numbers: [diff, minuend],
      phases,
    };
  },
  renderProse: (p) =>
    `Ako je razlika ${p.numbers[0]}, a umanjenik ${p.numbers[1]}, koliki je umanjitelj?`,
};

// ---------------------------------------------------------------------------
// Compound templates — two-step expressions with intermediate ≤ 15 (per spec)
// and final ≤ 20.
// ---------------------------------------------------------------------------

const compoundDiffPlus: WordTemplate = {
  id: "compound_diff_plus",
  type: "compound",
  generate: () => {
    // (A − B) + C, with intermediate I = A−B in [1,15], final = I+C ≤ 20.
    const A = randInt(2, 18);
    const Bmin = Math.max(1, A - 15); // ensures A-B ≤ 15
    const Bmax = A - 1; // B ≥ 1, B ≤ A-1 (avoids zero result)
    const B = randInt(Bmin, Math.max(Bmin, Bmax));
    const I = A - B;
    const C = randInt(1, 20 - I);
    const phases: WordPhase[] = [
      { kind: "pickOp", a: A, b: B, expected: "-", stepStart: true },
      {
        kind: "answer",
        slot: "result",
        a: A,
        b: B,
        op: "-",
        result: I,
        expected: I,
      },
      { kind: "pickOp", a: I, b: C, expected: "+", stepStart: true },
      {
        kind: "answer",
        slot: "result",
        a: I,
        b: C,
        op: "+",
        result: I + C,
        expected: I + C,
      },
    ];
    return { templateId: compoundDiffPlus.id, numbers: [A, B, C], phases };
  },
  renderProse: (p) =>
    `Razliku brojeva ${p.numbers[0]} i ${p.numbers[1]} uvećaj za ${p.numbers[2]}.`,
};

const compoundSumMinus: WordTemplate = {
  id: "compound_sum_minus",
  type: "compound",
  generate: () => {
    // (A + B) − C, intermediate I = A+B in [2,15], C in [1, I-1].
    const A = randInt(1, 14);
    // 15 − A is always ≥ 1 for A ∈ [1,14], so this bound suffices on its own.
    const Bmax = 15 - A;
    const B = randInt(1, Bmax);
    const I = A + B;
    const C = randInt(1, I - 1);
    const phases: WordPhase[] = [
      { kind: "pickOp", a: A, b: B, expected: "+", stepStart: true },
      {
        kind: "answer",
        slot: "result",
        a: A,
        b: B,
        op: "+",
        result: I,
        expected: I,
      },
      { kind: "pickOp", a: I, b: C, expected: "-", stepStart: true },
      {
        kind: "answer",
        slot: "result",
        a: I,
        b: C,
        op: "-",
        result: I - C,
        expected: I - C,
      },
    ];
    return { templateId: compoundSumMinus.id, numbers: [A, B, C], phases };
  },
  renderProse: (p) =>
    `Zbroj brojeva ${p.numbers[0]} i ${p.numbers[1]} umanji za ${p.numbers[2]}.`,
};

const compoundNumPlusDiff: WordTemplate = {
  id: "compound_num_plus_diff",
  type: "compound",
  generate: () => {
    // A + (B − C), intermediate I = B−C in [1,15], A + I ≤ 20.
    const B = randInt(2, 19);
    const Cmin = Math.max(1, B - 15);
    const C = randInt(Cmin, B - 1);
    const I = B - C;
    const A = randInt(1, 20 - I);
    const phases: WordPhase[] = [
      { kind: "pickOp", a: B, b: C, expected: "-", stepStart: true },
      {
        kind: "answer",
        slot: "result",
        a: B,
        b: C,
        op: "-",
        result: I,
        expected: I,
      },
      { kind: "pickOp", a: A, b: I, expected: "+", stepStart: true },
      {
        kind: "answer",
        slot: "result",
        a: A,
        b: I,
        op: "+",
        result: A + I,
        expected: A + I,
      },
    ];
    return {
      templateId: compoundNumPlusDiff.id,
      numbers: [A, B, C],
      phases,
    };
  },
  renderProse: (p) =>
    `Broj ${p.numbers[0]} uvećaj za razliku brojeva ${p.numbers[1]} i ${p.numbers[2]}.`,
};

const compoundNumMinusSum: WordTemplate = {
  id: "compound_num_minus_sum",
  type: "compound",
  generate: () => {
    // A − (B + C), intermediate I = B+C in [2,15], A in [I+1, 20].
    const B = randInt(1, 13);
    const Cmax = Math.min(15 - B, 13);
    const C = randInt(1, Math.max(1, Cmax));
    const I = B + C;
    const A = randInt(I + 1, 20);
    const phases: WordPhase[] = [
      { kind: "pickOp", a: B, b: C, expected: "+", stepStart: true },
      {
        kind: "answer",
        slot: "result",
        a: B,
        b: C,
        op: "+",
        result: I,
        expected: I,
      },
      { kind: "pickOp", a: A, b: I, expected: "-", stepStart: true },
      {
        kind: "answer",
        slot: "result",
        a: A,
        b: I,
        op: "-",
        result: A - I,
        expected: A - I,
      },
    ];
    return {
      templateId: compoundNumMinusSum.id,
      numbers: [A, B, C],
      phases,
    };
  },
  renderProse: (p) =>
    `Broj ${p.numbers[0]} umanji za zbroj brojeva ${p.numbers[1]} i ${p.numbers[2]}.`,
};

// ---------------------------------------------------------------------------
// Story templates — full Croatian prose with names + nouns + declension.
// ---------------------------------------------------------------------------

function pickStoryActors(): {
  nameA: string;
  nameAGen: string;
  nameB: string;
  nounKey: string;
} {
  const a = pickKey(NAMES, NAME_KEYS);
  const b = pickKeyExcept(NAMES, NAME_KEYS, a.key);
  const noun = pickKey(NOUNS, NOUN_KEYS);
  return {
    nameA: a.value.nom,
    nameAGen: a.value.gen,
    nameB: b.value.nom,
    nounKey: noun.key,
  };
}

const storyFewer: WordTemplate = {
  id: "story_fewer",
  type: "story",
  generate: () => {
    const A = randInt(3, 10);
    const B = randInt(1, A - 1);
    const tomoCount = A - B; // what nameB has
    const total = A + tomoCount; // 2A − B
    const actors = pickStoryActors();
    const noun = NOUNS[actors.nounKey] as (typeof NOUNS)[string];
    const labelStep1 = `Koliko ${nounPlural(noun)} ima ${actors.nameB}?`;
    const labelStep2 = `Koliko ${nounPlural(noun)} imaju zajedno?`;
    const phases: WordPhase[] = [
      {
        kind: "pickOp",
        a: A,
        b: B,
        expected: "-",
        stepStart: true,
        stepLabel: labelStep1,
      },
      {
        kind: "answer",
        slot: "result",
        a: A,
        b: B,
        op: "-",
        result: tomoCount,
        expected: tomoCount,
      },
      {
        kind: "pickOp",
        a: A,
        b: tomoCount,
        expected: "+",
        stepStart: true,
        stepLabel: labelStep2,
      },
      {
        kind: "answer",
        slot: "result",
        a: A,
        b: tomoCount,
        op: "+",
        result: total,
        expected: total,
      },
    ];
    return {
      templateId: storyFewer.id,
      numbers: [A, B],
      vars: {
        nameA: actors.nameA,
        nameAGen: actors.nameAGen,
        nameB: actors.nameB,
        noun: actors.nounKey,
      },
      phases,
    };
  },
  renderProse: (p) => {
    const [A = 0, B = 0] = p.numbers;
    const nounKey = p.vars?.noun ?? "pikula";
    const noun = NOUNS[nounKey] as (typeof NOUNS)[string];
    const nameA = p.vars?.nameA ?? "";
    const nameAGen = p.vars?.nameAGen ?? "";
    const nameB = p.vars?.nameB ?? "";
    return (
      `${nameA} ima ${A} ${declineNoun(noun, A)}. ` +
      `${nameB} ima ${B} ${declineNoun(noun, B)} manje od ${nameAGen}.`
    );
  },
};

const storyMore: WordTemplate = {
  id: "story_more",
  type: "story",
  generate: () => {
    const A = randInt(2, 8);
    const Bmax = 20 - 2 * A;
    const B = randInt(1, Math.max(1, Bmax));
    const tomoCount = A + B;
    const total = A + tomoCount; // 2A + B
    const actors = pickStoryActors();
    const noun = NOUNS[actors.nounKey] as (typeof NOUNS)[string];
    const labelStep1 = `Koliko ${nounPlural(noun)} ima ${actors.nameB}?`;
    const labelStep2 = `Koliko ${nounPlural(noun)} imaju zajedno?`;
    const phases: WordPhase[] = [
      {
        kind: "pickOp",
        a: A,
        b: B,
        expected: "+",
        stepStart: true,
        stepLabel: labelStep1,
      },
      {
        kind: "answer",
        slot: "result",
        a: A,
        b: B,
        op: "+",
        result: tomoCount,
        expected: tomoCount,
      },
      {
        kind: "pickOp",
        a: A,
        b: tomoCount,
        expected: "+",
        stepStart: true,
        stepLabel: labelStep2,
      },
      {
        kind: "answer",
        slot: "result",
        a: A,
        b: tomoCount,
        op: "+",
        result: total,
        expected: total,
      },
    ];
    return {
      templateId: storyMore.id,
      numbers: [A, B],
      vars: {
        nameA: actors.nameA,
        nameAGen: actors.nameAGen,
        nameB: actors.nameB,
        noun: actors.nounKey,
      },
      phases,
    };
  },
  renderProse: (p) => {
    const [A = 0, B = 0] = p.numbers;
    const nounKey = p.vars?.noun ?? "pikula";
    const noun = NOUNS[nounKey] as (typeof NOUNS)[string];
    const nameA = p.vars?.nameA ?? "";
    const nameAGen = p.vars?.nameAGen ?? "";
    const nameB = p.vars?.nameB ?? "";
    return (
      `${nameA} ima ${A} ${declineNoun(noun, A)}. ` +
      `${nameB} ima ${B} ${declineNoun(noun, B)} više od ${nameAGen}.`
    );
  },
};

// ---------------------------------------------------------------------------
// Unit-conversion templates (mass + volume). Each template fixes the from/to
// units and generates a whole-number source value so the answer is also whole.
// Prose is uniform across directions: "Pretvori N <unit> u <unit>.".
// ---------------------------------------------------------------------------

function buildConvertTemplate(
  id: string,
  from: Unit,
  to: Unit,
  pickValue: () => number,
  factor: number,
  direction: "expand" | "compress",
  family: "convertMass" | "convertVolume",
): WordTemplate {
  return {
    id,
    type: family,
    generate: () => {
      const value = pickValue();
      const expected = direction === "expand" ? value * factor : value / factor;
      const phases: WordPhase[] = [
        { kind: "convert", value, fromUnit: from, toUnit: to, expected },
      ];
      return { templateId: id, numbers: [value], phases };
    },
    renderProse: (p) => `Pretvori ${p.numbers[0]} ${from} u ${to}.`,
  };
}

// "expand" = smaller unit per result digit, so we MULTIPLY by `factor`:
// kg→g (×1000), kg→dag (×100), dag→g (×10), t→kg (×1000).
// "compress" = larger unit per result digit, so we DIVIDE by `factor`:
// g→kg (÷1000), dag→kg (÷100), g→dag (÷10), kg→t (÷1000).
//
// Source-value ranges: every template caps the small-count side at 10 — kids
// shouldn't be quizzed on "37 kg in g" or "42 dag in g". The big-count side
// is always `small * factor`, so it's a multiple of the factor and the
// divided answer is always whole.

const convertKgToG = buildConvertTemplate(
  "convert_kg_to_g",
  "kg",
  "g",
  () => randInt(1, 10),
  1000,
  "expand",
  "convertMass",
);

const convertGToKg = buildConvertTemplate(
  "convert_g_to_kg",
  "g",
  "kg",
  () => randInt(1, 10) * 1000,
  1000,
  "compress",
  "convertMass",
);

const convertKgToDag = buildConvertTemplate(
  "convert_kg_to_dag",
  "kg",
  "dag",
  () => randInt(1, 10),
  100,
  "expand",
  "convertMass",
);

const convertDagToKg = buildConvertTemplate(
  "convert_dag_to_kg",
  "dag",
  "kg",
  () => randInt(1, 10) * 100,
  100,
  "compress",
  "convertMass",
);

const convertDagToG = buildConvertTemplate(
  "convert_dag_to_g",
  "dag",
  "g",
  () => randInt(2, 10),
  10,
  "expand",
  "convertMass",
);

const convertGToDag = buildConvertTemplate(
  "convert_g_to_dag",
  "g",
  "dag",
  () => randInt(2, 10) * 10,
  10,
  "compress",
  "convertMass",
);

const convertTToKg = buildConvertTemplate(
  "convert_t_to_kg",
  "t",
  "kg",
  () => randInt(1, 10),
  1000,
  "expand",
  "convertMass",
);

const convertKgToT = buildConvertTemplate(
  "convert_kg_to_t",
  "kg",
  "t",
  () => randInt(1, 10) * 1000,
  1000,
  "compress",
  "convertMass",
);

const MASS_CONVERT_TEMPLATES: readonly WordTemplate[] = [
  convertKgToG,
  convertGToKg,
  convertKgToDag,
  convertDagToKg,
  convertDagToG,
  convertGToDag,
  convertTToKg,
  convertKgToT,
];

// Volume conversions stay within the 3rd-grade scope: just litres and
// decilitres, 1 l = 10 dl. Same whole-number guarantees — the small-count side
// is capped at 10 and the big-count side is always its exact multiple.

const convertLToDl = buildConvertTemplate(
  "convert_l_to_dl",
  "l",
  "dl",
  () => randInt(2, 10),
  10,
  "expand",
  "convertVolume",
);

const convertDlToL = buildConvertTemplate(
  "convert_dl_to_l",
  "dl",
  "l",
  () => randInt(2, 10) * 10,
  10,
  "compress",
  "convertVolume",
);

const VOLUME_CONVERT_TEMPLATES: readonly WordTemplate[] = [
  convertLToDl,
  convertDlToL,
];

// ---------------------------------------------------------------------------
// Registry — keyed by templateId for lookup, grouped by type for stratified
// per-lesson selection.
// ---------------------------------------------------------------------------

export const TEMPLATES: Record<string, WordTemplate> = {
  [vocabSum.id]: vocabSum,
  [vocabDiff.id]: vocabDiff,
  [missingFirstAddend.id]: missingFirstAddend,
  [missingSecondAddend.id]: missingSecondAddend,
  [missingMinuend.id]: missingMinuend,
  [missingSubtrahend.id]: missingSubtrahend,
  [compoundDiffPlus.id]: compoundDiffPlus,
  [compoundSumMinus.id]: compoundSumMinus,
  [compoundNumPlusDiff.id]: compoundNumPlusDiff,
  [compoundNumMinusSum.id]: compoundNumMinusSum,
  [storyFewer.id]: storyFewer,
  [storyMore.id]: storyMore,
  [convertKgToG.id]: convertKgToG,
  [convertGToKg.id]: convertGToKg,
  [convertKgToDag.id]: convertKgToDag,
  [convertDagToKg.id]: convertDagToKg,
  [convertDagToG.id]: convertDagToG,
  [convertGToDag.id]: convertGToDag,
  [convertTToKg.id]: convertTToKg,
  [convertKgToT.id]: convertKgToT,
  [convertLToDl.id]: convertLToDl,
  [convertDlToL.id]: convertDlToL,
};

// Keyed by every WordKind that maps to a fixed template list. "mixed" and
// "convertMix" are aggregate kinds — they pool other lists in `poolFor` and so
// have no entry here.
export const TEMPLATES_BY_TYPE: Record<
  Exclude<WordKind, "mixed" | "convertMix">,
  readonly WordTemplate[]
> = {
  vocab: [vocabSum, vocabDiff],
  missing: [
    missingFirstAddend,
    missingSecondAddend,
    missingMinuend,
    missingSubtrahend,
  ],
  compound: [
    compoundDiffPlus,
    compoundSumMinus,
    compoundNumPlusDiff,
    compoundNumMinusSum,
  ],
  story: [storyFewer, storyMore],
  convertMass: MASS_CONVERT_TEMPLATES,
  convertVolume: VOLUME_CONVERT_TEMPLATES,
};

export function findTemplate(id: string): WordTemplate | undefined {
  return TEMPLATES[id];
}
