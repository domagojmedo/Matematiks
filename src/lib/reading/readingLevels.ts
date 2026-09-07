import type { ReadingLevel } from "./readingTypes";
import { splitWords } from "./readingTypes";
import { countSyllables, maxClusterSize } from "./syllabify";

/**
 * What makes a story belong to a level.
 *
 * These are difficulty *ceilings*, not targets. The three that matter for a
 * Croatian beginner, in order of how much they hurt:
 *
 *   - `maxCluster` — consonants inside one syllable. `ško-la` is 2, `str-` is 3.
 *     This is the real bottleneck; Croatian is near-phonetic, so a child who
 *     knows the letters stalls on clusters long before they stall on length.
 *   - `maxSyllables` — word length.
 *   - `maxSentenceWords` — how much has to be held in working memory at once.
 *
 * The numbers were set by measuring the written library rather than guessed up
 * front, then tightening the handful of outliers in the source markdown until
 * every story fit. Loosening one to admit a new story is the wrong move: it
 * silently reclassifies every story already at that level.
 */
export type LevelSpec = {
  maxSyllables: number;
  maxCluster: number;
  maxSentenceWords: number;
};

export const LEVEL_SPECS: Record<ReadingLevel, LevelSpec> = {
  2: { maxSyllables: 2, maxCluster: 1, maxSentenceWords: 4 },
  3: { maxSyllables: 3, maxCluster: 2, maxSentenceWords: 6 },
  4: { maxSyllables: 5, maxCluster: 3, maxSentenceWords: 9 },
  5: { maxSyllables: 6, maxCluster: 3, maxSentenceWords: 12 },
  6: { maxSyllables: 7, maxCluster: 4, maxSentenceWords: 16 },
};

export type Violation = {
  kind: "syllables" | "cluster" | "sentenceLength";
  sentence: string;
  /** The offending word, or the sentence itself for a length violation. */
  word: string;
  actual: number;
  allowed: number;
};

/**
 * Check one sentence against a level. Returns every violation rather than the
 * first, so a content edit gets the whole list in one run.
 */
export function checkSentence(
  sentence: string,
  level: ReadingLevel,
): Violation[] {
  const spec = LEVEL_SPECS[level];
  const words = splitWords(sentence);
  const violations: Violation[] = [];

  if (words.length > spec.maxSentenceWords) {
    violations.push({
      kind: "sentenceLength",
      sentence,
      word: sentence,
      actual: words.length,
      allowed: spec.maxSentenceWords,
    });
  }

  for (const word of words) {
    const syllables = countSyllables(word);
    if (syllables > spec.maxSyllables) {
      violations.push({
        kind: "syllables",
        sentence,
        word,
        actual: syllables,
        allowed: spec.maxSyllables,
      });
    }
    const cluster = maxClusterSize(word);
    if (cluster > spec.maxCluster) {
      violations.push({
        kind: "cluster",
        sentence,
        word,
        actual: cluster,
        allowed: spec.maxCluster,
      });
    }
  }

  return violations;
}

/**
 * The level a story's *question* text is held to: one step up, capped at 6.
 *
 * Question text cannot meet the same ceiling as story text, and not because of
 * sloppy writing — Croatian interrogatives are themselves clusters. `tko`,
 * `što` and `gdje` are 2, 2 and 3 consonants deep, so a level-2 question is
 * impossible to phrase within a level-2 cluster limit. Colour names (`crvena`,
 * `bijela`) are similarly irreducible.
 *
 * The headroom is one level rather than none: the child still reads this text,
 * and without any ceiling a question could quietly drift far past the story it
 * belongs to.
 */
export function questionLevel(level: ReadingLevel): ReadingLevel {
  return Math.min(level + 1, 6) as ReadingLevel;
}

export function describeViolation(v: Violation): string {
  if (v.kind === "sentenceLength") {
    return `${v.actual} words (max ${v.allowed}): "${v.sentence}"`;
  }
  const what = v.kind === "syllables" ? "syllables" : "consonant cluster";
  return `"${v.word}" has ${v.actual} ${what} (max ${v.allowed}) in "${v.sentence}"`;
}
