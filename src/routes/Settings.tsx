import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import { useWhisperEngine } from "../hooks/useWhisperEngine";
import { isSpeechRecognitionSupported } from "../lib/speech";
import { THEMES } from "../lib/themes";
import type { Language, Profile, ThemeKey } from "../lib/types";

const THEME_KEYS: ThemeKey[] = ["warmPurple", "coral", "teal", "indigoPlum"];

// Gates the experimental on-device Whisper engine. Flip to true to expose
// the toggle + download progress UI again. The engine code (worker,
// singleton, hook) is kept around behind this flag so it can be re-enabled
// without re-implementation.
const SHOW_WHISPER_TOGGLE = false;

export function SettingsRoute() {
  const { t } = useTranslation();
  const {
    settings,
    theme,
    setTheme,
    setDark,
    setLanguage,
    setVoiceInput,
    setUseWhisper,
  } = useSettings();
  const voiceSupported = isSpeechRecognitionSupported();

  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;

  return (
    <div className={`min-h-dvh w-full ${pageBg}`}>
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-10 md:px-8 md:py-10">
        <header className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            aria-label={t("common.back")}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800"
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-stone-700 dark:text-stone-200"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <h1 className="text-xl font-black tracking-tight text-stone-900 dark:text-white">
            {t("settings.title")}
          </h1>
          <div className="w-12" />
        </header>

        <SettingSection title={t("settings.profiles")}>
          <ProfilesSection />
        </SettingSection>

        <SettingSection title={t("settings.theme")}>
          <div className="grid grid-cols-2 gap-2.5">
            {THEME_KEYS.map((key) => {
              const tk = THEMES[key];
              const active = settings.themeKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme(key)}
                  className={`flex h-16 items-center gap-3 rounded-2xl bg-white px-4 ring-2 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 dark:bg-stone-900 ${
                    active
                      ? `${tk.primaryRing} ${tk.primaryFocus}`
                      : "ring-stone-200 hover:ring-stone-300 dark:ring-stone-800 dark:hover:ring-stone-700"
                  }`}
                >
                  <span
                    className="block h-8 w-8 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: tk.swatch }}
                    aria-hidden="true"
                  />
                  <span className="text-base font-black text-stone-900 dark:text-white">
                    {t(
                      `settings.theme${
                        key.charAt(0).toUpperCase() + key.slice(1)
                      }`,
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </SettingSection>

        <SettingSection title={t("settings.darkMode")}>
          <ToggleRow
            checked={settings.dark}
            onChange={setDark}
            label={t("settings.darkMode")}
          />
        </SettingSection>

        {voiceSupported && (
          <SettingSection title={t("settings.voiceInput")}>
            <ToggleRow
              checked={settings.voiceInput ?? false}
              onChange={setVoiceInput}
              label={t("settings.voiceInputHint")}
            />
            <p className="mt-1.5 px-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
              {t("settings.voiceInputBrowsers")}
            </p>
            {SHOW_WHISPER_TOGGLE && (settings.voiceInput ?? false) && (
              <div className="mt-2.5">
                <ToggleRow
                  checked={settings.useWhisper ?? false}
                  onChange={setUseWhisper}
                  label={t("settings.useWhisperHint")}
                />
                <p className="mt-1.5 px-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
                  {t("settings.useWhisperNote")}
                </p>
                {(settings.useWhisper ?? false) && (
                  <WhisperEngineStatus />
                )}
              </div>
            )}
          </SettingSection>
        )}

        <SettingSection title={t("settings.language")}>
          <div className="grid grid-cols-2 gap-2.5">
            <LanguageButton
              active={settings.language === "hr"}
              onClick={() => setLanguage("hr" as Language)}
              code="HR"
              label="Hrvatski"
              themeRing={theme.primaryRing}
              themeFocus={theme.primaryFocus}
            />
            <LanguageButton
              active={settings.language === "en"}
              onClick={() => setLanguage("en" as Language)}
              code="EN"
              label="English"
              themeRing={theme.primaryRing}
              themeFocus={theme.primaryFocus}
            />
          </div>
        </SettingSection>
      </div>
    </div>
  );
}

function ProfilesSection() {
  const { t } = useTranslation();
  const { theme } = useSettings();
  const {
    profiles,
    profileId,
    switchProfile,
    createProfile,
    renameProfile,
    deleteProfile,
  } = useProfiles();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <div className="space-y-2.5">
      {profiles.map((p) => (
        <ProfileRow
          key={p.id}
          profile={p}
          isActive={p.id === profileId}
          canDelete={profiles.length > 1}
          onSwitch={() => switchProfile(p.id)}
          onRename={(name) => renameProfile(p.id, name)}
          onDelete={() => {
            const ok = window.confirm(
              t("profiles.deleteConfirm", { name: p.name }),
            );
            if (ok) deleteProfile(p.id);
          }}
        />
      ))}

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            // biome-ignore lint/a11y/noAutofocus: name input is the section's main action
            autoFocus
            maxLength={20}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (newName.trim()) {
                  createProfile(newName.trim());
                  setNewName("");
                  setAdding(false);
                }
              }
              if (e.key === "Escape") {
                setAdding(false);
                setNewName("");
              }
            }}
            placeholder={t("profiles.newProfilePrompt")}
            className={`h-12 flex-1 rounded-2xl bg-white px-4 text-base font-bold text-stone-900 ring-2 ring-stone-200 focus:outline-none focus-visible:ring-4 dark:bg-stone-900 dark:text-white dark:ring-stone-800 ${theme.primaryFocus}`}
          />
          <button
            type="button"
            onClick={() => {
              if (newName.trim()) {
                createProfile(newName.trim());
                setNewName("");
                setAdding(false);
              }
            }}
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
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-base font-black text-stone-700 ring-1 ring-stone-200 transition hover:ring-stone-300 active:scale-[0.99] dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800 dark:hover:ring-stone-700"
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
    </div>
  );
}

