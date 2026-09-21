# First-server implementation readiness

Date: September 21, 2026 (America/Toronto).

## Recommendation

Start building the first actual server within a bounded local Svelte contract. The seven planned experiments answered the architectural questions needed to begin implementation, including repository installation, service lifecycle, and project artifact ownership. They do not establish that the experimental entry points already constitute a production server.

The recommended foundation is Bun + TypeScript, a prebuilt SvelteKit management shell, and one live Vite/Svelte compiler inside one singleton process and application HTTP listener. Keep a common operation layer behind CLI and MCP. Preserve project-owned source/dependencies and separate installed application releases from durable service state. Additional frameworks remain deferred.

The main operational limit is retained compiler metadata under continuous new-source churn. The bounded run supports ordinary local iteration; it does not support an indefinite-daemon promise. Resource observability, a supported operating budget, and an explicit restart/recreation policy belong in the first-server implementation. A compiler restart can require full refresh and lose ephemeral preview state; it must not be presented as transparent HMR.

## Completed experiment gates

| Gate | Evidence | Scope of conclusion |
| --- | --- | --- |
| SvelteKit foundation | [Built shell and Chrome proof](experiments/2026-09-21-sveltekit-foundation.md): dynamic mounts, same PID/Vite, one TCP listener, scoped HMR and callbacks | Viable management shell; mounted components use CSR and a live development compiler. No arbitrary mounted Kit application or mounted SSR. |
| Dependency compatibility | [Browser proof](experiments/2026-09-21-dependencies.md): distinct lodash versions, mixed ESM/CommonJS, runtime-added package, failure/recovery | Browser-ready ESM plus explicit source-scoped JavaScript-only prebundles. Shared pinned Svelte; unsupported assets, builtins, native installation, and general dynamic require remain excluded. |
| MCP and CLI | [Real SDK stdio proof](experiments/2026-09-21-mcp.md): both interface directions, strict inputs, truthful failure/unknown status, service restart | Existing singleton mount/interaction operations share records; MCP does not start the service. Project-manifest and release-manager operations are not yet MCP tools. |
| Live source edits | [Exact-session proof](experiments/2026-09-21-live-source-edit.md): agent changed one column to two, actual result CLI succeeded, document and opted-in draft survived | Actual source action and callback were separately observed. Automated submitted values were test inputs, not personal user choices. |
| Resource/lifecycle run | [30 cycles over 180.115 seconds](experiments/2026-09-21-lifecycle-resources.md): neighbor usable, watcher/transform cleanup, no owned descendants after shutdown | Repeated source identities stabilized. New identities retained Vite/Chokidar metadata; longer-duration and larger-workload stability remain unproved. |
| Repository installation | [Clean pinned Git releases](experiments/2026-09-21-installation.md): frozen dependencies, built Kit, installed MCP, launch/stop/restart, failed upgrade, rollback, crash recovery, uninstall | Isolated local installation without changing global setup. Rollback covers equal-schema commits; no migration, launchd, self-updating launcher, or installed delivery-in-flight crash guarantee. |
| Project artifact management | [CLI/browser/concurrency proof](experiments/2026-09-21-project-artifacts.md): stable UUIDs, canonical binding, archive/restore, missing source, copied identity conflict, restart | Versionable project-owned manifest and non-destructive lifecycle are viable. Relocation and transactional reconciliation remain explicit design work. |

## Proposed first-server contract

| Area | Carry into implementation | Boundary to preserve |
| --- | --- | --- |
| Runtime | One local singleton and Vite instance; built Kit management shell; short-lived installers | One application listener; lifecycle may use a private Unix control socket. Trusted local source, not a sandbox. |
| Installation | Pinned release identity, frozen declared dependencies, explicit activation/upgrade/rollback | Installer/launcher distribution and schema compatibility must be designed; running from a checkout is still experimental. |
| State ownership | Durable service state outside releases; project source, manifests, lockfiles and dependencies outside the app checkout | Uninstall preserves user data; callback executables cannot be removed while work remains unresolved. |
| Project/artifact identity | Stable IDs independent of labels; relative source entries; canonical-root binding | Do not silently adopt copied UUIDs or relocate bindings. Decide manifest/catalog authority and migration before stabilizing the schema. |
| Mounting | Discover Svelte components, prepare declared dependencies, expose readiness and diagnostics | A symlink alone is not a runtime; compilation readiness alone does not prove browser execution. |
| Interaction | Exact existing session, durable request/response/result, deduplicated response IDs, visible unknown outcomes | Adapter acceptance is not agent completion. No blind replay, replacement session, or permission alteration. |
| State/HMR | Explicit preview-state keys/versions, mount-scoped error UI and update events | Full refresh resets preview-session state; arbitrary local state, process isolation, and durable drafts are not provided. |
| Lifecycle | Owner-authenticated stop, conservative stale recovery, drain admitted adapter work | Stop does not wait for the agent's entire turn; close/archive/unmount do not cancel that turn. |
| Access | Loopback, management authorization, scoped page capabilities, minimized management output | Shared origin/compiler remain one trusted-code boundary. Remote access is deferred. |

