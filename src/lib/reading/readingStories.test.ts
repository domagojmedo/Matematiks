import { describe, expect, it } from "vitest";
import {
  checkSentence,
  describeViolation,
  questionLevel,
} from "./readingLevels";
import { STORIES } from "./readingStories";
import {
  READING_LEVELS,
  type ReadingLevel,
  splitWords,
  storySentences,
  storyWordCount,
} from "./readingTypes";

/**
 * The decodability guard.
 *
 * This is the load-bearing test of the reading module. It walks every sentence
 * of every story and asserts the words fit the level the story claims. Without
 * it, a level-3 story quietly acquires `zvjezdica` during an edit and stalls a
 * child mid-page — the kind of regression no type checker catches and no
 * reviewer reliably spots by eye.
 *
 * `readingStories.ts` is generated from the markdown in `docs/specs/`, so when
 * this fails the fix belongs in the markdown, followed by
 * `node scripts/build-reading-stories.mjs`.
 */
describe("story registry", () => {
  it("has the expected number of stories per level", () => {
    const byLevel = new Map<ReadingLevel, number>();
    for (const story of STORIES) {
      byLevel.set(story.level, (byLevel.get(story.level) ?? 0) + 1);
    }
    expect(byLevel.get(2)).toBe(10);
    expect(byLevel.get(3)).toBe(10);
    expect(byLevel.get(4)).toBe(40);
    expect(byLevel.get(5)).toBe(40);
    expect(byLevel.get(6)).toBe(40);
    expect(STORIES).toHaveLength(140);
  });

  it("gives every story a unique id", () => {
    const ids = STORIES.map((story) => story.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every story a title, sentences and at least one question", () => {
    for (const story of STORIES) {
      expect(story.title.length, story.id).toBeGreaterThan(0);
      expect(storySentences(story).length, story.id).toBeGreaterThan(0);
      expect(story.questions.length, story.id).toBeGreaterThan(0);
    }
  });

  it("only uses known levels", () => {
    for (const story of STORIES) {
      expect(READING_LEVELS, story.id).toContain(story.level);
    }
  });
});

describe("comprehension questions", () => {
  it("points expectedIndex at a real option", () => {
    for (const story of STORIES) {
      for (const question of story.questions) {
        expect(question.options.length, story.id).toBeGreaterThanOrEqual(2);
        expect(question.expectedIndex, story.id).toBeGreaterThanOrEqual(0);
        expect(question.expectedIndex, story.id).toBeLessThan(
          question.options.length,
        );
      }
    }
  });

  it("has no duplicate options within a question", () => {
    for (const story of STORIES) {
      for (const question of story.questions) {
        const unique = new Set(question.options);
        expect(unique.size, `${story.id}: ${question.prompt}`).toBe(
          question.options.length,
        );
      }
    }
  });

  /**
   * The markdown lists the correct answer first for readability, and the
   * generator shuffles. If that shuffle ever regressed, every answer would sit
   * at index 0 and a child would learn to tap the first option without reading.
   */
  it("does not park every answer in the same position", () => {
    const counts = new Map<number, number>();
    for (const story of STORIES) {
      for (const question of story.questions) {
        counts.set(
          question.expectedIndex,
          (counts.get(question.expectedIndex) ?? 0) + 1,
        );
      }
    }
    expect(counts.size).toBeGreaterThan(1);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    for (const count of counts.values()) {
      expect(count / total).toBeLessThan(0.6);
    }
  });
});

describe("decodability guard", () => {
  it("keeps every story within its level", () => {
    const failures: string[] = [];
    for (const story of STORIES) {
      for (const sentence of storySentences(story)) {
        for (const violation of checkSentence(sentence, story.level)) {
          failures.push(
            `L${story.level} [${story.id}] ${describeViolation(violation)}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  /**
   * Question text is read too, so it is guarded — but one level up, because
   * Croatian interrogatives (`tko`, `što`, `gdje`) are clusters in themselves
   * and cannot be phrased down to a level-2 ceiling. See `questionLevel`.
   * Sentence length is exempt: a prompt plus its options is a different shape
   * from a narrative sentence.
   */
  it("keeps question text within one level of the story", () => {
    const failures: string[] = [];
    for (const story of STORIES) {
      const level = questionLevel(story.level);
      for (const question of story.questions) {
        for (const text of [question.prompt, ...question.options]) {
          for (const violation of checkSentence(text, level)) {
            if (violation.kind === "sentenceLength") continue;
            failures.push(
              `L${story.level} [${story.id}] ${describeViolation(violation)}`,
            );
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("flags a word that is too hard for its level", () => {
    // Sanity check on the guard itself: a level-2 story must not accept this.
    const violations = checkSentence("Zvjezdica blista.", 2);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.map((v) => v.kind)).toContain("syllables");
  });
});

describe("story metrics", () => {
  it("counts words for words-per-minute", () => {
    const story = STORIES.find((s) => s.id === "maca-i-lopta");
    expect(story).toBeDefined();
    if (!story) return;
    // "Maca je mala." + "Maca ima loptu." + "Lopta je tu."
    //   + "Mama zove macu." + "Maca ide mami."
    expect(storyWordCount(story)).toBe(3 + 3 + 3 + 3 + 3);
  });

  it("strips punctuation when splitting words", () => {
    expect(splitWords("Potoci su presušili, a lokve nestale.")).toEqual([
      "potoci",
      "su",
      "presušili",
      "a",
      "lokve",
      "nestale",
    ]);
  });
});
