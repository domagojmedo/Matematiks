import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfiles } from "../contexts/ProfilesContext";
import { trackEvent } from "../lib/analytics";
import { isTimeMode } from "../lib/format";
import { PROFILE_KEYS, profileKey, readJSON, writeJSON } from "../lib/storage";
import {
  type AnyLessonSetup,
  isWordSetup,
  type Operation,
  type ProblemRecord,
  type SessionRecord,
  SetupKind,
} from "../lib/types";

/**
 * Problem-shape-agnostic round runner.
 *
 * Owns:
 *   - round-level state (counters, streak, timer, leave modal)
 *   - persistence (writes the SessionRecord on completion or leave)
 *   - navigation away from the practice screen
 *   - the "current problem" via a caller-provided generator
 *
 * Caller owns:
 *   - per-problem visual state (typed buffer, phase advancement, flash, etc.)
 *   - per-attempt logging (the caller knows the phase kind / expected value /
 *     given value and assembles `ProblemAttempt` entries)
 *   - building the final `ProblemRecord` (with attempts + startedAtMs) and
 *     handing it to `commitProblem` when the kid finishes the problem
 *
 * Why caller-built records: word problems carry extra fields (templateId,
 * numbers, vars, kind="word") that arith problems don't. Generalising the
 * record-builder inside the hook would force a discriminated union and a
 * bunch of branching that the caller can do more naturally with the data
 * they already have.
 */
export function useRoundMechanics<P>({
  op,
  setup,
  lessonId,
  generate,
}: {
  op: Operation;
  setup: AnyLessonSetup;
  lessonId?: string;
  /**
   * Build the next problem. Called once at mount and once after every
   * successful `commitProblem`. The previous problem (or null on first call)
   * is passed so generators can avoid immediate repeats.
   */
  generate: (prev: P | null) => P;
}) {
  const navigate = useNavigate();
  const { profileId } = useProfiles();

  const totalRounds = setup.rounds;
  const timeMode = isTimeMode(setup);

  const [problem, setProblem] = useState<P>(() => generate(null));
  const [problemIndex, setProblemIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const roundStartedRef = useRef<number>(performance.now());
  const recordsRef = useRef<ProblemRecord[]>([]);
  const endedRef = useRef<boolean>(false);
  const timeoutsRef = useRef<number[]>([]);

  const nowMs = useCallback(
    () => performance.now() - roundStartedRef.current,
    [],
  );

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
        ...(lessonId ? { lessonId } : {}),
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
    [profileId, op, setup, lessonId, mistakes],
  );

  const modeTag = timeMode ? "time" : "count";
  // Word lessons coerce `op` to "addsub" for storage and chip rendering, but
  // we don't want them to inflate the addsub bucket in analytics. Tag them
  // explicitly as "word" so the analytics backend can split them out.
  const opTag: string = isWordSetup(setup) ? SetupKind.Word : op;

  const finishRound = useCallback(
    (records: ProblemRecord[], finalCorrect: number, finalBest: number) => {
      if (endedRef.current) return;
      endedRef.current = true;
      trackEvent(`round_completed/${opTag}/${modeTag}`);
      const id = persistSession(records, finalCorrect, finalBest);
      if (id) {
        navigate("/summary", { state: { sessionId: id }, replace: true });
      } else {
        navigate("/", { replace: true });
      }
    },
    [persistSession, navigate, opTag, modeTag],
  );

  const leaveAndSave = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    trackEvent(`round_abandoned/${opTag}/${modeTag}`);
    persistSession(recordsRef.current, correct, bestStreak);
    navigate("/", { replace: true });
  }, [persistSession, correct, bestStreak, navigate, opTag, modeTag]);

  const finishRoundFromTimeout = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    trackEvent(`round_completed/${opTag}/${modeTag}`);
    const id = persistSession(recordsRef.current, correct, bestStreak);
    if (id) {
      navigate("/summary", { state: { sessionId: id }, replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [persistSession, correct, bestStreak, navigate, opTag, modeTag]);

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

  const commitProblem = useCallback(
    (record: ProblemRecord) => {
      const newCorrect = correct + 1;
      const newStreak = streak + 1;
      const newBest = Math.max(bestStreak, newStreak);
      setCorrect(newCorrect);
      setStreak(newStreak);
      setBestStreak(newBest);

      if (!timeMode && problemIndex + 1 >= totalRounds) {
        finishRound([...recordsRef.current, record], newCorrect, newBest);
        return;
      }

      recordsRef.current = [...recordsRef.current, record];
      setProblemIndex((i) => i + 1);
      setProblem((prev) => generate(prev));
    },
    [
      correct,
      streak,
      bestStreak,
      problemIndex,
      totalRounds,
      timeMode,
      finishRound,
      generate,
    ],
  );

  const noteWrongAttempt = useCallback(() => {
    setMistakes((m) => m + 1);
    setStreak(0);
  }, []);

  const tryBack = useCallback(() => {
    const hasProgress = recordsRef.current.length > 0 || mistakes > 0;
    if (!hasProgress) {
      navigate("/");
    } else {
      setShowLeaveModal(true);
    }
  }, [navigate, mistakes]);

  return {
    problem,
    problemIndex,
    totalRounds,
    timeMode,
    elapsedMs,
    correct,
    mistakes,
    streak,
    bestStreak,
    showLeaveModal,
    setShowLeaveModal,
    nowMs,
    commitProblem,
    noteWrongAttempt,
    leaveAndSave,
    tryBack,
    trackedTimeout,
    setup,
  };
}
