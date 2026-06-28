import { describe, expect, it } from "vitest";
import { normalizeToGrid } from "../preprocess";
import { GRID_LEN } from "../types";
import { loadCnnWeights } from "../weights/mnistCnn";
import { cnnForward, createCnnRecognizer } from "./cnn";
import { renderGlyphInk } from "./template";

// Official ONNX Model Zoo MNIST test vector (mnist-8, test_data_set_0).
// Embedding it locks the entire conv/pool/dense pipeline numerically in CI.
const INPUT_B64 =
  "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";
const EXPECTED_LOGITS_B64 =
  "La5Hws6bNkEMtBNC+8HFQYNqgkAgxHXBAZ+8QOCfmMFC3Ei/4QmTwQ==";

function f32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}
const argmax = (a: ArrayLike<number>) => {
  let b = 0;
  for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i;
  return b;
};
function softmax(v: Float32Array): number[] {
  const m = Math.max(...v);
  const e = Array.from(v, (x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

describe("cnn weights", () => {
  it("decode to the expected tensor sizes", () => {
    const w = loadCnnWeights();
    expect(w.conv1.w).toHaveLength(8 * 1 * 5 * 5);
    expect(w.conv1.b).toHaveLength(8);
    expect(w.conv2.w).toHaveLength(16 * 8 * 5 * 5);
    expect(w.conv2.b).toHaveLength(16);
    expect(w.fc.w).toHaveLength(256 * 10);
    expect(w.fc.b).toHaveLength(10);
  });
});

describe("cnnForward", () => {
  it("reproduces the official ONNX test vector", () => {
    const input = f32(INPUT_B64);
    expect(input).toHaveLength(GRID_LEN);
    const expected = softmax(f32(EXPECTED_LOGITS_B64));
    const got = cnnForward(input, loadCnnWeights());
    expect(argmax(got)).toBe(argmax(expected));
    for (let i = 0; i < 10; i++) expect(got[i]).toBeCloseTo(expected[i], 3);
  });
});

describe("createCnnRecognizer", () => {
  it("loads and classifies a clean rendered digit", async () => {
    const rec = createCnnRecognizer({ minConfidence: 0 });
    await rec.load();
    const { data, width, height } = renderGlyphInk(1, 10);
    const grid = normalizeToGrid(data, width, height);
    const pred = await Promise.resolve(rec.recognize(grid as Float32Array));
    expect(pred.scores).toHaveLength(10);
    expect(pred.digit).not.toBeNull();
  });
});
