# Git Workflow Rules (§8)

## §8.1 Commit/push gate [ENFORCED by §0.1]
- NEVER commit or push unless the engineer explicitly asks. Diffs are reviewed via `wd` first.
- Branch from `master` for non-trivial work; `master` is the default/PR target.

## §8.2 Commit messages [CONVENTION]
- Subject: short, lowercase, imperative — describe the behavior change, not the files (e.g. `add 3rd-grade volume (l/dl) conversion lessons`, `harden web speech voice input for flaky devices`).
- Body (when useful): why + what, wrapped. End commits with the `Co-Authored-By: Claude …` trailer.
- Stage only the files you changed (`git add <paths>`), never `git add -A` blindly.

## §8.3 Scope [CONVENTION]
- One logical change per commit. Don't bundle the curriculum `.md` doc edits with app code unless they're the same feature.