Paths used by the installation experiment (`releases/`, `state/`, `run/`) and the project manifest (`artifact.project.json`) are concrete candidates. The actual default installation directory, stable CLI command names, public schema versions, and migration rules have not been adopted. Keep those decisions reviewable rather than letting experiment paths become accidental public contracts.

## Implementation sequence and exit criteria

1. **Unify the core and ownership model.** Define one operation/result contract for project registration, artifact lifecycle, mount status, and interactions. Move the tested behavior out of separate experimental wrappers. Specify stable IDs, schema versions, project-manifest versus service-catalog authority, and failure reconciliation. Exit with deterministic state/ownership tests and the existing browser proofs passing through the shared core.
2. **Make installation and lifecycle a supported workflow.** Package the launcher, choose an explicit home/default origin, separate release/state/project ownership, and implement start/status/stop/restart/upgrade/rollback/uninstall. Define supported schema transitions and retain callback executables. Exit with a clean installation using the packaged entry point, failed-upgrade recovery, uninstall/reinstall with preserved data, and no owned process residue.
3. **Integrate project artifact management.** Expose initialize/register/list/add/mount/unmount/archive/restore through the shared core and management shell. Show source availability separately from runtime readiness; make interrupted operations inspectable. Exit with multi-project identity/concurrency checks and source/dependency preservation through lifecycle changes.
4. **Unify agent access and instructions.** Route CLI and MCP through the same operations and update the skill around the stable entry point. Keep request capabilities private and mutations free of automatic retries. Exit with an independent agent completing creation, mounting, interaction, source editing, and recovery using those documented interfaces.
5. **Set the supported operating envelope.** Add resource telemetry, budgets, deliberate compiler/service recreation, and clear state-loss behavior. Measure longer runs and representative project/dependency sizes; test pending-interaction reconciliation through interruption. Exit with an explicit supported workload and observable recovery behavior, not an unqualified claim of unlimited uptime.

These are implementation milestones, not requests to run another framework experiment. New experiments should target a concrete unanswered decision encountered while building these milestones.

## Integrated validation

Independent worktrees produced the implementation and evidence, followed by cross-track review. Deterministic fixture suites, browser checks, real SDK transport checks, installed-release checks, and the separate live-session proof establish different facts and are not interchangeable.

The integrated checkpoint `3a76ac3` passed the installed SvelteKit lifecycle suite including installed MCP and seven owned host processes confirmed exited. Project management also passed an independent integrated CLI/browser/concurrency rerun. Final review additionally reproduced and corrected two defects: repeating an old unmount could release a new mount of the same source, and an installed workspace could retain an old/dangling compiler dependency link across upgrades or reinstall. Regression checks cover ownership transfer, retryable cleanup failure, active compiler realpaths, and uninstall/reinstall while preserving foreign paths.

All experiment records and reproducible scripts are versioned. Private receipts, screenshots, session details, capabilities, and raw process measurements remain in ignored `.artifact/` directories. The live source-edit verifier requires explicit session arguments and is intentionally excluded from unattended regression scripts.

The final combined source checkpoint is `c91a245`. Core and singleton suites passed **29 tests / 122 assertions** (25/78 core and 4/44 singleton), with root and experiment TypeScript checks passing. MCP interoperability, dependency browser execution, singleton interaction browser checks, and SvelteKit browser checks passed after integration. The Kit shell separately passed its check and build, and the updated skill passed validation. Bun version compatibility is now checked before cached release reuse, activation, and launch.

The coordinator reran the full installed SvelteKit/MCP lifecycle suite against integrated commit `c91a245e3cb3ca597bbe907e4a7d3c6f8ef89112`: all checks passed, including dependency-link upgrade/rollback/reinstall, foreign-path preservation, failed-start cleanup, and Bun-pin refusal. All **eight** successfully launched owned host processes exited. This final installed-release run used fixtures and did not contact a live agent.
