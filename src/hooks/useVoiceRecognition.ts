import { speechLangTag } from "../lib/speech";
import type { Language } from "../lib/types";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useWhisperRecognition } from "./useWhisperRecognition";

export type VoiceRecognitionOptions = {
  language: Language;
  /** When true, use the on-device Whisper engine; otherwise Web Speech. */
  useWhisper: boolean;
  /** Final transcript candidates, best-first — see useSpeechRecognition. */
  onResult: (candidates: string[]) => void;
  onError?: (error: string) => void;
};

export type VoiceRecognitionResult = {
  listening: boolean;
  speechActive: boolean;
  interim: string;
  start: () => void;
  stop: () => void;
  /** True once the Whisper model is ready (always true for Web Speech). */
  modelLoaded: boolean;
  /** 0..1 while the Whisper model is downloading; null otherwise. */
  downloadProgress: number | null;
};

export function useVoiceRecognition({
  language,
  useWhisper,
  onResult,
  onError,
}: VoiceRecognitionOptions): VoiceRecognitionResult {
  // Both hooks are always called so React's hook order stays stable.
  // Web Speech acquires no resources until start(); Whisper gates its worker
  // on the `enabled` flag, so the inactive backend is effectively free.
  const ws = useSpeechRecognition({
    lang: speechLangTag(language),
    onResult,
    onError,
  });
  const wh = useWhisperRecognition({
    lang: language,
    enabled: useWhisper,
    // Whisper yields a single transcript; wrap it as a one-element candidate
    // list so both backends share the same onResult contract.
    onResult: (transcript: string) => onResult([transcript]),
    onError,
  });

  if (useWhisper) {
    return {
      listening: wh.listening,
      speechActive: wh.speechActive,
      interim: wh.interim,
      start: wh.start,
      stop: wh.stop,
      modelLoaded: wh.modelLoaded,
      downloadProgress: wh.downloadProgress,
    };
  }
  return {
    listening: ws.listening,
    speechActive: ws.speechActive,
    interim: ws.interim,
    start: ws.start,
    stop: ws.stop,
    modelLoaded: true,
    downloadProgress: null,
  };
}
