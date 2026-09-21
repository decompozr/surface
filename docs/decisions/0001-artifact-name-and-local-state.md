# Decision 0001: Artifact naming and local state namespace

Date: September 21, 2026.
Status: accepted at the time; product name and default namespace superseded by [Decision 0002](0002-surface-name-and-local-state.md).

## Decision

The product and its server are named **Artifact**. Use that name in product-facing documentation and the future unified server interface. “Singleton” describes the intended architecture: one server instance owns a selected service state directory and hosts multiple project/artifact mounts. It is not a separate product or the server's public name.

The checkout-local state and verification-output base is **`.decompozr/artifact/`**, replacing the earlier `.artifact/` default. This places Artifact's local data under the DecompozR namespace. The earlier path was introduced as a prototype implementation choice, not an explicitly adopted product convention; the user selected the new path during review.

## Current implementation

The existing experiments keep their entry points and isolated subdirectories for now:

| Entry point | Checkout default |
| --- | --- |
| Earlier root CLI prototype | `.decompozr/artifact/` |
| Singleton experiment, shared project commands, and MCP adapter | `.decompozr/artifact/singleton/` |
| SvelteKit foundation experiment | `.decompozr/artifact/sveltekit/` |
| Verification scripts | Named proof directories under `.decompozr/artifact/` |

The `singleton` and `sveltekit` subdirectories distinguish experimental state stores; they do not establish names or layout for the final public server. Do not combine those existing stores merely to align naming. The unified launcher should present Artifact and adopt an explicit state layout when those runtimes are consolidated.

This decision changes default directory paths. Explicit `--state-dir` arguments, explicitly selected installation homes, `artifact.project.json`, `.artifact-project.lock`, and `.artifact-release.json` retain their current meaning and names. The per-project manifest remains versionable; local state and private verification output remain ignored by Git.

## Existing data and scope

Existing `.artifact/` data from other checkouts remains ignored until explicitly migrated. There is no automatic move, merge, or fallback to the old store. An operator can continue using it by supplying its absolute path with `--state-dir`. Persisted source identities and agent callback commands may embed absolute paths, so migration of populated state requires deliberate reconciliation.

Historical experiment records retain the paths used by their actual runs. Updated commands and new verification runs use the new base.

This decision does not choose a machine-wide installation home, adopt OS background-service integration, rename every experimental symbol or script, or declare the experimental host production-ready. Installed releases, durable service state, and project-owned source remain separate ownership concerns.

## Local migration completed

The user subsequently requested the existing checkout directory be physically renamed. Its `.artifact/` directory was moved to `.decompozr/artifact/` after confirming that the destination was absent, no process referenced the old path, the recorded server PID was absent, and saved requests had no unresolved callbacks. The old directory was not left as a compatibility symlink.

The move preserved 3,908 file/symlink entries. Two persisted mount/preview source references and two generated mount symlinks were updated to the relocated source. The original state files were backed up inside the ignored migration record; all other file contents were verified unchanged. Historical receipts were preserved rather than rewritten. Existing stale ownership metadata was retained; migration did not start a server or claim service recovery. Private migration details are under `.decompozr/artifact/migrations/2026-09-21-directory-rename/`.
