import { type ArithLesson, isWordLesson, type Lesson } from "./lessons";
import { generateProblem, type Problem } from "./problemGen";
import { SetupKind, type WordKind, type WordLessonSetup } from "./types";
import { TEMPLATES_BY_TYPE, type WordTemplate } from "./wordTemplates";
import type { GenContext, WordProblem } from "./wordTypes";

const COMBINED_ROUNDS = 20;

/**
 * One question in a combined multi-select round, tagged so the host renders it
 * with its native component — a word problem renders in the word engine, an
 * arithmetic problem in the horizontal or written-column UI, exactly as it
 * would standalone.
 */
export type RoundQuestion =
  | { kind: "word"; problem: WordProblem }
  | {
      kind: "arith";
      problem: Problem;
      format: "horizontal" | "column";
      guide: boolean;
    };

type Source =
  | { kind: "word"; template: WordTemplate }
  | { kind: "arith"; lesson: ArithLesson };

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * Generator for a combined round. Pools each selected lesson into sources —
 * word/convert lessons contribute their templates, arithmetic lessons
 * contribute themselves — and emits a tagged `RoundQuestion` per draw, cycling
 * through all sources (shuffled) for an even mix.
 */
export class CombinedGenerator {
  private readonly sources: Source[] = [];
  private readonly ctx: GenContext | undefined;
  private queue: Source[] = [];

  constructor(lessons: Lesson[], setup: WordLessonSetup) {
    this.ctx =
      setup.maxNumber !== undefined
        ? { maxNumber: setup.maxNumber }
        : undefined;
    const seen = new Set<string>();
    for (const lesson of lessons) {
      if (isWordLesson(lesson)) {
        for (const kind of lesson.wordKinds) {
          for (const t of TEMPLATES_BY_TYPE[kind]) {
            if (!seen.has(`w:${t.id}`)) {
              seen.add(`w:${t.id}`);
              this.sources.push({ kind: "word", template: t });
            }
          }
        }
      } else if (!seen.has(`a:${lesson.id}`)) {
        seen.add(`a:${lesson.id}`);
        this.sources.push({ kind: "arith", lesson });
      }
    }
  }

  next(): RoundQuestion {
    if (this.queue.length === 0) {
      this.queue = shuffle(this.sources);
    }
    const src = this.queue.shift() as Source;
    if (src.kind === "word") {
      return { kind: "word", problem: src.template.generate(this.ctx) };
    }
    return {
      kind: "arith",
      problem: generateProblem(src.lesson.op, src.lesson.setup, null),
      format: src.lesson.setup.format === "column" ? "column" : "horizontal",
      guide: src.lesson.setup.guide ?? true,
    };
  }
}

/**
 * Build the combined round's setup from selected lessons of ANY kind. Carries
 * `lessonIds` so the round can rebuild the generator on the other side of
 * router navigation, where only plain data survives.
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
