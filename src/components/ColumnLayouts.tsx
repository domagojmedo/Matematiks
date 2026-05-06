/**
 * biome-ignore-all lint/suspicious/noArrayIndexKey: this file renders fixed
 * positional grids (digits of a, digits of b, partial-product rows, long-
 * division step rows). Position is the natural identity — the lists are
 * derived from `problem` and never reorder. Index keys are semantically
 * correct here; switching to content-based keys would also collide on
 * repeated digits (e.g. "55") without re-introducing the index.
 */
import { useTranslation } from "react-i18next";
import type { Phase } from "../lib/columnPhases";
import { operationGlyph, type Problem } from "../lib/problemGen";
import type { Theme } from "../lib/themes";

export type Flash = "correct" | "wrong" | null;

type PhaseRenderInfo = {
  digits: number[]; // rtl input order
  isActive: boolean;
  isCompleted: boolean;
  flash: Flash;
};

function getPhaseRenderInfo(
  phaseIdx: number,
  filledDigits: number[],
  completedPhases: number[][],
  flash: Flash,
  index: number,
): PhaseRenderInfo {
  const isCompleted = index < phaseIdx;
  const isActive = index === phaseIdx;
  return {
    digits: isCompleted
      ? (completedPhases[index] ?? [])
      : isActive
        ? filledDigits
        : [],
    isActive,
    isCompleted,
    flash: isActive ? flash : null,
  };
}

export function ColumnLayout({
  problem,
  filledDigits,
  answerLen,
  flash,
  shaking,
  theme,
}: {
  problem: Problem;
  filledDigits: number[];
  answerLen: number;
  flash: Flash;
  shaking: boolean;
  theme: Theme;
}) {
  const aStr = String(problem.a);
  const bStr = String(problem.b);
  const width = Math.max(aStr.length, bStr.length, answerLen);
  const aPadded = aStr.padStart(width, " ");
  const bPadded = bStr.padStart(width, " ");
  const opGlyph = operationGlyph(problem.op);

  // Result row: width cells, last `answerLen` are answer digits, leading are blank.
  // For rtl direction (add/sub/mul) digits fill from the right.
  const filledFromRight = filledDigits;
  const activeIdx = width - 1 - filledFromRight.length; // index in display row of next-to-fill
  const firstAnswerCol = width - answerLen;

  return (
    <div
      className={`text-3xl leading-tight font-black tabular-nums sm:text-5xl md:text-6xl ${
        shaking ? "animate-shake" : ""
      }`}
    >
      <Row digits={aPadded} theme={theme} />
      <Row digits={bPadded} theme={theme} opGlyph={opGlyph} />
      <Divider width={width} />
      <ResultRow
        width={width}
        firstAnswerCol={firstAnswerCol}
        activeIdx={activeIdx}
        filledFromRight={filledFromRight}
        flash={flash}
        theme={theme}
      />
    </div>
  );
}

