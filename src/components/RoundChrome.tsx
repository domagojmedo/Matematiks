import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TONE_CHIP, type Tone } from "../lib/operations";
import type { Theme } from "../lib/themes";
import { Mascot } from "./Mascot";
import { CounterStrip, LeaveModal, ProgressBar } from "./PracticeUI";

export type Flash = "correct" | "wrong" | null;

/** Full-screen background wash for the current flash state. */
export function flashBgClass(
  flash: Flash,
  dark: boolean,
  theme: Theme,
): string {
  if (flash === "correct") return "bg-emerald-50 dark:bg-emerald-950/60";
  if (flash === "wrong") return "bg-rose-50 dark:bg-rose-950/60";
  return dark ? theme.pageBgDark : theme.pageBg;
}

/**
 * The shared outer chrome every practice round wears: flash wash, header
 * (back / lesson chip / timer), the counter strip, and the leave modal. The
 * round body + input pad are passed as `children`. Previously copy-pasted
 * across the horizontal / column / word screens.
 */
export function RoundFrame({
  flash,
  dark,
  theme,
  onBack,
  chip,
  timeText,
  correct,
  mistakes,
  streak,
  showLeaveModal,
  onStay,
  onLeave,
  children,
}: {
  flash: Flash;
  dark: boolean;
  theme: Theme;
  onBack: () => void;
  chip: { tone: Tone; symbol: string; label: string; summary?: string };
  timeText: string;
  correct: number;
  mistakes: number;
  streak: number;
  showLeaveModal: boolean;
  onStay: () => void;
  onLeave: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex min-h-dvh w-full flex-col transition-colors ${flashBgClass(
        flash,
        dark,
        theme,
      )}`}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col sm:justify-center sm:py-6">
        <header className="flex items-center justify-between px-4 pt-5 pb-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("common.back")}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800"
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-stone-700 dark:text-stone-200"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <div className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm leading-none font-black ring-2 ${TONE_CHIP[chip.tone]}`}
            >
              {chip.symbol}
            </span>
            <span className="text-sm font-black text-stone-900 dark:text-white">
              {chip.label}
            </span>
            {chip.summary && (
              <span className="hidden text-xs font-bold text-stone-500 tabular-nums sm:inline dark:text-stone-400">
                · {chip.summary}
              </span>
            )}
          </div>
          <div className="flex h-12 min-w-[3.5rem] items-center justify-center rounded-2xl bg-white px-3 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
            <span className="text-sm font-black text-stone-900 tabular-nums dark:text-white">
              {timeText}
            </span>
          </div>
        </header>

        <CounterStrip correct={correct} mistakes={mistakes} streak={streak} />

        {children}
      </div>

      {showLeaveModal && (
        <LeaveModal theme={theme} onStay={onStay} onLeave={onLeave} />
      )}
    </div>
  );
}

/**
 * The middle band shared by every round: the problem area (with the
 * cheer/sad mascot on flash), the progress bar, and the problem-number line.
 * Question components render their body as `children` and their input pad as a
 * sibling after the scaffold.
 */
export function QuestionScaffold({
  flash,
  theme,
  progressRatio,
  problemLabel,
  children,
}: {
  flash: Flash;
  theme: Theme;
  progressRatio: number;
  problemLabel: string;
  children: ReactNode;
}) {
  return (
    <section
      className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-2 sm:flex-none sm:py-6"
      aria-live="polite"
    >
      {flash === "correct" && (
        <div className="absolute top-2 right-6">
          <Mascot size={56} mood="cheer" theme={theme} />
        </div>
      )}
      {flash === "wrong" && (
        <div className="absolute top-2 right-6">
          <Mascot size={56} mood="sad" theme={theme} />
        </div>
      )}

      {children}

      <ProgressBar ratio={progressRatio} theme={theme} />
      <p className="mt-2.5 text-xs font-bold text-stone-500 tabular-nums dark:text-stone-400">
        {problemLabel}
      </p>
    </section>
  );
}
