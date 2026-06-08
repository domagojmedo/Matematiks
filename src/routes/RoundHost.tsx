import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Flash, QuestionScaffold, RoundFrame } from "../components/RoundChrome";
import { useSettings } from "../contexts/SettingsContext";
import { useRoundMechanics } from "../hooks/useRoundMechanics";
import { formatMmSs } from "../lib/format";
import type { Tone } from "../lib/operations";
import type { Theme } from "../lib/themes";
import type {
  AnyLessonSetup,
  AppSettings,
  Operation,
  ProblemRecord,
} from "../lib/types";

/**
 * Everything a question component needs from the round it lives in. The host
 * owns flash/shaking (so the frame wash + mascot + shake react) and the
 * round-level display values; the question owns its own per-problem
 * interaction and reports completion via `commit`.
 */
export type QuestionApi = {
  flash: Flash;
  shaking: boolean;
  setFlash: (f: Flash) => void;
  setShaking: (s: boolean) => void;
  /** Problem solved — host records it and advances to the next. */
  commit: (record: ProblemRecord) => void;
  /** A wrong attempt — host bumps the mistake counter / resets streak. */
  noteWrong: () => void;
  trackedTimeout: (fn: () => void, ms: number) => void;
  nowMs: () => number;
  theme: Theme;
  settings: AppSettings;
  progressRatio: number;
  problemLabel: string;
};

/**
 * Generic round runner: owns mechanics (via useRoundMechanics) + the shared
 * frame + flash/shaking state, and delegates the per-problem body+pad to
 * `renderQuestion`. Standalone lessons and combined multi-select rounds both
 * run through this, so a question renders identically either way.
 */
export function RoundHost<P>({
  op,
  setup,
  lessonId,
  chip,
  generate,
  renderQuestion,
}: {
  op: Operation;
  setup: AnyLessonSetup;
  lessonId?: string;
  chip: { tone: Tone; symbol: string; label: string; summary?: string };
  generate: (prev: P | null) => P;
  renderQuestion: (problem: P, api: QuestionApi) => ReactNode;
}) {
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const round = useRoundMechanics<P>({ op, setup, lessonId, generate });
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

  const [flash, setFlash] = useState<Flash>(null);
  const [shaking, setShaking] = useState(false);

  const timeText = timeMode
    ? formatMmSs(Math.max(0, (setup.timeMs ?? 0) - elapsedMs))
    : formatMmSs(elapsedMs);
  const progressRatio = timeMode
    ? Math.min(1, elapsedMs / (setup.timeMs ?? 1))
    : Math.min(1, problemIndex / totalRounds);
  const problemLabel = timeMode
    ? t("practice.problemNumber", { current: problemIndex + 1 })
    : t("practice.problemOf", {
        current: Math.min(problemIndex + 1, totalRounds),
        total: totalRounds,
      });

  const api: QuestionApi = {
    flash,
    shaking,
    setFlash,
    setShaking,
    commit: commitProblem,
    noteWrong: noteWrongAttempt,
    trackedTimeout,
    nowMs,
    theme,
    settings,
    progressRatio,
    problemLabel,
  };

  return (
    <RoundFrame
      flash={flash}
      dark={settings.dark}
      theme={theme}
      onBack={tryBack}
      chip={chip}
      timeText={timeText}
      correct={correct}
      mistakes={mistakes}
      streak={streak}
      showLeaveModal={showLeaveModal}
      onStay={() => setShowLeaveModal(false)}
      onLeave={leaveAndSave}
    >
      {/* Remount per problem so the question's internal interaction state
          resets cleanly without a separate per-problem reset. */}
      <QuestionGate key={problemIndex}>
        {renderQuestion(problem, api)}
      </QuestionGate>
    </RoundFrame>
  );
}

// A keyed passthrough so the question subtree remounts on problem change.
function QuestionGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Re-export so question components import the scaffold from one place. */
export { QuestionScaffold };
