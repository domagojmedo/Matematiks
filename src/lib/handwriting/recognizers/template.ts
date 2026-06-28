// Baseline recognizer: nearest-prototype glyph matching.
//
// Zero external assets, zero dependency, fully offline — its job is to make the
// whole pipeline runnable and testable TODAY and to prove the engine seam. Each
// digit's prototype is its 5×7 reference glyph pushed through the SAME
// `normalizeToGrid` pipeline as real input, so prototypes and input share framing
// and centering. Classification is nearest prototype by cosine similarity at a
// moderate feature resolution. Accuracy on messy finger-drawing is modest; swap
// in the MLP engine once trained weights exist.

import { downsampleGrid, normalizeToGrid } from "../preprocess";
import {
  type DigitGrid,
  type DigitPrediction,
  type DigitRecognizer,
  predictionFromScores,
} from "../types";

const TPL_W = 5;
const TPL_H = 7;
/** Feature resolution prototypes and input are compared at. */
const FEAT = 14;

// Classic 5×7 dot-matrix glyphs, digit 0..9. `#` = ink, space = blank.
const GLYPH_ROWS: string[][] = [
  [" ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### "], // 0
  ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "], // 1
  [" ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####"], // 2
  ["#####", "   # ", "  #  ", "   # ", "    #", "#   #", " ### "], // 3
  ["   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "], // 4
  ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "], // 5
  ["  ## ", " #   ", "#    ", "#### ", "#   #", "#   #", " ### "], // 6
  ["#####", "    #", "   # ", "  #  ", " #   ", " #   ", " #   "], // 7
  [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "], // 8
  [" ### ", "#   #", "#   #", " ####", "    #", "   # ", " ##  "], // 9
];

/**
 * Test/diagnostic helper: render a digit's reference glyph as a raw grayscale ink
 * buffer (`1` = ink), each template cell expanded to `scale × scale` pixels. Lets
 * tests drive the real `normalizeToGrid` → `classify` pipeline with known input.
 */
export function renderGlyphInk(
  digit: number,
  scale = 8,
): { data: Float32Array; width: number; height: number } {
  const rows = GLYPH_ROWS[digit];
  const width = TPL_W * scale;
  const height = TPL_H * scale;
  const data = new Float32Array(width * height);
  for (let y = 0; y < TPL_H; y++) {
    for (let x = 0; x < TPL_W; x++) {
      if (rows[y][x] !== "#") continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          data[(y * scale + dy) * width + (x * scale + dx)] = 1;
        }
      }
    }
  }
  return { data, width, height };
}

function normalizeVec(v: Float32Array): Float32Array {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Unit feature vector for an already-normalized grid (downsampled to FEAT²). */
function featureOf(grid: DigitGrid): Float32Array {
  return normalizeVec(downsampleGrid(grid, FEAT, FEAT));
}

// Prototypes: each reference glyph through the SAME pipeline as live input, so
// framing/centering match. Built once on first use.
let prototypes: Float32Array[] | null = null;
function getPrototypes(): Float32Array[] {
  if (prototypes) return prototypes;
  prototypes = GLYPH_ROWS.map((_, d) => {
    const { data, width, height } = renderGlyphInk(d, 8);
    const grid = normalizeToGrid(data, width, height);
    // A rendered glyph always has ink, so grid is non-null.
    return featureOf(grid as DigitGrid);
  });
  return prototypes;
}

/** Softmax with a temperature that sharpens cosine scores into a distribution. */
function softmax(scores: number[], temp: number): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - max) / temp));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Pure classifier exposed for direct unit testing. */
export function classifyTemplate(
  grid: DigitGrid,
  minConfidence = 0.25,
): DigitPrediction {
  const feat = featureOf(grid);
  const sims = getPrototypes().map((p) => dot(feat, p)); // cosine in [0,1] for non-neg vecs
  const scores = softmax(sims, 0.06);
  return predictionFromScores(scores, minConfidence);
}

export function createTemplateRecognizer(): DigitRecognizer {
  return {
    id: "template",
    label: "Template (prototype)",
    async load() {
      getPrototypes(); // warm the prototype cache
    },
    recognize(grid: DigitGrid): DigitPrediction {
      return classifyTemplate(grid);
    },
  };
}
