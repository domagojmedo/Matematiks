import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { NumPad, VoiceButton } from "../components/PracticeUI";
import { QuestionScaffold, RoundFrame } from "../components/RoundChrome";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import { usePerProblemReset } from "../hooks/usePerProblemReset";
import { useRoundMechanics } from "../hooks/useRoundMechanics";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { formatMmSs, summarizeSetup } from "../lib/format";
import {
  isValidOperation,
  OPERATION_SYMBOL,
  OPERATION_TONE,
} from "../lib/operations";
import {
  generateProblem,
  operationGlyph,
  type Problem,
} from "../lib/problemGen";
import { getSetup } from "../lib/setup";
import {
  isSpeechRecognitionSupported,
  parseSpokenNumber,
  speechLangTag,
} from "../lib/speech";
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
// Bounded auto-listen retries per problem. One shot often dies on a tablet
// (weak mic, no-speech, a mic-on chime read as noise ending the session); a
// few backed-off retries recover that without the unbounded chime loop a
// `listening`-driven restart used to cause.
const MAX_VOICE_ATTEMPTS = 3;

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
    },
    [problem, commitProblem, trackedTimeout, nowMs],
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
        submitCorrect(parsed);
      } else if (next.length >= answerLen) {
        submitWrong(parsed);
      }
    },
    [flash, typed, problem.answer, submitCorrect, submitWrong],
  );

  const submitFullAnswer = useCallback(
    (n: number) => {
      if (flash) return;
      const str = String(n);
      if (str.length > MAX_DIGITS) return;
      setTyped(str);
      if (n === problem.answer) {
        submitCorrect(n);
      } else {
        submitWrong(n);
      }
    },
    [flash, problem.answer, submitCorrect, submitWrong],
  );

  const handleDelete = useCallback(() => {
    if (flash) return;
    setTyped("");
  }, [flash]);

  const voiceEnabled =
    (settings.voiceInput ?? false) && isSpeechRecognitionSupported();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // Kid-toggleable mute. When true the auto-listen effect is suppressed and
  // the engine stays closed until the kid taps the mic button to unmute.
  // Also flipped on automatically when the mic permission is denied so we
  // don't loop the prompt; a manual tap clears it as a retry.
  const [voicePaused, setVoicePaused] = useState(false);

  const handleVoiceResult = useCallback(
    (candidates: string[]) => {
      // Accept the first alternative that parses to a number — the top guess
      // is often a near-miss on Croatian number words.
      for (const candidate of candidates) {
        const parsed = parseSpokenNumber(candidate, settings.language);
        if (parsed !== null) {
          setVoiceError(null);
          submitFullAnswer(parsed);
          return;
        }
      }
      setVoiceError(t("voice.notUnderstood"));
      trackedTimeout(() => setVoiceError(null), 1500);
    },
    [settings.language, submitFullAnswer, trackedTimeout, t],
  );

  const handleVoiceError = useCallback(
    (err: string) => {
      if (err === "not-allowed" || err === "service-not-allowed") {
        setVoiceError(t("voice.micDenied"));
        setVoicePaused(true);
        trackedTimeout(() => setVoiceError(null), 2400);
        return;
      }
      // Surface diagnosable failures so a flaky tablet shows a reason instead
      // of silence. `no-speech` / `aborted` are normal session ends and stay
      // quiet. These don't pause — the retry loop will try again.
      const hint =
        err === "network"
          ? t("voice.network")
          : err === "language-not-supported"
            ? t("voice.langUnsupported")
            : err === "audio-capture"
              ? t("voice.noMic")
              : null;
      if (hint) {
        setVoiceError(hint);
        trackedTimeout(() => setVoiceError(null), 2400);
      }
    },
    [t, trackedTimeout],
  );

  const {
    listening,
    speechActive,
    interim,
    start: startVoice,
    stop: stopVoice,
  } = useSpeechRecognition({
    lang: speechLangTag(settings.language),
    onResult: handleVoiceResult,
    onError: handleVoiceError,
  });

  const voiceAttemptsRef = useRef(0);

  const onMicPress = useCallback(() => {
    setVoiceError(null);
    setVoicePaused((prev) => !prev);
    // When toggling off, also tear down the current session immediately so
    // the kid sees the engine go quiet right away rather than waiting for
    // it to close itself. When toggling back on, give it a fresh budget of
    // attempts even if the previous problem had exhausted them.
    if (!voicePaused) stopVoice();
    else voiceAttemptsRef.current = 0;
  }, [voicePaused, stopVoice]);

  // Reset the per-problem attempt budget whenever the problem changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `problem` is the intended reset trigger, not a value read in the body
  useEffect(() => {
    voiceAttemptsRef.current = 0;
  }, [problem]);

  // Auto-listen with a small, BOUNDED number of attempts per problem. Unlike
  // the old one-shot, the dep set includes `listening`, so a session that
  // closes itself (silence timeout, or the Android/MIUI mic-on chime read as
  // noise ending it) triggers a retry — but only up to MAX_VOICE_ATTEMPTS,
  // with a growing backoff. The cap is what prevents the old chime → start →
  // chime → end loop; after it, voice goes quiet until the next problem.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `problem` re-arms the attempt budget on each new problem
  useEffect(() => {
    if (!voiceEnabled) return;
    if (voicePaused) return;
    if (flash) return;
    if (listening) return;
    if (voiceAttemptsRef.current >= MAX_VOICE_ATTEMPTS) return;
    const attempt = voiceAttemptsRef.current;
    const delay = attempt === 0 ? 150 : 500 + attempt * 300;
    const id = window.setTimeout(() => {
      voiceAttemptsRef.current += 1;
      setVoiceError(null);
      startVoice();
    }, delay);
    return () => window.clearTimeout(id);
  }, [voiceEnabled, voicePaused, flash, listening, problem, startVoice]);

  useEffect(() => {
    return () => stopVoice();
  }, [stopVoice]);

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

      {voiceEnabled && (
        <VoiceButton
          listening={listening}
          paused={voicePaused}
          speechActive={speechActive}
          interim={interim}
          error={voiceError}
          onPress={onMicPress}
          theme={theme}
        />
      )}

      <NumPad onDigit={handleDigit} onDelete={handleDelete} theme={theme} />
    </RoundFrame>
  );
}
