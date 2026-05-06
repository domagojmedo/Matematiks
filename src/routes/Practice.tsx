import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { Mascot } from "../components/Mascot";
import {
  CounterStrip,
  LeaveModal,
  NumPad,
  ProgressBar,
} from "../components/PracticeUI";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import { usePerProblemReset } from "../hooks/usePerProblemReset";
import { useRoundMechanics } from "../hooks/useRoundMechanics";
import { formatMmSs, summarizeSetup } from "../lib/format";
import {
  isValidOperation,
  OPERATION_SYMBOL,
  OPERATION_TONE,
  TONE_CHIP,
} from "../lib/operations";
import {
  generateProblem,
  operationGlyph,
  type Problem,
} from "../lib/problemGen";
import { getSetup } from "../lib/setup";
import { PROFILE_KEYS, profileKey, writeJSON } from "../lib/storage";
import type {
  LastSession,
  Operation,
  OperationSetup,
  ProblemAttempt,
  ProblemRecord,
} from "../lib/types";
import { ColumnPractice } from "./ColumnPractice";

const FLASH_MS = 400;
const MAX_DIGITS = 4;

type Flash = "correct" | "wrong" | null;

export function Practice() {
  const { operation } = useParams<{ operation: string }>();
  const isValidOp = operation !== undefined && isValidOperation(operation);
  const op: Operation = isValidOp ? operation : "add";
  const { profileId } = useProfiles();
  const location = useLocation();

  const [{ setup, lessonId }] = useState<{
    setup: OperationSetup;
    lessonId?: string;
  }>(() => {
    const state = location.state as {
      setup?: OperationSetup;
      lessonId?: string;
    } | null;
    return {
      setup: state?.setup ?? getSetup(profileId, op),
      lessonId: state?.lessonId,
    };
  });

  useEffect(() => {
    const state = location.state as {
      setup?: OperationSetup;
      lessonId?: string;
    } | null;
    if (!state?.setup) return;
    const last: LastSession = {
      operation: op,
      setup: state.setup,
      ...(state.lessonId ? { lessonId: state.lessonId } : {}),
    };
    writeJSON(profileKey(profileId, PROFILE_KEYS.lastSession), last);
  }, [location.state, op, profileId]);

  if (!isValidOp) {
    return <Navigate to="/" replace />;
  }

  if (setup.format === "column") {
    return <ColumnPractice op={op} setup={setup} lessonId={lessonId} />;
  }
  return <HorizontalPractice op={op} setup={setup} lessonId={lessonId} />;
}

function HorizontalPractice({
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

  const generate = useCallback(
    (prev: Problem | null) => generateProblem(op, setup, prev),
    [op, setup],
  );

  const round = useRoundMechanics<Problem>({
    op,
    setup,
    lessonId,
    generate,
  });
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
    nowMs,
    commitProblem,
    noteWrongAttempt,
    leaveAndSave,
    tryBack,
    trackedTimeout,
  } = round;

  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const [shaking, setShaking] = useState(false);

  const attemptsRef = useRef<ProblemAttempt[]>([]);
  const startedAtRef = useRef<number>(nowMs());

  usePerProblemReset(problem, () => {
    setTyped("");
    attemptsRef.current = [];
    startedAtRef.current = nowMs();
  });

  const submitWrong = useCallback(
    (given: number) => {
      attemptsRef.current.push({
        phaseIndex: 0,
        phaseKind: "answer",
        given,
        expected: problem.answer,
        correct: false,
        atMs: nowMs(),
      });
      setFlash("wrong");
      setShaking(true);
      noteWrongAttempt();
      trackedTimeout(() => {
        setFlash(null);
        setShaking(false);
        setTyped("");
      }, FLASH_MS);
    },
    [problem.answer, noteWrongAttempt, trackedTimeout, nowMs],
  );

  const handleDigit = useCallback(
    (n: number) => {
      if (flash) return;
      if (typed.length >= MAX_DIGITS) return;
      const next = typed + String(n);
      setTyped(next);
      const parsed = Number.parseInt(next, 10);
      const answerLen = String(problem.answer).length;
      if (Number.isFinite(parsed) && parsed === problem.answer) {
        const correctAttempt: ProblemAttempt = {
          phaseIndex: 0,
          phaseKind: "answer",
          given: parsed,
          expected: problem.answer,
          correct: true,
          atMs: nowMs(),
        };
        const allAttempts = [...attemptsRef.current, correctAttempt];
        const wrongCount = allAttempts.filter((a) => !a.correct).length;
        const record: ProblemRecord = {
          a: problem.a,
          b: problem.b,
          op: problem.op,
          answer: problem.answer,
          userAnswer: parsed,
          tookMs: Math.round(nowMs() - startedAtRef.current),
          retries: wrongCount,
          startedAtMs: Math.round(startedAtRef.current),
          attempts: allAttempts,
        };
        setFlash("correct");
        trackedTimeout(() => {
          setFlash(null);
          commitProblem(record);
        }, FLASH_MS);
      } else if (next.length >= answerLen) {
        submitWrong(parsed);
      }
    },
    [flash, typed, problem, commitProblem, submitWrong, trackedTimeout, nowMs],
  );

  const handleDelete = useCallback(() => {
    if (flash) return;
    setTyped("");
  }, [flash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(Number(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDigit, handleDelete]);

  const tone = OPERATION_TONE[op];
  const flashBg =
    flash === "correct"
      ? "bg-emerald-50 dark:bg-emerald-950/60"
      : flash === "wrong"
        ? "bg-rose-50 dark:bg-rose-950/60"
        : settings.dark
          ? theme.pageBgDark
          : theme.pageBg;

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
          <div
            className={`flex items-baseline justify-center gap-1.5 sm:gap-3 md:gap-5 ${
              shaking ? "animate-shake" : ""
            }`}
          >
            <span className="text-4xl leading-none font-black text-stone-900 tabular-nums sm:text-6xl md:text-7xl lg:text-8xl dark:text-white">
              {problem.a}
            </span>
            <span
              className={`text-3xl leading-none font-black sm:text-5xl md:text-6xl lg:text-7xl ${theme.primaryText} ${theme.primaryTextDark}`}
            >
              {operationGlyph(problem.op)}
            </span>
            <span className="text-4xl leading-none font-black text-stone-900 tabular-nums sm:text-6xl md:text-7xl lg:text-8xl dark:text-white">
              {problem.b}
            </span>
            <span className="text-3xl leading-none font-black text-stone-300 sm:text-5xl md:text-6xl lg:text-7xl dark:text-stone-600">
              =
            </span>
            <span
              className={`inline-block min-w-[1.2ch] text-center text-4xl leading-none font-black tabular-nums sm:text-6xl md:text-7xl lg:text-8xl ${
                flash === "correct"
                  ? "text-emerald-500"
                  : flash === "wrong"
                    ? "text-rose-500"
                    : `${theme.primaryText} ${theme.primaryTextDark}`
              }`}
            >
              {typed || (
                <span className="text-stone-300 dark:text-stone-600">?</span>
              )}
            </span>
          </div>

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
              ? t("practice.problemNumber", {
                  current: problemIndex + 1,
                })
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
