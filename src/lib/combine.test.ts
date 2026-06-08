import { describe, expect, it } from "vitest";
import { CombinedGenerator, combinedSetup } from "./combine";
import { findLesson, type Lesson } from "./lessons";

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

describe("CombinedGenerator", () => {
  it("mixes native arith and word questions, tagged by kind", () => {
    const lessons = [get("g3-add-1000"), get("g3-units-mass")];
    const gen = new CombinedGenerator(lessons, combinedSetup(lessons));
    const kinds = new Set<string>();
    let sawColumnArith = false;
    let sawWord = false;
    for (let i = 0; i < 60; i++) {
      const q = gen.next();
      kinds.add(q.kind);
      if (q.kind === "arith") {
        // g3-add-1000 is a written-column lesson → rendered as column natively.
        expect(q.format).toBe("column");
        expect(Number.isInteger(q.problem.answer)).toBe(true);
        sawColumnArith = true;
      } else {
        expect(q.problem.phases.length).toBeGreaterThan(0);
        sawWord = true;
      }
    }
    expect(kinds.has("arith")).toBe(true);
    expect(kinds.has("word")).toBe(true);
    expect(sawColumnArith).toBe(true);
    expect(sawWord).toBe(true);
  });

  it("a horizontal arith lesson stays horizontal in the mix", () => {
    const lessons = [get("g1-add-10"), get("g3-units-mass")];
    const gen = new CombinedGenerator(lessons, combinedSetup(lessons));
    for (let i = 0; i < 40; i++) {
      const q = gen.next();
      if (q.kind === "arith") expect(q.format).toBe("horizontal");
    }
  });
});
