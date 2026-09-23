# Experiment roadmap

> Historical record, relocated September 23, 2026. Status, proposed next steps and commands below describe the recorded checkpoint, not the current product. Use the [source guide](../README.md), [current runtime requirements](../requirements/runtime.md) and [current architecture](../architecture/components.md). Relocation adds no new runtime evidence.

The goal is to progressively validate whether agents in any project can create and run interactive interfaces. Record actual results at each step before expanding the scope. The first prototype covers a bundled Svelte page and live delivery into a dedicated Codex conversation. External project mounting, Svelte/vanilla starters, a generic browser client, custom CLI schemas, and a reusable skill are now implemented. Browser verification covers two external projects with a fixture adapter. A separate singleton pilot validates two versions of one ESM dependency and component previews; integrated singleton interactions now have fixture and live-session evidence. The September 21 follow-ups complete a bounded dependency/MCP, SvelteKit, live-edit, resource, installation, and project-management exploration. See the [server readiness review](first-server-readiness.md) for the implementation recommendation. See [prototype evidence](original-prototype.md#validation-on-2026-09-20).

## Current priority: first-server implementation plan

Scope update on September 21, 2026: focus upcoming experiments on Svelte only. The completed bounded plan covers dependency compatibility, MCP/CLI interoperability, live agent source edits with HMR draft retention, measured lifecycle/resource recovery, a SvelteKit singleton shell, repository installation, and project artifact management. Additional frameworks are deferred; the longer-term framework-neutral vision remains unchanged. Historical Svelte/vanilla results below remain evidence of the earlier experiments.

The user clarified the target topology: start one server, create a namespace for a project/problem, and symlink source folders into it. Mounting should automatically prepare declared dependencies and discover/render components through one Vite instance. This supersedes expanding the per-project dev-server design as the production direction.

The [singleton experiment](2026-09-20-singleton-namespaces.md) records a working pilot and its limits. The [HMR follow-up](2026-09-20-scoped-hmr.md) now validates scoped error UI, targeted discovery updates, and opt-in state retention. The [singleton interaction experiment](2026-09-20-singleton-interactions.md) now connects this host to the existing layer with fixture and live idle/active verification. The follow-ups now validate bounded dependency formats and interface interoperability. MCP wraps those operations; it does not decide the mounting topology.

## Exploratory milestones

| Milestone | Status | Evidence or next gate |
| --- | --- | --- |
| Core page/agent round trip | Proven for the original local Codex prototype | Active steering and idle continuation; browser-observed result |
| External project lifecycle | Implemented and browser-tested | Independent Svelte/vanilla projects; source update/error recovery; stop/restart; manager crash cleanup |
| Reusable interaction | Implemented and browser-tested | Custom JSON schema, browser client, CLI publication; explicit fixture adapter |
| Agent self-service | CLI and skill implemented | Independent agent completed a custom Svelte workflow using the skill and a fixture binding; live delivery remains separately evidenced |
| Singleton namespace mounting | Pilot verified | Symlinks, automatic Bun installs, discovered Svelte components, two nanoid versions under one Vite; follow-up verifies scoped error UI and opt-in state retention |
| Singleton interaction integration | Verified for the tested workflow | Two-namespace fixtures, scoped request access, lifecycle races, and separate live idle/active callbacks displayed in Chrome |
| Svelte dependency formats and MCP | Bounded experiments passed | Source-scoped JavaScript prebundles and real SDK stdio/CLI interoperability |
| Live source editing and HMR draft retention | Observed with exact live session | Actual layout edit and result CLI; retained document and opted-in draft |
| Lifecycle and resource recovery | Bounded run completed; operating limit identified | 30 cycles / 180.115 seconds; repeated identities stabilize, distinct identities retain metadata; no indefinite stability claim |
| SvelteKit singleton application foundation | Viable candidate verified | Built shell, dynamic CSR components, one listener/compiler; mounted SSR and full Kit apps excluded |
| Repository installation and lifecycle | Bounded experiment passed | Pinned releases, frozen dependencies, installed MCP/Kit, authenticated lifecycle, mechanical rollback and conservative recovery |
| Project artifact management | Bounded experiment passed | Stable project-owned IDs, canonical binding, writer locks, non-destructive archive/restore |
| Additional frameworks and remote access | Deferred | Outside the current Svelte-only experiment plan |

See [the experiment record](2026-09-20-external-projects.md) for observations and limits, and [the workflow guide](legacy-workflow.md) for executable commands. Installed packages remain project-owned. The external-project run alone did not prove conflicting dependency-version resolution; the subsequent singleton run separately observed nanoid 4.0.2 and 5.1.5 executing from their own source trees.

## Experiment 1: A complete loop for one project

Prepare a Svelte + TypeScript page and an interactive component in a local project. Use a minimal CLI to register the project, start it, and return a preview. Change the source and observe the browser update, then stop the runtime and restart it from the preserved source files.

Acceptance criteria:

- The user can open the returned URL and interact with the component.
- The page imports a local component and an explicitly declared third-party dependency.
- After a component changes, the browser reflects the current source; record the update mechanism and observed result.
- Compilation errors can be located, and the preview recovers after they are fixed.
- TypeScript type-checking results are recorded separately from development server startup results.
- Stopping releases managed processes and ports while preserving source files and the lockfile.
- A new session can restart the preview using project files, without depending on the original agent's conversation context.

Use this experiment to decide whether a minimal management service is necessary, whether the state model is sufficient, and whether the CLI operations have the right scope.

## Experiment 1B: A button steers the originating agent session

Status: the primary live loop has passed for active and idle conversations. The agent published result data through the CLI, and the browser displayed it. This is evidence of a page data update, not autonomous source-code modification. Failure handling has automated coverage; the full acceptance list below is not yet proven against every live runtime condition.

Extend the first page with two options, an adjustable parameter, and a submit button. The agent registers its existing session and creates an interaction request. Submitting the page sends structured user data through Surface's backend to that session; the agent then updates the page based on the selection. The agent does not need to keep a waiting tool call open.

Acceptance criteria:

- The response is bound to the intended project, page, request, and agent session; a second registered session does not receive it.
- With an active turn, the adapter delivers steering input to that turn and the agent acts on it.
- With an idle conversation, the adapter starts a turn in the same conversation and the agent acts on it; no replacement conversation is created.
- The user can distinguish a saved submission, runtime acceptance, and an observed agent response. The resulting page reflects the submitted choice and parameter.
- Repeated delivery of the same response ID does not intentionally trigger another action. An uncertain delivery result remains visible instead of causing a blind retry.
- A stale request, unavailable session, or turn that ends during delivery produces an explicit outcome. The response does not go to an unrelated or merely most-recent session.
- Evidence records the actual control endpoint, CLI or protocol version, target session and turn, delivery result, and browser-observed update without exposing credentials.

For Codex, validate App Server `turn/steer` and same-thread `turn/start` against the runtime owning the session. Separately test whether the locally available `codex queue` command provides the desired delivery behavior; its help text alone does not establish immediate steering or idle-session activation. See [agent interaction](../requirements/agent-interaction.md).

## Experiment 2: Two projects with different dependencies

The earlier experiment mounted plain HTML/JS and Svelte/TS workspaces simultaneously. Continue this dependency experiment with two Svelte mounts under the singleton, using different versions of the same package and testing CommonJS/prebundling compatibility.

Acceptance criteria:

- Each preview uses its own declared dependency version.
- Stopping, modifying, or introducing a build error in one project does not prevent the other from running.
- Status and logs are clearly attributable to a project and runtime instance.
- Repeated mounting, occupied ports, and service restarts produce understandable outcomes without leaving unmanaged processes behind.

The earlier process experiment provides comparison evidence. Continue dependency and failure-boundary testing under the preferred singleton topology; the nanoid ESM case is proven, and the September 21 follow-up establishes an explicit JavaScript-only CommonJS/mixed prebundle boundary. Independent framework versions are deferred with broader framework coverage.

## Experiment 3: MCP and CLI interoperability

Status: [bounded stdio/CLI interoperability passed](2026-09-21-mcp.md). The adapter operates on existing singleton mounts and requests; the later project-manifest wrapper is not yet an MCP tool surface.

Expose minimal MCP access to the core operations used in the first two experiments, and write a skill based on the actual workflow.

Acceptance criteria:

- An agent can discover registered projects and start a preview.
- A runtime created through the CLI can be queried and stopped through MCP, and vice versa.
- Both interfaces return consistent project identities, runtime status, and diagnostics.
- After the agent follows the skill to create or modify a component, the user can validate the result in a browser.
- Agent session bindings, interaction requests, and response status are consistent across CLI and MCP; both use the delivery behavior established in experiment 1B.

## Experiment 4: Live agent source edits with HMR draft retention

Status: [live exact-session proof passed](2026-09-21-live-source-edit.md).

Extend the live interaction proof from result-data publication to an actual source edit in a mounted Svelte component. Keep an unsent draft in another form or field opted into `previewState` while the bound agent makes the requested change.

Acceptance criteria:

- The exact bound session receives the submitted request and edits the intended mounted source; record the actual edit and its rendered effect separately from a result CLI callback.
- An ordinary compatible edit appears through HMR without a document refresh, and the unrelated unsent draft remains unchanged.
- The neighboring namespace remains interactive, and no duplicate submission occurs during the update.
- Record any required full refresh or state reset explicitly; do not infer preservation of arbitrary component-local state from the opted-in store.

## Experiment 5: Long-running lifecycle and resource recovery

Status: [bounded resource run completed](2026-09-21-lifecycle-resources.md); [installation lifecycle](2026-09-21-installation.md) separately covers owned process crash/recovery. Neither proves installed delivery-in-flight crash reconciliation or indefinite resource stability.

Exercise the Svelte singleton through a bounded soak run with repeated mount, source-update, and unmount cycles. Record the duration and cycle count so the result has a clear scope.

Acceptance criteria:

- Measure memory, watcher/handle counts where observable, and owned processes before, during, and after cycles; distinguish retained Vite caches from continuing resource growth.
- Unmount revokes routes and releases mount-specific resources as designed while preserving registrations, source, and dependencies; healthy mounts stay usable.
- Inject an installation or compilation failure, then recover or remount successfully without orphaned installers, processes, or duplicate server instances.
- Verify graceful restart restores intended mounts and durable interaction records. If an abrupt interruption is tested, unresolved delivery becomes inspectable `unknown` without automatic replay.

## Experiment 6: SvelteKit as the singleton application foundation

Evaluate one SvelteKit host for the management UI, application routes, and API, alongside dynamically mounted Svelte components. The [bounded foundation experiment passed](2026-09-21-sveltekit-foundation.md) and supports the first-server recommendation; its commands are still experimental. Preserve the singleton topology; do not introduce a separate SvelteKit development server per mount.

Use client-side rendering (CSR) as the baseline for mounted components. Server-side rendering (SSR) of mounted project code has a separate, unresolved execution and dependency contract; it is not required or established by this experiment.

Acceptance criteria:

- Add and remove component mounts at runtime without restarting the singleton application, while existing namespaces remain usable.
- Retain source-specific dependency resolution and demonstrate the distinct tested dependency versions in browser execution.
- Preserve mount-scoped compiler diagnostics, ordinary HMR, and opted-in draft state through a compatible source edit; record any fallback refresh explicitly.
- Preserve exact-session interaction binding, scoped request authorization, delivery/result states, CLI callbacks, and browser-observed results. Do not infer interaction compatibility from rendering alone.
- Record how the SvelteKit host integrates with runtime compilation and watching, its constraints, and whether the evidence supports adoption or requires another design.

Additional frameworks outside the Svelte ecosystem remain deferred. The longer-term framework-neutral vision remains unchanged; this foundation experiment does not establish support for mounting arbitrary complete SvelteKit applications.

## Evidence to retain for each experiment

Record the code revision, project configuration, startup procedure, expected and actual results, the user's browser inspection, and unresolved issues. Distinguish source creation, process readiness, page accessibility, and successful interaction checks. For agent interaction, also distinguish response persistence, runtime acceptance, and observed agent action.

## Open questions

- Should the first version focus on newly created small interfaces, or also cover existing frontend applications?
- How should component discovery expand beyond the tested Svelte directory scan to complete pages, assets, and framework-specific entries?
- What stable-origin and identity policy should preserve namespace URLs across service restarts and relocation?
- How should the singleton release inactive compilation resources while preserving registrations and predictable remount behavior?
- How should permission to install dependencies, write files, and execute scripts be expressed in different agent environments?
- Which agent runtimes can accept direct session input, and what control endpoint and credentials does each adapter require?
- What response schema, expiry rules, delivery receipts, and retry behavior are sufficient for reliable interaction?
- What evidence establishes support for a framework rather than just one example built with it?

The seven-track [readiness plan](2026-09-21-readiness-plan.md) now has bounded results. Next implement a unified server contract, project registry, release/state lifecycle, and CLI/MCP surface in the sequence proposed by the [readiness review](first-server-readiness.md). Preserve the distinction between repeatable fixtures and live-session proof; neither establishes arbitrary-framework or production readiness.
