import type { ReadingLevel, Story } from "./readingTypes";
import { storyWordCount } from "./readingTypes";

/** One sentence, as actually read. */
export type SentenceTiming = {
  index: number;
  ms: number;
  /** The child re-read this line — tapped "Ponovi" rather than "Dalje". */
  stumbled: boolean;
};

export type ReadingSessionRecord = {
  id: string;
  /** ISO timestamp. */
  date: string;
  storyId: string;
  storyTitle: string;
  level: ReadingLevel;
  words: number;
  durationMs: number;
  wpm: number;
  stumbles: number;
  questionsCorrect: number;
  questionsTotal: number;
  /** True when this story had been read before — a record attempt, not a first pass. */
  isReread: boolean;
  /** Per-sentence timings, so a later screen can show where the child slowed down. */
  timings: SentenceTiming[];
};

/**
 * Words per minute — the standard reading-fluency measure.
 *
 * Rounded to a whole number because a child compares this against their own
 * previous score, and 62 vs 61.7 is noise dressed up as progress. Guards
 * against a zero elapsed time, which a fast double-tap can genuinely produce.
 */
export function wordsPerMinute(words: number, ms: number): number {
  if (ms <= 0) return 0;
  return Math.round((words / ms) * 60_000);
}

/**
 * Above this, the taps came faster than speech.
 *
 * A fluent adult reads *aloud* at roughly 150–200 wpm; a child working on
 * fluency is well under that. 300 leaves generous headroom for a fast older
 * reader while still catching the real failure mode: someone tapping "Dalje"
 * straight through without reading, which produces four-figure numbers.
 */
export const MAX_PLAUSIBLE_WPM = 300;

/**
 * Whether a finished read is a usable measurement.
 *
 * This matters more than it looks. `recordRead` keeps the *best* score
 * forever, and the history chart scales every bar against the peak — so one
 * fast-tapped run would sit at the top of that story permanently, make a
 * genuine record impossible to beat, and squash every real session in the
 * trend down to a sliver. The trend is the entire point of the module, so an
 * implausible read is discarded rather than stored, exactly as a partial read
 * is.
 */
export function isPlausibleRead(wpm: number): boolean {
  return wpm > 0 && wpm <= MAX_PLAUSIBLE_WPM;
}

export function summarizeReading({
  story,
  timings,
  answers,
  isReread,
}: {
  story: Story;
  timings: SentenceTiming[];
  /** One entry per question: was it answered correctly? */
  answers: boolean[];
  isReread: boolean;
}): Omit<ReadingSessionRecord, "id" | "date"> {
  const durationMs = timings.reduce((total, t) => total + t.ms, 0);
  const words = storyWordCount(story);
  return {
    storyId: story.id,
    storyTitle: story.title,
    level: story.level,
    words,
    durationMs,
    wpm: wordsPerMinute(words, durationMs),
    stumbles: timings.filter((t) => t.stumbled).length,
    questionsCorrect: answers.filter(Boolean).length,
    questionsTotal: answers.length,
    isReread,
    timings,
  };
}

/**
 * The slowest sentence of the round, for the summary screen. Compares on ms
 * per word rather than raw ms — otherwise it would always name the longest
 * sentence, which tells the child nothing.
 */
export function slowestSentence(
  timings: SentenceTiming[],
  sentences: string[],
): { sentence: string; msPerWord: number } | null {
  let worst: { sentence: string; msPerWord: number } | null = null;
  for (const timing of timings) {
    const sentence = sentences[timing.index];
    if (sentence === undefined) continue;
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    if (wordCount === 0) continue;
    const msPerWord = timing.ms / wordCount;
    if (worst === null || msPerWord > worst.msPerWord) {
      worst = { sentence, msPerWord };
    }
  }
  return worst;
}