export function MulPartialProductsLayout({
  problem,
  phases,
  phaseIdx,
  filledDigits,
  completedPhases,
  flash,
  shaking,
  theme,
  guide,
}: {
  problem: Problem;
  phases: Phase[];
  phaseIdx: number;
  filledDigits: number[];
  completedPhases: number[][];
  flash: Flash;
  shaking: boolean;
  theme: Theme;
  guide: boolean;
}) {
  const { t } = useTranslation();
  const bStr = String(problem.b);
  // Active b-digit position: phase k (k < bStr.length) targets bStr[k] (highest place first).
  const activeBPos = phaseIdx < bStr.length ? phaseIdx : -1;
  const hasPartials = phases.some((p) => p.kind === "mulPartial");
  const stepLabel = (() => {
    if (!guide) return null;
    // Single-digit multiplier collapses to one answer row — no step labels.
    if (!hasPartials) return null;
    if (phaseIdx < bStr.length)
      return t("column.mulPartial", { n: phaseIdx + 1 });
    return t("column.mulSum");
  })();
  const partialIndices: number[] = [];
  let sumIdx = -1;
  phases.forEach((p, i) => {
    if (p.kind === "mulPartial") partialIndices.push(i);
    else if (p.kind === "mulSum") sumIdx = i;
  });
  const sumLen = sumIdx >= 0 ? String(phases[sumIdx]?.value ?? 0).length : 0;

  const width = Math.max(
    sumLen,
    ...partialIndices.map((idx) => {
      const p = phases[idx];
      if (!p) return 0;
      return String(p.value).length + (p.shift ?? 0);
    }),
  );

  return (
    <div
      className={`text-2xl leading-tight font-black tabular-nums sm:text-4xl md:text-5xl ${
        shaking ? "animate-shake" : ""
      }`}
    >
      <div className="mb-2 flex items-baseline justify-center gap-1.5 sm:gap-2">
        <span className="text-stone-900 dark:text-white">{problem.a}</span>
        <span className={`${theme.primaryText} ${theme.primaryTextDark}`}>
          {operationGlyph(problem.op)}
        </span>
        <span className="inline-flex items-baseline">
          {[...bStr].map((ch, i) => (
            <span
              key={`b-${i}-${ch}`}
              className={
                i === activeBPos
                  ? `rounded-md px-1 ring-2 ring-offset-1 ${theme.primaryText} ${theme.primaryTextDark} ${theme.primaryRing} ring-offset-white dark:ring-offset-stone-950`
                  : "text-stone-900 dark:text-white"
              }
            >
              {ch}
            </span>
          ))}
        </span>
        <span className="text-stone-300 dark:text-stone-600">=</span>
      </div>
      {stepLabel && (
        <p className="mb-3 text-center text-xs font-bold tracking-wider text-stone-500 uppercase sm:text-sm dark:text-stone-400">
          {stepLabel}
        </p>
      )}
      {partialIndices.map((idx) => {
        const phase = phases[idx];
        if (!phase) return null;
        const info = getPhaseRenderInfo(
          phaseIdx,
          filledDigits,
          completedPhases,
          flash,
          idx,
        );
        return (
          <ShiftedRow
            key={`partial-${idx}`}
            width={width}
            shift={phase.shift ?? 0}
            len={String(phase.value).length}
            digits={info.digits}
            direction={phase.direction}
            isActive={info.isActive}
            isCompleted={info.isCompleted}
            flash={info.flash}
            theme={theme}
          />
        );
      })}
      {sumIdx >= 0 && (
        <>
          {hasPartials && <Divider width={width} />}
          <ShiftedRow
            width={width}
            shift={0}
            len={sumLen}
            digits={
              phaseIdx === sumIdx
                ? filledDigits
                : phaseIdx > sumIdx
                  ? (completedPhases[sumIdx] ?? [])
                  : []
            }
            direction={phases[sumIdx]?.direction ?? "rtl"}
            isActive={phaseIdx === sumIdx}
            isCompleted={phaseIdx > sumIdx}
            flash={phaseIdx === sumIdx ? flash : null}
            theme={theme}
          />
        </>
      )}
    </div>
  );
}

