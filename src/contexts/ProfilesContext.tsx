import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { flushPendingSession } from "../lib/pendingSession";
import {
  DEFAULT_PROFILE_NAME,
  ensureProfilesInitialized,
  getActiveProfileId,
  loadProfiles,
  setActiveProfileId,
  createProfile as storeCreate,
  deleteProfile as storeDelete,
  renameProfile as storeRename,
} from "../lib/profiles";
import type { Profile } from "../lib/types";

type ProfilesContextValue = {
  profile: Profile;
  profileId: string;
  profiles: Profile[];
  switchProfile: (id: string) => void;
  createProfile: (name: string) => Profile;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
};

const ProfilesContext = createContext<ProfilesContextValue | null>(null);

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<Profile[]>(() =>
    ensureProfilesInitialized(),
  );
  const [activeId, setActiveId] = useState<string>(() => {
    const stored = getActiveProfileId();
    if (stored && profiles.some((p) => p.id === stored)) return stored;
    const first = profiles[0]?.id ?? "";
    if (first) setActiveProfileId(first);
    return first;
  });

  const profile = useMemo(
    () =>
      profiles.find((p) => p.id === activeId) ??
      profiles[0] ?? { id: "", name: "" },
    [profiles, activeId],
  );

  // A round interrupted by refresh / tab close leaves a checkpoint behind —
  // move it into session history as soon as this profile is active again.
  useEffect(() => {
    if (profile.id) flushPendingSession(profile.id);
  }, [profile.id]);

  const switchProfile = useCallback(
    (id: string) => {
      if (!profiles.some((p) => p.id === id)) return;
      setActiveProfileId(id);
      setActiveId(id);
      navigate("/", { replace: true });
    },
    [navigate, profiles],
  );

  const createProfile = useCallback((name: string) => {
    const created = storeCreate(name);
    setProfiles(loadProfiles());
    return created;
  }, []);

  const renameProfile = useCallback((id: string, name: string) => {
    storeRename(id, name);
    setProfiles(loadProfiles());
  }, []);

  const deleteProfile = useCallback(
    (id: string) => {
      storeDelete(id);
      let next = loadProfiles();
      if (next.length === 0) {
        const fresh = storeCreate(DEFAULT_PROFILE_NAME);
        setActiveProfileId(fresh.id);
        next = [fresh];
      }
      setProfiles(next);
      const newActive = getActiveProfileId();
      if (newActive) setActiveId(newActive);
      if (id === activeId) navigate("/", { replace: true });
    },
    [activeId, navigate],
  );

  const value = useMemo<ProfilesContextValue>(
    () => ({
      profile,
      profileId: profile.id,
      profiles,
      switchProfile,
      createProfile,
      renameProfile,
      deleteProfile,
    }),
    [
      profile,
      profiles,
      switchProfile,
      createProfile,
      renameProfile,
      deleteProfile,
    ],
  );

  return (
    <ProfilesContext.Provider value={value}>
      {children}
    </ProfilesContext.Provider>
  );
}

export function useProfiles(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) {
    throw new Error("useProfiles must be used inside ProfilesProvider");
  }
  return ctx;
}
