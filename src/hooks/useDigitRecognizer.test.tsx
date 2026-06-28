/**
 * Contract coverage for multi-digit recognition. `recognizeNumber` must be
 * all-or-nothing: it returns the digits only when EVERY segment was classified
 * confidently, and `null` when the drawing is blank or any segment is unsure —
 * so a half-read "10" never silently enters "1".
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type DigitRecognizer,
  registerRecognizer,
  resetRecognizers,
} from "../lib/handwriting";
import { useDigitRecognizer } from "./useDigitRecognizer";

const W = 200;
const H = 100;

// A stub engine that returns queued predictions in call order (segments are
// classified left-to-right), so a test controls each segment's outcome.
let queue: Array<number | null> = [];
const stub: DigitRecognizer = {
  id: "test-stub",
  label: "stub",
  load: () => Promise.resolve(),
  recognize: () => {
    const digit = queue.length > 0 ? (queue.shift() ?? null) : null;
    return { digit, confidence: digit === null ? 0 : 1, scores: [] };
  },
};

/** Paint filled rectangles (each becomes one segment) into a fresh ink buffer. */
function ink(rects: Array<[number, number, number, number]>): Float32Array {
  const d = new Float32Array(W * H);
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) d[y * W + x] = 1;
  }
  return d;
}

beforeEach(() => {
  registerRecognizer("test-stub", () => stub);
  queue = [];
});
afterEach(() => resetRecognizers());

function setup() {
  const { result } = renderHook(() => useDigitRecognizer("test-stub"));
  return result;
}

const TWO = ink([
  [20, 20, 50, 80],
  [110, 20, 140, 80],
]);
const ONE = ink([[80, 20, 120, 80]]);

describe("useDigitRecognizer.recognizeNumber", () => {
  it("returns all digits when every segment is confident", async () => {
    const result = setup();
    queue = [1, 0];
    expect(await result.current.recognizeNumber(TWO, W, H)).toEqual([1, 0]);
  });

  it("keeps digit 0 (not treated as missing)", async () => {
    const result = setup();
    queue = [0];
    expect(await result.current.recognizeNumber(ONE, W, H)).toEqual([0]);
  });

  it("returns null when ANY segment is unsure (no partial submit)", async () => {
    const result = setup();
    queue = [1, null]; // second digit unrecognized
    expect(await result.current.recognizeNumber(TWO, W, H)).toBeNull();
  });

  it("returns null for a blank canvas", async () => {
    const result = setup();
    expect(
      await result.current.recognizeNumber(new Float32Array(W * H), W, H),
    ).toBeNull();
  });
});
