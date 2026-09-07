/**
 * Level 1: syllable and blending drills.
 *
 * Level 1 has no stories — under a "no clusters, two syllables" ceiling
 * Croatian has too few usable words to build one. What a child at this stage
 * needs is not narrative but *blending*: seeing `m` + `a` become `ma` without
 * sounding out each letter, then `ma` + `ma` become `mama`.
 *
 * Consonants are ordered roughly as a Croatian bukvar introduces them, so a
 * child working through the drill meets familiar letters first. This is
 * ordering only — the module assumes every letter is already known (that is
 * the whole premise of the app), so nothing is gated on it.
 */

import type { Story } from "./readingTypes";
import { syllabify } from "./syllabify";

const VOWELS = ["a", "e", "i", "o", "u"] as const;

/** Bukvar-ish teaching order. `dž`, `lj`, `nj` come last — they are hardest. */
const CONSONANTS = [
  "m",
  "t",
  "n",
  "s",
  "l",
  "k",
  "v",
  "p",
  "d",
  "r",
  "j",
  "b",
  "g",
  "z",
  "c",
  "š",
  "ž",
  "č",
  "ć",
  "h",
  "f",
  "lj",
  "nj",
  "dž",
] as const;

export type SyllableDrill = { kind: "syllable"; text: string };
export type MergeDrill = { kind: "merge"; parts: string[]; word: string };
export type Drill = SyllableDrill | MergeDrill;

/**
 * Every open (consonant + vowel) syllable, in teaching order: `ma me mi mo mu`,
 * then `ta te ti to tu`, and so on. 120 in total.
 */
export function allSyllables(): string[] {
  const out: string[] = [];
  for (const consonant of CONSONANTS) {
    for (const vowel of VOWELS) {
      out.push(consonant + vowel);
    }
  }
  return out;
}

/**
 * A drill run: `count` syllables drawn from the first `breadth` consonants, so
 * an early session stays inside a handful of familiar letters instead of
 * ranging across the whole alphabet.
 */
export function syllableDrills(
  count: number,
  breadth: number,
  pick: () => number,
): SyllableDrill[] {
  const consonants = CONSONANTS.slice(0, Math.max(1, breadth));
  const pool: string[] = [];
  for (const consonant of consonants) {
    for (const vowel of VOWELS) pool.push(consonant + vowel);
  }
  const out: SyllableDrill[] = [];
  let previous = "";
  for (let i = 0; i < count; i++) {
    let text = pool[Math.floor(pick() * pool.length)];
    // Avoid handing the child the same card twice in a row.
    if (text === previous && pool.length > 1) {
      text = pool[(pool.indexOf(text) + 1) % pool.length];
    }
    out.push({ kind: "syllable", text });
    previous = text;
  }
  return out;
}

/**
 * Blending drills built from the words the child is about to meet in stories,
 * so the warm-up primes the actual text rather than an unrelated word list.
 * Only words that split into two or more syllables are usable.
 */
export function mergeDrillsFromStories(
  stories: Story[],
  limit: number,
): MergeDrill[] {
  const seen = new Set<string>();
  const out: MergeDrill[] = [];
  for (const story of stories) {
    for (const sentence of story.paragraphs.flat()) {
      for (const raw of sentence.split(/\s+/)) {
        const word = raw.replace(/[.,!?;:]/g, "").toLowerCase();
        if (word.length === 0 || seen.has(word)) continue;
        const parts = syllabify(word);
        if (parts.length < 2) continue;
        seen.add(word);
        out.push({ kind: "merge", parts, word });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}
