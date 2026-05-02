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
  fontScale: 1,
  language: "hr",
};

type SettingsContextValue = {
  settings: AppSettings;
  theme: Theme;
  setTheme: (key: ThemeKey) => void;
  setDark: (dark: boolean) => void;
  setFontScale: (scale: number) => void;
  setLanguage: (lang: Language) => void;
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
    const root = document.documentElement;
    root.classList.toggle("dark", settings.dark);
    root.style.fontSize = `${Math.round(settings.fontScale * 100)}%`;
  }, [settings.dark, settings.fontScale]);

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
  const setFontScale = useCallback((fontScale: number) => {
    setSettings((s) => ({ ...s, fontScale }));
  }, []);
  const setLanguage = useCallback((language: Language) => {
    setSettings((s) => ({ ...s, language }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      theme: THEMES[settings.themeKey],
      setTheme,
      setDark,
      setFontScale,
      setLanguage,
    }),
    [settings, setTheme, setDark, setFontScale, setLanguage],
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
