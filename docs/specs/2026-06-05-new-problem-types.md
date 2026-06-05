# Spec — New Problem Types (6-Tier Lesson Roadmap)

> Date: 2026-06-05 · Slug: `new-problem-types` · Scope: **new-feature** (large / multi-batch program)
> Workflow: `wf-20260605T080149Z-991f60`

## Summary

Expand Matematiks from ~90% Domain A (arithmetic) coverage to the full Croatian 1.–4. razred curriculum (NN 7/2019) by adding new **problem types** across six tiers. The work extends the existing data-driven model — new phase kinds + generators/templates + declarative lessons — rather than adding bespoke screens, per architecture rules §2.2/§2.3. Tiers 1–3 reuse/extend existing engines; tiers 4–6 introduce new visual UI components (fractions, shape diagrams, charts).

Curriculum gap analysis and tier rationale are recorded in project memory (`project-lesson-roadmap`) and validated against textbook TOCs. This spec turns that roadmap into a file-level plan.

**Isolation (branch-based):** All work lands on a long-lived `lab` branch; `master` stays the shippable working app, untouched until a tier is promoted. `lab` deploys as a separate beta site for live testing. Because the branch provides isolation, new lessons register normally into `LESSONS` (no in-app flag or experimental tag needed). Each tier is kept as a clean commit boundary so it can be promoted to `master` independently (merge/cherry-pick) when ready. Beta-deploy wiring is a separate ops task, out of scope here.

## Success criteria

| ID | Outcome | Verification |
|---|---|---|
| SC1 | Length (mm/cm/dm/m/km), money (€/cent), and time (s/min/h, day, week) conversion lessons exist and generate whole-number problems | `wordTemplates.test.ts`, `wordGen.test.ts` new suites green |
| SC2 | Word problems exist for grades 2–4 with grade-scoped number ranges, including ×/÷ story problems | `wordGen.test.ts` range-scoping test; `wordTemplates.test.ts` mul/div templates |
| SC3 | Number-sense lessons (comparison `>/=/<`, rounding, parts-of-a-whole, place value) are playable via new phase kinds | new `compare`/`solve` phase tests in `wordTypes.test.ts`; component tests |
| SC4 | Formal fraction lessons (g4) render a visual and accept answers | `FractionVisual` component test; fraction template test |
| SC5 | Perimeter & area lessons (g3/g4) render a shape diagram and compute correctly | `ShapeDiagram` test; perimeter/area template tests |
| SC6 | Geometry recognition, data/bar-chart reading, and probability-vocab lessons are playable | `choice` phase tests; chart-read component test |
| SC7 | Every new lesson has a `nameKey` present in `hr.json` (HR-only lessons) and the app builds with `tsc -b` clean and full `npm test` green | `npm run build`, `npm test`, `npm run check` |
| SC8 | All generators yield integer-only operands AND answers; money uses **euro** | whole-number assertions in each new template suite |

## Architecture and design

### Spine: extend the phase-based interactive model
The existing model (`src/lib/wordTypes.ts`) is a flat ordered `WordPhase[]` rendered one step at a time by `WordPractice.tsx`. Phases today: `pickOp`, `answer`, `convert`. New problem types are added as **new phase kinds** + a generic renderer, not new screens:

- `solve` — prompt-driven single numeric answer (prose carries the question, kid types `expected`). Covers rounding, parts-of-a-whole, perimeter/area, chart-read, and any future single-answer prompt. Generalizes the `convert` phase shape.
- `compare` — `{ a, b, expected: "<" | "=" | ">" }`, rendered with a 3-button pad.
- `choice` — `{ prompt, options[], expectedIndex }`, rendered as a tap-one-of-N pad. Covers shape/solid recognition and probability vocabulary.
- `fraction` — `{ parts, shaded, expected }` with a visual; tier 4.

### Generation context (range scoping)
`WordTemplate.generate()` currently takes no args. Add an optional `GenContext` (`{ maxNumber?: number }`) threaded from `WordLessonSetup` through `WordGenerator` so the same template family scales by grade (Tier 2). Backward compatible — existing templates ignore it or read a default.

### Operator extension (Tier 2)
`WordAnswerPhase.op` and `WordPickOpPhase.expected` extend from `"+" | "-"` to include `"*" | "/"`. `WordPractice` renders the new glyphs; mul/div word problems use a no-pickOp single `answer` step.

### Conversions (Tier 1) reuse `buildConvertTemplate`
New `Unit` members (`LengthUnit`, `MoneyUnit`, `TimeUnit`) plug into the existing `buildConvertTemplate(from, to, pickValue, factor, direction, family)` with the same whole-number guarantee (small side ≤10, big side = exact multiple). New `WordKind`s: `convertLength`, `convertMoney`, `convertTime`. Money uses `€`/`c` (euro), never kuna.

### Visual components (Tiers 4–6)
New presentational components in `src/components/`: `FractionVisual` (divided shape / number line), `ShapeDiagram` (rectangle/square with side labels), `ShapeGlyphs` (SVG solids/2D shapes for recognition), `MiniBarChart` (read-only bar chart). All pure/presentational, driven by phase data.

