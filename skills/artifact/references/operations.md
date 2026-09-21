# Service and project operations

Read only the section needed for the current task. Examples run from the resolved Artifact checkout; use absolute script paths from other directories. Project operations now use the shared implementation core; the Kit host and release manager remain experimental entry points. The full public CLI is still being consolidated. Keep the selected state directory consistent across interfaces.

## Project-owned artifact management

Use this when the project needs persistent artifact definitions, multiple named artifacts, or archive/restore. The [shared-core contract](../../../docs/implementation/01-project-core.md) describes current ownership and failure semantics. Start/connect to the selected singleton first; all these operations require that service:

```sh
bun src/cli/index.ts project init --project /project --name "My project" --state-dir /absolute/state
bun src/cli/index.ts project add --project /project --source artifacts/panel --name "Controls" --state-dir /absolute/state
bun src/cli/index.ts project register --project /project --state-dir /absolute/state
bun src/cli/index.ts project list --project /project --state-dir /absolute/state
bun src/cli/index.ts project mount --project /project --artifact ARTIFACT_UUID --state-dir /absolute/state
```

Each response has `version`, `ok`, `status`, and `data` or structured `error`. Read returned IDs from `data`; do not regenerate them. `init` creates only the manifest in an existing root and refuses overwrite. `add` records an existing source folder; create source with ordinary file tools first. Its source argument is project-relative. The manifest is versionable and keeps paths relative. Project/artifact UUIDs are identity; names are labels. Use `data.artifacts[].route` from list, or `data.namespace`/`data.name` from mount, for singleton interactions. Bind the canonical enclosing project root, not the nested source directory.

`archive --artifact ID` unmounts before setting the archive flag and preserves source, dependencies, lockfiles, and records. `restore --artifact ID` checks source availability and clears the flag without mounting implicitly; its returned runtime is observed status, not a promise that it is stopped. These commands also require `--project` and the same state directory. Do not remove source as a substitute for archive.

`list` separates the archive flag, source availability, and `runtime` (null if no runtime record exists). Inspect `runtimeIdentityMatches` when reconciling direct administrative changes. Copying the same project UUID to a different canonical root is rejected on binding; absolute aliases of the same root are canonicalized. Do not silently regenerate IDs, rebind namespaces, or erase the ledger to bypass conflicts. Relocation/adoption is not implemented.

Project and ledger locks protect different writers; inspect ownership on a lock error rather than automatically deleting it. Archive's runtime change and manifest write are separate steps. If interrupted or failed, inspect both before retrying; an active manifest entry may already have an unmounted preview. The client never retries mutations. A transport `unknown` outcome requires reconciliation.

The earlier `experiments/projects/cli.ts` remains a comparison fixture with direct filesystem writes. Use the new shared operations for current work; do not mix both writers as independent authorities.

## SvelteKit application-shell candidate

Use this when the user requests the Kit foundation experiment or its management overview. Follow the [Kit guide](../../../experiments/sveltekit/README.md) to install/check/build, then:

```sh
bun experiments/sveltekit/server.ts --state-dir /absolute/state --port 4319
```

The built handler serves `/manage` and read-only `/kit-api/status` within the same process/listener as the live Vite component compiler. Keep using the existing authenticated singleton CLI/MCP APIs for mutations. The overview provides no browser management credentials. Do not run `build/index.js` as a substitute: that starts an adapter-only server without the integrated component runtime.

Mounted source uses CSR; SSR of the management page does not establish SSR for mounted code. Whole SvelteKit applications and arbitrary project routing/configuration are not supported by this proof. Component edits use HMR, while shell changes require rebuilding and restarting. A successful Kit build is not a production bundle of future mounts.

## MCP adapter

Use already available Artifact tools when the task calls for MCP. To configure a requested connection, read the [MCP guide](../../../experiments/mcp/README.md); the host launches:

```sh
bun /absolute/artifact/experiments/mcp/server.ts --state-dir /absolute/state
```

The adapter connects to an existing singleton and rereads its connection for each call. It does not start a host, replace the registry, or require a second Vite instance. No MCP-host configuration is installed automatically by the experiment.

Tools cover health, namespace, mount/unmount, list, bind, request, inspect, send, result, and close. The eight `artifact_project_*` tools add init/add/list/register/mount/unmount/archive/restore through the shared project core; they use `projectRoot`, `artifactId`, `source`, and `name` as appropriate. Their versioned outcomes match `artifact project`. Important argument differences from CLI flags: mount uses `projectRoot`, bind uses `threadId`/`socketPath`, interactions use `bindingId`/`requestId`, and request schemas are JSON objects rather than schema-file paths. Discover the tool's actual schema before calling it. `artifact_list` selects `kind: "mounts"` or `"requests"`.

Inspect both transport/tool errors and the structured `ok`/`status` outcome. HTTP 200 can still represent failed preparation or failed/unknown delivery. A mutation transport failure is `unknown`, not proof that nothing happened; reconcile existing records before deciding whether to retry. Retain the response ID. The adapter never retries mutations.

A request result intentionally contains a private `previewUrl` capability; list/inspect omit credentials. The connected MCP host has management privileges. Tool annotations and namespace names do not impose access control. This thin adapter preserves core semantics; fixture interoperability tests are not another live-agent delivery proof.

## Repository installation and service lifecycle

Use this only when the task calls for installing/managing a service, rather than creating a single preview on an existing one. Follow the [lifecycle guide](../../../experiments/lifecycle/README.md) and explicitly select an owned installation home and exact repository revision:

```sh
bun experiments/lifecycle/manager.ts install --home /absolute/artifact-home \
  --repo /absolute/artifact --ref COMMIT --host sveltekit
bun experiments/lifecycle/manager.ts start --home /absolute/artifact-home --port 4321
bun experiments/lifecycle/manager.ts health --home /absolute/artifact-home
```

`--host singleton` is also supported. Releases are pinned Git archives; local uncommitted edits are not installed. The lifecycle manager requires the repository's exact Bun version and frozen dependencies. It does not alter global CLI/skill installation, shell profiles, or OS login/service configuration.

Use `releases/COMMIT-HOST/experiments/singleton/cli.ts` with `--state-dir /absolute/artifact-home/state` for application operations; MCP and project management must address that same state directory. A fixed port is retained for later start/restart; port 0 intentionally changes origins. Port conflicts fail rather than silently choosing another origin.

`stop` and `restart` operate through verified private lifecycle control, not a PID taken from a saved file. Install/activate/uninstall require a stopped host with resolved ownership metadata. `recover` handles only verified dead-owner metadata; ambiguous ownership requires inspection. Do not kill a process or erase locks merely because a recorded PID exists.

Uninstall preserves service state and project sources, but refuses unresolved accepted/delivering/unknown submissions without results—even if closed—because callbacks may still reference an installed release's CLI. Reconcile pending work first. Graceful stop drains delivery operations, not the agent's full turn. Upgrade retains earlier releases; pending-aware release cleanup is not implemented.

The tested release rollback uses identical source/schema across two commits; do not infer future schema-migration compatibility. Lifecycle tooling distribution/self-upgrade, Windows service management, mounted-code SSR, and multi-day reliability remain outside this pilot.
