# Testing Rules (§4)

Stack: Vitest + @testing-library/react + jsdom. Run `npm test` (full) or `npx vitest run <path>` (one file).

## §4.1 Coverage expectations [CONVENTION]
- Every `lib/` module has a co-located `*.test.ts`. New generator/template/parsing logic ships with tests in the same change.
- Pure logic is tested directly (no rendering). Hooks via `renderHook`/a small harness; components via RTL.

## §4.2 Generator tests [ENFORCED by existing suite]
- When adding or changing number/word generators, update the registry **count assertions** and **round-trip/whole-number assertions** (see `wordTemplates.test.ts`, `wordGen.test.ts`, `problemGen.test.ts`). A new template set means: a stratification test, a whole-number/round-trip test, and a bump to the "includes N templates" coverage test.

## §4.3 Component & hook tests [CONVENTION]
- Query by role/accessible name, not by test-id or class.
- Speech/voice: drive the fake recognizer (see `useSpeechRecognition.test.tsx`) — assert the callback contract (candidate list), interim state, and onend reset.

## §4.4 Green bar before done [ENFORCED]
- `npx tsc -b` clean AND `npm test` green AND `npm run check` clean on touched files before claiming completion. The pre-existing Whisper-file lint warnings are out of scope — don't "fix" hidden code to silence them.
