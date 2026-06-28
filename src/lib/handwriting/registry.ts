// Engine registry: pick a recognizer by id, instantiate once, memoize.
//
// Adding an engine = write a `create<Name>Recognizer()` factory and register it
// here. The UI selects by id (`DEFAULT_RECOGNIZER_ID`), so trying a different
// path is a one-line change. Instances are memoized so a recognizer's `load()`
// (weights/wasm) runs at most once per id.

import { createCnnRecognizer } from "./recognizers/cnn";
import { createTemplateRecognizer } from "./recognizers/template";
import type { DigitRecognizer } from "./types";

type Factory = () => DigitRecognizer;

const FACTORIES = new Map<string, Factory>();
const INSTANCES = new Map<string, DigitRecognizer>();

export function registerRecognizer(id: string, factory: Factory): void {
  FACTORIES.set(id, factory);
}

/** Returns the memoized instance for `id`, throwing if it isn't registered. */
export function getRecognizer(id: string): DigitRecognizer {
  const existing = INSTANCES.get(id);
  if (existing) return existing;
  const factory = FACTORIES.get(id);
  if (!factory) {
    throw new Error(
      `Unknown digit recognizer "${id}". Registered: ${availableRecognizers().join(", ")}`,
    );
  }
  const instance = factory();
  INSTANCES.set(id, instance);
  return instance;
}

export function availableRecognizers(): string[] {
  return [...FACTORIES.keys()];
}

/** Test-only: drop memoized instances (and optionally registrations). */
export function resetRecognizers(
  opts: { clearFactories?: boolean } = {},
): void {
  INSTANCES.clear();
  if (opts.clearFactories) FACTORIES.clear();
}

// --- Built-in engines -------------------------------------------------------
// `cnn` is the pre-trained MNIST convolutional net (best accuracy, embedded
// weights, zero npm deps). `template` is the zero-asset prototype baseline, kept
// as a fallback / comparison engine. The MLP engine (recognizers/mlp.ts) stays
// available for a future dense-only model but isn't registered without weights.

/** Id of the engine the UI uses by default. */
export const DEFAULT_RECOGNIZER_ID = "cnn";

registerRecognizer("cnn", () => createCnnRecognizer());
registerRecognizer("template", createTemplateRecognizer);
