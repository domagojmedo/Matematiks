import { useTranslation } from "react-i18next";
import type { Theme } from "../lib/themes";

export function CounterStrip({
  correct,
  mistakes,
  streak,
}: {
  correct: number;
  mistakes: number;
  streak: number;
}) {
  const { t } = useTranslation();
  const cells = [
    {
      key: "correct" as const,
      v: correct,
      bg: "bg-emerald-100 ring-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:ring-emerald-800 dark:text-emerald-200",
      dot: "bg-emerald-500",
      label: t("practice.correct"),
    },
    {
      key: "mistakes" as const,
      v: mistakes,
      bg: "bg-rose-100 ring-rose-200 text-rose-700 dark:bg-rose-900/40 dark:ring-rose-800 dark:text-rose-200",
      dot: "bg-rose-500",
      label: t("practice.mistakes"),
    },
    {
      key: "streak" as const,
      v: streak,
      bg: "bg-amber-100 ring-amber-200 text-amber-700 dark:bg-amber-900/40 dark:ring-amber-800 dark:text-amber-200",
      dot: "bg-amber-500",
      label: t("practice.streak"),
    },
  ];
  return (
    <div className="mx-4 mb-4 grid grid-cols-3 gap-2.5">
      {cells.map((c) => (
        <div
          key={c.key}
          className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 ring-1 ${c.bg}`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full ${c.dot}`}
          >
            {c.key === "correct" && (
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
            {c.key === "mistakes" && (
              <svg
                aria-hidden="true"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            )}
            {c.key === "streak" && (
              <span className="text-base leading-none text-white">★</span>
            )}
          </div>
          <div>
            <p className="text-xl leading-none font-black tabular-nums">
              {c.v}
            </p>
            <p className="text-[10px] font-bold tracking-wider uppercase">
              {c.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ ratio, theme }: { ratio: number; theme: Theme }) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
      <div
        className={`h-full rounded-full transition-all duration-200 ${theme.primary}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function NumPad({
  onDigit,
  onDelete,
  onConfirm,
  confirmDisabled,
  theme,
}: {
  onDigit: (n: number) => void;
  onDelete: () => void;
  /**
   * Optional confirm callback. When provided, the empty bottom-left slot is
   * replaced with a confirm key — used by problems that require an explicit
   * "I'm done typing" gesture instead of auto-submitting on prefix match
   * (e.g. unit-conversion problems where 200 is a prefix of 2000).
   */
  onConfirm?: () => void;
  /** Greys out the confirm key when the typed buffer is empty. */
  confirmDisabled?: boolean;
  theme: Theme;
}) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return (
    <div className="px-4 pt-2 pb-3 sm:pb-5">
      <div className="grid grid-cols-3 gap-2.5">
        {digits.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onDigit(d)}
            className={`flex h-14 items-center justify-center rounded-2xl bg-white text-2xl sm:h-16 font-black text-stone-900 shadow-sm ring-1 ring-stone-200 transition tabular-nums hover:ring-stone-300 active:scale-95 focus:outline-none focus-visible:ring-4 dark:bg-stone-900 dark:text-white dark:ring-stone-800 dark:hover:ring-stone-700 ${theme.primaryFocus}`}
          >
            {d}
          </button>
        ))}
        {onConfirm ? (
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            aria-label="Confirm"
            className={`flex h-14 items-center justify-center rounded-2xl bg-emerald-500 text-white sm:h-16 shadow-sm ring-1 ring-emerald-600 transition hover:bg-emerald-600 active:scale-95 focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 disabled:ring-stone-200 disabled:hover:bg-stone-200 dark:bg-emerald-600 dark:ring-emerald-700 dark:hover:bg-emerald-500 dark:disabled:bg-stone-800 dark:disabled:text-stone-500 dark:disabled:ring-stone-700 dark:disabled:hover:bg-stone-800 ${theme.primaryFocus}`}
          >
            <svg
              aria-hidden="true"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
          </button>
        ) : (
          <div aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => onDigit(0)}
          className={`flex h-14 items-center justify-center rounded-2xl bg-white text-2xl sm:h-16 font-black text-stone-900 shadow-sm ring-1 ring-stone-200 transition tabular-nums hover:ring-stone-300 active:scale-95 focus:outline-none focus-visible:ring-4 dark:bg-stone-900 dark:text-white dark:ring-stone-800 dark:hover:ring-stone-700 ${theme.primaryFocus}`}
        >
          0
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete"
          className={`flex h-14 items-center justify-center rounded-2xl bg-stone-100 sm:h-16 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-200 active:scale-95 focus:outline-none focus-visible:ring-4 dark:bg-stone-800 dark:ring-stone-700 dark:hover:bg-stone-700 ${theme.primaryFocus}`}
        >
          <svg
            aria-hidden="true"
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-stone-700 dark:text-stone-200"
          >
            <path d="M21 5H9l-6 7 6 7h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
            <path d="M16 9l-6 6M10 9l6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function VoiceButton({
  listening,
  paused,
  speechActive,
  interim,
  error,
  onPress,
  theme,
}: {
  listening: boolean;
  /** True when the kid has tapped to mute auto-listen. */
  paused: boolean;
  /** True while the engine reports detectable speech in the mic input. */
  speechActive: boolean;
  interim: string;
  error: string | null;
  onPress: () => void;
  theme: Theme;
}) {
  const { t } = useTranslation();
  const active = !paused && !error;
  const showInterim = active && interim.length > 0;
  // Label priority: error → live interim transcript → "Tap for microphone"
  // when muted → "Listening…" otherwise. The optimistic "Listening…" sticks
  // even between engine sessions so the brief idle gap during auto-restart
  // doesn't flicker the label.
  const label = error
    ? error
    : showInterim
      ? interim
      : paused
        ? t("voice.paused")
        : t("voice.listening");
  const fillPct = active && speechActive ? 100 : 0;
  const ringClass = error
    ? "ring-rose-300 dark:ring-rose-700"
    : paused
      ? "ring-stone-200 dark:ring-stone-800"
      : "ring-emerald-300 dark:ring-emerald-600";
  const iconColor = error
    ? "text-rose-500"
    : paused
      ? "text-stone-400 dark:text-stone-500"
      : "text-emerald-700 dark:text-emerald-200";

  return (
    <div className="px-4 pt-1">
      <button
        type="button"
        onClick={onPress}
        aria-pressed={!paused}
        aria-label={t("voice.toggleAria")}
        className={`flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white shadow-sm ring-2 transition active:scale-[0.99] focus:outline-none focus-visible:ring-4 dark:bg-stone-900 ${ringClass} ${theme.primaryFocus}`}
      >
        <span
          className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ${
            error
              ? "bg-rose-50 dark:bg-rose-950/40"
              : "bg-stone-100 dark:bg-stone-800"
          } ${listening && active && fillPct < 4 ? "animate-pulse" : ""}`}
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 bg-emerald-400/80 transition-[height] duration-200 ease-out dark:bg-emerald-500/80"
            style={{ height: `${fillPct}%` }}
          />
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`relative ${iconColor}`}
          >
            {paused ? (
              <>
                <path d="M3 3l18 18" />
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
              </>
            ) : (
              <>
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <path d="M12 18v3" />
              </>
            )}
          </svg>
        </span>
        <span
          className={`truncate text-base font-black ${
            showInterim
              ? "text-emerald-600 dark:text-emerald-300"
              : "text-stone-900 dark:text-white"
          }`}
        >
          {label}
        </span>
      </button>
    </div>
  );
}

export function LeaveModal({
  theme,
  onStay,
  onLeave,
}: {
  theme: Theme;
  onStay: () => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl dark:bg-stone-900">
        <h2 className="text-xl font-black tracking-tight text-stone-900 dark:text-white">
          {t("practice.leaveTitle")}
        </h2>
        <p className="mt-2 text-sm font-semibold text-stone-600 dark:text-stone-300">
          {t("practice.leaveBody")}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onLeave}
            className="h-12 rounded-2xl bg-white text-base font-black text-stone-900 ring-1 ring-stone-200 transition active:scale-[0.98] dark:bg-stone-800 dark:text-white dark:ring-stone-700"
          >
            {t("practice.leaveLeave")}
          </button>
          <button
            type="button"
            onClick={onStay}
            className={`h-12 rounded-2xl text-base font-black text-white shadow-sm transition active:scale-[0.98] focus:outline-none focus-visible:ring-4 ${theme.primary} ${theme.primaryHover} ${theme.primaryShadow} ${theme.primaryFocus}`}
          >
            {t("practice.leaveStay")}
          </button>
        </div>
      </div>
    </div>
  );
}
