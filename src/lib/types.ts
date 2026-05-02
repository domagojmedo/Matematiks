export type Operation = "add" | "sub" | "addsub" | "mul" | "div" | "muldiv";

export type OperationSetup =
  | {
      kind: "range";
      min: number;
      max: number;
      min2?: number;
      max2?: number;
      rounds: number;
      timeMs?: number;
    }
  | {
      kind: "multiplicands";
      values: number[];
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
  fontScale: number;
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
  correct: number;
  mistakes: number;
  durationMs: number;
  bestStreak: number;
  problems: ProblemRecord[];
};

export type LastSession = {
  operation: Operation;
  setup: OperationSetup;
};
