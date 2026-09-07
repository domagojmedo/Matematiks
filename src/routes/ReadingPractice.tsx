import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { QuestionPad } from "../components/reading/QuestionPad";
import { StoryPage, VerdictPad } from "../components/reading/StoryPage";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import { useReadingKeys } from "../hooks/useReadingKeys";
import { useReadingRound } from "../hooks/useReadingRound";
import { pickNextStory, readProgress } from "../lib/reading/readingProgress";
import { slowestSentence } from "../lib/reading/readingStats";
import type { Story } from "../lib/reading/readingTypes";
import { findStory } from "../lib/reading/stories";

export function ReadingPractice() {
  const { storyId } = useParams<{ storyId: string }>();
  // Bumped by "read it again": remounting the round is how a re-read starts
  // from a clean timer without a page reload.
  const [runId, setRunId] = useState(0);
  const story = storyId ? findStory(storyId) : undefined;
  if (!story) return <Navigate to="/reading" replace />;
  return (
    <ReadingRound
      key={`${story.id}-${runId}`}
      story={story}
      onAgain={() => setRunId((n) => n + 1)}
    />
  );
}

function ReadingRound({
  story,
  onAgain,
}: {
  story: Story;
  onAgain: () => void;
}) {
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const navigate = useNavigate();
  const { profileId } = useProfiles();
  const round = useReadingRound(story);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const uppercase = settings.readingCase === "upper";

  useReadingKeys({
    enabled: round.phase === "reading" && !confirmLeave,
    next: round.nextSentence,
    repeat: round.repeatSentence,
  });

  // Escape backs out of the leave dialog. Deliberately not bound to *open* it:
  // a child hitting Escape mid-story should not be shown an exit prompt.
  useEffect(() => {
    if (!confirmLeave) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmLeave(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmLeave]);

  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;
  const progress =
    round.phase === "reading"
      ? (round.sentenceIndex + 1) / round.sentences.length
      : 1;

  return (
    <div className={`flex min-h-dvh w-full flex-col ${pageBg}`}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-5 pb-6 md:px-8 md:pt-8">
        <header className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              round.phase === "done"
                ? navigate("/reading")
                : setConfirmLeave(true)
            }
            aria-label={t("common.back")}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 transition hover:ring-stone-300 dark:bg-stone-900 dark:ring-stone-800"
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
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black tracking-tight text-stone-900 md:text-xl dark:text-white">
              {story.title}
            </h1>
            <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              {t("reading.levelShort", { level: story.level })}
              {round.isReread ? ` · ${t("reading.reread")}` : ""}
            </p>
          </div>
        </header>

        <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${theme.primary}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        {round.phase === "reading" && (
          <>
            <div className="flex-1">
              <StoryPage
                paragraphs={story.paragraphs}
                currentIndex={round.sentenceIndex}
                theme={theme}
                dark={settings.dark}
                uppercase={uppercase}
              />
            </div>
            <div className="mt-6">
              <p className="mb-2.5 text-center text-sm font-semibold text-stone-500 dark:text-stone-400">
                {t("reading.readAloud")}
              </p>
              <VerdictPad
                onNext={round.nextSentence}
                onRepeat={round.repeatSentence}
                nextLabel={t("reading.next")}
                repeatLabel={t("reading.repeat")}
                theme={theme}
              />
            </div>
          </>
        )}

        {round.phase === "questions" && round.question && (
          <QuestionPad
            key={round.questionIndex}
            question={round.question}
            index={round.questionIndex}
            total={round.questionCount}
            progressLabel={t("reading.question")}
            onAnswer={round.answerQuestion}
            theme={theme}
            uppercase={uppercase}
          />
        )}

        {round.phase === "done" && round.summary && (
          <Summary
            summary={round.summary}
            recorded={round.recorded}
            previousBest={round.previousBest}
            sentences={round.sentences}
            onAgain={onAgain}
            onNextStory={() => {
              // Read progress fresh: this round has just been recorded, so the
              // story now counts as read and will not be offered again.
              const next = pickNextStory(
                readProgress(profileId),
                story.level,
                story.id,
              );
              navigate(next ? `/reading/story/${next.id}` : "/reading");
            }}
            onDone={() => navigate("/reading")}
          />
        )}
      </div>

      {confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl dark:bg-stone-900">
            <h2 className="text-xl font-black text-stone-900 dark:text-white">
              {t("reading.leaveTitle")}
            </h2>
            <p className="mt-2 text-sm font-semibold text-stone-500 dark:text-stone-400">
              {t("reading.leaveBody")}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className={`h-12 flex-1 rounded-2xl text-base font-black text-white ${theme.primary} ${theme.primaryHover}`}
              >
                {t("reading.leaveStay")}
              </button>
              <button
                type="button"
                onClick={() => navigate("/reading")}
                className="h-12 flex-1 rounded-2xl bg-stone-100 text-base font-black text-stone-700 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700"
              >
                {t("reading.leaveLeave")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({
  summary,
  recorded,
  previousBest,
  sentences,
  onAgain,
  onNextStory,
  onDone,
}: {
  summary: NonNullable<ReturnType<typeof useReadingRound>["summary"]>;
  /** False when the read was too fast to be a measurement; nothing was saved. */
  recorded: boolean;
  previousBest: number;
  sentences: string[];
  onAgain: () => void;
  /** Straight into another story at the same level, without the list. */
  onNextStory: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useSettings();
  const beatRecord = recorded && previousBest > 0 && summary.wpm > previousBest;
  const slowest = slowestSentence(summary.timings, sentences);

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
      <p className="text-sm font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
        {t("reading.finished")}
      </p>

      <div className="mt-4 flex items-baseline gap-2">
        <span
          className={`text-7xl leading-none font-black tabular-nums md:text-8xl ${theme.primaryText} ${theme.primaryTextDark}`}
        >
          {summary.wpm}
        </span>
        <span className="text-lg font-black text-stone-400 dark:text-stone-500">
          {t("reading.wpm")}
        </span>
      </div>

      {beatRecord && (
        <p className="mt-3 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-black text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
          {t("reading.newRecord", { previous: previousBest })}
        </p>
      )}
      {!recorded && (
        <p className="mt-3 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-black text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          {t("reading.tooFast")}
        </p>
      )}
      {recorded && !beatRecord && previousBest > 0 && (
        <p className="mt-3 text-sm font-semibold text-stone-500 dark:text-stone-400">
          {t("reading.yourRecord", { best: previousBest })}
        </p>
      )}

      <div className="mt-7 grid w-full max-w-sm grid-cols-3 gap-3">
        <Stat
          label={t("reading.time")}
          value={`${Math.round(summary.durationMs / 1000)}s`}
        />
        <Stat label={t("reading.stumbles")} value={`${summary.stumbles}`} />
        <Stat
          label={t("reading.questions")}
          value={`${summary.questionsCorrect}/${summary.questionsTotal}`}
        />
      </div>

      {slowest && (
        <div className="mt-6 w-full max-w-sm rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          <p className="text-[11px] font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
            {t("reading.slowestLine")}
          </p>
          <p className="mt-1 text-sm font-bold text-stone-800 dark:text-stone-100">
            {slowest.sentence}
          </p>
        </div>
      )}

      {/* "Keep reading" is the primary action: the whole point is daily volume,
          and sending a child back to a list between every story is friction.
          Re-reading for speed stays one tap away as the drill it is. */}
      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={onNextStory}
          className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-lg font-black text-white shadow-sm transition active:scale-[0.99] ${theme.primary} ${theme.primaryHover} ${theme.primaryShadow}`}
        >
          {t("reading.nextStory")}
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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onAgain}
            className="h-13 flex-1 rounded-2xl bg-white px-3 py-3 text-sm font-black text-stone-700 ring-2 ring-stone-200 transition hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800"
          >
            {t("reading.beatRecord")}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="h-13 flex-1 rounded-2xl bg-white px-3 py-3 text-sm font-black text-stone-700 ring-2 ring-stone-200 transition hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800"
          >
            {t("reading.pickAnother")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
      <p className="text-xl font-black tabular-nums text-stone-900 dark:text-white">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-bold tracking-wide text-stone-500 uppercase dark:text-stone-400">
        {label}
      </p>
    </div>
  );
}
