# September 24 working-data cleanup

The user explicitly requested concise history instead of retaining all experimental artifacts. Before cleanup, this checkout's `.decompozr` occupied 11,845,852 KiB (about 11.3 GiB).

## Retained history

The [workspace history](2026-09-24-workspace-boundaries.md) preserves the implementation milestones, source revisions, release hashes, test results, failures and acceptance limits. PRs 53, 55, 56, 57 and 58 carry the corresponding integration history. PR 58 merged at `d2813d22789deae2d6080ef4baab7b39540f5072`; the latest tested runtime candidate was `383b0192b0a291853897ca26ed8f6b0487d1f9fe`. It passed 96 main tests, 18 experiment tests, CLI/MCP/browser verification, immutable comments E2E, installed upgrade/rollback, source setup/test and visual inspection. Physical-device and live-agent delivery were not established by those fixtures.

## Removed local artifacts

Removed completed handoffs and experiment directories, duplicated source/dependency/provider exports, release archives and extracted installations, logs, screenshots and traces. Removed the accidental nested `.decompozr/.decompozr` tree. No replacement archive was created. Older documents' `.decompozr` evidence paths are historical provenance, not promises that those files remain available. Source code remains in Git; test procedures can regenerate new evidence, but the discarded run artifacts cannot be re-inspected.

## Preserved runtime state

`.decompozr/surface/comments-preview` was preserved in place, including its releases, connection, interactions and other runtime files. Process inspection found a current working directory in its selected release. No preview recipient, user interaction, service registration, provider checkout or other worktree was changed.

## Retention policy

Keep active runtime data separate from disposable verification output. At completion, record the consequential result, tested revision, failures and limits in `docs/history`; remove reproducible exports, dependencies, builds, logs and captures after validation. Retain specific raw evidence only when an unresolved issue requires it, with a named reason and removal condition. Do not retain every experiment by default. Check process use, active task references and user-owned state before deleting a directory.

Cleanup result: 24 completed top-level directories removed. Local working data decreased from 11,845,852 KiB to 54,736 KiB, reclaiming 11.24 GiB.

Subsequent user direction authorized stopping every Surface instance before a fresh test from main. The owned installed service was stopped through its lifecycle command. Verified local preview/development processes were sent SIGTERM; all four Surface processes exited. Their state was preserved, and unrelated applications were not stopped.
