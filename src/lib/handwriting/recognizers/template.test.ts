import { describe, expect, it } from "vitest";
import { normalizeToGrid } from "../preprocess";
import {
  classifyTemplate,
  createTemplateRecognizer,
  renderGlyphInk,
} from "./template";

describe("template recognizer", () => {
  it("classifies every reference glyph through the full preprocess pipeline", () => {
    for (let d = 0; d <= 9; d++) {
      const { data, width, height } = renderGlyphInk(d, 8);
      const grid = normalizeToGrid(data, width, height);
      expect(grid, `digit ${d} produced ink`).not.toBeNull();
      const pred = classifyTemplate(grid as Float32Array);
      expect(pred.digit, `digit ${d} classified`).toBe(d);
    }
  });

  it("stays robust to off-center, scaled input (COM centering)", () => {
    // Render a "7" tiny and shoved into a corner of a large buffer.
    const glyph = renderGlyphInk(7, 4);
    const w = 120;
    const h = 120;
    const data = new Float32Array(w * h);
    for (let y = 0; y < glyph.height; y++) {
      for (let x = 0; x < glyph.width; x++) {
        data[(y + 3) * w + (x + 3)] = glyph.data[y * glyph.width + x];
      }
    }
    const grid = normalizeToGrid(data, w, h) as Float32Array;
    expect(classifyTemplate(grid).digit).toBe(7);
  });

  it("returns digit:null for blank / no confident match", () => {
    // A near-uniform faint grid has no glyph structure → low confidence.
    const flat = new Float32Array(28 * 28).fill(0.02);
    const pred = classifyTemplate(flat, 0.9);
    expect(pred.digit).toBeNull();
    expect(pred.scores).toHaveLength(10);
  });

  it("exposes a stable id and loads without assets", async () => {
    const rec = createTemplateRecognizer();
    expect(rec.id).toBe("template");
    await expect(rec.load()).resolves.toBeUndefined();
  });
});
