import { useCallback, useMemo, useRef, useState } from "react";
import { useProfiles } from "../contexts/ProfilesContext";
import {
  dayKey,
  readProgress,
  recordRead,
  writeProgress,
} from "../lib/reading/readingProgress";
import {
  isPlausibleRead,
  type ReadingSessionRecord,
  type SentenceTiming,
  summarizeReading,
} from "../lib/reading/readingStats";
import { type Story, storySentences } from "../lib/reading/readingTypes";
import { PROFILE_KEYS, profileKey, readJSON, writeJSON } from "../lib/storage";

export type ReadingPhase = "reading" | "questions" | "done";

const MAX_STORED_SESSIONS = 200;

/**
 * Runs one story: sentence-by-sentence reading, then the comprehension
 * questions, then the summary.
 *
 * Deliberately *not* built on `useRoundMechanics`. That hook produces a
 * `ProblemRecord`, whose `a / b / op / answer / userAnswer` are all required
 * numbers, and a sentence has none of them; widening it would ripple through
 * `Summary` and `SessionDetail` and touch a shape already on real devices. The
 * two loops also differ structurally — this one walks a fixed list of
 * sentences rather than generating problems on demand — so there is less
 * shared machinery than it first appears.
 *
 * A partial read is *not* recorded. Words-per-minute over three of fifteen
 * sentences is not a slower reading, it is a different measurement, and
 * letting it into the history would corrupt the trend the whole feature is
 * built to show.
 */
export function useReadingRound(story: Story) {
  const { profileId } = useProfiles();
  const sentences = useMemo(() => storySentences(story), [story]);

  // Captured once at mount: both change the moment the round is recorded, and
  // the summary needs to compare against the state *before* this read.
  const [{ isReread, previousBest }] = useState(() => {
    const progress = readProgress(profileId);
    return {
      isReread: progress.read.includes(story.id),
      previousBest: progress.best[story.id] ?? 0,
    };
  });

  const [phase, setPhase] = useState<ReadingPhase>("reading");
  // False when the finished read was too fast to be a real measurement, so the
  // summary can say so instead of announcing a record nobody earned.
  const [recorded, setRecorded] = useState(true);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [summary, setSummary] = useState<ReadingSessionRecord | null>(null);

  const timingsRef = useRef<SentenceTiming[]>([]);
  const sentenceStartRef = useRef<number>(performance.now());
  // Time already spent on the current sentence across re-reads, and whether
  // any of them was a stumble.
  const carriedMsRef = useRef(0);
  const stumbledRef = useRef(false);

  const finish = useCallback(
    (finalAnswers: boolean[]) => {
      const record: ReadingSessionRecord = {
        id: `${Date.now()}-${story.id}`,
        date: new Date().toISOString(),
        ...summarizeReading({
          story,
          timings: timingsRef.current,
          answers: finalAnswers,
          isReread,
        }),
      };

      const plausible = isPlausibleRead(record.wpm);
      if (plausible) {
        const key = profileKey(profileId, PROFILE_KEYS.readingSessions);
        const stored = readJSON<ReadingSessionRecord[]>(key, []);
        writeJSON(key, [record, ...stored].slice(0, MAX_STORED_SESSIONS));

        writeProgress(
          profileId,
          recordRead(readProgress(profileId), {
            storyId: story.id,
            wpm: record.wpm,
            today: dayKey(new Date()),
          }),
        );
      }

      setRecorded(plausible);
      setSummary(record);
      setPhase("done");
    },
    [profileId, story, isReread],
  );

  /** Finished reading the highlighted sentence aloud. */
  const nextSentence = useCallback(() => {
    const elapsed = performance.now() - sentenceStartRef.current;
    timingsRef.current = [
      ...timingsRef.current,
      {
        index: sentenceIndex,
        ms: carriedMsRef.current + elapsed,
        stumbled: stumbledRef.current,
      },
    ];
    carriedMsRef.current = 0;
    stumbledRef.current = false;
    sentenceStartRef.current = performance.now();

    if (sentenceIndex + 1 < sentences.length) {
      setSentenceIndex(sentenceIndex + 1);
      return;
    }
    if (story.questions.length > 0) {
      setPhase("questions");
      return;
    }
    finish([]);
  }, [sentenceIndex, sentences.length, story.questions.length, finish]);

  /**
   * The child stumbled and is re-reading this line. Time keeps accumulating —
   * a re-read is part of how long the sentence actually took.
   */
  const repeatSentence = useCallback(() => {
    carriedMsRef.current += performance.now() - sentenceStartRef.current;
    sentenceStartRef.current = performance.now();
    stumbledRef.current = true;
  }, []);

  const answerQuestion = useCallback(
    (optionIndex: number) => {
      const question = story.questions[questionIndex];
      if (!question) return;
      const nextAnswers = [...answers, optionIndex === question.expectedIndex];
      setAnswers(nextAnswers);
      if (questionIndex + 1 < story.questions.length) {
        setQuestionIndex(questionIndex + 1);
        return;
      }
      finish(nextAnswers);
    },
    [answers, questionIndex, story.questions, finish],
  );

  return {
    phase,
    sentences,
    sentenceIndex,
    question: story.questions[questionIndex] ?? null,
    questionIndex,
    questionCount: story.questions.length,
    answers,
    summary,
    recorded,
    isReread,
    previousBest,
    nextSentence,
    repeatSentence,
    answerQuestion,
  };
}
