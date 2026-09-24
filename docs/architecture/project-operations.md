# Shared project operations

The Surface-owned project service provides one operation contract to CLI, HTTP and MCP. [Workspace service](workspace-service.md) owns identity and service selection; this document owns manifest operations and mutation ordering.

## Ownership and authority

- The project owns its versioned `artifact.project.json`, artifact source, dependency declarations, lockfiles, and installed dependencies. The manifest is authoritative for artifact identity, labels, relative source definitions, and archive flags.
- The service owns its private project binding ledger and runtime registry. The low-level service pins project IDs to canonical roots; the public workspace host uses a shared project/workspace ledger through the optional identity resolver. The runtime registry describes observed mount lifecycle; it does not overwrite project definitions.
- Project and artifact UUIDs are stable. Labels do not determine route identity. An absolute project-root alias is canonicalized before identity checks; copying the same UUID to a different canonical root remains a conflict. The public workspace host additionally recognizes proven linked Git worktrees under the same project ID, using distinct workspace scopes. Relocation requires explicit reconciliation.
- All implemented project operations enter the authenticated singleton and its existing mutation queue. Core writer locks retain the project-then-ledger acquisition order. The CLI and MCP adapter never write project manifests or the ledger themselves.

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

The new CLI command is `surface project OP --project ROOT --state-dir STATE`, with operation-specific flags. The public CLI now defaults to shared installation state and infers the Git project root from cwd. Pass an explicit state directory to address a historical singleton/Kit store; its experiment CLI retains the old checkout default. See [public entry selection](workspace-service.md). The eight `surface_project_*` MCP tools call the same endpoint through a shared local management client. All operations, including initialization and listing, require the selected singleton to be running. Neither adapter starts a server implicitly.

The client rereads the connection per call, requires an exact loopback HTTP origin, refuses redirects, keeps the management token local, and never retries automatically. A transport failure after a mutation is `unknown`; the operation may already have committed. A failed read is `unavailable`. Accepted delivery, completed agent work, and published results remain distinct in the existing interaction service.

## Use from a checkout

Follow the [page authoring guide](../../skills/surface/references/pages.md). CLI and MCP send the same authenticated project operation; they do not implement independent manifest mutation.

## Failure and recovery boundaries

Archive is deliberately ordered unmount → manifest flag. Failure before unmount completion leaves the manifest active. Failure after unmount but before saving the flag can leave the runtime stopped while the manifest remains active; inspect and reconcile explicitly. Atomic individual file replacement and writer locks do not make this sequence a distributed transaction.

Low-level mount operations are internal host/test mechanisms. The core must refuse to act on a mount whose source/project identity differs from the manifest. Archive, close, and unmount do not cancel an agent turn or delete callback records. Installation/release cleanup remains governed by the separate lifecycle work.

## Completion criteria

- The reusable implementation lives under `apps/surface/src/lib/server/services`, with transport and host integration outside the operation layer.
- Deterministic tests cover strict input validation, canonical identity, path containment, writer ownership, competing copied IDs, non-destructive lifecycle, and failure visibility.
- The authenticated project endpoint uses the real singleton runtime and respects admission/shutdown ordering.
- CLI and real MCP SDK calls observe and mutate the same project/mount records; uncertain transport outcomes do not trigger retries.
- Existing interaction, compiler/HMR, dependency, and SvelteKit behavior remains covered by appropriate regressions.

## Verification record

Run `bun run verify:project-access` for real CLI/MCP/browser project operations and `bun run verify:surface` for installed workspace lifecycle. App tests cover manifest validation, path containment, writer ownership and failure handling. Historical integration checkpoints and their limits remain in [history](../history/2026-09-24-workspace-boundaries.md); they do not prove later revisions.
