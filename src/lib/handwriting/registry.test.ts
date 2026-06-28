import { afterEach, describe, expect, it } from "vitest";
import {
  availableRecognizers,
  DEFAULT_RECOGNIZER_ID,
  getRecognizer,
  registerRecognizer,
  resetRecognizers,
} from "./registry";
import type { DigitRecognizer } from "./types";

afterEach(() => {
  // Drop memoized instances; keep built-in factories registered.
  resetRecognizers();
});

describe("recognizer registry", () => {
  it("ships the CNN as default with the template engine available", () => {
    expect(availableRecognizers()).toContain("cnn");
    expect(availableRecognizers()).toContain("template");
    expect(DEFAULT_RECOGNIZER_ID).toBe("cnn");
    expect(getRecognizer(DEFAULT_RECOGNIZER_ID).id).toBe("cnn");
  });

  it("memoizes one instance per id", () => {
    const a = getRecognizer("template");
    const b = getRecognizer("template");
    expect(a).toBe(b);
  });

  it("throws a helpful error for an unknown id", () => {
    expect(() => getRecognizer("nope")).toThrow(/Unknown digit recognizer/);
  });

  it("lets a new engine register with a one-line factory", () => {
    const stub: DigitRecognizer = {
      id: "stub",
      label: "Stub",
      load: () => Promise.resolve(),
      recognize: () => ({ digit: 4, confidence: 1, scores: [] }),
    };
    registerRecognizer("stub", () => stub);
    expect(availableRecognizers()).toContain("stub");
    expect(getRecognizer("stub")).toBe(stub);
  });
});
