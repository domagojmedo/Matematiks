import { describe, expect, it } from "vitest";
import { downsampleGrid, normalizeToGrid } from "./preprocess";
import { GRID_LEN, GRID_SIZE } from "./types";

/** Sum of all ink in a grid. */
function mass(grid: Float32Array): number {
  let s = 0;
  for (const v of grid) s += v;
  return s;
}

/** Ink-weighted center of mass as [cx, cy] in grid coords. */
function centerOfMass(grid: Float32Array): [number, number] {
  let m = 0;
  let cx = 0;
  let cy = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const v = grid[y * GRID_SIZE + x];
      m += v;
      cx += v * x;
      cy += v * y;
    }
  }
  return [cx / m, cy / m];
}

describe("normalizeToGrid", () => {
  it("returns null for a blank buffer", () => {
    expect(normalizeToGrid(new Float32Array(40 * 40), 40, 40)).toBeNull();
  });

  it("produces a GRID_SIZE×GRID_SIZE grid with preserved ink", () => {
    // A solid 10×10 block in the top-left of a 40×40 buffer.
    const w = 40;
    const h = 40;
    const data = new Float32Array(w * h);
    for (let y = 2; y < 12; y++)
      for (let x = 2; x < 12; x++) data[y * w + x] = 1;
    const grid = normalizeToGrid(data, w, h);
    expect(grid).not.toBeNull();
    expect((grid as Float32Array).length).toBe(GRID_LEN);
    expect(mass(grid as Float32Array)).toBeGreaterThan(0);
  });

  it("centers ink by center of mass regardless of where it was drawn", () => {
    const w = 60;
    const h = 60;
    const draw = (ox: number, oy: number): Float32Array => {
      const d = new Float32Array(w * h);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) d[(oy + y) * w + (ox + x)] = 1;
      return d;
    };
    const a = normalizeToGrid(draw(2, 2), w, h) as Float32Array; // top-left
    const b = normalizeToGrid(draw(48, 48), w, h) as Float32Array; // bottom-right
    const [ax, ay] = centerOfMass(a);
    const [bx, by] = centerOfMass(b);
    const mid = GRID_SIZE / 2;
    // Both land near the grid center, and near each other.
    expect(Math.abs(ax - mid)).toBeLessThan(1.5);
    expect(Math.abs(ay - mid)).toBeLessThan(1.5);
    expect(Math.abs(ax - bx)).toBeLessThan(1.0);
    expect(Math.abs(ay - by)).toBeLessThan(1.0);
  });
});

describe("downsampleGrid", () => {
  it("averages a uniform grid to the requested size", () => {
    const grid = new Float32Array(GRID_LEN).fill(0.5);
    const small = downsampleGrid(grid, 5, 7);
    expect(small.length).toBe(35);
    for (const v of small) expect(v).toBeCloseTo(0.5, 5);
  });
});
