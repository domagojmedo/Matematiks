import { describe, expect, it } from "vitest";
import { GRID_LEN } from "../types";
import { createMlpRecognizer, type MlpWeights, mlpForward } from "./mlp";

/**
 * A trivial 2-class-ish net over a length-2 input with a single dense+softmax
 * layer. Weights chosen so input[0] drives class 0 and input[1] drives class 1.
 * (Padded to 10 outputs so it matches the prediction shape.)
 */
function tinyNet(): MlpWeights {
  const inputLen = 2;
  const out = 10;
  const weights = new Float32Array(inputLen * out);
  weights[0 * out + 0] = 5; // input0 -> class0
  weights[1 * out + 1] = 5; // input1 -> class1
  return {
    inputLen,
    layers: [
      {
        weights,
        bias: new Float32Array(out),
        in: inputLen,
        out,
        activation: "softmax",
      },
    ],
  };
}

describe("mlpForward", () => {
  it("returns a probability distribution summing to 1", () => {
    const scores = mlpForward(new Float32Array([1, 0]), tinyNet());
    expect(scores).toHaveLength(10);
    expect(scores.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it("routes the argmax to the driven class", () => {
    const a = mlpForward(new Float32Array([1, 0]), tinyNet());
    const b = mlpForward(new Float32Array([0, 1]), tinyNet());
    expect(a.indexOf(Math.max(...a))).toBe(0);
    expect(b.indexOf(Math.max(...b))).toBe(1);
  });

  it("applies relu then softmax across two layers", () => {
    const net: MlpWeights = {
      inputLen: 2,
      layers: [
        // identity-ish hidden with a negative path to exercise relu
        {
          weights: new Float32Array([1, -1, -1, 1]),
          bias: new Float32Array([0, 0]),
          in: 2,
          out: 2,
          activation: "relu",
        },
        {
          weights: new Float32Array(2 * 10).map((_, i) =>
            i === 0 ? 3 : i === 11 ? 3 : 0,
          ),
          bias: new Float32Array(10),
          in: 2,
          out: 10,
          activation: "softmax",
        },
      ],
    };
    const scores = mlpForward(new Float32Array([2, 0]), net);
    expect(scores.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(scores.indexOf(Math.max(...scores))).toBe(0);
  });

  it("throws on input-length mismatch", () => {
    expect(() => mlpForward(new Float32Array([1, 2, 3]), tinyNet())).toThrow();
  });
});

describe("createMlpRecognizer", () => {
  it("lazily loads weights from a provider before recognizing", async () => {
    let calls = 0;
    const rec = createMlpRecognizer(
      () => {
        calls++;
        return Promise.resolve(tinyNet());
      },
      { id: "mlp-test", minConfidence: 0 },
    );
    expect(rec.id).toBe("mlp-test");
    // recognize before load throws
    expect(() => rec.recognize(new Float32Array([1, 0]))).toThrow();
    await rec.load();
    await rec.load(); // idempotent
    expect(calls).toBe(1);
  });

  it("accepts eager weights and produces a prediction from a real-size grid", async () => {
    // A GRID_LEN-input net where pixel 0 drives class 0.
    const out = 10;
    const weights = new Float32Array(GRID_LEN * out);
    weights[0 * out + 0] = 8;
    const net: MlpWeights = {
      inputLen: GRID_LEN,
      layers: [
        {
          weights,
          bias: new Float32Array(out),
          in: GRID_LEN,
          out,
          activation: "softmax",
        },
      ],
    };
    const rec = createMlpRecognizer(net, { minConfidence: 0 });
    const grid = new Float32Array(GRID_LEN);
    grid[0] = 1;
    const pred = await Promise.resolve(rec.recognize(grid));
    expect(pred.digit).toBe(0);
    expect(pred.scores).toHaveLength(10);
  });
});
