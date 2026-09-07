import { useMemo, useState } from "react";
import type { ReadingQuestion } from "../../lib/reading/readingTypes";
import type { Theme } from "../../lib/themes";

/**
 * A comprehension question: prompt plus tap-one-of-N.
 *
 * Options are shuffled again here, per attempt. The generated data is already
 * shuffled once, but a child re-reading a story for speed would otherwise
 * remember *where* the answer sat rather than reading the options — and
 * re-reading is a feature of this app, not an edge case.
 *
 * After a tap the correct option is always revealed, right or wrong: the point
 * of the question is to send the child back into the text, not to score them.
 */
export function QuestionPad({
  question,
  index,
  total,
  progressLabel,
  onAnswer,
  theme,
}: {
  question: ReadingQuestion;
  index: number;
  total: number;
  progressLabel: string;
  onAnswer: (optionIndex: number) => void;
  theme: Theme;
}) {
  const order = useMemo(() => {
    const indices = question.options.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
    // Reshuffle when the question changes, not on every render.
  }, [question]);

  const [picked, setPicked] = useState<number | null>(null);

  const choose = (originalIndex: number) => {
    if (picked !== null) return;
    setPicked(originalIndex);
    // Let the child see the answer land before the screen moves on.
    window.setTimeout(() => {
      setPicked(null);
      onAnswer(originalIndex);
    }, 900);
  };

  return (
    <div className="flex flex-1 flex-col">
      <p className="mb-1 text-xs font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
        {progressLabel}
      </p>
      <h2 className="mb-6 text-2xl leading-snug font-black tracking-tight text-stone-900 md:text-3xl dark:text-white">
        {question.prompt}
      </h2>

      <div className="flex flex-col gap-3">
        {order.map((originalIndex) => {
          const option = question.options[originalIndex];
          const isCorrect = originalIndex === question.expectedIndex;
          const revealed = picked !== null;
          const isPicked = picked === originalIndex;

          let tone =
            "bg-white ring-stone-200 text-stone-900 dark:bg-stone-900 dark:ring-stone-800 dark:text-white";
          if (revealed && isCorrect) {
            tone =
              "bg-emerald-100 ring-emerald-300 text-emerald-900 dark:bg-emerald-900/50 dark:ring-emerald-700 dark:text-emerald-100";
          } else if (revealed && isPicked) {
            tone =
              "bg-rose-100 ring-rose-300 text-rose-900 dark:bg-rose-900/50 dark:ring-rose-700 dark:text-rose-100";
          } else if (revealed) {
            tone =
              "bg-white ring-stone-200 text-stone-400 dark:bg-stone-900 dark:ring-stone-800 dark:text-stone-600";
          }

          return (
            <button
              key={option}
              type="button"
              disabled={revealed}
              onClick={() => choose(originalIndex)}
              className={`min-h-16 rounded-2xl px-5 py-4 text-left text-lg font-bold ring-2 shadow-sm transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 md:text-xl ${tone} ${theme.primaryFocus}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs font-semibold text-stone-400 dark:text-stone-600">
        {index + 1} / {total}
      </p>
    </div>
  );
}
