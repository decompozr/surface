# Public Surface entry point and workspace service

Status: implemented. The root/package `surface` CLI and the installed bootstrap now operate the shared workspace service. This increment adopts the bounded local command/layout contract below; it does not claim arbitrary frameworks or indefinite daemon reliability. Source setup now supports private Tailscale browser access; remote CLI management and agent-session delivery are separate concerns. See [current page and access workflow](../../skills/surface/references/pages.md).

## Install and use

Requires a compatible Bun patch version (currently `>=1.4.0 <1.5.0`). From this repository, prepare the root CLI and install a committed release:

```sh
bun install --frozen-lockfile
bun link
surface install --repo "$PWD" --ref HEAD
surface start
surface status
surface doctor
```

`install` resolves the Git ref to a full commit, installs frozen dependencies with lifecycle scripts disabled, builds the SvelteKit shell, prepares a self-contained bootstrap and activates last. Uncommitted checkout changes are not installed. `bin/surface` in the selected home works from any cwd without the original checkout; it dispatches application commands to the selected installed release. Its lifecycle commands survive uninstall, enabling reinstall.

The existing package/global link also points at `src/cli/index.ts`, exposing the same public command contract. `surface --help` lists commands. `surface mcp` runs the installed/source-matched stdio adapter with its existing 19 tools against the selected service. It does not install an MCP-host configuration.

## Shared selection and layout

Home precedence: explicit `--home`, `SURFACE_HOME`, then `~/.decompozr/surface` on macOS and Linux. The first installed start defaults to loopback port **4319**; an explicitly selected port is retained. A conflict fails visibly rather than selecting another port. Explicit port 0 remains ephemeral.

```text
Surface/
  bin/surface              installed executable entry
  tooling/<release>/       bootstrap and owned-process runner
  releases/<commit>/       installed source, dependencies and built shell
  state/                   shared runtime, interaction and workspace metadata
  project-data/<project>/<workspace>/  lazy persistent domain data
  run/                     authenticated lifecycle ownership/socket/log
  settings.json            saved port
```

Client and foreground commands additionally allow `--state-dir` or `SURFACE_STATE_DIR`. Explicit home overrides the state environment; explicit state overrides home environment. Supplying both `--home` and `--state-dir` is rejected. Lifecycle operations use the selected installation's `state/`. The default does not change with cwd or worktree and does not copy checkout-local evidence/state into the installation.

The built shell, one compiler and HTTP listener remain the tested SvelteKit/singleton foundation. Identity, backend dispatch, migration and installation orchestration now live under `src/`; historical experiment entry points forward to them where appropriate. The shell/compiler source still lives in its tested foundation package pending further internal consolidation.

## Worktree workflow

Within a Git project, including a subdirectory of a linked worktree:

```sh
surface project init --name "My project"  # only if the manifest is absent
surface project register
surface project add --source ui --name Controls
surface project list
surface project mount --artifact ARTIFACT_UUID
surface workspace current
```

Create the ordinary Svelte source folder first; `add` records it. Read UUIDs and actual namespaces from the results. Project/artifact identity is versioned in Git; each proven linked worktree has a stable workspace identity and separate namespace. Registration precedes add/list/mount on this host. Existing manifests are not reinitialized. The current contract supports Git-root projects; arbitrary clones with copied identities, nested projects, relocations and reused retired paths are not silently adopted.

No worktree receives its own service `.decompozr/surface`. A small marker in each Git administrative directory identifies its incarnation; the shared ledger holds runtime metadata. Project-owned source/dependencies remain in their respective worktrees. Backend declarations remain optional. A factory receives the inert workspace data context; domain code must honor it. Only a validated data operation creates/opens storage. Trusted project code is not sandboxed or forcibly prevented from performing side effects.

`surface workspace retire` addresses the current workspace, or use `--workspace ID`. It blocks new resource admission, unmounts that workspace and checks unresolved deliveries. Accepted/delivering/unknown work without a result blocks final retirement, even if closed. History and data retain their original workspace/session identity. Reconcile the original request, then retry. Retirement does not delete source or merge databases; Git merge and worktree removal remain explicit operations with separate cleanliness/ancestry checks.

## Interaction and compatibility commands

