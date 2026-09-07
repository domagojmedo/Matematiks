import { useEffect } from "react";

/**
 * Keyboard control for the reading screens.
 *
 *   Space / Enter / →   advance
 *   ←                   re-read the current line (a stumble)
 *
 * Three details matter more than the mapping:
 *
 * **Key repeat is ignored.** Holding Space would otherwise blast through a
 * whole story in a second — producing a reading speed the child never read at,
 * and a pile of near-zero sentence timings.
 *
 * **Space and Enter stand down when a control has focus.** Not to avoid a
 * double advance — `preventDefault` already suppresses the browser's synthetic
 * click — but because the focused control may not be the advance button at
 * all. Clicking "Ponovi" leaves it focused; a following Space has to re-read
 * the line, and without this check it would advance instead and swallow the
 * button's own activation. Arrow keys have no native button behaviour, so they
 * are always handled.
 *
 * **Space is prevented from scrolling.** It is the default page-scroll key, and
 * a story that jumps down the page on every advance is unreadable.
 */
export function useReadingKeys({
  enabled,
  next,
  repeat,
}: {
  /** False while a dialog is open or the round is finished. */
  enabled: boolean;
  next?: () => void;
  repeat?: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const active = document.activeElement;
      const onControl =
        active instanceof HTMLElement &&
        (active.tagName === "BUTTON" ||
          active.tagName === "A" ||
          active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable);

      switch (event.key) {
        case " ":
        case "Enter":
          if (onControl) return;
          event.preventDefault();
          next?.();
          return;
        case "ArrowRight":
          event.preventDefault();
          next?.();
          return;
        case "ArrowLeft":
          event.preventDefault();
          repeat?.();
          return;
        default:
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, next, repeat]);
}

/**
 * Arrow-key movement between a question's options.
 *
 * This moves DOM *focus* rather than tracking a selected index, so activation
 * stays with the browser: Enter and Space on a focused button already work, and
 * screen readers announce the move for free.
 *
 * Nothing is focused when the question first appears, deliberately. The child
 * reaches this screen by pressing Space on the last sentence; auto-focusing an
 * option would let a second press answer the question before it has been read.
 */
export function useOptionKeys({
  enabled,
  buttons,
}: {
  enabled: boolean;
  buttons: React.RefObject<(HTMLButtonElement | null)[]>;
}) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      const options = (buttons.current ?? []).filter(
        (button): button is HTMLButtonElement => button !== null,
      );
      if (options.length === 0) return;

      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const current = options.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const target =
        current === -1
          ? step === 1
            ? 0
            : options.length - 1
          : (current + step + options.length) % options.length;
      options[target].focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, buttons]);
}
