import type { Language } from "./types";

// Module-level singleton: the Whisper worker outlives any individual hook
// instance. Once a user flips the toggle on in Settings, the model starts
// downloading; by the time they navigate into a practice round the engine
// is already loaded. Re-creating the worker per route would force the
// pipeline to re-initialize (~5–10s) on every navigation.

export type WhisperEngineStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

export type WhisperEngineState = {
  status: WhisperEngineStatus;
  /** 0..1 while a model file is downloading; null otherwise. */
  downloadProgress: number | null;
  error: string | null;
};

type WorkerOut =
  | {
      type: "progress";
      status: string;
      file?: string;
      loaded?: number;
      total?: number;
    }
  | { type: "ready" }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id?: number; message: string };

const listeners = new Set<(state: WhisperEngineState) => void>();
let state: WhisperEngineState = {
  status: "idle",
  downloadProgress: null,
  error: null,
};
let worker: Worker | null = null;
const pending = new Map<
  number,
  { resolve: (text: string) => void; reject: (err: string) => void }
>();
let nextId = 0;

// Per-file download progress. transformers.js fires events per asset
// (encoder.onnx, decoder.onnx, tokenizer.json, etc.); we aggregate so the
// reported ratio is monotonic across the whole load instead of jumping
// back to 0% every time a new file starts.
const fileProgress = new Map<string, { loaded: number; total: number }>();

function setState(patch: Partial<WhisperEngineState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l(state);
}

function recomputeProgress(): void {
  let loaded = 0;
  let total = 0;
  for (const f of fileProgress.values()) {
    loaded += f.loaded;
    total += f.total;
  }
  if (total === 0) return;
  setState({ downloadProgress: Math.min(1, loaded / total) });
}

function attachWorker(): Worker {
  const w = new Worker(
    new URL("../workers/whisper.worker.ts", import.meta.url),
    { type: "module" },
  );
  w.addEventListener("message", (e: MessageEvent<WorkerOut>) => {
    const msg = e.data;
    if (msg.type === "progress") {
      if (
        (msg.status === "progress" || msg.status === "done") &&
        msg.file &&
        msg.total
      ) {
        // On 'done' transformers.js reports loaded === total, which keeps the
        // aggregate ratio climbing monotonically as files finish.
        const finalLoaded =
          msg.status === "done" ? msg.total : (msg.loaded ?? 0);
        fileProgress.set(msg.file, {
          loaded: finalLoaded,
          total: msg.total,
        });
        recomputeProgress();
      }
      return;
    }
    if (msg.type === "ready") {
      fileProgress.clear();
      setState({ status: "ready", downloadProgress: null, error: null });
      return;
    }
    if (msg.type === "result") {
      const p = pending.get(msg.id);
      if (p) {
        p.resolve(msg.text);
        pending.delete(msg.id);
      }
      return;
    }
    if (msg.type === "error") {
      if (msg.id !== undefined) {
        const p = pending.get(msg.id);
        if (p) {
          p.reject(msg.message);
          pending.delete(msg.id);
        }
      } else {
        setState({ status: "error", error: msg.message });
      }
      return;
    }
  });
  return w;
}

/**
 * Spin up the worker and start the model download if it hasn't begun yet.
 * Idempotent — safe to call from multiple places (Settings + practice routes).
 */
export function preloadWhisper(): void {
  if (worker) return;
  setState({ status: "loading", downloadProgress: 0, error: null });
  worker = attachWorker();
  worker.postMessage({ type: "load" });
}

export function transcribeWhisper(
  pcm: Float32Array,
  language: Language,
): Promise<string> {
  if (!worker) {
    preloadWhisper();
  }
  const w = worker;
  if (!w) {
    return Promise.reject(new Error("whisper worker unavailable"));
  }
  const id = ++nextId;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage(
      { type: "transcribe", id, pcm, language },
      [pcm.buffer],
    );
  });
}

export function getWhisperEngineState(): WhisperEngineState {
  return state;
}

export function subscribeWhisperEngine(
  listener: (state: WhisperEngineState) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
