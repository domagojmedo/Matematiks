# Plan — New Problem Types (6-Tier Lesson Roadmap)

> Companion to `docs/specs/2026-06-05-new-problem-types.md`. Sequencing, checkpoints, and execution notes.

## Branch & deploy isolation

- All implementation happens on a long-lived **`lab`** branch (cut from `master`). `master` stays the working, shippable app and is never edited directly by this work.
- `lab` deploys as a **separate beta site** for live testing (deploy wiring is a separate ops task, not part of these batches).
- **Per-tier promotion:** each tier is committed as a clean boundary on `lab`; promote a finished tier to `master` via merge/cherry-pick when it's ready to ship. New lessons register normally into `LESSONS` (no in-app flag) — isolation is the branch.
- All changes stay additive: no edits to existing lessons, `LESSONS` entries, or persisted shapes, so a promotion can never break the working app.

## Sequencing rationale

Batch 0 lands the shared model/UI extension points **once** so tiers 1–6 don't each re-touch `wordTypes.ts`/`WordPractice.tsx` in conflicting ways. Then tiers ship in value÷effort order. Tiers 1–3 are low-risk (reuse/extend engines); 4–6 introduce visual components and carry explicit uncertainty (re-spec if drift exceeds the manifest).

Recommended implementation path: **subagent path** (≥3 batches, ≥6 files, 7 batches total) — one fresh implementer per batch with orchestrator drift checks. Suggested model: Sonnet for mechanical batches (0–2), Opus for design-heavy batches (4–6).

## Batches & checkpoints

Each batch ends with the same checkpoint: `npx tsc -b` clean → `npm test` green → `npm run check` clean on touched files → behavioral note → check off here.

### Batch 0 — Foundation (model + UI)
- Add `solve` / `compare` / `choice` phase kinds + `GenContext` + op union `*`/`/` to `wordTypes.ts`; update `buildSteps`, `phaseAtStep`, `finalInputPhase`.
- Thread `GenContext` through `WordGenerator.generate()`.
- `PracticeUI`: `ComparePad`, `ChoicePad`, step-line renderers. `WordPractice`: handlers + glyphs.
- `operations.ts`: chip scaffolding for new families.
- Tests: `wordTypes.test.ts` phase plumbing. **No new lessons yet** — pure foundation.

### Batch 1 — Tier 1 conversions (length / money / time)
- `Unit` extension; `buildConvertTemplate` instances; registry + `WordKind` + `poolFor` + `isConvertKind`.
- Lessons: `g2-units-money` (€), `g3-units-length`, `g3-units-time`. nameKeys → `hr.json`.
- Tests: stratification + round-trip + whole-number + count bumps.

### Batch 2 — Tier 2 word problems g2–4 + ×/÷
- Mul/div vocab+story+missing-factor templates; range-aware `generate(ctx)`.
- `WordLessonSetup.maxNumber?`; per-grade `g2/g3/g4-word-*` lessons.
- Tests: range scoping; mul/div whole-number.

### Batch 3 — Tier 3 number sense
- Templates: comparison (`compare`), rounding (`solve`), parts-of-a-whole (`solve`), place value (multi `solve` steps).
- Finalize ComparePad. Lessons + nameKeys. Tests.

### Batch 4 — Tier 4 fractions (g4)
- `FractionVisual.tsx` (+ test); `fraction` phase render in `WordPractice`.
- Fraction templates + lessons + nameKeys.

### Batch 5 — Tier 5 perimeter & area (g3/g4)
- `ShapeDiagram.tsx` (+ test); perimeter/area `solve` templates + lessons + nameKeys.

### Batch 6 — Tier 6 geometry / data / probability
- `ShapeGlyphs.tsx`, `MiniBarChart.tsx` (+ tests); `choice` templates (shapes, probability vocab), chart-read `solve` templates + lessons + nameKeys.

## Post-implementation review items
- [ ] Voice stays idle on `compare`/`choice` phases (mirror `pickOp` skip); bounded-retry timing unregressed (§9.5).
- [ ] No existing persisted `localStorage` shape changed (§9.4).
- [ ] Money is euro everywhere; curriculum `.md` doc multiplication-grade error fixed (grade 2).
- [ ] `WordKind` union still legible — if not, open a taxonomy-refactor follow-up.
- [ ] hr nameKey present for every new lesson; no hardcoded Croatian copy in components (§0.4).
- [ ] Run `/mtk review before commit` before any commit (§0.1).
