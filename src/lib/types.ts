export type Operation = "add" | "sub" | "addsub" | "mul" | "div" | "muldiv";

/**
 * Discriminator constants. The TS-idiomatic alternative to `enum`: an
 * `as const` object gives a runtime namespace AND a literal-union type via
 * `typeof`. Single source of truth — every other module references these
 * rather than the underlying string literals.
 */
export const LessonKind = {
  Arith: "arith",
  Word: "word",
} as const;
export type LessonKindValue = (typeof LessonKind)[keyof typeof LessonKind];

export const SetupKind = {
  Range: "range",
  Multiplicands: "multiplicands",
  Word: "word",
} as const;
export type SetupKindValue = (typeof SetupKind)[keyof typeof SetupKind];

export type PracticeFormat = "horizontal" | "column";

export type OperationSetup =
  | {
      kind: typeof SetupKind.Range;
      min: number;
      max: number;
      min2?: number;
      max2?: number;
      crossesTen?: "never" | "always" | "any";
      format?: PracticeFormat;
      guide?: boolean;
      rounds: number;
      timeMs?: number;
    }
  | {
      kind: typeof SetupKind.Multiplicands;
      values: number[];
      values2?: number[];
      format?: PracticeFormat;
      guide?: boolean;
      rounds: number;
      timeMs?: number;
    };

export type WordKind =
  | "vocab"
  | "missing"
  | "compound"
  | "story"
  | "mixed"
  | "convert";

export type WordLessonSetup = {
  kind: typeof SetupKind.Word;
  wordKind: WordKind;
  rounds: number;
  timeMs?: number;
};

export type AnyLessonSetup = OperationSetup | WordLessonSetup;

/** Single source of truth for "is this a word-lesson setup?". */
export function isWordSetup(setup: AnyLessonSetup): setup is WordLessonSetup {
  return setup.kind === SetupKind.Word;
}

export type ThemeKey = "warmPurple" | "coral" | "teal" | "indigoPlum";

export type Profile = {
  id: string;
  name: string;
};

export type Language = "hr" | "en";

export type AppSettings = {
  themeKey: ThemeKey;
  dark: boolean;
  language: Language;
  voiceInput?: boolean;
  /**
   * Use the on-device Whisper recognizer instead of the browser's Web Speech
   * API. Trades a ~40 MB first-load model download for a continuous-stream
   * mic pipeline that doesn't cycle on Android Chrome. Defaults off.
   */
  useWhisper?: boolean;
};

/**
 * One input attempt within a problem. For arith problems with a single answer
 * phase there is one attempt per try; for word problems / column problems with
 * multiple phases (pickOp + answer, partial products, etc.) there is one
 * attempt per try per phase. Both correct and incorrect attempts are recorded.
 */
export type ProblemAttempt = {
  phaseIndex: number;
  phaseKind: string;
  given: number | "+" | "-" | "*" | "/";
  expected: number | "+" | "-" | "*" | "/";
  correct: boolean;
  /** ms since round start */
  atMs: number;
};

export type ProblemRecord = {
  // Primary equation values. For word problems, these reflect the *final*
  // calculation step (so legacy summary code that reads a/b/op/answer still
  // shows something sensible). The full prose can be re-rendered from the
  // word-only fields below.
  a: number;
  b: number;
  op: "+" | "-" | "*" | "/";
  answer: number;
  userAnswer: number;
  tookMs: number;
  retries: number;
  /**
   * ms since round start when this problem started. With per-attempt `atMs`,
   * this lets the SessionDetail timeline place every event on a unified axis
   * — both the problem's own duration and each attempt within it.
   * Optional for legacy compat with sessions written before this field existed.
   */
  startedAtMs?: number;
  /**
   * Per-attempt log. Populated for new sessions; absent on legacy records,
   * which the SessionDetail view degrades gracefully for.
   */
  attempts?: ProblemAttempt[];
  /** Set on word-problem records only. */
  kind?: typeof SetupKind.Word;
  templateId?: string;
  /** Numbers used to render the prose (e.g. [10, 6] for a story problem). */
  numbers?: number[];
  /** Names / nouns picked for the prose, keyed by template variable name. */
  vars?: Record<string, string>;
};

/** Single source of truth for "is this a word-problem record?". */
export function isWordRecord(record: ProblemRecord): boolean {
  return record.kind === SetupKind.Word;
}

export type SessionRecord = {
  id: string;
  date: string;
  operation: Operation;
  setup: AnyLessonSetup;
  /** Set when the round was launched from a grade lesson. */
  lessonId?: string;
  correct: number;
  mistakes: number;
  durationMs: number;
  bestStreak: number;
  problems: ProblemRecord[];
};

export type LastSession = {
  operation: Operation;
  setup: AnyLessonSetup;
  /** Carries the lesson tag forward to Quick Start replays. */
  lessonId?: string;
};
