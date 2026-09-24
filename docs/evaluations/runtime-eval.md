# Runtime evaluation gates

Status: inventory and acceptance criteria inspected at `7fceefc`; no runtime commands executed in the documentation trial. Use source files/commands below to reproduce only under an appropriate isolated test authorization. [Historical findings](../observations/findings.md) retain actual run provenance.

## E-01: identities and shared operations

Covers [R-03/R-04](../requirements/runtime.md). Pass if CLI and MCP observe the same project/workspace/artifact, aliases do not substitute for UUID/root checks, foreign/copied identities reject, unavailable source and missing runtime remain distinct, archive/unmount preserve files and history, and partial failure is inspectable. Fail on implicit rebinding, inconsistent transports or destructive cleanup.

Available: `bun test tests/projects.test.ts tests/project-http.test.ts tests/project-access.test.ts tests/workspace-migration.test.ts`; `bun run verify:project-access`; `bun run verify:surface-workspaces`. Inspect [core tests](../../apps/surface/tests/projects.test.ts), [MCP verifier](../../tests/e2e/mcp/verify-projects.ts) and [workspace verifier](https://github.com/decompozr/surface/blob/2b6a4c7/experiments/workspaces/verify.ts). Historical integrated evidence: [project operations](../architecture/project-operations.md#verification-record), [workspace contract verification](../architecture/workspace-service.md#verification). General relocation/crash-atomic multi-step recovery remains outside these passes.

## E-02: installation and lifecycle

Covers [R-05](../requirements/runtime.md). Pass if an identified committed release launches from unrelated cwd, reports actual instance/readiness, retains source/service/domain data through supported restart/uninstall/reinstall, blocks removal of unresolved callbacks, and exits all owned fixture hosts. Fail if saved PID alone grants stop authority, a failed activation is reported as success, or data is removed. Code/schema rollback must be evaluated separately.

Available: `bun run verify:surface`, `bun run verify:installation`, `bun run verify:surface-workspaces`; [public verifier](../../tests/e2e/surface/run.ts), [lifecycle verifier](https://github.com/decompozr/surface/blob/492a09a/experiments/lifecycle/verify.ts), [release verifier](../../tests/e2e/release/bundle.ts). Historical [installation](../experiments/2026-09-21-installation.md) and [release loop](../experiments/2026-09-22-release-loop.md) prove bounded revisions, not power-loss durability, general future schema transitions or indefinite uptime.

## E-03: lazy project storage

Covers [R-06](../requirements/runtime.md). Inspect filesystem and resource counters before/after register, mount, rejected operation, non-storage operation, first valid storage operation, unmount and restart. Pass if no database/sidecar/schema/connection appears before actual valid storage demand, acquired handles close, committed data survives and remount stays unopened until demand. Fail on eager allocation, leaked handles or silent initialization retries.

Available: `bun test experiments/project-database/backend.test.ts experiments/server-contract/contract.test.ts`; `bun run verify:project-database`; `bun run verify:server-contract`. Source/evidence: [database experiment](../experiments/2026-09-21-project-database.md), [installed contract](../experiments/2026-09-21-server-contract.md). Arbitrary project backend correctness and multi-mount ownership are separate, unproved claims.

## E-04: dependencies, diagnostics and HMR

Covers [R-07](../requirements/runtime.md) and [D-05](../design/interactions.md#d-05-draft-ownership). Execute two supported versions in separate source contexts in a real browser, induce one mount's compile failure, keep its neighbor interactive and exercise an opted-in draft through compatible edits. Pass if dependency versions actually execute, failure remains attributable, no duplicate submission occurs, and the declared preview-state lifetime holds. Compilation/HTTP success alone fails the browser criterion.

Available: `bun run verify:dependencies`, `bun run verify:singleton`, `bun run verify:singleton-interactions`, `bun run verify:soak`; [dependency verifier](../../tests/e2e/runtime/verify-dependencies.ts), [scoped HMR record](../experiments/2026-09-20-scoped-hmr.md), [resource record](../experiments/2026-09-21-lifecycle-resources.md). Thirty cycles over roughly three minutes do not prove unlimited distinct-source churn. Full refresh, arbitrary locals and durable drafts remain excluded unless the page supplies and tests them.

## E-05: exact delivery and uncertainty

Covers [R-08/R-09/R-11](../requirements/agent-interaction.md#requirement-index). Pass if schema/capability validation rejects wrong input, only the exact bound thread is addressed, active mode is explicit, stale state rejects before reservation where applicable, queue keeps its submission identity, steer checks its turn, and unknown/restart cases preserve records without another delivery. Verify result storage independently of receipt. Fail on fallback session/mode, blind replay, implicit acceptance of human intent or treating a receipt as source modification.

Available: `bun test tests/service.test.ts tests/adapter.test.ts tests/http.test.ts`; [service tests](../../apps/surface/tests/service.test.ts), [adapter tests](../../apps/surface/tests/agent-adapters/adapter.test.ts); `bun tests/e2e/surface/verify-recipients.ts` after fixture/app preparation. Tests use fixture adapters/RPCs. Historical [original live proof](../experiments/original-prototype.md#validation-on-2026-09-20) and [live source edit](../experiments/2026-09-21-live-source-edit.md) do not verify a new current queue/live-takeover run. Queue/start provider races remain an explicit limitation even if these checks pass. The current CLI `send` exposes no delivery intent; its compatibility path must reject an active recipient rather than silently steer. Browser-client mode support must not be reported as CLI flag support.

## E-06: unsent takeover

Covers [R-10](../requirements/agent-interaction.md#requirement-index). Pass if opt-out refuses discovery/change, foreign worktree candidates cannot be selected, an eligible explicit change atomically closes old and creates new request/token, zero responses/results replay, and submitted/unknown or concurrent preflight blocks takeover. Inject lost acknowledgement and reconcile `replacedBy` without another send. Fail on cross-worktree delivery or old-input replay.

Available: `bun test tests/service.test.ts`; `bun tests/e2e/surface/verify-recipients.ts`; [service implementation/tests](../../apps/surface/tests/service.test.ts). Existing tests encode opt-in, exact-worktree, no replay and preflight locking. The browser script covers a successful explicit fixture change; lost-acknowledgement UI recovery and user-driven live takeover remain untested gates. The separate [recipient lab](../experiments/2026-09-23-agent-recipient.md) must not be treated as shared-panel acceptance.

## E-13: source setup and private access

Covers [R-12](../requirements/runtime.md). Pass if setup selects the intended home and actual provider directories, preserves foreign entries, symlinks to the stable checkout, reuses/restarts/updates the correct committed release, and reports health and private Serve mapping truthfully. Fail on implicit home replacement, copied skills, public Funnel exposure, altered unrelated mapping or claims of remote acceptance from local health alone.

Available: `bun test tests/agent-provider.test.ts tests/agent-skill-link.test.ts tests/agent-tailscale.test.ts tests/bun-version.test.ts`; [agent setup evidence](../experiments/2026-09-22-agent-setup.md), [setup workflow](../../skills/surface/references/setup.md). `./bin/test --skills-dir PROVIDER_SKILLS_DIRECTORY` is a selected-installation read-only check; it was not run here. Provider discovery in a fresh agent, actual second-device HTTPS/browser use and exact live conversation delivery require separate observations. Installation/update commands are outside this documentation task.
