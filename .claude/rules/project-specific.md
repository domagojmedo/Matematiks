# Project-Specific Rules (§9)

Patterns unique to Matematiks — the things most often gotten wrong.

## §9.1 i18n parity [ENFORCED by §0.4]
- Every UI string is a `t("…")` key present in BOTH `src/i18n/locales/hr.json` and `src/i18n/locales/en.json`. Never hardcode Croatian (or English) copy in components.
- Word-problem and unit-conversion lessons are **HR-only by design** via the `languages: ["hr"]` field on the lesson (default in the `word()` helper). Their `nameKey` lives only in `hr.json` — that's intentional, not a missing translation.

## §9.2 Lessons are declarative [CONVENTION]
- Add practice content in `src/lib/lessons.ts` (`arith({…})` or `word({…})`) with a `nameKey`, reusing `problemGen` (arithmetic) or the word/convert template engine (`wordTemplates.ts`). Don't fork a new screen for a new lesson.
- New unit conversions follow the `buildConvertTemplate` pattern (fixed from/to units, `expand`/`compress` factor, whole-number source) and register in `TEMPLATES`, `TEMPLATES_BY_TYPE`, and a `WordKind`.

## §9.3 Whole-number guarantee [ENFORCED by §0.3 + tests]
- Operands AND answers are always integers. Conversions cap the small-count side (≤10) and make the big side an exact multiple so division stays whole. Keep a test asserting this for any new generator.

## §9.4 Storage is a schema [CONVENTION]
- `localStorage` shapes (profiles, sessions, last-session, per-op setup) are persisted on real kids' devices. Changing a key or shape without a migration silently wipes saved progress — add/version-guard reads in `storage.ts` when shapes change.

## §9.5 Voice is intentionally constrained [ENFORCED by §0.2]
- Live recognition is Web Speech only; Whisper stays hidden (`SHOW_WHISPER_TOGGLE = false`).
- The auto-listen ↔ flash ↔ round-advance timing is delicate (MIUI mic-chime loop). Bounded retries per problem/phase exist for a reason — don't make auto-listen depend on `listening` without a cap.
- `useEffect` deps that intentionally re-trigger on `problem`/`currentPhase` need a `// biome-ignore lint/correctness/useExhaustiveDependencies: …` note (Biome flags them otherwise).
