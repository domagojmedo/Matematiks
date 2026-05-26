/**
 * Regression coverage for the voice → submit flow. The whole feature hinges
 * on three contract points that are easy to break: the engine's onresult
 * delivers a final transcript to our callback, interim chunks land in the
 * `interim` state, and onend lets the consumer auto-restart. A real browser
 * mic can't be driven from tests, so we monkey-patch the global
 * SpeechRecognition class and synthesize the events the engine would fire.
 */
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSpeechRecognition } from "./useSpeechRecognition";

type FakeRecHandlers = {
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
};

let lastRec: (FakeRecHandlers & { lang: string; started: boolean }) | null;

class FakeRec implements FakeRecHandlers {
  lang = "";
  interimResults = false;
  continuous = false;
  maxAlternatives = 1;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  started = false;
  start() {
    this.started = true;
    lastRec = this;
  }
  stop() {
    if (this.onend) this.onend();
  }
  abort() {
    if (this.onend) this.onend();
  }
}

function buildResultEvent(transcript: string, isFinal: boolean) {
  return {
    resultIndex: 0,
    results: {
      length: 1,
      0: {
        isFinal,
        length: 1,
        0: { transcript, confidence: 0.9 },
      },
    },
  };
}

function Harness({
  lang,
  onResult,
  onError,
  exposeHook,
}: {
  lang: string;
  onResult: (t: string) => void;
  onError?: (e: string) => void;
  exposeHook: (h: ReturnType<typeof useSpeechRecognition>) => void;
}) {
  const hook = useSpeechRecognition({ lang, onResult, onError });
  useEffect(() => {
    exposeHook(hook);
  });
  return null;
}

describe("useSpeechRecognition", () => {
  beforeEach(() => {
    lastRec = null;
    (
      window as unknown as { SpeechRecognition: typeof FakeRec }
    ).SpeechRecognition = FakeRec;
    (
      window as unknown as { webkitSpeechRecognition: typeof FakeRec }
    ).webkitSpeechRecognition = FakeRec;
  });

  afterEach(() => {
    delete (window as unknown as { SpeechRecognition?: unknown })
      .SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
  });

  it("constructs a recognition instance and marks listening on start", () => {
    const hookRef: { current: ReturnType<typeof useSpeechRecognition> | null } =
      { current: null };
    render(
      <Harness
        lang="hr-HR"
        onResult={() => {}}
        exposeHook={(h) => {
          hookRef.current = h;
        }}
      />,
    );
    act(() => {
      hookRef.current?.start();
    });
    expect(lastRec).not.toBeNull();
    expect(lastRec?.started).toBe(true);
    expect(lastRec?.lang).toBe("hr-HR");
  });

  it("delivers a final transcript to the onResult callback", () => {
    const onResult = vi.fn();
    const hookRef: { current: ReturnType<typeof useSpeechRecognition> | null } =
      { current: null };
    render(
      <Harness
        lang="en-US"
        onResult={onResult}
        exposeHook={(h) => {
          hookRef.current = h;
        }}
      />,
    );
    act(() => {
      hookRef.current?.start();
    });
    act(() => {
      lastRec?.onresult?.(buildResultEvent("twenty three", true));
    });
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith("twenty three");
  });

  it("does not call onResult for interim chunks; exposes them as interim", () => {
    const onResult = vi.fn();
    const hookRef: { current: ReturnType<typeof useSpeechRecognition> | null } =
      { current: null };
    render(
      <Harness
        lang="hr-HR"
        onResult={onResult}
        exposeHook={(h) => {
          hookRef.current = h;
        }}
      />,
    );
    act(() => {
      hookRef.current?.start();
    });
    act(() => {
      lastRec?.onresult?.(buildResultEvent("dvadeset", false));
    });
    expect(onResult).not.toHaveBeenCalled();
    expect(hookRef.current?.interim).toBe("dvadeset");
  });

  it("clears interim once the final result lands", () => {
    const hookRef: { current: ReturnType<typeof useSpeechRecognition> | null } =
      { current: null };
    render(
      <Harness
        lang="hr-HR"
        onResult={() => {}}
        exposeHook={(h) => {
          hookRef.current = h;
        }}
      />,
    );
    act(() => {
      hookRef.current?.start();
    });
    act(() => {
      lastRec?.onresult?.(buildResultEvent("dvadeset", false));
    });
    expect(hookRef.current?.interim).toBe("dvadeset");
    act(() => {
      lastRec?.onresult?.(buildResultEvent("dvadeset tri", true));
    });
    expect(hookRef.current?.interim).toBe("");
  });

  it("tracks speechActive between onspeechstart and onspeechend", () => {
    const hookRef: { current: ReturnType<typeof useSpeechRecognition> | null } =
      { current: null };
    render(
      <Harness
        lang="hr-HR"
        onResult={() => {}}
        exposeHook={(h) => {
          hookRef.current = h;
        }}
      />,
    );
    act(() => {
      hookRef.current?.start();
    });
    expect(hookRef.current?.speechActive).toBe(false);
    act(() => {
      lastRec?.onspeechstart?.();
    });
    expect(hookRef.current?.speechActive).toBe(true);
    act(() => {
      lastRec?.onspeechend?.();
    });
    expect(hookRef.current?.speechActive).toBe(false);
  });

  it("forwards permission errors to onError", () => {
    const onError = vi.fn();
    const hookRef: { current: ReturnType<typeof useSpeechRecognition> | null } =
      { current: null };
    render(
      <Harness
        lang="hr-HR"
        onResult={() => {}}
        onError={onError}
        exposeHook={(h) => {
          hookRef.current = h;
        }}
      />,
    );
    act(() => {
      hookRef.current?.start();
    });
    act(() => {
      lastRec?.onerror?.({ error: "not-allowed" });
    });
    expect(onError).toHaveBeenCalledWith("not-allowed");
  });

  it("clears listening and interim on onend so the auto-restart effect can refire", () => {
    const hookRef: { current: ReturnType<typeof useSpeechRecognition> | null } =
      { current: null };
    render(
      <Harness
        lang="hr-HR"
        onResult={() => {}}
        exposeHook={(h) => {
          hookRef.current = h;
        }}
      />,
    );
    act(() => {
      hookRef.current?.start();
    });
    expect(hookRef.current?.listening).toBe(true);
    act(() => {
      lastRec?.onresult?.(buildResultEvent("deset", false));
    });
    expect(hookRef.current?.interim).toBe("deset");
    act(() => {
      lastRec?.onend?.();
    });
    expect(hookRef.current?.listening).toBe(false);
    expect(hookRef.current?.interim).toBe("");
    expect(hookRef.current?.speechActive).toBe(false);
  });
});
