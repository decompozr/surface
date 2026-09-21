# Milestone 1: shared project operations

Status: implemented and integration-tested; final review and installed-release verification are recorded below. Baseline: `5b77096` (September 21, 2026).

The readiness experiments left project management in a filesystem-aware CLI wrapper. That makes it difficult for MCP or a management page to share project identity, writer ownership, and archive behavior without duplicating them. This first implementation increment moves those decisions into a transport-independent core and connects it to the existing singleton host.

## Ownership and authority

- The project owns its versioned `artifact.project.json`, artifact source, dependency declarations, lockfiles, and installed dependencies. The manifest is authoritative for artifact identity, labels, relative source definitions, and archive flags.
- The service owns its private project binding ledger and runtime registry. The ledger pins project IDs to canonical roots. The runtime registry describes observed mount lifecycle; it does not overwrite project definitions.
- Project and artifact UUIDs are stable. Labels do not determine route identity. An absolute project-root alias is canonicalized before identity checks; copying the same UUID to a different canonical root remains a conflict. Relocation requires a later explicit contract.
- All implemented project operations enter the authenticated singleton and its existing mutation queue. Core writer locks retain the project-then-ledger acquisition order. The CLI and MCP adapter never write project manifests or the ledger themselves.
- The original experimental project manager remains a comparison fixture. It is not the new shared API implementation and should not be run concurrently as an alternative authority.

The project manifest keeps its tested version 1 format. The new operation envelope is separately versioned. This increment does not introduce a silent schema migration or claim downgrade compatibility for future formats.

## Operation contract

The shared core accepts `operation`, an absolute `projectRoot`, and only the fields appropriate to that operation:

| Operation | Additional input | Meaning |
| --- | --- | --- |
| `init` | Optional `name` | Create a manifest in an existing project; refuse overwrite. |
| `add` | Project-relative `source`, `name` | Record an existing project-contained artifact source. No source scaffolding or deletion. |
| `list` | None | Read definitions and source availability; report observed runtime separately. |
| `register` | None | Bind the project ID to its canonical local root. |
| `mount` | `artifactId` | Mount the non-archived definition through the existing singleton compiler. |
| `unmount` | `artifactId` | Revoke runtime access while preserving the definition, files, and interactions. |
| `archive` | `artifactId` | Unmount first, then mark the definition archived. Preserve source/dependencies. |
| `restore` | `artifactId` | Clear an archived flag after validating the source. Do not mount implicitly. |

The core's runtime port supplies namespace creation, mount, mount listing, and unmount without knowing HTTP, MCP, Vite, or connection files. The singleton adapter calls its existing inner runtime operations directly. It must not make an HTTP request to itself or enter the same mutation queue recursively.

Core outcomes contain `version: 1`, `ok`, `status` (`ok`, `rejected`, or `failed`), optional `data`, and an optional structured `error` with `code` and `message`. Invalid or conflicting inputs are rejected; runtime/IO failure remains explicit. A failed mount can retain its runtime record in `data` for inspection. An error does not imply that earlier steps were rolled back.

`list` separates `archived`, source availability, and the observed runtime record. A missing runtime record is `null`, not an invented ready/unmounted status. This separation is needed to inspect interrupted multi-step operations.

## Transport and admission

`POST /api/v1/projects/operations` uses the same loopback host/origin checks and management authorization as the singleton. Authorization precedes filesystem access. The server parses the complete body and then submits the operation to the shared admission queue. Shutdown rejects late admission and drains already admitted operations before releasing the state lock.

The project HTTP adapter returns the versioned envelope, with HTTP 200 for success, 400 for core rejection, and 500 for core failure. Authentication, method, body, and closing-service failures retain their appropriate transport status. Existing interaction and mount API behavior remains compatible.

The new CLI command is `artifact project OP --project ROOT --state-dir STATE`, with operation-specific flags. Its checkout default is `.decompozr/artifact/singleton`, matching the singleton host; explicitly pass the state directory when using the Kit wrapper or an installed release. The eight `artifact_project_*` MCP tools call the same endpoint through a shared local management client. All operations, including initialization and listing, require the selected singleton to be running. Neither adapter starts a server implicitly.

The client rereads the connection per call, requires an exact loopback HTTP origin, refuses redirects, keeps the management token local, and never retries automatically. A transport failure after a mutation is `unknown`; the operation may already have committed. A failed read is `unavailable`. Accepted delivery, completed agent work, and published results remain distinct in the existing interaction service.

## Use from a checkout

