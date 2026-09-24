# First-server contract: three bounded experiments

Status: implemented and verified as experiments. These findings do not promote the runtime, launcher paths, or backend declaration to a supported production API.

## Questions and outcomes

| Question | Observed result | Remaining decision |
| --- | --- | --- |
| Can one installed entry point operate independently of the source checkout? | Yes. A bundled executable launcher manages an installed built SvelteKit host and shared project operations from an unrelated cwd after the fixture checkout moves. One HTTP listener serves the shell, mounted Svelte components, and backend operations. | Adopt distribution, installation defaults, default port, stable command coverage, and runtime consolidation. |
| Can lifecycle distinguish code rollback from data compatibility? | Yes, for an experimental JSON preferences store. Explicit migration changes schema 1 to 2; a release that reads only schema 1 refuses activation. A retained, hash-checked backup can restore exact schema-1 bytes, then rollback succeeds. | Actual registry, interaction, binding, and project-ledger migrations need their own schema contracts and interruption evidence. |
| Can a project declare an optional backend without eager SQLite? | Yes. A separate project-owned declaration supplies an entry and named operations. No declaration means no backend. Inert declared backends remain database-free until an authorized valid data operation. | Decide supported declaration/API, capability discovery, multiple mounts, process/execution budgets, and backend code reload. |

## Implementation

[Source and reproduction commands](../history/retired-experiments/server-contract.md) live in `experiments/server-contract/`. The experiment composes existing ownership-aware lifecycle management, the built SvelteKit shell, the singleton resource hook, shared project operations, and the project-owned lazy SQLite fixture.

The existing installation manager gained optional pre-activation/start validation and a stopped-only state-operation hook sharing its management lock. Launcher preparation runs under that lock before release activation. Existing singleton and SvelteKit callers retain their defaults. The Kit wrapper now composes the optional application/resource hooks. No global CLI links, user defaults, login services, or production project files are changed.

### Installed entry point

Candidate home layout:

```text
Surface Home/
  bin/surface          executable link to bundled tooling
  tooling/<release>/   launcher bundle and owned-process runner
  releases/<release>/  pinned source, frozen dependencies, built shell
  state/               durable service metadata
  run/                 owner, private control socket, host log
  settings.json        saved port
```

Home resolution is explicit `--home`, then `SURFACE_HOME`, then a platform candidate: macOS `~/Library/Application Support/Surface`, or Linux `$XDG_DATA_HOME/surface` with `~/.local/share/surface` fallback. Platform paths are unit-tested without creating real default installations. The real installed run uses a temporary home containing spaces and an explicitly chosen fixed port. It does not select a production default port.

The installed launcher covers lifecycle, explicit migration/restore, private backend access inspection, and shared project commands. It is bundled from the pinned installed release and requires Bun on PATH for its executable entry. It remains outside removable release payloads, so it can reinstall after uninstall. It is not yet the full stable CLI/MCP/skill distribution. Tooling and release pointers are separate writes; crash-atomic upgrades and compatibility of future launcher versions are not proved.

### Compatibility fixture

The experiment adds only `state/experimental-preferences.json`:

```text
schema 1: { version: 1, workspaceLabel: "Local workspace" }
schema 2: { version: 2, workspace: { label: "Local workspace" } }
```

Fixture release A declares schema-1 reading; B declares both 1 and 2. Startup initializes schema 1 only when absent. Installation, activation and startup validate the declared reader against existing bytes. Upgrade does not silently migrate.

Explicit stopped-only migration retains the original bytes and SHA-256 provenance before atomic file replacement. Injecting failure before replacement leaves the original file unchanged. Restore requires the current file to match the recorded post-migration hash; it rejects subsequent changes instead of discarding them. This is a bounded explicit restore, not a general downmigration or concurrent merge. Power-loss durability, fsync, and crash recovery between every write are not established.

This is a real file migration fixture, not a migration of the existing registry/interaction schemas. It keeps service metadata in JSON. It does not adopt a default Surface SQLite database and never migrates project databases.

