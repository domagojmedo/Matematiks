import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import type { ReadingSessionRecord } from "../lib/reading/readingStats";
import { PROFILE_KEYS, profileKey, readJSON } from "../lib/storage";

/**
 * Reading history: the words-per-minute trend, then every session.
 *
 * The trend is the point of the whole module, so it leads. It is drawn oldest →
 * newest even though the list below runs newest-first: a trend that ran
 * backwards would read as decline.
 */
export function ReadingHistory() {
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const { profileId } = useProfiles();

  const sessions = readJSON<ReadingSessionRecord[]>(
    profileKey(profileId, PROFILE_KEYS.readingSessions),
    [],
  );
  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;
  const trend = [...sessions].reverse().slice(-20);
  const peak = trend.reduce((max, s) => Math.max(max, s.wpm), 0);

  return (
    <div className={`min-h-dvh w-full ${pageBg}`}>
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-10 md:px-8 md:py-10">
        <header className="mb-6 flex items-center gap-3">
          <Link
            to="/reading"
            aria-label={t("common.back")}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800"
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="text-stone-700 dark:text-stone-200"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-stone-900 md:text-3xl dark:text-white">
            {t("reading.history")}
          </h1>
        </header>

        {sessions.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm font-semibold text-stone-500 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:ring-stone-800">
            {t("reading.historyEmpty")}
          </p>
        )}

        {trend.length > 1 && (
          <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
            <p className="mb-3 text-xs font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
              {t("reading.trend")}
            </p>
            {/* justify-start + a per-bar cap: with two sessions, flex-1 bars
                stretch into slabs that read as a chart of nothing. */}
            <div className="flex h-28 items-end justify-start gap-1.5">
              {trend.map((session) => (
                <div
                  key={session.id}
                  title={`${session.wpm} ${t("reading.wpm")}`}
                  className={`min-w-2 max-w-10 flex-1 rounded-t-md ${theme.primary}`}
                  style={{
                    height: `${peak > 0 ? Math.max(6, (session.wpm / peak) * 100) : 6}%`,
                  }}
                />
              ))}
            </div>
            <p className="mt-2 text-right text-xs font-black tabular-nums text-stone-500 dark:text-stone-400">
              {t("reading.best")}: {peak} {t("reading.wpm")}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-black text-stone-900 dark:text-white">
                  {session.storyTitle}
                </span>
                <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  {new Date(session.date).toLocaleDateString()} ·{" "}
                  {t("reading.levelShort", { level: session.level })}
                  {session.isReread ? ` · ${t("reading.reread")}` : ""}
                </span>
              </span>
              <span className="flex-shrink-0 text-right">
                <span
                  className={`block text-lg font-black tabular-nums ${theme.primaryText} ${theme.primaryTextDark}`}
                >
                  {session.wpm}
                </span>
                <span className="text-[11px] font-bold text-stone-400 uppercase dark:text-stone-500">
                  {t("reading.wpm")}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
