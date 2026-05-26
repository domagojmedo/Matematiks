import { useEffect, useState } from "react";
import {
  getWhisperEngineState,
  preloadWhisper,
  subscribeWhisperEngine,
  type WhisperEngineState,
} from "../lib/whisperEngine";

/**
 * Subscribe to the module-level Whisper engine and (optionally) trigger the
 * model download. Multiple components can call this safely — the engine is
 * a singleton, so preload is idempotent and all subscribers see the same
 * state.
 */
export function useWhisperEngine(autoload: boolean): WhisperEngineState {
  const [state, setState] = useState<WhisperEngineState>(getWhisperEngineState);
  useEffect(() => subscribeWhisperEngine(setState), []);
  useEffect(() => {
    if (autoload) preloadWhisper();
  }, [autoload]);
  return state;
}
