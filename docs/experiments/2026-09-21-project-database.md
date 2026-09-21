# Project-owned SQLite and backend operations

Date: September 21, 2026 (America/Toronto).

Status: the bounded experiment passed. This is an additional ownership/backend gate after the original seven readiness experiments. It does not adopt a public backend API or expand the supported v0 contract automatically.

## Question

Can each project own its own SQLite database and domain operations while Surface hosts its Svelte interface, routes structured operations, and manages the connection lifecycle?

This tests a concrete consequence of the [product vision](../vision.md): project data and domain logic retain their ownership while Surface supplies common runtime mechanisms. A page alone cannot provide access to a local server-side SQLite file; the missing boundary is a project backend operation and its lifecycle.

## Original implementation and ownership

The initial eager-open run was committed in `8b0bb1d`. Its implementation and observations below are historical evidence; the lazy-acquisition follow-up later in this document supersedes opening databases at mount time.

The pilot lives in `experiments/project-database/`. Its verifier creates two temporary projects outside the Surface checkout. Each owns this layout:

```text
project/
  backend.ts                 # Domain operations and schema version 1
  data/scenarios.sqlite      # Durable project data; WAL/SHM live alongside it
  ui/
    package.json
    bun.lock
    artifact.json
    src/Scenarios.svelte     # The only mounted source tree
```

The two databases use the same `scenarios` table and `shared-id` row key. Project code implements named `listScenarios` and `saveScenario` operations, validates inputs, owns its schema initialization, and uses prepared statements and SQLite transactions. Saves require the expected row revision. A test-only `failSaveForTest` operation writes and then throws inside a transaction to exercise rollback.

Surface Core has no knowledge of the scenario schema or SQL. The experimental host explicitly loads the two trusted backend modules; project modules import `bun:sqlite` and can execute independently without Surface imports. Browser requests cannot select database paths or send arbitrary SQL. This is a fixture operation envelope, not a new CLI/MCP tool or manifest format.

The existing singleton has an optional `openMountResource` experiment seam. It opens a resource after component preparation and before readiness, closes it during unmount/preparation failure, and closes remaining resources during stop. Default callers do not open backends. The separate pilot wrapper uses the existing application-handler seam, so previews and project actions share the existing singleton and HTTP listener.

Each mount receives an opaque action capability, checked against its exact namespace/name. The fixture's authenticated inspection endpoint supplies that capability to the verifier, which passes it in the browser URL fragment; the page sends it in a request header. It is not stored in public component props. Remount and process restart replace capabilities. This is experimental access plumbing, not final user-facing access discovery.

