import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingSession,
  flushPendingSession,
  writePendingSession,
} from "./pendingSession";
import { PROFILE_KEYS, profileKey, readJSON } from "./storage";
import { type ProblemRecord, type SessionRecord, SetupKind } from "./types";

const PROFILE = "p1";
const pendingKey = profileKey(PROFILE, PROFILE_KEYS.pendingSession);
const sessionsKey = profileKey(PROFILE, PROFILE_KEYS.sessions);

function record(): ProblemRecord {
  return {
    a: 2,
    b: 3,
    op: "+",
    answer: 5,
    userAnswer: 5,
    tookMs: 1000,
    retries: 0,
    startedAtMs: 0,
    attempts: [],
  };
}

function session(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "s-1",
    date: new Date().toISOString(),
    operation: "add",
    setup: { kind: SetupKind.Range, rounds: 10, min: 1, max: 20 },
    correct: 1,
    mistakes: 0,
    durationMs: 1000,
    bestStreak: 1,
    problems: [record()],
    ...over,
  };
}

describe("pendingSession", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("flush is a no-op when nothing is pending", () => {
    flushPendingSession(PROFILE);
    expect(localStorage.getItem(sessionsKey)).toBeNull();
  });

  it("write → flush moves the checkpoint to the head of history and consumes it", () => {
    writePendingSession(PROFILE, session({ id: "interrupted" }));
    flushPendingSession(PROFILE);

    const all = readJSON<SessionRecord[]>(sessionsKey, []);
    expect(all[0]?.id).toBe("interrupted");
    expect(localStorage.getItem(pendingKey)).toBeNull();

    // Second flush must not duplicate it.
    flushPendingSession(PROFILE);
    expect(readJSON<SessionRecord[]>(sessionsKey, [])).toHaveLength(1);
  });

  it("flush prepends to existing history, newest first", () => {
    localStorage.setItem(sessionsKey, JSON.stringify([session({ id: "old" })]));
    writePendingSession(PROFILE, session({ id: "new" }));
    flushPendingSession(PROFILE);

    const all = readJSON<SessionRecord[]>(sessionsKey, []);
    expect(all.map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("discards an empty checkpoint (no problems, no mistakes) without touching history", () => {
    writePendingSession(PROFILE, session({ problems: [], mistakes: 0 }));
    flushPendingSession(PROFILE);
    expect(localStorage.getItem(sessionsKey)).toBeNull();
    expect(localStorage.getItem(pendingKey)).toBeNull();
  });

  it("keeps a mistakes-only checkpoint (kid never got one right)", () => {
    writePendingSession(PROFILE, session({ problems: [], mistakes: 3 }));
    flushPendingSession(PROFILE);
    expect(readJSON<SessionRecord[]>(sessionsKey, [])).toHaveLength(1);
  });

  it("discards a malformed checkpoint instead of corrupting history", () => {
    localStorage.setItem(pendingKey, JSON.stringify({ nonsense: true }));
    flushPendingSession(PROFILE);
    expect(localStorage.getItem(sessionsKey)).toBeNull();
    expect(localStorage.getItem(pendingKey)).toBeNull();
  });

  it("respects the 200-session history cap", () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      session({ id: `s-${i}` }),
    );
    localStorage.setItem(sessionsKey, JSON.stringify(many));
    writePendingSession(PROFILE, session({ id: "overflow" }));
    flushPendingSession(PROFILE);

    const all = readJSON<SessionRecord[]>(sessionsKey, []);
    expect(all).toHaveLength(200);
    expect(all[0]?.id).toBe("overflow");
  });

  it("clearPendingSession removes the checkpoint", () => {
    writePendingSession(PROFILE, session());
    clearPendingSession(PROFILE);
    flushPendingSession(PROFILE);
    expect(localStorage.getItem(sessionsKey)).toBeNull();
  });
});
