import { useCallback, useEffect, useRef, useState } from "react";
import { operationGlyph, type Problem } from "../../lib/problemGen";
import type { ProblemAttempt, ProblemRecord } from "../../lib/types";
import type { QuestionApi } from "../../routes/RoundHost";
import { AnswerInput } from "../AnswerInput";
import { QuestionScaffold } from "../RoundChrome";

const FLASH_MS = 400;
const MAX_DIGITS = 4;

/** A single horizontal `a op b = ?` problem with numpad + voice input. */
export function HorizontalQuestion({
  problem,
  api,
}: {
  problem: Problem;
  api: QuestionApi;
}) {
  const {
    theme,
    settings,
    flash,
    shaking,
    setFlash,
    setShaking,
    commit,
    noteWrong,
    trackedTimeout,
    nowMs,
    progressRatio,
    problemLabel,
  } = api;

  const [typed, setTyped] = useState("");
  const attemptsRef = useRef<ProblemAttempt[]>([]);
  const startedAtRef = useRef<number>(nowMs());

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
      noteWrong();
      trackedTimeout(() => {
        setFlash(null);
        setShaking(false);
        setTyped("");
      }, FLASH_MS);
    },
    [problem.answer, noteWrong, setFlash, setShaking, trackedTimeout, nowMs],
  );

  const submitCorrect = useCallback(
    (parsed: number) => {
      const correctAttempt: ProblemAttempt = {
        phaseIndex: 0,
        phaseKind: "answer",
        given: parsed,
        expected: problem.answer,
        correct: true,
        atMs: nowMs(),
      };
      const allAttempts = [...attemptsRef.current, correctAttempt];
      const record: ProblemRecord = {
        a: problem.a,
        b: problem.b,
        op: problem.op,
        answer: problem.answer,
        userAnswer: parsed,
        tookMs: Math.round(nowMs() - startedAtRef.current),
        retries: allAttempts.filter((x) => !x.correct).length,
        startedAtMs: Math.round(startedAtRef.current),
        attempts: allAttempts,
      };
      setFlash("correct");
      trackedTimeout(() => {
        setFlash(null);
        commit(record);
      }, FLASH_MS);
    },
    [problem, commit, setFlash, trackedTimeout, nowMs],
  );

  // Appends a batch of digits at once — a single recognized number ("10") or one
  // tap — then applies the auto-submit-on-match / wrong-on-full check to the
  // result. Batching (vs. one call per digit) keeps multi-digit handwriting from
  // racing on stale `typed`.
  const handleDigits = useCallback(
    (ns: number[]) => {
      if (flash) return;
      let next = typed;
      for (const n of ns) {
        if (next.length >= MAX_DIGITS) break;
        next += String(n);
      }
      if (next === typed) return;
      setTyped(next);
      const parsed = Number.parseInt(next, 10);
      const answerLen = String(problem.answer).length;
      if (Number.isFinite(parsed) && parsed === problem.answer) {
        submitCorrect(parsed);
      } else if (next.length >= answerLen) {
        submitWrong(parsed);
      }
    },
    [flash, typed, problem.answer, submitCorrect, submitWrong],
  );

  const handleDigit = useCallback(
    (n: number) => handleDigits([n]),
    [handleDigits],
  );

  const submitFullAnswer = useCallback(
    (n: number) => {
      if (flash) return;
      if (String(n).length > MAX_DIGITS) return;
      setTyped(String(n));
      if (n === problem.answer) submitCorrect(n);
      else submitWrong(n);
    },
    [flash, problem.answer, submitCorrect, submitWrong],
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

  return (
    <>
      <QuestionScaffold
        flash={flash}
        theme={theme}
        progressRatio={progressRatio}
        problemLabel={problemLabel}
      >
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
      </QuestionScaffold>

      <AnswerInput
        onDigits={handleDigits}
        onDelete={handleDelete}
        voice={{
          language: settings.language,
          onNumber: submitFullAnswer,
          gateKey: 0,
        }}
        theme={theme}
        flash={flash}
        trackedTimeout={trackedTimeout}
      />
    </>
  );
}
