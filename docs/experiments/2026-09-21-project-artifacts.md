# Project-owned artifact management

Date: September 21, 2026 (America/Toronto).

Status: the bounded CLI, browser, lifecycle, and concurrent-ownership experiment passed. This supplies a candidate project-management contract for the actual server design; command names and the manifest schema are experimental.

## Question

Can a project own several durable artifact definitions while one shared singleton manages their previews, without conflating names, paths, project identities, or runtime state?

## Implemented contract

`experiments/projects/` provides `init`, `add`, `list`, `register`, `mount`, `unmount`, `archive`, and `restore`. It calls the existing singleton HTTP API using the selected local connection; it does not change core routes, copy source into the Artifact checkout, or start a development server per project.

The versionable project file `artifact.project.json` contains a project UUID/name and artifact UUIDs/names, relative source paths, and archive flags. No absolute roots or private credentials belong in that manifest. Generated namespaces and mount names use UUIDs; labels can change without changing route identity. A private ledger in each singleton's state pins project UUIDs to canonical roots, with copying/relocation rejected when it conflicts with that local binding.

`init` creates only the manifest in an existing project. `add` records an existing source folder with a package manifest. Mounting performs the existing automatic dependency preparation. Archive first unmounts and then records the archive flag while retaining source/dependencies; restore only clears that flag and requires a later explicit mount. Neither command deletes source.

## Observations

| Gate | Observed result |
| --- | --- |
| External ownership | Temporary projects outside the application checkout retained their sources, relative manifests, local `node_modules`, and Bun lockfiles. |
| Same labels in different projects | Two “Controls” artifacts received different project/artifact UUID routes and mounted independently. |
| Nested source identity | The server received the enclosing canonical project root and nested artifact source separately. |
| Browser behavior | Chrome rendered the mounted Svelte component; entered text remained visible and clicking changed the counter from 0 to 1. |
| Label rename | Editing a manifest label retained its artifact UUID and namespace/mount route. |
| Archive/restore | Archive made the preview unavailable, set its flag, and preserved dependencies. Archived mounting was rejected. Restore left the preview unmounted until explicit mount restored the stable route. |
| Missing source | List reported unavailable; mount/restore rejected it. The entry could still be archived, and returning the original folder enabled restoration. |
| Path/name collisions | Existing-manifest overwrite, duplicate name/source, traversal, and a symlink escaping the project were rejected. |
| Copied project identity | Registering/mounting a copied manifest under another root was rejected rather than rebinding its existing namespace. |
| Exclusive ownership | A held project lock blocked a competing CLI mutation, and a held ledger lock blocked registration without corrupting the manifest. Two concurrent roots sharing a copied UUID produced exactly one ledger owner. |
| Server restart | The singleton restored active mounts; the project CLI retained UUID route identity and the browser rendered the component again under the current origin. |
| Normal user files | README, component source, package manifest, and the existing Bun lockfile remained byte-for-byte unchanged across management and restart. |

The rendered form screenshot was visually inspected. Machine-readable observations and `project-panel.png` are retained in ignored `.artifact/project-management-proof/`. All sources in this run were temporary test fixtures; no personal user choice or live agent callback is claimed. Existing callback semantics are reused through the unchanged server and were not re-proven by this management-only run.

## Ownership and recovery findings

A per-project lock alone is insufficient. Two different roots with the same copied UUID have different project locks but compete for the same server-local binding. The implementation therefore acquires project ownership first, then a short-lived ledger lock, and never reverses that order. Competing ownership is a visible failure, not an implicit retry or last-writer-wins update.

Atomic manifest and ledger replacement protects individual file updates. It does not make a server unmount plus manifest flag update one transaction. A crash between those actions can leave a stopped preview with an active manifest entry. This direction preserves files and requires explicit reconciliation; it cannot silently delete or remount source. Abrupt crash/fsync durability was not established by the concurrent-writer test.

The versionable manifest deliberately avoids machine-local paths. The local ledger supplies continuity for one singleton. The pilot rejects relocation or adoption of the same identity at a different root rather than guessing whether a copied checkout represents the same project. Migration, cross-machine identity policy, and automatic reconciliation need an explicit later contract. Direct use of the underlying administrative API remains possible and is not made manifest-authoritative by this wrapper; mismatched existing mount identity is rejected when the manager encounters it.

A manifest's active/archive flag is project organization, not a claim that a server is currently running. Source availability is also separate from mounted runtime status. Stable namespace paths do not promise an unchanged URL if the server origin/port changes.

## Validation and reproduction

```sh
bun run --cwd experiments/projects check
bun experiments/projects/verify.ts
```

TypeScript checking and the final CLI/browser/concurrency verification passed. Temporary servers and source trees were cleaned up. Follow the [package guide](../../experiments/projects/README.md) for executable setup and usage.

## Design recommendation

Carry forward project-owned manifests, stable IDs independent of labels, canonical-root binding, visible source availability, and non-destructive archive/restore. Preserve explicit runtime operations and writer ownership in the actual server design. Before making this a public interface, decide the manifest migration/relocation policy, service-owned catalog versus project-manifest authority, and recovery UX for interrupted multi-step operations. Those open decisions do not require guessing another framework's contract; the pilot stays within the current Svelte scope.
