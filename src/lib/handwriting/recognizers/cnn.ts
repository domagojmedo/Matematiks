// CNN recognizer: pre-trained MNIST convolutional net, pure-TS inference.
//
// Weights come from the ONNX Model Zoo MNIST model (see weights/mnistCnn.ts) —
// no training here, just a one-time conversion. The forward pass below is a
// direct port of the reference implementation that was verified to reproduce the
// model's official test vector to 1.3e-5 (locked in cnn.test.ts).
//
// Expected input: a normalized DigitGrid (28×28, [0,1], ink = 1, white digit on
// black) — exactly what `normalizeToGrid` produces and what the model's README
// specifies. No extra scaling.

import {
  type DigitGrid,
  type DigitPrediction,
  type DigitRecognizer,
  GRID_LEN,
  GRID_SIZE,
  predictionFromScores,
} from "../types";
import { type CnnWeights, loadCnnWeights } from "../weights/mnistCnn";

interface Feature {
  data: Float32Array; // row-major [C, H, W]
  c: number;
  h: number;
  w: number;
}

/** 2-D convolution, stride 1, symmetric padding (used for SAME on odd kernels). */
function conv(
  inp: Feature,
  weights: Float32Array,
  bias: Float32Array,
  outC: number,
  k: number,
  pad: number,
): Feature {
  const { data, c: inC, h, w } = inp;
  const out = new Float32Array(outC * h * w);
  for (let oc = 0; oc < outC; oc++) {
    for (let oy = 0; oy < h; oy++) {
      for (let ox = 0; ox < w; ox++) {
        let acc = bias[oc];
        for (let ic = 0; ic < inC; ic++) {
          for (let ky = 0; ky < k; ky++) {
            const iy = oy + ky - pad;
            if (iy < 0 || iy >= h) continue;
            for (let kx = 0; kx < k; kx++) {
              const ix = ox + kx - pad;
              if (ix < 0 || ix >= w) continue;
              acc +=
                data[(ic * h + iy) * w + ix] *
                weights[((oc * inC + ic) * k + ky) * k + kx];
            }
          }
        }
        out[(oc * h + oy) * w + ox] = acc;
      }
    }
  }
  return { data: out, c: outC, h, w };
}

function reluInPlace(f: Feature): Feature {
  const d = f.data;
  for (let i = 0; i < d.length; i++) if (d[i] < 0) d[i] = 0;
  return f;
}

/** Max pooling, square window, no padding. */
function maxPool(inp: Feature, k: number, stride: number): Feature {
  const { data, c, h, w } = inp;
  const ho = Math.floor((h - k) / stride) + 1;
  const wo = Math.floor((w - k) / stride) + 1;
  const out = new Float32Array(c * ho * wo);
  for (let ch = 0; ch < c; ch++) {
    for (let oy = 0; oy < ho; oy++) {
      for (let ox = 0; ox < wo; ox++) {
        let m = -Infinity;
        for (let ky = 0; ky < k; ky++) {
          for (let kx = 0; kx < k; kx++) {
            const v = data[(ch * h + oy * stride + ky) * w + ox * stride + kx];
            if (v > m) m = v;
          }
        }
        out[(ch * ho + oy) * wo + ox] = m;
      }
    }
  }
  return { data: out, c, h: ho, w: wo };
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
 * Pure forward pass → per-class probabilities (length 10). Input is a flat
 * 28×28 grid ([0,1]). Exposed for direct unit testing against the model's vector.
 */
export function cnnForward(grid: DigitGrid, weights: CnnWeights): number[] {
  let x: Feature = { data: grid, c: 1, h: GRID_SIZE, w: GRID_SIZE };
  x = reluInPlace(conv(x, weights.conv1.w, weights.conv1.b, 8, 5, 2));
  x = maxPool(x, 2, 2); // -> [8,14,14]
  x = reluInPlace(conv(x, weights.conv2.w, weights.conv2.b, 16, 5, 2));
  x = maxPool(x, 3, 3); // -> [16,4,4]

  // Flatten [16,4,4] (c,h,w row-major) and apply the dense layer.
  const flat = x.data; // length 256
  const { w: fw, b: fb } = weights.fc;
  const logits = new Float32Array(10);
  for (let j = 0; j < 10; j++) {
    let acc = fb[j];
    for (let r = 0; r < 256; r++) acc += flat[r] * fw[r * 10 + j];
    logits[j] = acc;
  }
  return softmax(logits);
}

export function createCnnRecognizer(
  opts: { minConfidence?: number } = {},
): DigitRecognizer {
  let weights: CnnWeights | null = null;
  const minConfidence = opts.minConfidence ?? 0.55;
  return {
    id: "cnn",
    label: "MNIST CNN",
    async load() {
      if (!weights) weights = loadCnnWeights();
    },
    recognize(grid: DigitGrid): DigitPrediction {
      if (!weights) weights = loadCnnWeights();
      if (grid.length !== GRID_LEN) {
        throw new Error(
          `cnn recognizer: grid length ${grid.length} != ${GRID_LEN}`,
        );
      }
      return predictionFromScores(cnnForward(grid, weights), minConfidence);
    },
  };
}
