// Handwriting digit recognition — public surface.
//
// Pipeline: capture ink (canvas component) → `normalizeToGrid` → a
// `DigitRecognizer` chosen via the registry → `DigitPrediction` → `onDigit(n)`.

export { downsampleGrid, normalizeToGrid } from "./preprocess";
export { cnnForward, createCnnRecognizer } from "./recognizers/cnn";
export {
  type Activation,
  createMlpRecognizer,
  type DenseLayer,
  type MlpWeights,
  mlpForward,
} from "./recognizers/mlp";
export {
  classifyTemplate,
  createTemplateRecognizer,
} from "./recognizers/template";
export {
  availableRecognizers,
  DEFAULT_RECOGNIZER_ID,
  getRecognizer,
  registerRecognizer,
  resetRecognizers,
} from "./registry";
export { cropInk, type InkBounds, segmentInk } from "./segment";
export {
  type Awaitable,
  type DigitGrid,
  type DigitPrediction,
  type DigitRecognizer,
  GRID_LEN,
  GRID_SIZE,
  predictionFromScores,
} from "./types";
export { type CnnWeights, loadCnnWeights } from "./weights/mnistCnn";
