/**
 * Generated stories for levels 2 and 3.
 *
 * Levels 2–3 are formulaic by construction: under their ceilings Croatian
 * offers roughly forty usable nouns and thirty usable verbs, which leaves no
 * room for plot. Hand-writing hundreds of `Maca ima loptu.` is wasted effort,
 * so those two levels are generated from frames over a controlled vocabulary —
 * the same approach `wordTemplates.ts` already takes for math word problems,
 * and with the same reason for hand-authoring the inflected forms rather than
 * deriving them: Croatian has too many irregulars for a rule to be safe.
 *
 * Generated text is checked by the same decodability guard as written text, so
 * a vocabulary entry that breaks its level fails the suite rather than reaching
 * a child.
 *
 * These stories are thin. That is accepted here and nowhere else: at level 2
 * the win is fluent blending, and from level 4 up the library is hand-written.
 */

import type { ReadingLevel, ReadingQuestion, Story } from "./readingTypes";

type Gender = "f" | "m" | "n";

type GenNoun = {
  nom: string;
  /** Accusative singular — the object of `ima` / `voli` / `nosi`. */
  acc: string;
  gender: Gender;
};

type GenAdj = { f: string; m: string; n: string };

/** Level 2: every syllable CV or CVC, at most two syllables. */
const L2_NOUNS: GenNoun[] = [
  { nom: "lopta", acc: "loptu", gender: "f" },
  { nom: "maca", acc: "macu", gender: "f" },
  { nom: "koza", acc: "kozu", gender: "f" },
  { nom: "riba", acc: "ribu", gender: "f" },
  { nom: "kapa", acc: "kapu", gender: "f" },
  { nom: "torba", acc: "torbu", gender: "f" },
  { nom: "voda", acc: "vodu", gender: "f" },
  { nom: "kuća", acc: "kuću", gender: "f" },
  { nom: "soba", acc: "sobu", gender: "f" },
  { nom: "jaje", acc: "jaje", gender: "n" },
  { nom: "meso", acc: "meso", gender: "n" },
  { nom: "more", acc: "more", gender: "n" },
  { nom: "kolač", acc: "kolač", gender: "m" },
  { nom: "sir", acc: "sir", gender: "m" },
  { nom: "med", acc: "med", gender: "m" },
];

/**
 * Predicate adjectives, in the *indefinite* form.
 *
 * Croatian after `je` takes the indefinite: `Med je nov`, never `Med je novi`.
 * The definite form is what a dictionary lists, which makes this an easy and
 * invisible mistake — the decodability guard measures difficulty, not grammar,
 * so it cannot catch it.
 *
 * The pool is deliberately narrow. Adjectives are paired with nouns at random,
 * so anything but a near-universal property produces nonsense — an earlier
 * colour set generated `Med je zelen`. Size and newness fit any concrete noun.
 */
const L2_ADJECTIVES: GenAdj[] = [
  { f: "mala", m: "malen", n: "malo" },
  { f: "nova", m: "nov", n: "novo" },
];

const L2_NAMES = ["Mia", "Luka", "Mama", "Baka", "Tata"];

/** Level 3 adds a third syllable and two-consonant clusters. */
const L3_NOUNS: GenNoun[] = [
  ...L2_NOUNS,
  { nom: "knjiga", acc: "knjigu", gender: "f" },
  { nom: "škola", acc: "školu", gender: "f" },
  { nom: "trava", acc: "travu", gender: "f" },
  { nom: "cvijet", acc: "cvijet", gender: "m" },
  { nom: "kruh", acc: "kruh", gender: "m" },
  { nom: "patka", acc: "patku", gender: "f" },
  { nom: "brdo", acc: "brdo", gender: "n" },
  { nom: "drvo", acc: "drvo", gender: "n" },
];

const L3_ADJECTIVES: GenAdj[] = [
  ...L2_ADJECTIVES,
  { f: "velika", m: "velik", n: "veliko" },
  { f: "lijepa", m: "lijep", n: "lijepo" },
];

const L3_NAMES = [...L2_NAMES, "Marko", "Djed"];

