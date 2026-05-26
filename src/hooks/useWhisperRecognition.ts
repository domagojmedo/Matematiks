import { useCallback, useEffect, useRef, useState } from "react";
import pcmCaptureWorkletUrl from "../audio/pcm-capture.worklet.ts?worker&url";
import { transcribeWhisper } from "../lib/whisperEngine";
import type { Language } from "../lib/types";
import { useWhisperEngine } from "./useWhisperEngine";

const TARGET_RATE = 16_000;
// VAD parameters — tuned for indoor speech on a tablet/laptop mic.
const RMS_THRESHOLD = 0.02;
const SILENCE_HANG_MS = 700;
const MIN_UTTERANCE_MS = 250;
const PREPAD_MS = 200;
const MAX_UTTERANCE_MS = 8_000;
const BUFFER_KEEP_MS = 10_000;

export type WhisperHookOptions = {
  lang: Language;
  enabled: boolean;
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
};

function resampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === TARGET_RATE) return input;
  const ratio = inputRate / TARGET_RATE;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    output[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return output;
}

function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

export function useWhisperRecognition({
  lang,
  enabled,
  onResult,
  onError,
}: WhisperHookOptions) {
  const [listening, setListening] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);

  // The engine is a process-wide singleton owned by lib/whisperEngine.ts.
  // This hook subscribes to its load state and asks it to start downloading
  // as soon as `enabled` is true.
  const engineState = useWhisperEngine(enabled);

  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const langRef = useRef(lang);
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
    langRef.current = lang;
  }, [onResult, onError, lang]);

  // All audio plumbing lives in refs — we deliberately avoid putting these
  // into React state to keep audio-thread updates from triggering renders.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const bufferRef = useRef<Float32Array[]>([]);
  const bufferLenRef = useRef(0);
  // Sample index (in the rolling buffer) where the current utterance began.
  // Null when no speech is in progress.
  const speechStartRef = useRef<number | null>(null);
  const lastVoiceAtRef = useRef<number>(0);
  const totalSamplesRef = useRef(0);

  const stopAudio = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    // We deliberately leave the AudioContext alive so a quick stop/start
    // cycle doesn't pay the ~200ms context init cost again. It gets closed
    // when the hook unmounts.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    bufferRef.current = [];
    bufferLenRef.current = 0;
    speechStartRef.current = null;
    setListening(false);
    setSpeechActive(false);
  }, []);

  const flushUtterance = useCallback(() => {
    const start = speechStartRef.current;
    if (start === null) return;
    speechStartRef.current = null;
    setSpeechActive(false);

    const total = totalSamplesRef.current;
    const utterEnd = total;
    const utterStart = Math.max(
      0,
      start - Math.floor((PREPAD_MS / 1000) * TARGET_RATE),
    );
    const length = utterEnd - utterStart;
    if (length < (MIN_UTTERANCE_MS / 1000) * TARGET_RATE) return;

    // Pull contiguous samples out of the chunked buffer at [utterStart, utterEnd).
    const out = new Float32Array(length);
    let written = 0;
    let chunkStart = total - bufferLenRef.current;
    for (const chunk of bufferRef.current) {
      const chunkEnd = chunkStart + chunk.length;
      const overlapStart = Math.max(chunkStart, utterStart);
      const overlapEnd = Math.min(chunkEnd, utterEnd);
      if (overlapEnd > overlapStart) {
        const src = chunk.subarray(
          overlapStart - chunkStart,
          overlapEnd - chunkStart,
        );
        out.set(src, written);
        written += src.length;
      }
      chunkStart = chunkEnd;
    }

    transcribeWhisper(out, langRef.current)
      .then((text) => {
        const trimmed = text.trim();
        if (trimmed) onResultRef.current(trimmed);
      })
      .catch((err) => {
        onErrorRef.current?.(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const onPcmFrame = useCallback(
    (frame: Float32Array, inputRate: number) => {
      const resampled = resampleTo16k(frame, inputRate);
      bufferRef.current.push(resampled);
      bufferLenRef.current += resampled.length;
      totalSamplesRef.current += resampled.length;

      // Trim old chunks past BUFFER_KEEP_MS so the buffer doesn't grow without
      // bound during long sessions.
      const keepSamples = Math.floor((BUFFER_KEEP_MS / 1000) * TARGET_RATE);
      while (
        bufferLenRef.current - (bufferRef.current[0]?.length ?? 0) >
        keepSamples
      ) {
        const dropped = bufferRef.current.shift();
        if (!dropped) break;
        bufferLenRef.current -= dropped.length;
      }

      const level = rms(resampled);
      const now = performance.now();

      if (level >= RMS_THRESHOLD) {
        lastVoiceAtRef.current = now;
        if (speechStartRef.current === null) {
          speechStartRef.current =
            totalSamplesRef.current - resampled.length;
          setSpeechActive(true);
        }
      }

      if (speechStartRef.current !== null) {
        const startSample = speechStartRef.current;
        const lengthSamples = totalSamplesRef.current - startSample;
        const lengthMs = (lengthSamples / TARGET_RATE) * 1000;
        const silenceMs = now - lastVoiceAtRef.current;
        if (
          silenceMs >= SILENCE_HANG_MS ||
          lengthMs >= MAX_UTTERANCE_MS
        ) {
          flushUtterance();
        }
      }
    },
    [flushUtterance],
  );

  const start = useCallback(async () => {
    if (!enabled) return;
    if (listening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      let ctx = audioCtxRef.current;
      if (!ctx) {
        ctx = new AudioContext();
        audioCtxRef.current = ctx;
        await ctx.audioWorklet.addModule(pcmCaptureWorkletUrl);
      }
      if (ctx.state === "suspended") await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pcm-capture");
      const inputRate = ctx.sampleRate;
      node.port.onmessage = (e: MessageEvent<Float32Array>) => {
        onPcmFrame(e.data, inputRate);
      };
      source.connect(node);
      // Worklet doesn't produce audio; routing through a muted gain keeps the
      // graph alive without echoing the mic.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      node.connect(sink).connect(ctx.destination);

      sourceNodeRef.current = source;
      workletNodeRef.current = node;
      totalSamplesRef.current = 0;
      bufferRef.current = [];
      bufferLenRef.current = 0;
      speechStartRef.current = null;
      lastVoiceAtRef.current = performance.now();
      setListening(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Surface mic-permission denial in the same shape useSpeechRecognition
      // emits so the Practice route's existing error handler can react.
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "SecurityError")
      ) {
        onErrorRef.current?.("not-allowed");
      } else {
        onErrorRef.current?.(msg);
      }
      stopAudio();
    }
  }, [enabled, listening, onPcmFrame, stopAudio]);

  const stop = useCallback(() => {
    stopAudio();
  }, [stopAudio]);

  // Tear down the audio graph on unmount. The worker stays alive in the
  // singleton — that's the whole point of moving it out of this hook.
  useEffect(() => {
    return () => {
      stopAudio();
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, [stopAudio]);

  return {
    listening,
    speechActive,
    interim: "",
    start,
    stop,
    modelLoaded: engineState.status === "ready",
    downloadProgress: engineState.downloadProgress,
  };
}
