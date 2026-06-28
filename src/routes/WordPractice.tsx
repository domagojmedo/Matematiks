import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { AnswerInput } from "../components/AnswerInput";
import { FractionVisual } from "../components/FractionVisual";
import { MiniBarChart } from "../components/MiniBarChart";
import { ColumnQuestion } from "../components/questions/ColumnQuestion";
import { HorizontalQuestion } from "../components/questions/HorizontalQuestion";
import { QuestionScaffold } from "../components/RoundChrome";
import { ShapeDiagram } from "../components/ShapeDiagram";
import { ShapeGlyph } from "../components/ShapeGlyphs";
import { useProfiles } from "../contexts/ProfilesContext";
import { CombinedGenerator, type RoundQuestion } from "../lib/combine";
import { findLesson, isWordLesson, type Lesson } from "../lib/lessons";
import { operationForWordKinds, wordChip } from "../lib/operations";
import { PROFILE_KEYS, profileKey, writeJSON } from "../lib/storage";
import {
  type AttemptToken,
  type LastSession,
  type ProblemAttempt,
  type ProblemRecord,
  SetupKind,
  type WordLessonSetup,
} from "../lib/types";
import { WordGenerator } from "../lib/wordGen";
import { findTemplate } from "../lib/wordTemplates";
import {
  buildSteps,
  finalInputPhase,
  phaseAtStep,
  type WordChoicePhase,
  type WordComparePhase,
  type WordConvertPhase,
  type WordFractionPhase,
  type WordPhase,
  type WordPickOpPhase,
  type WordProblem,
  type WordSolvePhase,
  type WordStepView,
} from "../lib/wordTypes";
import { type QuestionApi, RoundHost } from "./RoundHost";

const FLASH_MS = 400;
// Largest answer across word lessons is a 5-digit convert (10 kg → 10000 g).
// Arith word phases peak at 2 digits — extra digits there get rejected by the
// length check anyway, so a single cap covers both.
const MAX_DIGITS = 5;

type Flash = "correct" | "wrong" | null;

export function WordPractice() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const location = useLocation();
  // A combined multi-select round (and Quick Start replay) arrives with the
  // setup on router state and no resolvable lesson id. Prefer it.
  const state = location.state as {
    setup?: WordLessonSetup;
    title?: string;
  } | null;
  if (state?.setup) {
    const s = state.setup;
    // A combined multi-select round carries lessonIds → render each question
    // in its native component (word / horizontal / column).
    if (s.lessonIds && s.lessonIds.length > 0) {
      return (
        <CombinedRound setup={s} title={state.title ?? "lessons.combined"} />
      );
    }
    return (
      <WordRound
        lessonId={lessonId ?? "combined"}
        setup={s}
        nameKey={state.title ?? "lessons.combined"}
      />
    );
  }
  const lesson = lessonId ? findLesson(lessonId) : undefined;
  if (!isWordLesson(lesson)) {
    return <Navigate to="/" replace />;
  }
  return (
    <WordRound
      lessonId={lesson.id}
      setup={lesson.setup}
      nameKey={lesson.nameKey}
    />
  );
}

/** Resolves the round (generator + chrome) and delegates each problem to a
 * WordQuestion via RoundHost. Combined rounds rebuild a mixed template pool
 * from the selected lesson ids. */
function WordRound({
  lessonId,
  setup,
  nameKey,
}: {
  lessonId: string;
  setup: WordLessonSetup;
  nameKey: string;
}) {
  const { t } = useTranslation();
  const { profileId } = useProfiles();
  const sessionOp = operationForWordKinds(setup.wordKinds);
  const chip = wordChip(setup.wordKinds);

  // Stamp this round as the new "last session" so Home's Quick Start can
  // replay it.
  useEffect(() => {
    const last: LastSession = { operation: sessionOp, setup, lessonId };
    writeJSON(profileKey(profileId, PROFILE_KEYS.lastSession), last);
  }, [profileId, lessonId, setup, sessionOp]);

  // One generator per round, held in a ref so re-renders don't reset the
  // stratified queue.
  const generatorRef = useRef<WordGenerator | null>(null);
  if (generatorRef.current === null) {
    generatorRef.current = new WordGenerator(setup);
  }
  const generate = useCallback(
    (prev: WordProblem | null) =>
      (generatorRef.current as WordGenerator).next(prev),
    [],
  );

  return (
    <RoundHost<WordProblem>
      op={sessionOp}
      setup={setup}
      lessonId={lessonId}
      chip={{ tone: chip.tone, symbol: chip.symbol, label: t(nameKey) }}
      generate={generate}
      renderQuestion={(problem, api) => (
        <WordQuestion problem={problem} api={api} />
      )}
    />
  );
}

