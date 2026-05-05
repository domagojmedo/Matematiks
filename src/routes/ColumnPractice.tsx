import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ColumnLayout,
  type Flash,
  LongDivisionLayout,
  MulPartialProductsLayout,
} from "../components/ColumnLayouts";
import { Mascot } from "../components/Mascot";
import {
  CounterStrip,
  LeaveModal,
  NumPad,
  ProgressBar,
} from "../components/PracticeUI";
import { useSettings } from "../contexts/SettingsContext";
import { usePracticeRound } from "../hooks/usePracticeRound";
import { buildPhases, type Phase, pickLayout } from "../lib/columnPhases";
import { formatMmSs, summarizeSetup } from "../lib/format";
import { OPERATION_SYMBOL, OPERATION_TONE, TONE_CHIP } from "../lib/operations";
import type { Operation, OperationSetup } from "../lib/types";

const FLASH_MS = 400;

export function ColumnPractice({
  op,
  setup,
  lessonId,
}: {
  op: Operation;
  setup: OperationSetup;
  lessonId?: string;
}) {
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const round = usePracticeRound(op, setup, lessonId);
  const {
    problem,
    problemIndex,
    totalRounds,
    timeMode,
    elapsedMs,
    correct,
    mistakes,
    streak,
    showLeaveModal,
    setShowLeaveModal,
    recordCorrect,
    recordWrong,
    leaveAndSave,
    tryBack,
    trackedTimeout,
  } = round;

  const [filledDigits, setFilledDigits] = useState<number[]>([]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[][]>([]);
  const [flash, setFlash] = useState<Flash>(null);
  const [shaking, setShaking] = useState(false);

  // Reset column-specific input state on each new problem.
  useEffect(() => {
    setFilledDigits([]);
    setPhaseIdx(0);
    setCompletedPhases([]);
  }, [problem]);

  const phases = useMemo<Phase[]>(() => buildPhases(problem), [problem]);
  const currentPhase = phases[phaseIdx];

  const expectedDigit = useCallback(
    (filledIdx: number): number => {
      if (!currentPhase) return -1;
      const valueStr = String(currentPhase.value);
      if (currentPhase.direction === "rtl") {
        return Math.floor(currentPhase.value / 10 ** filledIdx) % 10;
      }
      return Number(valueStr[filledIdx]);
    },
    [currentPhase],
  );

  const submitWrong = useCallback(() => {
    setFlash("wrong");
    setShaking(true);
    recordWrong();
    trackedTimeout(() => {
      setFlash(null);
      setShaking(false);
    }, FLASH_MS);
  }, [recordWrong, trackedTimeout]);

  const handleDigit = useCallback(
    (n: number) => {
      if (flash) return;
      if (!currentPhase) return;
      const phaseLen = String(currentPhase.value).length;
      if (filledDigits.length >= phaseLen) return;
      const expected = expectedDigit(filledDigits.length);
      if (n === expected) {
        const nextFilled = [...filledDigits, n];
        setFlash("correct");
        const phaseComplete = nextFilled.length >= phaseLen;
        const isLastPhase = phaseIdx + 1 >= phases.length;
        trackedTimeout(() => {
          setFlash(null);
          if (phaseComplete && isLastPhase) {
            recordCorrect(problem.answer);
          } else if (phaseComplete) {
            setCompletedPhases((prev) => [...prev, nextFilled]);
            setPhaseIdx((i) => i + 1);
            setFilledDigits([]);
          } else {
            setFilledDigits(nextFilled);
          }
        }, FLASH_MS);
      } else {
        submitWrong();
      }
    },
    [
      flash,
      filledDigits,
      currentPhase,
      phaseIdx,
      phases.length,
      expectedDigit,
      recordCorrect,
      problem.answer,
      submitWrong,
      trackedTimeout,
    ],
  );

  // Column mode commits digits only when correct, so there is nothing to undo.
  // The on-screen delete button stays wired as a no-op for layout consistency,
  // and we drop the Backspace shortcut entirely.
  const handleDelete = useCallback(() => {}, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDigit]);

  const tone = OPERATION_TONE[op];
  const flashBg =
    flash === "correct"
      ? "bg-emerald-50 dark:bg-emerald-950/60"
      : flash === "wrong"
        ? "bg-rose-50 dark:bg-rose-950/60"
        : settings.dark
          ? theme.pageBgDark
          : theme.pageBg;

  const layoutKind = pickLayout(problem);
  const guide = setup.guide ?? true;

  return (
    <div
      className={`flex min-h-dvh w-full flex-col transition-colors ${flashBg}`}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col sm:justify-center sm:py-6">
        <header className="flex items-center justify-between px-4 pt-5 pb-3">
          <button
            type="button"
            onClick={tryBack}
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
              className={`flex h-7 w-7 items-center justify-center rounded-full text-base leading-none font-black ring-2 ${TONE_CHIP[tone]}`}
            >
              {OPERATION_SYMBOL[op]}
            </span>
            <span className="text-sm font-black text-stone-900 dark:text-white">
              {t(`operations.${op}`)}
            </span>
            <span className="hidden text-xs font-bold text-stone-500 tabular-nums sm:inline dark:text-stone-400">
              · {summarizeSetup(setup)}
            </span>
          </div>
          <div className="flex h-12 min-w-[3.5rem] items-center justify-center rounded-2xl bg-white px-3 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
            <span className="text-sm font-black text-stone-900 tabular-nums dark:text-white">
              {timeMode
                ? formatMmSs(Math.max(0, (setup.timeMs ?? 0) - elapsedMs))
                : formatMmSs(elapsedMs)}
            </span>
          </div>
        </header>

        <CounterStrip correct={correct} mistakes={mistakes} streak={streak} />

        <section
          className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-2 sm:flex-none sm:py-8"
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

          {layoutKind === "division" && (
            <LongDivisionLayout
              problem={problem}
              phases={phases}
              phaseIdx={phaseIdx}
              filledDigits={filledDigits}
              completedPhases={completedPhases}
              flash={flash}
              shaking={shaking}
              theme={theme}
              guide={guide}
            />
          )}
          {layoutKind === "mulPartials" && (
            <MulPartialProductsLayout
              problem={problem}
              phases={phases}
              phaseIdx={phaseIdx}
              filledDigits={filledDigits}
              completedPhases={completedPhases}
              flash={flash}
              shaking={shaking}
              theme={theme}
              guide={guide}
            />
          )}
          {layoutKind === "simple" && (
            <ColumnLayout
              problem={problem}
              filledDigits={filledDigits}
              answerLen={String(problem.answer).length}
              flash={flash}
              shaking={shaking}
              theme={theme}
            />
          )}

          <ProgressBar
            ratio={
              timeMode
                ? Math.min(1, elapsedMs / (setup.timeMs ?? 1))
                : Math.min(1, problemIndex / totalRounds)
            }
            theme={theme}
          />
          <p className="mt-2.5 text-xs font-bold text-stone-500 tabular-nums dark:text-stone-400">
            {timeMode
              ? t("practice.problemNumber", { current: problemIndex + 1 })
              : t("practice.problemOf", {
                  current: Math.min(problemIndex + 1, totalRounds),
                  total: totalRounds,
                })}
          </p>
        </section>

        <NumPad onDigit={handleDigit} onDelete={handleDelete} theme={theme} />
      </div>

      {showLeaveModal && (
        <LeaveModal
          theme={theme}
          onStay={() => setShowLeaveModal(false)}
          onLeave={leaveAndSave}
        />
      )}
    </div>
  );
}
