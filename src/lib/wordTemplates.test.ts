import { describe, expect, it } from "vitest";
import {
  findTemplate,
  TEMPLATES,
  TEMPLATES_BY_TYPE,
  type WordTemplate,
} from "./wordTemplates";
import type { WordProblem } from "./wordTypes";

const ITER = 200;

function answerPhasesOf(problem: WordProblem) {
  return problem.phases.flatMap((p) => (p.kind === "answer" ? [p] : []));
}

function pickOpPhasesOf(problem: WordProblem) {
  return problem.phases.flatMap((p) => (p.kind === "pickOp" ? [p] : []));
}

function expectAnswerConsistent(
  answer: ReturnType<typeof answerPhasesOf>[number],
) {
  // Every answer phase: result = a OP b, expected matches the slot.
  const computed =
    answer.op === "+" ? answer.a + answer.b : answer.a - answer.b;
  expect(computed).toBe(answer.result);
  if (answer.slot === "result") expect(answer.expected).toBe(answer.result);
  if (answer.slot === "a") expect(answer.expected).toBe(answer.a);
  if (answer.slot === "b") expect(answer.expected).toBe(answer.b);
}

function runTemplate(t: WordTemplate, check: (p: WordProblem) => void) {
  for (let i = 0; i < ITER; i++) {
    const p = t.generate();
    expect(p.templateId).toBe(t.id);
    expect(p.phases.length).toBeGreaterThan(0);
    for (const phase of p.phases) {
      if (phase.kind === "answer") expectAnswerConsistent(phase);
    }
    check(p);
  }
}

describe("vocab templates", () => {
  it("vocab_sum: 2 phases (pickOp + answer), sum ≤ 20, both operands ≥ 2", () => {
    const t = TEMPLATES.vocab_sum as WordTemplate;
    runTemplate(t, (p) => {
      expect(p.phases).toHaveLength(2);
      expect(pickOpPhasesOf(p)).toHaveLength(1);
      expect(answerPhasesOf(p)).toHaveLength(1);
      const [a = 0, b = 0] = p.numbers;
      expect(a).toBeGreaterThanOrEqual(2);
      expect(b).toBeGreaterThanOrEqual(2);
      expect(a + b).toBeLessThanOrEqual(20);
      const pick = pickOpPhasesOf(p)[0];
      expect(pick?.expected).toBe("+");
    });
  });

  it("vocab_diff: a > b, no zero or negative result", () => {
    const t = TEMPLATES.vocab_diff as WordTemplate;
    runTemplate(t, (p) => {
      expect(p.phases).toHaveLength(2);
      const [a = 0, b = 0] = p.numbers;
      expect(a).toBeGreaterThan(b);
      expect(a - b).toBeGreaterThanOrEqual(1);
      expect(pickOpPhasesOf(p)[0]?.expected).toBe("-");
    });
  });
});

