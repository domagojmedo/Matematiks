import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useSettings } from "../contexts/SettingsContext";
import { summarizeSetup } from "../lib/format";
import {
  type Grade as GradeNum,
  isValidGrade,
  type Lesson,
  lessonsByGrade,
} from "../lib/lessons";
import { OPERATION_SYMBOL, OPERATION_TONE, TONE_CHIP } from "../lib/operations";

export function Grade() {
  const { grade } = useParams<{ grade: string }>();
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const navigate = useNavigate();

  if (!grade || !isValidGrade(grade)) {
    return <Navigate to="/" replace />;
  }

  const gradeNum = Number(grade) as GradeNum;
  const lessons = lessonsByGrade(gradeNum);
  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;

  return (
    <div className={`min-h-dvh w-full ${pageBg}`}>
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-10 md:px-8 md:py-10">
        <header className="mb-6 flex items-center justify-between">
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
            {t(`grades.g${gradeNum}`)}
          </h1>
          <div className="w-12" />
        </header>

        <ul className="space-y-2.5">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <LessonCard
                lesson={lesson}
                onLaunch={() =>
                  navigate(`/practice/${lesson.op}`, {
                    state: { setup: lesson.setup, lessonId: lesson.id },
                  })
                }
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LessonCard({
  lesson,
  onLaunch,
}: {
  lesson: Lesson;
  onLaunch: () => void;
}) {
  const { t } = useTranslation();
  const tone = OPERATION_TONE[lesson.op];
  return (
    <button
      type="button"
      onClick={onLaunch}
      className="group flex w-full items-center gap-3.5 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 dark:bg-stone-900 dark:ring-stone-800 dark:hover:ring-stone-700"
    >
      <div
        className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ring-2 ${TONE_CHIP[tone]}`}
      >
        <span className="text-3xl leading-none font-black">
          {OPERATION_SYMBOL[lesson.op]}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-black text-stone-900 dark:text-white">
          {t(lesson.nameKey)}
        </p>
        <p className="mt-0.5 truncate text-xs font-semibold text-stone-500 tabular-nums dark:text-stone-400">
          {summarizeSetup(lesson.setup)} · {lesson.setup.rounds}{" "}
          {t("grade.problems")}
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
    </button>
  );
}
