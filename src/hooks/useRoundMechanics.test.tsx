/**
 * Multi-problem lifecycle tests for `useRoundMechanics`.
 *
 * Scope: this exercises the hook's own contract — that `commitProblem`
 * advances `problemIndex`, regenerates `problem` via the supplied generator,
 * and stops generating once the planned round ends.
 *
 * Out of scope: the *caller-side* per-problem reset (typed buffer, attempts,
 * started-at timestamp). That regression — the original B1 — is covered by
 * `usePerProblemReset.test.tsx` and the production routes consuming that
 * hook. A consumer here that didn't use `usePerProblemReset` would not
 * catch a caller-side regression.
 */
import { act, render } from "@testing-library/react";
import { useRef, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { ProfilesProvider } from "../contexts/ProfilesContext";
import { writePendingSession } from "../lib/pendingSession";
import { getActiveProfileId } from "../lib/profiles";
import { PROFILE_KEYS, profileKey, readJSON } from "../lib/storage";
import {
  type ProblemAttempt,
  type ProblemRecord,
  type SessionRecord,
  SetupKind,
  type WordLessonSetup,
} from "../lib/types";
import { useRoundMechanics } from "./useRoundMechanics";

type FakeProblem = { id: number };

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <ProfilesProvider>{children}</ProfilesProvider>
    </MemoryRouter>
  );
}

const SETUP: WordLessonSetup = {
  kind: SetupKind.Word,
  wordKinds: ["vocab"],
  rounds: 5,
};

/**
 * Test consumer that mirrors the reset pattern used by Practice / WordPractice.
 * Exposes its internal state via a ref so the test can inspect it directly.
 */
function makeConsumer(observed: {
  attempts: ProblemAttempt[];
  startedAtMs: number;
  resetCount: number;
  commit: ((rec: ProblemRecord) => void) | null;
  noteWrong: (() => void) | null;
  problem: FakeProblem | null;
  problemIndex: number;
}) {
  let nextProblemId = 0;
  const generate = () => ({ id: nextProblemId++ });

  return function Consumer() {
    const round = useRoundMechanics<FakeProblem>({
      op: "addsub",
      setup: SETUP,
      lessonId: "test-lesson",
      generate,
    });

    const attemptsRef = useRef<ProblemAttempt[]>([]);
    const startedAtRef = useRef<number>(round.nowMs());
    const [lastProblem, setLastProblem] = useState(round.problem);
    if (round.problem !== lastProblem) {
      setLastProblem(round.problem);
      attemptsRef.current = [];
      startedAtRef.current = round.nowMs();
      observed.resetCount += 1;
    }

    // Sync observed view of state every render so assertions can read latest.
    observed.attempts = attemptsRef.current;
    observed.startedAtMs = startedAtRef.current;
    observed.problem = round.problem;
    observed.problemIndex = round.problemIndex;
    observed.commit = round.commitProblem;
    observed.noteWrong = round.noteWrongAttempt;

    return null;
  };
}

describe("useRoundMechanics — multi-problem lifecycle", () => {
  it("resets per-problem refs on the second problem", async () => {
    const observed = {
      attempts: [] as ProblemAttempt[],
      startedAtMs: -1,
      resetCount: 0,
      commit: null as ((rec: ProblemRecord) => void) | null,
      noteWrong: null as (() => void) | null,
      problem: null as FakeProblem | null,
      problemIndex: -1,
    };
    const Consumer = makeConsumer(observed);

    render(
      <Wrap>
        <Consumer />
      </Wrap>,
    );

    // Problem 1 mounted. The reset pattern's `useState` initializer sets
    // `lastProblem === problem` on first render, so no reset fires at mount.
    expect(observed.resetCount).toBe(0);
    expect(observed.problem?.id).toBe(0);
    expect(observed.problemIndex).toBe(0);

    // Pretend the kid had two wrong attempts on problem 1.
    act(() => {
      observed.noteWrong?.();
      observed.noteWrong?.();
    });
    observed.attempts.push(
      {
        phaseIndex: 0,
        phaseKind: "answer",
        given: 1,
        expected: 2,
        correct: false,
        atMs: 100,
      },
      {
        phaseIndex: 0,
        phaseKind: "answer",
        given: 3,
        expected: 2,
        correct: false,
        atMs: 200,
      },
    );
    expect(observed.attempts).toHaveLength(2);

    // Commit problem 1 — round mechanics generates problem 2.
    act(() => {
      observed.commit?.({
        a: 1,
        b: 1,
        op: "+",
        answer: 2,
        userAnswer: 2,
        tookMs: 300,
        retries: 2,
        startedAtMs: 0,
        attempts: [],
      });
    });

    // Problem advanced.
    expect(observed.problem?.id).toBe(1);
    expect(observed.problemIndex).toBe(1);
    // The reset must have fired exactly once — when problem identity changed.
    // This is the assertion that catches the previous biome-stripped
    // useEffect bug, where the reset never fired after mount.
    expect(observed.resetCount).toBe(1);
    // Refs must be cleared for the new problem.
    expect(observed.attempts).toHaveLength(0);
  });

  it("commitProblem on the last round persists session and stops generating", async () => {
    // 2-round setup so we can exhaust it quickly.
    const tiny: WordLessonSetup = {
      kind: SetupKind.Word,
      wordKinds: ["vocab"],
      rounds: 2,
    };
    let nextId = 0;
    const generate = () => ({ id: nextId++ });

    const observed = {
      problemIndex: -1,
      problem: null as FakeProblem | null,
      commit: null as ((rec: ProblemRecord) => void) | null,
    };

    function Consumer() {
      const round = useRoundMechanics<FakeProblem>({
        op: "addsub",
        setup: tiny,
        lessonId: "test-lesson-tiny",
        generate,
      });
      observed.problemIndex = round.problemIndex;
      observed.problem = round.problem;
      observed.commit = round.commitProblem;
      return null;
    }

    const baseRecord: ProblemRecord = {
      a: 1,
      b: 1,
      op: "+",
      answer: 2,
      userAnswer: 2,
      tookMs: 0,
      retries: 0,
      startedAtMs: 0,
      attempts: [],
    };

    render(
      <Wrap>
        <Consumer />
      </Wrap>,
    );

    expect(observed.problemIndex).toBe(0);
    act(() => observed.commit?.(baseRecord));
    expect(observed.problemIndex).toBe(1);

    // The component navigates to /summary on final commit; we only assert
    // that no further problem is generated past the planned count.
    act(() => observed.commit?.(baseRecord));
    // problemIndex stays at 1 because the round ended (no more setProblemIndex).
    expect(observed.problemIndex).toBe(1);
  });
});

