import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useSettings } from "../contexts/SettingsContext";
import { STORIES } from "../lib/reading/readingStories";
import {
  type Drill,
  mergeDrillsFromStories,
  syllableDrills,
} from "../lib/reading/syllableDrills";

const DRILL_COUNT = 12;
const MERGE_COUNT = 8;

/**
 * Level 1 warm-up: blending practice before a story.
 *
 * Two card types in one run — bare syllables (`ma`, `te`), then whole words
 * broken into their syllables (`ma · ma`). The merge cards are built from the
 * vocabulary of the actual stories, so the warm-up primes the words the child
 * is about to meet rather than an unrelated list.
 *
 * There is no scoring here. This is a warm-up, and putting a score on blending
 * drills would turn the easiest part of the session into the tensest.
 */
export function ReadingWarmup() {
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const [index, setIndex] = useState(0);

  const drills = useMemo<Drill[]>(() => {
    const syllables = syllableDrills(DRILL_COUNT, 6, Math.random);
    const merges = mergeDrillsFromStories(
      STORIES.filter((story) => story.level === 2),
      MERGE_COUNT,
    );
    return [...syllables, ...merges];
  }, []);

  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;
  const drill = drills[index];
  const done = index >= drills.length;

  return (
    <div className={`flex min-h-dvh w-full flex-col ${pageBg}`}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-5 pb-8 md:px-8">
        <header className="mb-4 flex items-center gap-3">
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
          <h1 className="flex-1 text-lg font-black tracking-tight text-stone-900 md:text-xl dark:text-white">
            {t("reading.warmup")}
          </h1>
          <span className="text-sm font-black tabular-nums text-stone-400 dark:text-stone-500">
            {Math.min(index + 1, drills.length)}/{drills.length}
          </span>
        </header>

        <div className="flex flex-1 items-center justify-center">
          {done ? (
            <div className="text-center">
              <p className="text-5xl">🎉</p>
              <p className="mt-4 text-2xl font-black text-stone-900 dark:text-white">
                {t("reading.warmupDone")}
              </p>
              <Link
                to="/reading"
                className={`mt-6 inline-flex h-14 items-center rounded-2xl px-8 text-lg font-black text-white ${theme.primary} ${theme.primaryHover}`}
              >
                {t("reading.pickAnother")}
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIndex(index + 1)}
              className="flex min-h-[16rem] w-full items-center justify-center rounded-[2rem] bg-white p-8 shadow-sm ring-2 ring-stone-200 transition active:scale-[0.99] dark:bg-stone-900 dark:ring-stone-800"
            >
              {drill.kind === "syllable" ? (
                <span className="text-7xl font-black tracking-tight text-stone-900 md:text-8xl dark:text-white">
                  {drill.text}
                </span>
              ) : (
                <span className="flex flex-col items-center gap-4">
                  <span className="flex items-center gap-2">
                    {drill.parts.map((part, i) => (
                      <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: a word like "mama" repeats a syllable, so syllable text alone cannot key these.
                        key={`${drill.word}-${i}`}
                        className={`rounded-2xl px-4 py-2 text-4xl font-black md:text-5xl ${theme.accentChip}`}
                      >
                        {part}
                      </span>
                    ))}
                  </span>
                  <span className="text-5xl font-black tracking-tight text-stone-900 md:text-6xl dark:text-white">
                    {drill.word}
                  </span>
                </span>
              )}
            </button>
          )}
        </div>

        {!done && (
          <p className="mt-5 text-center text-sm font-semibold text-stone-500 dark:text-stone-400">
            {t("reading.warmupHint")}
          </p>
        )}
      </div>
    </div>
  );
}
