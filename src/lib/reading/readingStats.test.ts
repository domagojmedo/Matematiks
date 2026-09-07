import { describe, expect, it } from "vitest";
import {
  type SentenceTiming,
  slowestSentence,
  summarizeReading,
  wordsPerMinute,
} from "./readingStats";
import { STORIES } from "./readingStories";
import { storySentences } from "./readingTypes";

const story = STORIES.find((s) => s.id === "maca-i-lopta");
if (!story) throw new Error("fixture story missing");

const timings = (ms: number[], stumbleAt: number[] = []): SentenceTiming[] =>
  ms.map((value, index) => ({
    index,
    ms: value,
    stumbled: stumbleAt.includes(index),
  }));

describe("wordsPerMinute", () => {
  it("computes words per minute", () => {
    expect(wordsPerMinute(60, 60_000)).toBe(60);
    expect(wordsPerMinute(30, 60_000)).toBe(30);
    expect(wordsPerMinute(15, 30_000)).toBe(30);
  });

  it("rounds to a whole number", () => {
    // A child compares this against their own last score; decimals are noise.
    expect(Number.isInteger(wordsPerMinute(37, 41_300))).toBe(true);
  });

  it("returns 0 rather than Infinity for zero elapsed time", () => {
    expect(wordsPerMinute(10, 0)).toBe(0);
    expect(wordsPerMinute(10, -5)).toBe(0);
  });
});

describe("summarizeReading", () => {
  it("summarizes a clean read", () => {
    // 15 words over 30s = 30 wpm.
    const summary = summarizeReading({
      story,
      timings: timings([6000, 6000, 6000, 6000, 6000]),
      answers: [true],
      isReread: false,
    });
    expect(summary.words).toBe(15);
    expect(summary.durationMs).toBe(30_000);
    expect(summary.wpm).toBe(30);
    expect(summary.stumbles).toBe(0);
    expect(summary.questionsCorrect).toBe(1);
    expect(summary.questionsTotal).toBe(1);
    expect(summary.isReread).toBe(false);
    expect(summary.level).toBe(2);
  });

  it("counts stumbles and wrong answers", () => {
    const summary = summarizeReading({
      story,
      timings: timings([6000, 6000, 6000, 6000, 6000], [1, 3]),
      answers: [false],
      isReread: true,
    });
    expect(summary.stumbles).toBe(2);
    expect(summary.questionsCorrect).toBe(0);
    expect(summary.isReread).toBe(true);
  });
});

describe("slowestSentence", () => {
  it("picks the slowest sentence per word, not the longest", () => {
    const sentences = storySentences(story);
    // Sentence 0 takes longest in absolute terms but every sentence is 3 words,
    // so make sentence 2 the slowest per word instead.
    const result = slowestSentence(
      timings([5000, 3000, 9000, 3000, 3000]),
      sentences,
    );
    expect(result?.sentence).toBe(sentences[2]);
  });

  it("returns null when there are no timings", () => {
    expect(slowestSentence([], storySentences(story))).toBeNull();
  });

  it("ignores a timing that points past the end of the story", () => {
    const result = slowestSentence(
      [{ index: 99, ms: 10_000, stumbled: false }],
      storySentences(story),
    );
    expect(result).toBeNull();
  });
});