Use `surface bind`, `request`, `requests`, `inspect`, `send`, `result` and `close` for the selected service. A new request supplies its returned namespace/mount, discovered component and explicit schema file. Bind the exact existing conversation and canonical project root. Acceptance is not agent completion; follow the exact callback command supplied with an interaction, including any retained internal CLI path and state directory.

`surface legacy COMMAND` retains the earlier per-runtime prototype. Existing explicit runtime invocations remain compatible. Historical singleton/Kit experiment commands retain their explicit state semantics. Neither old checkout state nor old callbacks are rewritten merely by installing the new entry point. The repository's ignored evidence stays where it is.

## Offline migration from single-root registrations

The workspace host refuses a legacy `project-bindings.json` instead of silently rebinding it. Stop that service and review:

```sh
surface workspace migrate --state-dir /absolute/old-state --data-root /absolute/persistent-project-data
surface workspace migrate --state-dir /absolute/old-state --data-root /absolute/persistent-project-data --apply
```

The plan validates canonical Git identities, manifests, original scopes and storage placement. Apply acquires exclusive service-state ownership, retains original metadata in `workspace-migrations/ID/`, allocates markers/workspaces, and retires the obsolete binding ledger. **Existing main namespaces stay unchanged.** Registry and interaction files remain byte-for-byte intact during migration, including accepted unresolved work. Source and project database files are not moved. New linked worktrees receive their own namespaces afterward.

If a project declares a backend or has existing local domain data, migration refuses to guess. Prepare a project-owned persistent directory using that project's valid export/backup process, verify that its backend honors the supplied context, and provide `--storage-map FILE`:

```json
{ "PROJECT_UUID": "/absolute/persistent-project-data/existing-project" }
```

This explicitly adopts an existing external location. Overlapping mappings, paths inside a worktree and unknown project IDs are rejected. Surface does not perform generic SQLite copying or schema/data merging. Manual namespaces not owned by mapped projects and earlier per-runtime `state.json` stores require separate reconciliation.

A pending migration blocks host startup. Ordinary failure restores the original bytes/markers. `surface workspace migration-rollback --state-dir STATE --backup ID` also handles an interrupted transaction after verifying its recorded process is dead; it retains abandoned lock evidence. Rollback refuses newer state or changed markers. Once the service has progressed, the migration backup is not a license to discard subsequent work. Marker/metadata writes are journaled, but fsync/power-loss guarantees are not established.

## Lifecycle boundaries

Install/upgrade/rollback/uninstall require a stopped owned host. Release activation validates declared workspace and interaction schema compatibility. Older releases without this descriptor cannot be selected through the public lifecycle entry. This gate does not invent general future migrations for every service store.

Uninstall retains service metadata, Git source, persistent project data, backups and the bootstrap. Unresolved callback work blocks removal of needed release executables. The owned host runs in its own process group, so the launching terminal/tool session can exit without terminating it. No launchd/systemd service, login item or shell-profile modification is installed. `recover` is conservative about stale process ownership. Compiler budgets, longer uptime evidence, multiple backend mounts per workspace and general data promotion remain separate work.

## Verification

- `bun test tests experiments/singleton/interactions.test.ts experiments/project-database/backend.test.ts experiments/server-contract/contract.test.ts experiments/workspaces/identity.test.ts`
- `bun run check`, plus affected experiment typechecks.
- `bun run verify:surface-workspaces`: public CLI, Git branch/detached identity, browser isolation, exact fixture interaction, source merge/retirement/removal and lazy persistence.
- `bun run verify:surface`: a pinned installed release and executable bootstrap from unrelated cwd after source move and launch-session process-group teardown; main plus two worktrees; real Chrome save; real stdio MCP/CLI agreement; retirement, restart, uninstall/reinstall and no owned hosts left running.

The combined regression checkpoint passed **66 tests / 430 assertions**. Migration checks include a real post-migration mount at the original namespace, preserved accepted interaction identity, injected write failure, and verified-dead-owner recovery. Typechecks and the Surface skill validator passed.

Private evidence is in `.decompozr/surface/public-workspaces-proof/` and `public-entry-proof/`. Tests use disposable repositories and deterministic fixtures; no live agent input is delivered. Source snapshot hashes identify the installed verification input independently from the final repository commit.
