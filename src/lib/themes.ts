import type { ThemeKey } from "./types";

export type Theme = {
  key: ThemeKey;
  name: string;
  swatch: string;
  pageBg: string;
  pageBgDark: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  primaryTextDark: string;
  primaryRing: string;
  hoverPrimaryRing: string;
  primaryShadow: string;
  primaryFocus: string;
  accentChip: string;
  mascotFrom: string;
  mascotTo: string;
};

export const THEMES: Record<ThemeKey, Theme> = {
  warmPurple: {
    key: "warmPurple",
    name: "Warm Purple",
    swatch: "#8b5cf6",
    pageBg: "bg-gradient-to-b from-violet-50 via-white to-amber-50",
    pageBgDark: "bg-stone-950",
    primary: "bg-violet-500",
    primaryHover: "hover:bg-violet-600",
    primaryText: "text-violet-600",
    primaryTextDark: "dark:text-violet-300",
    primaryRing: "ring-violet-300",
    hoverPrimaryRing: "hover:ring-violet-300",
    primaryShadow: "shadow-violet-300",
    primaryFocus: "focus-visible:ring-violet-400",
    accentChip:
      "bg-violet-100 text-violet-700 ring-violet-300 dark:bg-violet-900/50 dark:text-violet-200 dark:ring-violet-700",
    mascotFrom: "#c4b5fd",
    mascotTo: "#8b5cf6",
  },
  coral: {
    key: "coral",
    name: "Coral",
    swatch: "#f97373",
    pageBg: "bg-gradient-to-b from-rose-50 via-white to-amber-50",
    pageBgDark: "bg-stone-950",
    primary: "bg-rose-500",
    primaryHover: "hover:bg-rose-600",
    primaryText: "text-rose-600",
    primaryTextDark: "dark:text-rose-300",
    primaryRing: "ring-rose-300",
    hoverPrimaryRing: "hover:ring-rose-300",
    primaryShadow: "shadow-rose-300",
    primaryFocus: "focus-visible:ring-rose-400",
    accentChip:
      "bg-rose-100 text-rose-700 ring-rose-300 dark:bg-rose-900/50 dark:text-rose-200 dark:ring-rose-700",
    mascotFrom: "#fda4af",
    mascotTo: "#f43f5e",
  },
  teal: {
    key: "teal",
    name: "Teal",
    swatch: "#14b8a6",
    pageBg: "bg-gradient-to-b from-teal-50 via-white to-amber-50",
    pageBgDark: "bg-stone-950",
    primary: "bg-teal-500",
    primaryHover: "hover:bg-teal-600",
    primaryText: "text-teal-600",
    primaryTextDark: "dark:text-teal-300",
    primaryRing: "ring-teal-300",
    hoverPrimaryRing: "hover:ring-teal-300",
    primaryShadow: "shadow-teal-300",
    primaryFocus: "focus-visible:ring-teal-400",
    accentChip:
      "bg-teal-100 text-teal-700 ring-teal-300 dark:bg-teal-900/50 dark:text-teal-200 dark:ring-teal-700",
    mascotFrom: "#5eead4",
    mascotTo: "#0d9488",
  },
  indigoPlum: {
    key: "indigoPlum",
    name: "Indigo Plum",
    swatch: "#6366f1",
    pageBg: "bg-gradient-to-b from-indigo-50 via-white to-fuchsia-50",
    pageBgDark: "bg-stone-950",
    primary: "bg-indigo-500",
    primaryHover: "hover:bg-indigo-600",
    primaryText: "text-indigo-600",
    primaryTextDark: "dark:text-indigo-300",
    primaryRing: "ring-indigo-300",
    hoverPrimaryRing: "hover:ring-indigo-300",
    primaryShadow: "shadow-indigo-300",
    primaryFocus: "focus-visible:ring-indigo-400",
    accentChip:
      "bg-indigo-100 text-indigo-700 ring-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-200 dark:ring-indigo-700",
    mascotFrom: "#a5b4fc",
    mascotTo: "#6366f1",
  },
};
