# Service, workspace and project operations

Use the [public entry guide](../../../docs/implementation/03-public-entry.md) for installation layout, defaults, migration and current limits. `surface` is the public CLI; a checkout fallback is `bun /path/to/surface/src/cli/index.ts`. Keep one selected service across operations.

## Installation and service

Install a pinned committed revision when the task includes setup:

```sh
surface install --repo /path/to/surface --ref FULL_COMMIT
surface start
surface status
surface doctor
```

The default home is `~/.decompozr/surface` on macOS/Linux. `--home`/`SURFACE_HOME` selects another home. Releases, state, tooling and persistent project data have separate directories. The default port is 4319; a requested conflict fails without fallback. No login service is installed.

`stop` uses authenticated process ownership. `restart` preserves the configured port. `upgrade --repo ... --ref ...`, `rollback --release ...` and `uninstall` require a stopped owned host. Uninstall retains state, project data and the bootstrap launcher; unresolved accepted/delivering/unknown interactions without results block uninstall even if closed. `recover` handles only verified dead host ownership. Do not remove arbitrary locks or signal a PID merely because it appears in a file.

`surface serve --state-dir STATE --data-root DATA` is the foreground shared host. Do not run it against an installed service's active state. It requires the SvelteKit shell build. Earlier per-runtime commands are under `surface legacy`; existing recorded singleton callbacks retain their original CLI path and state.

For readable page routes and private Tailscale URLs, follow [project pages](pages.md). New or updated user-facing previews must declare a routes directory instead of exposing component filenames.

## Project and workspace identities

From a Git worktree, use `surface project init` if the manifest is absent, then `register`, `add --source RELATIVE_PATH --name LABEL`, `list`, and `mount --artifact ID`. Explicit `--project ROOT` selects another root. All project operations require the selected host. Init never overwrites an existing manifest.

`artifact.project.json` and artifact IDs are shared through Git. Git-linked worktrees get distinct workspace IDs and namespaces under one project. Branch names are labels; aliases are canonicalized. An independent clone with a copied project UUID remains a conflict. A tiny marker in Git administrative metadata detects missing/recreated identity; relocation/reused paths require explicit reconciliation. Do not regenerate IDs or delete the shared ledger to bypass errors.

`surface workspace current` identifies the cwd workspace; `workspace list` shows retained workspaces. `project list` separately reports source availability, archive status, route and observed runtime. `project archive` unmounts and saves the artifact flag; `project restore` clears that flag without an implicit mount. Both preserve source/data.

After authorized workspace cleanup, `surface workspace retire` (or `--workspace ID`) blocks new resource admission and unmounts that workspace while neighbors remain available. Unresolved delivered work prevents final retirement; inspect and reconcile its original request/session, then retry. Retirement preserves data/history and does not delete source or merge Git branches. Establish Git cleanliness/ancestry separately before removing a worktree. Never stop the shared service merely to clean up one preview.

## Optional backend and lazy data

No backend declaration means no backend resource. A declared project backend receives an inert `dataDirectory`, `workspaceId` and `projectId` context. Project code owns schema and storage operations and must honor that directory. Registration, mounting, local drafts, rejected input and non-storage actions must not create/open SQLite; an explicit validated data operation acquires it. The runtime cannot sandbox arbitrary project code or enforce inert module behavior against a misbehaving backend.

Default data locations are under the installation's persistent `project-data/PROJECT_ID/WORKSPACE_ID`, outside disposable source. `surface access` returns private backend capabilities; do not publish its raw output. Backend source edits require restart. Source merges through Git; databases are never automatically copied or merged into main.

## Explicit migration

Existing single-root stores require an offline migration. `surface workspace migrate --state-dir OLD_STATE` prints a plan; `--apply` makes the backed-up change. The old namespace and registry/interaction records retain their identities and bytes. The default installed state is not automatically populated from a checkout.

Backends or existing domain data require `--storage-map FILE`, a project-ID-to-persistent-directory mapping. Prepare/verify that project-owned data separately and ensure the backend honors its supplied directory; migration does not guess database paths or perform a generic SQL copy/merge. Paths inside worktrees and overlapping project mappings are refused. Unsupported manual namespaces or earlier per-runtime stores require separate reconciliation.

`workspace migration-rollback --backup ID` restores only compatible unchanged metadata; it refuses newer writes. Interrupted migration blocks startup. Recovery can remove only its own verified dead migration lock and retains ownership evidence. Do not erase pending files to force startup.

## MCP and outcomes

`surface mcp` serves the existing 19 tools over stdio for the selected shared service. It does not start another host, alter MCP-host configuration, or allocate another registry/compiler. Discover actual schemas before calling tools. The eight `surface_project_*` operations use the same project/workspace core and require explicit `projectRoot`; register before add/mount on the workspace host.

Inspect `ok`, `status` and structured errors even after HTTP/transport success. Preserve response IDs; a transport failure can leave a mutation outcome unknown and is never automatically retried. A private interaction preview URL carries a browser capability; list/inspect do not. Management access remains privileged, and tool annotations are not access control.