Install root and singleton dependencies using their frozen lockfiles, then keep `bun run singleton serve --state-dir /absolute/state` running. The existing Kit wrapper can serve the same operations with its own explicitly selected state directory.

```sh
bun run artifact project init --project /absolute/project --name "My project" --state-dir /absolute/state
bun run artifact project add --project /absolute/project --source artifacts/panel --name "Controls" --state-dir /absolute/state
bun run artifact project register --project /absolute/project --state-dir /absolute/state
bun run artifact project list --project /absolute/project --state-dir /absolute/state
bun run artifact project mount --project /absolute/project --artifact ARTIFACT_UUID --state-dir /absolute/state
```

Create the source folder and its Svelte package before `add`; this operation does not scaffold source. Use IDs from response `data`. `artifact project --help` lists the flags. Unlike the earlier experimental wrapper, these commands require the server even for init/add/list. For MCP, launch the existing adapter with that same state directory and use the corresponding `artifact_project_*` tools.

## Failure and recovery boundaries

Archive is deliberately ordered unmount → manifest flag. Failure before unmount completion leaves the manifest active. Failure after unmount but before saving the flag can leave the runtime stopped while the manifest remains active; inspect and reconcile explicitly. Atomic individual file replacement and writer locks do not make this sequence a distributed transaction.

Direct administrative mount operations still exist for compatibility. The core must refuse to act on a mount whose source/project identity differs from the manifest. Archive, close, and unmount do not cancel an agent turn or delete callback records. Installation/release cleanup remains governed by the separate lifecycle work.

## Completion criteria

- The reusable implementation lives under `src/core`, without transport or framework imports.
- Deterministic tests cover strict input validation, canonical identity, path containment, writer ownership, competing copied IDs, non-destructive lifecycle, and failure visibility.
- The authenticated project endpoint uses the real singleton runtime and respects admission/shutdown ordering.
- CLI and real MCP SDK calls observe and mutate the same project/mount records; uncertain transport outcomes do not trigger retries.
- Existing interaction, compiler/HMR, dependency, and SvelteKit behavior remains covered by appropriate regressions.

This increment establishes a shared project-operation foundation. Promoting all runtime code out of `experiments/`, packaging the launcher, implementing the management UI's write flows, choosing default install/state locations, and defining resource budgets remain later implementation milestones. It is not a production-release claim.

## Verification record

The implementation was developed in three independent worktrees (core, HTTP host integration, and CLI/MCP access), then integrated at `febff54`. The combined root suite passed **48 tests / 285 assertions**; the singleton suite passed **4 tests / 44 assertions**. Root, singleton, and MCP TypeScript checks passed.

The new real SDK ↔ CLI ↔ Chrome verification exercised two project identities through the shared core: init/add/register/list/mount, actual browser interaction, same-document HMR with retained draft/counter, archive with an unaffected neighbor, restore without implicit mounting, stable-route remount, and connection refresh after server restart. Its screenshot was visually inspected. The existing MCP interaction regression, singleton interaction browser suite, and SvelteKit browser suite also passed. These runs used fixture sources and adapters; no new live-agent delivery claim is made.

Reproduce after installing the root and experiment dependencies:

```sh
bun run check
bun test tests
bun run test:singleton
bun run --cwd experiments/singleton check
bun run --cwd experiments/mcp check
bun run verify:project-access
bun run verify:mcp
bun run verify:singleton-interactions
bun run verify:sveltekit
```

The root browser test requires the bundled example UI build (`bun run build:ui`); the Kit browser verifier requires its shell build (`bun run --cwd experiments/sveltekit build`). Private receipts and screenshots remain in ignored `.decompozr/artifact/` directories. Test-owned servers and browsers are stopped by their verifiers.

The installed SvelteKit lifecycle suite passed against the same integrated source commit `febff5404cf798099b70823c43c505fc1b097c97`. A clean archived release built the Kit shell and loaded the new server core. Its installed MCP advertised all 19 tools, including the eight expected project operations, and existing installed health/inspection calls used the same host. Upgrade/rollback, restart, crash recovery, uninstall/reinstall, and source/state preservation passed; all eight owned host processes exited. The new project-operation browser proof above ran from the integrated checkout, separately from this installed-host check.

Independent cross-review found no remaining material blockers in the reviewed project core, API admission/queue integration, CLI routing, or MCP/client transport. This is a bounded implementation milestone; the remaining installation packaging, full management UI, runtime promotion, and resource-policy work is listed in the [implementation sequence](../server-readiness.md#implementation-sequence-and-exit-criteria).
