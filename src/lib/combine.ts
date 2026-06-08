import { type ArithLesson, isWordLesson, type Lesson } from "./lessons";
import { generateProblem } from "./problemGen";
import { SetupKind, type WordKind, type WordLessonSetup } from "./types";
import { TEMPLATES_BY_TYPE, type WordTemplate } from "./wordTemplates";
import type { WordPhase } from "./wordTypes";

const COMBINED_ROUNDS = 20;

/**
 * Adapt an arithmetic lesson into a single-phase word template. The arithmetic
 * problem `a op b = ?` IS a word `answer` phase, so any add/sub/mul/div lesson
 * can join a combined round. Note: written-column lessons lose their
 * carry/borrow scaffold here and render as a plain horizontal equation — an
 * accepted trade-off for mixed practice.
 */
export function arithWordTemplate(lesson: ArithLesson): WordTemplate {
  const id = `arith_${lesson.id}`;
  return {
    id,
    // `type` is vestigial for adapter templates — they're only ever used via an
    // explicit pool, never resolved through TEMPLATES_BY_TYPE.
    type: "vocab",
    generate: () => {
      const p = generateProblem(lesson.op, lesson.setup, null);
      const phases: WordPhase[] = [
        {
          kind: "answer",
          slot: "result",
          a: p.a,
          b: p.b,
          op: p.op,
          result: p.answer,
          expected: p.answer,
        },
      ];
      return { templateId: id, numbers: [p.a, p.b], phases };
    },
    renderProse: () => "Izračunaj.",
  };
}

/**
 * The pooled template list for a set of selected lessons: word/convert lessons
 * contribute their registered templates (de-duplicated); arithmetic lessons
 * contribute a one-phase adapter. This is what lets a combined round mix ANY
 * lesson types.
 */
export function templatesForLessons(lessons: Lesson[]): WordTemplate[] {
  const seen = new Set<string>();
  const pool: WordTemplate[] = [];
  const add = (t: WordTemplate) => {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      pool.push(t);
    }
  };
  for (const lesson of lessons) {
    if (isWordLesson(lesson)) {
      for (const kind of lesson.wordKinds) {
        for (const t of TEMPLATES_BY_TYPE[kind]) add(t);
      }
    } else {
      add(arithWordTemplate(lesson));
    }
  }
  return pool;
}

/**
 * Build the combined round's setup from selected lessons of ANY kind. Carries
 * `lessonIds` so WordPractice can rebuild the (function-bearing) template pool
 * on the other side of router navigation, where only plain data survives.
 */
export function combinedSetup(lessons: Lesson[]): WordLessonSetup {
  const wordKinds: WordKind[] = [];
  const seenKind = new Set<WordKind>();
  let maxNumber: number | undefined;
  for (const lesson of lessons) {
    if (!isWordLesson(lesson)) continue;
    for (const kind of lesson.wordKinds) {
      if (!seenKind.has(kind)) {
        seenKind.add(kind);
        wordKinds.push(kind);
      }
    }
    const m = lesson.setup.maxNumber;
    if (m !== undefined) maxNumber = Math.max(maxNumber ?? 0, m);
  }
  return {
    kind: SetupKind.Word,
    wordKinds,
    rounds: COMBINED_ROUNDS,
    lessonIds: lessons.map((l) => l.id),
    ...(maxNumber !== undefined ? { maxNumber } : {}),
  };
}
