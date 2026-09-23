# Surface shell and scroll-lock integration

The user authorized integrating the completed design-system consumer work before continuing delivery-state recovery UI. Both original writers were observed idle. Their worktrees, indexes and branches remain unchanged; temporary-index snapshot commits preserve their tracked and nonignored work in separate integration branches.

- Surface consumer snapshot: `1dee4c117f454973729ae170434a8bc222fa7e30` (from comments/main integration).
- Design-system snapshot: `bb128987f536640825600c657151259f262cf2ca`; overlay correction: `2db31b8dba789eaf3b88b43cd08f8c8f6bb76cc2`.
- Surface continuation and earlier drawer evidence: `09c3d1d`.

The merge preserves the PR #45 skip link and moves scroll ownership into the shared AppShell. Mobile navigation and panel overlays freeze background document/main scrolling; the opened pane can scroll independently. Closing or crossing the responsive boundary releases the lock. Desktop persistent panes retain ordinary scrolling. There is no added focus trap.

Development uses the linked private design-system package. Source installation verifies a committed package-content fingerprint and materializes package.json plus dist into its unpublished release, retaining asset licenses. Installed output no longer depends on a mutable external worktree. A changed provider rejects before activation. The package fingerprint, provider repository and commit are recorded in `apps/surface/design-system.lock.json`.

## Verification

- Provider check, package and standalone production build passed.
- Surface TypeScript/core/Svelte checks passed without diagnostics.
- Drawer verifier passed Chromium and narrow desktop WebKit; skip-link verifier passed at supported widths.
- Comments full-loop passed desktop Chromium and mobile WebKit: PNG capture, one fixture delivery, CLI result, SSE, offline recovery and reload.
- Interrupted-delivery fixture passed all three cuts after source relocation (`2026-09-23T21-28-17.102Z`).
- Core/host/runtime/comments suite: 102 passed, one legacy browser test initially timed out because its example had not been built. After frozen example install/build, that test passed (5 assertions).
- Recipient verifier passed queue, per-tab choice, explicit takeover, no replay and state-change rejection.
- Package materialization test passed immutable-copy, development-link preservation, provider drift and symlink rejection checks.

These are local fixture/browser checks, not physical iPhone acceptance or deployment. Original installed service and the other agent's private preview remain separate until an explicit selected-installation update.
