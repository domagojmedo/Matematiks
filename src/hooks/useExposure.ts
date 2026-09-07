import { useCallback, useEffect, useState } from "react";

/**
 * Tachistoscopic exposure for warm-up cards.
 *
 * The card is shown for a fixed window, then hidden. The child says it from
 * memory and taps to check. This is what actually trains *speed* rather than
 * accuracy: with the text still on screen a slow decoder will keep sounding it
 * out letter by letter, and no amount of practice at that pace gets faster.
 * Taking the text away forces recognition of the whole shape.
 *
 * It belongs to the warm-up and not to story reading, where looking back at
 * the line is a legitimate part of reading and re-reading is the point.
 *
 * The window does not shrink automatically. Doing that honestly needs an
 * accuracy signal, and the warm-up deliberately collects none — putting a
 * score on blending drills would turn the gentlest part of the session into
 * the tensest. A grown-up picks the speed instead.
 */
export type ExposurePhase = "flash" | "recall" | "check";

/** Off, then progressively harder. Off is first so it is the default. */
export const EXPOSURE_STEPS = [0, 1500, 1000, 600] as const;
export type ExposureMs = (typeof EXPOSURE_STEPS)[number];

export function useExposure({
  exposureMs,
  cardKey,
}: {
  exposureMs: number;
  /** Changing this restarts the exposure — one value per card. */
  cardKey: string | number;
}) {
  const disabled = exposureMs <= 0;
  const [phase, setPhase] = useState<ExposurePhase>(
    disabled ? "check" : "flash",
  );

  // Restart whenever the card changes, or the speed is switched mid-run.
  // Adjusting state during render rather than in an effect is React's own
  // pattern for resetting on a prop change: it avoids rendering one frame of
  // the previous card's phase, which here would flash the next card's text
  // for a moment before hiding it — exactly what exposure exists to prevent.
  const [previous, setPrevious] = useState({ cardKey, disabled });
  if (previous.cardKey !== cardKey || previous.disabled !== disabled) {
    setPrevious({ cardKey, disabled });
    setPhase(disabled ? "check" : "flash");
  }

  useEffect(() => {
    if (phase !== "flash" || disabled) return;
    const id = window.setTimeout(() => setPhase("recall"), exposureMs);
    return () => window.clearTimeout(id);
  }, [phase, disabled, exposureMs]);

  /** The child has said it; show the card again so they can check themselves. */
  const reveal = useCallback(() => setPhase("check"), []);

  return {
    phase,
    /** Whether the card text should be on screen right now. */
    visible: phase !== "recall",
    reveal,
  };
}