describe("useRoundMechanics — mid-round checkpoint", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const baseRecord: ProblemRecord = {
    a: 1,
    b: 1,
    op: "+",
    answer: 2,
    userAnswer: 2,
    tookMs: 0,
    retries: 0,
    startedAtMs: 0,
    attempts: [],
  };

  function renderRound(rounds: number) {
    const tiny: WordLessonSetup = {
      kind: SetupKind.Word,
      wordKinds: ["vocab"],
      rounds,
    };
    let nextId = 0;
    const generate = () => ({ id: nextId++ });
    const observed = {
      commit: null as ((rec: ProblemRecord) => void) | null,
      noteWrong: null as (() => void) | null,
    };
    function Consumer() {
      const round = useRoundMechanics<FakeProblem>({
        op: "addsub",
        setup: tiny,
        generate,
      });
      observed.commit = round.commitProblem;
      observed.noteWrong = round.noteWrongAttempt;
      return null;
    }
    render(
      <Wrap>
        <Consumer />
      </Wrap>,
    );
    const profileId = getActiveProfileId();
    if (!profileId) throw new Error("no active profile after render");
    return {
      observed,
      pendingKey: profileKey(profileId, PROFILE_KEYS.pendingSession),
      sessionsKey: profileKey(profileId, PROFILE_KEYS.sessions),
      profileId,
    };
  }

  it("writes a checkpoint after each committed problem", () => {
    const { observed, pendingKey } = renderRound(5);
    expect(localStorage.getItem(pendingKey)).toBeNull();

    act(() => observed.commit?.(baseRecord));
    const pending = readJSON<SessionRecord | null>(pendingKey, null);
    expect(pending?.problems).toHaveLength(1);
    expect(pending?.correct).toBe(1);

    act(() => observed.commit?.(baseRecord));
    const pending2 = readJSON<SessionRecord | null>(pendingKey, null);
    expect(pending2?.problems).toHaveLength(2);
  });

  it("writes a checkpoint after a wrong attempt with no completed problems", () => {
    const { observed, pendingKey } = renderRound(5);
    act(() => observed.noteWrong?.());
    const pending = readJSON<SessionRecord | null>(pendingKey, null);
    expect(pending?.mistakes).toBe(1);
    expect(pending?.problems).toHaveLength(0);
  });

  it("clears the checkpoint when the round finishes normally", () => {
    const { observed, pendingKey, sessionsKey } = renderRound(2);
    act(() => observed.commit?.(baseRecord));
    expect(localStorage.getItem(pendingKey)).not.toBeNull();

    act(() => observed.commit?.(baseRecord));
    expect(localStorage.getItem(pendingKey)).toBeNull();
    const sessions = readJSON<SessionRecord[]>(sessionsKey, []);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.problems).toHaveLength(2);
  });

  it("flushes a leftover checkpoint into history when a new round mounts", () => {
    // Simulate an interrupted round: seed a checkpoint for the profile that
    // ensureProfilesInitialized will resolve, then mount a fresh round.
    const first = renderRound(5);
    writePendingSession(first.profileId, {
      id: "interrupted",
      date: new Date().toISOString(),
      operation: "add",
      setup: { kind: SetupKind.Range, rounds: 100, min: 1, max: 20 },
      correct: 63,
      mistakes: 2,
      durationMs: 60000,
      bestStreak: 20,
      problems: [baseRecord],
    });

    const second = renderRound(5);
    expect(localStorage.getItem(second.pendingKey)).toBeNull();
    const sessions = readJSON<SessionRecord[]>(second.sessionsKey, []);
    expect(sessions[0]?.id).toBe("interrupted");
  });
});
