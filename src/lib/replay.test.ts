import { describe, expect, it } from "vitest";
import { replayRound } from "./replay";
import { SetupKind, type WordLessonSetup } from "./types";

describe("replayRound", () => {
  it("replays a free-play arith round with its own setup", () => {
    const setup = {
      kind: SetupKind.Range,
      min: 3,
      max: 40,
      rounds: 30,
    } as const;
    expect(replayRound({ operation: "add", setup })).toEqual({
      to: "/practice/add",
      state: { setup },
    });
  });

  it("keeps the lesson tag when the session came from a lesson", () => {
    const setup = {
      kind: SetupKind.Range,
      min: 1,
      max: 10,
      rounds: 20,
    } as const;
    expect(
      replayRound({ operation: "add", setup, lessonId: "g1-add-10" }),
    ).toEqual({
      to: "/practice/add",
      state: { setup, lessonId: "g1-add-10" },
    });
  });

  it("drops a lesson tag that no longer resolves", () => {
    const setup = {
      kind: SetupKind.Range,
      min: 1,
      max: 10,
      rounds: 20,
    } as const;
    expect(
      replayRound({ operation: "add", setup, lessonId: "removed-lesson" }),
    ).toEqual({ to: "/practice/add", state: { setup } });
  });

  it("routes a word lesson to its own screen without router state", () => {
    expect(
      replayRound({
        operation: "add",
        setup: { kind: SetupKind.Word, wordKinds: ["vocab"], rounds: 10 },
        lessonId: "g1-word-vocab",
      }),
    ).toEqual({ to: "/word-practice/g1-word-vocab", state: null });
  });

  it("replays a combined round from its saved setup", () => {
    const setup: WordLessonSetup = {
      kind: SetupKind.Word,
      wordKinds: ["vocab"],
      rounds: 15,
      lessonIds: ["g1-word-vocab", "g1-add-10"],
    };
    expect(
      replayRound({ operation: "add", setup, lessonId: "combined" }),
    ).toEqual({
      to: "/word-practice/combined",
      state: { setup, title: "lessons.combined" },
    });
  });
});
