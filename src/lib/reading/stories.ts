import { STORIES } from "./readingStories";
import type { ReadingLevel, Story } from "./readingTypes";
import { generateStory } from "./storyTemplates";

/**
 * Resolve a story id to a story.
 *
 * Two sources sit behind one lookup: the hand-written library, and the
 * level-2/3 generator. A generated id carries its own recipe (`gen-<level>-<seed>`),
 * so a generated story survives a page reload or a shared link without anything
 * being stored — regenerating from the seed yields exactly the same text.
 */
export function findStory(id: string): Story | undefined {
  const written = STORIES.find((story) => story.id === id);
  if (written) return written;

  const generated = id.match(/^gen-([23])-(.+)$/);
  if (generated) {
    const level = Number(generated[1]) as 2 | 3;
    return generateStory(level, generated[2]);
  }
  return undefined;
}

export function storiesForLevel(level: ReadingLevel): Story[] {
  return STORIES.filter((story) => story.level === level);
}

/**
 * A fresh generated story for the given level, seeded on the day so that
 * repeated visits within a day show the same one.
 */
export function generatedForDay(level: 2 | 3, day: string): Story {
  return generateStory(level, day);
}
