# Experiment roadmap

The goal is to progressively validate whether agents in any project can create and run interactive interfaces. Record actual results at each step before expanding the scope. The first prototype covers a bundled Svelte page and live delivery into a dedicated Codex conversation. External project mounting, Svelte/vanilla starters, a generic browser client, custom CLI schemas, and a reusable skill are now implemented. Browser verification covers two external projects with a fixture adapter. A separate singleton pilot validates two versions of one ESM dependency and component previews; integrated singleton interactions, broader dependency coverage, and MCP remain incomplete. See [prototype evidence](prototype.md#validation-on-2026-09-20).

## Current priority: singleton namespace mounting

The user clarified the target topology: start one server, create a namespace for a project/problem, and symlink source folders into it. Mounting should automatically prepare declared dependencies and discover/render components through one Vite instance. This supersedes expanding the per-project dev-server design as the production direction.

The [singleton experiment](experiments/2026-09-20-singleton-namespaces.md) records a working pilot and its limits. The [HMR follow-up](experiments/2026-09-20-scoped-hmr.md) now validates scoped error UI, targeted discovery updates, and opt-in state retention. Next connect this host to the existing interaction layer using the [integration acceptance criteria](findings.md#next-one-singleton-to-agent-round-trip), then expand dependency-format coverage. MCP follows those operations; it does not decide the mounting topology.

## Exploratory milestones

| Milestone | Status | Evidence or next gate |
| --- | --- | --- |
| Core page/agent round trip | Proven for the original local Codex prototype | Active steering and idle continuation; browser-observed result |
| External project lifecycle | Implemented and browser-tested | Independent Svelte/vanilla projects; source update/error recovery; stop/restart; manager crash cleanup |
| Reusable interaction | Implemented and browser-tested | Custom JSON schema, browser client, CLI publication; explicit fixture adapter |
| Agent self-service | CLI and skill implemented | Independent agent completed a custom Svelte workflow using the skill and a fixture binding; live delivery remains separately evidenced |
| Singleton namespace mounting | Pilot verified | Symlinks, automatic Bun installs, discovered Svelte components, two nanoid versions under one Vite; follow-up verifies scoped error UI and opt-in state retention |
| Singleton interaction integration and MCP | Next | Connect the existing request/result layer, then validate CLI/MCP interoperability |
| More frameworks and remote access | Later | Per-framework and remote-access acceptance tests |

See [the experiment record](experiments/2026-09-20-external-projects.md) for observations and limits, and [the workflow guide](workflow.md) for executable commands. Installed packages remain project-owned. The external-project run alone did not prove conflicting dependency-version resolution; the subsequent singleton run separately observed nanoid 4.0.2 and 5.1.5 executing from their own source trees.

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

Extend the first page with two options, an adjustable parameter, and a submit button. The agent registers its existing session and creates an interaction request. Submitting the page sends structured user data through Artifact's backend to that session; the agent then updates the page based on the selection. The agent does not need to keep a waiting tool call open.

Acceptance criteria:

- The response is bound to the intended project, page, request, and agent session; a second registered session does not receive it.
- With an active turn, the adapter delivers steering input to that turn and the agent acts on it.
- With an idle conversation, the adapter starts a turn in the same conversation and the agent acts on it; no replacement conversation is created.
- The user can distinguish a saved submission, runtime acceptance, and an observed agent response. The resulting page reflects the submitted choice and parameter.
- Repeated delivery of the same response ID does not intentionally trigger another action. An uncertain delivery result remains visible instead of causing a blind retry.
- A stale request, unavailable session, or turn that ends during delivery produces an explicit outcome. The response does not go to an unrelated or merely most-recent session.
- Evidence records the actual control endpoint, CLI or protocol version, target session and turn, delivery result, and browser-observed update without exposing credentials.

For Codex, validate App Server `turn/steer` and same-thread `turn/start` against the runtime owning the session. Separately test whether the locally available `codex queue` command provides the desired delivery behavior; its help text alone does not establish immediate steering or idle-session activation. See [agent interaction](agent-interaction.md).

## Experiment 2: Two projects with different dependencies

Mount plain HTML/JS and Svelte/TS workspaces simultaneously, using different versions of the same package.

Acceptance criteria:

- Each preview uses its own declared dependency version.
- Stopping, modifying, or introducing a build error in one project does not prevent the other from running.
- Status and logs are clearly attributable to a project and runtime instance.
- Repeated mounting, occupied ports, and service restarts produce understandable outcomes without leaving unmanaged processes behind.

The earlier process experiment provides comparison evidence. Continue dependency and failure-boundary testing under the preferred singleton topology; the nanoid ESM case is proven, while CommonJS/prebundling and independent framework versions remain open.

## Experiment 3: MCP and CLI interoperability

Expose minimal MCP access to the core operations used in the first two experiments, and write a skill based on the actual workflow.

Acceptance criteria:

- An agent can discover registered projects and start a preview.
- A runtime created through the CLI can be queried and stopped through MCP, and vice versa.
- Both interfaces return consistent project identities, runtime status, and diagnostics.
- After the agent follows the skill to create or modify a component, the user can validate the result in a browser.
- Agent session bindings, interaction requests, and response status are consistent across CLI and MCP; both use the delivery behavior established in experiment 1B.

## Experiment 4: Extend framework coverage

Choose an additional framework or an existing SvelteKit application and test whether the adapter protocol can handle its development server, routing, asset paths, and hot updates.

The acceptance criterion is a clear support matrix and documented failure conditions. Record any required specialized integration honestly; opening a single page does not establish support for an entire framework's capabilities.

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

Next, join the separately proven singleton host and agent interaction layer. Use the [consolidated findings and integration gate](findings.md) to preserve exact-session delivery, scoped request access, HMR behavior, and truthful receipts. Validate fixture and live runs separately before introducing MCP.
