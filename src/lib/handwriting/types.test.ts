import { describe, expect, it } from "vitest";
import { predictionFromScores } from "./types";

describe("predictionFromScores", () => {
  it("picks the argmax digit and its confidence", () => {
    const p = predictionFromScores([0.1, 0.2, 0.6, 0.1], 0.5);
    expect(p.digit).toBe(2);
    expect(p.confidence).toBeCloseTo(0.6, 6);
  });

  it("returns digit 0 when class 0 wins (0 is not 'missing')", () => {
    const p = predictionFromScores([0.8, 0.1, 0.1], 0.5);
    expect(p.digit).toBe(0);
    expect(p.confidence).toBeCloseTo(0.8, 6);
  });

  it("returns null when the top score is below minConfidence", () => {
    const p = predictionFromScores([0.3, 0.3, 0.4], 0.5);
    expect(p.digit).toBeNull();
    expect(p.confidence).toBeCloseTo(0.4, 6);
  });

  it("keeps the digit exactly at the confidence threshold", () => {
    const p = predictionFromScores([0.5, 0.5], 0.5);
    expect(p.digit).toBe(0); // first argmax, confidence 0.5 >= 0.5
  });

  it("handles empty scores without throwing", () => {
    const p = predictionFromScores([], 0.5);
    expect(p.digit).toBeNull();
    expect(p.confidence).toBe(0);
  });
});