describe("missing-operand templates", () => {
  it("missing_first_addend: 1 phase, slot=a, expected = sum − second", () => {
    const t = TEMPLATES.missing_first_addend as WordTemplate;
    runTemplate(t, (p) => {
      expect(p.phases).toHaveLength(1);
      const ans = answerPhasesOf(p)[0];
      expect(ans?.slot).toBe("a");
      expect(ans?.op).toBe("+");
      const [sum = 0, second = 0] = p.numbers;
      expect(ans?.expected).toBe(sum - second);
      expect(ans?.expected).toBeGreaterThanOrEqual(1);
    });
  });

  it("missing_second_addend: slot=b, expected = sum − first", () => {
    const t = TEMPLATES.missing_second_addend as WordTemplate;
    runTemplate(t, (p) => {
      const ans = answerPhasesOf(p)[0];
      expect(ans?.slot).toBe("b");
      expect(ans?.op).toBe("+");
      const [sum = 0, first = 0] = p.numbers;
      expect(ans?.expected).toBe(sum - first);
      expect(ans?.expected).toBeGreaterThanOrEqual(1);
    });
  });

  it("missing_minuend: slot=a, op=-, expected = diff + subtrahend", () => {
    const t = TEMPLATES.missing_minuend as WordTemplate;
    runTemplate(t, (p) => {
      const ans = answerPhasesOf(p)[0];
      expect(ans?.slot).toBe("a");
      expect(ans?.op).toBe("-");
      const [diff = 0, subtrahend = 0] = p.numbers;
      expect(ans?.expected).toBe(diff + subtrahend);
      expect(ans?.expected).toBeLessThanOrEqual(20);
      expect(ans?.expected).toBeGreaterThanOrEqual(2);
    });
  });

  it("missing_subtrahend: slot=b, op=-, minuend > diff", () => {
    const t = TEMPLATES.missing_subtrahend as WordTemplate;
    runTemplate(t, (p) => {
      const ans = answerPhasesOf(p)[0];
      expect(ans?.slot).toBe("b");
      expect(ans?.op).toBe("-");
      const [diff = 0, minuend = 0] = p.numbers;
      expect(minuend).toBeGreaterThan(diff);
      expect(ans?.expected).toBe(minuend - diff);
      expect(ans?.expected).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("compound templates — 4 phases, intermediate ≤ 15, final ≤ 20", () => {
  for (const t of TEMPLATES_BY_TYPE.compound) {
    it(`${t.id}: phase shape and intermediate caps`, () => {
      runTemplate(t, (p) => {
        expect(p.phases).toHaveLength(4);
        expect(pickOpPhasesOf(p)).toHaveLength(2);
        const answers = answerPhasesOf(p);
        expect(answers).toHaveLength(2);
        const [first, second] = answers;
        expect(first?.expected).toBeGreaterThanOrEqual(1);
        expect(first?.expected).toBeLessThanOrEqual(15);
        expect(second?.expected).toBeGreaterThanOrEqual(1);
        expect(second?.expected).toBeLessThanOrEqual(20);
        // Each pickOp's expected matches its paired answer's op.
        expect(p.phases[0]?.kind === "pickOp" && p.phases[0].expected).toBe(
          first?.op,
        );
        expect(p.phases[2]?.kind === "pickOp" && p.phases[2].expected).toBe(
          second?.op,
        );
      });
    });
  }

  it("compound_diff_plus computes (A − B) + C", () => {
    const t = TEMPLATES.compound_diff_plus as WordTemplate;
    runTemplate(t, (p) => {
      const [A = 0, B = 0, C = 0] = p.numbers;
      const answers = answerPhasesOf(p);
      expect(answers[0]?.expected).toBe(A - B);
      expect(answers[1]?.expected).toBe(A - B + C);
    });
  });

  it("compound_sum_minus computes (A + B) − C", () => {
    const t = TEMPLATES.compound_sum_minus as WordTemplate;
    runTemplate(t, (p) => {
      const [A = 0, B = 0, C = 0] = p.numbers;
      const answers = answerPhasesOf(p);
      expect(answers[0]?.expected).toBe(A + B);
      expect(answers[1]?.expected).toBe(A + B - C);
    });
  });

  it("compound_num_plus_diff computes A + (B − C)", () => {
    const t = TEMPLATES.compound_num_plus_diff as WordTemplate;
    runTemplate(t, (p) => {
      const [A = 0, B = 0, C = 0] = p.numbers;
      const answers = answerPhasesOf(p);
      expect(answers[0]?.expected).toBe(B - C);
      expect(answers[1]?.expected).toBe(A + (B - C));
    });
  });

  it("compound_num_minus_sum computes A − (B + C)", () => {
    const t = TEMPLATES.compound_num_minus_sum as WordTemplate;
    runTemplate(t, (p) => {
      const [A = 0, B = 0, C = 0] = p.numbers;
      const answers = answerPhasesOf(p);
      expect(answers[0]?.expected).toBe(B + C);
      expect(answers[1]?.expected).toBe(A - (B + C));
    });
  });
});

describe("story templates — 4 phases, names + noun + total ≤ 20", () => {
  it("story_fewer: nameB has A − B; total = 2A − B; both names different", () => {
    const t = TEMPLATES.story_fewer as WordTemplate;
    runTemplate(t, (p) => {
      expect(p.phases).toHaveLength(4);
      const [A = 0, B = 0] = p.numbers;
      expect(A).toBeGreaterThan(B);
      const answers = answerPhasesOf(p);
      expect(answers[0]?.expected).toBe(A - B);
      expect(answers[1]?.expected).toBe(2 * A - B);
      expect(answers[1]?.expected).toBeLessThanOrEqual(20);
      expect(p.vars?.nameA).toBeDefined();
      expect(p.vars?.nameB).toBeDefined();
      expect(p.vars?.nameAGen).toBeDefined();
      expect(p.vars?.nameA).not.toBe(p.vars?.nameB);
      expect(p.vars?.noun).toBeDefined();
      // pickOp[0] = "−" (manje od), pickOp[1] = "+" (zajedno)
      const picks = pickOpPhasesOf(p);
      expect(picks[0]?.expected).toBe("-");
      expect(picks[1]?.expected).toBe("+");
    });
  });

  it("story_more: nameB has A + B; total = 2A + B ≤ 20", () => {
    const t = TEMPLATES.story_more as WordTemplate;
    runTemplate(t, (p) => {
      const [A = 0, B = 0] = p.numbers;
      const answers = answerPhasesOf(p);
      expect(answers[0]?.expected).toBe(A + B);
      expect(answers[1]?.expected).toBe(2 * A + B);
      expect(answers[1]?.expected).toBeLessThanOrEqual(20);
      const picks = pickOpPhasesOf(p);
      expect(picks[0]?.expected).toBe("+");
      expect(picks[1]?.expected).toBe("+");
    });
  });

  it("story prose includes the chosen names and declined noun", () => {
    const t = TEMPLATES.story_fewer as WordTemplate;
    for (let i = 0; i < 30; i++) {
      const p = t.generate();
      const text = t.renderProse(p);
      expect(text).toContain(p.vars?.nameA ?? "");
      expect(text).toContain(p.vars?.nameB ?? "");
      expect(text).toContain(p.vars?.nameAGen ?? "");
      expect(text).toContain("manje od");
    }
  });
});

describe("convert (mass) templates — whole-number conversions only", () => {
  for (const t of TEMPLATES_BY_TYPE.convert) {
    it(`${t.id}: single convert phase, expected is a whole number`, () => {
      for (let i = 0; i < ITER; i++) {
        const p = t.generate();
        expect(p.phases).toHaveLength(1);
        const phase = p.phases[0];
        expect(phase?.kind).toBe("convert");
        if (phase?.kind !== "convert") continue;
        expect(Number.isInteger(phase.value)).toBe(true);
        expect(Number.isInteger(phase.expected)).toBe(true);
        expect(phase.value).toBeGreaterThan(0);
        expect(phase.expected).toBeGreaterThan(0);
        // Prose carries the source value, "Pretvori N <from> u <to>.".
        expect(t.renderProse(p)).toContain(String(phase.value));
        expect(t.renderProse(p)).toContain(phase.fromUnit);
        expect(t.renderProse(p)).toContain(phase.toUnit);
      }
    });
  }

  it("kg → g multiplies by 1000 with kg ≤ 5", () => {
    const t = TEMPLATES.convert_kg_to_g as WordTemplate;
    for (let i = 0; i < ITER; i++) {
      const p = t.generate();
      const phase = p.phases[0];
      if (phase?.kind !== "convert") throw new Error("expected convert");
      expect(phase.value).toBeLessThanOrEqual(5);
      expect(phase.value).toBeGreaterThanOrEqual(1);
      expect(phase.expected).toBe(phase.value * 1000);
    }
  });

  it("g → kg divides by 1000 with kg ≤ 5", () => {
    const t = TEMPLATES.convert_g_to_kg as WordTemplate;
    for (let i = 0; i < ITER; i++) {
      const p = t.generate();
      const phase = p.phases[0];
      if (phase?.kind !== "convert") throw new Error("expected convert");
      expect(phase.value % 1000).toBe(0);
      expect(phase.expected).toBe(phase.value / 1000);
      expect(phase.expected).toBeLessThanOrEqual(5);
    }
  });

  it("dag ↔ g and dag ↔ kg and kg ↔ t all round-trip on whole numbers", () => {
    const checks: Array<[string, number, "expand" | "compress"]> = [
      ["convert_kg_to_dag", 100, "expand"],
      ["convert_dag_to_kg", 100, "compress"],
      ["convert_dag_to_g", 10, "expand"],
      ["convert_g_to_dag", 10, "compress"],
      ["convert_t_to_kg", 1000, "expand"],
      ["convert_kg_to_t", 1000, "compress"],
    ];
    for (const [id, factor, dir] of checks) {
      const t = TEMPLATES[id] as WordTemplate;
      for (let i = 0; i < ITER; i++) {
        const p = t.generate();
        const phase = p.phases[0];
        if (phase?.kind !== "convert") throw new Error("expected convert");
        if (dir === "expand") {
          expect(phase.expected).toBe(phase.value * factor);
        } else {
          expect(phase.value % factor).toBe(0);
          expect(phase.expected).toBe(phase.value / factor);
        }
      }
    }
  });
});

describe("findTemplate", () => {
  it("returns each template by its id", () => {
    for (const id of Object.keys(TEMPLATES)) {
      expect(findTemplate(id)?.id).toBe(id);
    }
  });

  it("returns undefined for unknown ids", () => {
    expect(findTemplate("nope")).toBeUndefined();
  });
});

describe("template registry coverage", () => {
  it("includes 20 templates across 5 types (4 arith + 1 convert)", () => {
    expect(Object.keys(TEMPLATES)).toHaveLength(20);
    expect(TEMPLATES_BY_TYPE.vocab).toHaveLength(2);
    expect(TEMPLATES_BY_TYPE.missing).toHaveLength(4);
    expect(TEMPLATES_BY_TYPE.compound).toHaveLength(4);
    expect(TEMPLATES_BY_TYPE.story).toHaveLength(2);
    expect(TEMPLATES_BY_TYPE.convert).toHaveLength(8);
  });

  it("every template id is unique", () => {
    const ids = Object.values(TEMPLATES).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
