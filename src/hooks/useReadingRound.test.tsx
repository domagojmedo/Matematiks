/**
 * Lifecycle tests for `useReadingRound`.
 *
 * This is where the words-per-minute number is actually made, so the timing
 * behaviour is the point: elapsed time per sentence, time carried across a
 * re-read, and the fact that a partial read is never written to history.
 *
 * `performance.now` is stubbed rather than using fake timers — the hook reads
 * the clock directly on each tap, so controlling the clock is enough and
 * avoids fighting React's scheduler.
 */
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilesProvider } from "../contexts/ProfilesContext";
import { getActiveProfileId } from "../lib/profiles";
import { readProgress } from "../lib/reading/readingProgress";
import type { ReadingSessionRecord } from "../lib/reading/readingStats";
import type { Story } from "../lib/reading/readingTypes";
import { PROFILE_KEYS, profileKey, readJSON } from "../lib/storage";
import { useReadingRound } from "./useReadingRound";

function Wrap({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <ProfilesProvider>{children}</ProfilesProvider>
    </MemoryRouter>
  );
}

/** Three sentences, nine words total — easy WPM arithmetic. */
const STORY: Story = {
  id: "test-story",
  level: 2,
  title: "Test",
  paragraphs: [["Maca je tu.", "Lopta je tu."], ["Mama je tu."]],
  questions: [
    { prompt: "Tko je tu?", options: ["maca", "pas"], expectedIndex: 0 },
  ],
};

let clock = 0;
const advance = (ms: number) => {
  clock += ms;
};

