import { describe, expect, it } from "vitest";
import { STORIES } from "./readingStories";
import { countSyllables } from "./syllabify";
import {
  allSyllables,
  mergeDrillsFromStories,
  syllableDrills,
} from "./syllableDrills";

describe("allSyllables", () => {
  it("pairs every consonant with every vowel", () => {
    const all = allSyllables();
    expect(all).toHaveLength(24 * 5);
    expect(all.slice(0, 5)).toEqual(["ma", "me", "mi", "mo", "mu"]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("produces only single-syllable, readable pairs", () => {
    for (const syllable of allSyllables()) {
      expect(countSyllables(syllable), syllable).toBe(1);
    }
  });

  it("keeps digraphs whole", () => {
    expect(allSyllables()).toContain("lja");
    expect(allSyllables()).toContain("nje");
    expect(allSyllables()).toContain("džu");
  });
});

describe("syllableDrills", () => {
  const rng = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("draws only from the first `breadth` consonants", () => {
    // breadth 2 → m and t only.
    const drills = syllableDrills(20, 2, rng([0, 0.3, 0.6, 0.9]));
    for (const drill of drills) {
      expect(["m", "t"]).toContain(drill.text[0]);
    }
  });

  it("returns the requested count", () => {
    expect(syllableDrills(12, 5, rng([0.1, 0.5, 0.8]))).toHaveLength(12);
  });

  it("never repeats the same card twice in a row", () => {
    // A constant rng would otherwise hand back the same syllable every time.
    const drills = syllableDrills(10, 4, () => 0);
    for (let i = 1; i < drills.length; i++) {
      expect(drills[i].text).not.toBe(drills[i - 1].text);
    }
  });

  it("survives a breadth of zero", () => {
    expect(syllableDrills(3, 0, () => 0)).toHaveLength(3);
  });
});

describe("mergeDrillsFromStories", () => {
  it("builds blending drills from real story vocabulary", () => {
    const drills = mergeDrillsFromStories(
      STORIES.filter((s) => s.level === 2),
      10,
    );
    expect(drills).toHaveLength(10);
    for (const drill of drills) {
      expect(drill.parts.length).toBeGreaterThan(1);
      expect(drill.parts.join("")).toBe(drill.word);
      expect(drill.word).toBe(drill.word.toLowerCase());
    }
  });

  it("skips single-syllable words, which cannot be blended", () => {
    const drills = mergeDrillsFromStories(STORIES, 50);
    for (const drill of drills) {
      expect(countSyllables(drill.word)).toBeGreaterThan(1);
    }
  });

  it("does not repeat a word", () => {
    const drills = mergeDrillsFromStories(STORIES, 60);
    const words = drills.map((d) => d.word);
    expect(new Set(words).size).toBe(words.length);
  });

  it("strips punctuation from the source sentence", () => {
    const drills = mergeDrillsFromStories(STORIES, 200);
    for (const drill of drills) {
      expect(drill.word).not.toMatch(/[.,!?;:]/);
    }
  });
});
