/**
 * Reading-module domain types.
 *
 * Level 1 is syllable drill only and has no stories, so the story levels start
 * at 2. Levels are gated on *word shape* — syllable count and consonant
 * clusters — rather than on which letters have been taught: the target kid
 * already knows the alphabet, and Croatian is near-phonetic, so length and
 * clusters are what actually stall a new reader.
 */

export type ReadingLevel = 2 | 3 | 4 | 5 | 6;

export const READING_LEVELS: ReadingLevel[] = [2, 3, 4, 5, 6];

export type ReadingQuestion = {
  prompt: string;
  /** Presented in this order; shuffling is the caller's business. */
  options: string[];
  expectedIndex: number;
};

export type Story = {
  id: string;
  level: ReadingLevel;
  title: string;
  /**
   * Sentences grouped into paragraphs. The reading screen shows the whole
   * story at once — like a page of a book — and highlights one sentence at a
   * time, so the paragraph shape is part of the content, not decoration.
   */
  paragraphs: string[][];
  questions: ReadingQuestion[];
};

/** Every sentence in reading order, paragraph breaks discarded. */
export function storySentences(story: Story): string[] {
  return story.paragraphs.flat();
}

/**
 * Words in the story. This is the denominator for words-per-minute, so it
 * counts what a child actually reads aloud — the title is excluded.
 */
export function storyWordCount(story: Story): number {
  return storySentences(story).reduce(
    (total, sentence) => total + splitWords(sentence).length,
    0,
  );
}

/**
 * Strip punctuation and split a sentence into bare words, lowercased.
 * Used by both the word count and the level guard, so they can never disagree
 * about what counts as a word.
 */
export function splitWords(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[.,!?;:"“”„–—()]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);
}
