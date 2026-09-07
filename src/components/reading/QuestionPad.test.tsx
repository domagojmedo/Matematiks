import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReadingQuestion } from "../../lib/reading/readingTypes";
import { THEMES } from "../../lib/themes";
import { QuestionPad } from "./QuestionPad";

const theme = THEMES.warmPurple;

// This repo does not auto-clean between tests; without this the renders
// accumulate and every query matches several elements.
afterEach(cleanup);

const QUESTION: ReadingQuestion = {
  prompt: "Tko ima loptu?",
  options: ["maca", "mama", "Luka"],
  expectedIndex: 0,
};

const setup = (onAnswer = vi.fn(), question = QUESTION) => {
  render(
    <QuestionPad
      question={question}
      index={0}
      total={2}
      progressLabel="Pitanje"
      onAnswer={onAnswer}
      theme={theme}
      uppercase={false}
    />,
  );
  return onAnswer;
};

describe("QuestionPad", () => {
  it("shows the prompt and every option", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Tko ima loptu?" }),
    ).toBeDefined();
    for (const option of QUESTION.options) {
      expect(screen.getByRole("button", { name: option })).toBeDefined();
    }
  });

  /**
   * The child taps the option, not an index — so the pad must report the index
   * of the option *as authored*, however it shuffled them for display.
   * Getting this wrong would score correct answers as wrong.
   */
  it("reports the original index of the tapped option", async () => {
    const onAnswer = setup();
    fireEvent.click(screen.getByRole("button", { name: "Luka" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(2));
  });

  it("reports the correct answer's index when it is tapped", async () => {
    const onAnswer = setup();
    fireEvent.click(screen.getByRole("button", { name: "maca" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(0));
  });

  it("ignores further taps once one is made", async () => {
    const onAnswer = setup();
    fireEvent.click(screen.getByRole("button", { name: "mama" }));
    // Every option disables on reveal, so a fast double-tap cannot double-score.
    for (const option of QUESTION.options) {
      expect(
        screen.getByRole("button", { name: option }).hasAttribute("disabled"),
      ).toBe(true);
    }
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
  });

  it("renders the options in some order without dropping any", () => {
    setup();
    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect([...labels].sort()).toEqual([...QUESTION.options].sort());
  });

  it("switches letterform without changing the text", () => {
    render(
      <QuestionPad
        question={QUESTION}
        index={0}
        total={1}
        progressLabel="Pitanje"
        onAnswer={vi.fn()}
        theme={theme}
        uppercase
      />,
    );
    const option = screen.getByRole("button", { name: "maca" });
    expect(option.className).toContain("uppercase");
    expect(option.textContent).toBe("maca");
  });

  /**
   * The reveal is delayed 900ms so the child sees the answer land. If the round
   * is left within that window, the pending callback must not still fire —
   * answering the last question and then tapping Izađi would otherwise finish
   * the round and save the session, contradicting the leave dialog's promise
   * that the story would not be saved.
   */
  it("cancels the pending reveal when unmounted", () => {
    vi.useFakeTimers();
    try {
      const onAnswer = vi.fn();
      const { unmount } = render(
        <QuestionPad
          question={QUESTION}
          index={0}
          total={1}
          progressLabel="Pitanje"
          onAnswer={onAnswer}
          theme={theme}
          uppercase={false}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "maca" }));
      unmount();
      vi.advanceTimersByTime(2000);
      expect(onAnswer).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
