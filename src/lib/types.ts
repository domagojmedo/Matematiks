export type Operation = "add" | "sub" | "addsub" | "mul" | "div" | "muldiv";

export type PracticeFormat = "horizontal" | "column";

export type OperationSetup =
  | {
      kind: "range";
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
      kind: "multiplicands";
      values: number[];
      values2?: number[];
      format?: PracticeFormat;
      guide?: boolean;
      rounds: number;
      timeMs?: number;
    };

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
};

export type ProblemRecord = {
  a: number;
  b: number;
  op: "+" | "-" | "*" | "/";
  answer: number;
  userAnswer: number;
  tookMs: number;
  retries: number;
};

export type SessionRecord = {
  id: string;
  date: string;
  operation: Operation;
  setup: OperationSetup;
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
  setup: OperationSetup;
  /** Carries the lesson tag forward to Quick Start replays. */
  lessonId?: string;
};
