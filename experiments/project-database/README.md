# Project-owned SQLite experiment

Status: the bounded browser, database ownership, failure, and lifecycle experiment passed on September 21, 2026 with Bun 1.4.0. This is a bounded experiment, not a supported backend/plugin API. See the [experiment record](../../docs/experiments/2026-09-21-project-database.md) for observations and remaining decisions.

## Question and acceptance gates

Can two external projects own separate SQLite databases while a single Surface singleton mounts their Svelte interfaces and routes named backend operations, preserving data and releasing connections across lifecycle changes?

1. Registration, mounting, inspection, invalid requests, and local-only interaction create no project database files or connections. A project without any backend remains usable.
2. Two projects use the same schema and row IDs but retain separate data.
3. Browser writes survive reload, eligible source HMR, unmount/remount, and a complete host process restart.
4. Unmount and stop close database connections; stale access is rejected. The other mounted project stays usable.
5. Invalid input, a rolled-back transaction, a real external writer lock, and competing versioned writes produce explicit outcomes without corrupting data or blocking the neighboring project.
6. Each project can read its data with its own Bun program after Surface stops.
7. Browser/static-file routes cannot fetch the project's backend or database files through the tested paths. This checks routing and data placement under the existing trusted-local-code boundary, not a security sandbox.

## Bounded design

A database-enabled project owns `backend.ts`, a separately mounted `ui/` directory, and, only after first demand, a `data/` directory with SQLite and its WAL/SHM files. A backend-free project owns only its UI. The project backend owns schema version 1, validation, transactions, and optimistic revisions. The host accepts only named operations and a scoped per-mount capability; neither a SQL string nor a database path is accepted from the browser.

The existing singleton receives an optional experimental resource opener. It constructs an inert backend resource after component preparation, closes it on unmount/preparation failure, and closes remaining resources on stop. The project backend acquires SQLite only after validating an operation that needs it; even existing databases stay closed across remount/restart until the next such operation. Non-database operations and inspection do not acquire storage. Default callers do not load project backends. The experiment wrapper explicitly opts selected projects into trusted backend modules; there is no automatic backend discovery or public manifest extension. One mounted interface per project is the pilot limit.

The browser fixture loads no stored data automatically; Load and Save are explicit actions. Concurrent first operations reuse one synchronously acquired connection. Failed acquisition closes a partial connection; later explicit operations can retry. Surface metadata storage remains a separate, undecided choice.

Project operations execute synchronously with SQLite `busy_timeout=0`: a competing writer produces a visible busy outcome instead of sleeping on the singleton event loop. This does not establish isolation from slow queries or arbitrary trusted code. Backend source HMR, shared database connection pools, multiple interfaces per project, cross-machine storage, generic migrations/rollback, backup/export, crashes during writes, and production packaging are outside this run.

Source references: [Bun SQLite](https://bun.com/docs/runtime/sqlite), [SQLite WAL](https://www.sqlite.org/wal.html). WAL sidecar existence is not proof of an open connection; verification checks actual host file descriptors and independent reads. Do not copy a live database without an appropriate backup/checkpoint procedure.

## Reproduce

From the repository, with its existing root and singleton dependencies installed:

```sh
bun run check:project-database
bun test experiments/project-database/backend.test.ts
bun run verify:project-database
```

The verifier uses four temporary external projects (two use databases, one declares a backend but never requests storage, and one has no backend), a child singleton process, Chrome, and a separate SQLite writer-lock process. It does not contact an agent. Private results and a browser screenshot are written to `.decompozr/surface/project-database-proof/`. Owned processes are stopped in `finally`; fixture data is inspected before the temporary directory is removed.
