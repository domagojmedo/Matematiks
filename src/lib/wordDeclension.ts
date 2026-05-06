/**
 * Croatian declension data and helpers for word problems.
 *
 * Croatian numeric agreement (nominative/accusative count phrases like
 * "ima X imenica") follows three buckets based on the count's units digit,
 * with a 11–14 exception that uses the plural form regardless of unit:
 *
 *   - 1 (and 21, 31, …)        → singular form
 *   - 2, 3, 4 (and 22–24, …)   → paucal (gen. sg. for fem., gen. pl. for masc.)
 *   - 5–20, 0, 11–14 included  → genitive plural
 *
 * For the grade-1 ranges we use here (counts always ≤ 20), the practical rule
 * is just: 1 → sg; 2–4 → paucal; everything else (0 and 5–20) → plural.
 *
 * Question phrasing ("Koliko X ima Tomo?") always takes the genitive plural,
 * regardless of any count. Use `nounPlural()` for that.
 *
 * Forms are hand-authored per noun rather than algorithmically derived:
 * Croatian has enough irregulars (olovka → olovaka, gen pl) that mistakes are
 * easy to make. Keeping the table explicit makes typos visible in code review.
 */

export type CountForm = "sg" | "paucal" | "plural";

export type NounForms = {
  /** Nominative singular (dictionary form). */
  nom: string;
  /** Used after "1" — accusative singular for direct objects of "ima". */
  sg: string;
  /** Used after 2/3/4. */
  paucal: string;
  /** Used after 0, 5–20, and in question phrasings ("Koliko X ima…?"). */
  plural: string;
};

export type NameForms = {
  /** Subject form ("Maro ima…"). */
  nom: string;
  /** Genitive form ("manje od Mara"). */
  gen: string;
  gender: "m" | "f";
};

/**
 * Pick the right form bucket for a given count. Public so generators and tests
 * can verify they hit each bucket.
 */
export function countForm(count: number): CountForm {
  const n = Math.abs(Math.trunc(count));
  // 11–14 always take plural even though they "end in" 1/2/3/4.
  if (n >= 11 && n <= 14) return "plural";
  const units = n % 10;
  if (units === 1) return "sg";
  if (units === 2 || units === 3 || units === 4) return "paucal";
  return "plural";
}

export function declineNoun(noun: NounForms, count: number): string {
  switch (countForm(count)) {
    case "sg":
      return noun.sg;
    case "paucal":
      return noun.paucal;
    case "plural":
      return noun.plural;
  }
}

/** Genitive plural — used in questions where the count is the unknown. */
export function nounPlural(noun: NounForms): string {
  return noun.plural;
}

export const NOUNS: Record<string, NounForms> = {
  pikula: {
    nom: "pikula",
    sg: "pikulu",
    paucal: "pikule",
    plural: "pikula",
  },
  jabuka: {
    nom: "jabuka",
    sg: "jabuku",
    paucal: "jabuke",
    plural: "jabuka",
  },
  // Bombon is masculine inanimate; nom and acc sg coincide. Paucal and gen pl
  // are both "bombona" for this class — same string is correct twice.
  bombon: {
    nom: "bombon",
    sg: "bombon",
    paucal: "bombona",
    plural: "bombona",
  },
  naljepnica: {
    nom: "naljepnica",
    sg: "naljepnicu",
    paucal: "naljepnice",
    plural: "naljepnica",
  },
  kockica: {
    nom: "kockica",
    sg: "kockicu",
    paucal: "kockice",
    plural: "kockica",
  },
  bojica: {
    nom: "bojica",
    sg: "bojicu",
    paucal: "bojice",
    plural: "bojica",
  },
  // Balon — masculine like bombon.
  balon: {
    nom: "balon",
    sg: "balon",
    paucal: "balona",
    plural: "balona",
  },
  kartica: {
    nom: "kartica",
    sg: "karticu",
    paucal: "kartice",
    plural: "kartica",
  },
};

export const NOUN_KEYS = Object.keys(NOUNS) as readonly string[];

export const NAMES: Record<string, NameForms> = {
  // Boys
  Maro: { nom: "Maro", gen: "Mara", gender: "m" },
  Tomo: { nom: "Tomo", gen: "Toma", gender: "m" },
  Ivan: { nom: "Ivan", gen: "Ivana", gender: "m" },
  Marko: { nom: "Marko", gen: "Marka", gender: "m" },
  Luka: { nom: "Luka", gen: "Luke", gender: "m" },
  // Girls
  Ana: { nom: "Ana", gen: "Ane", gender: "f" },
  Lana: { nom: "Lana", gen: "Lane", gender: "f" },
  Iva: { nom: "Iva", gen: "Ive", gender: "f" },
  Ema: { nom: "Ema", gen: "Eme", gender: "f" },
  Mia: { nom: "Mia", gen: "Mije", gender: "f" },
};

export const NAME_KEYS = Object.keys(NAMES) as readonly string[];
