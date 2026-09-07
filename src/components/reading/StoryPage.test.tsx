import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEMES } from "../../lib/themes";
import { StoryPage, VerdictPad } from "./StoryPage";

const theme = THEMES.warmPurple;

// This repo does not auto-clean between tests; without this the renders
// accumulate and every query matches several elements.
afterEach(cleanup);

const PARAGRAPHS = [["Maca je mala.", "Maca ima loptu."], ["Mama zove macu."]];

/**
 * The page shows the whole story at once and marks one sentence current. The
 * current sentence carries `data-current`, which is the only structural hook
 * the tests rely on — everything else is asserted through visible text.
 */
const currentText = (container: HTMLElement) =>
  container.querySelector("[data-current]")?.textContent?.trim();

describe("StoryPage", () => {
  it("renders every sentence, not just the current one", () => {
    render(
      <StoryPage
        paragraphs={PARAGRAPHS}
        currentIndex={0}
        theme={theme}
        dark={false}
        uppercase={false}
      />,
    );
    expect(screen.getByText(/Maca je mala\./)).toBeDefined();
    expect(screen.getByText(/Maca ima loptu\./)).toBeDefined();
    expect(screen.getByText(/Mama zove macu\./)).toBeDefined();
  });

  it("marks the current sentence, counting across paragraphs", () => {
    const { container, rerender } = render(
      <StoryPage
        paragraphs={PARAGRAPHS}
        currentIndex={0}
        theme={theme}
        dark={false}
        uppercase={false}
      />,
    );
    expect(currentText(container)).toBe("Maca je mala.");

    // Index 2 lives in the second paragraph — the flat index must not reset.
    rerender(
      <StoryPage
        paragraphs={PARAGRAPHS}
        currentIndex={2}
        theme={theme}
        dark={false}
        uppercase={false}
      />,
    );
    expect(currentText(container)).toBe("Mama zove macu.");
  });

  it("marks exactly one sentence as current", () => {
    const { container } = render(
      <StoryPage
        paragraphs={PARAGRAPHS}
        currentIndex={1}
        theme={theme}
        dark={false}
        uppercase={false}
      />,
    );
    expect(container.querySelectorAll("[data-current]")).toHaveLength(1);
  });

  it("marks nothing when the index is past the end", () => {
    const { container } = render(
      <StoryPage
        paragraphs={PARAGRAPHS}
        currentIndex={99}
        theme={theme}
        dark={false}
        uppercase={false}
      />,
    );
    expect(container.querySelectorAll("[data-current]")).toHaveLength(0);
  });

  /**
   * Uppercase is a CSS transform so the real text stays in the DOM — that is
   * what keeps screen readers and copy-paste correct, and it is why this test
   * asserts the class rather than the rendered glyphs.
   */
  it("switches letterform without changing the underlying text", () => {
    const { container } = render(
      <StoryPage
        paragraphs={PARAGRAPHS}
        currentIndex={0}
        theme={theme}
        dark={false}
        uppercase
      />,
    );
    expect(container.firstElementChild?.className).toContain("uppercase");
    expect(screen.getByText(/Maca je mala\./)).toBeDefined();
  });

  it("does not apply the transform in sentence case", () => {
    const { container } = render(
      <StoryPage
        paragraphs={PARAGRAPHS}
        currentIndex={0}
        theme={theme}
        dark={false}
        uppercase={false}
      />,
    );
    expect(container.firstElementChild?.className).not.toContain("uppercase");
  });
});

describe("VerdictPad", () => {
  it("advances when tapped", () => {
    const onNext = vi.fn();
    render(<VerdictPad onNext={onNext} nextLabel="Dalje" theme={theme} />);
    fireEvent.click(screen.getByRole("button", { name: "Dalje" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("offers exactly one button", () => {
    // A second "mark this line" button used to sit here and change nothing on
    // screen, so it read as broken.
    render(<VerdictPad onNext={vi.fn()} nextLabel="Dalje" theme={theme} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
