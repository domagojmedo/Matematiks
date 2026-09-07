/**
 * Croatian syllabification.
 *
 * Two facts drive the whole algorithm:
 *
 *   1. A syllable nucleus is one of `a e i o u` — OR a *syllabic* `r`, an `r`
 *      with no vowel on either side. That is why `prst` and `vrt` are one
 *      syllable each while `cr-ta` is two.
 *   2. `dž`, `lj` and `nj` are single letters and must never be split across a
 *      boundary. (`đ` is already one code point, so it needs no special case.)
 *
 * The division rule is the one Croatian primers teach, not strict onset
 * maximisation:
 *
 *   - one consonant between nuclei  → it joins the *following* syllable
 *     (`ma-ma`, `ku-ća`)
 *   - two or more                   → the first stays behind, the rest move on
 *     (`lop-ta`, `sun-ce`, `ses-tra`, `zvi-jez-da`)
 *   - leading consonants join the first syllable (`ško-la`), trailing ones the
 *     last (`prst`)
 *
 * Strict onset maximisation would give `lo-pta` — defensible, since `ptica`
 * proves `pt` is a legal Croatian onset, but not what a child is taught to see.
 *
 * Known limit: a prefix boundary that happens to spell a digraph is read as the
 * digraph (`nadživjeti` → `nad|živjeti` is not detected). The reading corpus is
 * controlled vocabulary, so no such word reaches this function.
 */

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const DIGRAPHS = ["dž", "lj", "nj"];

type Unit = {
  /** Lowercased letter or digraph. */
  text: string;
  /** Index into the original string where this unit starts. */
  start: number;
  /** Index one past the end of this unit in the original string. */
  end: number;
};

/** Split a word into letters, keeping `dž`/`lj`/`nj` together. */
function toUnits(word: string): Unit[] {
  const lower = word.toLowerCase();
  const units: Unit[] = [];
  let i = 0;
  while (i < lower.length) {
    const pair = lower.slice(i, i + 2);
    if (DIGRAPHS.includes(pair)) {
      units.push({ text: pair, start: i, end: i + 2 });
      i += 2;
    } else {
      units.push({ text: lower[i], start: i, end: i + 1 });
      i += 1;
    }
  }
  return units;
}

const isVowel = (unit: Unit | undefined): boolean =>
  unit !== undefined && VOWELS.has(unit.text);

/**
 * True when this unit acts as a syllable nucleus. Vowels always do; `r` does
 * only when neither neighbour is a vowel, which is what makes `prst` a word.
 */
function isNucleus(units: Unit[], index: number): boolean {
  const unit = units[index];
  if (VOWELS.has(unit.text)) return true;
  if (unit.text !== "r") return false;
  return !isVowel(units[index - 1]) && !isVowel(units[index + 1]);
}

/**
 * Split a single word into its syllables, preserving the original casing.
 * A word with no nucleus at all (punctuation, a stray consonant) comes back as
 * a single chunk rather than an empty list, so callers never have to special-case it.
 */
export function syllabify(word: string): string[] {
  if (word.length === 0) return [];
  const units = toUnits(word);

  const nuclei: number[] = [];
  for (let i = 0; i < units.length; i++) {
    if (isNucleus(units, i)) nuclei.push(i);
  }
  if (nuclei.length <= 1) return [word];

  // Each boundary is the unit index a syllable starts at. The first syllable
  // always starts at 0 so leading consonants ride along with it.
  const boundaries: number[] = [0];
  for (let n = 0; n < nuclei.length - 1; n++) {
    const clusterStart = nuclei[n] + 1;
    const clusterSize = nuclei[n + 1] - clusterStart;
    if (clusterSize <= 1) {
      // No consonants (a-u-to) or exactly one (ma-ma): the next syllable
      // starts at the following nucleus, or at that single consonant.
      boundaries.push(nuclei[n + 1] - clusterSize);
    } else {
      // Two or more: the first consonant closes the current syllable.
      boundaries.push(clusterStart + 1);
    }
  }

  return boundaries.map((startUnit, i) => {
    const endUnit =
      i + 1 < boundaries.length ? boundaries[i + 1] : units.length;
    return word.slice(units[startUnit].start, units[endUnit - 1].end);
  });
}

/** Number of syllables in a word. Cheaper than `syllabify(word).length`. */
export function countSyllables(word: string): number {
  const units = toUnits(word);
  let count = 0;
  for (let i = 0; i < units.length; i++) {
    if (isNucleus(units, i)) count++;
  }
  return count;
}

/**
 * The largest run of consonants inside any single syllable of the word —
 * the onset of `ško-la` is 2, the coda of `Reks` is 2, `ma-ma` is 1.
 *
 * This is the difficulty signal that matters for a Croatian beginner: clusters,
 * not word length, are what stall a new reader. A syllabic `r` counts as a
 * nucleus and so breaks a run: `prst` scores 2 for the `st` coda, not 3.
 */
export function maxClusterSize(word: string): number {
  let worst = 0;
  for (const syllable of syllabify(word)) {
    const units = toUnits(syllable);
    let run = 0;
    for (let i = 0; i < units.length; i++) {
      if (isNucleus(units, i)) {
        run = 0;
      } else {
        run++;
        if (run > worst) worst = run;
      }
    }
  }
  return worst;
}
