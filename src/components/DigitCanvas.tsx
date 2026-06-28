import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDigitRecognizer } from "../hooks/useDigitRecognizer";
import type { Theme } from "../lib/themes";

// Internal pixel resolution of the drawing buffer (CSS stretches it to width).
const CANVAS_W = 256;
const CANVAS_H = 200;
// Brush width relative to the buffer — thick + round for kid fingers.
const BRUSH = 17;
// Idle delay after lifting the pen before we classify (lets multi-stroke digits
// like 4 / 5 / 7 finish before recognition runs).
const RECOGNIZE_DELAY = 550;
// How long the recognized-digit / "?" feedback stays on screen.
const FEEDBACK_MS = 600;

/**
 * Finger/stylus drawing surface that recognizes a handwritten number — one digit
 * or several written side by side ("10") — and feeds the recognized digits to the
 * same `onDigits` contract, then auto-clears. A drop-in alternative to
 * {@link NumPad}; mirrors its delete/confirm controls.
 */
export function DigitCanvas({
  onDigits,
  onDelete,
  onConfirm,
  confirmDisabled,
  theme,
  disabled,
}: {
  onDigits: (digits: number[]) => void;
  onDelete: () => void;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  theme: Theme;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { recognizeNumber } = useDigitRecognizer();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const timerRef = useRef<number | null>(null);

  const [hasInk, setHasInk] = useState(false);
  const [feedback, setFeedback] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.lineWidth = BRUSH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Auto-dismiss the feedback badge.
  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [feedback]);

  const clearInk = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
    setHasInk(false);
  }, []);

  const toXY = (e: React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const runRecognition = useCallback(async () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx || !hasInkRef.current) return;
    const { data, width, height } = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    // Ink = the alpha channel (we draw opaque strokes on a transparent buffer).
    const ink = new Float32Array(width * height);
    for (let i = 0; i < ink.length; i++) ink[i] = data[i * 4 + 3] / 255;
    const digits = await recognizeNumber(ink, width, height);
    clearInk();
    if (digits && digits.length > 0) {
      setFeedback({ text: digits.join(""), ok: true });
      onDigits(digits);
    } else {
      // Blank or not fully confident — show "?" and submit nothing (redo),
      // rather than entering a partial / wrong number.
      setFeedback({ text: "?", ok: false });
    }
  }, [recognizeNumber, onDigits, clearInk]);

  const scheduleRecognition = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void runRecognition();
    }, RECOGNIZE_DELAY);
  }, [runRecognition]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setFeedback(null);
    const ctx = ctxRef.current;
    if (!ctx) return;
    drawingRef.current = true;
    const p = toXY(e);
    lastRef.current = p;
    // Draw a tiny segment so a single tap still leaves a dot.
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    hasInkRef.current = true;
    setHasInk(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    const last = lastRef.current;
    if (!ctx || !last) return;
    const p = toXY(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    scheduleRecognition();
  };

  const padBtn =
    "flex h-14 items-center justify-center rounded-2xl sm:h-16 shadow-sm ring-1 transition active:scale-95 focus:outline-none focus-visible:ring-4";

  return (
    <div className="px-4 pt-2 pb-3 sm:pb-5">
      <div
        className={`relative w-full overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800 ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
        style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      >
        <canvas
          ref={canvasRef}
          aria-label={t("handwriting.draw")}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {!hasInk && !feedback && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-base font-bold text-stone-300 dark:text-stone-600">
            {t("handwriting.draw")}
          </span>
        )}
        {feedback && (
          <span
            className={`pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-black tabular-nums ${
              feedback.ok ? "text-emerald-500" : "text-amber-500"
            }`}
          >
            {feedback.text}
          </span>
        )}
      </div>

      <div
        className={`mt-2.5 grid gap-2.5 ${onConfirm ? "grid-cols-3" : "grid-cols-2"}`}
      >
        <button
          type="button"
          onClick={clearInk}
          className={`${padBtn} bg-stone-100 text-sm font-black text-stone-700 ring-stone-200 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700 dark:hover:bg-stone-700 ${theme.primaryFocus}`}
        >
          {t("handwriting.clear")}
        </button>
        {onConfirm && (
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            aria-label={t("handwriting.confirm")}
            className={`${padBtn} bg-emerald-500 text-white ring-emerald-600 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 disabled:ring-stone-200 disabled:hover:bg-stone-200 dark:bg-emerald-600 dark:ring-emerald-700 dark:hover:bg-emerald-500 dark:disabled:bg-stone-800 dark:disabled:text-stone-500 dark:disabled:ring-stone-700 ${theme.primaryFocus}`}
          >
            <svg
              aria-hidden="true"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("handwriting.delete")}
          className={`${padBtn} bg-stone-100 ring-stone-200 hover:bg-stone-200 dark:bg-stone-800 dark:ring-stone-700 dark:hover:bg-stone-700 ${theme.primaryFocus}`}
        >
          <svg
            aria-hidden="true"
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-stone-700 dark:text-stone-200"
          >
            <path d="M21 5H9l-6 7 6 7h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
            <path d="M16 9l-6 6M10 9l6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
