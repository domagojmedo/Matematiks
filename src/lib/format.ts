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

export function summarizeSetup(setup: OperationSetup): string {
  if (setup.kind === "range") {
    const range1 = `${setup.min}–${setup.max}`;
    if (setup.min2 !== undefined || setup.max2 !== undefined) {
      const range2 = `${setup.min2 ?? setup.min}–${setup.max2 ?? setup.max}`;
      return `${range1} ↔ ${range2}`;
    }
    return range1;
  }
  if (setup.values.length === 10) return "1–10";
  return setup.values.join(",");
}
