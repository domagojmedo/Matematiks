import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import type { Profile } from "../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  profiles: Profile[];
  activeId: string;
};

export function ProfilePicker({ open, onClose, profiles, activeId }: Props) {
  const { t } = useTranslation();
  const { theme } = useSettings();
  const { switchProfile, createProfile } = useProfiles();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  if (!open) return null;

  function pick(id: string) {
    if (id === activeId) {
      onClose();
      return;
    }
    switchProfile(id);
    onClose();
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    const created = createProfile(name);
    setNewName("");
    setAdding(false);
    switchProfile(created.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 px-4 py-6 backdrop-blur-sm sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="close"
        tabIndex={-1}
      />
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl dark:bg-stone-900"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="mb-3 text-xl font-black tracking-tight text-stone-900 dark:text-white">
          {t("profiles.switch")}
        </h2>

        <ul className="space-y-2">
          {profiles.map((p) => {
            const isActive = p.id === activeId;
            const initial = (p.name[0] ?? "?").toUpperCase();
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p.id)}
                  aria-label={t("profiles.switchTo", { name: p.name })}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 ${theme.primaryFocus} ${
                    isActive
                      ? `bg-white ring-2 ${theme.primaryRing} dark:bg-stone-800`
                      : "bg-white ring-stone-200 hover:ring-stone-300 dark:bg-stone-800 dark:ring-stone-700 dark:hover:ring-stone-600"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-base font-black text-white ${theme.primary}`}
                  >
                    {initial}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base font-black text-stone-900 dark:text-white">
                    {p.name}
                  </span>
                  {isActive && (
                    <span
                      className={`flex-shrink-0 text-xs font-bold tracking-wider uppercase ${theme.primaryText} ${theme.primaryTextDark}`}
                    >
                      {t("profiles.active")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {adding ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              // biome-ignore lint/a11y/noAutofocus: name field is the modal's main action
              autoFocus
              maxLength={20}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewName("");
                }
              }}
              placeholder={t("profiles.newProfilePrompt")}
              className={`h-12 flex-1 rounded-2xl bg-white px-4 text-base font-bold text-stone-900 ring-2 ring-stone-200 focus:outline-none focus-visible:ring-4 dark:bg-stone-800 dark:text-white dark:ring-stone-700 ${theme.primaryFocus}`}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newName.trim()}
              className={`h-12 rounded-2xl px-4 text-sm font-black text-white shadow-sm transition disabled:opacity-50 ${theme.primary} ${theme.primaryHover} ${theme.primaryShadow}`}
            >
              {t("common.confirm")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-stone-100 text-base font-black text-stone-700 transition hover:bg-stone-200 active:scale-[0.99] dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t("profiles.addProfile")}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 h-12 w-full rounded-2xl bg-white text-base font-black text-stone-900 ring-1 ring-stone-200 transition active:scale-[0.99] dark:bg-stone-900 dark:text-white dark:ring-stone-800"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
