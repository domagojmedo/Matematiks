// Tiny MLP recognizer over injected weights.
//
// The forward pass is plain matrix math (pure, testable). Trained weights are
// supplied via a `MlpWeights` object — typically a generated module committed to
// the repo, or fetched/decoded lazily in `load()`. We keep weights INJECTED
// rather than imported so this engine builds and is tested with synthetic
// weights before a real MNIST export exists. Register it (see registry.ts) once
// a weights provider is wired up.

import {
  type DigitGrid,
  type DigitPrediction,
  type DigitRecognizer,
  GRID_LEN,
  predictionFromScores,
} from "../types";

export type Activation = "relu" | "softmax";

export interface DenseLayer {
  /** Row-major `in × out` weight matrix (length `in * out`). */
  weights: Float32Array;
  /** Bias vector (length `out`). */
  bias: Float32Array;
  in: number;
  out: number;
  activation: Activation;
}

export interface MlpWeights {
  /** Expected flat input length; must match the flattened {@link DigitGrid}. */
  inputLen: number;
  layers: DenseLayer[];
}

function relu(v: Float32Array): Float32Array {
  for (let i = 0; i < v.length; i++) if (v[i] < 0) v[i] = 0;
  return v;
}

function softmax(v: Float32Array): number[] {
  let max = -Infinity;
  for (const x of v) if (x > max) max = x;
  let sum = 0;
  const out = new Array<number>(v.length);
  for (let i = 0; i < v.length; i++) {
    out[i] = Math.exp(v[i] - max);
    sum += out[i];
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

/**
 * Single dense layer: `out = input · W + b`, then ReLU for hidden layers.
 * A `"softmax"` activation marks the output layer as logits — the final softmax
 * is applied once by {@link mlpForward}, not per-layer.
 */
function dense(input: Float32Array, layer: DenseLayer): Float32Array {
  const out = new Float32Array(layer.out);
  for (let o = 0; o < layer.out; o++) {
    let acc = layer.bias[o];
    for (let i = 0; i < layer.in; i++)
      acc += input[i] * layer.weights[i * layer.out + o];
    out[o] = acc;
  }
  return layer.activation === "relu" ? relu(out) : out;
}

/**
 * Pure forward pass → per-class probabilities (length = final layer `out`).
 * The final layer's logits are always softmaxed. Exposed for direct unit testing.
 */
export function mlpForward(input: Float32Array, w: MlpWeights): number[] {
  if (input.length !== w.inputLen) {
    throw new Error(
      `mlpForward: input length ${input.length} != expected ${w.inputLen}`,
    );
  }
  let x = input;
  for (const layer of w.layers) {
    if (layer.in !== x.length) {
      throw new Error(
        `mlpForward: layer in ${layer.in} != activation length ${x.length}`,
      );
    }
    x = dense(x, layer);
  }
  return softmax(x);
}

/**
 * Build an MLP recognizer. Pass weights directly, or a loader that resolves them
 * lazily (e.g. dynamic-import a generated module, or fetch+decode a blob).
 */
export function createMlpRecognizer(
  source: MlpWeights | (() => Promise<MlpWeights>),
  opts: { id?: string; label?: string; minConfidence?: number } = {},
): DigitRecognizer {
  let weights: MlpWeights | null = typeof source === "function" ? null : source;
  let loading: Promise<void> | null = null;
  const minConfidence = opts.minConfidence ?? 0.5;

  return {
    id: opts.id ?? "mlp",
    label: opts.label ?? "MLP",
    load(): Promise<void> {
      if (weights) return Promise.resolve();
      if (!loading) {
        loading = (source as () => Promise<MlpWeights>)().then((w) => {
          weights = w;
        });
      }
      return loading;
    },
    recognize(grid: DigitGrid): DigitPrediction {
      if (!weights) {
        throw new Error("mlp recognizer: call load() before recognize()");
      }
      if (grid.length !== GRID_LEN) {
        throw new Error(
          `mlp recognizer: grid length ${grid.length} != ${GRID_LEN}`,
        );
      }
      const scores = mlpForward(grid, weights);
      return predictionFromScores(scores, minConfidence);
    },
  };
}
