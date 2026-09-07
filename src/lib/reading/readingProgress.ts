import { PROFILE_KEYS, profileKey, readJSON, writeJSON } from "../storage";
import { STORIES } from "./readingStories";
import type { ReadingLevel, Story } from "./readingTypes";

/**
 * Per-profile reading progress.
 *
 * Deliberately small and additive — it lives under its own storage key so the
 * math history on a real device needs no migration (rule §9.4). Unknown fields
 * on read are tolerated; missing ones fall back, so an older shape never wipes
 * a child's streak.
 */
export type ReadingProgress = {
  level: ReadingLevel;
  /** Story id → best words-per-minute for that story. */
  best: Record<string, number>;
  /** Story ids read at least once. */
  read: string[];
  /** Consecutive days with at least one story read. */
  streak: number;
  /** `YYYY-MM-DD` of the most recent reading day, or "" if never. */
  lastReadDay: string;
  /**
   * The level currently being browsed, which is not the same thing as `level`.
   * `level` is where the child is up to; this is what a grown-up last looked
   * at. Kept because returning from a story used to drop back to the child's
   * own level, so browsing level 4 and tapping "another story" bounced you to
   * level 2 every time.
   */
  browsingLevel: ReadingLevel;
};

export const EMPTY_PROGRESS: ReadingProgress = {
  level: 2,
  browsingLevel: 2,
  best: {},
  read: [],
  streak: 0,
  lastReadDay: "",
};

/** Local calendar day, not UTC — a streak should follow the child's midnight. */
export function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return Number.NaN;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function readProgress(profileId: string): ReadingProgress {
  const stored = readJSON<Partial<ReadingProgress>>(
    profileKey(profileId, PROFILE_KEYS.readingProgress),
    {},
  );
  return {
    level: stored.level ?? EMPTY_PROGRESS.level,
    best: stored.best ?? {},
    read: stored.read ?? [],
    streak: stored.streak ?? 0,
    lastReadDay: stored.lastReadDay ?? "",
    // Falls back to the child's own level the first time.
    browsingLevel: stored.browsingLevel ?? stored.level ?? EMPTY_PROGRESS.level,
  };
}

export function writeProgress(
  profileId: string,
  progress: ReadingProgress,
): void {
  writeJSON(profileKey(profileId, PROFILE_KEYS.readingProgress), progress);
}

/**
 * Fold one finished story into progress. Pure — the caller persists the result.
 *
 * The streak advances only on a *new* day: reading three stories on Tuesday is
 * still one day. A gap of two or more days restarts it at 1 rather than at 0,
 * because the child did just read something today.
 */
export function recordRead(
  progress: ReadingProgress,
  { storyId, wpm, today }: { storyId: string; wpm: number; today: string },
): ReadingProgress {
  const gap =
    progress.lastReadDay === ""
      ? null
      : daysBetween(progress.lastReadDay, today);
  let streak = progress.streak;
  if (progress.lastReadDay !== today) {
    streak = gap === 1 ? progress.streak + 1 : 1;
  }

  const previousBest = progress.best[storyId] ?? 0;
  return {
    ...progress,
    best: { ...progress.best, [storyId]: Math.max(previousBest, wpm) },
    read: progress.read.includes(storyId)
      ? progress.read
      : [...progress.read, storyId],
    streak,
    lastReadDay: today,
  };
}

export const storiesAtLevel = (level: ReadingLevel): Story[] =>
  STORIES.filter((story) => story.level === level);

export function unreadAtLevel(
  progress: ReadingProgress,
  level: ReadingLevel,
): Story[] {
  const read = new Set(progress.read);
  return storiesAtLevel(level).filter((story) => !read.has(story.id));
}

/**
 * The story offered as "Priča dana".
 *
 * Prefers an unread story at the child's level. When the level is exhausted it
 * falls back to the story with the *lowest* recorded best — the one where a
 * re-read has the most room to show improvement, and re-reading is the single
 * most effective fluency drill rather than a consolation prize.
 *
 * The daily pick is stable within a calendar day: the same `today` always
 * yields the same story, so closing the app does not reroll it.
 */
export function pickDailyStory(
  progress: ReadingProgress,
  today: string,
): Story | null {
  const unread = unreadAtLevel(progress, progress.level);
  if (unread.length > 0) {
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
      hash = (hash * 31 + today.charCodeAt(i)) >>> 0;
    }
    return unread[hash % unread.length];
  }

  const all = storiesAtLevel(progress.level);
  if (all.length === 0) return null;
  return all.reduce((worst, story) =>
    (progress.best[story.id] ?? 0) < (progress.best[worst.id] ?? 0)
      ? story
      : worst,
  );
}

/**
 * Whether the child has finished enough of their level to move up.
 *
 * Deliberately *not* automatic in the UI — a good week should not push a child
 * onto harder text they are not ready for, so this only surfaces the offer and
 * a grown-up confirms. Level 6 is the top, so it never promotes.
 */
export function canPromote(progress: ReadingProgress): boolean {
  if (progress.level >= 6) return false;
  return unreadAtLevel(progress, progress.level).length === 0;
}

export function nextLevel(level: ReadingLevel): ReadingLevel {
  return Math.min(level + 1, 6) as ReadingLevel;
}

/**
 * The next story to read after finishing one — the "keep going" path.
 *
 * Prefers something unread at the same level, so a child working through a
 * level does not get handed the same two stories back. Falls back to any other
 * story at that level once the level is exhausted, and returns null only when
 * the level has nothing else at all.
 *
 * The story just finished is always excluded: offering "next" and reopening
 * the same page reads as a broken button.
 */
export function pickNextStory(
  progress: ReadingProgress,
  level: ReadingLevel,
  excludeId: string,
  random: () => number = Math.random,
): Story | null {
  const unread = unreadAtLevel(progress, level).filter(
    (story) => story.id !== excludeId,
  );
  const pool =
    unread.length > 0
      ? unread
      : storiesAtLevel(level).filter((story) => story.id !== excludeId);
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)];
}
