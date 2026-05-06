import { describe, expect, it } from "vitest";
import { summarizeSetup } from "./format";

describe("summarizeSetup", () => {
  it("renders simple range", () => {
    expect(summarizeSetup({ kind: "range", min: 1, max: 20, rounds: 20 })).toBe(
      "1–20",
    );
  });

  it("renders asymmetric range with arrow", () => {
    expect(
      summarizeSetup({
        kind: "range",
        min: 1,
        max: 20,
        min2: 1,
        max2: 100,
        rounds: 20,
      }),
    ).toBe("1–20 ↔ 1–100");
  });

  it("collapses contiguous multiplicand list to a range", () => {
    expect(
      summarizeSetup({
        kind: "multiplicands",
        values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        rounds: 20,
      }),
    ).toBe("1–10");
  });

  it("renders single-element values list as one number", () => {
    expect(
      summarizeSetup({
        kind: "multiplicands",
        values: [7],
        rounds: 20,
      }),
    ).toBe("7");
  });

  it("renders values × values2 when both contiguous", () => {
    expect(
      summarizeSetup({
        kind: "multiplicands",
        values: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
        values2: [2, 3, 4, 5, 6, 7, 8, 9],
        rounds: 20,
      }),
    ).toBe("10–19 × 2–9");
  });

  it("falls back to comma list for non-contiguous values", () => {
    expect(
      summarizeSetup({
        kind: "multiplicands",
        values: [2, 5, 8],
        rounds: 20,
      }),
    ).toBe("2,5,8");
  });
});
