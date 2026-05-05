import type { OperationSetup } from "./types";

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

export function isTimeMode(setup: OperationSetup): boolean {
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

export function summarizeSetup(setup: OperationSetup): string {
  if (setup.kind === "range") {
    const range1 = `${setup.min}–${setup.max}`;
    if (setup.min2 !== undefined || setup.max2 !== undefined) {
      const range2 = `${setup.min2 ?? setup.min}–${setup.max2 ?? setup.max}`;
      return `${range1} ↔ ${range2}`;
    }
    return range1;
  }
  const a = formatValues(setup.values);
  if (setup.values2 !== undefined) {
    return `${a} × ${formatValues(setup.values2)}`;
  }
  return a;
}
