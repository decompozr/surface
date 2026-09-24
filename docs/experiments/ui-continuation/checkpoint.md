# Phase A checkpoint — UI-CONTINUATION-02

September 23, 2026. Planned interruption; implementation exists but browser acceptance has **not** run. This is not task completion or crash recovery.

## Authority, location and reconstruction

Work only in `/Users/scottchu/.codex/worktrees/surface-ui-continuation-20260923`, baseline HEAD `6dd908303bf83f5108caa96660e8ee70363771a5`. The coordinator supplied the task record; Phase A read AGENTS.md, docs/README.md, docs/source-workflow.md, docs/design/accessibility.md, docs/evaluations/ui-eval.md, the shell and existing fixture/verifier sources. Follow [task.md](task.md) for authorization and acceptance. No deployment, installed-service changes, live conversation delivery, merge or push. No additional agents.

Phase B must write `intake.md` from these records and the inspected WIP **before substantive edits**, then finish checks/browser acceptance, source reconciliation and `completion.md`. Phase A relinquishes the writer role at this checkpoint.

## Exact WIP

- `apps/surface/src/lib/components/SurfaceShell.svelte`: imports `tick`, binds the existing Page content region, assigns `surface-page-content`, and adds the first shell link, “Skip to content”. Its native fragment target is a fallback; hydrated activation prevents navigation, closes the drawer, waits for the DOM update and focuses the region. Focused link is fixed above the header/drawer with a visible outline; content gets an inset focus-visible outline. Existing tabindex=0 and navigation mechanics are preserved.
- `tests/e2e/surface/verify-skip-link.ts`: new, unexecuted focused browser verifier. Uses a disposable workspace fixture and rejecting adapter, adds a nested route with a content button and 1800px wide content, and tests home/nested routes at 1440, 390 and 320px. Checks first Tab target, visible link bounds, unique target ID, Enter focus destination, unchanged full URL and document marker, content tab continuation, local overflow, and keyboard traversal to open a mobile drawer followed by skipping out. Saves screenshots before/after skip and with open drawer. Cleanup is nested finally blocks.
- `docs/experiments/ui-continuation/task.md`: coordinator-created authorization record, present before Phase A.
- `docs/experiments/ui-continuation/checkpoint.md`: this record.

No source contract is yet updated to claim acceptance. No commit was made. No lockfile or dependency manifest changed. Git status at checkpoint otherwise showed only the shell modification and untracked verifier/experiment directory.

## Decisions and limits

Use the existing named region rather than introduce another landmark. Preserve the entire current URL (including request/token/hash) by explicit focus instead of navigating to a fragment. Close the mobile drawer before focus so the destination is not obscured. This does not adopt a drawer focus trap or resolve broader drawer semantics.

The new verifier uses **synthetic** `request=skip-fixture&token=fixture-only#retained` context to prove byte-for-byte URL retention, not a valid authorized request. Run the existing recipient verifier for real fixture request capability regression. The new verifier's keyboard traversal and hydration assumptions remain unobserved until Phase B. Screenshot existence alone is not visual inspection.

## Environment, commands and failed attempts

Darwin arm64; Bun 1.4.2 from `/Users/scottchu/.asdf/shims/bun`. Homebrew `/opt/homebrew/bin/rg` was available and used for searches. Root/app dependencies initially absent.

Completed:

1. `bun install --frozen-lockfile` and `bun install --frozen-lockfile --cwd apps/surface`: passed; local ignored dependencies installed.
2. Initial `bun run check`: failed because singleton experiment Vite/plugin dependencies were missing, with cascading implicit-any diagnostics and an implicit-any test diagnostic.
3. Initial `bun run --cwd apps/surface check`: Svelte 0 errors/0 warnings, then server TypeScript failed with missing singleton dependencies and TS7022 on the new verifier's `response` variable.
4. Annotated that variable `Response`; ran `bun install --frozen-lockfile --cwd experiments/singleton`: passed.
5. Reran `bun run --cwd apps/surface check`: **passed**, including Svelte 0 errors/0 warnings and server/script TypeScript.
6. Reran `bun run check`: **passed** after dependency installation; no test file changes were needed.
7. `git diff --check`: **passed**.

No browser was launched, no build was run, no fixture server/process was started, and no screenshots exist from this phase. All invoked check processes exited. Dependency installation and Svelte sync may leave ignored node_modules/.svelte-kit artifacts. No pending asynchronous effects or service mutations.

## Next action and remaining acceptance

After intake/WIP inspection, from this worktree:

```sh
bun run --cwd apps/surface build
bun tests/e2e/surface/verify-skip-link.ts
bun tests/e2e/surface/verify-navigation.ts
bun tests/e2e/surface/verify-recipients.ts
```

Existing verifiers launch headless local Chrome through Playwright's `channel: 'chrome'`; availability is not yet checked. They create disposable fixture projects and the recipient verifier uses a fixture adapter/socket. They do not themselves build the shared shell. The new screenshots go to `.decompozr/surface/screenshots/ui-continuation/`; existing scripts save navigation/recipient screenshots under `.decompozr/surface/screenshots/`.

Inspect actual rendered screenshots (focused link and content at all widths, plus open-drawer visibility). Confirm first-keyboard-target and mobile destination behavior, no duplicate IDs, no reload/context loss, 320px reflow and contained wide content. Existing navigation/collapse/Escape and recipient checks remain required. Preserve failed runs and fixes in the continuation record. If screenshot visuals or browser behavior disagree, fix and rerun the affected checks; do not label the current implementation accepted in advance.

After acceptance, update D-08 and E-12, `docs/observations/findings.md` and `docs/requirements/project-continuation.md` with bounded evidence and links, plus completion. Do not claim full E-12, assistive-technology acceptance, physical-device acceptance, deployment or general project autonomy. Independent coordinator review remains after Phase B.
