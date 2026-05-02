import type { Operation } from "./types";

export const OPERATIONS: Operation[] = [
  "add",
  "sub",
  "addsub",
  "mul",
  "div",
  "muldiv",
];

export const OPERATION_SYMBOL: Record<Operation, string> = {
  add: "+",
  sub: "−",
  addsub: "+−",
  mul: "×",
  div: "÷",
  muldiv: "×÷",
};

export type Tone = "violet" | "rose" | "amber" | "emerald" | "sky" | "fuchsia";

export const OPERATION_TONE: Record<Operation, Tone> = {
  add: "violet",
  sub: "rose",
  addsub: "fuchsia",
  mul: "amber",
  div: "emerald",
  muldiv: "sky",
};

export const TONE_CHIP: Record<Tone, string> = {
  violet:
    "bg-violet-100 text-violet-700 ring-violet-300 dark:bg-violet-900/40 dark:text-violet-200 dark:ring-violet-700",
  rose: "bg-rose-100 text-rose-700 ring-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:ring-rose-700",
  amber:
    "bg-amber-100 text-amber-700 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-700",
  emerald:
    "bg-emerald-100 text-emerald-700 ring-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-700",
  sky: "bg-sky-100 text-sky-700 ring-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700",
  fuchsia:
    "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-300 dark:bg-fuchsia-900/40 dark:text-fuchsia-200 dark:ring-fuchsia-700",
};

export function isValidOperation(s: string): s is Operation {
  return (OPERATIONS as readonly string[]).includes(s);
}