beforeEach(() => {
  localStorage.clear();
  clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const sessions = (): ReadingSessionRecord[] =>
  readJSON<ReadingSessionRecord[]>(
    profileKey(getActiveProfileId() ?? "", PROFILE_KEYS.readingSessions),
    [],
  );

const render = () =>
  renderHook(() => useReadingRound(STORY), { wrapper: Wrap });

describe("reading phases", () => {
  it("starts on the first sentence", () => {
    const { result } = render();
    expect(result.current.phase).toBe("reading");
    expect(result.current.sentenceIndex).toBe(0);
    expect(result.current.sentences).toHaveLength(3);
  });

  it("flattens paragraphs into reading order", () => {
    const { result } = render();
    expect(result.current.sentences).toEqual([
      "Maca je tu.",
      "Lopta je tu.",
      "Mama je tu.",
    ]);
  });

  it("moves to the questions after the last sentence", () => {
    const { result } = render();
    for (let i = 0; i < 3; i++) {
      act(() => result.current.nextSentence());
    }
    expect(result.current.phase).toBe("questions");
    expect(result.current.question?.prompt).toBe("Tko je tu?");
  });

  it("finishes after the last question", () => {
    const { result } = render();
    for (let i = 0; i < 3; i++) act(() => result.current.nextSentence());
    act(() => result.current.answerQuestion(0));
    expect(result.current.phase).toBe("done");
    expect(result.current.summary).not.toBeNull();
  });
});

describe("timing", () => {
  it("computes words per minute from elapsed time", () => {
    const { result } = render();
    // 9 words in 60s → 9 wpm.
    for (let i = 0; i < 3; i++) {
      act(() => {
        advance(20_000);
        result.current.nextSentence();
      });
    }
    act(() => result.current.answerQuestion(0));
    expect(result.current.summary?.words).toBe(9);
    expect(result.current.summary?.durationMs).toBe(60_000);
    expect(result.current.summary?.wpm).toBe(9);
  });
});

describe("questions", () => {
  it("scores a correct answer", () => {
    const { result } = render();
    for (let i = 0; i < 3; i++) act(() => result.current.nextSentence());
    act(() => result.current.answerQuestion(0));
    expect(result.current.summary?.questionsCorrect).toBe(1);
    expect(result.current.summary?.questionsTotal).toBe(1);
  });

  it("scores a wrong answer", () => {
    const { result } = render();
    for (let i = 0; i < 3; i++) act(() => result.current.nextSentence());
    act(() => result.current.answerQuestion(1));
    expect(result.current.summary?.questionsCorrect).toBe(0);
  });

  it("finishes straight away for a story with no questions", () => {
    const { result } = renderHook(
      () => useReadingRound({ ...STORY, questions: [] }),
      { wrapper: Wrap },
    );
    for (let i = 0; i < 3; i++) act(() => result.current.nextSentence());
    expect(result.current.phase).toBe("done");
    expect(result.current.summary?.questionsTotal).toBe(0);
  });
});

describe("persistence", () => {
  it("writes one session record on finish", () => {
    const { result } = render();
    for (let i = 0; i < 3; i++) {
      act(() => {
        advance(10_000);
        result.current.nextSentence();
      });
    }
    act(() => result.current.answerQuestion(0));

    const stored = sessions();
    expect(stored).toHaveLength(1);
    expect(stored[0].storyId).toBe("test-story");
    expect(stored[0].storyTitle).toBe("Test");
    expect(stored[0].level).toBe(2);
  });

  /**
   * The measurement guarantee: WPM over part of a story is a different number,
   * not a slower one, so an abandoned read must leave no trace in the history
   * or in the personal best.
   */
  it("writes nothing for a partial read", () => {
    const { result } = render();
    act(() => {
      advance(10_000);
      result.current.nextSentence();
    });
    expect(sessions()).toEqual([]);
    const progress = readProgress(getActiveProfileId() ?? "");
    expect(progress.read).toEqual([]);
    expect(progress.best).toEqual({});
  });

  /**
   * Same rule as a partial read: a run finished by tapping straight through is
   * not a slower measurement, it is not a measurement. Storing it would put an
   * unbeatable best on that story forever and flatten every real session in
   * the history trend, which is the one thing the module exists to show.
   */
  it("writes nothing for a read too fast to be real", () => {
    const { result } = render();
    for (let i = 0; i < 3; i++) {
      act(() => {
        advance(100);
        result.current.nextSentence();
      });
    }
    act(() => result.current.answerQuestion(0));

    expect(result.current.phase).toBe("done");
    expect(result.current.recorded).toBe(false);
    expect(sessions()).toEqual([]);
    const progress = readProgress(getActiveProfileId() ?? "");
    expect(progress.read).toEqual([]);
    expect(progress.best).toEqual({});
  });

  it("marks a normal read as recorded", () => {
    const { result } = render();
    for (let i = 0; i < 3; i++) {
      act(() => {
        advance(20_000);
        result.current.nextSentence();
      });
    }
    act(() => result.current.answerQuestion(0));
    expect(result.current.recorded).toBe(true);
  });

  it("records the story as read and stores the best", () => {
    const { result } = render();
    for (let i = 0; i < 3; i++) {
      act(() => {
        advance(20_000);
        result.current.nextSentence();
      });
    }
    act(() => result.current.answerQuestion(0));

    const progress = readProgress(getActiveProfileId() ?? "");
    expect(progress.read).toEqual(["test-story"]);
    expect(progress.best["test-story"]).toBe(9);
    expect(progress.streak).toBe(1);
  });

  it("reports a first read as not a re-read", () => {
    const { result } = render();
    expect(result.current.isReread).toBe(false);
    expect(result.current.previousBest).toBe(0);
  });

  it("reports a second read as a re-read, against the earlier best", () => {
    const first = render();
    for (let i = 0; i < 3; i++) {
      act(() => {
        advance(20_000);
        first.result.current.nextSentence();
      });
    }
    act(() => first.result.current.answerQuestion(0));
    expect(first.result.current.summary?.wpm).toBe(9);

    // A fresh mount is what "read it again" does.
    const second = render();
    expect(second.result.current.isReread).toBe(true);
    expect(second.result.current.previousBest).toBe(9);
  });

  it("keeps the better score when a re-read is slower", () => {
    const first = render();
    for (let i = 0; i < 3; i++) {
      act(() => {
        advance(20_000);
        first.result.current.nextSentence();
      });
    }
    act(() => first.result.current.answerQuestion(0));

    const second = render();
    for (let i = 0; i < 3; i++) {
      act(() => {
        advance(60_000);
        second.result.current.nextSentence();
      });
    }
    act(() => second.result.current.answerQuestion(0));

    expect(second.result.current.summary?.wpm).toBe(3);
    const progress = readProgress(getActiveProfileId() ?? "");
    expect(progress.best["test-story"]).toBe(9);
    expect(sessions()).toHaveLength(2);
  });

  it("keeps reading sessions out of the math session key", () => {
    const { result } = render();
    for (let i = 0; i < 3; i++) act(() => result.current.nextSentence());
    act(() => result.current.answerQuestion(0));

    const mathKey = profileKey(
      getActiveProfileId() ?? "",
      PROFILE_KEYS.sessions,
    );
    expect(localStorage.getItem(mathKey)).toBeNull();
  });
});
