// Multi-digit segmentation: split one drawing into per-digit sub-regions.
//
// Kids write multi-digit numbers ("10", "23") side by side. We group ink by
// CONNECTED COMPONENTS (8-connectivity), then:
//   • merge components that overlap/abut in x  → strokes of one digit ("4", "5")
//   • split a merged box that's far wider than tall → touching digits sharing
//     one component, cut at the column valley between them
// Component grouping is immune to stroke density, so a thin digit ("1") next to
// a dense one is never dropped, and a single digit is never clipped — the failure
// modes of a global column-threshold approach. Heavily overlapping digits (drawn
// on top of each other) remain the known hard case.
//
// Pure logic — operates on an already-extracted grayscale buffer.

const INK_THRESHOLD = 0.05;
// A component below this fraction of the largest component's pixel count is noise.
const NOISE_FRACTION = 0.04;
// Components whose horizontal gap is smaller than this (px) are the same digit.
const MERGE_GAP = 3;
// A merged box wider than this multiple of its height likely holds >1 digit.
const WIDE_RATIO = 1.15;
// When splitting a wide box, a column below this fraction of its densest column
// is the valley between digits.
const VALLEY_FRACTION = 0.18;

export interface InkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Component extends InkBounds {
  count: number;
}

/** 8-connected components of above-threshold ink, with bbox + pixel count. */
function components(
  data: ArrayLike<number>,
  width: number,
  height: number,
): Component[] {
  const seen = new Uint8Array(width * height);
  const comps: Component[] = [];
  const stack: number[] = [];
  for (let p = 0; p < seen.length; p++) {
    if (seen[p] || data[p] <= INK_THRESHOLD) continue;
    stack.length = 0;
    stack.push(p);
    seen[p] = 1;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let count = 0;
    while (stack.length > 0) {
      const q = stack.pop() as number;
      const x = q % width;
      const y = (q - x) / width;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const ni = ny * width + nx;
          if (!seen[ni] && data[ni] > INK_THRESHOLD) {
            seen[ni] = 1;
            stack.push(ni);
          }
        }
      }
    }
    comps.push({ minX, minY, maxX, maxY, count });
  }
  return comps;
}

/** y-range of ink within an x-span, or null if empty. */
function yRange(
  data: ArrayLike<number>,
  width: number,
  height: number,
  x0: number,
  x1: number,
): { minY: number; maxY: number } | null {
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = x0; x <= x1; x++) {
      if (data[row + x] > INK_THRESHOLD) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        break;
      }
    }
  }
  return maxY < 0 ? null : { minY, maxY };
}

/**
 * A wide box may hold touching digits in one component. Cut it at column valleys
 * (relative to the box's OWN densest column, so it's scale-local). Returns the
 * sub-boxes, or the original box if it shouldn't / can't be split.
 */
function splitWide(
  data: ArrayLike<number>,
  width: number,
  height: number,
  box: InkBounds,
): InkBounds[] {
  const bw = box.maxX - box.minX + 1;
  const bh = box.maxY - box.minY + 1;
  if (bw <= bh * WIDE_RATIO) return [box];

  const col = new Int32Array(bw);
  for (let y = box.minY; y <= box.maxY; y++) {
    const row = y * width;
    for (let x = box.minX; x <= box.maxX; x++) {
      if (data[row + x] > INK_THRESHOLD) col[x - box.minX]++;
    }
  }
  let peak = 0;
  for (const c of col) if (c > peak) peak = c;
  const valley = Math.max(1, peak * VALLEY_FRACTION);

  const runs: Array<[number, number]> = [];
  let start = -1;
  for (let x = 0; x < bw; x++) {
    if (col[x] > valley) {
      if (start < 0) start = x;
    } else if (start >= 0) {
      runs.push([start, x - 1]);
      start = -1;
    }
  }
  if (start >= 0) runs.push([start, bw - 1]);
  if (runs.length <= 1) return [box];

  const out: InkBounds[] = [];
  for (const [r0, r1] of runs) {
    const x0 = box.minX + r0;
    const x1 = box.minX + r1;
    const yr = yRange(data, width, height, x0, x1);
    if (yr) out.push({ minX: x0, minY: yr.minY, maxX: x1, maxY: yr.maxY });
  }
  return out.length > 0 ? out : [box];
}

/**
 * Split ink into left-to-right digit bounding boxes. Returns `[]` for a blank
 * buffer, one box for a single digit, N boxes for an N-digit number.
 *
 * @param data row-major grayscale, length `width*height`, `[0,1]`, `1` = ink.
 */
export function segmentInk(
  data: ArrayLike<number>,
  width: number,
  height: number,
): InkBounds[] {
  const comps = components(data, width, height);
  if (comps.length === 0) return [];

  // Drop noise specks relative to the largest component.
  let maxCount = 0;
  for (const c of comps) if (c.count > maxCount) maxCount = c.count;
  const kept = comps.filter((c) => c.count >= maxCount * NOISE_FRACTION);
  if (kept.length === 0) return [];
  kept.sort((a, b) => a.minX - b.minX);

  // Merge components that overlap or nearly abut in x (one digit's strokes).
  const merged: InkBounds[] = [];
  for (const c of kept) {
    const last = merged[merged.length - 1];
    if (last && c.minX - last.maxX - 1 < MERGE_GAP) {
      last.minX = Math.min(last.minX, c.minX);
      last.maxX = Math.max(last.maxX, c.maxX);
      last.minY = Math.min(last.minY, c.minY);
      last.maxY = Math.max(last.maxY, c.maxY);
    } else {
      merged.push({ minX: c.minX, minY: c.minY, maxX: c.maxX, maxY: c.maxY });
    }
  }

  // Cut any over-wide box (touching digits sharing a component).
  return merged.flatMap((b) => splitWide(data, width, height, b));
}

/** Copy the sub-rectangle `bounds` out of `data` into its own tight buffer. */
export function cropInk(
  data: ArrayLike<number>,
  width: number,
  bounds: InkBounds,
): { data: Float32Array; width: number; height: number } {
  const w = bounds.maxX - bounds.minX + 1;
  const h = bounds.maxY - bounds.minY + 1;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const src = (bounds.minY + y) * width + bounds.minX;
    const dst = y * w;
    for (let x = 0; x < w; x++) out[dst + x] = data[src + x];
  }
  return { data: out, width: w, height: h };
}
