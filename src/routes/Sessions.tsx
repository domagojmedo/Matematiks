import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Mascot } from "../components/Mascot";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import { formatDuration, summarizeSetup } from "../lib/format";
import { OPERATION_SYMBOL, OPERATION_TONE, TONE_CHIP } from "../lib/operations";
import { PROFILE_KEYS, profileKey, readJSON } from "../lib/storage";
import type { SessionRecord } from "../lib/types";

export function Sessions() {
  const { t, i18n } = useTranslation();
  const { theme, settings } = useSettings();
  const { profileId } = useProfiles();
  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;

  const sessions = useMemo(
    () =>
      readJSON<SessionRecord[]>(
        profileKey(profileId, PROFILE_KEYS.sessions),
        [],
      ),
    [profileId],
  );

  const week = useMemo(() => buildWeekStats(sessions), [sessions]);

  const isEmpty = sessions.length === 0;

  return (
    <div className={`min-h-dvh w-full ${pageBg}`}>
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-10 md:px-8 md:py-10">
        <header className="mb-5 flex items-center justify-between">
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
            {t("sessions.title")}
          </h1>
          <div className="w-12" />
        </header>

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <WeekSummary
              correct={week.correct}
              mistakes={week.mistakes}
              streak={week.dayStreak}
              bars={week.bars}
              language={i18n.language}
            />

            <h2 className="mb-2.5 px-1 text-sm font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
              {t("sessions.recent")}
            </h2>
            <ul className="space-y-2.5">
              {sessions.map((session) => (
                <li key={session.id}>
                  <SessionCard session={session} language={i18n.language} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  const { theme } = useSettings();
  return (
    <div className="mt-12 flex flex-col items-center px-6 text-center">
      <Mascot size={88} theme={theme} />
      <h2 className="mt-5 text-2xl font-black tracking-tight text-stone-900 dark:text-white">
        {t("sessions.emptyTitle")}
      </h2>
      <p className="mt-2 max-w-xs text-base leading-snug font-semibold text-stone-500 dark:text-stone-400">
        {t("sessions.emptyBody")}
      </p>
      <Link
        to="/"
        className={`mt-6 flex h-14 items-center justify-center rounded-2xl px-6 text-base font-black text-white shadow-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.primary} ${theme.primaryHover} ${theme.primaryShadow} ${theme.primaryFocus}`}
      >
        {t("sessions.emptyCta")}
      </Link>
    </div>
  );
}

function WeekSummary({
  correct,
  mistakes,
  streak,
  bars,
  language,
}: {
  correct: number;
  mistakes: number;
  streak: number;
  bars: WeeklyBar[];
  language: string;
}) {
  const { t } = useTranslation();
  const max = Math.max(...bars.map((b) => b.problems), 1);
  return (
    <section className="mb-5 rounded-3xl bg-stone-800 px-5 py-4 text-white dark:bg-stone-900 dark:ring-1 dark:ring-stone-800">
      <p className="text-xs font-bold tracking-wider text-stone-400 uppercase">
        {t("sessions.thisWeek")}
      </p>
      <div className="mt-2 flex items-end gap-4">
        <div>
          <p className="text-4xl leading-none font-black tabular-nums">
            {correct}
          </p>
          <p className="mt-1 text-xs font-semibold text-stone-400">
            {t("sessions.correct")}
          </p>
        </div>
        <div>
          <p className="text-4xl leading-none font-black text-rose-300 tabular-nums">
            {mistakes}
          </p>
          <p className="mt-1 text-xs font-semibold text-stone-400">
            {t("sessions.mistakes")}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-4xl leading-none font-black text-amber-300 tabular-nums">
            {streak}
          </p>
          <p className="mt-1 text-xs font-semibold text-stone-400">
            {t("sessions.dayStreak")}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {bars.map((bar) => {
          const heightPx =
            bar.problems > 0
              ? Math.max(4, Math.round((bar.problems / max) * 36))
              : 2;
          return (
            <div
              key={bar.dateKey}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="flex h-9 w-full items-end">
                <div
                  className={`w-full rounded-t ${bar.problems > 0 ? "bg-amber-300" : "bg-stone-700"}`}
                  style={{ height: `${heightPx}px` }}
                  aria-hidden="true"
                />
              </div>
              <span className="text-[9px] font-bold tracking-wider text-stone-500 uppercase">
                {dayLetter(bar.date, language)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SessionCard({
  session,
  language,
}: {
  session: SessionRecord;
  language: string;
}) {
  const { t } = useTranslation();
  const tone = OPERATION_TONE[session.operation];
  return (
    <div className="flex w-full items-center gap-3.5 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
      <div
        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ring-2 ${TONE_CHIP[tone]}`}
      >
        <span className="text-2xl leading-none font-black">
          {OPERATION_SYMBOL[session.operation]}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-base leading-tight font-black text-stone-900 dark:text-white">
          <span>{t(`operations.${session.operation}`)}</span>
          <span className="truncate text-xs font-bold text-stone-500 tabular-nums dark:text-stone-400">
            {summarizeSetup(session.setup)}
          </span>
        </p>
        <p className="mt-0.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
          {formatRelative(session.date, language, t)} ·{" "}
          {formatDuration(session.durationMs)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-black text-stone-900 tabular-nums dark:text-white">
            {session.correct}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-rose-500" />
          <span className="text-sm font-black text-stone-900 tabular-nums dark:text-white">
            {session.mistakes}
          </span>
        </div>
      </div>
    </div>
  );
}

type WeeklyBar = {
  date: Date;
  dateKey: string;
  problems: number;
};

function buildWeekStats(sessions: SessionRecord[]): {
  correct: number;
  mistakes: number;
  dayStreak: number;
  bars: WeeklyBar[];
} {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  let correct = 0;
  let mistakes = 0;
  for (const s of sessions) {
    const d = new Date(s.date);
    if (d >= sevenDaysAgo) {
      correct += s.correct;
      mistakes += s.mistakes;
    }
  }

  const bars: WeeklyBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toDateString();
    const problems = sessions
      .filter((s) => new Date(s.date).toDateString() === key)
      .reduce((sum, s) => sum + s.problems.length, 0);
    bars.push({ date: d, dateKey: key, problems });
  }

  const dayKeys = new Set(sessions.map((s) => new Date(s.date).toDateString()));
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!dayKeys.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dayKeys.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { correct, mistakes, dayStreak: streak, bars };
}

function dayLetter(date: Date, language: string): string {
  try {
    return new Intl.DateTimeFormat(language, { weekday: "narrow" })
      .format(date)
      .toUpperCase();
  } catch {
    return ["S", "M", "T", "W", "T", "F", "S"][date.getDay()] ?? "";
  }
}

function formatRelative(
  iso: string,
  language: string,
  t: (key: string) => string,
): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString(language, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return `${t("sessions.today")}, ${time}`;
  if (isYesterday) return t("sessions.yesterday");
  return date.toLocaleDateString(language, {
    day: "numeric",
    month: "short",
  });
}
