import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildPhases, type Phase, pickLayout } from "../../lib/columnPhases";
import type { Problem } from "../../lib/problemGen";
import type { ProblemAttempt, ProblemRecord } from "../../lib/types";
import type { QuestionApi } from "../../routes/RoundHost";
import { AnswerInput } from "../AnswerInput";
import {
  ColumnLayout,
  LongDivisionLayout,
  MulPartialProductsLayout,
} from "../ColumnLayouts";
import { QuestionScaffold } from "../RoundChrome";

const FLASH_MS = 400;

/**
 * A single written-column problem: the carry/borrow / long-division /
 * partial-products phase machine, digit-by-digit, committing only on correct
 * digits. No voice (the column flow is keypad-only).
 */
export function ColumnQuestion({
  problem,
  guide,
  api,
}: {
  problem: Problem;
  guide: boolean;
  api: QuestionApi;
}) {
  const {
    theme,
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

  const [filledDigits, setFilledDigits] = useState<number[]>([]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[][]>([]);
  const attemptsRef = useRef<ProblemAttempt[]>([]);
  const startedAtRef = useRef<number>(nowMs());

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

  const buildRecord = useCallback(
    (allAttempts: ProblemAttempt[]): ProblemRecord => ({
      a: problem.a,
      b: problem.b,
      op: problem.op,
      answer: problem.answer,
      userAnswer: problem.answer,
      tookMs: Math.round(nowMs() - startedAtRef.current),
      retries: allAttempts.filter((x) => !x.correct).length,
      startedAtMs: Math.round(startedAtRef.current),
      attempts: allAttempts,
    }),
    [problem, nowMs],
  );

  const submitWrong = useCallback(
    (given: number, expected: number) => {
      attemptsRef.current.push({
        phaseIndex: phaseIdx,
        phaseKind: currentPhase?.kind ?? "answer",
        given,
        expected,
        correct: false,
        atMs: nowMs(),
      });
      setFlash("wrong");
      setShaking(true);
      noteWrong();
      trackedTimeout(() => {
        setFlash(null);
        setShaking(false);
      }, FLASH_MS);
    },
    [
      phaseIdx,
      currentPhase,
      noteWrong,
      setFlash,
      setShaking,
      trackedTimeout,
      nowMs,
    ],
  );

  const handleDigit = useCallback(
    (n: number) => {
      if (flash) return;
      if (!currentPhase) return;
      const phaseLen = String(currentPhase.value).length;
      if (filledDigits.length >= phaseLen) return;
      const expected = expectedDigit(filledDigits.length);
      if (n === expected) {
        attemptsRef.current.push({
          phaseIndex: phaseIdx,
          phaseKind: currentPhase.kind,
          given: n,
          expected,
          correct: true,
          atMs: nowMs(),
        });
        const nextFilled = [...filledDigits, n];
        setFlash("correct");
        const phaseComplete = nextFilled.length >= phaseLen;
        const isLastPhase = phaseIdx + 1 >= phases.length;
        trackedTimeout(() => {
          setFlash(null);
          if (phaseComplete && isLastPhase) {
            commit(buildRecord(attemptsRef.current));
          } else if (phaseComplete) {
            setCompletedPhases((prev) => [...prev, nextFilled]);
            setPhaseIdx((i) => i + 1);
            setFilledDigits([]);
          } else {
            setFilledDigits(nextFilled);
          }
        }, FLASH_MS);
      } else {
        submitWrong(n, expected);
      }
    },
    [
      flash,
      filledDigits,
      currentPhase,
      phaseIdx,
      phases.length,
      expectedDigit,
      commit,
      buildRecord,
      submitWrong,
      setFlash,
      trackedTimeout,
      nowMs,
    ],
  );

  // Column mode commits digits only when correct — nothing to undo.
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

  const layoutKind = pickLayout(problem);

  return (
    <>
      <QuestionScaffold
        flash={flash}
        theme={theme}
        progressRatio={progressRatio}
        problemLabel={problemLabel}
      >
        <div data-testid="column-question" className="contents">
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
        </div>
      </QuestionScaffold>

      <AnswerInput
        // Column mode fills one position at a time — take the first digit.
        onDigits={(ds) => {
          if (ds.length > 0) handleDigit(ds[0]);
        }}
        onDelete={handleDelete}
        theme={theme}
        flash={flash}
        trackedTimeout={trackedTimeout}
      />
    </>
  );
}
