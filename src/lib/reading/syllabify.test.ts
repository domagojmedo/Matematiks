import { describe, expect, it } from "vitest";
import { countSyllables, maxClusterSize, syllabify } from "./syllabify";

/**
 * Hand-checked against how Croatian primers divide words. Where the
 * orthography permits two splits (`lop-ta` / `lo-pta`), the expectation is the
 * one a child is taught.
 */
const SPLITS: [string, string[]][] = [
  // Single consonant between vowels joins the following syllable.
  ["mama", ["ma", "ma"]],
  ["kuća", ["ku", "ća"]],
  ["baka", ["ba", "ka"]],
  ["voda", ["vo", "da"]],
  ["maca", ["ma", "ca"]],
  ["lopata", ["lo", "pa", "ta"]],

  // Two or more consonants: the first closes the syllable.
  ["lopta", ["lop", "ta"]],
  ["sunce", ["sun", "ce"]],
  ["sestra", ["ses", "tra"]],
  ["torba", ["tor", "ba"]],
  ["jastuk", ["jas", "tuk"]],

  // Leading clusters ride with the first syllable.
  ["škola", ["ško", "la"]],
  ["zvono", ["zvo", "no"]],
  ["trava", ["tra", "va"]],
  ["snijeg", ["sni", "jeg"]],

  // ije / je sequences are separate nuclei, not one unit.
  ["mlijeko", ["mli", "je", "ko"]],
  ["zvijezda", ["zvi", "jez", "da"]],
  ["vrijeme", ["vri", "je", "me"]],
  ["cvijet", ["cvi", "jet"]],

  // Adjacent vowels each take a syllable.
  ["auto", ["a", "u", "to"]],
  ["nauka", ["na", "u", "ka"]],

  // Digraphs stay whole.
  ["ljeto", ["lje", "to"]],
  ["njiva", ["nji", "va"]],
  ["džemper", ["džem", "per"]],
  ["konji", ["ko", "nji"]],
  ["ljubav", ["lju", "bav"]],

  // Syllabic r.
  ["crta", ["cr", "ta"]],
  ["grlo", ["gr", "lo"]],
  ["brzo", ["br", "zo"]],
  ["drvo", ["dr", "vo"]],
  ["srce", ["sr", "ce"]],
  ["četvrtak", ["čet", "vr", "tak"]],

  // Non-syllabic r — a vowel neighbour on either side disqualifies it.
  ["riba", ["ri", "ba"]],
  ["more", ["mo", "re"]],
  ["mirna", ["mir", "na"]],
  ["ruka", ["ru", "ka"]],
];

const SINGLE_SYLLABLE = [
  "pas",
  "vuk",
  "sir",
  "med",
  "nos",
  "zub",
  "kruh",
  "konj",
  "džep",
  // Syllabic r carries these on its own.
  "prst",
  "vrt",
  "krv",
  "trg",
  "smrt",
  "vrh",
  "crn",
  "rt",
];

describe("syllabify", () => {
  it.each(SPLITS)("splits %s", (word, expected) => {
    expect(syllabify(word)).toEqual(expected);
  });

  it.each(SINGLE_SYLLABLE)("keeps %s as one syllable", (word) => {
    expect(syllabify(word)).toEqual([word]);
  });

  it("preserves the original casing", () => {
    expect(syllabify("Mama")).toEqual(["Ma", "ma"]);
    expect(syllabify("Zvijezda")).toEqual(["Zvi", "jez", "da"]);
  });

  it("rejoins to the original word", () => {
    for (const [word] of SPLITS) {
      expect(syllabify(word).join("")).toBe(word);
    }
  });

  it("returns an empty list for an empty string", () => {
    expect(syllabify("")).toEqual([]);
  });

  it("returns a word with no nucleus unchanged", () => {
    // Not Croatian, but the guard must not produce an empty list.
    expect(syllabify("kt")).toEqual(["kt"]);
  });
});

describe("countSyllables", () => {
  it("agrees with syllabify", () => {
    for (const [word, expected] of SPLITS) {
      expect(countSyllables(word)).toBe(expected.length);
    }
  });

  it("counts a syllabic r as a nucleus", () => {
    expect(countSyllables("prst")).toBe(1);
    expect(countSyllables("četvrtak")).toBe(3);
  });
});

describe("maxClusterSize", () => {
  it("is 1 when every syllable is CV or CVC", () => {
    expect(maxClusterSize("mama")).toBe(1);
    expect(maxClusterSize("lopta")).toBe(1);
    expect(maxClusterSize("sunce")).toBe(1);
    expect(maxClusterSize("kuća")).toBe(1);
  });

  it("counts an onset cluster", () => {
    expect(maxClusterSize("škola")).toBe(2);
    expect(maxClusterSize("trava")).toBe(2);
    expect(maxClusterSize("zvijezda")).toBe(2);
    expect(maxClusterSize("stric")).toBe(3);
  });

  it("counts a coda cluster", () => {
    expect(maxClusterSize("Reks")).toBe(2);
  });

  it("does not count a syllabic r as part of a cluster", () => {
    // p | r | st — the r is the nucleus, so the worst run is the st coda.
    expect(maxClusterSize("prst")).toBe(2);
    expect(maxClusterSize("crta")).toBe(1);
  });
});
