# Milestone 2: supported installation and lifecycle

Status: bounded public-entry implementation delivered. See [the implemented command/layout/migration contract](workspace-service.md). Lazy project storage, shared workspace state and the installed entry are now integrated; broader schema transitions and operating budgets remain.

## Objective

Make the bounded local Web interaction loop installable and operable through a supported launcher: install, start, status, stop, restart, upgrade, rollback, and uninstall. Preserve the boundaries in the [product vision](../intent/vision.md) between application releases, durable service state, and project-owned sources/data.

The existing [installation experiment](../experiments/2026-09-21-installation.md) and [project database experiment](../experiments/2026-09-21-project-database.md) supply evidence. The [three first-server contract experiments](../experiments/2026-09-21-server-contract.md) now add an installed bundled entry point, a bounded preferences-schema migration/rollback gate, and declared optional backends through installed lifecycle operations. Their paths and private endpoints are not automatically public contracts.

## Accepted project storage policy

Project SQLite is optional and acquired on demand.

- Registering, mounting, inspecting, or restoring a project must not create its database directory, database file, WAL/SHM files, schema, or database connection.
- A project with no database/backend declaration remains usable. A declared backend may provide operations that do not use storage.
- The first authorized, validated operation that actually needs the database may create or open it and perform project-owned schema initialization. A read is also a database operation; a project may deliberately use it to initialize empty storage. The experiment's interface waits for an explicit Load or Save rather than reading automatically on page mount.
- Invalid requests, rejected access, and non-database operations do not acquire SQLite. Initialization errors are explicit and release partially opened connections. There is no background retry; a later explicit operation may retry after the cause is resolved.
- An acquired connection can be reused for that mounted project's operations. Unmount and stop close it while preserving data. Closing an unused backend is a no-op for storage. Remount and restart return to the unopened state even when a database already exists.
- Projects own their schema, migrations, domain validation, transactions, and data. The launcher must not create a database simply to make project layouts uniform.

Surface metadata is a separate decision. If SQLite is later chosen for the service's own registry or interaction metadata, an application-owned database may be initialized by default in the service state directory. That would not enable or allocate any project's database. This change does not select SQLite for metadata or migrate the current stores.

## Installation and lifecycle requirements

| Concern | Required behavior |
| --- | --- |
| Releases | Identify the installed code/dependency/build revision and keep it separate from persistent state. |
| Service state | Preserve identities, bindings, interaction records, and ownership information across supported lifecycle operations. |
| Project files | Retain source, dependency declarations, domain data, and any SQLite sidecars needed for recovery. |
| Startup/status | Report the actual instance and readiness; restoring mount intent must not eagerly open project databases. |
| Shutdown | Stop admission, settle admitted bounded work, release acquired resources, and report incomplete cleanup. |
| Upgrade/rollback | Define compatible service schema transitions and preserve callback executables needed by unresolved work. A service rollback does not imply a project database schema rollback. |
| Uninstall/reinstall | Remove only owned application resources; preserve service/project data according to the explicit contract and verify it remains usable. |

## Worktree follow-up

The [workspace experiment](../experiments/2026-09-21-workspaces.md) now demonstrates one shared service with worktree-scoped resources. It avoids per-worktree service state and keeps lazy domain data outside disposable roots. Source merges through Git; runtime retirement preserves history and data rather than migrating a whole workspace into main. The public entry now includes this host and a stopped-only migration that preserves legacy namespaces and interaction records.

## Remaining implementation decisions

The public entry selects shared application-data homes, port 4319, pinned Git installation, explicit service selection, optional version-1 backend declarations and private capability inspection. Multiple mounts sharing one workspace backend, execution budgets, general future store migrations and project-specific data promotion remain open.

Keep installation work bounded to the current local Svelte runtime. Native renderers, a general plugin registry, arbitrary application hosting, and domain-specific engines are outside this milestone.

## Exit criteria

1. A clean installation runs the supported entry point and the existing project interaction loop.
2. A project without a backend works through install/start/restart/uninstall/reinstall without a project database ever appearing.
3. A backend-enabled project that does not request database operations likewise retains zero project database files and connections.
4. A first valid database operation opens storage on demand; later lifecycle operations preserve committed data, release handles, and reopen only on subsequent demand.
5. Failed startup/upgrade and supported rollback have explicit, recoverable outcomes; project sources/data survive uninstall and reinstall.
6. Owned host/installer processes exit as expected. New installed-lifecycle evidence is recorded separately from the development experiment results.

The lazy storage gates are executable in the project database experiment and now also pass through installed releases in the first-server contract experiment. The public entry adds the original-namespace-preserving binding migration and installed workspace verification. General registry/interaction schema upgrades and further internal consolidation remain; the earlier preferences fixture still proves only its own bounded schema.
