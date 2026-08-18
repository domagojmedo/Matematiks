import { findLesson, isWordLesson } from "./lessons";
import { isWordSetup, type SessionRecord } from "./types";

/** The bits of a session needed to replay it — a full record works too. */
export type ReplayableSession = Pick<
  SessionRecord,
  "operation" | "setup" | "lessonId"
>;

/** Router state the practice screens read to rebuild the exact same round. */
export type ReplayState = {
  setup: SessionRecord["setup"];
  lessonId?: string;
  title?: string;
} | null;

export type Replay = { to: string; state: ReplayState };

/**
 * Where "play this round again" navigates to, with the state that reproduces
 * the recorded setup. Single source of truth for the Summary "play again"
 * button and the history screens' repeat buttons.
 */
export function replayRound(session: ReplayableSession): Replay {
  const lesson = session.lessonId ? findLesson(session.lessonId) : undefined;

  if (isWordSetup(session.setup)) {
    // A resolvable word lesson gets its setup from `findLesson(id)`, so no
    // router state is needed (and none is wanted — the lesson is the truth).
    if (isWordLesson(lesson)) {
      return { to: `/word-practice/${lesson.id}`, state: null };
    }
    // Combined multi-select rounds (lessonId "combined") and word lessons that
    // left the catalog replay from the saved setup instead: it carries the
    // wordKinds / lessonIds the round was generated from.
    return {
      to: `/word-practice/${session.lessonId ?? "combined"}`,
      state: { setup: session.setup, title: "lessons.combined" },
    };
  }

  // Arithmetic: forward the played setup so custom ranges, time mode and
  // crossesTen filters survive; lessonId only when the round was tagged.
  return {
    to: `/practice/${session.operation}`,
    state: {
      setup: session.setup,
      ...(lesson ? { lessonId: lesson.id } : {}),
    },
  };
}
