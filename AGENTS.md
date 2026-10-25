# Working on Surface

Use `docs/` as the source specification. Start with [the documentation index](docs/README.md) and [source workflow](docs/source-workflow.md). Keep repository documentation in English.

## Rules

- Preserve user changes, worktrees, drafts and runtime data. Never reset or switch branches to make a check pass. Name new task branches descriptively without a `codex/` prefix.
- Prefer arrow functions and explicit boundary types. Validate external/persisted data; do not silence errors with `any`, unchecked assertions or suppressions.
- Keep the two app workspaces and root frozen lockfile. Colocate module tests; put integrated checks under `tests/e2e`.
- Use design-system public APIs for shared UI. Product CSS owns layout; missing shared capabilities belong upstream.
- Verify the actual user flow yourself. Keep fixture providers/storage isolated and never send test input to real conversations.
- Record results and limits, then remove owned disposable evidence only after checking active references. Preserve user state and selected installations.

## Read for your task

| Task | Required guidance |
| --- | --- |
| Implementation | [Development policy](docs/development.md), [package boundaries](docs/architecture/package-boundaries.md) |
| Setup or update | [Setup](SETUP.md), [agent setup](skills/surface/references/setup.md); install a selected prepared release and symlink the skill, never copy it |
| Build or release | [Distribution](docs/architecture/release-distribution.md), [acceptance gates](docs/evaluations/release-candidate.md); build once, promote unchanged bytes, then setup |
| UI | [Pinned design guide](docs/design/system/DESIGN.md), [review checklist](docs/design/system/DESIGN-REVIEW.md), [adoption](docs/design/system-adoption.md); inspect phone/desktop rendering and interaction |
| Interaction bug | [Self-owned E2E](docs/evaluations/self-e2e.md); reproduce, add a regression where feasible, and verify the integrated flow |

Every Surface release must build and validate the provider's latest committed `main`, update the package pin and freeze those bytes throughout acceptance. Preserve provider work and development links.

Detailed compatibility, installation, typing and retention constraints live in the [development policy](docs/development.md); they remain applicable.
