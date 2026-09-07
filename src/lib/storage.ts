export const STORAGE_KEYS = {
  settings: "matematiks.settings",
  profiles: "matematiks.profiles",
  activeProfileId: "matematiks.activeProfileId",
} as const;

export const PROFILE_KEYS = {
  sessions: "sessions",
  lastSession: "lastSession",
  setups: "setups",
  pendingSession: "pendingSession",
  // Reading module. Deliberately separate from the math keys above: a reading
  // round records words-per-minute over a story, not answers to problems, so
  // it has its own record shape. Keeping it under its own key means the math
  // history on kids' devices needs no migration (rule §9.4).
  readingSessions: "readingSessions",
  readingProgress: "readingProgress",
} as const;

export type ProfileKey = (typeof PROFILE_KEYS)[keyof typeof PROFILE_KEYS];

export function profileKey(profileId: string, suffix: ProfileKey): string {
  return `matematiks.${profileId}.${suffix}`;
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or disabled — nothing we can do that's better than skipping.
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
