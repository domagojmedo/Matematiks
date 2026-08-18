import type { AnyLessonSetup } from "./types";

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function isTimeMode(setup: AnyLessonSetup): boolean {
  return setup.timeMs !== undefined;
}

function isContiguous(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== (values[i - 1] as number) + 1) return false;
  }
  return values.length > 0;
}

function formatValues(values: number[]): string {
  if (values.length === 1) return String(values[0]);
  if (isContiguous(values)) return `${values[0]}–${values[values.length - 1]}`;
  return values.join(",");
}

export function summarizeSetup(setup: AnyLessonSetup): string {
  if (setup.kind === "range") {
    const range1 = `${setup.min}–${setup.max}`;
    if (setup.min2 !== undefined || setup.max2 !== undefined) {
      const range2 = `${setup.min2 ?? setup.min}–${setup.max2 ?? setup.max}`;
      return `${range1} ↔ ${range2}`;
    }
    return range1;
  }
  if (setup.kind === "multiplicands") {
    const a = formatValues(setup.values);
    if (setup.values2 !== undefined) {
      return `${a} × ${formatValues(setup.values2)}`;
    }
    return a;
  }
  // word setup — no numeric range to summarize; the lesson title carries the meaning.
  return "";
}

/**
 * One row of "these were the exact parameters" for a session. `text` carries
 * already-formatted literals (ranges, counts); `textKey` is an i18n key for
 * enumerated values (layout, guide on/off, crossesTen). Keeping this in `lib`
 * means no translated copy leaks in here — the caller runs both through `t`.
 */
export type SetupParam = {
  labelKey: string;
  text?: string;
  textKey?: string;
};

/** Length row: fixed problem count or a time-attack duration. */
function lengthParam(setup: AnyLessonSetup): SetupParam {
  if (setup.timeMs !== undefined) {
    return {
      labelKey: "sessionDetail.paramTime",
      text: formatDuration(setup.timeMs),
    };
  }
  return {
    labelKey: "sessionDetail.paramRounds",
    text: String(setup.rounds),
  };
}

/**
 * Full parameter breakdown of a setup, in the order the setup screen presents
 * them. Optional fields are omitted rather than shown as defaults, so a row
 * appearing means the round really was configured that way.
 */
export function describeSetup(setup: AnyLessonSetup): SetupParam[] {
  const params: SetupParam[] = [lengthParam(setup)];

  if (setup.kind === "range") {
    const hasSecond = setup.min2 !== undefined || setup.max2 !== undefined;
    params.push({
      labelKey: hasSecond ? "setup.rangeFirst" : "setup.range",
      text: `${setup.min}–${setup.max}`,
    });
    if (hasSecond) {
      params.push({
        labelKey: "setup.rangeSecond",
        text: `${setup.min2 ?? setup.min}–${setup.max2 ?? setup.max}`,
      });
    }
    if (setup.crossesTen !== undefined) {
      params.push({
        labelKey: "sessionDetail.paramCrossesTen",
        textKey: `sessionDetail.crossesTen.${setup.crossesTen}`,
      });
    }
  } else if (setup.kind === "multiplicands") {
    params.push({
      labelKey: "setup.multiplicands",
      text: formatValues(setup.values),
    });
    if (setup.values2 !== undefined) {
      params.push({
        labelKey: "sessionDetail.paramPartners",
        text: formatValues(setup.values2),
      });
    }
  } else {
    if (setup.maxNumber !== undefined) {
      params.push({
        labelKey: "sessionDetail.paramMaxNumber",
        text: String(setup.maxNumber),
      });
    }
  }

  if (setup.kind !== "word") {
    if (setup.format !== undefined) {
      params.push({
        labelKey: "setup.formatSection",
        textKey:
          setup.format === "column"
            ? "setup.formatColumn"
            : "setup.formatHorizontal",
      });
    }
    if (setup.guide !== undefined) {
      params.push({
        labelKey: "setup.guideLabel",
        textKey: setup.guide ? "sessionDetail.on" : "sessionDetail.off",
      });
    }
  }

  return params;
}
