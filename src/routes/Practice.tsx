import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Mascot } from "../components/Mascot";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import { trackEvent } from "../lib/analytics";
import { formatMmSs, isTimeMode, summarizeSetup } from "../lib/format";
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
import { PROFILE_KEYS, profileKey, readJSON, writeJSON } from "../lib/storage";
import type { Operation, ProblemRecord, SessionRecord } from "../lib/types";

const FLASH_MS = 400;
const MAX_DIGITS = 4;

type Flash = "correct" | "wrong" | null;

export function Practice() {
  const { operation } = useParams<{ operation: string }>();
  const isValidOp = operation !== undefined && isValidOperation(operation);
  const op: Operation = isValidOp ? operation : "add";
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const { profileId } = useProfiles();
  const navigate = useNavigate();

  const setup = useMemo(() => getSetup(profileId, op), [profileId, op]);
  const totalRounds = setup.rounds;
  const timeMode = isTimeMode(setup);

  const [problem, setProblem] = useState<Problem>(() =>
    generateProblem(op, setup),
  );
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const [shaking, setShaking] = useState(false);
  const [problemIndex, setProblemIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const problemStartedRef = useRef<number>(performance.now());
  const retriesRef = useRef<number>(0);
  const roundStartedRef = useRef<number>(performance.now());
  const recordsRef = useRef<ProblemRecord[]>([]);
  const endedRef = useRef<boolean>(false);
  const timeoutsRef = useRef<number[]>([]);

  const trackedTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((x) => x !== id);
      fn();
    }, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => {
      for (const id of timeoutsRef.current) window.clearTimeout(id);
      timeoutsRef.current = [];
    };
  }, []);

  const persistSession = useCallback(
    (
      records: ProblemRecord[],
      finalCorrect: number,
      finalBest: number,
    ): string | null => {
      if (records.length === 0 && mistakes === 0) return null;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const session: SessionRecord = {
        id,
        date: new Date().toISOString(),
        operation: op,
        setup,
        correct: finalCorrect,
        mistakes,
        durationMs: Math.round(performance.now() - roundStartedRef.current),
        bestStreak: finalBest,
        problems: records,
      };
      const sessionsKey = profileKey(profileId, PROFILE_KEYS.sessions);
      const all = readJSON<SessionRecord[]>(sessionsKey, []);
      writeJSON(sessionsKey, [session, ...all].slice(0, 200));
      return id;
    },
    [profileId, op, setup, mistakes],
  );

  const modeTag = timeMode ? "time" : "count";

  const finishRound = useCallback(
    (lastRecord: ProblemRecord, finalCorrect: number, finalBest: number) => {
      if (endedRef.current) return;
      endedRef.current = true;
      trackEvent(`round_completed/${op}/${modeTag}`);
      const id = persistSession(
        [...recordsRef.current, lastRecord],
        finalCorrect,
        finalBest,
      );
      if (id) {
        navigate("/summary", { state: { sessionId: id }, replace: true });
      } else {
        navigate("/", { replace: true });
      }
    },
    [persistSession, navigate, op, modeTag],
  );

  const leaveAndSave = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    trackEvent(`round_abandoned/${op}/${modeTag}`);
    persistSession(recordsRef.current, correct, bestStreak);
    navigate("/", { replace: true });
  }, [persistSession, correct, bestStreak, navigate, op, modeTag]);

  const finishRoundFromTimeout = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    trackEvent(`round_completed/${op}/${modeTag}`);
    const id = persistSession(recordsRef.current, correct, bestStreak);
    if (id) {
      navigate("/summary", { state: { sessionId: id }, replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [persistSession, correct, bestStreak, navigate, op, modeTag]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const elapsed = performance.now() - roundStartedRef.current;
      setElapsedMs(elapsed);
      if (
        !endedRef.current &&
        setup.timeMs !== undefined &&
        elapsed >= setup.timeMs
      ) {
        finishRoundFromTimeout();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [setup.timeMs, finishRoundFromTimeout]);

  const advance = useCallback(
    (userAnswer: number) => {
      const record: ProblemRecord = {
        a: problem.a,
        b: problem.b,
        op: problem.op,
        answer: problem.answer,
        userAnswer,
        tookMs: Math.round(performance.now() - problemStartedRef.current),
        retries: retriesRef.current,
      };
      const newCorrect = correct + 1;
      const newStreak = streak + 1;
      const newBest = Math.max(bestStreak, newStreak);
      setCorrect(newCorrect);
      setStreak(newStreak);
      setBestStreak(newBest);

      if (!timeMode && problemIndex + 1 >= totalRounds) {
        finishRound(record, newCorrect, newBest);
        return;
      }

      recordsRef.current = [...recordsRef.current, record];
      setProblemIndex((i) => i + 1);
      setProblem(generateProblem(op, setup, problem));
      setTyped("");
      problemStartedRef.current = performance.now();
      retriesRef.current = 0;
    },
    [
      problem,
      correct,
      streak,
      bestStreak,
      problemIndex,
      totalRounds,
      timeMode,
      finishRound,
      op,
      setup,
    ],
  );

  const submitWrong = useCallback(() => {
    setFlash("wrong");
    setShaking(true);
    setMistakes((m) => m + 1);
    setStreak(0);
    retriesRef.current += 1;
    trackedTimeout(() => {
      setFlash(null);
      setShaking(false);
      setTyped("");
    }, FLASH_MS);
  }, [trackedTimeout]);

  const handleDigit = useCallback(
    (n: number) => {
      if (flash) return;
      if (typed.length >= MAX_DIGITS) return;
      const next = typed + String(n);
      setTyped(next);
      const parsed = Number.parseInt(next, 10);
      const answerLen = String(problem.answer).length;
      if (Number.isFinite(parsed) && parsed === problem.answer) {
        setFlash("correct");
        trackedTimeout(() => {
          setFlash(null);
          advance(parsed);
        }, FLASH_MS);
      } else if (next.length >= answerLen) {
        submitWrong();
      }
    },
    [flash, typed, problem.answer, advance, submitWrong, trackedTimeout],
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

  if (!isValidOp) {
    return <Navigate to="/" replace />;
  }

  const tone = OPERATION_TONE[op];
  const flashBg =
    flash === "correct"
      ? "bg-emerald-50 dark:bg-emerald-950/60"
      : flash === "wrong"
        ? "bg-rose-50 dark:bg-rose-950/60"
        : settings.dark
          ? theme.pageBgDark
          : theme.pageBg;

  function tryBack() {
    const hasProgress = recordsRef.current.length > 0 || mistakes > 0;
    if (!hasProgress) {
      navigate("/");
    } else {
      setShowLeaveModal(true);
    }
  }

  return (
    <div
      className={`flex min-h-dvh w-full flex-col transition-colors ${flashBg}`}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col md:justify-center md:py-6">
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
          className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-2 md:flex-none md:py-8"
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

function CounterStrip({
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

function ProgressBar({
  ratio,
  theme,
}: {
  ratio: number;
  theme: ReturnType<typeof useSettings>["theme"];
}) {
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

function NumPad({
  onDigit,
  onDelete,
  theme,
}: {
  onDigit: (n: number) => void;
  onDelete: () => void;
  theme: ReturnType<typeof useSettings>["theme"];
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
        <div aria-hidden="true" />
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

function LeaveModal({
  theme,
  onStay,
  onLeave,
}: {
  theme: ReturnType<typeof useSettings>["theme"];
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
