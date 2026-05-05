import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ProfilePicker } from "../components/ProfilePicker";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import { GRADES } from "../lib/lessons";
import {
  isValidOperation,
  OPERATION_SYMBOL,
  OPERATION_TONE,
  OPERATIONS,
  TONE_CHIP,
} from "../lib/operations";
import { PROFILE_KEYS, profileKey, readJSON } from "../lib/storage";
import type { LastSession } from "../lib/types";

export function Home() {
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const { profile, profiles, profileId } = useProfiles();
  const [pickerOpen, setPickerOpen] = useState(false);
  const lastRaw = readJSON<LastSession | null>(
    profileKey(profileId, PROFILE_KEYS.lastSession),
    null,
  );
  const last = lastRaw && isValidOperation(lastRaw.operation) ? lastRaw : null;
  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;
  const initial = (profile.name[0] ?? "?").toUpperCase();

  return (
    <div className={`min-h-dvh w-full ${pageBg}`}>
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-10 md:px-8 md:py-10">
        <header className="mb-7 flex items-center gap-3 md:mb-10">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 md:gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl shadow-sm md:h-12 md:w-12 ${theme.primary} ${theme.primaryShadow}`}
            >
              <span className="text-lg leading-none font-black text-white md:text-xl">
                M
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl leading-none font-black tracking-tight text-stone-900 md:text-3xl dark:text-white">
                {t("common.appName")}
              </h1>
              <p className="mt-0.5 truncate text-xs font-semibold text-stone-500 md:hidden lg:mt-1 lg:block lg:text-sm dark:text-stone-400">
                {t("home.tagline")}
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label={t("profiles.switch")}
              className="flex h-12 max-w-[10rem] items-center gap-2 rounded-2xl bg-white pr-3 pl-2 shadow-sm ring-1 ring-stone-200 transition hover:ring-stone-300 dark:bg-stone-900 dark:ring-stone-800 dark:hover:ring-stone-700"
            >
              <span
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black text-white ${theme.primary}`}
              >
                {initial}
              </span>
              <span className="hidden truncate text-sm font-black text-stone-900 sm:inline dark:text-white">
                {profile.name}
              </span>
            </button>
            <Link
              to="/settings"
              aria-label={t("common.settings")}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 transition hover:ring-stone-300 dark:bg-stone-900 dark:ring-stone-800 dark:hover:ring-stone-700"
            >
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-stone-700 dark:text-stone-200"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>
        </header>

        {last && (
          <Link
            to={`/practice/${last.operation}`}
            className={`mb-5 flex h-14 w-full items-center gap-3 rounded-2xl px-4 text-white shadow-sm transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 ${theme.primary} ${theme.primaryHover} ${theme.primaryShadow} ${theme.primaryFocus}`}
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg font-black"
            >
              {OPERATION_SYMBOL[last.operation]}
            </span>
            <div className="flex-1 text-left">
              <p className="text-base leading-none font-black">
                {t("home.quickStart")}
              </p>
              <p className="mt-0.5 text-xs font-semibold opacity-90">
                {t(`operations.${last.operation}`)}
              </p>
            </div>
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        )}

        <h2 className="mb-3 px-1 text-lg font-black tracking-tight text-stone-900 md:mb-4 md:text-xl dark:text-white">
          {t("home.operations")}
        </h2>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4">
          {OPERATIONS.map((op) => {
            const tone = OPERATION_TONE[op];
            return (
              <Link
                key={op}
                to={`/setup/${op}`}
                className={`group relative flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl bg-white p-4 shadow-sm ring-2 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 sm:aspect-[4/3] sm:gap-3 sm:p-5 ${theme.hoverPrimaryRing} ${theme.primaryFocus} dark:bg-stone-900 dark:ring-stone-800 dark:hover:ring-stone-700`}
              >
                <div
                  className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl ring-2 sm:h-20 sm:w-20 ${TONE_CHIP[tone]}`}
                >
                  <span className="text-4xl leading-none font-black sm:text-5xl">
                    {OPERATION_SYMBOL[op]}
                  </span>
                </div>
                <p className="w-full truncate text-center text-base leading-tight font-black tracking-tight text-stone-900 sm:text-lg dark:text-white">
                  {t(`operations.${op}`)}
                </p>
              </Link>
            );
          })}
        </div>

        <h2 className="mt-7 mb-3 px-1 text-lg font-black tracking-tight text-stone-900 md:mt-10 md:mb-4 md:text-xl dark:text-white">
          {t("home.byGrade")}
        </h2>

        <div className="grid grid-cols-4 gap-3.5 sm:gap-4">
          {GRADES.map((g) => (
            <Link
              key={g}
              to={`/grade/${g}`}
              className={`group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-3xl bg-white p-3 shadow-sm ring-2 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.hoverPrimaryRing} ${theme.primaryFocus} dark:bg-stone-900 dark:ring-stone-800 dark:hover:ring-stone-700`}
            >
              <span
                className={`text-4xl leading-none font-black tabular-nums sm:text-5xl ${theme.primaryText} ${theme.primaryTextDark}`}
              >
                {g}.
              </span>
              <span className="text-[11px] font-bold tracking-wider text-stone-500 uppercase sm:text-xs dark:text-stone-400">
                {t("home.gradeShort")}
              </span>
            </Link>
          ))}
        </div>

        <Link
          to="/sessions"
          className={`mt-3.5 flex w-full items-center gap-3.5 rounded-3xl bg-stone-800 p-4 shadow-sm transition hover:bg-stone-900 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 md:mt-4 md:gap-5 md:px-6 md:py-5 dark:bg-stone-900 dark:hover:bg-stone-800 ${theme.primaryFocus}`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-700 md:h-14 md:w-14">
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              className="text-amber-300"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-base font-black text-white md:text-xl">
              {t("home.sessions")}
            </p>
            <p className="text-xs font-semibold text-stone-300 md:text-sm">
              {t("home.sessionsSubtitle")}
            </p>
          </div>
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="text-stone-400"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
      <ProfilePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        profiles={profiles}
        activeId={profileId}
      />
    </div>
  );
}
