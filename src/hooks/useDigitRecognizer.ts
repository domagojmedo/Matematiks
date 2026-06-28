import { useCallback, useEffect, useRef, useState } from "react";
import {
  cropInk,
  DEFAULT_RECOGNIZER_ID,
  type DigitRecognizer,
  getRecognizer,
  normalizeToGrid,
  segmentInk,
} from "../lib/handwriting";

/**
 * Loads a digit recognizer by id (default: the registry's default engine) and
 * exposes `recognizeNumber`, which runs raw grayscale ink through segmentation +
 * the shared preprocessing pipeline + the engine. Swap engines by passing a
 * different id.
 *
 * The hook stays DOM-free — callers (the canvas component) extract the ink
 * buffer; this only owns the engine lifecycle and the preprocess → classify step.
 */
export function useDigitRecognizer(
  recognizerId: string = DEFAULT_RECOGNIZER_ID,
) {
  const recRef = useRef<DigitRecognizer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    const rec = getRecognizer(recognizerId);
    recRef.current = rec;
    rec.load().then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [recognizerId]);

  /**
   * Recognize a (possibly multi-digit) number from one drawing: segment into
   * digits left-to-right and classify each. All-or-nothing — returns the digits
   * only when EVERY segment was confidently classified, otherwise `null` (blank
   * canvas, no segment, or any unsure digit). This prevents a half-read "10"
   * from silently entering "1".
   */
  const recognizeNumber = useCallback(
    async (
      data: ArrayLike<number>,
      width: number,
      height: number,
    ): Promise<number[] | null> => {
      const rec = recRef.current;
      if (!rec) return null;
      const boxes = segmentInk(data, width, height);
      if (boxes.length === 0) return null;
      const digits: number[] = [];
      for (const box of boxes) {
        const crop = cropInk(data, width, box);
        const grid = normalizeToGrid(crop.data, crop.width, crop.height);
        if (!grid) return null;
        const pred = await Promise.resolve(rec.recognize(grid));
        if (pred.digit === null) return null;
        digits.push(pred.digit);
      }
      return digits;
    },
    [],
  );

  return { ready, recognizeNumber };
}
