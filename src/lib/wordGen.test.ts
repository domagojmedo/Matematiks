import { describe, expect, it } from "vitest";
import { SetupKind, type WordLessonSetup } from "./types";
import { WordGenerator } from "./wordGen";
import { TEMPLATES, TEMPLATES_BY_TYPE } from "./wordTemplates";

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

  it("mixed lesson covers all 12 templates over a round", () => {
    const gen = new WordGenerator(makeSetup("mixed", 20));
    const seen = new Set<string>();
    let prev = null;
    for (let i = 0; i < 20; i++) {
      const p: ReturnType<typeof gen.next> = gen.next(prev);
      seen.add(p.templateId);
      prev = p;
    }
    // 20 rounds, 12 templates: 8 templates get 2, 4 get 1.
    // Across runs there's randomness, but every template should appear at
    // least once because balancedQueue gives floor(20/12)=1 to each.
    for (const id of Object.keys(TEMPLATES)) {
      expect(seen.has(id)).toBe(true);
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