function ProfileRow({
  profile,
  isActive,
  canDelete,
  onSwitch,
  onRename,
  onDelete,
}: {
  profile: Profile;
  isActive: boolean;
  canDelete: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useSettings();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(profile.name);
  const initial = (profile.name[0] ?? "?").toUpperCase();

  function commit() {
    const next = draft.trim();
    if (next && next !== profile.name) onRename(next);
    setRenaming(false);
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 dark:bg-stone-900 ${
        isActive
          ? `ring-2 ${theme.primaryRing}`
          : "ring-stone-200 dark:ring-stone-800"
      }`}
    >
      <span
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-base font-black text-white ${theme.primary}`}
      >
        {initial}
      </span>
      {renaming ? (
        <input
          type="text"
          // biome-ignore lint/a11y/noAutofocus: rename field is opened on demand
          autoFocus
          maxLength={20}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(profile.name);
              setRenaming(false);
            }
          }}
          onBlur={commit}
          className={`h-9 min-w-0 flex-1 rounded-xl bg-stone-50 px-3 text-base font-bold text-stone-900 ring-2 ring-stone-200 focus:outline-none focus-visible:ring-4 dark:bg-stone-800 dark:text-white dark:ring-stone-700 ${theme.primaryFocus}`}
        />
      ) : (
        <button
          type="button"
          onClick={isActive ? () => setRenaming(true) : onSwitch}
          className="flex min-w-0 flex-1 items-baseline gap-2 text-left text-base font-black text-stone-900 dark:text-white"
        >
          <span className="truncate">{profile.name}</span>
          {isActive && (
            <span
              className={`flex-shrink-0 text-xs font-bold tracking-wider uppercase ${theme.primaryText} ${theme.primaryTextDark}`}
            >
              {t("profiles.active")}
            </span>
          )}
        </button>
      )}
      {!renaming && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRenaming(true)}
            aria-label={t("profiles.rename")}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={t("profiles.delete")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function WhisperEngineStatus() {
  const { t } = useTranslation();
  // Passing autoload=true here triggers the model download as soon as the
  // user lands on this section. The engine is a singleton, so subsequent
  // mounts (e.g. when entering a practice round) see the already-loaded
  // state instead of re-downloading.
  const engine = useWhisperEngine(true);

  if (engine.status === "idle") return null;

  const isError = engine.status === "error";
  const isReady = engine.status === "ready";
  const percent =
    engine.downloadProgress != null
      ? Math.round(engine.downloadProgress * 100)
      : null;

  const label = isError
    ? t("settings.whisperError", { message: engine.error ?? "" })
    : isReady
      ? t("settings.whisperReady")
      : percent != null
        ? t("settings.whisperDownloading", { percent })
        : t("settings.whisperPreparing");

  const barClass = isError
    ? "bg-rose-500"
    : isReady
      ? "bg-emerald-500"
      : "bg-emerald-500";
  const trackClass = isError
    ? "bg-rose-100 dark:bg-rose-950/40"
    : "bg-stone-200 dark:bg-stone-800";

  return (
    <div className="mt-2.5 rounded-2xl bg-white p-3 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`min-w-0 flex-1 text-sm font-bold ${
            isError
              ? "text-rose-600 dark:text-rose-300"
              : "text-stone-700 dark:text-stone-200"
          }`}
        >
          {label}
        </span>
        {isReady && (
          <span
            aria-hidden="true"
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
        )}
      </div>
      {!isReady && !isError && (
        <div className={`mt-2 h-2 w-full overflow-hidden rounded-full ${trackClass}`}>
          <div
            className={`h-full rounded-full transition-[width] duration-150 ${barClass}`}
            style={{ width: `${percent ?? 5}%` }}
          />
        </div>
      )}
    </div>
  );
}

function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="mb-2.5 px-1 text-sm font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
      <span className="min-w-0 flex-1 text-base font-bold text-stone-700 dark:text-stone-200">
        {label}
      </span>
      <span
        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition ${
          checked ? "bg-emerald-500" : "bg-stone-300 dark:bg-stone-700"
        }`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </label>
  );
}

function LanguageButton({
  active,
  onClick,
  code,
  label,
  themeRing,
  themeFocus,
}: {
  active: boolean;
  onClick: () => void;
  code: string;
  label: string;
  themeRing: string;
  themeFocus: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 items-center justify-center gap-3 rounded-2xl bg-white text-base font-black text-stone-900 ring-2 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 dark:bg-stone-900 dark:text-white ${
        active
          ? `${themeRing} ${themeFocus}`
          : "ring-stone-200 hover:ring-stone-300 dark:ring-stone-800 dark:hover:ring-stone-700"
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-xs font-black tracking-wider text-stone-700 dark:bg-stone-800 dark:text-stone-200"
      >
        {code}
      </span>
      <span>{label}</span>
    </button>
  );
}
