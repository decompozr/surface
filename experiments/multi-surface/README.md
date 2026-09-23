# Multiple Surfaces sharing one workspace backend

A bounded experiment, not a supported backend API or production adoption. This directory contains an independent host and backend ownership prototype. The normal `surface` entry and `apps/surface/src/server/backends.ts` retain their existing one-backend-mount restriction.

## Run

From the Surface repository with its pinned Bun and dependencies installed:

```sh
bun run check:multi-surface
bun test experiments/multi-surface/ownership.test.ts experiments/server-contract/contract.test.ts
bun run verify:multi-surface
```

The verifier snapshots the source into a temporary Git repository, installs that exact snapshot into a temporary home, and launches **that release's experimental host** directly with explicit state/data directories and an ephemeral port. The ordinary installed `surface start` does not select this experiment. The test does not update the existing shared installation, global CLI, skill, or MCP configuration, and sends no live agent callbacks.

The fixture has distinct Editor and Comparison artifacts in main and a disposable linked worktree. Chrome saves scenarios and explicitly loads the comparison. SQL handle inspection uses macOS `/usr/sbin/lsof`; Chrome must be available. Project code owns the SQLite schema and operations. The existing lazy database fixture is instrumented only to count backend factory instances and closes.

Successful runs stop all owned hosts and retire/remove the disposable linked worktree after clean/ancestry checks. The temporary installation, main fixture, databases and source snapshot remain inspectable. Failed fixtures are retained for diagnosis; do not delete unrelated temporary roots.

Private evidence: `.decompozr/surface/multi-surface-proof/` (`result.json`, source hashes, host logs, editor/comparison screenshots).

See the [outcome and limits](../../docs/experiments/2026-09-21-multi-surface.md).
