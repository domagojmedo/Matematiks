import { describe, expect, it } from "vitest";
import type { WordTemplate } from "./wordTemplates";
import { TEMPLATES } from "./wordTemplates";
import {
  buildSteps,
  finalAnswerPhase,
  finalInputPhase,
  phaseAtStep,
  totalAnswerPhases,
  type WordPhase,
} from "./wordTypes";

describe("totalAnswerPhases", () => {
  it("counts only answer phases", () => {
    const phases: WordPhase[] = [
      { kind: "pickOp", a: 1, b: 2, expected: "+" },
      {
        kind: "answer",
        slot: "result",
        a: 1,
        b: 2,
        op: "+",
        result: 3,
        expected: 3,
      },
      { kind: "pickOp", a: 3, b: 4, expected: "-" },
      {
        kind: "answer",
        slot: "result",
        a: 3,
        b: 4,
        op: "-",
        result: -1,
        expected: -1,
      },
    ];
    expect(totalAnswerPhases({ templateId: "x", numbers: [], phases })).toBe(2);
  });
});

describe("finalAnswerPhase", () => {
  it("returns the last answer phase", () => {
    const phases: WordPhase[] = [
      {
        kind: "answer",
        slot: "result",
        a: 1,
        b: 2,
        op: "+",
        result: 3,
        expected: 3,
      },
      {
        kind: "answer",
        slot: "result",
        a: 5,
        b: 5,
        op: "-",
        result: 0,
        expected: 0,
      },
    ];
    const final = finalAnswerPhase({ templateId: "x", numbers: [], phases });
    expect(final.result).toBe(0);
  });

  it("throws when no answer phase exists (generator bug)", () => {
    expect(() =>
      finalAnswerPhase({
        templateId: "x",
        numbers: [],
        phases: [{ kind: "pickOp", a: 1, b: 2, expected: "+" }],
      }),
    ).toThrow();
  });
});

describe("buildSteps groups phases into equation lines", () => {
  it("a vocab problem produces one step with pickOp + answer paired", () => {
    const t = TEMPLATES.vocab_sum as WordTemplate;
    const p = t.generate();
    const steps = buildSteps(p.phases);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.pickOpIdx).toBe(0);
    expect(steps[0]?.answerIdx).toBe(1);
  });

  it("a missing-operand problem produces one step with no pickOp", () => {
    const t = TEMPLATES.missing_first_addend as WordTemplate;
    const p = t.generate();
    const steps = buildSteps(p.phases);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.pickOpIdx).toBeNull();
    expect(steps[0]?.answerIdx).toBe(0);
  });

  it("a compound problem produces 2 steps each pairing pickOp + answer", () => {
    const t = TEMPLATES.compound_diff_plus as WordTemplate;
    const p = t.generate();
    const steps = buildSteps(p.phases);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ pickOpIdx: 0, answerIdx: 1 });
    expect(steps[1]).toMatchObject({ pickOpIdx: 2, answerIdx: 3 });
  });

  it("a story problem propagates step labels onto the right step", () => {
    const t = TEMPLATES.story_fewer as WordTemplate;
    const p = t.generate();
    const steps = buildSteps(p.phases);
    expect(steps).toHaveLength(2);
    // Both story sub-questions have labels.
    expect(steps[0]?.label).toMatch(
      /Tomo|Maro|Ivan|Marko|Luka|Ana|Lana|Iva|Ema|Mia/,
    );
    expect(steps[1]?.label).toMatch(/zajedno/);
  });

  it("treats a solve phase as a step terminator and carries its label", () => {
    const phases: WordPhase[] = [
      { kind: "solve", expected: 50, prompt: "stotice", stepLabel: "Stotice" },
      { kind: "solve", expected: 7, prompt: "jedinice", stepLabel: "Jedinice" },
    ];
    const steps = buildSteps(phases);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ pickOpIdx: null, answerIdx: 0 });
    expect(steps[0]?.label).toBe("Stotice");
    expect(steps[1]?.label).toBe("Jedinice");
  });

  it("phaseAtStep returns a solve phase; finalInputPhase finds it", () => {
    const phases: WordPhase[] = [{ kind: "solve", expected: 40 }];
    const steps = buildSteps(phases);
    const phase = phaseAtStep(phases, steps[0] as (typeof steps)[number]);
    expect(phase.kind).toBe("solve");
    const final = finalInputPhase({ templateId: "x", numbers: [], phases });
    expect(final.kind).toBe("solve");
    if (final.kind === "solve") expect(final.expected).toBe(40);
  });

  it("treats every answer phase as a step terminator", () => {
    const phases: WordPhase[] = [
      {
        kind: "answer",
        slot: "a",
        a: 5,
        b: 3,
        op: "+",
        result: 8,
        expected: 5,
      },
      {
        kind: "answer",
        slot: "result",
        a: 1,
        b: 2,
        op: "+",
        result: 3,
        expected: 3,
      },
    ];
    const steps = buildSteps(phases);
    expect(steps).toHaveLength(2);
    expect(steps[0]?.pickOpIdx).toBeNull();
    expect(steps[1]?.pickOpIdx).toBeNull();
  });
});
