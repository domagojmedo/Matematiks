# Architecture Rules (§2)

Descriptive of the patterns actually in this repo. See `.claude/references/architecture-principles.md` for the full audit.

## §2.1 Layer boundaries [ENFORCED by §0.3]
- `src/lib/` — pure, framework-free logic (problem/word generation, lessons, operations, speech parsing, storage, themes, declension). No React, no DOM, no `window`. Each module has a co-located `*.test.ts`.
- `src/routes/` — one screen per file (PascalCase). Composes hooks + components; owns navigation and per-screen state.
- `src/components/` — shared, reusable UI (PascalCase). No business logic.
- `src/contexts/` — cross-cutting app state (`SettingsContext`, `ProfilesContext`).
- `src/hooks/` — stateful behavior shared across screens (`useRoundMechanics`, `useSpeechRecognition`, per-problem reset). May touch DOM/timers; still unit-tested where practical.
- `src/i18n/`, `src/workers/`, `src/audio/` — translations, the (hidden) Whisper worker, and the PCM capture worklet.

## §2.2 Content-driven model [CONVENTION]
New practice content is **data**, not new screens. A problem type is: a type in `src/lib/wordTypes.ts` (or a new `lib/` types module) → a generator/template in `lib/` → a declarative entry in `src/lib/lessons.ts` (+ `nameKey` in both locales). The practice UI renders generically off the generated phases — prefer extending the data model over adding bespoke screens.

## §2.3 Phase-based rendering [CONVENTION]
Word/column problems are a flat ordered list of phases (`pickOp` / `answer` / `convert`). UI advances one phase at a time and reads the active phase polymorphically. A genuinely new interaction (e.g. tap-a-sign, shade-a-shape) means a new phase kind + its renderer — keep the phase list as the single source of truth.

## §2.4 Persistence [CONVENTION]
All persisted state goes through `src/lib/storage.ts` (`readJSON`/`writeJSON`/`profileKey`) keyed per profile. There is no server. Treat stored shapes as a schema — see §9.3.
