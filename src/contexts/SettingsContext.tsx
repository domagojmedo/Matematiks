import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { readJSON, STORAGE_KEYS, writeJSON } from "../lib/storage";
import { THEMES, type Theme } from "../lib/themes";
import type { AppSettings, Language, ThemeKey } from "../lib/types";

const DEFAULT_SETTINGS: AppSettings = {
  themeKey: "warmPurple",
  dark: false,
  language: "hr",
  voiceInput: false,
};

type SettingsContextValue = {
  settings: AppSettings;
  theme: Theme;
  setTheme: (key: ThemeKey) => void;
  setDark: (dark: boolean) => void;
  setLanguage: (lang: Language) => void;
  setVoiceInput: (enabled: boolean) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() =>
    readJSON<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
  );
  const { i18n } = useTranslation();

  useEffect(() => {
    writeJSON(STORAGE_KEYS.settings, settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.dark);
  }, [settings.dark]);

  useEffect(() => {
    if (i18n.language !== settings.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [settings.language, i18n]);

  const setTheme = useCallback((key: ThemeKey) => {
    setSettings((s) => ({ ...s, themeKey: key }));
  }, []);
  const setDark = useCallback((dark: boolean) => {
    setSettings((s) => ({ ...s, dark }));
  }, []);
  const setLanguage = useCallback((language: Language) => {
    setSettings((s) => ({ ...s, language }));
  }, []);
  const setVoiceInput = useCallback((voiceInput: boolean) => {
    setSettings((s) => ({ ...s, voiceInput }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      theme: THEMES[settings.themeKey],
      setTheme,
      setDark,
      setLanguage,
      setVoiceInput,
    }),
    [settings, setTheme, setDark, setLanguage, setVoiceInput],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return ctx;
}
