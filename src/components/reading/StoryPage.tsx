import type { Theme } from "../../lib/themes";

/**
 * The story, shown the way a page of a book is: all of it at once, with the
 * current sentence lit and the rest dimmed but still readable.
 *
 * Showing one sentence at a time would be easier to build and worse to read —
 * a child loses the thread, cannot see how far they have come, and gets no
 * sense of a page being finished. Lines already read stay at higher contrast
 * than lines still to come, so the page visibly fills up behind them.
 *
 * Type is deliberately large with loose leading: a slow decoder tracks lines
 * with their eyes, and tight text is where they lose their place.
 */
export function StoryPage({
  paragraphs,
  currentIndex,
  theme,
  dark,
  uppercase,
}: {
  paragraphs: string[][];
  /** Index into the flattened sentence list. */
  currentIndex: number;
  theme: Theme;
  dark: boolean;
  /**
   * Render in velika tiskana slova. Done with CSS `text-transform` rather than
   * `toUpperCase()` so the DOM keeps the real text — screen readers, copy and
   * the tests all still see "Maca je mala."
   */
  uppercase: boolean;
}) {
  let flat = -1;
  return (
    <div className={`space-y-5 md:space-y-6 ${uppercase ? "uppercase" : ""}`}>
      {paragraphs.map((paragraph, pIndex) => (
        <p
          // biome-ignore lint/suspicious/noArrayIndexKey: story paragraphs are fixed content, never reordered or inserted into, so the index is stable identity.
          key={`p-${pIndex}`}
          className="text-xl leading-[1.9] font-semibold tracking-tight text-stone-400 sm:text-2xl sm:leading-[1.95] md:text-3xl dark:text-stone-600"
        >
          {paragraph.map((sentence, sIndex) => {
            flat += 1;
            const isCurrent = flat === currentIndex;
            const isRead = flat < currentIndex;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: sentences within a story are immutable, and sentence text alone is not unique enough to key on.
              <span key={`s-${pIndex}-${sIndex}`}>
                <span
                  data-sentence={flat}
                  data-current={isCurrent || undefined}
                  // Every sentence carries the same box — padding, radius,
                  // decoration-clone — and only the colours change. Giving the
                  // padding to the highlighted sentence alone made the line
                  // wider than the others, so each advance reflowed the
                  // paragraph and shunted words onto different lines. A child
                  // who is still tracking text with their eyes loses their
                  // place completely. Colour is the one thing that can change
                  // without moving anything.
                  className={`box-decoration-clone rounded px-1 py-0.5 transition-colors duration-200 ${
                    isCurrent
                      ? `${dark ? "text-white" : "text-stone-900"} ${theme.accentChip}`
                      : isRead
                        ? "bg-transparent text-stone-500 dark:text-stone-400"
                        : "bg-transparent text-stone-400 dark:text-stone-600"
                  }`}
                >
                  {sentence}
                </span>{" "}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

/**
 * `Dalje` / `Ponovi`. Sized for a finger — at the lower levels a grown-up is
 * often the one tapping while the child reads, and at every level the child
 * should never have to aim.
 */
export function VerdictPad({
  onNext,
  onRepeat,
  nextLabel,
  repeatLabel,
  theme,
}: {
  onNext: () => void;
  onRepeat: () => void;
  nextLabel: string;
  repeatLabel: string;
  theme: Theme;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onRepeat}
        className="flex h-16 flex-1 items-center justify-center rounded-2xl bg-amber-100 text-lg font-black text-amber-800 ring-2 ring-amber-200 transition hover:bg-amber-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800"
      >
        {repeatLabel}
      </button>
      <button
        type="button"
        onClick={onNext}
        className={`flex h-16 flex-[2] items-center justify-center gap-2 rounded-2xl text-xl font-black text-white shadow-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.primary} ${theme.primaryHover} ${theme.primaryShadow} ${theme.primaryFocus}`}
      >
        {nextLabel}
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
