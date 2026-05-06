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

export type WordPhase = WordPickOpPhase | WordAnswerPhase;

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
 * View model for a single equation line in WordPractice. Each step always
 * ends with an `answer` phase and optionally has a preceding `pickOp` phase
 * (compound, vocab, story templates). Missing-operand templates have just
 * the answer phase. The optional `label` is the per-step heading shown above
 * the equation (only set on story-problem sub-questions).
 */
export type WordStepView = {
  label?: string;
  pickOpIdx: number | null;
  answerIdx: number;
};

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
      steps.push({
        label: pendingLabel ?? phase.stepLabel,
        pickOpIdx,
        answerIdx: i,
      });
      pickOpIdx = null;
      pendingLabel = undefined;
    }
  }
  return steps;
}
