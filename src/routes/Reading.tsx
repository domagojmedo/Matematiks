import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import {
  canPromote,
  dayKey,
  nextLevel,
  pickDailyStory,
  readProgress,
  writeProgress,
} from "../lib/reading/readingProgress";
import { READING_LEVELS, type ReadingLevel } from "../lib/reading/readingTypes";
import { generatedForDay, storiesForLevel } from "../lib/reading/stories";

export function Reading() {
  const { t } = useTranslation();
  const { theme, settings, setReadingCase } = useSettings();
  const { profileId } = useProfiles();
  const navigate = useNavigate();

  const [progress, setProgress] = useState(() => readProgress(profileId));
  // Level 1 is syllable practice and has no stories, so it is a UI-only chip
  // rather than a ReadingLevel — the story types and the decodability guard
  // stay honest about levels 2–6 being the ones with text.
  const [level, setLevel] = useState<ReadingLevel | 1>(progress.browsingLevel);

  const chooseLevel = (value: ReadingLevel | 1) => {
    setLevel(value);
    if (value === 1) return;
    const updated = { ...progress, browsingLevel: value };
    writeProgress(profileId, updated);
    setProgress(updated);
  };

  const today = dayKey(new Date());
  const daily = pickDailyStory(progress, today);
  const stories = level === 1 ? [] : storiesForLevel(level);
  const read = new Set(progress.read);
  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;
  const promote = canPromote(progress);

  const acceptPromotion = () => {
    const updated = { ...progress, level: nextLevel(progress.level) };
    writeProgress(profileId, updated);
    setProgress(updated);
    setLevel(updated.level);
  };

  return (
    <div className={`min-h-dvh w-full ${pageBg}`}>
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-10 md:px-8 md:py-10">
        <header className="mb-6 flex items-center gap-3">
          <Link
            to="/"
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
          <h1 className="flex-1 text-2xl font-black tracking-tight text-stone-900 md:text-3xl dark:text-white">
            {t("reading.title")}
          </h1>
          {progress.streak > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-black text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              🔥 {progress.streak}
            </span>
          )}
        </header>

        {daily && (
          <button
            type="button"
            onClick={() => navigate(`/reading/story/${daily.id}`)}
            className={`mb-5 flex w-full items-center gap-3.5 rounded-3xl p-4 text-left text-white shadow-sm transition active:scale-[0.99] md:p-5 ${theme.primary} ${theme.primaryHover} ${theme.primaryShadow}`}
          >
            <span
              aria-hidden="true"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl"
            >
              📖
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black md:text-lg">
                {t("reading.storyOfTheDay")}
              </span>
              <span className="mt-0.5 block truncate text-sm font-semibold opacity-90">
                {daily.title}
              </span>
            </span>
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
          </button>
        )}

        {promote && (
          <div className="mb-5 rounded-3xl bg-emerald-50 p-4 ring-2 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-800">
            <p className="text-base font-black text-emerald-900 dark:text-emerald-100">
              {t("reading.promoteTitle")}
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-800/80 dark:text-emerald-200/80">
              {t("reading.promoteBody", { level: nextLevel(progress.level) })}
            </p>
            <button
              type="button"
              onClick={acceptPromotion}
              className="mt-3 h-11 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700"
            >
              {t("reading.promoteAccept")}
            </button>
          </div>
        )}

        {/* Letterform sits here rather than in Settings: which script a child
            reads in changes week to week early on, and a grown-up should be
            able to flip it on the way into a story. */}
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-white p-1.5 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          {(["sentence", "upper"] as const).map((value) => {
            const active = (settings.readingCase ?? "sentence") === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setReadingCase(value)}
                aria-pressed={active}
                className={`h-10 flex-1 rounded-xl text-sm font-black transition ${
                  active
                    ? `text-white ${theme.primary}`
                    : "text-stone-500 dark:text-stone-400"
                } ${value === "upper" ? "uppercase" : ""}`}
              >
                {t(`reading.case.${value}`)}
              </button>
            );
          })}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {([1, ...READING_LEVELS] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseLevel(value)}
              className={`h-11 min-w-[4.5rem] rounded-2xl px-4 text-sm font-black transition ${
                value === level
                  ? `text-white ${theme.primary}`
                  : "bg-white text-stone-600 ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-800"
              }`}
            >
              {t("reading.levelShort", { level: value })}
            </button>
          ))}
        </div>

        {/* What the chosen level actually means. The maths side is split by
            *razred* (school grade) and this one by *razina*, which look alike
            enough that a parent can read "4. razina" as fourth grade — so the
            difference is spelled out rather than implied. */}
        <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          <p className="text-sm font-bold text-stone-800 dark:text-stone-100">
            {t(`reading.levelDesc.${level}`)}
          </p>
          <p className="mt-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
            {t("reading.levelsNote")}
          </p>
        </div>

        {(level === 2 || level === 3) && (
          <div className="mb-4 flex gap-2.5">
            <Link
              to={`/reading/story/${generatedForDay(level, today).id}`}
              className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-white text-sm font-black text-stone-700 ring-2 ring-stone-200 transition hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800"
            >
              ✨ {t("reading.generated")}
            </Link>
            <Link
              to="/reading/warmup"
              className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-white text-sm font-black text-stone-700 ring-2 ring-stone-200 transition hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800"
            >
              🔤 {t("reading.warmup")}
            </Link>
          </div>
        )}

        {level === 1 && (
          <Link
            to="/reading/warmup"
            className={`flex items-center gap-3.5 rounded-3xl bg-white p-4 shadow-sm ring-2 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] dark:bg-stone-900 dark:ring-stone-800 ${theme.hoverPrimaryRing}`}
          >
            <span
              aria-hidden="true"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-2xl dark:bg-amber-900/40"
            >
              🔤
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-stone-900 md:text-lg dark:text-white">
                {t("reading.level1Title")}
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-stone-500 dark:text-stone-400">
                {t("reading.warmupHint")}
              </span>
            </span>
          </Link>
        )}

        <div className="flex flex-col gap-2.5">
          {stories.map((story) => {
            const best = progress.best[story.id] ?? 0;
            const done = read.has(story.id);
            return (
              <Link
                key={story.id}
                to={`/reading/story/${story.id}`}
                className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-2 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] dark:bg-stone-900 dark:ring-stone-800 ${theme.hoverPrimaryRing}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg ${
                    done
                      ? "bg-emerald-100 dark:bg-emerald-900/50"
                      : "bg-stone-100 dark:bg-stone-800"
                  }`}
                >
                  {done ? "✓" : "📄"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-black text-stone-900 dark:text-white">
                    {story.title}
                  </span>
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    {t("reading.sentenceCount", {
                      count: story.paragraphs.flat().length,
                    })}
                  </span>
                </span>
                {best > 0 && (
                  <span className="flex-shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-black tabular-nums text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    {best} {t("reading.wpm")}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <Link
          to="/reading/history"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-800 p-4 text-sm font-black text-white transition hover:bg-stone-900 dark:bg-stone-900 dark:hover:bg-stone-800"
        >
          {t("reading.history")}
        </Link>
      </div>
    </div>
  );
}
