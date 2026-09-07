import { beforeEach, describe, expect, it } from "vitest";
import {
  canPromote,
  dayKey,
  EMPTY_PROGRESS,
  nextLevel,
  pickDailyStory,
  type ReadingProgress,
  readProgress,
  recordRead,
  storiesAtLevel,
  unreadAtLevel,
  writeProgress,
} from "./readingProgress";

const base = (overrides: Partial<ReadingProgress> = {}): ReadingProgress => ({
  ...EMPTY_PROGRESS,
  ...overrides,
});

describe("dayKey", () => {
  it("uses the local calendar day, not UTC", () => {
    // 23:30 local on the 5th must still be the 5th, whatever the offset is.
    expect(dayKey(new Date(2026, 8, 5, 23, 30))).toBe("2026-09-05");
    expect(dayKey(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  });
});

describe("recordRead", () => {
  it("starts a streak at 1 on the first ever read", () => {
    const next = recordRead(base(), {
      storyId: "a",
      wpm: 40,
      today: "2026-09-05",
    });
    expect(next.streak).toBe(1);
    expect(next.lastReadDay).toBe("2026-09-05");
    expect(next.read).toEqual(["a"]);
    expect(next.best.a).toBe(40);
  });

  it("advances the streak on a consecutive day", () => {
    const next = recordRead(base({ streak: 3, lastReadDay: "2026-09-04" }), {
      storyId: "a",
      wpm: 40,
      today: "2026-09-05",
    });
    expect(next.streak).toBe(4);
  });

  it("does not advance the streak twice in one day", () => {
    const next = recordRead(base({ streak: 3, lastReadDay: "2026-09-05" }), {
      storyId: "b",
      wpm: 40,
      today: "2026-09-05",
    });
    expect(next.streak).toBe(3);
  });

  it("restarts the streak at 1 after a gap", () => {
    // Restarting at 1 rather than 0: the child did just read something today.
    const next = recordRead(base({ streak: 9, lastReadDay: "2026-09-01" }), {
      storyId: "a",
      wpm: 40,
      today: "2026-09-05",
    });
    expect(next.streak).toBe(1);
  });

  it("keeps the better words-per-minute on a re-read", () => {
    const first = recordRead(base(), {
      storyId: "a",
      wpm: 55,
      today: "2026-09-05",
    });
    const slower = recordRead(first, {
      storyId: "a",
      wpm: 41,
      today: "2026-09-06",
    });
    expect(slower.best.a).toBe(55);
    const faster = recordRead(slower, {
      storyId: "a",
      wpm: 63,
      today: "2026-09-07",
    });
    expect(faster.best.a).toBe(63);
  });

  it("does not list the same story twice as read", () => {
    const once = recordRead(base(), {
      storyId: "a",
      wpm: 10,
      today: "2026-09-05",
    });
    const twice = recordRead(once, {
      storyId: "a",
      wpm: 20,
      today: "2026-09-06",
    });
    expect(twice.read).toEqual(["a"]);
  });
});

describe("pickDailyStory", () => {
  it("offers an unread story at the current level", () => {
    const story = pickDailyStory(base({ level: 2 }), "2026-09-05");
    expect(story).not.toBeNull();
    expect(story?.level).toBe(2);
  });

  it("is stable within a day and may differ across days", () => {
    const progress = base({ level: 4 });
    expect(pickDailyStory(progress, "2026-09-05")?.id).toBe(
      pickDailyStory(progress, "2026-09-05")?.id,
    );
    const week = new Set(
      ["05", "06", "07", "08", "09", "10", "11"].map(
        (d) => pickDailyStory(progress, `2026-09-${d}`)?.id,
      ),
    );
    expect(week.size).toBeGreaterThan(1);
  });

  it("falls back to the weakest story once the level is exhausted", () => {
    const level2 = storiesAtLevel(2);
    const best: Record<string, number> = {};
    for (const [i, story] of level2.entries()) best[story.id] = 100 + i;
    // Every story read; the first has the lowest recorded best.
    const progress = base({
      level: 2,
      read: level2.map((s) => s.id),
      best,
    });
    expect(unreadAtLevel(progress, 2)).toEqual([]);
    expect(pickDailyStory(progress, "2026-09-05")?.id).toBe(level2[0].id);
  });
});

describe("promotion", () => {
  it("offers promotion only once the level is exhausted", () => {
    expect(canPromote(base({ level: 2 }))).toBe(false);
    const done = base({ level: 2, read: storiesAtLevel(2).map((s) => s.id) });
    expect(canPromote(done)).toBe(true);
  });

  it("never promotes past level 6", () => {
    const done = base({ level: 6, read: storiesAtLevel(6).map((s) => s.id) });
    expect(canPromote(done)).toBe(false);
    expect(nextLevel(6)).toBe(6);
    expect(nextLevel(3)).toBe(4);
  });
});

describe("persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips through storage", () => {
    const progress = base({ level: 4, streak: 7, lastReadDay: "2026-09-05" });
    writeProgress("kid", progress);
    expect(readProgress("kid")).toEqual(progress);
  });

  it("falls back to defaults for a profile that has never read", () => {
    expect(readProgress("nobody")).toEqual(EMPTY_PROGRESS);
  });

  it("tolerates a partial stored shape rather than wiping a streak", () => {
    localStorage.setItem(
      "matematiks.kid.readingProgress",
      JSON.stringify({ streak: 5 }),
    );
    const progress = readProgress("kid");
    expect(progress.streak).toBe(5);
    expect(progress.level).toBe(2);
    expect(progress.best).toEqual({});
  });

  it("keeps reading progress out of the math session keys", () => {
    writeProgress("kid", base({ streak: 2 }));
    expect(localStorage.getItem("matematiks.kid.sessions")).toBeNull();
    expect(
      localStorage.getItem("matematiks.kid.readingProgress"),
    ).not.toBeNull();
  });
});