### Optional backend declaration

Project file `surface.backend.json`, outside mounted browser source:

```json
{
  "version": 1,
  "api": 1,
  "entry": "backend.ts",
  "operations": ["describeProject", "listScenarios", "saveScenario"]
}
```

The backend exports `apiVersion = 1` and an inert `createProjectBackend()` factory providing synchronous `invoke(operation, input)` and `close()` (which may be asynchronous). The fixture additionally exposes read-only acquisition diagnostics. Declaration keys, versions, operation names, duplicates, canonical containment and browser-source separation are checked before loading. Unsupported declarations and escaped/symlinked entries are rejected. The named-operation allowlist is checked before invocation; there is no arbitrary SQL endpoint.

Management-authenticated access inspection returns a fresh capability per mount. Requests are bounded, scoped, validated, and checked again after body acquisition. Unmount revokes access immediately. Successful close releases project ownership; failed close keeps ownership until retry succeeds. A completed old close cannot release a later mount's ownership.

Project code remains trusted. Declaration checks are not a sandbox, and an inert factory is a behavioral obligation rather than something Surface can enforce against arbitrary module side effects. The tested SQLite fixture meets it. One backend mount per canonical project, restart-required backend edits, synchronous operations and no slow-query isolation remain deliberate limits. The route prefix `/project-db/` is fixture compatibility, not a final API name.

## Verification and evidence

The end-to-end verifier snapshots tracked source plus this experiment's new source into temporary Git commits; records every source content hash and fixture revision; builds actual pinned releases; invokes CLI subprocesses; and uses Chrome for the shell and project UI. Fixture hashes identify the test inputs, not published production releases.

Observed gates:

- Executable launcher works with an unrelated cwd and moved fixture checkout. Explicit home wins over a conflicting environment value. A busy requested port fails without fallback or stale ownership; successful restarts retain the configured origin.
- Four projects register and mount through the installed shared project CLI: two used backends, one declared but unused backend, and one backend-free UI. Local browser interaction/drafts, management inspection, a non-data action, invalid input, an undeclared action and a wrong project's token leave SQLite unopened and uncreated.
- Explicit first Save and Load acquire separate project databases. Inspection reports one acquired connection; project rows remain isolated. Unmount revokes the old capability. Remount/restart do not open an existing database until demand. File-descriptor inspection independently checks SQLite handles.
- Installed shell and project screenshots show real browser rendering and saved data. The original seven-gate live agent callback proof is not repeated here; no live agent messages are sent.
- Invalid compatibility and broken-launcher candidates fail before active-release replacement. Migration while running is refused. Schema-2 rollback to A is refused without changing active/data. B starts with schema 2. Changed data blocks restore; an explicit exact restore permits A to start again.
- An unresolved accepted callback blocks uninstall even when marked closed. Successful uninstall preserves state, source and SQLite, plus the launcher required for reinstall. Reinstallation uses that launcher and preserves the original endpoint and saved project row.
- All five successfully started owned hosts exit. The never-used and backend-free projects still have no data directory at the end.

The combined core, singleton, SQLite-acquisition and contract suites passed **58 tests / 368 assertions**. Root, contract and lifecycle TypeScript checks passed; SvelteKit checking reported zero errors and warnings. The installed verifier passed with five owned hosts confirmed exited; the built shell was compiled separately for each fixture release.

Private machine evidence is retained under `.decompozr/surface/server-contract-proof/`: `result.json`, `source.json`, `management.png`, and `installed-project.png`. Temporary installation fixtures are retained for inspection. Unit tests additionally cover failed pre-replacement migration, malformed declarations/factories, and close-failure ownership retry.

## Decision proposal

Use the installed entry point and explicit compatibility gate as the basis for the next implementation step. Keep backend declarations separate from artifact manifests and preserve the adopted lazy SQLite rule. Before promoting these experiments, choose the public home/port/command contract, define migrations for actual service stores, and consolidate the tested runtime paths. This experiment provides evidence for those choices; it does not mark Milestone 2 complete.
