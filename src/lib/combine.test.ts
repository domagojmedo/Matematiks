import { describe, expect, it } from "vitest";
import {
  arithWordTemplate,
  combinedSetup,
  templatesForLessons,
} from "./combine";
import { findLesson, isArithLesson, type Lesson } from "./lessons";

const get = (id: string): Lesson => {
  const l = findLesson(id);
  if (!l) throw new Error(`no lesson ${id}`);
  return l;
};

describe("combinedSetup", () => {
  it("unions word kinds and records every selected lesson id", () => {
    const setup = combinedSetup([get("g3-units-mass"), get("g3-units-volume")]);
    expect(setup.wordKinds).toEqual(["convertMass", "convertVolume"]);
    expect(setup.lessonIds).toEqual(["g3-units-mass", "g3-units-volume"]);
  });

  it("de-dupes a repeated kind and takes the largest maxNumber", () => {
    const setup = combinedSetup([get("g2-word-vocab"), get("g3-word-vocab")]);
    expect(setup.wordKinds).toEqual(["vocab"]);
    expect(setup.maxNumber).toBe(1000);
  });

  it("includes arith lessons by id but contributes no word kinds for them", () => {
    const setup = combinedSetup([get("g3-add-1000"), get("g3-units-mass")]);
    expect(setup.wordKinds).toEqual(["convertMass"]);
    expect(setup.lessonIds).toEqual(["g3-add-1000", "g3-units-mass"]);
  });
});

describe("arithWordTemplate", () => {
  it("adapts an arith lesson into a single correct answer phase", () => {
    const lesson = get("g3-add-1000");
    if (!isArithLesson(lesson)) throw new Error("expected arith");
    const t = arithWordTemplate(lesson);
    for (let i = 0; i < 100; i++) {
      const p = t.generate();
      expect(p.phases).toHaveLength(1);
      const phase = p.phases[0];
      if (phase?.kind !== "answer") throw new Error("expected answer");
      const computed =
        phase.op === "+"
          ? phase.a + phase.b
          : phase.op === "-"
            ? phase.a - phase.b
            : phase.op === "*"
              ? phase.a * phase.b
              : phase.a / phase.b;
      expect(computed).toBe(phase.result);
      expect(phase.expected).toBe(phase.result);
    }
  });
});

describe("templatesForLessons", () => {
  it("mixes arith adapters with word templates, de-duplicated", () => {
    const pool = templatesForLessons([
      get("g3-add-1000"), // arith → 1 adapter
      get("g3-units-mass"), // word → 8 mass templates
    ]);
    const ids = pool.map((t) => t.id);
    expect(ids).toContain("arith_g3-add-1000");
    expect(ids).toContain("convert_kg_to_g");
    // unique ids
    expect(new Set(ids).size).toBe(ids.length);
    // 1 arith adapter + 8 mass convert templates
    expect(pool).toHaveLength(9);
  });
});
