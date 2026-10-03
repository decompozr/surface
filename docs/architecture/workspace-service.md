# Public Surface entry point and workspace service

Status: implemented. The root/package `surface` CLI and the installed bootstrap now operate the shared workspace service. This increment adopts the bounded local command/layout contract below; it does not claim arbitrary frameworks or indefinite daemon reliability. Source setup now supports private Tailscale browser access; remote CLI management and agent-session delivery are separate concerns. See [current page and access workflow](../../skills/surface/references/pages.md).

## Install and use

[SETUP.md](../../SETUP.md) owns installation commands and prerequisites. The installed `bin/surface` selects committed release code independently of cwd and the original checkout. `surface --help` lists current commands; `surface mcp` runs the same release's stdio transport against the selected host without configuring an MCP client.

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

Surface owns the built shell, live compiler, identity, backend dispatch and services. CLI owns prepared installation and lifecycle. Repository `bin/build` and `bin/release` own source candidate production and accepted local promotion; `bin/setup` consumes a selected artifact and configures the installation. See [module ownership](package-boundaries.md) for current locations.

## Worktree workflow

The [page authoring guide](../../skills/surface/references/pages.md) owns project creation and mount commands.

Create the ordinary Svelte source folder first; `add` records it. Read UUIDs and actual namespaces from the results. Project/surface identity is versioned in Git; each proven linked worktree has a stable workspace identity and separate namespace. Registration precedes add/list/mount on this host. Existing manifests are not reinitialized. The current contract supports Git-root projects; arbitrary clones with copied identities, nested projects, relocations and reused retired paths are not silently adopted.

No worktree receives its own service `.decompozr/surface`. A small marker in each Git administrative directory identifies its incarnation; the shared ledger holds runtime metadata. Project-owned source/dependencies remain in their respective worktrees. Backend declarations remain optional. A factory receives the inert workspace data context; domain code must honor it. Only a validated data operation creates/opens storage. Trusted project code is not sandboxed or forcibly prevented from performing side effects.

`surface workspace retire` addresses the current workspace, or use `--workspace ID`. It blocks new resource admission, unmounts that workspace and checks unresolved deliveries. Accepted/delivering/unknown work without a result blocks final retirement, even if closed. History and data retain their original workspace/session identity. Reconcile the original request, then retry. Retirement does not delete source or merge databases; Git merge and worktree removal remain explicit operations with separate cleanliness/ancestry checks.

## Interaction commands

Use `surface bind`, `request`, `requests`, `inspect`, `send`, `result` and `close` for the selected service. A new request supplies its returned namespace/mount, discovered component and explicit schema file. Bind the exact existing conversation and canonical project root. Acceptance is not agent completion; follow the exact callback command supplied with an interaction, including any retained internal CLI path and state directory.

Only the current public CLI and workspace host are supported. Historical per-runtime commands and migration commands have been removed. Low-level host verification uses a test-only controller under `tests/e2e/runtime`, never a shipped CLI.

## Unsupported data

The host refuses obsolete project binding formats and incomplete state transitions without overwriting them. Preserve the original data and backup; reconcile it explicitly under a separate task when needed. Development refactors do not imply an indefinite old-format support commitment.

## Lifecycle boundaries

Install/upgrade/rollback/uninstall require a stopped owned host. Release activation validates declared workspace and interaction schema compatibility. Older releases without this descriptor cannot be selected through the public lifecycle entry. This gate does not invent general future migrations for every service store.

Uninstall retains service metadata, Git source, persistent project data, backups and the bootstrap. Unresolved callback work blocks removal of needed release executables. The owned host runs in its own process group, so the launching terminal/tool session can exit without terminating it. No launchd/systemd service, login item or shell-profile modification is installed. `recover` is conservative about stale process ownership. Compiler budgets, longer uptime evidence, multiple backend mounts per workspace and general data promotion remain separate work.

## Verification

`SURFACE_E2E_ARCHIVE=/absolute/accepted-candidate.tar.gz bun run verify:surface` verifies the installed launcher after source relocation and launching-session teardown, route-page browser storage, CLI/MCP identity agreement, retirement, restart and uninstall/reinstall. Tests use disposable Git fixtures and provider data. [Release acceptance](../evaluations/release-candidate.md) adds immutable package and upgrade/rollback gates. Historical milestones are retained in [history](../history/2026-09-24-workspace-boundaries.md).
