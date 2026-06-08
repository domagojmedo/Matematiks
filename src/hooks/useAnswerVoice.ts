import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Flash } from "../components/RoundChrome";
import { parseSpokenNumber, speechLangTag } from "../lib/speech";
import type { Language } from "../lib/types";
import { useSpeechRecognition } from "./useSpeechRecognition";

const MAX_VOICE_ATTEMPTS = 3;

/**
 * Numeric voice input for answer/convert/solve/fraction phases, shared by the
 * horizontal-arithmetic and word question components. Owns the mic engine,
 * the kid-toggleable mute, error hinting, and the bounded auto-listen retry
 * loop (capped to avoid the Android/MIUI mic-chime feedback loop).
 *
 * `gateOpen` is whether the current phase accepts numeric voice; `gateKey`
 * changes when the active phase changes (re-arms the per-phase attempt budget).
 */
export function useAnswerVoice({
  language,
  enabled,
  gateOpen,
  gateKey,
  flash,
  onNumber,
  trackedTimeout,
}: {
  language: Language;
  enabled: boolean;
  gateOpen: boolean;
  gateKey: unknown;
  flash: Flash;
  onNumber: (n: number) => void;
  trackedTimeout: (fn: () => void, ms: number) => void;
}) {
  const { t } = useTranslation();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voicePaused, setVoicePaused] = useState(false);

  const onNumberRef = useRef(onNumber);
  useEffect(() => {
    onNumberRef.current = onNumber;
  }, [onNumber]);

  const handleVoiceResult = useCallback(
    (candidates: string[]) => {
      // Accept the first alternative that parses to a number — the top guess
      // is often a near-miss on Croatian number words.
      for (const candidate of candidates) {
        const parsed = parseSpokenNumber(candidate, language);
        if (parsed !== null) {
          setVoiceError(null);
          onNumberRef.current(parsed);
          return;
        }
      }
      setVoiceError(t("voice.notUnderstood"));
      trackedTimeout(() => setVoiceError(null), 1500);
    },
    [language, t, trackedTimeout],
  );

  const handleVoiceError = useCallback(
    (err: string) => {
      if (err === "not-allowed" || err === "service-not-allowed") {
        setVoiceError(t("voice.micDenied"));
        setVoicePaused(true);
        trackedTimeout(() => setVoiceError(null), 2400);
        return;
      }
      // Surface diagnosable failures so a flaky tablet shows a reason instead
      // of silence. `no-speech` / `aborted` are normal session ends and stay
      // quiet. These don't pause — the retry loop will try again.
      const hint =
        err === "network"
          ? t("voice.network")
          : err === "language-not-supported"
            ? t("voice.langUnsupported")
            : err === "audio-capture"
              ? t("voice.noMic")
              : null;
      if (hint) {
        setVoiceError(hint);
        trackedTimeout(() => setVoiceError(null), 2400);
      }
    },
    [t, trackedTimeout],
  );

  const {
    listening,
    speechActive,
    interim,
    start: startVoice,
    stop: stopVoice,
  } = useSpeechRecognition({
    lang: speechLangTag(language),
    onResult: handleVoiceResult,
    onError: handleVoiceError,
  });

  const attemptsRef = useRef(0);

  const onMicPress = useCallback(() => {
    setVoiceError(null);
    setVoicePaused((prev) => !prev);
    if (!voicePaused) stopVoice();
    else attemptsRef.current = 0;
  }, [voicePaused, stopVoice]);

  // Re-arm the attempt budget whenever the active phase changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gateKey is the intended reset trigger
  useEffect(() => {
    attemptsRef.current = 0;
  }, [gateKey]);

  // Bounded auto-listen: a self-closed session (silence / mic chime) retries,
  // but only up to MAX_VOICE_ATTEMPTS with a growing backoff — the cap is what
  // prevents the chime → start → chime → end loop.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gateKey re-arms the budget per phase
  useEffect(() => {
    if (!enabled) return;
    if (voicePaused) return;
    if (!gateOpen) return;
    if (flash) return;
    if (listening) return;
    if (attemptsRef.current >= MAX_VOICE_ATTEMPTS) return;
    const attempt = attemptsRef.current;
    const delay = attempt === 0 ? 150 : 500 + attempt * 300;
    const id = window.setTimeout(() => {
      attemptsRef.current += 1;
      setVoiceError(null);
      startVoice();
    }, delay);
    return () => window.clearTimeout(id);
  }, [enabled, voicePaused, gateOpen, flash, listening, gateKey, startVoice]);

  useEffect(() => {
    return () => stopVoice();
  }, [stopVoice]);

  return {
    voiceError,
    voicePaused,
    listening,
    speechActive,
    interim,
    onMicPress,
  };
}
