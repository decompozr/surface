# Installation and lifecycle

[SETUP.md](../../SETUP.md) owns user procedures; [workspace service](workspace-service.md) owns service/home layout and selection. This document owns lifecycle and lazy-storage invariants. [Release distribution](release-distribution.md) describes package construction.

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

## Compatibility and scope

Activation checks current workspace-ledger and interaction schemas before changing the selected release. Unsupported persisted formats are rejected without replacement; migration requires a separately scoped decision. The retired preferences and namespace-migration experiments do not authorize production migration behavior. See the [current development contract](../decisions/0004-current-development-contract.md).

Workspace retirement is defined by [workspace service](workspace-service.md). Source integration belongs to Git; retirement preserves domain data and interaction history. Multiple mounts sharing a workspace backend, general future store migrations and project-specific data promotion remain outside the adopted implementation.

## Exit criteria

1. A clean installation runs the supported entry point and the existing project interaction loop.
2. A project without a backend works through install/start/restart/uninstall/reinstall without a project database ever appearing.
3. A backend-enabled project that does not request database operations likewise retains zero project database files and connections.
4. A first valid database operation opens storage on demand; later lifecycle operations preserve committed data, release handles, and reopen only on subsequent demand.
5. Failed startup/upgrade and supported rollback have explicit, recoverable outcomes; project sources/data survive uninstall and reinstall.
6. Owned host/installer processes exit as expected. New installed-lifecycle evidence is recorded separately from the development experiment results.

Current executable gates are `bun run verify:surface`, the app lifecycle tests and the [release candidate checks](../evaluations/release-candidate.md). Dated experiments remain evidence of their original revisions only.
