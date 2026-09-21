# Project-owned artifact management experiment

A small CLI above the existing singleton APIs. Sources stay in the caller's project; a versionable `artifact.project.json` records stable project/artifact UUIDs, human labels, relative source folders, and archive flags. The CLI does not run per-project servers or copy source into the Artifact checkout.

These command names and the manifest format are experimental, not an adopted public interface.

## Use

Install the repository's root and singleton dependencies as described in the [singleton guide](../singleton/README.md), then start or connect to its existing server. The project directory and source folder must already exist. `init` creates only the manifest, never overwrites one, and does not scaffold or install source dependencies.

```sh
bun experiments/projects/cli.ts init --project /absolute/my-project --name "My project"
bun experiments/projects/cli.ts add --project /absolute/my-project \
  --source artifacts/panel --name "Controls"
bun experiments/projects/cli.ts list --project /absolute/my-project
bun experiments/projects/cli.ts register --project /absolute/my-project \
  --state-dir /absolute/singleton-state
bun experiments/projects/cli.ts mount --project /absolute/my-project \
  --artifact ARTIFACT_UUID --state-dir /absolute/singleton-state
```

Use the artifact UUID from `add` or `list`. The mounted folder needs its own `package.json` and supported Svelte component source. Mount-time preparation retains the existing singleton's Bun lockfile and dependency rules. `register` binds project identity to this server without mounting or installing anything; `mount` also registers when necessary.

Names are display labels. Namespace `p-<project UUID>` and mount name `a-<artifact UUID>` derive from stable identities, so two projects can both contain a label such as “Controls.” The project-root and selected artifact IDs remain distinct from path and display name. Manifest labels can be edited with ordinary file tools when no management command is running; changing a label does not change the generated route. Keep IDs intact. Source path changes after a mount require explicit reconciliation and are not silently adopted.

## Lifecycle

```sh
bun experiments/projects/cli.ts unmount --project /absolute/my-project \
  --artifact ARTIFACT_UUID --state-dir /absolute/singleton-state
bun experiments/projects/cli.ts archive --project /absolute/my-project \
  --artifact ARTIFACT_UUID --state-dir /absolute/singleton-state
bun experiments/projects/cli.ts restore --project /absolute/my-project --artifact ARTIFACT_UUID
```

- `unmount` makes the preview unavailable and retains its active manifest entry, source, dependencies, and records.
- `archive` first unmounts, then sets the archive flag. It does not move or delete files and never deletes `node_modules` or lockfiles. It requires the selected singleton to be available so the runtime outcome can be reconciled.
- `restore` requires an archived entry and an available valid source, clears the flag, and leaves it unmounted. Run `mount` explicitly afterward. Calling it on an already active entry fails without claiming a change in runtime state.
- `list` works without the server and reports source availability separately from the archive flag. Missing source remains a recorded artifact; mounting/restoring it fails until the original source is available.

The existing server restores its registered active mounts on restart. The manifest is desired project organization, not a live process-status snapshot. A failed operation never implies that a browser was updated; inspect the actual mount response and preview.

## Identity, paths, and ownership

The manifest stores relative paths and can be committed with the project. Sources must resolve inside the canonical project root, must contain a package manifest, and may not duplicate or overlap another artifact source. Parent traversal, escaping symlinks, duplicate labels within one project, and duplicate IDs are rejected. The manifest itself must be a regular project-owned file, not a symlink.

A private `project-bindings.json` ledger in the selected singleton's state directory records project UUID → canonical root. Reusing that UUID from a copied/relocated checkout on the same server is rejected. Migration/adoption is deliberately unsupported in this pilot; do not delete the ledger or change IDs to bypass an identity conflict without deciding the intended project relationship. A new server with no prior ledger has no cross-server identity history.

Manifest mutations hold `.artifact-project.lock` in the project; local binding mutations hold `project-bindings.lock` in singleton state. Acquisition order is project lock, then ledger lock. A competing operation fails visibly; it does not silently retry or overwrite another writer. The lock records its owner PID. After an abrupt crash, inspect that process before manually recovering the specific stale lock. Generated lock files are transient local state and should not be committed. The tool does not rewrite the project's `.gitignore`.

Writes use temporary files and atomic rename. Runtime unmount and manifest archiving are separate operations, not a distributed transaction: a crash after unmount but before the flag write can leave an active manifest entry with a stopped preview. An explicit later mount or archive reconciles it. No source deletion is part of recovery.

## Verify

Requires the installed root/singleton dependencies and Chrome:

```sh
bun run --cwd experiments/projects check
bun experiments/projects/verify.ts
```

The verification creates external temporary projects, runs actual CLI commands, mounts and interacts with a Svelte form in Chrome, then checks archive/restore, restart, source preservation, collisions, source loss, copied identities, and competing manifest/ledger writers. It does not contact a model session. Evidence lives in ignored `.artifact/project-management-proof/`; all temporary projects and the test server are cleaned up.

See the [experiment record](../../docs/experiments/2026-09-21-project-artifacts.md) for measured outcomes and remaining scope.
