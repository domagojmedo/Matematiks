import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";
import { Mascot } from "../components/Mascot";
import {
  CounterStrip,
  LeaveModal,
  NumPad,
  ProgressBar,
  VoiceButton,
} from "../components/PracticeUI";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import { useMicLevel } from "../hooks/useMicLevel";
import { usePerProblemReset } from "../hooks/usePerProblemReset";
import { useRoundMechanics } from "../hooks/useRoundMechanics";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { formatMmSs } from "../lib/format";
import { findLesson, isWordLesson } from "../lib/lessons";
import { operationForWordKind, TONE_CHIP, wordChip } from "../lib/operations";
import {
  isSpeechRecognitionSupported,
  parseSpokenNumber,
  speechLangTag,
} from "../lib/speech";
import { PROFILE_KEYS, profileKey, writeJSON } from "../lib/storage";
import {
  type ProblemAttempt,
  type ProblemRecord,
  SetupKind,
} from "../lib/types";
import { WordGenerator } from "../lib/wordGen";
import { findTemplate } from "../lib/wordTemplates";
import {
  buildSteps,
  finalInputPhase,
  phaseAtStep,
  type WordConvertPhase,
  type WordPhase,
  type WordPickOpPhase,
  type WordProblem,
  type WordStepView,
} from "../lib/wordTypes";

const FLASH_MS = 400;
// Largest answer across word lessons is a 5-digit convert (10 kg → 10000 g).
// Arith word phases peak at 2 digits — extra digits there get rejected by the
// length check anyway, so a single cap covers both.
const MAX_DIGITS = 5;

type Flash = "correct" | "wrong" | null;

export function WordPractice() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const lesson = lessonId ? findLesson(lessonId) : undefined;
  if (!isWordLesson(lesson)) {
    return <Navigate to="/" replace />;
  }
  return (
    <WordPracticeRound
      lessonId={lesson.id}
      setup={lesson.setup}
      nameKey={lesson.nameKey}
    />
  );
}