### Lessons stay declarative
Every new lesson is an entry in `src/lib/lessons.ts` (`word({...})`, HR-only via `languages`) with a `nameKey` in `hr.json`. `WordKind` union grows; `operations.ts` `isConvertKind`/`wordChip` updated for new families.

## Security and compliance impact

`security_impact: none`. Client-only SPA, no auth, no secrets, no network. The only persisted personal data is a local profile name in `localStorage` (no exposure). **Data-integrity note (not security):** new lessons must not change existing persisted shapes (profiles/sessions) — additive only (rule §9.4).

## Change manifest

See JSON sidecar for the authoritative per-file list. Summary by tier:

**Batch 0 — Foundation (model + UI extension points)**
- `src/lib/wordTypes.ts` (modify) — add `solve`/`compare`/`choice` phase kinds, `GenContext`, op union `*`/`/`; extend `buildSteps`/`phaseAtStep`/`finalInputPhase`.
- `src/lib/wordGen.ts` (modify) — thread `GenContext` into `generate()`.
- `src/components/PracticeUI.tsx` (modify) — `ComparePad`, `ChoicePad`, step-line renderers for new phases.
- `src/routes/WordPractice.tsx` (modify) — handlers for `compare`/`choice`/`solve`; glyphs for `*`/`/`.
- `src/lib/operations.ts` (modify) — chips for new word kinds.
- `src/lib/wordTypes.test.ts` (modify) — buildSteps/phase coverage for new kinds.

**Batch 1 — Tier 1 conversions (length/money/time)**
- `src/lib/wordTypes.ts` (modify) — `LengthUnit`/`MoneyUnit`/`TimeUnit`.
- `src/lib/wordTemplates.ts` (modify) — length/money/time convert templates + registry.
- `src/lib/types.ts` (modify) — `WordKind`: `convertLength`/`convertMoney`/`convertTime` (+ optional `convertMixMeasure`).
- `src/lib/wordGen.ts` (modify) — `poolFor` for new kinds.
- `src/lib/operations.ts` (modify) — `isConvertKind` includes new kinds.
- `src/lib/lessons.ts` (modify) — `g2-units-money`, `g3-units-length`, `g3-units-time`.
- `src/i18n/locales/hr.json` (modify) — nameKeys.
- `src/lib/wordTemplates.test.ts`, `src/lib/wordGen.test.ts` (modify) — suites + count bumps.

**Batch 2 — Tier 2 word problems g2–4 + ×/÷**
- `src/lib/wordTemplates.ts` (modify) — mul/div vocab+story+missing-factor templates; range-aware generate.
- `src/lib/wordTypes.ts` (modify) — `GenContext.maxNumber` usage.
- `src/lib/types.ts` (modify) — `WordLessonSetup.maxNumber?`; new mul/div word kinds if needed.
- `src/lib/lessons.ts` (modify) — `g2/g3/g4-word-*` lessons with ranges.
- `src/i18n/locales/hr.json` (modify), test files (modify).

**Batch 3 — Tier 3 number sense**
- `src/lib/wordTemplates.ts` (modify) — comparison, rounding, parts-of-a-whole, place-value (as `solve` steps) templates.
- `src/lib/types.ts` (modify) — kinds `compare`, `placeValue`, `rounding`, `partsOfWhole`.
- `src/components/PracticeUI.tsx` (modify) — finalize ComparePad styling.
- `src/lib/lessons.ts`, `src/i18n/locales/hr.json`, test files (modify).

**Batch 4 — Tier 4 fractions (g4)**
- `src/components/FractionVisual.tsx` (create) + `.test.tsx` (create).
- `src/lib/wordTypes.ts` (modify) — `fraction` phase.
- `src/lib/wordTemplates.ts`, `src/lib/types.ts`, `src/lib/lessons.ts`, `src/i18n/locales/hr.json`, test files (modify).
- `src/routes/WordPractice.tsx` (modify) — render fraction phase.

**Batch 5 — Tier 5 perimeter & area (g3/g4)**
- `src/components/ShapeDiagram.tsx` (create) + `.test.tsx` (create).
- `src/lib/wordTemplates.ts` (modify) — perimeter/area `solve` templates.
- `src/lib/types.ts`, `src/lib/lessons.ts`, `src/i18n/locales/hr.json`, `src/routes/WordPractice.tsx`, test files (modify).

**Batch 6 — Tier 6 geometry recognition + data + probability**
- `src/components/ShapeGlyphs.tsx` (create), `src/components/MiniBarChart.tsx` (create) + tests (create).
- `src/lib/wordTemplates.ts` (modify) — `choice` templates (shapes, probability), chart-read `solve` templates.
- `src/lib/types.ts`, `src/lib/lessons.ts`, `src/i18n/locales/hr.json`, `src/routes/WordPractice.tsx`, test files (modify).

## Test manifest

