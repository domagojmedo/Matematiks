import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useSettings } from "../contexts/SettingsContext";
import { summarizeSetup } from "../lib/format";
import {
  combinedWordSetup,
  type Grade as GradeNum,
  isValidGrade,
  isWordLesson,
  type Lesson,
  lessonsByGrade,
} from "../lib/lessons";
import {
  OPERATION_SYMBOL,
  OPERATION_TONE,
  TONE_CHIP,
  type Tone,
  wordChip,
} from "../lib/operations";

export function Grade() {
  const { grade } = useParams<{ grade: string }>();
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const navigate = useNavigate();

  // Combine mode: tap several word lessons, then play them as one mixed round.
  const [combining, setCombining] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!grade || !isValidGrade(grade)) {
    return <Navigate to="/" replace />;
  }

  const gradeNum = Number(grade) as GradeNum;
  const lessons = lessonsByGrade(gradeNum, settings.language);
  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;

  // Only word lessons can be combined (they share the WordPractice engine).
  const wordLessons = lessons.filter(isWordLesson);
  const canCombine = wordLessons.length >= 2;

  const launch = (lesson: Lesson) => {
    if (isWordLesson(lesson)) {
      navigate(`/word-practice/${lesson.id}`);
      return;
    }
    navigate(`/practice/${lesson.op}`, {
      state: { setup: lesson.setup, lessonId: lesson.id },
    });
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startCombined = () => {
    const chosen = wordLessons.filter((l) => selected.has(l.id));
    if (chosen.length < 2) return;
    navigate("/word-practice/combined", {
      state: { setup: combinedWordSetup(chosen), title: "lessons.combined" },
    });
  };

  const exitCombine = () => {
    setCombining(false);
    setSelected(new Set());
  };

  return (
    <div className={`min-h-dvh w-full ${pageBg}`}>
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-28 md:px-8 md:py-10">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Link
            to="/"
            aria-label={t("common.back")}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800"
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
          <h1 className="min-w-0 flex-1 truncate text-center text-xl font-black tracking-tight text-stone-900 dark:text-white">
            {t(`grades.g${gradeNum}`)}
          </h1>
          {canCombine ? (
            <button
              type="button"
              onClick={combining ? exitCombine : () => setCombining(true)}
              className="h-12 flex-shrink-0 rounded-2xl bg-white px-3 text-sm font-black text-stone-700 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800"
            >
              {combining ? t("common.cancel") : t("grade.combine")}
            </button>
          ) : (
            <div className="w-12 flex-shrink-0" />
          )}
        </header>

        <ul className="space-y-2.5">
          {lessons.map((lesson) => {
            const selectable = combining && isWordLesson(lesson);
            return (
              <li key={lesson.id}>
                <LessonCard
                  lesson={lesson}
                  selectMode={combining}
                  selectable={selectable}
                  selected={selected.has(lesson.id)}
                  onLaunch={() => {
                    if (selectable) toggleSelected(lesson.id);
                    else if (!combining) launch(lesson);
                  }}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {combining && (
        <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 px-5 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <span className="text-sm font-bold text-stone-500 tabular-nums dark:text-stone-400">
              {t("grade.selectedCount", { count: selected.size })}
            </span>
            <button
              type="button"
              onClick={startCombined}
              disabled={selected.size < 2}
              className={`ml-auto h-12 rounded-2xl px-5 text-sm font-black text-white shadow-sm transition active:scale-[0.99] disabled:opacity-40 ${theme.primary} ${theme.primaryHover}`}
            >
              {t("grade.startCombined")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function lessonChip(lesson: Lesson): { tone: Tone; symbol: string } {
  if (isWordLesson(lesson)) {
    return wordChip(lesson.wordKinds);
  }
  return {
    tone: OPERATION_TONE[lesson.op],
    symbol: OPERATION_SYMBOL[lesson.op],
  };
}

function lessonSubtitle(lesson: Lesson, problemsLabel: string): string {
  if (isWordLesson(lesson)) {
    return `${lesson.setup.rounds} ${problemsLabel}`;
  }
  const summary = summarizeSetup(lesson.setup);
  return `${summary} · ${lesson.setup.rounds} ${problemsLabel}`;
}

function LessonCard({
  lesson,
  selectMode,
  selectable,
  selected,
  onLaunch,
}: {
  lesson: Lesson;
  selectMode: boolean;
  selectable: boolean;
  selected: boolean;
  onLaunch: () => void;
}) {
  const { t } = useTranslation();
  const { tone, symbol } = lessonChip(lesson);
  const symbolClass = isWordLesson(lesson)
    ? "text-base leading-none font-black"
    : "text-3xl leading-none font-black";
  // In combine mode, non-word (arith) cards can't be combined — dim + disable.
  const dimmed = selectMode && !selectable;
  return (
    <button
      type="button"
      onClick={onLaunch}
      disabled={dimmed}
      aria-pressed={selectable ? selected : undefined}
      className={`group flex w-full items-center gap-3.5 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-sm dark:bg-stone-900 dark:hover:ring-stone-700 ${
        selected
          ? "ring-2 ring-emerald-400 dark:ring-emerald-500"
          : "ring-stone-200 dark:ring-stone-800"
      }`}
    >
      <div
        className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ring-2 ${TONE_CHIP[tone]}`}
      >
        <span className={symbolClass}>{symbol}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-black text-stone-900 dark:text-white">
          {t(lesson.nameKey)}
        </p>
        <p className="mt-0.5 truncate text-xs font-semibold text-stone-500 tabular-nums dark:text-stone-400">
          {lessonSubtitle(lesson, t("grade.problems"))}
        </p>
      </div>
      {selectable ? (
        <span
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ring-2 ${
            selected
              ? "bg-emerald-500 ring-emerald-500 text-white"
              : "ring-stone-300 text-transparent dark:ring-stone-600"
          }`}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
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
      )}
    </button>
  );
}
