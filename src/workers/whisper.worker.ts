/// <reference lib="webworker" />
import {
  type AutomaticSpeechRecognitionPipeline,
  env,
  pipeline,
  type ProgressInfo,
} from "@huggingface/transformers";

// GitHub Pages doesn't set the COOP/COEP headers required for SharedArrayBuffer,
// so multi-threaded ONNX runtime isn't available. Force single-thread WASM to
// avoid runtime warnings; whisper-tiny is small enough that single-thread is
// usable on mid-range tablets.
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

type LoadMsg = { type: "load" };
type TranscribeMsg = {
  type: "transcribe";
  id: number;
  pcm: Float32Array;
  language: "hr" | "en";
};
type UnloadMsg = { type: "unload" };
type InMsg = LoadMsg | TranscribeMsg | UnloadMsg;

type ProgressOut = {
  type: "progress";
  file?: string;
  loaded?: number;
  total?: number;
  status: string;
};
type ReadyOut = { type: "ready" };
type ResultOut = { type: "result"; id: number; text: string };
type ErrorOut = { type: "error"; id?: number; message: string };
type OutMsg = ProgressOut | ReadyOut | ResultOut | ErrorOut;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: OutMsg): void {
  ctx.postMessage(msg);
}

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

const WHISPER_LANG: Record<"hr" | "en", string> = {
  hr: "croatian",
  en: "english",
};

async function getPipeline(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (asr) return asr;
  if (loading) return loading;
  loading = (async () => {
    const p = (await pipeline(
      "automatic-speech-recognition",
      // onnx-community is the actively maintained ONNX export of whisper-tiny.
      // The older Xenova/whisper-tiny q8 build ships without some scale tensors
      // that current onnxruntime-web requires, which fails with
      // "Missing required scale" at session creation.
      "onnx-community/whisper-tiny",
      {
        // q4 keeps the encoder small (~30 MB total for tiny) without the
        // missing-scale issue q8 has on this model. Quality is adequate for
        // short numeric utterances in HR and EN.
        dtype: "q4",
        progress_callback: (info: ProgressInfo) => {
          const anyInfo = info as ProgressInfo & {
            file?: string;
            loaded?: number;
            total?: number;
          };
          post({
            type: "progress",
            status: info.status,
            ...(anyInfo.file !== undefined ? { file: anyInfo.file } : {}),
            ...(anyInfo.loaded !== undefined
              ? { loaded: anyInfo.loaded }
              : {}),
            ...(anyInfo.total !== undefined ? { total: anyInfo.total } : {}),
          });
        },
      },
    )) as AutomaticSpeechRecognitionPipeline;
    asr = p;
    post({ type: "ready" });
    return p;
  })();
  return loading;
}

ctx.addEventListener("message", async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await getPipeline();
      return;
    }
    if (msg.type === "transcribe") {
      const p = await getPipeline();
      const out = await p(msg.pcm, {
        language: WHISPER_LANG[msg.language],
        task: "transcribe",
        return_timestamps: false,
      });
      const text = Array.isArray(out)
        ? out.map((o) => o.text).join(" ")
        : (out.text ?? "");
      post({ type: "result", id: msg.id, text });
      return;
    }
    if (msg.type === "unload") {
      asr = null;
      loading = null;
    }
  } catch (err) {
    post({
      type: "error",
      ...(msg.type === "transcribe" ? { id: msg.id } : {}),
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