/** A combined multi-select round: rebuilds the generator from the selected
 * lesson ids and renders each problem in its native component. */
function CombinedRound({
  setup,
  title,
}: {
  setup: WordLessonSetup;
  title: string;
}) {
  const { t } = useTranslation();
  const { profileId } = useProfiles();
  const sessionOp = operationForWordKinds(setup.wordKinds);
  const chip = wordChip(setup.wordKinds);

  useEffect(() => {
    const last: LastSession = {
      operation: sessionOp,
      setup,
      lessonId: "combined",
    };
    writeJSON(profileKey(profileId, PROFILE_KEYS.lastSession), last);
  }, [profileId, setup, sessionOp]);

  const generatorRef = useRef<CombinedGenerator | null>(null);
  if (generatorRef.current === null) {
    const lessons = (setup.lessonIds ?? [])
      .map(findLesson)
      .filter((l): l is Lesson => l !== undefined);
    generatorRef.current = new CombinedGenerator(lessons, setup);
  }
  const generate = useCallback(
    () => (generatorRef.current as CombinedGenerator).next(),
    [],
  );

  return (
    <RoundHost<RoundQuestion>
      op={sessionOp}
      setup={setup}
      lessonId="combined"
      chip={{ tone: chip.tone, symbol: chip.symbol, label: t(title) }}
      generate={generate}
      renderQuestion={(q, api) =>
        q.kind === "word" ? (
          <WordQuestion problem={q.problem} api={api} />
        ) : q.format === "column" ? (
          <ColumnQuestion problem={q.problem} guide={q.guide} api={api} />
        ) : (
          <HorizontalQuestion problem={q.problem} api={api} />
        )
      }
    />
  );
}

/** A single word problem: prose + phase steps + the matching pad. Numeric
 * phases (answer/convert/solve/fraction) accept voice; pickOp/compare/choice
 * are tap-only. */