function WordPracticeRound({
  lessonId,
  setup,
  nameKey,
}: {
  lessonId: string;
  setup: import("../lib/types").WordLessonSetup;
  nameKey: string;
}) {
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const { profileId } = useProfiles();

  const sessionOp = operationForWordKind(setup.wordKind);
  const chip = wordChip(setup.wordKind);

  // Stamp this round as the new "last session" so Home's Quick Start can
  // replay it. Without this, finishing a word lesson leaves Quick Start
  // pointing at whatever arith round preceded it.
  useEffect(() => {
    const last: import("../lib/types").LastSession = {
      operation: sessionOp,
      setup,
      lessonId,
    };
    writeJSON(profileKey(profileId, PROFILE_KEYS.lastSession), last);
  }, [profileId, lessonId, setup, sessionOp]);

  // One generator per round. Held in a ref so re-renders don't rebuild it
  // (which would reset the stratified queue mid-round).
  const generatorRef = useRef<WordGenerator | null>(null);
  if (generatorRef.current === null) {
    generatorRef.current = new WordGenerator(setup);
  }

  const generate = useCallback(
    (prev: WordProblem | null) =>
      (generatorRef.current as WordGenerator).next(prev),
    [],
  );

  const round = useRoundMechanics<WordProblem>({
    // Tag the session with the operation that best represents the lesson:
    // addsub for the prose-arith lessons, muldiv for unit-conversion lessons
    // (math is ×/÷ by powers of ten). Keeps Sessions-card colors meaningful.
    op: sessionOp,
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

  const phases = problem.phases;
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const [shaking, setShaking] = useState(false);

  const attemptsRef = useRef<ProblemAttempt[]>([]);
  const startedAtRef = useRef<number>(nowMs());

  usePerProblemReset(problem, () => {
    setPhaseIdx(0);
    setTyped("");
    attemptsRef.current = [];
    startedAtRef.current = nowMs();
  });

  const currentPhase = phases[phaseIdx];

  const buildRecord = useCallback(
    (allAttempts: ProblemAttempt[]): ProblemRecord => {
      const finalPhase = finalInputPhase(problem);
      const wrongCount = allAttempts.filter((a) => !a.correct).length;
      // Convert phases don't expose an a/b/op equation. Synthesize one so the
      // Sessions list and the existing SessionDetail equation row still have
      // something sensible to render: e.g. "5 kg = ? g" → 5 × 1000 = 5000.
      let a: number;
      let b: number;
      let op: "+" | "-" | "*" | "/";
      let answer: number;
      if (finalPhase.kind === "answer") {
        a = finalPhase.a;
        b = finalPhase.b;
        op = finalPhase.op;
        answer = finalPhase.result;
      } else {
        a = finalPhase.value;
        // Invariant: every convert template multiplies/divides by a factor > 1,
        // so `value !== expected` and one strict branch always applies.
        // Smaller→larger unit divides; larger→smaller unit multiplies.
        if (finalPhase.expected > finalPhase.value) {
          b = finalPhase.expected / finalPhase.value;
          op = "*";
        } else {
          b = finalPhase.value / finalPhase.expected;
          op = "/";
        }
        answer = finalPhase.expected;
      }
      return {
        a,
        b,
        op,
        answer,
        userAnswer: finalPhase.expected,
        tookMs: Math.round(nowMs() - startedAtRef.current),
        retries: wrongCount,
        startedAtMs: Math.round(startedAtRef.current),
        attempts: allAttempts,
        kind: SetupKind.Word,
        templateId: problem.templateId,
        numbers: [...problem.numbers],
        ...(problem.vars ? { vars: { ...problem.vars } } : {}),
      };
    },
    [problem, nowMs],
  );

  const handleWrong = useCallback(
    (
      given: number | "+" | "-",
      expected: number | "+" | "-",
      kind: WordPhase["kind"],
    ) => {
      attemptsRef.current.push({
        phaseIndex: phaseIdx,
        phaseKind: kind,
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
        setTyped("");
      }, FLASH_MS);
    },
    [phaseIdx, noteWrongAttempt, trackedTimeout, nowMs],
  );

  const advancePhase = useCallback(() => {
    const isLast = phaseIdx + 1 >= phases.length;
    if (isLast) {
      commitProblem(buildRecord(attemptsRef.current));
    } else {
      setPhaseIdx((i) => i + 1);
      setTyped("");
    }
  }, [phaseIdx, phases.length, commitProblem, buildRecord]);

  const handlePickOp = useCallback(
    (op: "+" | "-") => {
      if (flash) return;
      if (!currentPhase || currentPhase.kind !== "pickOp") return;
      const expected = currentPhase.expected;
      if (op === expected) {
        attemptsRef.current.push({
          phaseIndex: phaseIdx,
          phaseKind: "pickOp",
          given: op,
          expected,
          correct: true,
          atMs: nowMs(),
        });
        setFlash("correct");
        trackedTimeout(() => {
          setFlash(null);
          advancePhase();
        }, FLASH_MS);
      } else {
        handleWrong(op, expected, "pickOp");
      }
    },
    [
      flash,
      currentPhase,
      phaseIdx,
      handleWrong,
      advancePhase,
      trackedTimeout,
      nowMs,
    ],
  );

  const handleDigit = useCallback(
    (n: number) => {
      if (flash) return;
      if (
        !currentPhase ||
        (currentPhase.kind !== "answer" && currentPhase.kind !== "convert")
      )
        return;
      if (typed.length >= MAX_DIGITS) return;
      const next = typed + String(n);
      setTyped(next);
      // Convert phases use an explicit confirm key — the kid types the full
      // answer and presses ✓. Without that, the auto-submit-on-match below
      // would mark "200" correct even when the kid was about to type "2000".
      if (currentPhase.kind === "convert") return;
      const parsed = Number.parseInt(next, 10);
      const expected = currentPhase.expected;
      const expectedLen = String(expected).length;
      if (Number.isFinite(parsed) && parsed === expected) {
        attemptsRef.current.push({
          phaseIndex: phaseIdx,
          phaseKind: "answer",
          given: parsed,
          expected,
          correct: true,
          atMs: nowMs(),
        });
        setFlash("correct");
        trackedTimeout(() => {
          setFlash(null);
          advancePhase();
        }, FLASH_MS);
      } else if (next.length >= expectedLen) {
        handleWrong(parsed, expected, "answer");
      }
    },
    [
      flash,
      currentPhase,
      typed,
      phaseIdx,
      handleWrong,
      advancePhase,
      trackedTimeout,
      nowMs,
    ],
  );

  const handleConfirm = useCallback(() => {
    if (flash) return;
    if (!currentPhase || currentPhase.kind !== "convert") return;
    if (typed.length === 0) return;
    const parsed = Number.parseInt(typed, 10);
    const expected = currentPhase.expected;
    if (Number.isFinite(parsed) && parsed === expected) {
      attemptsRef.current.push({
        phaseIndex: phaseIdx,
        phaseKind: "convert",
        given: parsed,
        expected,
        correct: true,
        atMs: nowMs(),
      });
      setFlash("correct");
      trackedTimeout(() => {
        setFlash(null);
        advancePhase();
      }, FLASH_MS);
    } else {
      handleWrong(parsed, expected, "convert");
    }
  }, [
    flash,
    currentPhase,
    typed,
    phaseIdx,
    handleWrong,
    advancePhase,
    trackedTimeout,
    nowMs,
  ]);

  const handleDelete = useCallback(() => {
    if (flash) return;
    setTyped("");
  }, [flash]);

  // Voice input: submits the current phase only. pickOp phases are skipped
  // — we don't recognize "plus" / "minus" — so voice stays idle there and
  // the kid uses the on-screen + / − pad.
  const isNumberPhase =
    currentPhase?.kind === "answer" || currentPhase?.kind === "convert";

  const submitFullAnswer = useCallback(
    (n: number) => {
      if (flash) return;
      if (!currentPhase) return;
      if (currentPhase.kind !== "answer" && currentPhase.kind !== "convert") {
        return;
      }
      const str = String(n);
      if (str.length > MAX_DIGITS) return;
      setTyped(str);
      const expected = currentPhase.expected;
      if (n === expected) {
        attemptsRef.current.push({
          phaseIndex: phaseIdx,
          phaseKind: currentPhase.kind,
          given: n,
          expected,
          correct: true,
          atMs: nowMs(),
        });
        setFlash("correct");
        trackedTimeout(() => {
          setFlash(null);
          advancePhase();
        }, FLASH_MS);
      } else {
        handleWrong(n, expected, currentPhase.kind);
      }
    },
    [
      flash,
      currentPhase,
      phaseIdx,
      advancePhase,
      handleWrong,
      trackedTimeout,
      nowMs,
    ],
  );

  const voiceEnabled =
    (settings.voiceInput ?? false) && isSpeechRecognitionSupported();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voicePaused, setVoicePaused] = useState(false);

  const handleVoiceResult = useCallback(
    (transcript: string) => {
      const parsed = parseSpokenNumber(transcript, settings.language);
      if (parsed === null) {
        setVoiceError(t("voice.notUnderstood"));
        trackedTimeout(() => setVoiceError(null), 1500);
        return;
      }
      setVoiceError(null);
      submitFullAnswer(parsed);
    },
    [settings.language, submitFullAnswer, trackedTimeout, t],
  );

  const handleVoiceError = useCallback(
    (err: string) => {
      if (err === "not-allowed" || err === "service-not-allowed") {
        setVoiceError(t("voice.micDenied"));
        setVoicePaused(true);
        trackedTimeout(() => setVoiceError(null), 2400);
      }
    },
    [t, trackedTimeout],
  );

  const {
    listening,
    interim,
    start: startVoice,
    stop: stopVoice,
  } = useSpeechRecognition({
    lang: speechLangTag(settings.language),
    onResult: handleVoiceResult,
    onError: handleVoiceError,
  });
  const micLevel = useMicLevel(
    voiceEnabled && isNumberPhase && !voicePaused && !voiceError,
  );

  useEffect(() => {
    if (!voiceEnabled) return;
    if (voicePaused) return;
    if (flash) return;
    if (listening) return;
    if (!isNumberPhase) return;
    const id = window.setTimeout(() => startVoice(), 150);
    return () => window.clearTimeout(id);
  }, [voiceEnabled, voicePaused, flash, listening, isNumberPhase, startVoice]);

  const onMicPress = useCallback(() => {
    if (voicePaused) {
      setVoiceError(null);
      setVoicePaused(false);
    } else {
      setVoicePaused(true);
      stopVoice();
    }
  }, [voicePaused, stopVoice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (currentPhase?.kind === "pickOp") {
        if (e.key === "+") {
          e.preventDefault();
          handlePickOp("+");
        } else if (e.key === "-") {
          e.preventDefault();
          handlePickOp("-");
        }
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(Number(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleDelete();
      } else if (e.key === "Enter" && currentPhase?.kind === "convert") {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDigit, handleDelete, handlePickOp, handleConfirm, currentPhase]);

  // ----- Rendering ----------------------------------------------------------

  const template = findTemplate(problem.templateId);
  const proseText = template ? template.renderProse(problem) : "";
  const steps = useMemo(() => buildSteps(phases), [phases]);

  const tone = chip.tone;
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
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm leading-none font-black ring-2 ${TONE_CHIP[tone]}`}
            >
              {chip.symbol}
            </span>
            <span className="text-sm font-black text-stone-900 dark:text-white">
              {t(nameKey)}
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

          <div className={`w-full max-w-xl ${shaking ? "animate-shake" : ""}`}>
            <p className="mb-3 px-1 text-base leading-snug font-bold text-stone-700 sm:text-lg dark:text-stone-200">
              {proseText}
            </p>

            <div className="space-y-2">
              {steps.map((step) => (
                <StepLine
                  key={step.answerIdx}
                  step={step}
                  phases={phases}
                  phaseIdx={phaseIdx}
                  typed={typed}
                  flash={flash}
                  theme={theme}
                />
              ))}
            </div>
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
              ? t("practice.problemNumber", { current: problemIndex + 1 })
              : t("practice.problemOf", {
                  current: Math.min(problemIndex + 1, totalRounds),
                  total: totalRounds,
                })}
          </p>
        </section>

        {voiceEnabled && isNumberPhase && (
          <VoiceButton
            listening={listening}
            paused={voicePaused}
            level={micLevel}
            interim={interim}
            error={voiceError}
            onPress={onMicPress}
            theme={theme}
          />
        )}

        {currentPhase?.kind === "pickOp" ? (
          <PickOpPad onPick={handlePickOp} theme={theme} />
        ) : currentPhase?.kind === "convert" ? (
          <NumPad
            onDigit={handleDigit}
            onDelete={handleDelete}
            onConfirm={handleConfirm}
            confirmDisabled={typed.length === 0}
            theme={theme}
          />
        ) : (
          <NumPad onDigit={handleDigit} onDelete={handleDelete} theme={theme} />
        )}
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

function StepLine({
  step,
  phases,
  phaseIdx,
  typed,
  flash,
  theme,
}: {
  step: WordStepView;
  phases: WordPhase[];
  phaseIdx: number;
  typed: string;
  flash: Flash;
  theme: import("../lib/themes").Theme;
}) {
  const inputPhase = phaseAtStep(phases, step);
  if (inputPhase.kind === "convert") {
    return (
      <ConvertStepLine
        phase={inputPhase}
        isActive={phaseIdx === step.answerIdx}
        isCompleted={phaseIdx > step.answerIdx}
        typed={typed}
        flash={flash}
        theme={theme}
      />
    );
  }
  const answer = inputPhase;
  const pickOpPhase =
    step.pickOpIdx !== null
      ? (phases[step.pickOpIdx] as WordPickOpPhase)
      : null;

  const isPickOpActive = step.pickOpIdx !== null && phaseIdx === step.pickOpIdx;
  const isAnswerActive = phaseIdx === step.answerIdx;
  const isCompleted = phaseIdx > step.answerIdx;
  const isPending =
    !isCompleted &&
    !isAnswerActive &&
    !isPickOpActive &&
    (step.pickOpIdx === null
      ? phaseIdx < step.answerIdx
      : phaseIdx < step.pickOpIdx);

  // Operator display: ?, [+/-], or the chosen op. Pending steps with a pickOp
  // hide the operator too — and pending steps in general blank out their
  // operands (see slotDisplay) to avoid spoiling intermediate results that
  // are passed forward from earlier steps.
  const opDisplay: string =
    isPickOpActive || isPending
      ? "?"
      : step.pickOpIdx === null
        ? answer.op === "+"
          ? "+"
          : "−"
        : answer.op === "+"
          ? "+"
          : "−";

  const dim = isCompleted || isPending ? "muted" : "live";

  function slotDisplay(slot: "a" | "b" | "result"): {
    text: string;
    isSlot: boolean;
  } {
    // Pending steps haven't been reached. Blank every slot so that a step
    // whose `a` or `b` is derived from an earlier step's answer (e.g.
    // compound's intermediate, story's "zajedno") does not leak the answer
    // into the pending row.
    if (isPending) return { text: "?", isSlot: false };

    const isUnknown = answer.slot === slot;
    if (!isUnknown) {
      if (slot === "a") return { text: String(answer.a), isSlot: false };
      if (slot === "b") return { text: String(answer.b), isSlot: false };
      return { text: String(answer.result), isSlot: false };
    }
    // Unknown slot: typed buffer when actively typing, the answer when the
    // step is done, "?" otherwise (during the paired pickOp phase).
    if (isCompleted) return { text: String(answer.expected), isSlot: false };
    if (isAnswerActive) return { text: typed || "?", isSlot: true };
    return { text: "?", isSlot: false };
  }

  const aDisp = slotDisplay("a");
  const bDisp = slotDisplay("b");
  const rDisp = slotDisplay("result");

  const numClass =
    dim === "muted"
      ? "text-stone-400 dark:text-stone-500"
      : "text-stone-900 dark:text-white";
  const opClass = isPickOpActive
    ? `${theme.primaryText} ${theme.primaryTextDark}`
    : dim === "muted"
      ? "text-stone-400 dark:text-stone-500"
      : `${theme.primaryText} ${theme.primaryTextDark}`;
  const slotClass =
    flash === "correct"
      ? "text-emerald-500"
      : flash === "wrong" && isAnswerActive
        ? "text-rose-500"
        : `${theme.primaryText} ${theme.primaryTextDark}`;

  return (
    <div className="space-y-1">
      {step.label && (
        <p
          className={`px-1 text-xs font-bold tracking-wider uppercase ${
            isCompleted
              ? "text-stone-400 dark:text-stone-500"
              : "text-stone-500 dark:text-stone-400"
          }`}
        >
          {step.label}
        </p>
      )}
      <div className="flex items-baseline gap-1.5 px-1 text-3xl font-black tabular-nums sm:gap-2.5 sm:text-4xl">
        <span className={aDisp.isSlot ? slotClass : numClass}>
          {aDisp.text || (
            <span className="text-stone-300 dark:text-stone-600">?</span>
          )}
        </span>
        <span className={opClass}>{opDisplay}</span>
        <span className={bDisp.isSlot ? slotClass : numClass}>
          {bDisp.text || (
            <span className="text-stone-300 dark:text-stone-600">?</span>
          )}
        </span>
        <span className="text-stone-300 dark:text-stone-600">=</span>
        <span className={rDisp.isSlot ? slotClass : numClass}>
          {rDisp.text || (
            <span className="text-stone-300 dark:text-stone-600">?</span>
          )}
        </span>
        {isPickOpActive && pickOpPhase && (
          <span className="ml-2 text-base font-bold text-stone-500 dark:text-stone-400">
            {/* hint: which two operands the choice applies to */}
          </span>
        )}
      </div>
    </div>
  );
}

function ConvertStepLine({
  phase,
  isActive,
  isCompleted,
  typed,
  flash,
  theme,
}: {
  phase: WordConvertPhase;
  isActive: boolean;
  isCompleted: boolean;
  typed: string;
  flash: Flash;
  theme: import("../lib/themes").Theme;
}) {
  const dim = isCompleted ? "muted" : "live";
  const numClass =
    dim === "muted"
      ? "text-stone-400 dark:text-stone-500"
      : "text-stone-900 dark:text-white";
  const unitClass =
    dim === "muted"
      ? "text-stone-400 dark:text-stone-500"
      : "text-stone-500 dark:text-stone-400";
  const slotClass =
    flash === "correct"
      ? "text-emerald-500"
      : flash === "wrong" && isActive
        ? "text-rose-500"
        : `${theme.primaryText} ${theme.primaryTextDark}`;

  const slotText = isCompleted
    ? String(phase.expected)
    : isActive
      ? typed || "?"
      : "?";
  const slotIsSlot = isActive && !isCompleted;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-1.5 px-1 text-3xl font-black tabular-nums sm:gap-2.5 sm:text-4xl">
        <span className={numClass}>{phase.value}</span>
        <span className={`${unitClass} text-2xl sm:text-3xl`}>
          {phase.fromUnit}
        </span>
        <span className="text-stone-300 dark:text-stone-600">=</span>
        <span className={slotIsSlot ? slotClass : numClass}>{slotText}</span>
        <span className={`${unitClass} text-2xl sm:text-3xl`}>
          {phase.toUnit}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pick-op pad: replaces the numpad during pickOp phases.
// ---------------------------------------------------------------------------

function PickOpPad({
  onPick,
  theme,
}: {
  onPick: (op: "+" | "-") => void;
  theme: import("../lib/themes").Theme;
}) {
  // Buttons fill the same vertical space NumPad would occupy (4 rows of h-14 /
  // sm:h-16 + 3 gaps of 0.625rem). Keeping the pad height constant prevents
  // the prose/equation area above from jumping when phases swap between
  // pickOp and answer. The bonus is huge tap targets for the operator choice.
  const padHeight = "h-[15.875rem] sm:h-[17.875rem]";
  const btnClass = `flex ${padHeight} items-center justify-center rounded-2xl bg-white text-7xl font-black text-stone-900 shadow-sm ring-1 ring-stone-200 transition tabular-nums hover:ring-stone-300 active:scale-95 focus:outline-none focus-visible:ring-4 dark:bg-stone-900 dark:text-white dark:ring-stone-800 dark:hover:ring-stone-700 ${theme.primaryFocus}`;
  return (
    <div className="px-4 pt-2 pb-3 sm:pb-5">
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onPick("+")}
          aria-label="plus"
          className={btnClass}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onPick("-")}
          aria-label="minus"
          className={btnClass}
        >
          −
        </button>
      </div>
    </div>
  );
}
