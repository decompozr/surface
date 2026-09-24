# Worktree-scoped Surface on a shared service

Status: bounded experiment implemented and verified. This is evidence for a workspace contract, not adoption of a new global installation or automatic migration of existing service state.

Follow-up: the [public entry implementation](../architecture/workspace-service.md) now integrates this model, adds namespace-preserving legacy migration and verifies the installed executable. The original experiment observations below retain their scope.

## Question

Can a project use Surface directly from main and linked worktrees without duplicating `.decompozr/surface`, then merge reviewed source and remove disposable worktrees without moving whole service state into main or losing project data?

## Model exercised

```text
Shared Surface service
  project ID                       versioned project manifest
    workspace main                 stable workspace ID and namespace
    workspace A                    independent mount, access and lazy data
    workspace B                    independent mount, access and lazy data

Persistent project data root       outside disposable worktrees
  project ID / workspace main /    created only on data demand
  project ID / workspace A /       retained after A source removal
  project ID / workspace B /       absent when never used
```

The Git-owned project/artifact IDs are shared across branches. Workspace IDs are independent of branch labels. Namespace strings encode project/workspace identity within the existing route length limit; the ledger keeps full UUIDs and rejects a namespace collision. Git common-directory identity, `worktree list` membership and linked administrative backpointers distinguish genuine worktrees from independent copies.

One small identity marker lives in each Git administrative directory, alongside a shared service ledger. This avoids recreating service state in each checkout while detecting missing/replaced worktree metadata. Neither marker nor namespace contains domain data or management credentials. No global defaults or pre-existing checkout/worktrees were modified.

## Implementation boundaries

[The experiment](../history/retired-experiments/workspaces.md) adds an optional identity resolver to the existing project operation core. HTTP, queueing, project validation, artifact definitions and runtime ownership remain shared. Default callers still use the existing canonical-root binding ledger and reject copied IDs. The workspace host refuses an existing legacy binding ledger; adoption/migration must be explicit later.

The backend experiment now optionally passes an inert context to the project factory. Its lazy SQLite fixture accepts a data directory without creating or opening it. With no context, the previous project-root data behavior remains unchanged. The workspace host supplies a persistent project-owned location outside all registered Git worktrees and checks workspace identity even for a mount with no backend declaration.

The cwd-based experimental CLI selects one shared host through `SURFACE_STATE_DIR` or `--state-dir`. It does not copy a connection file or start a separate host for every worktree. Register/list expose the workspace ID, and existing project operations use its namespace. These commands are not yet installed as the supported default `surface` entry point.

## Cleanup semantics

1. Transition the workspace to `retiring`, blocking new resource admission.
2. Unmount its resources through the shared host. This preserves source/data and lets neighboring workspaces continue.
3. Inspect its original interaction records. Accepted, delivering or unknown responses without a result prevent final retirement, even for a closed request. Publication/reconciliation targets the original session; it is never redirected to main.
4. Mark it `retired` while retaining its namespace identity, history and data location. An interrupted cleanup stays inspectable and can be retried; it does not claim completion.
5. Separately merge/review Git source and establish cleanliness/ancestry before removing a disposable worktree. The `retire` command never performs Git deletion or discards files.

There is no whole-workspace migration back into main. In the verified fixture, source is merged with Git; main mounts the merged source using its existing identity and database. Worktree A's SQLite remains separate and readable after source removal. Domain-specific export/import or explicit promotion can be designed later; neither Git nor Surface generically merges those rows.

## Observed evidence

The verifier creates its own temporary Git repository and two disposable linked worktrees; the canonical Surface checkout is not its fixture. One built SvelteKit host and Vite compiler serves all three roots on one HTTP listener. Real Chrome and CLI subprocesses exercise the following:

- All three roots retain the same project and artifact IDs while receiving different workspace namespaces. Commands run from each cwd against the shared state directory. No root receives a `.decompozr` directory, and registration/mounting do not create the external project-data root.
- Branch rename and detached HEAD retain workspace identity. An independent clone carrying the same project UUID fails registration without disturbing live resources. Unit tests also reject forged Git pointers, unsafe data roots, changed identity markers and competing ledger ownership.
- Main and A save different values under the same row ID through their browser pages. Their separate databases remain isolated. B edits a local draft, performs a non-data action, and submits invalid input without allocating storage. A backend token cannot read B's data.
- A scoped interaction uses a deterministic fixture adapter and reaches only A's exact session/root. Using A's request on B's namespace is refused. No live agent callback is sent.
- A's accepted response remains unresolved when the request is closed. Retirement unmounts A and blocks completion; main and B remain usable. New mounts for retiring A are rejected. After explicit result publication on the original request, retirement succeeds.
- A's reviewed Svelte source change is committed and fast-forward merged into the fixture main. Ancestry and clean-worktree checks precede Git worktree removal. The main browser renders the merged heading while still loading its own unchanged row. A's retained SQLite passes integrity checking and contains its distinct row; interaction history still names A's original root/binding.
- B retires and is removed without a database ever appearing. Restart restores only main, leaves its existing SQLite unopened until demand, and preserves retired history/data. The service listener closes on shutdown. The temporary repository has only its main worktree afterward.

The combined core, singleton, backend, installation-contract and workspace identity suites passed **60 tests / 388 assertions**. Root and all affected experiment TypeScript checks passed. The original project-database browser/lifecycle verifier also passed with its existing default project-root storage behavior. The installed server-contract regression passed, including all five owned hosts exiting; it verifies the unchanged default installed path, not installation of the new workspace host.

Private evidence: `.decompozr/surface/workspaces-proof/result.json`, `worktree-a.png`, and `main-after-merge.png`. The result records the actual fixture repository, workspace identities/data paths and fixture deliveries. Test project data and the temporary main repository are retained for inspection.

## Remaining decisions

Adopt the workspace identity and public command contract before integrating this host into the installed launcher, MCP and skill. Define a migration from existing single-root registrations, reconciliation for relocation/reused paths or interrupted marker writes, and any project-specific data promotion. Worktree removal bypassing retirement is not automatically managed; changed/missing identity metadata requires explicit reconciliation. Nested projects, shared read-only baselines, multi-mount backend ownership and resource budgets remain outside this experiment.

The evidence supports one shared service with workspace-scoped resources and lazy project storage. It does not support automatic database merging, automatic deletion of retained data, or silently treating an arbitrary clone as another workspace.
