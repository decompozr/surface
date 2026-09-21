# Repository installation and service lifecycle

Date: September 21, 2026. Scope: isolated local installation of the candidate host, with reversible ownership and lifecycle experiments. No user-global installation was changed.

## Questions

Can a pinned repository revision become an executable local installation? Can it start, stop, restart, change selected releases, recover conservatively after an owned process crash, and uninstall without deleting project sources or saved server records?

## Implementation

`experiments/lifecycle/manager.ts` owns a marker-protected installation home. It resolves a local Git ref to a full commit, extracts a clean Git archive into a staging release, requires the root's declared Bun version, and installs root, singleton, and MCP dependencies (when the MCP package is present) with frozen lockfiles and lifecycle scripts disabled. `--host sveltekit` also installs the Kit package from its frozen lockfile and builds the shell. Only successful preparation renames the release into place and atomically changes `active.json`.

The manager starts the installed host through a small runner: `startSingleton` for the singleton host or `startKitFoundation` for the built Kit application. One private Unix socket provides authenticated lifecycle control alongside the host's single application HTTP listener. The owner record carries per-launch identity and a private control secret. Health/stop verify that identity through the socket; saved PIDs are never sufficient authority to signal a process.

The host's registry and interactions live in a separate `state/` directory. A fixed requested port is persisted across subsequent launches; explicit port zero retains ephemeral-port semantics. Upgrade, activation, and uninstall refuse a running or unresolved owner. They do not stop it implicitly.

The manager remains an experimental command in the invoking checkout. Its small runner is copied into the installation home. This is a clean installed application-host proof, not distribution or self-upgrade of the lifecycle tooling.

## Evidence

The lifecycle TypeScript check and both verification modes passed. The singleton baseline was `46b9caf`; the installed SvelteKit candidate was clean Git ref `3abbf73`, including the dependency and MCP integration available at that checkpoint. The suite made a temporary fixture repository from each selected snapshot, then created two actual commits with identical source and a third commit with a deliberate manifest/lock mismatch.

Observed in both host modes:

- A clean Git archive with real root/singleton dependency directories became a running host, without relying on the working checkout's `node_modules`.
- The installed host mounted an external project, prepared its dependencies, and rendered its Svelte component in Playwright without page errors. The installed Kit host additionally rendered `/manage` with that mount; the management screenshot was inspected.
- A real SDK client launched the installed MCP stdio entry with its installed SDK dependencies. Tool discovery, health against the same host instance, and inspection of an explicitly seeded completed-record fixture passed. This fixture is persisted data, not evidence of a new delivery.
- Installation/activation/uninstall attempts during an active owned host were rejected while health stayed usable.
- A wrong lifecycle secret could not stop the service. The correct owner continued to pass authenticated health.
- A failed frozen dependency installation retained the previous `active.json` byte-for-byte and removed incomplete staging payloads.
- A second actual Git revision could be installed and started after explicit stop. Re-selecting the first release restored the same external mount and retained state.
- A persisted fixed port kept the same origin through release changes, restart, rollback, and separate CLI process invocations. The CLI could exit after starting a host; later CLI processes successfully checked and stopped that host.
- Killing only the harness's own live subprocess handle left stale ownership/lock metadata. Restart refused it until explicit recovery.
- A deliberately substituted live PID made recovery refuse the operation without signaling that process. A regular file substituted at the control-socket path caused refusal before any owner/lock/connection file changed.
- Verified dead-owner recovery archived matching stale metadata and enabled restart with the saved mount intact.
- Uninstall removed releases and runtime assets while retaining the registry, a separate saved-state fixture, project source, and project `node_modules`.
- Before uninstall, explicit saved-state fixtures for unresolved accepted/delivering/unknown callbacks prevented executable deletion, including closed requests. Those synthetic fixtures were reconciled by the verifier before the actual uninstall.
- All seven host processes created per suite were confirmed exited. Browser, runner control sockets, temporary checkout, and isolated home were cleaned up by the verifier.

