/**
 * Types for Croatian word problems. Mirrors the spirit of `Phase[]` from
 * columnPhases.ts but the fields are bespoke — column phases carry shift /
 * chunk / step metadata that is meaningless for prose problems.
 *
 * A WordProblem is a flat ordered list of phases. The kid advances one phase
 * at a time (just like long division). Phases come in two kinds:
 *
 *   - "pickOp": kid taps `+` or `−` for the next equation's operator.
 *   - "answer": kid types a number into one of the three equation slots
 *               (left operand `a`, right operand `b`, or result).
 *
 * Phases that begin a logical step can carry a `stepLabel` (used by story
 * problems' "Koliko ima Tomo?" / "Koliko zajedno?" sub-questions). Most
 * other templates have a single implicit step described by the top-level prose.
 */

export type WordPickOpPhase = {
  kind: "pickOp";
  a: number;
  b: number;
  expected: "+" | "-";
  stepStart?: boolean;
  stepLabel?: string;
};

export type WordAnswerPhase = {
  kind: "answer";
  /** Which slot in `a OP b = result` is the unknown the kid types. */
  slot: "a" | "b" | "result";
  a: number;
  b: number;
  op: "+" | "-";
  result: number;
  expected: number;
  stepStart?: boolean;
  stepLabel?: string;
};

/** Mass-unit symbols used by conversion problems. */
export type MassUnit = "g" | "dag" | "kg" | "t";

/** Volume-unit symbols used by conversion problems. 3rd-grade scope is just
 * litres and decilitres (1 l = 10 dl). */
export type VolumeUnit = "dl" | "l";

/** Length-unit symbols (1 km = 1000 m, 1 m = 100 cm = 10 dm, 1 cm = 10 mm). */
export type LengthUnit = "mm" | "cm" | "dm" | "m" | "km";

/** Money-unit symbols — euro only, never kuna (1 € = 100 cent). */
export type MoneyUnit = "€" | "cent";

/** Time-unit symbols (1 h = 60 min, 1 min = 60 s, 1 dan = 24 h, 1 tjedan = 7 dana). */
export type TimeUnit = "s" | "min" | "h" | "dan" | "tjedan";

/** Any unit a conversion problem can quiz. */
export type Unit = MassUnit | VolumeUnit | LengthUnit | MoneyUnit | TimeUnit;

/**
 * Unit-conversion phase. The kid sees `value <fromUnit> = ? <toUnit>` and
 * types the converted whole-number value.
 */
export type WordConvertPhase = {
  kind: "convert";
  value: number;
  fromUnit: Unit;
  toUnit: Unit;
  expected: number;
};

/**
 * Prompt-driven single numeric answer. The question lives in the template's
 * top-level prose (single-step) or in `prompt`/`stepLabel` (multi-step, e.g.
 * place-value decomposition asks for stotice/desetice/jedinice in turn). The
 * kid types `expected` and confirms — same input flow as `convert`. This is the
 * workhorse phase for rounding, parts-of-a-whole, perimeter/area and chart
 * reading; anything that's "read the prompt, type one number".
 */
export type WordSolvePhase = {
  kind: "solve";
  expected: number;
  /** Optional per-step sub-question, rendered before the answer slot. */
  prompt?: string;
  stepStart?: boolean;
  stepLabel?: string;
};

export type WordPhase =
  | WordPickOpPhase
  | WordAnswerPhase
  | WordConvertPhase
  | WordSolvePhase;

/** Phases that take user input and end a step (never `pickOp`). */
export type WordInputPhase =
  | WordAnswerPhase
  | WordConvertPhase
  | WordSolvePhase;

/**
 * Optional generation context threaded from `WordLessonSetup` into each
 * template's `generate()`, letting one template family scale by grade (e.g.
 * the same word-problem template draws bigger numbers in grade 4 than grade 2).
 * Templates that don't care simply ignore it.
 */
export type GenContext = {
  /** Upper bound for generated operands/results, if the lesson scopes one. */
  maxNumber?: number;
};

export type WordProblem = {
  templateId: string;
  /** The numbers used to render the prose, in template-defined order. */
  numbers: number[];
  /** Names / nouns picked for the prose, keyed by template variable name. */
  vars?: Record<string, string>;
  phases: WordPhase[];
};

export function totalAnswerPhases(problem: WordProblem): number {
  return problem.phases.filter((p) => p.kind === "answer").length;
}

export function finalAnswerPhase(problem: WordProblem): WordAnswerPhase {
  for (let i = problem.phases.length - 1; i >= 0; i--) {
    const phase = problem.phases[i];
    if (phase && phase.kind === "answer") return phase;
  }
  throw new Error(
    `Word problem ${problem.templateId} has no answer phase — generator bug.`,
  );
}

/**
 * Final user-input phase (answer or convert). Used by WordPractice when the
 * round ends to build a ProblemRecord, since convert-only templates have no
 * `answer` phase to fall back on.
 */
export function finalInputPhase(problem: WordProblem): WordInputPhase {
  for (let i = problem.phases.length - 1; i >= 0; i--) {
    const phase = problem.phases[i];
    if (
      phase &&
      (phase.kind === "answer" ||
        phase.kind === "convert" ||
        phase.kind === "solve")
    )
      return phase;
  }
  throw new Error(
    `Word problem ${problem.templateId} has no input phase — generator bug.`,
  );
}

/**
 * View model for a single equation line in WordPractice. Each step always
 * ends with an `answer` or `convert` phase and optionally has a preceding
 * `pickOp` phase (compound, vocab, story templates). Missing-operand and
 * convert templates have just the input phase. The optional `label` is the
 * per-step heading shown above the equation (only set on story-problem
 * sub-questions).
 */
export type WordStepView = {
  label?: string;
  pickOpIdx: number | null;
  answerIdx: number;
};

/**
 * Resolve the input phase at a step. `buildSteps` guarantees this index
 * points at an `answer` or `convert` phase — never at `pickOp` — so callers
 * get a narrowed type without repeating the cast at every site.
 */
export function phaseAtStep(
  phases: WordPhase[],
  step: WordStepView,
): WordInputPhase {
  const phase = phases[step.answerIdx];
  if (!phase || phase.kind === "pickOp") {
    throw new Error(
      `Step input phase at index ${step.answerIdx} is not an input phase — buildSteps invariant violated.`,
    );
  }
  return phase;
}

export function buildSteps(phases: WordPhase[]): WordStepView[] {
  const steps: WordStepView[] = [];
  let pickOpIdx: number | null = null;
  let pendingLabel: string | undefined;
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i] as WordPhase;
    if (phase.kind === "pickOp") {
      pickOpIdx = i;
      pendingLabel = phase.stepLabel ?? pendingLabel;
    } else {
      const ownLabel =
        phase.kind === "answer" || phase.kind === "solve"
          ? phase.stepLabel
          : undefined;
      steps.push({
        label: pendingLabel ?? ownLabel,
        pickOpIdx,
        answerIdx: i,
      });
      pickOpIdx = null;
      pendingLabel = undefined;
    }
  }
  return steps;
}
