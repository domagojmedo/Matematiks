import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOptionKeys, useReadingKeys } from "./useReadingKeys";

afterEach(() => {
  document.body.innerHTML = "";
});

const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(window, { key, ...init });

describe("useReadingKeys", () => {
  const setup = (enabled = true) => {
    const next = vi.fn();
    renderHook(() => useReadingKeys({ enabled, next }));
    return { next };
  };

  it("advances on space, enter and right arrow", () => {
    const { next } = setup();
    press(" ");
    press("Enter");
    press("ArrowRight");
    expect(next).toHaveBeenCalledTimes(3);
  });

  it("ignores other keys", () => {
    const { next } = setup();
    press("a");
    press("Tab");
    press("ArrowUp");
    press("ArrowLeft");
    expect(next).not.toHaveBeenCalled();
  });

  /**
   * Holding a key down would otherwise run through a whole story in a second,
   * producing a reading speed the child never read at.
   */
  it("ignores auto-repeat", () => {
    const { next } = setup();
    press("ArrowRight", { repeat: true });
    press(" ", { repeat: true });
    expect(next).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const { next } = setup(false);
    press(" ");
    press("ArrowRight");
    expect(next).not.toHaveBeenCalled();
  });

  it("ignores modified keypresses", () => {
    const { next } = setup();
    press(" ", { ctrlKey: true });
    press("Enter", { metaKey: true });
    press("ArrowRight", { shiftKey: true });
    expect(next).not.toHaveBeenCalled();
  });

  /**
   * Not to stop a double advance — preventDefault already suppresses the
   * browser's synthetic click — but because the focused control may not be the
   * advance button. With the back button focused, Space has to activate that.
   */
  it("leaves space and enter to a focused button", () => {
    const { next } = setup();
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();

    press(" ");
    press("Enter");
    expect(next).not.toHaveBeenCalled();

    // Arrows have no native button behaviour, so they still work.
    press("ArrowRight");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("stops listening after unmount", () => {
    const next = vi.fn();
    const { unmount } = renderHook(() =>
      useReadingKeys({ enabled: true, next }),
    );
    unmount();
    press("ArrowRight");
    expect(next).not.toHaveBeenCalled();
  });
});

function Options({ enabled = true }: { enabled?: boolean }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useOptionKeys({ enabled, buttons });
  return (
    <div>
      {["maca", "mama", "Luka"].map((label, i) => (
        <button
          key={label}
          type="button"
          ref={(node) => {
            buttons.current[i] = node;
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

describe("useOptionKeys", () => {
  const focused = () => document.activeElement?.textContent;

  it("focuses the first option on the first down arrow", () => {
    render(<Options />);
    expect(focused()).not.toBe("maca");
    press("ArrowDown");
    expect(focused()).toBe("maca");
  });

  it("moves down and wraps", () => {
    render(<Options />);
    press("ArrowDown");
    press("ArrowDown");
    expect(focused()).toBe("mama");
    press("ArrowDown");
    expect(focused()).toBe("Luka");
    press("ArrowDown");
    expect(focused()).toBe("maca");
  });

  it("moves up from the end on the first up arrow", () => {
    render(<Options />);
    press("ArrowUp");
    expect(focused()).toBe("Luka");
    press("ArrowUp");
    expect(focused()).toBe("mama");
  });

  /**
   * Nothing is focused when the question appears: the child arrives here by
   * pressing Space on the last sentence, and a focused option would let a
   * second press answer before the question has been read.
   */
  it("focuses nothing until an arrow is pressed", () => {
    render(<Options />);
    expect(screen.getByRole("button", { name: "maca" })).not.toBe(
      document.activeElement,
    );
  });

  it("does nothing once answering is disabled", () => {
    render(<Options enabled={false} />);
    press("ArrowDown");
    expect(focused()).not.toBe("maca");
  });
});