Project data and backend code are outside the mounted `ui/` tree. Database connections use local WAL mode and `busy_timeout=0`. This deliberately reports writer contention instead of waiting synchronously on the singleton event loop. The [Bun SQLite API](https://bun.com/docs/runtime/sqlite) provides the driver; SQLite documents the concurrency and sidecar behavior of [WAL](https://www.sqlite.org/wal.html). A retained WAL/SHM file does not by itself mean a connection is open.

## Original observations

| Gate | Observed result |
| --- | --- |
| Project ownership | Two external roots opened separate SQLite files using identical schema and row IDs. Chrome saved Alpha at 42 degrees and Beta at 17 degrees; each read returned its own value. |
| Scoped operation access | Missing and other-project capabilities, arbitrary SQL operations, database-path overrides, and a foreign browser Origin were rejected. |
| File placement | Tested direct `/@fs` requests for both databases and backend source were rejected. A database symlink inside the mounted UI source was also rejected through the mount URL. |
| Reload and HMR | Browser reload recovered Alpha's saved row. A Svelte heading edit used the same browser document and retained the committed value; Beta's view remained unchanged. Temporary unsaved form state is not claimed durable. |
| Validation and rollback | An out-of-range angle was rejected. A transaction that wrote then threw left both the prior value and revision unchanged. |
| Competing edits | Two requests with the same expected revision produced one save and one explicit revision conflict. No silent last-write-wins update occurred. |
| External writer contention | A separate Bun process held `BEGIN IMMEDIATE` on Alpha. Alpha returned `database_busy`, Beta saved successfully, and the combined requests finished below the verifier's two-second bound. This is a fixture result, not a latency guarantee. |
| Unmount and resource release | Alpha's action route became unavailable. `lsof` showed that its database/WAL/SHM handles were absent while Beta's database remained open. Beta still loaded its saved data in Chrome. |
| Late request body | A request body started before unmount and completed afterward was rejected rather than invoking a closed backend. |
| Remount | Saved data returned unchanged and the previous capability was rejected. |
| Full process restart | The first host exited; a different host PID restored both mounted project databases. Chrome read both saved rows, old capabilities were rejected, and new writes succeeded. |
| Independent use | With Surface stopped, each project's `backend.ts` executable read its own database and passed `PRAGMA integrity_check`. Backend source hashes remained unchanged. |
| Runtime footprint | The restarted host had exactly one application TCP listener. Both host processes and the separate writer-lock process exited; no owned process remained. |

The screenshot was visually inspected. Final rows were Alpha revision 3 (45 degrees) and Beta revision 2 (18 degrees). These values are test inputs, not user design choices. No live agent interaction was submitted.

## Original validation and evidence

```sh
bun run check:project-database
bun run verify:project-database
bun run check
bun run --cwd experiments/singleton check
bun test tests experiments/singleton/interactions.test.ts
```

The new experiment and all three TypeScript checks passed. The existing root/singleton regression run passed **52 tests / 330 assertions**, including the browser interaction test and shared project API lifecycle tests. No installed-release, upgrade, or uninstall suite was rerun for this experiment.

Private evidence is retained under `.decompozr/surface/project-database-proof/`: `result.json`, `cleanup.json`, `alpha-persisted.png`, and `host.log`. Fixture sources and databases were inspected before the temporary tree was removed. The verifier's `finally` block closes its browser and stops its owned processes.

## Interpretation and limits

The experiment supports an optional project-owned SQLite capability accessed through project-defined backend operations. Surface can manage connection lifetime while the project retains schema, transactions, data, and independent access. SQLite is not required for every project, and no shared Surface domain database is introduced.

This remains trusted local execution. A single origin and shared Bun process are not a tenant security boundary; arbitrary project code can still access local resources with the process's permissions. The access tests establish the tested route behavior, not isolation from malicious projects.

The pilot permits one mounted interface per project and synchronous named operations. `busy_timeout=0` avoids lock waiting but does not prevent a slow query or arbitrary backend code from blocking the shared process. Worker/process scheduling, request cancellation, CPU/memory budgets, and isolation need explicit design before general backend support.

Backend source changes require a process restart; only frontend HMR was exercised. Schema version 1 initialization does not prove forward/backward migration compatibility. Abrupt host failure, power-loss durability, database backup/export, network filesystems, multiple interfaces sharing a project connection, and lifecycle upgrade/uninstall integration remain untested. Preserve SQLite sidecars and use an appropriate backup procedure for live data.

## Next decision

Before promoting this into v0, define the supported backend declaration and loading contract, operation access discovery, connection ownership across multiple mounts, and scheduling limits. Then make installation/lifecycle preserve optional project data and compatible backend executables without taking ownership of project schemas. The experiment answers feasibility; it does not require a general plugin platform or settle those contracts.


## Follow-up: optional lazy acquisition

The user adopted lazy project SQLite: registration and mounting must not create or open a database. An application-owned SQLite metadata store could be initialized by default if separately selected, but no such decision or migration is part of this change. The accepted policy is recorded in the [Milestone 2 contract](../implementation/02-installation-lifecycle.md).

The backend factory is now inert. It validates operations before acquiring storage, reuses one connection after first demand, and closes only a connection that was actually acquired. `describeProject` is a non-database fixture operation. A project can also omit backend configuration and the backend file entirely. Remount and process restart reconstruct unopened backends rather than reconnecting databases eagerly.

The UI no longer reads on component mount. Users can edit a temporary draft without persistence; Load or Save explicitly performs a database operation. A first read may initialize empty storage. This replaces the initial run's automatic read after reload/HMR: committed data remains in SQLite, while temporary component state may reset and needs an explicit Load. No durable view-state claim is made.

The revised verifier covers four projects. Alpha and Beta exercise on-demand write/read creation and the original persistence/conflict/close behavior. A backend-enabled unused project and a backend-free project stay usable without a data directory or file descriptors, including browser draft/counter interaction, unmount/remount, host restart, and shutdown. Two simultaneous first reads must report one acquired connection. Access inspection, non-database operations, and rejected requests must not acquire storage. Existing databases must remain unopened after remount/restart until a valid data operation arrives.

A focused backend test supplies an incompatible table layout, verifies that the first failed acquisition reports `database_unavailable` with no retained database handles, repairs the fixture externally, and verifies recovery on a later explicit operation. This tests acquisition cleanup, not a migration policy.

Reproduce the follow-up with:

```sh
bun run check:project-database
bun test experiments/project-database/backend.test.ts
bun run verify:project-database
```

The follow-up passed with Bun 1.4.0: project-database and root TypeScript checks, the acquisition-failure test (**1 test / 7 assertions**), the four-project browser/lifecycle verifier, and the existing root/singleton regression suite (**52 tests / 330 assertions**). Both the unused-draft and persisted-data screenshots were visually inspected. The two host processes and writer-lock process exited, with no remaining owned PID in the cleanup receipt. No live agent call or installed-release verification was performed.

Current follow-up evidence uses the same private proof directory, including the added `unused-draft.png` screenshot. The original commit and observations above retain the earlier eager-open behavior. Installed launcher lifecycle, metadata storage adoption, and the original scheduling/multi-mount limitations remain outside this change.
