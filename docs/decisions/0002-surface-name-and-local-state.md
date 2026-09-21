# Decision 0002: rename the project to Surface

Date: September 21, 2026.
Status: accepted by the user.
Supersedes the product name and default data namespace in [Decision 0001](0001-artifact-name-and-local-state.md).

## Decision

The project, product, and server are named **Surface**. The user selected this name to avoid confusion with Claude's Artifacts. This is a naming decision, not a claim about trademark ownership or global package-name availability.

Use `decompozr/surface` for the private GitHub repository, `@decompozr/surface` for the repository package, `surface` for its CLI and skill, and `surface_*` for MCP tools. The user also explicitly requested moving the main local checkout from `Projects/decompozr/artifact` to `Projects/decompozr/surface`.

The checkout-local data and verification-output base becomes **`.decompozr/surface/`**. The current experimental `singleton/` and `sveltekit/` subdirectories remain distinct stores beneath it. “Singleton” continues to describe architecture, not the public server name.

## Compatibility boundary

“Artifact” remains a valid domain noun for a generated page/component or project-owned definition. This rename does not change artifact IDs, the `artifacts` collection, `--artifact`, or the versioned project schema. Existing `artifact.project.json`, component `artifact.json`, `.artifact-project.lock`, and `.artifact-release.json` names remain readable without a schema migration.

New browser integrations use `createSurfaceClient` and the `virtual:surface-client` / `virtual:surface-preview` modules. Existing `createArtifactClient` and `virtual:artifact-*` imports remain compatibility aliases for already authored components. Internal preview wire identifiers may retain their earlier spelling where changing them would break existing clients. Current examples and instructions use Surface.

The public CLI and MCP names change to Surface; clients that configure an executable, MCP tool name, package name, or skill by its previous name must use the new name. The local installation's owned links are updated as part of this checkout migration. No unrelated tool using the old name may be replaced or removed.

Explicit state directories and installation homes remain explicit. Private local data is moved only after checking process ownership, pending callbacks, and destination collisions. Stored source/project paths and owned links must be reconciled, with original state preserved in the ignored migration record. Historical experiment documents and receipts retain their original names, paths, and observations rather than being rewritten as newly observed evidence.

## Remaining scope

This rename does not implement the remaining launcher, OS service, management UI, schema migration, or resource-budget milestones. The experimental runtime paths and historical worktree names can remain as evidence. The shared core and existing lifecycle behavior must pass their relevant checks under the new public names.

## Completed checkout migration and verification

On September 21, 2026, the main checkout moved to `/Users/scottchu/Projects/decompozr/surface`, and its existing private state moved to `.decompozr/surface/`. The old checkout path, `.artifact/`, and `.decompozr/artifact/` no longer exist in the main checkout. The GitHub repository was renamed to `decompozr/surface` and remains private.

Before moving, the recorded server PID was confirmed absent and no accepted/delivering/unknown callback lacked a result. All 3,911 existing file/symlink entries were retained. Content hashes confirmed that only three operational JSON files and three state symlinks changed; historical receipts and earlier migration backups remained unchanged. Original JSON bytes and a migration receipt are retained locally under `.decompozr/surface/migrations/2026-09-21-surface-rename/`. The stale server ownership record was preserved, not silently cleared.

The migration retargeted 15 owned links in total, including the three state links and historical worktree dependency links. `git worktree repair` reconciled the 12 linked worktrees. The owned Bun package/bin and installed skill links now resolve to the new checkout as `@decompozr/surface`, `surface`, and `skills/surface`; the old owned Artifact links were removed. The installed `surface --help` command and skill validation passed.

The rename passed 48 root tests (286 assertions), four singleton tests (44 assertions), TypeScript/Svelte checks, example and SvelteKit builds, all 19 renamed MCP tools, project CLI/browser operations, HMR, and legacy browser-import compatibility. The external scaffold and installed singleton lifecycle checks also passed. Independent review found no material rename blockers.

After the physical move, the installed SvelteKit lifecycle verifier ran against integrated code revision `30008de20d54831bf74063012f3fda7415fa4745` from the new checkout. Frozen installation/build, installed MCP and browser rendering, stop/restart, fixed-port persistence, failed upgrade handling, mechanical rollback, conservative crash recovery, uninstall protection, and reinstall all passed. All eight host processes created by that verifier exited. Evidence is local under `.decompozr/surface/lifecycle-proof/sveltekit/`. These were fixture tests: no new live agent interaction was submitted, and rollback used distinct revisions with identical source/schema.
