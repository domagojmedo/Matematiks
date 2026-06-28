// Shared, engine-agnostic preprocessing: raw ink → normalized DigitGrid.
//
// Mirrors the classic MNIST normalization so any model trained on MNIST-like
// data (or matched against MNIST-style templates) sees a consistent input:
//   1. find the ink bounding box
//   2. scale the glyph so its longer side is GLYPH_SPAN px, preserving aspect
//   3. paste it into a GRID_SIZE field centered by center-of-mass
// Pure — takes an already-extracted grayscale buffer, returns a grid (or null
// when the canvas is effectively blank). No DOM; the canvas component extracts
// the buffer and hands it here.

import { type DigitGrid, GRID_SIZE } from "./types";

/** Target longer-side length of the glyph inside the grid (MNIST uses 20 in 28). */
const GLYPH_SPAN = 20;
/** Ink below this (in [0,1]) is treated as background when finding the bbox. */
const INK_THRESHOLD = 0.05;

interface RawInk {
  /** Row-major grayscale, length `width * height`, values `[0,1]`, `1` = ink. */
  data: ArrayLike<number>;
  width: number;
  height: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Tight bounding box of ink above threshold, or `null` if the buffer is blank. */
function inkBounds({ data, width, height }: RawInk): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] > INK_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Box-filter resample of a cropped region of `src` into a `dstW × dstH` buffer.
 * Averaging (rather than nearest) keeps thin strokes from vanishing on downscale.
 */
function resample(
  src: ArrayLike<number>,
  srcW: number,
  crop: Bounds,
  dstW: number,
  dstH: number,
): Float32Array {
  const out = new Float32Array(dstW * dstH);
  const cropW = crop.maxX - crop.minX + 1;
  const cropH = crop.maxY - crop.minY + 1;
  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = crop.minY + Math.floor((dy * cropH) / dstH);
    const sy1 = Math.max(
      sy0 + 1,
      crop.minY + Math.floor(((dy + 1) * cropH) / dstH),
    );
    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = crop.minX + Math.floor((dx * cropW) / dstW);
      const sx1 = Math.max(
        sx0 + 1,
        crop.minX + Math.floor(((dx + 1) * cropW) / dstW),
      );
      let sum = 0;
      let count = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          sum += src[sy * srcW + sx];
          count++;
        }
      }
      out[dy * dstW + dx] = count > 0 ? sum / count : 0;
    }
  }
  return out;
}

/**
 * Normalize raw ink into a centered {@link DigitGrid}, or `null` when blank.
 *
 * @param data row-major grayscale, length `width*height`, `[0,1]`, `1` = ink.
 */
export function normalizeToGrid(
  data: ArrayLike<number>,
  width: number,
  height: number,
): DigitGrid | null {
  const bounds = inkBounds({ data, width, height });
  if (!bounds) return null;

  // Scale longer side to GLYPH_SPAN, preserving aspect ratio.
  const cropW = bounds.maxX - bounds.minX + 1;
  const cropH = bounds.maxY - bounds.minY + 1;
  const scale = GLYPH_SPAN / Math.max(cropW, cropH);
  const glyphW = Math.max(1, Math.round(cropW * scale));
  const glyphH = Math.max(1, Math.round(cropH * scale));
  const glyph = resample(data, width, bounds, glyphW, glyphH);

  // Center of mass of the scaled glyph, so we paste it centered on its ink
  // rather than its bounding box (matches MNIST's COM centering).
  let mass = 0;
  let cx = 0;
  let cy = 0;
  for (let y = 0; y < glyphH; y++) {
    for (let x = 0; x < glyphW; x++) {
      const v = glyph[y * glyphW + x];
      mass += v;
      cx += v * x;
      cy += v * y;
    }
  }
  if (mass === 0) return null;
  cx /= mass;
  cy /= mass;

  // Offset places the glyph's COM at the grid center.
  const offX = Math.round(GRID_SIZE / 2 - cx);
  const offY = Math.round(GRID_SIZE / 2 - cy);

  const grid: DigitGrid = new Float32Array(GRID_SIZE * GRID_SIZE);
  for (let y = 0; y < glyphH; y++) {
    const gy = y + offY;
    if (gy < 0 || gy >= GRID_SIZE) continue;
    for (let x = 0; x < glyphW; x++) {
      const gx = x + offX;
      if (gx < 0 || gx >= GRID_SIZE) continue;
      grid[gy * GRID_SIZE + gx] = glyph[y * glyphW + x];
    }
  }
  return grid;
}

/** Downsample a {@link DigitGrid} to a small `w × h` feature grid (averaged). */
export function downsampleGrid(
  grid: DigitGrid,
  w: number,
  h: number,
): Float32Array {
  return resample(
    grid,
    GRID_SIZE,
    { minX: 0, minY: 0, maxX: GRID_SIZE - 1, maxY: GRID_SIZE - 1 },
    w,
    h,
  );
}
