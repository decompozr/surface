# First-server contract experiments

Historical record: this experiment is retired. Commands and paths below describe the original run, not current setup. Source is preserved at Git revision `2b6a4c7`. Current verification belongs to `tests/` and application tests.

Historical record: this installer experiment was retired on September 24. Its executable source is preserved in Git at `492a09a`; the current CLI supports only the Surface host. Commands below describe the earlier experiment and are not current instructions.

Status: implemented and verified; see the [findings](../../experiments/2026-09-21-server-contract.md). Three bounded experiments, not adoption of a production launcher or backend API.

## Gates

1. **Location and entry point.** Install a pinned Git release and a self-contained launcher into an isolated home. Invoke the installed launcher from an unrelated cwd after the fixture checkout is unavailable. Verify explicit `--home` precedence, platform-default path candidates without writing there, a home containing spaces, fixed-port restart, and visible port conflicts. Never edit global links, PATH, login items, or services.
2. **Lifecycle and compatibility.** Reuse the ownership-aware installation manager. Add pre-activation/start compatibility checks for a small real versioned service-preferences store. Exercise schema-1 to schema-2 migration, a retained backup, failure before atomic replacement, incompatible rollback refusal, safe explicit restore, unresolved-callback uninstall refusal, and reinstall while retaining project data. This does not prove migration of Surface registry/interaction schemas.
3. **Optional project backends.** Read a project-owned experimental declaration, resolve a contained backend entry outside browser source, validate API version and factory contract, route named operations with mount-scoped access, and close resources on unmount/stop. Verify no-backend and unused-backend projects remain database-free across installed lifecycle operations. Keep SQLite lazy and project schemas outside service migration.

Candidate declarations live in `surface.backend.json` (separate from existing artifact manifests) and accept only version 1 with a relative entry, API 1, and an explicit operation allowlist. One active backend mount per project is the experiment limit. Backend module code is trusted, factory construction must be inert, backend changes require restart, and synchronous execution has no slow-query isolation guarantee.

The launcher candidate keeps `releases/`, `state/`, `run/`, `tooling/`, and `bin/` under one selected home. macOS Application Support and Linux XDG data-home defaults are path candidates tested without creating real user installations. A metadata-only experiment store remains JSON. Selecting SQLite for Surface metadata is out of scope.

## Verification

```sh
bun run check:server-contract
bun test experiments/server-contract/contract.test.ts
bun run verify:server-contract
```

The end-to-end verifier snapshots tracked source plus current task changes into a temporary Git fixture, builds actual installed SvelteKit releases, uses real CLI subprocesses and Chrome, and retains private evidence under `.decompozr/surface/server-contract-proof/`. No live agent callbacks are sent. The exact fixture commits and source content hashes are recorded; they are not production release identities.

## Isolated manual use

Use a pinned commit containing this experiment and a short temporary home. The Unix control socket currently limits the full socket path to 100 characters.

```sh
bun experiments/server-contract/launcher.ts install --home /tmp/surface-demo --repo /path/to/surface --ref FULL_COMMIT
/tmp/surface-demo/bin/surface start --home /tmp/surface-demo --port 4319
/tmp/surface-demo/bin/surface status --home /tmp/surface-demo
/tmp/surface-demo/bin/surface project init --home /tmp/surface-demo --project /path/to/project
/tmp/surface-demo/bin/surface project add --home /tmp/surface-demo --project /path/to/project --source ui --name Scenarios
/tmp/surface-demo/bin/surface project register --home /tmp/surface-demo --project /path/to/project
/tmp/surface-demo/bin/surface project mount --home /tmp/surface-demo --project /path/to/project --artifact ARTIFACT_ID
/tmp/surface-demo/bin/surface stop --home /tmp/surface-demo
```

`project` uses the shared authenticated operation API and requires the running installed host. Backend `access` output contains private mount capabilities; do not publish it. `upgrade` uses `--repo` and `--ref`; `rollback` uses an installed `--release`. `migrate` explicitly transforms only the experimental preferences fixture; `restore --backup ID` checks its recorded hash before restoring. These operations and uninstall require a stopped host. `uninstall` retains state, project files and the bundled launcher.
