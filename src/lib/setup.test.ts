import { beforeEach, describe, expect, it } from "vitest";
import { generateProblem } from "./problemGen";
import {
  getSetup,
  saveSetup,
  TABLE_PARTNERS,
  withTablePartners,
} from "./setup";
import type { OperationSetup } from "./types";

describe("withTablePartners", () => {
  it("spans the table for a single picked number", () => {
    const setup = withTablePartners({
      kind: "multiplicands",
      values: [6],
      rounds: 20,
    });
    expect(setup).toEqual({
      kind: "multiplicands",
      values: [6],
      values2: TABLE_PARTNERS,
      rounds: 20,
    });
  });

  it("leaves an explicit values2 alone", () => {
    const setup: OperationSetup = {
      kind: "multiplicands",
      values: [6],
      values2: [1, 2, 3],
      rounds: 20,
    };
    expect(withTablePartners(setup)).toBe(setup);
  });

  it("leaves range setups alone", () => {
    const setup: OperationSetup = {
      kind: "range",
      min: 1,
      max: 20,
      rounds: 20,
    };
    expect(withTablePartners(setup)).toBe(setup);
  });

  it("excludes the trivial ×1 and ×10 partners", () => {
    expect(TABLE_PARTNERS).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("yields the whole table for the picked number", () => {
    const setup = withTablePartners({
      kind: "multiplicands",
      values: [6],
      rounds: 20,
    });
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const p = generateProblem("mul", setup);
      // Factors commute, so 6 sits on either side; the partner is the other one.
      expect(p.a === 6 || p.b === 6).toBe(true);
      seen.add(p.a === 6 ? p.b : p.a);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(TABLE_PARTNERS);
  });

  it("yields the whole division table for the picked number", () => {
    const setup = withTablePartners({
      kind: "multiplicands",
      values: [6],
      rounds: 20,
    });
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const p = generateProblem("div", setup);
      expect(p.b).toBe(6);
      expect(Number.isInteger(p.answer)).toBe(true);
      seen.add(p.answer);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(TABLE_PARTNERS);
  });
});

describe("getSetup", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("backfills values2 on setups saved before the table-partner rule", () => {
    saveSetup("p1", "mul", {
      kind: "multiplicands",
      values: [6],
      rounds: 20,
    });
    expect(getSetup("p1", "mul")).toMatchObject({
      values: [6],
      values2: TABLE_PARTNERS,
    });
  });

  it("backfills the defaults too", () => {
    expect(getSetup("p1", "muldiv")).toMatchObject({
      kind: "multiplicands",
      values2: TABLE_PARTNERS,
    });
  });
});
