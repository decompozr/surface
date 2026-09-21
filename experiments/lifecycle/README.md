# Repository installation and lifecycle experiment

This prototype installs a pinned local Git revision into an isolated home and manages its actual singleton or SvelteKit host. It does not modify the user's global CLI, skills, shell profile, login items, or launchd configuration.

## Verify

From the repository root:

```sh
bun install --frozen-lockfile --ignore-scripts
bun node_modules/typescript/bin/tsc --project experiments/lifecycle/tsconfig.json
bun experiments/lifecycle/verify.ts
bun experiments/lifecycle/verify.ts --repo /absolute/artifact --ref COMMIT --host sveltekit
```

The SvelteKit ref must contain `experiments/sveltekit/server.ts`, its package/lockfile, and the `startKitFoundation` export. The verifier checks dependency-link realpaths on upgrade/rollback, uninstall followed by reinstall at a different revision, and refusal to replace a real directory or foreign symlink. It also checks that failed starts leave no owner, server lock, or connection record. The verifier uses real Git commits in a temporary fixture repository, frozen installations, real host subprocesses, HTTP requests, and Playwright browser checks. It never contacts an agent. Evidence is written under ignored `.decompozr/artifact/lifecycle-proof/<host>/`.

## Commands

Always select an isolated home explicitly through `--home` or `ARTIFACT_HOME`:

```sh
bun experiments/lifecycle/manager.ts install --home /absolute/test-install --repo /absolute/artifact --ref COMMIT --host sveltekit
bun experiments/lifecycle/manager.ts start --home /absolute/test-install --port 4321
bun experiments/lifecycle/manager.ts health --home /absolute/test-install
bun experiments/lifecycle/manager.ts stop --home /absolute/test-install
bun experiments/lifecycle/manager.ts restart --home /absolute/test-install
bun experiments/lifecycle/manager.ts activate COMMIT-sveltekit --home /absolute/test-install
bun experiments/lifecycle/manager.ts recover --home /absolute/test-install
bun experiments/lifecycle/manager.ts uninstall --home /absolute/test-install
```

`install` defaults to `--host singleton`. Installation/activation/uninstall requires a stopped host and resolved ownership metadata; there is no implicit interruption. `restart` is an explicit stop followed by start. After a successful launch, the requested port is saved in `settings.json`; later start/restart uses it when `--port` is omitted. Port zero intentionally selects an ephemeral origin on each launch. Choose a fixed port for stable preview URLs; a conflict fails instead of choosing a different port silently.

The compiler runtime link under `state/workspace/node_modules` is owned through `dependency-link.json`. On release changes or reinstall, the host atomically retargets that owned symlink to the selected compiler dependencies, including when uninstall left the former target dangling. The marker records both sides during replacement so an interrupted rename can be reconciled. A real directory, a foreign symlink, or a marker mismatch is preserved and rejected. A legacy markerless link is adopted only when it already points to the current compiler; a different or dangling legacy target requires inspection rather than automatic replacement.

The application CLI remains at `releases/COMMIT-HOST/experiments/singleton/cli.ts`; supply `--state-dir /absolute/test-install/state` for namespace, mount, and interaction operations. The MCP adapter can use that same state directory. This lifecycle manager does not duplicate those APIs.

## Ownership and layout

- `installation.json` identifies the owned home; a nonempty unowned home is refused.
- `releases/COMMIT-HOST/` contains a clean Git archive, frozen root/singleton/MCP dependencies (MCP when present), optional built Kit shell, and `.artifact-release.json`.
- `active.json` selects a fully prepared release. Failed preparation leaves the prior selection intact.
- `state/` owns the server registry and interactions independently of the selected release.
- `run/` contains the small runner, private control socket, owner record, and host log.
- `settings.json` retains configured port selection. `recovery/` archives verified stale ownership evidence.

The service uses one application HTTP listener. Lifecycle control adds a private Unix socket; it does not add another application server or Vite instance. Health/stop authenticate against its per-launch secret and verify nonce, PID, release, and instance identity. They do not signal a PID copied from disk.

Recovery refuses any recorded live/reused PID and any reachable control socket. It requires matching dead-owner, server-lock, and connection identities, and validates the control path before archiving metadata. It does not recover arbitrary unknown ownership or stale manager-operation locks. A malformed or ambiguous state requires inspection rather than killing processes or deleting locks automatically.

Uninstall removes release payloads, the selected-release pointer, and stopped runtime assets. It retains state, settings, installation identity, recovery records, and all project-owned sources/dependencies. It does not delete the whole home.

Uninstall also refuses unresolved `accepted`, `delivering`, or `unknown` submissions without a result, even if the request is closed: their callback message can still reference a CLI executable in an installed release. Reconcile that work first. A graceful service stop drains adapter operations, not agent turn completion. Upgrade retains older releases; pending-aware release garbage collection is not implemented.

## Boundary

The manager currently runs from the invoking checkout and copies its small runner into the owned home; the application release itself comes entirely from the selected Git revision. Distribution and self-upgrade of the lifecycle tooling are not implemented. Existing prepared releases are reused as owned local artifacts, not re-attested cryptographically on every launch.

Fresh installation, cached-release reuse, activation, and launch require the exact Bun version declared by the release root package; prepared releases must also match their recorded Bun version. Dependency lifecycle scripts are disabled. The SvelteKit shell is built once during installation; the dynamic component compiler remains a development compiler. Unix sockets and process checks make this a local macOS/Unix experiment, not a Windows service manager. The control socket path is limited to 100 characters in this pilot.

Rollback verification uses two different Git commits with identical source/schema. It establishes release selection and state retention, not compatibility across future migrations. The abrupt-stop test kills only a subprocess handle created by the harness, with no agent delivery in flight.