export function WordQuestion({
  problem,
  api,
}: {
  problem: WordProblem;
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

  const phases = problem.phases;
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const attemptsRef = useRef<ProblemAttempt[]>([]);
  const startedAtRef = useRef<number>(nowMs());

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
      let userAnswer: number;
      if (finalPhase.kind === "answer") {
        a = finalPhase.a;
        b = finalPhase.b;
        op = finalPhase.op;
        answer = finalPhase.result;
        userAnswer = finalPhase.expected;
      } else if (finalPhase.kind === "convert") {
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
        userAnswer = finalPhase.expected;
      } else if (
        finalPhase.kind === "solve" ||
        finalPhase.kind === "fraction"
      ) {
        // solve/fraction: prompt-driven single answer with no a/b equation.
        // Synthesize a
        // trivial one so the Sessions list / SessionDetail row still renders;
        // the real content is the template prose, carried by templateId/numbers.
        a = finalPhase.expected;
        b = 0;
        op = "+";
        answer = finalPhase.expected;
        userAnswer = finalPhase.expected;
      } else if (finalPhase.kind === "compare") {
        // compare: non-numeric (</=/>). Record the difference so the history row
        // still has a sensible numeric equation; correctness lives in attempts.
        a = finalPhase.a;
        b = finalPhase.b;
        op = "-";
        answer = finalPhase.a - finalPhase.b;
        userAnswer = answer;
      } else {
        // choice: non-numeric (tap an option). Record the index so the row is
        // valid; correctness lives in attempts.
        a = finalPhase.expectedIndex;
        b = 0;
        op = "+";
        answer = finalPhase.expectedIndex;
        userAnswer = answer;
      }
      return {
        a,
        b,
        op,
        answer,
        userAnswer,
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
      given: number | AttemptToken,
      expected: number | AttemptToken,
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
      noteWrong();
      trackedTimeout(() => {
        setFlash(null);
        setShaking(false);
        setTyped("");
      }, FLASH_MS);
    },
    [phaseIdx, noteWrong, trackedTimeout, nowMs, setShaking, setFlash],
  );

  const advancePhase = useCallback(() => {
    const isLast = phaseIdx + 1 >= phases.length;
    if (isLast) {
      commit(buildRecord(attemptsRef.current));
    } else {
      setPhaseIdx((i) => i + 1);
      setTyped("");
    }
  }, [phaseIdx, phases.length, commit, buildRecord]);

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
      setFlash,
    ],
  );

  // Appends a batch of digits at once — a single recognized number ("10") or one
  // tap. Batching keeps multi-digit handwriting from racing on stale `typed`.
  const handleDigits = useCallback(
    (ns: number[]) => {
      if (flash) return;
      if (
        !currentPhase ||
        (currentPhase.kind !== "answer" &&
          currentPhase.kind !== "convert" &&
          currentPhase.kind !== "solve" &&
          currentPhase.kind !== "fraction")
      )
        return;
      let next = typed;
      for (const n of ns) {
        if (next.length >= MAX_DIGITS) break;
        next += String(n);
      }
      if (next === typed) return;
      setTyped(next);
      // Convert/solve/fraction phases use an explicit confirm key — the kid enters
      // the full answer and presses ✓. Without that, the auto-submit-on-match
      // below would mark "200" correct when they meant to enter "2000".
      if (
        currentPhase.kind === "convert" ||
        currentPhase.kind === "solve" ||
        currentPhase.kind === "fraction"
      )
        return;
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
      setFlash,
    ],
  );

  const handleDigit = useCallback(
    (n: number) => handleDigits([n]),
    [handleDigits],
  );

  const handleConfirm = useCallback(() => {
    if (flash) return;
    if (
      !currentPhase ||
      (currentPhase.kind !== "convert" &&
        currentPhase.kind !== "solve" &&
        currentPhase.kind !== "fraction")
    )
      return;
    if (typed.length === 0) return;
    const parsed = Number.parseInt(typed, 10);
    const expected = currentPhase.expected;
    if (Number.isFinite(parsed) && parsed === expected) {
      attemptsRef.current.push({
        phaseIndex: phaseIdx,
        phaseKind: currentPhase.kind,
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
      handleWrong(parsed, expected, currentPhase.kind);
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
    setFlash,
  ]);

  const handleDelete = useCallback(() => {
    if (flash) return;
    setTyped("");
  }, [flash]);

  const handleCompare = useCallback(
    (rel: "<" | "=" | ">") => {
      if (flash) return;
      if (!currentPhase || currentPhase.kind !== "compare") return;
      const expected = currentPhase.expected;
      if (rel === expected) {
        attemptsRef.current.push({
          phaseIndex: phaseIdx,
          phaseKind: "compare",
          given: rel,
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
        handleWrong(rel, expected, "compare");
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
      setFlash,
    ],
  );

  const handleChoice = useCallback(
    (index: number) => {
      if (flash) return;
      if (!currentPhase || currentPhase.kind !== "choice") return;
      const expected = currentPhase.expectedIndex;
      if (index === expected) {
        attemptsRef.current.push({
          phaseIndex: phaseIdx,
          phaseKind: "choice",
          given: index,
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
        handleWrong(index, expected, "choice");
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
      setFlash,
    ],
  );

  // Submits a full number for the current numeric phase — used by the voice and
  // (potential) full-recognition paths. pickOp/compare/choice phases ignore it.
  const submitFullAnswer = useCallback(
    (n: number) => {
      if (flash) return;
      if (!currentPhase) return;
      if (
        currentPhase.kind !== "answer" &&
        currentPhase.kind !== "convert" &&
        currentPhase.kind !== "solve" &&
        currentPhase.kind !== "fraction"
      ) {
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
      setFlash,
    ],
  );

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
      if (currentPhase?.kind === "compare") {
        if (e.key === "<" || e.key === "=" || e.key === ">") {
          e.preventDefault();
          handleCompare(e.key);
        }
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(Number(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleDelete();
      } else if (
        e.key === "Enter" &&
        (currentPhase?.kind === "convert" ||
          currentPhase?.kind === "solve" ||
          currentPhase?.kind === "fraction")
      ) {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    handleDigit,
    handleDelete,
    handlePickOp,
    handleConfirm,
    handleCompare,
    currentPhase,
  ]);

  // ----- Rendering ----------------------------------------------------------

  const template = findTemplate(problem.templateId);
  const proseText = template ? template.renderProse(problem) : "";
  const steps = useMemo(() => buildSteps(phases), [phases]);

  return (
    <>
      <QuestionScaffold
        flash={flash}
        theme={theme}
        progressRatio={progressRatio}
        problemLabel={problemLabel}
      >
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
      </QuestionScaffold>

      {currentPhase?.kind === "pickOp" ? (
        <PickOpPad onPick={handlePickOp} theme={theme} />
      ) : currentPhase?.kind === "compare" ? (
        <ComparePad onPick={handleCompare} theme={theme} />
      ) : currentPhase?.kind === "choice" ? (
        <ChoicePad
          options={currentPhase.options}
          onPick={handleChoice}
          theme={theme}
        />
      ) : currentPhase?.kind === "convert" ||
        currentPhase?.kind === "solve" ||
        currentPhase?.kind === "fraction" ? (
        <AnswerInput
          onDigits={handleDigits}
          onDelete={handleDelete}
          onConfirm={handleConfirm}
          confirmDisabled={typed.length === 0}
          voice={{
            language: settings.language,
            onNumber: submitFullAnswer,
            gateKey: phaseIdx,
          }}
          theme={theme}
          flash={flash}
          trackedTimeout={trackedTimeout}
        />
      ) : (
        <AnswerInput
          onDigits={handleDigits}
          onDelete={handleDelete}
          voice={{
            language: settings.language,
            onNumber: submitFullAnswer,
            gateKey: phaseIdx,
          }}
          theme={theme}
          flash={flash}
          trackedTimeout={trackedTimeout}
        />
      )}
    </>
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
  if (inputPhase.kind === "solve") {
    return (
      <SolveStepLine
        phase={inputPhase}
        isActive={phaseIdx === step.answerIdx}
        isCompleted={phaseIdx > step.answerIdx}
        typed={typed}
        flash={flash}
        theme={theme}
      />
    );
  }
  if (inputPhase.kind === "compare") {
    return (
      <CompareStepLine
        phase={inputPhase}
        isActive={phaseIdx === step.answerIdx}
        isCompleted={phaseIdx > step.answerIdx}
        flash={flash}
        theme={theme}
      />
    );
  }
  if (inputPhase.kind === "fraction") {
    return (
      <FractionStepLine
        phase={inputPhase}
        isActive={phaseIdx === step.answerIdx}
        isCompleted={phaseIdx > step.answerIdx}
        typed={typed}
        flash={flash}
        theme={theme}
      />
    );
  }
  if (inputPhase.kind === "choice") {
    return (
      <ChoiceStepLine
        phase={inputPhase}
        isCompleted={phaseIdx > step.answerIdx}
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
  const opGlyph = (op: "+" | "-" | "*" | "/"): string =>
    op === "+" ? "+" : op === "-" ? "−" : op === "*" ? "×" : "÷";
  const opDisplay: string =
    isPickOpActive || isPending ? "?" : opGlyph(answer.op);

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

function SolveStepLine({
  phase,
  isActive,
  isCompleted,
  typed,
  flash,
  theme,
}: {
  phase: WordSolvePhase;
  isActive: boolean;
  isCompleted: boolean;
  typed: string;
  flash: Flash;
  theme: import("../lib/themes").Theme;
}) {
  const dim = isCompleted ? "muted" : "live";
  const promptClass =
    dim === "muted"
      ? "text-stone-400 dark:text-stone-500"
      : "text-stone-900 dark:text-white";
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
    <div className="flex flex-col gap-3">
      {phase.shape && (
        <ShapeDiagram width={phase.shape.width} height={phase.shape.height} />
      )}
      {phase.chart && (
        <MiniBarChart
          labels={phase.chart.labels}
          values={phase.chart.values}
          theme={theme}
        />
      )}
      <div className="flex items-baseline gap-1.5 px-1 text-3xl font-black tabular-nums sm:gap-2.5 sm:text-4xl">
        {phase.prompt && (
          <span className={`${promptClass} text-2xl sm:text-3xl`}>
            {phase.prompt}
          </span>
        )}
        <span className="text-stone-300 dark:text-stone-600">=</span>
        <span className={slotIsSlot ? slotClass : promptClass}>{slotText}</span>
      </div>
    </div>
  );
}

function FractionStepLine({
  phase,
  isActive,
  isCompleted,
  typed,
  flash,
  theme,
}: {
  phase: WordFractionPhase;
  isActive: boolean;
  isCompleted: boolean;
  typed: string;
  flash: Flash;
  theme: import("../lib/themes").Theme;
}) {
  const numClass = isCompleted
    ? "text-stone-400 dark:text-stone-500"
    : "text-stone-900 dark:text-white";
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
  return (
    <div className="flex flex-col items-center gap-3">
      <FractionVisual parts={phase.parts} shaded={phase.shaded} theme={theme} />
      {/* numerator / denominator: kid types the numerator */}
      <div className="flex flex-col items-center text-3xl font-black tabular-nums sm:text-4xl">
        <span className={isActive && !isCompleted ? slotClass : numClass}>
          {slotText}
        </span>
        <span className="my-0.5 h-0.5 w-8 rounded bg-stone-400 dark:bg-stone-500" />
        <span className={numClass}>{phase.parts}</span>
      </div>
    </div>
  );
}

function CompareStepLine({
  phase,
  isActive,
  isCompleted,
  flash,
  theme,
}: {
  phase: WordComparePhase;
  isActive: boolean;
  isCompleted: boolean;
  flash: Flash;
  theme: import("../lib/themes").Theme;
}) {
  const dim = isCompleted ? "muted" : "live";
  const numClass =
    dim === "muted"
      ? "text-stone-400 dark:text-stone-500"
      : "text-stone-900 dark:text-white";
  const relClass =
    flash === "correct"
      ? "text-emerald-500"
      : flash === "wrong" && isActive
        ? "text-rose-500"
        : `${theme.primaryText} ${theme.primaryTextDark}`;
  const relText = isCompleted ? phase.expected : "?";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-1.5 px-1 text-3xl font-black tabular-nums sm:gap-2.5 sm:text-4xl">
        <span className={numClass}>{phase.a}</span>
        <span className={isCompleted ? numClass : relClass}>{relText}</span>
        <span className={numClass}>{phase.b}</span>
      </div>
    </div>
  );
}

function ChoiceStepLine({
  phase,
  isCompleted,
  theme,
}: {
  phase: WordChoicePhase;
  isCompleted: boolean;
  theme: import("../lib/themes").Theme;
}) {
  if (!phase.glyph) return null; // text-only choices need no equation row
  return (
    <div className="flex justify-center py-2">
      <div className={isCompleted ? "opacity-50" : theme.primaryText}>
        <ShapeGlyph kind={phase.glyph} size={104} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Choice pad: one button per option, shown during choice phases.
// ---------------------------------------------------------------------------

function ChoicePad({
  options,
  onPick,
  theme,
}: {
  options: string[];
  onPick: (index: number) => void;
  theme: import("../lib/themes").Theme;
}) {
  const btnClass = `flex min-h-14 items-center justify-center rounded-2xl bg-white px-4 py-3 text-xl font-black text-stone-900 shadow-sm ring-1 ring-stone-200 transition hover:ring-stone-300 active:scale-95 focus:outline-none focus-visible:ring-4 dark:bg-stone-900 dark:text-white dark:ring-stone-800 dark:hover:ring-stone-700 ${theme.primaryFocus}`;
  return (
    <div className="px-4 pt-2 pb-3 sm:pb-5">
      <div className="flex flex-col gap-2.5">
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => onPick(i)}
            className={btnClass}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compare pad: three relation buttons, shown during compare phases.
// ---------------------------------------------------------------------------

function ComparePad({
  onPick,
  theme,
}: {
  onPick: (rel: "<" | "=" | ">") => void;
  theme: import("../lib/themes").Theme;
}) {
  const padHeight = "h-[15.875rem] sm:h-[17.875rem]";
  const btnClass = `flex ${padHeight} items-center justify-center rounded-2xl bg-white text-6xl font-black text-stone-900 shadow-sm ring-1 ring-stone-200 transition tabular-nums hover:ring-stone-300 active:scale-95 focus:outline-none focus-visible:ring-4 dark:bg-stone-900 dark:text-white dark:ring-stone-800 dark:hover:ring-stone-700 ${theme.primaryFocus}`;
  const rels: Array<"<" | "=" | ">"> = ["<", "=", ">"];
  return (
    <div className="px-4 pt-2 pb-3 sm:pb-5">
      <div className="grid grid-cols-3 gap-2.5">
        {rels.map((rel) => (
          <button
            key={rel}
            type="button"
            onClick={() => onPick(rel)}
            aria-label={rel}
            className={btnClass}
          >
            {rel}
          </button>
        ))}
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
