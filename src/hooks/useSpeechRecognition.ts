import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionAlternative = { transcript: string; confidence: number };
type RecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternative;
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
  /**
   * Called with the final transcript candidates, best-first. The engine
   * returns up to `maxAlternatives` guesses per utterance and the right
   * number is often not the top one (Croatian number words are easily
   * confused), so the caller should try parsing each and accept the first
   * that yields a valid number.
   */
  onResult: (candidates: string[]) => void;
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
    rec.continuous = false;
    rec.maxAlternatives = 3;
    rec.onresult = (e) => {
      // The event's results[] grows across firings within one session.
      // Aggregate everything from resultIndex onward, separating the
      // in-progress (interim) chunks from the engine's finalized results.
      let interimText = "";
      const finals: RecognitionResult[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finals.push(result);
        else interimText += result[0]?.transcript ?? "";
      }
      if (interimText) setInterim(interimText.trim());
      if (finals.length === 0) return;
      setInterim("");
      // Build one candidate string per alternative rank, concatenating that
      // rank across the final results (utterances are usually a single
      // result, so this is just its 1–3 alternatives). Dedupe and hand the
      // best-first list to the caller to parse.
      const maxAlts = Math.max(...finals.map((r) => r.length));
      const candidates: string[] = [];
      for (let k = 0; k < maxAlts; k++) {
        let text = "";
        for (const r of finals) {
          text += (r[k] ?? r[0])?.transcript ?? "";
        }
        const trimmed = text.trim();
        if (trimmed && !candidates.includes(trimmed)) candidates.push(trimmed);
      }
      if (candidates.length > 0) onResultRef.current(candidates);
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
