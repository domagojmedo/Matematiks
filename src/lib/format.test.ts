import { describe, expect, it } from "vitest";
import { describeSetup, summarizeSetup } from "./format";

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

describe("describeSetup", () => {
  it("lists round count and range for a plain range setup", () => {
    expect(
      describeSetup({ kind: "range", min: 1, max: 20, rounds: 20 }),
    ).toEqual([
      { labelKey: "sessionDetail.paramRounds", text: "20" },
      { labelKey: "setup.range", text: "1–20" },
    ]);
  });

  it("reports a time-attack length instead of a round count", () => {
    const params = describeSetup({
      kind: "range",
      min: 1,
      max: 20,
      rounds: 20,
      timeMs: 180_000,
    });
    expect(params[0]).toEqual({
      labelKey: "sessionDetail.paramTime",
      text: "3m 0s",
    });
  });

  it("splits first/second range and reports the crossesTen filter", () => {
    expect(
      describeSetup({
        kind: "range",
        min: 10,
        max: 99,
        min2: 1,
        max2: 9,
        crossesTen: "always",
        rounds: 10,
      }),
    ).toEqual([
      { labelKey: "sessionDetail.paramRounds", text: "10" },
      { labelKey: "setup.rangeFirst", text: "10–99" },
      { labelKey: "setup.rangeSecond", text: "1–9" },
      {
        labelKey: "sessionDetail.paramCrossesTen",
        textKey: "sessionDetail.crossesTen.always",
      },
    ]);
  });

  it("reports tables, partner factors, layout and guide", () => {
    expect(
      describeSetup({
        kind: "multiplicands",
        values: [6],
        values2: [2, 3, 4, 5, 6, 7, 8, 9],
        format: "column",
        guide: true,
        rounds: 30,
      }),
    ).toEqual([
      { labelKey: "sessionDetail.paramRounds", text: "30" },
      { labelKey: "setup.multiplicands", text: "6" },
      { labelKey: "sessionDetail.paramPartners", text: "2–9" },
      { labelKey: "setup.formatSection", textKey: "setup.formatColumn" },
      { labelKey: "setup.guideLabel", textKey: "sessionDetail.on" },
    ]);
  });

  it("omits optional rows that were never configured", () => {
    const params = describeSetup({
      kind: "multiplicands",
      values: [2, 5],
      rounds: 20,
    });
    expect(params.map((p) => p.labelKey)).toEqual([
      "sessionDetail.paramRounds",
      "setup.multiplicands",
    ]);
  });

  it("reports the grade bound for word setups", () => {
    expect(
      describeSetup({
        kind: "word",
        wordKinds: ["rounding"],
        rounds: 12,
        maxNumber: 100,
      }),
    ).toEqual([
      { labelKey: "sessionDetail.paramRounds", text: "12" },
      { labelKey: "sessionDetail.paramMaxNumber", text: "100" },
    ]);
  });
});