The warm-cache SvelteKit run took approximately 2.75 seconds for initial installation plus build. The sampled new-release launches became ready in approximately 0.8 seconds; repeated launches sampled approximately 0.17–0.26 seconds. These are local measurements, not a startup SLA or a cold-install benchmark. Raw observations and screenshots remain under ignored `.artifact/lifecycle-proof/`.

## What the evidence does not establish

Rollback was mechanical release selection between different commits with identical source/schema. Compatibility across actual schema migrations, downgrade migrations, or different dependency behavior remains unproved. No agent delivery was in flight during the abrupt-stop test, so this suite does not establish delivery reconciliation after an installed-process crash. No live agent was contacted.

The control socket is an additional local endpoint, although there is still one application listener/compiler. The supported contract assumes trusted local repository code and management users. A host containing arbitrary untrusted project scripts is not a sandbox.

Stale recovery is deliberately conservative. Unknown ownership, live/reused PIDs, unexpected control paths, reachable sockets, or mismatched connection identities require inspection. Stale lifecycle-management locks are not automatically recovered. Cleanup after a machine failure midway through metadata archival is not a transactional recovery guarantee.

No global CLI link, skill installation, launchd/login integration, unattended boot, published package, Windows service, cryptographic release attestation, or self-updating installer was tested. The Kit shell is built for the installed host; mounted components still use the development compiler. Root Bun version pinning and disabled dependency lifecycle scripts remain part of this experiment's support boundary.

Graceful stop drains adapter operations; it does not wait for an agent turn to finish. Delivery messages embed an installed release's absolute callback CLI path. Upgrade keeps older releases available. The pilot uninstall guard preserves those executables while saved callbacks remain unresolved, even for closed requests, but it is not a full agent-job tracker or a finalized retention policy. Pending-aware release garbage collection and reconciliation of unknown outcomes remain design work.

## Reproduce

See the [lifecycle README](../../experiments/lifecycle/README.md) for commands and ownership rules. From a checkout with root dependencies installed:

```sh
bun node_modules/typescript/bin/tsc --project experiments/lifecycle/tsconfig.json
bun experiments/lifecycle/verify.ts
bun experiments/lifecycle/verify.ts --repo /absolute/artifact --ref COMMIT --host sveltekit
```

The verifier accepts a clean integrated Git ref so the coordinator can repeat the installed-host proof after merging other experiments. It uses its own temporary fixture repository, home, projects, ports, and process handles.

## Integration review: compiler dependency links

Review extended the lifecycle past uninstall. The original generated workspace retained a `node_modules` symlink into the first release: upgrades could keep using the old compiler dependencies, and uninstall followed by installation of a different revision left a dangling link that caused `EEXIST` on startup.

The singleton now records ownership of its generated dependency link and atomically retargets it to the current compiler installation. The ownership record tracks both sides during replacement. A regular directory or foreign symlink is preserved and rejected, not overwritten. A markerless legacy link can be adopted only when it already matches the current compiler; a different or dangling markerless legacy link requires inspection. This is a narrow generated-workspace migration, not permission to replace arbitrary project dependencies. The lifecycle verifier now includes uninstall → different-revision reinstall and checks the active compiler dependency realpath through release changes.

Review also found that cached release reuse and launch bypassed the fresh-install Bun version check. Reuse, activation, and launch now require both the declared package-manager version and the release's recorded preparation version to match the running Bun. Wrong-version saved fixtures reject all three operations before activation/launch, preserve the active record byte-for-byte, create no owner/server lock, and do not append a host log. These are injected metadata tests, not a second installed Bun binary experiment.

The coordinator reran the full installed SvelteKit/MCP lifecycle suite against integrated commit `c91a245e3cb3ca597bbe907e4a7d3c6f8ef89112`: all checks passed, including dependency-link upgrade/rollback/reinstall, foreign-path preservation, failed-start cleanup, and Bun-pin refusal. All **eight** successfully launched owned host processes exited. This final installed-release run used fixtures and did not contact a live agent.
