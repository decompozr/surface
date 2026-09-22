# Cross-Surface invalidation and snapshot resynchronization

Experimental only. This directory extends the independent multi-Surface prototype with workspace-scoped cursor notifications and opt-in snapshot refresh. It does not change `src/`, the ordinary runtime, the shared installation, or its CLI/skill/MCP configuration.

```sh
bun run check:surface-sync
bun test experiments/surface-sync/replica.test.ts experiments/multi-surface/ownership.test.ts experiments/server-contract/contract.test.ts
bun run verify:surface-sync
```

The verifier requires the repository's pinned Bun, installed dependencies, Chrome and macOS `lsof`. It snapshots current source into a temporary Git repository, installs the pinned snapshot into a temporary home, and launches the installed `experiments/surface-sync/host.ts` explicitly on an ephemeral loopback port. Ordinary `surface start` does not select it.

The fixture copies the project-owned SQLite backend and adds an explicit `invalidates: true` result only after a successful save. No database is opened by creating the backend, subscribing, sending a heartbeat or inspecting the cursor. The two Svelte artifacts share the browser snapshot controller as fixture-owned source.

Five actual Chrome views cover loaded/unloaded comparisons, two editors and a neighboring worktree. Tests toggle one browser context offline, delay a real snapshot response, observe rendered values, and retain an independent HTTP subscription through unmount. No live agent callbacks are sent.

Successful runs stop all owned hosts and retire/remove the disposable worktree after clean/ancestry checks. Temporary source snapshots, installation, main fixture and databases remain for inspection. Failed fixtures remain for diagnosis; do not remove unrelated temporary roots. Evidence and screenshots are stored in `.decompozr/surface/surface-sync-proof/`.

See the [results and limits](../../docs/experiments/2026-09-21-surface-sync.md).
