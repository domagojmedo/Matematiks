import { describe, expect, it } from "vitest";
import en from "../i18n/locales/en.json";
import hr from "../i18n/locales/hr.json";
import {
  findLesson,
  GRADES,
  isArithLesson,
  isValidGrade,
  isWordLesson,
  LESSONS,
  type Lesson,
  lessonsByGrade,
} from "./lessons";
import { generateProblem } from "./problemGen";
import { type Language, LessonKind, SetupKind } from "./types";

function resolveKey(bundle: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc &&
        typeof acc === "object" &&
        part in (acc as Record<string, unknown>)
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      bundle,
    );
}

function isVisibleIn(lesson: Lesson, lang: Language): boolean {
  return !lesson.languages || lesson.languages.includes(lang);
}

describe("lessons catalog integrity", () => {
  it("has unique lesson ids", () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has at least one lesson for every advertised grade in HR", () => {
    for (const g of GRADES) {
      expect(lessonsByGrade(g, "hr").length).toBeGreaterThan(0);
    }
  });

  it("nameKey resolves to a string in every language the lesson is visible in", () => {
    for (const lesson of LESSONS) {
      if (isVisibleIn(lesson, "hr")) {
        expect(typeof resolveKey(hr, lesson.nameKey)).toBe("string");
      }
      if (isVisibleIn(lesson, "en")) {
        expect(typeof resolveKey(en, lesson.nameKey)).toBe("string");
      }
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
      } else if (lesson.setup.kind === "multiplicands") {
        expect(lesson.setup.values.length).toBeGreaterThan(0);
        if (lesson.setup.values2 !== undefined) {
          expect(lesson.setup.values2.length).toBeGreaterThan(0);
        }
      } else {
        // word lesson — wordKinds matches its parent and is non-empty
        expect(lesson.kind).toBe(LessonKind.Word);
        if (isWordLesson(lesson)) {
          expect(lesson.setup.wordKinds).toEqual(lesson.wordKinds);
          expect(lesson.wordKinds.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("arith lesson op matches setup kind", () => {
    const ariths = LESSONS.filter(isArithLesson);
    for (const lesson of ariths) {
      const needsRange =
        lesson.op === "add" || lesson.op === "sub" || lesson.op === "addsub";
      const needsMultiplicands =
        lesson.op === "mul" || lesson.op === "div" || lesson.op === "muldiv";
      if (needsRange) expect(lesson.setup.kind).toBe(SetupKind.Range);
      if (needsMultiplicands)
        expect(lesson.setup.kind).toBe(SetupKind.Multiplicands);
    }
  });

  it("findLesson returns the matching lesson by id", () => {
    const mul5 = findLesson("g2-mul-5");
    expect(mul5?.kind).toBe(LessonKind.Arith);
    if (isArithLesson(mul5)) expect(mul5.op).toBe("mul");
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

  it("word lessons are HR-only and hidden in EN", () => {
    const word = LESSONS.filter(isWordLesson);
    expect(word.length).toBeGreaterThan(0);
    for (const w of word) {
      expect(w.languages).toEqual(["hr"]);
    }
    const enG1Ids = lessonsByGrade(1, "en").map((l) => l.id);
    for (const w of word) {
      expect(enG1Ids).not.toContain(w.id);
    }
  });
});

describe("g1 no-cross lessons exercise the teens", () => {
  it("g1-add-20-no-cross keeps a in [11,19] and answer in [12,19]", () => {
    const lesson = findLesson("g1-add-20-no-cross");
    expect(lesson?.kind).toBe(LessonKind.Arith);
    if (!isArithLesson(lesson)) return;
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
    expect(lesson?.kind).toBe(LessonKind.Arith);
    if (!isArithLesson(lesson)) return;
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