const agree = (adj: GenAdj, gender: Gender): string => adj[gender];

/** Deterministic PRNG so a seed always yields the same story. */
function makeRng(seed: string): () => number {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const pickFrom = <T>(items: T[], rng: () => number): T =>
  items[Math.floor(rng() * items.length)];

/** Pick `n` distinct items, falling back to repeats if the pool is too small. */
function pickDistinct<T>(items: T[], n: number, rng: () => number): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    if (pool.length === 0) return [...out, ...items.slice(0, n - out.length)];
    const index = Math.floor(rng() * pool.length);
    out.push(pool[index]);
    pool.splice(index, 1);
  }
  return out;
}

function buildLevel2(rng: () => number): {
  sentences: string[];
  question: ReadingQuestion;
  title: string;
} {
  const [noun, other] = pickDistinct(L2_NOUNS, 2, rng);
  const [name, otherName] = pickDistinct(L2_NAMES, 2, rng);
  const adjective = agree(pickFrom(L2_ADJECTIVES, rng), noun.gender);

  const sentences = [
    `${name} ima ${noun.acc}.`,
    `${cap(noun.nom)} je ${adjective}.`,
    `${otherName} vidi ${noun.acc}.`,
    `${name} voli ${noun.acc}.`,
    `${cap(noun.nom)} je tu.`,
  ];

  return {
    title: `${cap(noun.nom)} i ${other.nom}`,
    sentences,
    question: {
      prompt: `Tko ima ${noun.acc}?`,
      options: [name, otherName, "nitko"],
      expectedIndex: 0,
    },
  };
}

function buildLevel3(rng: () => number): {
  sentences: string[];
  question: ReadingQuestion;
  title: string;
} {
  const [noun, other] = pickDistinct(L3_NOUNS, 2, rng);
  // Three distinct names, not two plus a hardcoded distractor: "Baka" is in
  // this pool, so a literal "baka" third option collided with it in 29% of
  // seeds — and under the uppercase letterform both render as BAKA, leaving
  // the child two identical options, one of which is scored wrong.
  const [name, otherName, distractor] = pickDistinct(L3_NAMES, 3, rng);
  const adjective = agree(pickFrom(L3_ADJECTIVES, rng), noun.gender);
  const otherAdjective = agree(pickFrom(L3_ADJECTIVES, rng), other.gender);

  const sentences = [
    `${name} ima ${noun.acc}.`,
    `${cap(noun.nom)} je ${adjective}.`,
    `${otherName} gleda ${noun.acc}.`,
    `${name} nosi ${noun.acc} u sobu.`,
    `Tamo je i ${other.nom}.`,
    `${cap(other.nom)} je ${otherAdjective}.`,
    `${name} voli ${noun.acc}.`,
    `${otherName} voli ${other.acc}.`,
  ];

  return {
    title: `${cap(noun.nom)} i ${other.nom}`,
    sentences,
    question: {
      prompt: `Tko nosi ${noun.acc}?`,
      options: [name, otherName, distractor],
      expectedIndex: 0,
    },
  };
}

const cap = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1);

/**
 * Build one generated story. The same `seed` always produces the same story,
 * which is what lets "Priča dana" offer a stable generated story for a day.
 */
export function generateStory(level: 2 | 3, seed: string): Story {
  const rng = makeRng(seed);
  const built = level === 2 ? buildLevel2(rng) : buildLevel3(rng);
  const shuffled = shuffleQuestion(built.question, rng);
  return {
    id: `gen-${level}-${seed}`,
    level: level as ReadingLevel,
    title: built.title,
    // Generated stories are a single paragraph — there is not enough here to
    // justify a break.
    paragraphs: [built.sentences],
    questions: [shuffled],
  };
}

/** Same reason as the written library: the answer must not always be first. */
function shuffleQuestion(
  question: ReadingQuestion,
  rng: () => number,
): ReadingQuestion {
  const order = question.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    prompt: question.prompt,
    options: order.map((i) => question.options[i]),
    expectedIndex: order.indexOf(question.expectedIndex),
  };
}
