# Server implementation readiness experiments

Date: September 21, 2026. Status: all seven tracks concluded with bounded evidence; see the [readiness review](../server-readiness.md) for the recommendation and integrated validation. This records experiments, not production delivery.

The user authorized the remaining Svelte experiments and asked for a recommendation on when to start building the actual server. Scope includes the application, repository installation, service lifecycle, and management of project-owned artifacts. Additional frontend frameworks remain deferred.

## Working method

Independent Git worktrees separate the SvelteKit, dependency, and MCP implementation tracks. Each track owns its executable fixtures, verification script, and evidence record. The coordinating agent reviews results, integrates local commits, runs checks across the combined tree, and assigns lifecycle/project-management follow-ups. Parallel checks use independent state directories, ephemeral ports, and temporary project sources. Live-session experiments remain separate from deterministic fixtures.

## Gates

| Track | Question | Required evidence |
| --- | --- | --- |
| SvelteKit foundation | Can one application host provide management pages/routes while preserving dynamic compilation? | One listener and live Vite instance; runtime-added mounts; working scoped HMR, dependencies, and interaction callbacks; explicit built-shell/development-compiler boundary. |
| Dependency compatibility | Can supported CommonJS/mixed dependencies retain source-specific resolution? | Observed failing baseline where applicable, distinct package versions executing in two mounts, a bounded transformation policy, failure/recovery and unchanged neighboring preview. |
| MCP interface | Can MCP and CLI operate on the same singleton records? | Real MCP client/server transport; both directions of mount/request management; validated inputs, truthful failure outcomes, and service-unavailable behavior. |
| Live source edits | Can the exact agent update the mounted source without losing an unrelated draft? | Actual source edit from the bound session, same-document browser change, opted-in draft retention, actual callback, no duplicate submission, neighboring preview usable. |
| Lifecycle/resource run | Do repeated operations release resources and recover predictably? | Bounded duration/cycles; memory/watcher/module/owned-process measurements; failure recovery; graceful restart and conservative abrupt-stop handling. |
| Repository installation | Can a clean checkout become a usable, reversible local installation? | Isolated installation home; pinned/frozen dependencies; explicit release identity; launch/health/stop/restart; upgrade/rollback or documented blocked transition; uninstall preserves user-owned source and records. No modification of the user's global installation in the test. |
| Project artifact management | Can agents manage artifacts independently of the application checkout? | Project-owned manifest and source; safe initialize/register/list/mount/unmount/archive/restore behavior; identity collisions and relocation policy; no silent source deletion; recovery from missing files or stale registrations. |

## Completion and readiness rule

An experiment may conclude with a documented support boundary instead of universal compatibility. Failures must be reproduced and either fixed with regression evidence or explicitly excluded from the proposed first server contract. Do not turn an untested workaround into an adopted requirement.

Before recommending implementation, reconcile results into a concrete first-server scope: runtime/compiler topology, supported dependencies, public operations shared by CLI/MCP, project/artifact identity, install/state locations, ownership and cleanup rules, failure semantics, and remaining exclusions. Run the relevant cross-track checks after integration. Keep experimental code identifiable; completing these gates does not mean the production server has already been built.

Private receipts, session identifiers/capabilities, logs, screenshots, and machine measurements belong under ignored `.artifact/` folders. Summaries and reproducible scripts belong in Git. Automated selections are test inputs, not personal user approval.
