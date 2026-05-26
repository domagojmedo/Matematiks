import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionAlternative = { transcript: string; confidence: number };
type RecognitionResult = {
  isFinal: boolean;
  0: RecognitionAlternative;
  length: number;
};
type RecognitionResultList = {
  length: number;
  [index: number]: RecognitionResult;
};
type RecognitionEvent = {
  resultIndex: number;
  results: RecognitionResultList;
};
type RecognitionErrorEvent = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechHookOptions = {
  lang: string;
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
};

export function useSpeechRecognition({
  lang,
  onResult,
  onError,
}: SpeechHookOptions) {
  const [listening, setListening] = useState(false);
  // True while the engine reports speech is currently being heard
  // (between onspeechstart and onspeechend). Drives the "I hear you" pulse.
  const [speechActive, setSpeechActive] = useState(false);
  // Latest interim transcript — the partial words being recognized before
  // the final result lands. Empty when nothing is being spoken.
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // already stopped
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch {
        // ignore
      }
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 3;
    rec.onresult = (e) => {
      // The event's results[] grows across firings within one session.
      // Aggregate everything from resultIndex onward, separating the
      // in-progress (interim) chunks from the engine's finalized text.
      let interimText = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      if (interimText) setInterim(interimText.trim());
      if (finalText) {
        setInterim("");
        onResultRef.current(finalText);
      }
    };
    rec.onerror = (e) => {
      onErrorRef.current?.(e.error);
    };
    rec.onspeechstart = () => setSpeechActive(true);
    rec.onspeechend = () => setSpeechActive(false);
    rec.onend = () => {
      setListening(false);
      setSpeechActive(false);
      setInterim("");
      recRef.current = null;
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch (err) {
      setListening(false);
      recRef.current = null;
      onErrorRef.current?.(String(err));
    }
  }, [lang]);

  useEffect(() => {
    return () => {
      const rec = recRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { listening, speechActive, interim, start, stop };
}
