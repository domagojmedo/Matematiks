import { PROFILE_KEYS, profileKey, readJSON, writeJSON } from "./storage";
import type { Operation, OperationSetup } from "./types";

export const ROUND_SIZE_OPTIONS = [10, 20, 30, 50] as const;

export const TIME_OPTIONS_MS = [60_000, 180_000, 300_000, 600_000] as const;

export const RANGE_PRESETS = [
  { key: "small", min: 1, max: 20 },
  { key: "medium", min: 10, max: 100 },
] as const;

export type RangePresetKey = (typeof RANGE_PRESETS)[number]["key"];

/**
 * Partner factor pool for custom mul/div rounds. Picking a number in setup means
 * "drill that number's table", so the other factor spans the whole table — ×1 and
 * ×10 are left out because they're trivial and would dilute a short round.
 */
export const TABLE_PARTNERS = [2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Custom multiplicand setups choose WHICH tables to drill, not both factors —
 * without this, picking only 6 yields 6 × 6 every time. Applied on read so setups
 * saved before this rule (and old lastSession / session records) behave the same.
 * Lesson setups author `values2` explicitly and are never normalized here.
 */
export function withTablePartners(setup: OperationSetup): OperationSetup {
  if (setup.kind !== "multiplicands" || setup.values2 !== undefined) {
    return setup;
  }
  return { ...setup, values2: TABLE_PARTNERS };
}

const DEFAULT_SETUPS: Record<Operation, OperationSetup> = {
  add: { kind: "range", min: 1, max: 20, rounds: 20 },
  sub: { kind: "range", min: 1, max: 20, rounds: 20 },
  addsub: { kind: "range", min: 1, max: 20, rounds: 20 },
  mul: {
    kind: "multiplicands",
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    rounds: 20,
  },
  div: {
    kind: "multiplicands",
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    rounds: 20,
  },
  muldiv: {
    kind: "multiplicands",
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    rounds: 20,
  },
};

export function getSetup(profileId: string, op: Operation): OperationSetup {
  const key = profileKey(profileId, PROFILE_KEYS.setups);
  const all = readJSON<Partial<Record<Operation, OperationSetup>>>(key, {});
  return withTablePartners(all[op] ?? DEFAULT_SETUPS[op]);
}

export function saveSetup(
  profileId: string,
  op: Operation,
  setup: OperationSetup,
): void {
  const key = profileKey(profileId, PROFILE_KEYS.setups);
  const all = readJSON<Partial<Record<Operation, OperationSetup>>>(key, {});
  all[op] = setup;
  writeJSON(key, all);
}
