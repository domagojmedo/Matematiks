import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import { formatDuration } from "../lib/format";
import { findLesson } from "../lib/lessons";
import { OPERATION_SYMBOL, OPERATION_TONE, TONE_CHIP } from "../lib/operations";
import { operationGlyph } from "../lib/problemGen";
import { PROFILE_KEYS, profileKey, readJSON } from "../lib/storage";
import {
  isWordRecord,
  type ProblemAttempt,
  type ProblemRecord,
  type SessionRecord,
} from "../lib/types";
import { findTemplate } from "../lib/wordTemplates";

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { theme, settings } = useSettings();
  const { profileId } = useProfiles();
  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;

  const session = useMemo<SessionRecord | null>(() => {
    if (!id) return null;
    const all = readJSON<SessionRecord[]>(
      profileKey(profileId, PROFILE_KEYS.sessions),
      [],
    );
    return all.find((s) => s.id === id) ?? null;
  }, [id, profileId]);

  if (!session) return <Navigate to="/sessions" replace />;

  const lesson = session.lessonId ? findLesson(session.lessonId) : undefined;
  const title = lesson
    ? t(lesson.nameKey)
    : t(`operations.${session.operation}`);
  const tone = OPERATION_TONE[session.operation];
  const dateStr = new Date(session.date).toLocaleString(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className={`min-h-dvh w-full ${pageBg}`}>
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-10 md:px-8 md:py-10">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/sessions"
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
          <h1 className="truncate text-base font-black tracking-tight text-stone-900 dark:text-white">
            {title}
          </h1>
          <div className="w-12" />
        </header>

        <section className="mb-5 rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ring-2 ${TONE_CHIP[tone]}`}
            >
              <span className="text-2xl leading-none font-black">
                {OPERATION_SYMBOL[session.operation]}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-stone-900 dark:text-white">
                {title}
              </p>
              <p className="truncate text-xs font-semibold text-stone-500 dark:text-stone-400">
                {dateStr} · {formatDuration(session.durationMs)}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <Stat
              v={session.correct}
              label={t("sessionDetail.correct")}
              cls="text-emerald-500"
            />
            <Stat
              v={session.mistakes}
              label={t("sessionDetail.mistakes")}
              cls="text-rose-500"
            />
            <Stat
              v={`★ ${session.bestStreak}`}
              label={t("sessionDetail.bestStreak")}
              cls="text-amber-500"
            />
          </div>
        </section>

        <h2 className="mb-2.5 px-1 text-sm font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
          {t("sessionDetail.problems")} ({session.problems.length})
        </h2>
        {session.problems.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-stone-500 ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:ring-stone-800">
            {t("sessionDetail.empty")}
          </p>
        ) : (
          <ol className="space-y-2">
            {session.problems.map((problem, idx) => (
              <li
                // Legacy records (written before `startedAtMs` existed) have no
                // stable id; the problems list is append-only and never reordered,
                // so the index is a sound key here.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                key={`${idx}-${problem.startedAtMs ?? 0}`}
              >
                <ProblemRow index={idx} problem={problem} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Stat({
  v,
  label,
  cls,
}: {
  v: string | number;
  label: string;
  cls: string;
}) {
  return (
    <div>
      <p className={`text-2xl leading-none font-black tabular-nums ${cls}`}>
        {v}
      </p>
      <p className="mt-0.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
        {label}
      </p>
    </div>
  );
}

function ProblemRow({
  index,
  problem,
}: {
  index: number;
  problem: ProblemRecord;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isWord = isWordRecord(problem);
  const wasCorrect = problem.answer === problem.userAnswer;

  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-black text-stone-600 tabular-nums dark:bg-stone-800 dark:text-stone-300">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          {isWord ? (
            <WordProblemHeading problem={problem} />
          ) : (
            <ArithHeading problem={problem} />
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-stone-500 tabular-nums dark:text-stone-400">
            <span className={wasCorrect ? "text-emerald-600" : "text-rose-600"}>
              {wasCorrect ? "✓" : "✗"}
            </span>
            <span>·</span>
            <span>
              {problem.retries === 0
                ? t("sessionDetail.took", {
                    seconds: Math.round(problem.tookMs / 1000),
                  })
                : t("sessionDetail.tookRetries", {
                    seconds: Math.round(problem.tookMs / 1000),
                    retries: problem.retries,
                  })}
            </span>
            {problem.startedAtMs !== undefined && (
              <>
                <span>·</span>
                <span>
                  {t("sessionDetail.startedAt", {
                    mmss: formatTimelineStamp(problem.startedAtMs),
                  })}
                </span>
              </>
            )}
            {problem.attempts !== undefined && (
              <>
                <span>·</span>
                <span className="text-stone-400 dark:text-stone-500">
                  {expanded
                    ? t("sessionDetail.collapse")
                    : t("sessionDetail.expand", {
                        count: problem.attempts.length,
                      })}
                </span>
              </>
            )}
          </p>
        </div>
      </button>
      {expanded && (
        <AttemptList
          attempts={problem.attempts ?? []}
          startedAtMs={problem.startedAtMs ?? 0}
        />
      )}
    </div>
  );
}

function ArithHeading({ problem }: { problem: ProblemRecord }) {
  return (
    <p className="text-lg font-black text-stone-900 tabular-nums dark:text-white">
      {problem.a}
      <span className="mx-1 text-stone-500 dark:text-stone-400">
        {operationGlyph(problem.op)}
      </span>
      {problem.b}
      <span className="mx-1 text-stone-300 dark:text-stone-600">=</span>
      <span className="text-emerald-600 dark:text-emerald-400">
        {problem.answer}
      </span>
    </p>
  );
}

function WordProblemHeading({ problem }: { problem: ProblemRecord }) {
  const template = problem.templateId
    ? findTemplate(problem.templateId)
    : undefined;
  if (!template || !problem.numbers) {
    // Defensive fallback: render the primary equation if we can't reconstruct
    // the prose (e.g. someone deleted a template that earlier sessions used).
    return <ArithHeading problem={problem} />;
  }
  const reconstructed = {
    templateId: problem.templateId as string,
    numbers: problem.numbers,
    ...(problem.vars ? { vars: problem.vars } : {}),
    phases: [],
  };
  const prose = template.renderProse(reconstructed);
  return (
    <div>
      <p className="text-sm font-bold leading-snug text-stone-700 dark:text-stone-200">
        {prose}
      </p>
      <p className="mt-1 text-base font-black text-stone-900 tabular-nums dark:text-white">
        {problem.a}
        <span className="mx-1 text-stone-500 dark:text-stone-400">
          {operationGlyph(problem.op)}
        </span>
        {problem.b}
        <span className="mx-1 text-stone-300 dark:text-stone-600">=</span>
        <span className="text-emerald-600 dark:text-emerald-400">
          {problem.answer}
        </span>
      </p>
    </div>
  );
}

function AttemptList({
  attempts,
  startedAtMs,
}: {
  attempts: ProblemAttempt[];
  startedAtMs: number;
}) {
  const { t } = useTranslation();
  if (attempts.length === 0) {
    return (
      <p className="mt-3 rounded-xl bg-stone-50 p-3 text-xs font-semibold text-stone-500 dark:bg-stone-800 dark:text-stone-400">
        {t("sessionDetail.noAttempts")}
      </p>
    );
  }
  return (
    <ol className="mt-3 space-y-1.5 rounded-xl bg-stone-50 p-3 dark:bg-stone-800">
      {attempts.map((attempt, i) => {
        const sincePrev =
          i === 0
            ? attempt.atMs - startedAtMs
            : attempt.atMs - (attempts[i - 1]?.atMs ?? attempt.atMs);
        return (
          <li
            key={`${attempt.atMs}-${attempt.phaseIndex}-${String(attempt.given)}`}
            className="flex items-center gap-2 text-[11px] font-semibold text-stone-600 dark:text-stone-300"
          >
            <span className="w-10 text-right tabular-nums text-stone-400 dark:text-stone-500">
              {formatTimelineStamp(attempt.atMs)}
            </span>
            <span className="flex-shrink-0 inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-black tabular-nums">
              {attempt.correct ? (
                <span className="text-emerald-600">✓</span>
              ) : (
                <span className="text-rose-600">✗</span>
              )}
            </span>
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-stone-500 ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:ring-stone-700">
              {phaseLabel(attempt.phaseKind)} #{attempt.phaseIndex + 1}
            </span>
            <span className="font-black tabular-nums text-stone-900 dark:text-white">
              {String(attempt.given)}
            </span>
            {!attempt.correct && (
              <span className="text-stone-400 dark:text-stone-500">
                ({t("sessionDetail.expected")} {String(attempt.expected)})
              </span>
            )}
            <span className="ml-auto tabular-nums text-stone-400 dark:text-stone-500">
              +{Math.round(sincePrev)}ms
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function phaseLabel(kind: string): string {
  switch (kind) {
    case "answer":
      return "answer";
    case "pickOp":
      return "op";
    case "mulPartial":
      return "partial";
    case "mulSum":
      return "sum";
    case "divQuotientDigit":
      return "q-digit";
    case "divProduct":
      return "product";
    case "divRemainder":
      return "remainder";
    default:
      return kind;
  }
}

function formatTimelineStamp(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
