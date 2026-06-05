# Coding Style Rules (§3)

Project-specific overrides only. Biome enforces formatting/lint; do not restate what it auto-fixes.

## §3.1 Formatting [ENFORCED by Biome]
- Biome (`biome.json`) is the formatter + linter: 2-space indent, double quotes, organize-imports on.
- Run `npm run format` (write) / `npm run check` (verify). A PostToolUse hook formats on edit.

## §3.2 TypeScript conventions [ENFORCED by tsconfig]
- `verbatimModuleSyntax` is on → use `import type { … }` for type-only imports.
- `erasableSyntaxOnly` is on → no runtime-emitting TS (no `enum`, no parameter properties, no namespaces). Use `const` objects + union types instead.
- `moduleResolution: bundler`, ESM only.

## §3.3 Naming [CONVENTION]
- `lib/` and `hooks/` modules: **camelCase** file names (`problemGen.ts`, `wordTemplates.ts`, `useRoundMechanics.ts`). Do NOT rename to kebab-case — the generic guide suggests kebab, but this repo is camelCase.
- React components and route files: **PascalCase** (`PracticeUI.tsx`, `Practice.tsx`).
- Named exports preferred; avoid default exports for multi-symbol modules.

## §3.4 Notes
- `strict` is NOT explicitly set in tsconfig today; the code is written strict-clean regardless. Prefer keeping it that way; do not rely on loose typing.
- Match the surrounding comment density — `lib/` modules carry short "why" comments on non-obvious invariants (e.g. whole-number guarantees). Keep that style.