| Test file | Covers |
|---|---|
| `src/lib/wordTypes.test.ts` | SC3 — buildSteps/phaseAtStep for `solve`/`compare`/`choice`/`fraction` |
| `src/lib/wordTemplates.test.ts` | SC1, SC2, SC3, SC5, SC6, SC8 — every new template family: whole-number + shape assertions + registry counts |
| `src/lib/wordGen.test.ts` | SC1, SC2 — stratification per new kind; `GenContext` range scoping |
| `src/components/FractionVisual.test.tsx` | SC4 |
| `src/components/ShapeDiagram.test.tsx` | SC5 |
| `src/components/MiniBarChart.test.tsx` | SC6 |
| (manual) `npm run build` + `npm test` + `npm run check` | SC7 |

## Implementation batches

0. **Foundation** — phase kinds + GenContext + generic renderers/pads + operator extension. No new lessons yet; ships with phase-plumbing tests.
1. **Tier 1 conversions** — length/money/time. (Pure reuse; lowest risk.)
2. **Tier 2 word problems g2–4 + ×/÷** — templates + range scoping + per-grade lessons.
3. **Tier 3 number sense** — comparison / rounding / parts-of-whole / place value.
4. **Tier 4 fractions** — `FractionVisual` + fraction phase.
5. **Tier 5 perimeter & area** — `ShapeDiagram` + solve templates.
6. **Tier 6 geometry/data/probability** — `ShapeGlyphs`/`MiniBarChart` + `choice` templates.

Each batch: implement in-manifest files → add/update tests → `npx tsc -b` + `npm test` + `npm run check` on touched files → check off in `tasks/todo.md`.

## Requirements

### Ubiquitous
- The system shall generate every operand and every answer as a whole integer for all new problem types.
- The system shall express monetary values in euro (`€` / `c`), never kuna.
- The system shall keep every new lesson's `nameKey` present in `src/i18n/locales/hr.json`.

### Event-driven
- When a conversion lesson generates a problem, the system shall cap the small-count side at 10 and set the large side to an exact multiple of the factor.
- When a number-sense comparison problem is generated, the system shall produce exactly one correct relation among `<`, `=`, `>`.
- When the active stack build runs, the system shall pass `tsc -b`, `npm test`, and `npm run check` on touched files before a batch is marked complete.

### State-driven
- While a `solve`/`compare`/`choice`/`fraction` phase is active, the system shall accept input only through that phase's renderer and ignore input meant for other phase kinds.

### Optional
- Where a lesson declares a `maxNumber` in its setup, the system may scale generated number ranges to that bound.

### Unwanted behaviours
- If a new lesson would change an existing persisted `localStorage` shape (profiles/sessions/setup), then the system shall instead make the change additive and leave existing shapes readable.
- If a generated division/conversion would produce a non-integer answer, then the system shall reject that candidate and resample.

## Constitution Check

| Rule | How this design satisfies it |
|---|---|
| §0.1 (no commit/push without ask) | Workflow stops at approval gate; no commits during planning. |
| §0.2 (never un-hide Whisper) | No change touches the voice/Whisper stack. |
| §0.3 (lib pure + integer-only generators) | All new generators live in `lib/`, framework-free, with whole-number guarantees + tests (SC8, Requirements). |
| §0.4 (hr/en i18n parity; word lessons HR-only) | New lessons are HR-only via `languages`; nameKeys added to `hr.json` (SC7). |
| §2.2/§2.3 (content-driven, phase-based) | New types = new phase kinds + templates + declarative lessons, not new screens. |
| §9.4 (storage is a schema) | Spec forbids non-additive persisted-shape changes (Unwanted behaviours). |

## Risks and assumptions

**Assumptions**
- Branch isolation (`lab`) means new lessons can register directly into `LESSONS` without an in-app flag; `master` remains the working app and is only updated by per-tier promotion.
- The phase-based model is the right extension point for all six tiers (confirmed by §2.3). 
- `buildConvertTemplate`'s whole-number contract generalizes to length/money/time factors (10/100/1000/60/24/7) — verified: all integer factors with capped small side stay whole.
- HR-only is acceptable for all new content (matches existing word/convert lessons).

**Risks**
- **Tiers 4–6 manifests are higher-uncertainty** (per the granularity decision): new visual components (`FractionVisual`, `ShapeDiagram`, `ShapeGlyphs`, `MiniBarChart`) may need design iteration; their file lists are best-effort and may shift during implementation. Re-spec these batches if drift exceeds the manifest.
- `WordKind` union growth (~20+ values) may warrant a taxonomy refactor (families) — deferred; flag if it becomes unwieldy.
- Voice auto-listen currently assumes numeric answers; `compare`/`choice` phases are non-numeric — voice should stay idle on them (mirror the existing `pickOp` skip). Verify no regression to the bounded-retry timing (§9.5).
- Time conversions cross non-decimal factors (60/24/7) — ensure prose and ranges stay age-appropriate (e.g., avoid "10 weeks → 70 days" if confusing; cap sensibly).

## Open questions
None blocking — the granularity fork was resolved at the Phase 1 gate (full detail, all 6 tiers; tiers 4–6 carry explicit uncertainty).
