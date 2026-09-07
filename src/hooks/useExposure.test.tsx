import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXPOSURE_STEPS, useExposure } from "./useExposure";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useExposure", () => {
  it("starts visible and hides after the window", () => {
    const { result } = renderHook(() =>
      useExposure({ exposureMs: 1000, cardKey: "a" }),
    );
    expect(result.current.phase).toBe("flash");
    expect(result.current.visible).toBe(true);

    act(() => void vi.advanceTimersByTime(999));
    expect(result.current.phase).toBe("flash");

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.phase).toBe("recall");
    expect(result.current.visible).toBe(false);
  });

  it("shows the card again when revealed", () => {
    const { result } = renderHook(() =>
      useExposure({ exposureMs: 500, cardKey: "a" }),
    );
    act(() => void vi.advanceTimersByTime(500));
    expect(result.current.visible).toBe(false);

    act(() => result.current.reveal());
    expect(result.current.phase).toBe("check");
    expect(result.current.visible).toBe(true);
  });

  it("restarts on the next card", () => {
    const { result, rerender } = renderHook(
      ({ cardKey }) => useExposure({ exposureMs: 500, cardKey }),
      { initialProps: { cardKey: "a" } },
    );
    act(() => void vi.advanceTimersByTime(500));
    act(() => result.current.reveal());
    expect(result.current.phase).toBe("check");

    rerender({ cardKey: "b" });
    expect(result.current.phase).toBe("flash");
    expect(result.current.visible).toBe(true);
  });

  it("stays visible when exposure is off", () => {
    const { result } = renderHook(() =>
      useExposure({ exposureMs: 0, cardKey: "a" }),
    );
    expect(result.current.phase).toBe("check");
    expect(result.current.visible).toBe(true);

    act(() => void vi.advanceTimersByTime(10_000));
    expect(result.current.visible).toBe(true);
  });

  it("switches to always-visible when exposure is turned off mid-run", () => {
    const { result, rerender } = renderHook(
      ({ exposureMs }) => useExposure({ exposureMs, cardKey: "a" }),
      { initialProps: { exposureMs: 500 } },
    );
    act(() => void vi.advanceTimersByTime(500));
    expect(result.current.visible).toBe(false);

    rerender({ exposureMs: 0 });
    expect(result.current.visible).toBe(true);
  });

  it("does not fire a stale timer after unmount", () => {
    const { unmount } = renderHook(() =>
      useExposure({ exposureMs: 500, cardKey: "a" }),
    );
    unmount();
    // A leaked timeout would try to set state on an unmounted hook.
    expect(() => act(() => void vi.advanceTimersByTime(1000))).not.toThrow();
  });

  it("offers off plus progressively shorter windows", () => {
    expect(EXPOSURE_STEPS[0]).toBe(0);
    const timed = EXPOSURE_STEPS.slice(1);
    for (let i = 1; i < timed.length; i++) {
      expect(timed[i]).toBeLessThan(timed[i - 1]);
    }
  });
});
