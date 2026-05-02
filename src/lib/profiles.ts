import {
  PROFILE_KEYS,
  type ProfileKey,
  profileKey,
  readJSON,
  removeKey,
  STORAGE_KEYS,
  writeJSON,
} from "./storage";
import type { Profile } from "./types";

const LEGACY_MIGRATIONS: { fullKey: string; suffix: ProfileKey }[] = [
  { fullKey: "matematiks.sessions", suffix: PROFILE_KEYS.sessions },
  { fullKey: "matematiks.lastSession", suffix: PROFILE_KEYS.lastSession },
  { fullKey: "matematiks.setups", suffix: PROFILE_KEYS.setups },
];

export const DEFAULT_PROFILE_NAME = "Igrač";

const BAD_NAME_KEYS = ["profiles.defaultName"];

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function loadProfiles(): Profile[] {
  return readJSON<Profile[]>(STORAGE_KEYS.profiles, []);
}

export function saveProfiles(list: Profile[]): void {
  writeJSON(STORAGE_KEYS.profiles, list);
}

export function getActiveProfileId(): string | null {
  return readJSON<string | null>(STORAGE_KEYS.activeProfileId, null);
}

export function setActiveProfileId(id: string | null): void {
  if (id === null) {
    removeKey(STORAGE_KEYS.activeProfileId);
  } else {
    writeJSON(STORAGE_KEYS.activeProfileId, id);
  }
}

export function ensureProfilesInitialized(
  defaultName: string = DEFAULT_PROFILE_NAME,
): Profile[] {
  const existing = loadProfiles();
  if (existing.length > 0) {
    // One-shot fix: replace any profile saved with the raw i18n key as a name.
    const cleaned = existing.map((p) =>
      BAD_NAME_KEYS.includes(p.name) ? { ...p, name: defaultName } : p,
    );
    if (cleaned.some((p, i) => p.name !== existing[i]?.name)) {
      saveProfiles(cleaned);
    }
    if (!getActiveProfileId()) setActiveProfileId(cleaned[0]?.id ?? null);
    return cleaned;
  }

  const profile: Profile = { id: newId(), name: defaultName };
  saveProfiles([profile]);
  setActiveProfileId(profile.id);

  // Migrate any legacy non-namespaced data into this profile.
  for (const { fullKey, suffix } of LEGACY_MIGRATIONS) {
    const raw = localStorage.getItem(fullKey);
    if (raw === null) continue;
    localStorage.setItem(profileKey(profile.id, suffix), raw);
    removeKey(fullKey);
  }

  return [profile];
}

export function createProfile(name: string): Profile {
  const profile: Profile = { id: newId(), name: name.trim() || "Igrač" };
  const list = loadProfiles();
  saveProfiles([...list, profile]);
  return profile;
}

export function renameProfile(id: string, name: string): void {
  const list = loadProfiles();
  const next = list.map((p) =>
    p.id === id ? { ...p, name: name.trim() || p.name } : p,
  );
  saveProfiles(next);
}

export function deleteProfile(id: string): void {
  const list = loadProfiles();
  const remaining = list.filter((p) => p.id !== id);
  saveProfiles(remaining);
  // Clear all profile-scoped data.
  for (const suffix of Object.values(PROFILE_KEYS)) {
    removeKey(profileKey(id, suffix));
  }
  if (getActiveProfileId() === id) {
    setActiveProfileId(remaining[0]?.id ?? null);
  }
}