export function LongDivisionLayout({
  problem,
  phases,
  phaseIdx,
  filledDigits,
  completedPhases,
  flash,
  shaking,
  theme,
  guide,
}: {
  problem: Problem;
  phases: Phase[];
  phaseIdx: number;
  filledDigits: number[];
  completedPhases: number[][];
  flash: Flash;
  shaking: boolean;
  theme: Theme;
  guide: boolean;
}) {
  const { t } = useTranslation();
  const dividend = problem.a;
  const divisor = problem.b;

  // Group phases by step. Each step has 3 phases (quotient digit, product,
  // remainder) and they all carry the same `chunk` value, so we read it from
  // the first phase of the step rather than reconstructing the division.
  const stepPhaseIndices = new Map<
    number,
    {
      quotient: number;
      product: number;
      remainder: number;
      chunk: number;
    }
  >();
  phases.forEach((p, i) => {
    const step = p.step ?? 0;
    const slot = stepPhaseIndices.get(step) ?? {
      quotient: -1,
      product: -1,
      remainder: -1,
      chunk: 0,
    };
    if (p.kind === "divQuotientDigit") slot.quotient = i;
    else if (p.kind === "divProduct") slot.product = i;
    else if (p.kind === "divRemainder") slot.remainder = i;
    if (p.chunk !== undefined) slot.chunk = p.chunk;
    stepPhaseIndices.set(step, slot);
  });
  const totalSteps = stepPhaseIndices.size;

  // Quotient digits: derive from each step's quotient phase value (or current input).
  const quotientCells: { digit?: number; isActive: boolean; flash: Flash }[] =
    [];
  for (let s = 0; s < totalSteps; s++) {
    const slot = stepPhaseIndices.get(s);
    if (!slot) continue;
    const info = getPhaseRenderInfo(
      phaseIdx,
      filledDigits,
      completedPhases,
      flash,
      slot.quotient,
    );
    if (info.isCompleted) {
      const v = phases[slot.quotient]?.value;
      quotientCells.push({
        digit: typeof v === "number" ? v : undefined,
        isActive: false,
        flash: null,
      });
    } else if (info.isActive) {
      quotientCells.push({
        digit: info.digits.length > 0 ? info.digits[0] : undefined,
        isActive: true,
        flash: info.flash,
      });
    } else {
      quotientCells.push({ isActive: false, flash: null });
    }
  }

  return (
    <div
      className={`flex w-full max-w-md flex-col items-center px-2 ${
        shaking ? "animate-shake" : ""
      }`}
    >
      <div className="flex items-baseline gap-1.5 text-3xl leading-none font-black tabular-nums sm:gap-3 sm:text-5xl md:text-6xl">
        <span className="text-stone-900 dark:text-white">{dividend}</span>
        <span className={`${theme.primaryText} ${theme.primaryTextDark}`}>
          :
        </span>
        <span className="text-stone-900 dark:text-white">{divisor}</span>
        <span className="text-stone-300 dark:text-stone-600">=</span>
        <div className="flex items-baseline gap-1">
          {quotientCells.map((c, i) => (
            <DigitCell
              key={`quotient-${i}`}
              digit={c.digit}
              isActive={c.isActive}
              flash={c.flash}
              theme={theme}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex w-full flex-col gap-3 text-base font-bold sm:text-lg">
        {Array.from({ length: totalSteps }, (_, s) => {
          const slot = stepPhaseIndices.get(s);
          if (!slot) return null;
          // Hide future steps until previous step's remainder is done.
          const prevSlot = s > 0 ? stepPhaseIndices.get(s - 1) : null;
          const stepUnlocked = !prevSlot || phaseIdx > prevSlot.remainder;
          if (!stepUnlocked) return null;
          const stepChunk = slot.chunk;
          const qInfo = getPhaseRenderInfo(
            phaseIdx,
            filledDigits,
            completedPhases,
            flash,
            slot.quotient,
          );
          const qDigit = qInfo.isCompleted
            ? phases[slot.quotient]?.value
            : qInfo.digits.length > 0
              ? qInfo.digits[0]
              : undefined;
          const productPhase = phases[slot.product];
          const productInfo = getPhaseRenderInfo(
            phaseIdx,
            filledDigits,
            completedPhases,
            flash,
            slot.product,
          );
          const remainderPhase = phases[slot.remainder];
          const remainderInfo = getPhaseRenderInfo(
            phaseIdx,
            filledDigits,
            completedPhases,
            flash,
            slot.remainder,
          );

          const stepActive =
            phaseIdx >= slot.quotient && phaseIdx <= slot.remainder;
          return (
            <div
              key={s}
              className={`rounded-2xl bg-white p-3 shadow-sm ring-1 dark:bg-stone-900 ${
                stepActive
                  ? `${theme.primaryRing} dark:${theme.primaryRing}`
                  : "ring-stone-200 dark:ring-stone-800"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                {guide && (
                  <p
                    className={`text-xs font-black tracking-wider uppercase ${
                      stepActive
                        ? `${theme.primaryText} ${theme.primaryTextDark}`
                        : "text-stone-400 dark:text-stone-500"
                    }`}
                  >
                    {t("column.step", { n: s + 1 })}
                  </p>
                )}
                <p className="text-xs font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
                  {s === 0 ? `${stepChunk}` : `↓ ${stepChunk}`}
                </p>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2 text-stone-900 dark:text-white">
                <span>
                  {stepChunk} : {divisor} ={" "}
                </span>
                <DigitCell
                  digit={typeof qDigit === "number" ? qDigit : undefined}
                  isActive={qInfo.isActive}
                  flash={qInfo.flash}
                  theme={theme}
                />
              </div>
              {(qInfo.isCompleted || qInfo.isActive) && (
                <div className="mt-1.5 flex items-baseline gap-2 text-stone-900 dark:text-white">
                  <span>
                    {divisor} ×{" "}
                    {typeof qDigit === "number" ? (
                      qDigit
                    ) : (
                      <span className="text-stone-300 dark:text-stone-600">
                        ?
                      </span>
                    )}{" "}
                    ={" "}
                  </span>
                  <PhaseDigits
                    value={productPhase?.value ?? 0}
                    info={productInfo}
                    direction={productPhase?.direction ?? "ltr"}
                    theme={theme}
                  />
                </div>
              )}
              {productInfo.isCompleted && (
                <div className="mt-1.5 flex items-baseline gap-2 text-stone-900 dark:text-white">
                  <span>
                    {stepChunk} − {productPhase?.value ?? 0} ={" "}
                  </span>
                  <PhaseDigits
                    value={remainderPhase?.value ?? 0}
                    info={remainderInfo}
                    direction={remainderPhase?.direction ?? "ltr"}
                    theme={theme}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShiftedRow({
  width,
  shift,
  len,
  digits,
  direction,
  isActive,
  isCompleted,
  flash,
  theme,
}: {
  width: number;
  shift: number;
  len: number;
  /** Digits in input order (rtl: ones first; ltr: leftmost first). */
  digits: number[];
  direction: "rtl" | "ltr";
  isActive: boolean;
  isCompleted: boolean;
  flash: Flash;
  theme: Theme;
}) {
  const startCol = width - len - shift;
  const endCol = width - 1 - shift;
  return (
    <div className="flex items-baseline justify-end gap-1.5 sm:gap-2">
      <span className="mr-1 min-w-[1.2ch]" />
      {Array.from({ length: width }, (_, col) => {
        const inRange = col >= startCol && col <= endCol;
        if (!inRange) {
          return <span key={col} className="inline-block min-w-[1.2ch]" />;
        }
        // Map display column ↔ input-order index:
        //   rtl: index 0 = rightmost (ones)   → fromInput = endCol - col
        //   ltr: index 0 = leftmost           → fromInput = col - startCol
        const fromInput = direction === "rtl" ? endCol - col : col - startCol;
        if (isCompleted) {
          return (
            <DigitCell
              key={col}
              digit={digits[fromInput]}
              isActive={false}
              flash={null}
              theme={theme}
            />
          );
        }
        if (isActive) {
          const filled = fromInput < digits.length;
          const cellActive = fromInput === digits.length;
          return (
            <DigitCell
              key={col}
              digit={filled ? digits[fromInput] : undefined}
              isActive={cellActive}
              flash={cellActive ? flash : null}
              theme={theme}
            />
          );
        }
        return (
          <DigitCell
            key={col}
            digit={undefined}
            isActive={false}
            flash={null}
            theme={theme}
          />
        );
      })}
    </div>
  );
}

function PhaseDigits({
  value,
  info,
  direction,
  theme,
}: {
  value: number;
  info: PhaseRenderInfo;
  direction: "rtl" | "ltr";
  theme: Theme;
}) {
  const len = String(value).length;
  return (
    <div className="inline-flex items-baseline gap-0.5">
      {Array.from({ length: len }, (_, col) => {
        // Map display column ↔ input-order index:
        //   rtl: index 0 = rightmost (ones)   → fromInput = len - 1 - col
        //   ltr: index 0 = leftmost           → fromInput = col
        const fromInput = direction === "rtl" ? len - 1 - col : col;
        if (info.isCompleted) {
          const digit = info.digits[fromInput];
          return (
            <DigitCell
              key={col}
              digit={digit}
              isActive={false}
              flash={null}
              theme={theme}
            />
          );
        }
        if (info.isActive) {
          const filled = fromInput < info.digits.length;
          const cellActive = fromInput === info.digits.length;
          return (
            <DigitCell
              key={col}
              digit={filled ? info.digits[fromInput] : undefined}
              isActive={cellActive}
              flash={cellActive ? info.flash : null}
              theme={theme}
            />
          );
        }
        return (
          <DigitCell
            key={col}
            digit={undefined}
            isActive={false}
            flash={null}
            theme={theme}
          />
        );
      })}
    </div>
  );
}

function Row({
  digits,
  theme,
  opGlyph,
}: {
  digits: string;
  theme: Theme;
  opGlyph?: string;
}) {
  return (
    <div className="flex items-baseline justify-end gap-1.5 sm:gap-2">
      {opGlyph !== undefined && (
        <span
          className={`mr-1 inline-block min-w-[1.2ch] text-right ${theme.primaryText} ${theme.primaryTextDark}`}
        >
          {opGlyph}
        </span>
      )}
      {opGlyph === undefined && <span className="mr-1 min-w-[1.2ch]" />}
      {[...digits].map((ch, i) => (
        <span
          key={i}
          className="inline-block min-w-[1.2ch] text-right text-stone-900 dark:text-white"
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </div>
  );
}

function Divider({ width }: { width: number }) {
  return (
    <div
      className="my-1 ml-auto h-1 rounded bg-stone-300 dark:bg-stone-600"
      style={{ width: `${width * 1.4 + 0.4}em` }}
    />
  );
}

function ResultRow({
  width,
  firstAnswerCol,
  activeIdx,
  filledFromRight,
  flash,
  theme,
}: {
  width: number;
  firstAnswerCol: number;
  activeIdx: number;
  filledFromRight: number[];
  flash: Flash;
  theme: Theme;
}) {
  return (
    <div className="flex items-baseline justify-end gap-1.5 sm:gap-2">
      <span className="mr-1 min-w-[1.2ch]" />
      {Array.from({ length: width }, (_, i) => {
        const isAnswerCol = i >= firstAnswerCol;
        if (!isAnswerCol) {
          return <span key={i} className="inline-block min-w-[1.2ch]" />;
        }
        // Map display index i to filled-from-right index.
        // The rightmost cell (i = width-1) corresponds to filledFromRight[0].
        const rtlIdx = width - 1 - i;
        const isActive = i === activeIdx;
        const digit =
          rtlIdx < filledFromRight.length ? filledFromRight[rtlIdx] : undefined;
        return (
          <DigitCell
            key={i}
            digit={digit}
            isActive={isActive}
            flash={isActive ? flash : null}
            theme={theme}
          />
        );
      })}
    </div>
  );
}

function DigitCell({
  digit,
  isActive,
  flash,
  theme,
}: {
  digit: number | undefined;
  isActive: boolean;
  flash: Flash;
  theme: Theme;
}) {
  const colorClass =
    flash === "correct"
      ? "text-emerald-500"
      : flash === "wrong"
        ? "text-rose-500"
        : isActive
          ? `${theme.primaryText} ${theme.primaryTextDark}`
          : "text-stone-900 dark:text-white";
  if (digit !== undefined) {
    return (
      <span
        className={`inline-block min-w-[1.2ch] text-right tabular-nums ${colorClass}`}
      >
        {digit}
      </span>
    );
  }
  return (
    <span
      {...(isActive ? { "aria-current": "step" } : {})}
      className={`inline-block min-w-[1.2ch] text-right tabular-nums ${
        isActive ? colorClass : "text-stone-300 dark:text-stone-600"
      }`}
    >
      ?
    </span>
  );
}
