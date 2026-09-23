# First-server implementation readiness

Current status reviewed September 23, 2026 (America/Toronto). The [public Surface entry](implementation/03-public-entry.md) integrates installed lifecycle, shared worktree identities, optional lazy backend storage, CLI/MCP access and namespace-preserving legacy migration. [Experimental distribution](implementation/04-experimental-release.md) and [source setup](../SETUP.md) are also implemented; installation is no longer an untouched next milestone.

| Original milestone | Current disposition |
| --- | --- |
| 1. Shared core and ownership | [Shared project operations](implementation/01-project-core.md) implemented; further internal runtime consolidation remains |
| 2. Installation/lifecycle | Public home/port/commands, bounded compatibility gates, packaged releases and agent setup implemented; general future migrations and fresh-user acceptance remain |
| 3. Project artifact management | Core/CLI/MCP and workspace lifecycle implemented; complete management-shell write flows remain |
| 4. Agent access and instructions | Shared operations, installed MCP and current skill exist; recipient controls remain experimental and a fresh-user installed live loop is still an acceptance gap |
| 5. Operating envelope | Bounded measurements and cleanup fixes exist; supported long-duration budgets and installed interruption/reconciliation evidence remain open |

The [findings synthesis](findings.md#september-23-synthesis-and-disposition) includes later storage, worktree, multi-view, synchronization and recipient experiments. The [autonomy assessment](project-autonomy.md) proposes the next integrated acceptance and continuation gates. This status reconciliation reviews existing records; it does not rerun them or claim production readiness.

## Historical recommendation — September 21

The remaining sections preserve the original first-server recommendation, proposed milestone criteria and integrated verification at that checkpoint. Later adoption of defaults, backend declarations, workspace migration, release distribution and private browser access is governed by the current documents linked above. Statements below that call those decisions future work describe September 21, not the current backlog.

## Product goal and v0 boundary

The [product vision](vision.md) defines Surface as a shared, extensible interactive environment for people and agents, independent of DecompozR. The first server delivers one local Web loop: project-owned source is mounted and executed, a person interacts in a browser, structured input returns to the bound project/agent conversation, and the result or interface is updated.

Experiences own their purpose and domain state. Capabilities provide rendering or domain computation. Core provides common identity, mounting, interaction, access, resource, and lifecycle mechanisms. Graph, CAD, simulation, native representations, and a general capability protocol are longer-term directions. They are not prerequisites for completing the Svelte v0 loop.

Milestone 2 must turn installation and lifecycle into a supported workflow for that loop while preserving project ownership and the distinction between submitted input, accepted delivery, and completed work. This vision alignment does not adopt installation defaults, schema migrations, a plugin API, or a universal state/action model.

## Recommendation

Start building the first actual server within a bounded local Svelte contract. The seven planned experiments answered the architectural questions needed to begin implementation, including repository installation, service lifecycle, and project artifact ownership. They do not establish that the experimental entry points already constitute a production server.

The recommended foundation is Bun + TypeScript, a prebuilt SvelteKit management shell, and one live Vite/Svelte compiler inside one singleton process and application HTTP listener. Keep a common operation layer behind CLI and MCP. Preserve project-owned source/dependencies and separate installed application releases from durable service state. Additional frameworks remain deferred.

The main operational limit is retained compiler metadata under continuous new-source churn. The bounded run supports ordinary local iteration; it does not support an indefinite-daemon promise. Resource observability, a supported operating budget, and an explicit restart/recreation policy belong in the first-server implementation. A compiler restart can require full refresh and lose ephemeral preview state; it must not be presented as transparent HMR.

## Completed experiment gates

This table records each experiment's original scope. Later shared project operations are covered by the Milestone 1 record above.

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

The [worktree workspace follow-up](experiments/2026-09-21-workspaces.md) verifies one shared service for main and linked worktrees, explicit workspace identity, lazy external data locations, and retirement followed by Git source merge/removal. It does not migrate existing canonical-root registrations or generically merge project databases.

A subsequent [three-part contract experiment](experiments/2026-09-21-server-contract.md) verifies a bundled installed entry point, explicit migration/rollback compatibility for a small preferences store, and optional declared backends through installed lifecycle operations. These are bounded experimental implementations; public defaults, migrations of actual registry/interaction stores, and runtime consolidation remain open.

An additional [project-owned SQLite experiment](experiments/2026-09-21-project-database.md) passed after the original seven gates. It demonstrated named project backend operations, separate durable databases, browser/HMR/restart persistence, writer-conflict handling, and connection release. Project SQLite is optional and acquired only when a validated database operation first needs it; registration, mounting, and restart do not create or open it. A default Surface metadata database would require a separate decision. A candidate declaration and installed integration now have the follow-up evidence above; supported declaration semantics, scheduling, and multi-mount ownership remain design decisions; this pilot is not yet a supported v0 capability.

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

Paths used by the installation experiment (`releases/`, `state/`, `run/`) remain candidates for the supported installation layout. The `surface` CLI name is adopted by [Decision 0002](decisions/0002-surface-name-and-local-state.md), and Milestone 1 retains `artifact.project.json` version 1 with a separately versioned operation envelope. Default installation locations, the supported lifecycle command contract, and schema transition rules remain to be designed. Keep those decisions reviewable rather than letting experiment paths become accidental public contracts.

## Implementation sequence and exit criteria

Milestone 1 has delivered the shared project operations through the core, HTTP, CLI, and MCP. Runtime consolidation, management UI writes, and the other remaining work are still bounded by the milestones below. Historical experiment results later in this document retain their original scope; they are not new verification of the broader vision.

1. **Unify the core and ownership model.** Define one operation/result contract for project registration, artifact lifecycle, mount status, and interactions. Move the tested behavior out of separate experimental wrappers. Specify stable IDs, schema versions, project-manifest versus service-catalog authority, and failure reconciliation. Exit with deterministic state/ownership tests and the existing browser proofs passing through the shared core.
2. **Make installation and lifecycle a supported workflow.** Package the launcher, choose an explicit home/default origin, separate release/state/project ownership, and implement start/status/stop/restart/upgrade/rollback/uninstall. Define supported schema transitions and retain callback executables. Exit with a clean installation using the packaged entry point, failed-upgrade recovery, uninstall/reinstall with preserved data, and no owned process residue.
3. **Integrate project artifact management.** Expose initialize/register/list/add/mount/unmount/archive/restore through the shared core and management shell. Show source availability separately from runtime readiness; make interrupted operations inspectable. Exit with multi-project identity/concurrency checks and source/dependency preservation through lifecycle changes.
4. **Unify agent access and instructions.** Route CLI and MCP through the same operations and update the skill around the stable entry point. Keep request capabilities private and mutations free of automatic retries. Exit with an independent agent completing creation, mounting, interaction, source editing, and recovery using those documented interfaces.
5. **Set the supported operating envelope.** Add resource telemetry, budgets, deliberate compiler/service recreation, and clear state-loss behavior. Measure longer runs and representative project/dependency sizes; test pending-interaction reconciliation through interruption. Exit with an explicit supported workload and observable recovery behavior, not an unqualified claim of unlimited uptime.

These are implementation milestones, not requests to run another framework experiment. New experiments should target a concrete unanswered decision encountered while building these milestones.

## Integrated validation

Independent worktrees produced the implementation and evidence, followed by cross-track review. Deterministic fixture suites, browser checks, real SDK transport checks, installed-release checks, and the separate live-session proof establish different facts and are not interchangeable.

The integrated checkpoint `3a76ac3` passed the installed SvelteKit lifecycle suite including installed MCP and seven owned host processes confirmed exited. Project management also passed an independent integrated CLI/browser/concurrency rerun. Final review additionally reproduced and corrected two defects: repeating an old unmount could release a new mount of the same source, and an installed workspace could retain an old/dangling compiler dependency link across upgrades or reinstall. Regression checks cover ownership transfer, retryable cleanup failure, active compiler realpaths, and uninstall/reinstall while preserving foreign paths.

All experiment records and reproducible scripts are versioned. New private receipts, screenshots, session details, capabilities, and raw process measurements use ignored `.decompozr/surface/` directories. Historical records retain their original evidence paths. The live source-edit verifier requires explicit session arguments and is intentionally excluded from unattended regression scripts.

The final combined source checkpoint is `c91a245`. Core and singleton suites passed **29 tests / 122 assertions** (25/78 core and 4/44 singleton), with root and experiment TypeScript checks passing. MCP interoperability, dependency browser execution, singleton interaction browser checks, and SvelteKit browser checks passed after integration. The Kit shell separately passed its check and build, and the updated skill passed validation. Bun version compatibility is now checked before cached release reuse, activation, and launch.

The coordinator reran the full installed SvelteKit/MCP lifecycle suite against integrated commit `c91a245e3cb3ca597bbe907e4a7d3c6f8ef89112`: all checks passed, including dependency-link upgrade/rollback/reinstall, foreign-path preservation, failed-start cleanup, and Bun-pin refusal. All **eight** successfully launched owned host processes exited. This final installed-release run used fixtures and did not contact a live agent.
