import {
  PROFILE_KEYS,
  profileKey,
  readJSON,
  removeKey,
  writeJSON,
} from "./storage";
import type { SessionRecord } from "./types";

/**
 * Mid-round checkpoint. The round runner rewrites this after every answered
 * problem (and wrong attempt) and clears it on every normal round exit, so
 * the only way a checkpoint survives is a refresh / tab close / crash
 * mid-round. Whatever survives is moved into session history on next load —
 * an interrupted round then shows up like an abandoned one.
 */

export function writePendingSession(
  profileId: string,
  session: SessionRecord,
): void {
  writeJSON(profileKey(profileId, PROFILE_KEYS.pendingSession), session);
}

export function clearPendingSession(profileId: string): void {
  removeKey(profileKey(profileId, PROFILE_KEYS.pendingSession));
}

/**
 * Move a leftover checkpoint from an interrupted round into session history.
 * Idempotent (the checkpoint is consumed), so it's safe to call both at app
 * load and at round mount — whichever runs first wins, the other no-ops.
 */
export function flushPendingSession(profileId: string): void {
  const key = profileKey(profileId, PROFILE_KEYS.pendingSession);
  const pending = readJSON<SessionRecord | null>(key, null);
  if (pending === null) return;
  removeKey(key);
  // Checkpoints live on real devices across app versions — only trust ones
  // carrying the fields the history screens read (§9.4).
  if (
    typeof pending !== "object" ||
    typeof pending.id !== "string" ||
    !Array.isArray(pending.problems)
  ) {
    return;
  }
  if (pending.problems.length === 0 && !(pending.mistakes > 0)) return;
  const sessionsKey = profileKey(profileId, PROFILE_KEYS.sessions);
  const all = readJSON<SessionRecord[]>(sessionsKey, []);
  writeJSON(sessionsKey, [pending, ...all].slice(0, 200));
}
