import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Mascot } from "../components/Mascot";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import { formatDuration, isTimeMode } from "../lib/format";
import { findLesson, isWordLesson } from "../lib/lessons";
import { operationGlyph } from "../lib/problemGen";
import { PROFILE_KEYS, profileKey, readJSON } from "../lib/storage";
import {
  isWordRecord,
  type ProblemRecord,
  type SessionRecord,
} from "../lib/types";
import { findTemplate } from "../lib/wordTemplates";

export function Summary() {
  const location = useLocation();
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const { profileId } = useProfiles();

  const sessionId = (location.state as { sessionId?: string } | null)
    ?.sessionId;

  const [session] = useState<SessionRecord | null>(() => {
    if (!sessionId) return null;
    const all = readJSON<SessionRecord[]>(
      profileKey(profileId, PROFILE_KEYS.sessions),
      [],
    );
    return all.find((s) => s.id === sessionId) ?? null;
  });

  if (!session) return <Navigate to="/" replace />;

  const lesson = session.lessonId ? findLesson(session.lessonId) : undefined;
  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;
  const total = session.correct + session.mistakes;
  const accuracy = total > 0 ? Math.round((session.correct * 100) / total) : 0;
  const trickiest = pickTrickiest(session.problems);
  const avgMs = session.problems.length
    ? session.durationMs / session.problems.length
    : 0;

  const badges: { key: string; label: string; tone: BadgeTone }[] = [];
  if (session.bestStreak >= 5) {
    badges.push({
      key: "streak",
      label: t("summary.badgeStreak", { count: session.bestStreak }),
      tone: "amber",
    });
  }
  if (session.mistakes === 0 && session.correct > 0) {
    badges.push({
      key: "flawless",
      label: t("summary.badgeFlawless"),
      tone: "emerald",
    });
  } else if (accuracy >= 90) {
    badges.push({
      key: "accuracy",
      label: t("summary.badgeAccuracy", { percent: accuracy }),
      tone: "emerald",
    });
  }
  if (avgMs > 0 && avgMs < 7000) {
    badges.push({
      key: "fast",
      label: t("summary.badgeFastFinish"),
      tone: "sky",
    });
  }

  return (
    <div className={`min-h-dvh w-full ${pageBg}`}>
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 pt-6 pb-8 md:px-8 md:py-10">
        <header className="mb-3 flex items-center justify-between">
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
          <p className="text-xs font-bold tracking-widest text-stone-500 uppercase dark:text-stone-400">
            {t("summary.roundComplete")}
          </p>
          <div className="w-12" />
        </header>

        <div className="mt-2 mb-6 flex flex-col items-center">
          <Mascot size={108} mood="cheer" theme={theme} />
          <h1 className="mt-3 text-center text-3xl font-black tracking-tight text-stone-900 dark:text-white">
            {t("summary.niceWork")}
          </h1>
          <p className="mt-1 text-center text-sm font-semibold text-stone-500 dark:text-stone-400">
            {(() => {
              const operation = lesson
                ? t(lesson.nameKey)
                : t(`operations.${session.operation}`);
              return isTimeMode(session.setup)
                ? t("summary.sublineTime", {
                    operation,
                    minutes: Math.round((session.setup.timeMs ?? 0) / 60_000),
                  })
                : t("summary.subline", {
                    operation,
                    rounds: session.problems.length,
                  });
            })()}
          </p>
        </div>

        <section className="mb-3 flex items-center gap-5 rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          <AccuracyRing accuracy={accuracy} theme={theme} />
          <div className="grid flex-1 grid-cols-2 gap-2.5">
            <Stat
              value={session.correct}
              label={t("summary.correct")}
              valueClass="text-emerald-500"
            />
            <Stat
              value={session.mistakes}
              label={t("summary.mistakes")}
              valueClass="text-rose-500"
            />
            <Stat
              value={formatDuration(session.durationMs)}
              label={t("summary.time")}
              valueClass="text-stone-900 dark:text-white"
            />
            <Stat
              value={`★ ${session.bestStreak}`}
              label={t("summary.bestStreak")}
              valueClass="text-amber-500"
            />
          </div>
        </section>

        {trickiest && (
          <section className="mb-3 rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
            <p className="mb-2 text-xs font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
              {t("summary.trickiest")}
            </p>
            <TrickiestProblem problem={trickiest} theme={theme} t={t} />
          </section>
        )}

        {badges.length > 0 && (
          <section className="mb-4 grid grid-cols-3 gap-2.5">
            {badges.map((b) => (
              <div
                key={b.key}
                className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 ring-2 ${TONE_BADGE[b.tone]}`}
              >
                <span className="text-2xl leading-none font-black">
                  {BADGE_ICON[b.key] ?? "★"}
                </span>
                <span className="text-[11px] leading-none font-black tracking-wider uppercase">
                  {b.label}
                </span>
              </div>
            ))}
          </section>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2.5">
          <Link
            to="/"
            className="flex h-14 items-center justify-center rounded-2xl bg-white text-base font-black text-stone-900 ring-1 ring-stone-200 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 dark:bg-stone-900 dark:text-white dark:ring-stone-800"
          >
            {t("common.home")}
          </Link>
          <Link
            to={playAgainTarget(session, lesson)}
            replace
            state={playAgainState(session, lesson)}
            className={`flex h-14 items-center justify-center rounded-2xl text-base font-black text-white shadow-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.primary} ${theme.primaryHover} ${theme.primaryShadow} ${theme.primaryFocus}`}
          >
            {t("common.playAgain")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function pickTrickiest(problems: ProblemRecord[]): ProblemRecord | null {
  if (problems.length === 0) return null;
  return problems.reduce((max, p) => (p.tookMs > max.tookMs ? p : max));
}

/**
 * Trickiest-problem block. For word records (vocab/missing/.../convert) we
 * reconstruct the prose from the saved templateId + numbers + vars so the
 * kid sees "Pretvori 5 kg u dag." above the raw "5 × 100 = 500" equation,
 * not just the bare arithmetic.
 */
function TrickiestProblem({
  problem,
  theme,
  t,
}: {
  problem: ProblemRecord;
  theme: import("../lib/themes").Theme;
  // Re-using the parent's `t` instead of calling useTranslation here avoids
  // an extra hook subscription for a one-shot block.
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const prose =
    isWordRecord(problem) && problem.templateId && problem.numbers
      ? (findTemplate(problem.templateId)?.renderProse({
          templateId: problem.templateId,
          numbers: problem.numbers,
          ...(problem.vars ? { vars: problem.vars } : {}),
          phases: [],
        }) ?? null)
      : null;
  const tookLabel =
    problem.retries === 0
      ? t("summary.took", { seconds: Math.round(problem.tookMs / 1000) })
      : t("summary.tookRetries", {
          seconds: Math.round(problem.tookMs / 1000),
          retries: problem.retries,
        });
  return (
    <div>
      {prose && (
        <p className="mb-2 text-sm font-bold leading-snug text-stone-700 dark:text-stone-200">
          {prose}
        </p>
      )}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-stone-900 tabular-nums dark:text-white">
          {problem.a}
        </span>
        <span
          className={`text-2xl font-black ${theme.primaryText} ${theme.primaryTextDark}`}
        >
          {operationGlyph(problem.op)}
        </span>
        <span className="text-3xl font-black text-stone-900 tabular-nums dark:text-white">
          {problem.b}
        </span>
        <span className="text-2xl font-black text-stone-300 dark:text-stone-600">
          =
        </span>
        <span className="text-3xl font-black text-emerald-500 tabular-nums">
          {problem.answer}
        </span>
        <span className="ml-auto text-xs font-bold text-stone-500 dark:text-stone-400">
          {tookLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * Pick the right route for "Play again". Word lessons need their own route +
 * lessonId in the URL, since `session.operation` is coerced to "addsub" for
 * persistence and would otherwise route the kid into a vanilla addsub round.
 */
function playAgainTarget(
  session: SessionRecord,
  lesson: ReturnType<typeof findLesson>,
): string {
  if (isWordLesson(lesson)) return `/word-practice/${lesson.id}`;
  return `/practice/${session.operation}`;
}

function playAgainState(
  session: SessionRecord,
  lesson: ReturnType<typeof findLesson>,
): { setup: SessionRecord["setup"]; lessonId?: string } | null {
  // Word lessons get their setup from `findLesson(id)`, not from router state,
  // so passing state is unnecessary (and indeed a word setup would be
  // rejected by `Practice`'s `OperationSetup` typed prop).
  if (isWordLesson(lesson)) return null;
  // Always forward the just-played setup for arith sessions so Play Again
  // replays whatever setup the kid actually used (custom range, time mode,
  // crossesTen filter…). Without this, free-play custom rounds would silently
  // reset to the profile default. lessonId is optional — only included when
  // the session was tagged with one.
  return {
    setup: session.setup,
    ...(lesson ? { lessonId: lesson.id } : {}),
  };
}

function Stat({
  value,
  label,
  valueClass,
}: {
  value: string | number;
  label: string;
  valueClass: string;
}) {
  return (
    <div>
      <p
        className={`text-2xl leading-none font-black tabular-nums ${valueClass}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
        {label}
      </p>
    </div>
  );
}

function AccuracyRing({
  accuracy,
  theme,
}: {
  accuracy: number;
  theme: ReturnType<typeof useSettings>["theme"];
}) {
  const { t } = useTranslation();
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - accuracy / 100);
  return (
    <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center">
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="10"
          fill="none"
          className="text-stone-100 dark:text-stone-800"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke={theme.mascotTo}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl leading-none font-black text-stone-900 tabular-nums dark:text-white">
          {accuracy}
          <span className="text-lg text-stone-500 dark:text-stone-400">%</span>
        </span>
        <span className="mt-0.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
          {t("summary.accuracy")}
        </span>
      </div>
    </div>
  );
}

type BadgeTone = "amber" | "emerald" | "sky";

const TONE_BADGE: Record<BadgeTone, string> = {
  amber:
    "bg-amber-100 text-amber-700 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-700",
  emerald:
    "bg-emerald-100 text-emerald-700 ring-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-700",
  sky: "bg-sky-100 text-sky-700 ring-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700",
};

const BADGE_ICON: Record<string, string> = {
  streak: "★",
  accuracy: "✓",
  flawless: "✓",
  fast: "⚡",
};
