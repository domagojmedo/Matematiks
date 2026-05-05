import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfiles } from "../contexts/ProfilesContext";
import { trackEvent } from "../lib/analytics";
import { isTimeMode } from "../lib/format";
import { generateProblem, type Problem } from "../lib/problemGen";
import { PROFILE_KEYS, profileKey, readJSON, writeJSON } from "../lib/storage";
import type {
  Operation,
  OperationSetup,
  ProblemRecord,
  SessionRecord,
} from "../lib/types";

/**
 * Shared round-runner. Owns problem advancement, counters, persistence, the
 * elapsed-time tick, and navigation away from /practice. Visual concerns
 * (flash, shake, typed buffer, layout) stay in the calling component.
 *
 * Caller responsibility:
 *   - call `recordCorrect(userAnswer)` exactly once per problem when the kid
 *     reaches the correct final answer (after any flash delay)
 *   - call `recordWrong()` for each wrong attempt within a problem
 *   - reset its own input state when `problem` changes (typically via a
 *     useEffect that watches `problem`)
 */
export function usePracticeRound(
  op: Operation,
  setup: OperationSetup,
  lessonId?: string,
) {
  const navigate = useNavigate();
  const { profileId } = useProfiles();

  const totalRounds = setup.rounds;
  const timeMode = isTimeMode(setup);

  const [problem, setProblem] = useState<Problem>(() =>
    generateProblem(op, setup),
  );
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

  const recordCorrect = useCallback(
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

  const recordWrong = useCallback(() => {
    setMistakes((m) => m + 1);
    setStreak(0);
    retriesRef.current += 1;
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
    // problem state
    problem,
    problemIndex,
    totalRounds,
    timeMode,
    elapsedMs,
    // counters
    correct,
    mistakes,
    streak,
    bestStreak,
    // modal
    showLeaveModal,
    setShowLeaveModal,
    // actions
    recordCorrect,
    recordWrong,
    leaveAndSave,
    tryBack,
    trackedTimeout,
    // pass-through
    setup,
  };
}
