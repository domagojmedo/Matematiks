import { describe, expect, it } from "vitest";
import {
  checkSentence,
  describeViolation,
  questionLevel,
} from "./readingLevels";
import { storySentences } from "./readingTypes";
import { generateStory } from "./storyTemplates";

/**
 * The generator is held to exactly the same decodability guard as the
 * hand-written library. A vocabulary entry that breaks its level fails here
 * rather than stalling a child mid-page — which is the whole reason generating
 * these levels is safe to do at all.
 */
describe("generated stories", () => {
  const seeds = Array.from({ length: 200 }, (_, i) => `seed-${i}`);

  it.each([
    2, 3,
  ] as const)("keeps every generated level-%i story within its level", (level) => {
    const failures: string[] = [];
    for (const seed of seeds) {
      const story = generateStory(level, seed);
      for (const sentence of storySentences(story)) {
        for (const violation of checkSentence(sentence, level)) {
          failures.push(`[${seed}] ${describeViolation(violation)}`);
        }
      }
      for (const question of story.questions) {
        for (const text of [question.prompt, ...question.options]) {
          for (const violation of checkSentence(text, questionLevel(level))) {
            if (violation.kind === "sentenceLength") continue;
            failures.push(
              `[${seed}] question: ${describeViolation(violation)}`,
            );
          }
        }
      }
    }
    expect([...new Set(failures)]).toEqual([]);
  });

  it("is deterministic for a given seed", () => {
    expect(generateStory(2, "monday")).toEqual(generateStory(2, "monday"));
    expect(generateStory(3, "monday")).toEqual(generateStory(3, "monday"));
  });

  it("varies across seeds", () => {
    const titles = new Set(
      seeds.slice(0, 50).map((seed) => generateStory(2, seed).title),
    );
    expect(titles.size).toBeGreaterThan(5);
  });

  it("produces the expected sentence count per level", () => {
    expect(storySentences(generateStory(2, "a"))).toHaveLength(5);
    expect(storySentences(generateStory(3, "a"))).toHaveLength(8);
  });

  it("always has a question with a valid answer index", () => {
    for (const seed of seeds.slice(0, 40)) {
      for (const level of [2, 3] as const) {
        const story = generateStory(level, seed);
        expect(story.questions).toHaveLength(1);
        const question = story.questions[0];
        expect(question.expectedIndex).toBeGreaterThanOrEqual(0);
        expect(question.expectedIndex).toBeLessThan(question.options.length);
        expect(new Set(question.options).size).toBe(question.options.length);
      }
    }
  });

  it("does not always put the answer first", () => {
    const positions = new Set(
      seeds.map((seed) => generateStory(2, seed).questions[0].expectedIndex),
    );
    expect(positions.size).toBeGreaterThan(1);
  });

  /**
   * Croatian predicate adjectives take the indefinite form after `je`:
   * "Med je nov", never "Med je novi". The definite form is the one a
   * dictionary lists, so this is easy to get wrong and invisible to the
   * decodability guard, which measures difficulty rather than grammar.
   */
  it("uses indefinite adjective forms in predicates", () => {
    const definiteForms =
      /\bje (mali|novi|veliki|lijepi|zeleni|topli|žuti|fini|tihi)\b/;
    // Self-check: a guard that cannot fail is not a guard.
    expect("Med je novi.").toMatch(definiteForms);
    expect("Med je nov.").not.toMatch(definiteForms);

    for (const level of [2, 3] as const) {
      for (const seed of seeds) {
        for (const sentence of storySentences(generateStory(level, seed))) {
          expect(sentence, `L${level} ${seed}`).not.toMatch(definiteForms);
        }
      }
    }
  });

  it("never names the same character twice in one story", () => {
    for (const seed of seeds.slice(0, 60)) {
      const story = generateStory(3, seed);
      // Frames use two distinct names and two distinct nouns; if pickDistinct
      // ever regressed, sentences like "Mia gleda ... Mia nosi" would read wrong.
      const text = storySentences(story).join(" ");
      expect(text).not.toMatch(
        /\b(\w+) (?:gleda|nosi) .*\b\1 (?:gleda|nosi)\b/,
      );
    }
  });
});
