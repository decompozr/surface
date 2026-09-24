# Linked-worktree workspace experiment

Historical record: this experiment is retired. Commands and paths below describe the original run, not current setup. Source is preserved at Git revision `2b6a4c7`. Current verification belongs to `tests/` and application tests.

Status: implemented and verified as an opt-in experiment. Default project identity behavior, global Surface installation and existing user worktrees are unchanged.

One shared service hosts one logical project in several Git worktrees. Each workspace receives its own namespace, mount capability and optional lazy data location. The project manifest and artifact IDs remain Git-owned and identical across branches. The experiment uses the existing project operation core, SvelteKit shell, compiler, interaction records and backend lifecycle.

## Reproduce

```sh
bun run --cwd experiments/sveltekit build
bun run check:workspaces
bun test experiments/workspaces/identity.test.ts
bun run verify:workspaces
```

The verifier creates a separate temporary Git repository with main plus two linked worktrees, uses real CLI commands from each cwd and Chrome, exercises source merge/retirement/removal, and retains its main repository and project data for inspection. It never creates or removes worktrees in the Surface checkout. Private results and screenshots are under `.decompozr/surface/workspaces-proof/`.

## Manual experimental use

Start a separate host with shared state and an explicitly selected persistent data root outside all project worktrees:

```sh
bun /path/to/surface/experiments/workspaces/host.ts --state-dir /tmp/surface-workspace-service --data-root /path/to/project-data --port 4319
```

Then select the same service from each worktree. No local `.decompozr/surface` directory is required:

```sh
export SURFACE_STATE_DIR=/tmp/surface-workspace-service
bun /path/to/surface/experiments/workspaces/cli.ts register
bun /path/to/surface/experiments/workspaces/cli.ts list
bun /path/to/surface/experiments/workspaces/cli.ts mount --artifact ARTIFACT_UUID
```

Commands default to the current Git worktree root. Initialize the versioned project manifest explicitly if absent, then register before other workspace operations. The experimental CLI forwards the existing eight project operations; `retire --workspace WORKSPACE_UUID` adds workspace-level runtime cleanup. Use the returned `workspaceId` from register/list. It does not perform Git merge, delete source, or delete data.

`retire` marks the workspace retiring, unmounts its resources through the authenticated shared host, and checks for unresolved accepted/delivering/unknown interactions. Such work blocks final retirement even if the request was closed. Inspect and reconcile the original request/session, then retry. An interrupted operation remains visibly retiring and blocks new resource admission; existing neighbor workspaces remain usable. After runtime retirement, separately inspect Git changes/ancestry before worktree removal.

## Ownership and limits

- `state/workspaces.json` stores one shared project/workspace ledger. A tiny `surface-workspace.json` identity marker in each Git administrative directory distinguishes deletion/recreation of an administrative path. It contains only format/project/workspace IDs, no service state or credentials. It is outside versioned source and disappears with Git's linked-worktree administrative cleanup.
- Data paths are `<data-root>/<project-id>/<workspace-id>/`. Merely registering, mounting, editing a draft, inspecting or retiring does not create them. The backend receives an inert context with `dataDirectory`, `workspaceId` and `projectId`; the tested backend creates SQLite only for a validated database operation.
- The fixture's databases start independently. No automatic main-data copy, shared writable main database, SQL merge, or data promotion is provided. Source moves through Git; data stays independently addressable after runtime retirement and source removal.
- Only Git-root projects with proven common Git administration are supported. Branch names are labels, not identity; detached HEAD is supported. Independent clones with copied UUIDs are rejected. Multiple projects nested inside one worktree, relocation, reused retired paths and unbound/changed identity markers require a later reconciliation contract.
- Registration writes the marker and shared ledger separately. Interrupted registration fails closed on an unbound marker; automatic recovery and crash-atomic registration are not established. Missing or changed markers do not silently rebind old data.
- This host refuses the legacy single-root binding ledger rather than migrating it implicitly. The installed launcher, MCP configuration and global skill are not switched to this experimental host. Service selection is explicit through an environment variable or `--state-dir`.
- Trusted local code remains one origin/process. Namespaces prevent accidental crossing; they are not a hostile-code sandbox. One backend mount per workspace and restart-required backend source changes remain inherited limits.

See the [experiment findings](../../experiments/2026-09-21-workspaces.md) for observed outcomes and the proposed integration contract.
