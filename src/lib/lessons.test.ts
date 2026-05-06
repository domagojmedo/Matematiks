import { describe, expect, it } from "vitest";
import en from "../i18n/locales/en.json";
import hr from "../i18n/locales/hr.json";
import { findLesson, GRADES, isValidGrade, LESSONS, lessonsByGrade } from "./lessons";
import { generateProblem } from "./problemGen";

function resolveKey(bundle: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object" && part in (acc as Record<string, unknown>)
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      bundle,
    );
}

describe("lessons catalog integrity", () => {
  it("has unique lesson ids", () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has at least one lesson for every advertised grade", () => {
    for (const g of GRADES) {
      expect(lessonsByGrade(g).length).toBeGreaterThan(0);
    }
  });

  it("every nameKey resolves to a string in hr and en", () => {
    for (const lesson of LESSONS) {
      const hrValue = resolveKey(hr, lesson.nameKey);
      const enValue = resolveKey(en, lesson.nameKey);
      expect(typeof hrValue).toBe("string");
      expect(typeof enValue).toBe("string");
    }
  });

  it("every grade chip name resolves in hr and en", () => {
    for (const g of GRADES) {
      expect(typeof resolveKey(hr, `grades.g${g}`)).toBe("string");
      expect(typeof resolveKey(en, `grades.g${g}`)).toBe("string");
    }
  });

  it("every setup is structurally valid", () => {
    for (const lesson of LESSONS) {
      expect(lesson.setup.rounds).toBeGreaterThan(0);
      if (lesson.setup.kind === "range") {
        expect(lesson.setup.min).toBeLessThan(lesson.setup.max);
      } else {
        expect(lesson.setup.values.length).toBeGreaterThan(0);
        if (lesson.setup.values2 !== undefined) {
          expect(lesson.setup.values2.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("operation matches setup kind", () => {
    for (const lesson of LESSONS) {
      const needsRange =
        lesson.op === "add" || lesson.op === "sub" || lesson.op === "addsub";
      const needsMultiplicands =
        lesson.op === "mul" || lesson.op === "div" || lesson.op === "muldiv";
      if (needsRange) expect(lesson.setup.kind).toBe("range");
      if (needsMultiplicands) expect(lesson.setup.kind).toBe("multiplicands");
    }
  });

  it("findLesson returns the matching lesson by id", () => {
    expect(findLesson("g2-mul-5")?.op).toBe("mul");
    expect(findLesson("g3-add-1000")?.grade).toBe(3);
    expect(findLesson("nonexistent")).toBeUndefined();
  });

  it("isValidGrade accepts 1-4 only", () => {
    expect(isValidGrade("1")).toBe(true);
    expect(isValidGrade("4")).toBe(true);
    expect(isValidGrade("0")).toBe(false);
    expect(isValidGrade("5")).toBe(false);
    expect(isValidGrade("foo")).toBe(false);
  });
});

describe("g1 no-cross lessons exercise the teens", () => {
  it("g1-add-20-no-cross keeps a in [11,19] and answer in [12,19]", () => {
    const lesson = findLesson("g1-add-20-no-cross");
    expect(lesson).toBeDefined();
    if (!lesson) return;
    for (let i = 0; i < 100; i++) {
      const p = generateProblem(lesson.op, lesson.setup);
      expect(p.a).toBeGreaterThanOrEqual(11);
      expect(p.a).toBeLessThanOrEqual(19);
      expect(p.b).toBeGreaterThanOrEqual(1);
      expect(p.b).toBeLessThanOrEqual(9);
      expect(p.answer).toBeGreaterThanOrEqual(12);
      expect(p.answer).toBeLessThanOrEqual(19);
    }
  });

  it("g1-sub-20-no-cross keeps a in [11,19] and answer in [10,18]", () => {
    const lesson = findLesson("g1-sub-20-no-cross");
    expect(lesson).toBeDefined();
    if (!lesson) return;
    for (let i = 0; i < 100; i++) {
      const p = generateProblem(lesson.op, lesson.setup);
      expect(p.a).toBeGreaterThanOrEqual(11);
      expect(p.a).toBeLessThanOrEqual(19);
      expect(p.b).toBeGreaterThanOrEqual(1);
      expect(p.b).toBeLessThanOrEqual(9);
      expect(p.answer).toBeGreaterThanOrEqual(10);
      expect(p.answer).toBeLessThanOrEqual(18);
    }
  });
});
