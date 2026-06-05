import { describe, expect, it } from "vitest";
import { SetupKind, type WordLessonSetup } from "./types";
import { WordGenerator } from "./wordGen";
import { TEMPLATES_BY_TYPE } from "./wordTemplates";

function makeSetup(
  wordKind: WordLessonSetup["wordKind"],
  rounds = 20,
): WordLessonSetup {
  return { kind: SetupKind.Word, wordKind, rounds };
}

describe("WordGenerator", () => {
  it("vocab lesson stratifies across both vocab templates over a round", () => {
    const gen = new WordGenerator(makeSetup("vocab", 20));
    const counts: Record<string, number> = {};
    let prev = null;
    for (let i = 0; i < 20; i++) {
      const p: ReturnType<typeof gen.next> = gen.next(prev);
      counts[p.templateId] = (counts[p.templateId] ?? 0) + 1;
      prev = p;
    }
    // 20 rounds / 2 templates → 10 each, exact.
    for (const t of TEMPLATES_BY_TYPE.vocab) {
      expect(counts[t.id]).toBe(10);
    }
  });

  it("missing lesson stratifies across all 4 sub-templates", () => {
    const gen = new WordGenerator(makeSetup("missing", 20));
    const counts: Record<string, number> = {};
    let prev = null;
    for (let i = 0; i < 20; i++) {
      const p: ReturnType<typeof gen.next> = gen.next(prev);
      counts[p.templateId] = (counts[p.templateId] ?? 0) + 1;
      prev = p;
    }
    for (const t of TEMPLATES_BY_TYPE.missing) {
      expect(counts[t.id]).toBe(5);
    }
  });

  it("compound lesson stratifies across 4 templates", () => {
    const gen = new WordGenerator(makeSetup("compound", 20));
    const counts: Record<string, number> = {};
    let prev = null;
    for (let i = 0; i < 20; i++) {
      const p: ReturnType<typeof gen.next> = gen.next(prev);
      counts[p.templateId] = (counts[p.templateId] ?? 0) + 1;
      prev = p;
    }
    for (const t of TEMPLATES_BY_TYPE.compound) {
      expect(counts[t.id]).toBe(5);
    }
  });

  it("story lesson splits 10/10 between fewer and more", () => {
    const gen = new WordGenerator(makeSetup("story", 20));
    const counts: Record<string, number> = {};
    let prev = null;
    for (let i = 0; i < 20; i++) {
      const p: ReturnType<typeof gen.next> = gen.next(prev);
      counts[p.templateId] = (counts[p.templateId] ?? 0) + 1;
      prev = p;
    }
    for (const t of TEMPLATES_BY_TYPE.story) {
      expect(counts[t.id]).toBe(10);
    }
  });

  it("mixed lesson covers all 12 arith word templates over a round", () => {
    const gen = new WordGenerator(makeSetup("mixed", 20));
    const seen = new Set<string>();
    let prev = null;
    for (let i = 0; i < 20; i++) {
      const p: ReturnType<typeof gen.next> = gen.next(prev);
      seen.add(p.templateId);
      prev = p;
    }
    // "mixed" pools the four arith word-problem types (vocab/missing/
    // compound/story = 12 templates). Convert templates are deliberately
    // excluded — they're launched only from the dedicated convert lessons.
    const mixedIds = [
      ...TEMPLATES_BY_TYPE.vocab,
      ...TEMPLATES_BY_TYPE.missing,
      ...TEMPLATES_BY_TYPE.compound,
      ...TEMPLATES_BY_TYPE.story,
    ].map((t) => t.id);
    for (const id of mixedIds) {
      expect(seen.has(id)).toBe(true);
    }
    for (const t of [
      ...TEMPLATES_BY_TYPE.convertMass,
      ...TEMPLATES_BY_TYPE.convertVolume,
    ]) {
      expect(seen.has(t.id)).toBe(false);
    }
  });

  it("convertMass lesson stratifies across the 8 mass-conversion templates", () => {
    const gen = new WordGenerator(makeSetup("convertMass", 16));
    const counts: Record<string, number> = {};
    let prev = null;
    for (let i = 0; i < 16; i++) {
      const p: ReturnType<typeof gen.next> = gen.next(prev);
      counts[p.templateId] = (counts[p.templateId] ?? 0) + 1;
      prev = p;
    }
    // 16 rounds / 8 templates → exactly 2 each.
    for (const t of TEMPLATES_BY_TYPE.convertMass) {
      expect(counts[t.id]).toBe(2);
    }
  });

  it("convertVolume lesson stratifies across the 2 volume-conversion templates", () => {
    const gen = new WordGenerator(makeSetup("convertVolume", 16));
    const counts: Record<string, number> = {};
    let prev = null;
    for (let i = 0; i < 16; i++) {
      const p: ReturnType<typeof gen.next> = gen.next(prev);
      counts[p.templateId] = (counts[p.templateId] ?? 0) + 1;
      prev = p;
    }
    // 16 rounds / 2 templates → exactly 8 each.
    for (const t of TEMPLATES_BY_TYPE.convertVolume) {
      expect(counts[t.id]).toBe(8);
    }
  });

  it.each([
    ["convertLength", 10],
    ["convertMoney", 2],
    ["convertTime", 8],
  ] as const)("%s lesson only draws templates from its own family", (kind, size) => {
    expect(TEMPLATES_BY_TYPE[kind]).toHaveLength(size);
    const familyIds = new Set(TEMPLATES_BY_TYPE[kind].map((t) => t.id));
    const gen = new WordGenerator(makeSetup(kind, 30));
    let prev = null;
    for (let i = 0; i < 30; i++) {
      const p: ReturnType<typeof gen.next> = gen.next(prev);
      expect(familyIds.has(p.templateId)).toBe(true);
      prev = p;
    }
  });

  it("convertMix lesson pools both mass and volume conversions", () => {
    const gen = new WordGenerator(makeSetup("convertMix", 32));
    const seen = new Set<string>();
    let prev = null;
    for (let i = 0; i < 32; i++) {
      const p: ReturnType<typeof gen.next> = gen.next(prev);
      seen.add(p.templateId);
      prev = p;
    }
    for (const t of [
      ...TEMPLATES_BY_TYPE.convertMass,
      ...TEMPLATES_BY_TYPE.convertVolume,
    ]) {
      expect(seen.has(t.id)).toBe(true);
    }
  });

  it("never repeats the previous problem when the template lets it vary", () => {
    // Single-template pool to force the repeat-avoidance path.
    const gen = new WordGenerator(makeSetup("vocab", 50));
    let prev = null;
    let same = 0;
    for (let i = 0; i < 50; i++) {
      const p: ReturnType<typeof gen.next> = gen.next(prev);
      if (
        prev &&
        prev.templateId === p.templateId &&
        prev.numbers.length === p.numbers.length &&
        prev.numbers.every((n, j) => n === p.numbers[j])
      ) {
        same += 1;
      }
      prev = p;
    }
    // Allow a tiny number of unavoidable repeats; with two vocab templates and
    // 50 rounds this should essentially never trigger.
    expect(same).toBeLessThanOrEqual(1);
  });

  it("refills the queue past the planned round count (time mode)", () => {
    const gen = new WordGenerator(makeSetup("vocab", 4));
    const out = [];
    for (let i = 0; i < 12; i++) out.push(gen.next(null));
    expect(out).toHaveLength(12);
    for (const p of out) expect(p.templateId).toMatch(/^vocab_/);
  });
});
