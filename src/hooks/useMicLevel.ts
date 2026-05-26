import { useEffect, useState } from "react";

/**
 * Samples the device microphone via Web Audio and returns a smoothed level
 * in [0, 1] for use as a VU-style indicator.
 *
 * Active-only: when `active` is false (or flips false) the stream and audio
 * context are torn down, so nothing is held when the user pauses or leaves
 * the practice page. The SpeechRecognition API uses the same underlying mic
 * permission, so this getUserMedia call does not re-prompt once recognition
 * has already been authorized.
 */
export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let rafId = 0;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => {
            t.stop();
          });
          return;
        }
        const AudioCtor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        ctx = new AudioCtor();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteTimeDomainData(buf);
          // RMS of the time-domain waveform around the 128 midpoint, scaled
          // so normal speech lands near 0.5–0.8 and loud bursts hit 1.0.
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          const scaled = Math.min(1, rms * 4);
          // EMA smoothing on top of the analyser's own smoothing for a calmer
          // visual that still tracks bursts within a few frames.
          setLevel((prev) => prev * 0.5 + scaled * 0.5);
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch {
        // Permission denied, no device, or the stream is unavailable — leave
        // the level at 0 and let the consumer's existing error UI handle it.
      }
    })();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream)
        stream.getTracks().forEach((t) => {
          t.stop();
        });
      if (ctx && ctx.state !== "closed") ctx.close();
      setLevel(0);
    };
  }, [active]);

  return level;
}
