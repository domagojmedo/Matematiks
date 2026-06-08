import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ColumnLayout,
  type Flash,
  LongDivisionLayout,
  MulPartialProductsLayout,
} from "../components/ColumnLayouts";
import { NumPad } from "../components/PracticeUI";
import { QuestionScaffold, RoundFrame } from "../components/RoundChrome";
import { useSettings } from "../contexts/SettingsContext";
import { usePerProblemReset } from "../hooks/usePerProblemReset";
import { useRoundMechanics } from "../hooks/useRoundMechanics";
import { buildPhases, type Phase, pickLayout } from "../lib/columnPhases";
import { formatMmSs, summarizeSetup } from "../lib/format";
import { OPERATION_SYMBOL, OPERATION_TONE } from "../lib/operations";
import { generateProblem, type Problem } from "../lib/problemGen";
import type {
  Operation,
  OperationSetup,
  ProblemAttempt,
  ProblemRecord,
} from "../lib/types";

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

  const [filledDigits, setFilledDigits] = useState<number[]>([]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[][]>([]);
  const [flash, setFlash] = useState<Flash>(null);
  const [shaking, setShaking] = useState(false);

  const attemptsRef = useRef<ProblemAttempt[]>([]);
  const startedAtRef = useRef<number>(nowMs());

  usePerProblemReset(problem, () => {
    setFilledDigits([]);
    setPhaseIdx(0);
    setCompletedPhases([]);
    attemptsRef.current = [];
    startedAtRef.current = nowMs();
  });

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
    (allAttempts: ProblemAttempt[]): ProblemRecord => {
      const wrongCount = allAttempts.filter((a) => !a.correct).length;
      return {
        a: problem.a,
        b: problem.b,
        op: problem.op,
        answer: problem.answer,
        userAnswer: problem.answer,
        tookMs: Math.round(nowMs() - startedAtRef.current),
        retries: wrongCount,
        startedAtMs: Math.round(startedAtRef.current),
        attempts: allAttempts,
      };
    },
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
      noteWrongAttempt();
      trackedTimeout(() => {
        setFlash(null);
        setShaking(false);
      }, FLASH_MS);
    },
    [phaseIdx, currentPhase, noteWrongAttempt, trackedTimeout, nowMs],
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
            commitProblem(buildRecord(attemptsRef.current));
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
      commitProblem,
      buildRecord,
      submitWrong,
      trackedTimeout,
      nowMs,
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
  const layoutKind = pickLayout(problem);
  const guide = setup.guide ?? true;
  const timeText = timeMode
    ? formatMmSs(Math.max(0, (setup.timeMs ?? 0) - elapsedMs))
    : formatMmSs(elapsedMs);
  const problemLabel = timeMode
    ? t("practice.problemNumber", { current: problemIndex + 1 })
    : t("practice.problemOf", {
        current: Math.min(problemIndex + 1, totalRounds),
        total: totalRounds,
      });

  return (
    <RoundFrame
      flash={flash}
      dark={settings.dark}
      theme={theme}
      onBack={tryBack}
      chip={{
        tone,
        symbol: OPERATION_SYMBOL[op],
        label: t(`operations.${op}`),
        summary: summarizeSetup(setup),
      }}
      timeText={timeText}
      correct={correct}
      mistakes={mistakes}
      streak={streak}
      showLeaveModal={showLeaveModal}
      onStay={() => setShowLeaveModal(false)}
      onLeave={leaveAndSave}
    >
      <QuestionScaffold
        flash={flash}
        theme={theme}
        progressRatio={
          timeMode
            ? Math.min(1, elapsedMs / (setup.timeMs ?? 1))
            : Math.min(1, problemIndex / totalRounds)
        }
        problemLabel={problemLabel}
      >
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
      </QuestionScaffold>

      <NumPad onDigit={handleDigit} onDelete={handleDelete} theme={theme} />
    </RoundFrame>
  );
}
