// Handwriting digit recognition — engine-agnostic contract.
//
// Every recognizer consumes the SAME normalized input (a DigitGrid produced by
// `preprocess.normalizeToGrid`) and returns the SAME prediction shape, so the UI
// can swap engines (template baseline, tiny MLP, a future CNN/ONNX) by id alone.
// Pure logic only — no React/DOM here (§0.3). DOM-side capture lives in the
// canvas component; this layer starts from already-extracted ink.

/** Side length of the normalized square grid every engine consumes (MNIST-style). */
export const GRID_SIZE = 28;
/** Flattened length of a {@link DigitGrid}. */
export const GRID_LEN = GRID_SIZE * GRID_SIZE;

/**
 * Normalized ink as a row-major `GRID_SIZE × GRID_SIZE` grid, values in `[0,1]`
 * where `1` is full ink and `0` is blank. This is the single interchange format
 * between preprocessing and any recognizer.
 */
export type DigitGrid = Float32Array;

export interface DigitPrediction {
  /** Best digit `0..9`, or `null` when there's no confident guess (blank/garbage). */
  digit: number | null;
  /** Confidence of the winning digit in `[0,1]` (the max class score). */
  confidence: number;
  /** Per-class scores indexed `0..9`, summing to ~1 (a softmax / normalized score). */
  scores: number[];
}

/** A value a recognizer may return synchronously (pure-TS) or async (wasm/remote). */
export type Awaitable<T> = T | Promise<T>;

export interface DigitRecognizer {
  /** Stable id used to select the engine (e.g. `"template"`, `"mlp"`). */
  readonly id: string;
  /** Short human-facing name, for a debug/settings picker. */
  readonly label: string;
  /**
   * One-time lazy init (load weights / wasm). Idempotent and safe to call
   * repeatedly — callers should `await load()` before the first `recognize`.
   */
  load(): Promise<void>;
  /**
   * Classify a normalized grid. May assume {@link load} has resolved.
   * Returns `digit: null` for blank/low-confidence input rather than guessing.
   */
  recognize(grid: DigitGrid): Awaitable<DigitPrediction>;
}

/** Builds a {@link DigitPrediction} from raw per-class scores, picking the argmax. */
export function predictionFromScores(
  scores: number[],
  minConfidence: number,
): DigitPrediction {
  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[best]) best = i;
  }
  const confidence = scores[best] ?? 0;
  return {
    digit: confidence >= minConfidence ? best : null,
    confidence,
    scores,
  };
}
