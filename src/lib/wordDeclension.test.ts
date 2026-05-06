import { describe, expect, it } from "vitest";
import {
  countForm,
  declineNoun,
  NAME_KEYS,
  NAMES,
  NOUN_KEYS,
  NOUNS,
  nounPlural,
} from "./wordDeclension";

describe("countForm — Croatian numeric agreement bucket", () => {
  it("count 1 takes singular", () => {
    expect(countForm(1)).toBe("sg");
  });

  it("counts 2, 3, 4 take paucal", () => {
    expect(countForm(2)).toBe("paucal");
    expect(countForm(3)).toBe("paucal");
    expect(countForm(4)).toBe("paucal");
  });

  it("counts 5 through 10 take plural", () => {
    for (let n = 5; n <= 10; n++) {
      expect(countForm(n)).toBe("plural");
    }
  });

  it("counts 11–14 take plural even though they end in 1/2/3/4", () => {
    expect(countForm(11)).toBe("plural");
    expect(countForm(12)).toBe("plural");
    expect(countForm(13)).toBe("plural");
    expect(countForm(14)).toBe("plural");
  });

  it("counts 15–20 take plural", () => {
    for (let n = 15; n <= 20; n++) {
      expect(countForm(n)).toBe("plural");
    }
  });

  it("count 21 falls back to singular (units digit rule)", () => {
    // Out of grade-1 range but the rule should still hold for future-proofing.
    expect(countForm(21)).toBe("sg");
  });

  it("counts 22–24 take paucal", () => {
    expect(countForm(22)).toBe("paucal");
    expect(countForm(23)).toBe("paucal");
    expect(countForm(24)).toBe("paucal");
  });

  it("count 0 takes plural", () => {
    expect(countForm(0)).toBe("plural");
  });
});

describe("declineNoun picks the right form per count", () => {
  it("returns sg for 1, paucal for 2–4, plural otherwise", () => {
    const pikula = NOUNS.pikula;
    expect(pikula).toBeDefined();
    if (!pikula) return;
    expect(declineNoun(pikula, 1)).toBe("pikulu");
    expect(declineNoun(pikula, 2)).toBe("pikule");
    expect(declineNoun(pikula, 4)).toBe("pikule");
    expect(declineNoun(pikula, 5)).toBe("pikula");
    expect(declineNoun(pikula, 11)).toBe("pikula");
    expect(declineNoun(pikula, 14)).toBe("pikula");
    expect(declineNoun(pikula, 20)).toBe("pikula");
  });

  it("masculine inanimate (bombon) coincides nom/acc-sg correctly", () => {
    const bombon = NOUNS.bombon;
    expect(bombon).toBeDefined();
    if (!bombon) return;
    expect(declineNoun(bombon, 1)).toBe("bombon");
    expect(declineNoun(bombon, 3)).toBe("bombona");
    expect(declineNoun(bombon, 7)).toBe("bombona");
  });
});

describe("noun and name catalogs", () => {
  it("nounPlural returns the genitive plural for use in questions", () => {
    for (const key of NOUN_KEYS) {
      const noun = NOUNS[key];
      expect(noun).toBeDefined();
      if (!noun) continue;
      expect(nounPlural(noun)).toBe(noun.plural);
    }
  });

  it("every noun has all four forms as non-empty strings", () => {
    for (const key of NOUN_KEYS) {
      const noun = NOUNS[key];
      expect(noun).toBeDefined();
      if (!noun) continue;
      expect(noun.nom.length).toBeGreaterThan(0);
      expect(noun.sg.length).toBeGreaterThan(0);
      expect(noun.paucal.length).toBeGreaterThan(0);
      expect(noun.plural.length).toBeGreaterThan(0);
    }
  });

  it("every name has nom + gen forms and a valid gender", () => {
    for (const key of NAME_KEYS) {
      const name = NAMES[key];
      expect(name).toBeDefined();
      if (!name) continue;
      expect(name.nom.length).toBeGreaterThan(0);
      expect(name.gen.length).toBeGreaterThan(0);
      expect(["m", "f"]).toContain(name.gender);
    }
  });

  it("name nominatives are unique (avoids cross-name collisions in prose)", () => {
    const noms = Object.values(NAMES).map((n) => n.nom);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it("includes both genders so generators can pick variety", () => {
    const genders = new Set(Object.values(NAMES).map((n) => n.gender));
    expect(genders.has("m")).toBe(true);
    expect(genders.has("f")).toBe(true);
  });
});
