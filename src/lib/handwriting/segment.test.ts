import { describe, expect, it } from "vitest";
import { cropInk, segmentInk } from "./segment";

const W = 200;
const H = 100;

/** Paint a filled rectangle of ink into a fresh buffer. */
function withRects(
  rects: Array<[number, number, number, number]>,
): Float32Array {
  const d = new Float32Array(W * H);
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) d[y * W + x] = 1;
  }
  return d;
}

describe("segmentInk", () => {
  it("returns nothing for a blank buffer", () => {
    expect(segmentInk(new Float32Array(W * H), W, H)).toEqual([]);
  });

  it("finds one box for a single blob", () => {
    const boxes = segmentInk(withRects([[40, 20, 70, 80]]), W, H);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toMatchObject({ minX: 40, minY: 20, maxX: 70, maxY: 80 });
  });

  it("splits two gapped blobs left-to-right", () => {
    // Two columns of ink with a clear 40px gap.
    const boxes = segmentInk(
      withRects([
        [20, 20, 50, 80],
        [110, 20, 140, 80],
      ]),
      W,
      H,
    );
    expect(boxes).toHaveLength(2);
    expect(boxes[0].minX).toBeLessThan(boxes[1].minX);
    expect(boxes[0]).toMatchObject({ minX: 20, maxX: 50 });
    expect(boxes[1]).toMatchObject({ minX: 110, maxX: 140 });
  });

  it("bridges a hairline (≤2px) gap into one box", () => {
    // A 2px nick (antialiasing / pen lift) should not split a digit.
    const boxes = segmentInk(
      withRects([
        [40, 20, 60, 80],
        [63, 20, 86, 80],
      ]),
      W,
      H,
    );
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toMatchObject({ minX: 40, maxX: 86 });
  });

  it("splits two digits joined by a thin bridge (valley, no empty column)", () => {
    // Two tall blobs connected by a 3px-tall bridge — there is NO empty column,
    // but the bridge is a deep valley vs the blobs, so it must still split.
    const data = withRects([
      [30, 20, 70, 80], // blob A (full height)
      [130, 20, 170, 80], // blob B (full height)
      [71, 48, 129, 51], // thin connecting bridge
    ]);
    const boxes = segmentInk(data, W, H);
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatchObject({ minX: 30, maxX: 70 });
    expect(boxes[1]).toMatchObject({ minX: 130, maxX: 170 });
  });

  it("keeps a short/low-density digit next to a tall dense one", () => {
    // A tall full-height stroke (like "1") and a separate short stroke (like the
    // top bar of a "7"). The short one must NOT be dropped just because its
    // columns are sparse relative to the tall stroke's dense columns.
    const data = withRects([
      [20, 10, 35, 90], // tall dense stroke
      [60, 10, 110, 22], // short low strip, separated by a gap
    ]);
    const boxes = segmentInk(data, W, H);
    expect(boxes).toHaveLength(2);
    expect(boxes[1].minX).toBeGreaterThanOrEqual(60);
  });

  it("drops a stray noise speck", () => {
    const boxes = segmentInk(
      withRects([
        [40, 20, 80, 80], // real digit
        [150, 50, 151, 51], // 2x2 speck
      ]),
      W,
      H,
    );
    expect(boxes).toHaveLength(1);
    expect(boxes[0].minX).toBe(40);
  });
});

describe("cropInk", () => {
  it("extracts the bounded sub-rectangle", () => {
    const data = withRects([[10, 10, 12, 12]]);
    const crop = cropInk(data, W, { minX: 10, minY: 10, maxX: 12, maxY: 12 });
    expect(crop.width).toBe(3);
    expect(crop.height).toBe(3);
    expect(Array.from(crop.data)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });
});
