# Architecture exploration

> Historical record, relocated September 23, 2026. Status, proposed next steps and commands below describe the recorded checkpoint, not the current product. Use the [source guide](../README.md), [current runtime requirements](../requirements/runtime.md) and [current architecture](../architecture/components.md). Relocation adds no new runtime evidence.

The [product vision](../intent/vision.md) defines Surface's long-term goal, architecture boundaries, and bounded v0 commitment. This document connects those boundaries to the current Web topology and retains earlier technical hypotheses as historical context. The [readiness review](first-server-readiness.md) records what the experiments establish and what remains to implement.

## Product boundaries and the first implementation

Surface is an independent runtime foundation for shared human/agent interaction. DecompozR is a possible producer and consumer; Surface does not depend on its concepts or services.

The conceptual layers are project-owned experiences, capabilities they use, and a common Surface Core. Core coordinates identity, mounting, interaction state and routing, resource ownership, access scope, and lifecycle. Rendering and domain computation belong to capabilities or project code. Projects retain authoritative domain data and define whether an interaction previews, proposes, or applies a change.

These layers guide dependency direction rather than prescribe a new package layout or public plugin protocol. The Svelte browser runtime is the first implementation path. Graph, CAD, simulation, native renderers, and capability discovery remain future directions to validate through concrete integrations. Existing artifact manifests, identifiers, and browser compatibility aliases remain unchanged.

The next installation/lifecycle milestone should package the bounded Web loop while keeping domain logic outside Core. It does not require a general capability registry, universal state/action schema, or new renderer first. Surface lifecycle responsibility covers its service and mounted resources; it does not absorb general project or agent orchestration.

## Preferred direction after the mounting discussion

The user clarified that the intended product should have one long-running server, namespaces, and symlink-mounted component folders. Mounting should prepare declared dependencies automatically, discover components, and compile/render them through a shared Vite instance. The per-project development-process implementation below is an earlier experiment, not the adopted target topology.

The [singleton pilot](legacy-page-runtime.md) tests this direction separately. It currently shares one pinned Svelte compiler/runtime, uses each source's ordinary ESM dependency tree, and returns namespace-based component hosts. The host now reuses the existing interaction core and Codex adapter through mount-scoped page routes, with a separate singleton CLI entry point. [Integration evidence](2026-09-20-singleton-interactions.md) records fixture and live-session outcomes. A follow-up adds mount-scoped error UI, live catalog updates, and explicit preview-state stores; compiler/transport isolation and transparent preservation of arbitrary component locals are not established.

## SvelteKit foundation candidate (September 21)

The [foundation experiment](2026-09-21-sveltekit-foundation.md) now supports using a built SvelteKit application shell alongside Surface's existing live Vite compiler. The adapter-node handler serves management pages and a sanitized read-only status API in the same process and application HTTP listener. Authenticated mutations and mount-scoped interaction routes remain in the shared core. Dynamically registered folders remain generated CSR component previews; each mount does not become a separate Kit application.

The shell is built during installation. Updating it requires rebuild/restart, while future mounted source is compiled at runtime through the retained development compiler. Management SSR does not establish mounted SSR, arbitrary project Kit routes, or independent project Vite configuration. Scoped HMR, source-specific dependencies, callbacks, and one-listener topology passed the browser experiment.

The [server readiness review](first-server-readiness.md) recommends this topology for implementation, with pinned releases separated from durable service state and project-owned manifests/sources. A resource budget and restart/recreation policy are required before claiming indefinite operation under distinct-source churn. The experimental interfaces remain candidates until the first-server contract is implemented and validated.

## Prototype stack

The later [project-owned SQLite pilot](2026-09-21-project-database.md) adds an optional resource-lifecycle seam to the singleton and a separate experiment host using its existing application handler. The host optionally supplies trusted project backends; schema and SQLite code stay in the project. Backend construction is inert: a validated operation acquires SQLite on demand, while unused projects have no database files or connections. Surface metadata storage is a separate decision. It is evidence for a possible backend capability, not automatic module discovery, a supported plugin API, or arbitrary mounted application hosting.

The first implementation uses Bun 1.4.0 and TypeScript for the service and CLI, Bun's HTTP server and test runner, Ajv for response validation, and a Codex adapter using JSON-RPC over a local Unix WebSocket. The example uses Svelte 5 and Vite 8, with TypeScript 6 to match the Svelte checking tool's supported range.

Surface and the example have separate package manifests and `bun.lock` files. Prototype records live in an ignored `.decompozr/surface/` directory as an atomically replaced JSON file, with an exclusive lock preventing two servers from writing the same state directory. This is a single-server prototype store, not a distributed queue.

The implementation now includes an external-project registry and one supervised process group per mounted frontend. Explicit commands run in project-owned dependency contexts and return direct loopback URLs. Svelte and vanilla starters share a browser client; the reusable skill teaches the CLI workflow. This is the earlier process-based implementation. The singleton now has a verified stdio MCP adapter; broader framework adapters below remain proposals. See the [workflow guide](legacy-workflow.md) and earlier [prototype evidence](original-prototype.md).

## Earlier process topology (comparison)

```text
Agent / user
  ├─ CLI + skills ─┐
  └─ MCP ──────────┴─ Shared project and runtime operations
                         │
                    Local management service
                         ├─ Project identity, runtime status, logs, preview URLs
                         ├─ Project A: HTML / JS runtime process
                         └─ Project B: Svelte / TS runtime process
                                  └─ Each project's source, config, dependencies
```

The earlier root CLI implementation uses one management service with a separate runtime process group per registered frontend. The management service handles lifecycle and discovery; projects retain their own development servers, module resolution, and framework environments.

The first experiment can return each project's loopback URL directly. A shared domain or path proxy remains to be validated: it requires separate handling for asset paths, client-side routing, and hot-update WebSockets, and should not be a prerequisite for the smallest experiment.

## Historical hypotheses below

The following sections preserve the initial cross-framework/process-oriented questions. They are not current setup instructions or the recommended first-server contract. For implemented singleton behavior, use the [singleton guide](legacy-page-runtime.md); for the bounded implementation scope and ownership/lifecycle decisions, use the [readiness review](first-server-readiness.md). Existing session routing, scoped access checks, MCP, and project management are recorded there and in the linked experiments. General package-manager, framework-adapter, and application-configuration ideas below remain unadopted.

## Source files and workspaces

Distinguish two situations:

- **Existing frontend project**: use its current entry point, configuration, and package manager, with an explicitly selected run command.
- **Adding an interface to another project**: create an ordinary, versionable workspace within the project, such as `artifacts/demo/`, containing page source files, `package.json`, and a lockfile.

The directory convention is not yet decided. Mounting should record the canonical project root, selected entry point, adapter, and dependency root. Do not assume a Git repository can contain only one mountable interface.

## Framework adapters

Vite is the first infrastructure candidate: it provides vanilla and Svelte templates, including TypeScript variants, and a programmable development server API. Choosing it as an experimental starting point is a design judgment based on these capabilities; Surface's lifecycle management across projects and dependency boundaries still need validation. [Vite guide](https://vite.dev/guide/), [JavaScript API](https://vite.dev/guide/api-javascript)

An adapter should describe how to identify or create an entry point, start a runtime process, determine readiness, retrieve diagnostics, and stop the process. Adapters may share a protocol without sharing a build tool.

Initial candidates:

| Adapter path | What to validate first |
| --- | --- |
| Plain HTML / JS | Page entry points, module imports, static assets, and feedback from source changes |
| Svelte + TypeScript | Component compilation, styles, dependency resolution, and hot updates |
| An existing application's development command | Later validation of custom startup commands, readiness detection, and shutdown behavior |

Svelte component previews need a host page to supply props and context. SvelteKit and other frameworks with server-side capabilities require additional validation of routing and server behavior; a Svelte single-page experiment does not establish support for them.

Report TypeScript transformation and type checking as separate diagnostic outcomes. Running in the browser does not mean type checking passed.

## Dependency ownership

- Each workspace keeps its dependency declarations and lockfile, with dependencies resolved in that project's context.
- Respect existing package managers and workspace structures. The broader vision may support other package managers. The current singleton contract explicitly requires Bun-compatible declarations/lockfiles and rejects npm/pnpm/Yarn locks rather than converting them.
- In the earlier process experiment, dependency installation was explicit and separate from mounting. The preferred singleton flow now prepares dependencies automatically during mount, using the source manifest and preserving existing lockfiles. The pilot makes installation status and failures visible.
- Experiments with multiple projects must cover different versions of the same package to confirm that dependencies do not leak between projects.
- Project scripts may execute local code. The first phase assumes user-trusted local code; separate processes do not provide a security sandbox.

## CLI, MCP, and skills

Validate core operations through the CLI first, then expose the same semantics through a thin MCP interface. The following is a capability sketch, not a list of implemented commands or tool names:

| Operation | Inputs and outcomes |
| --- | --- |
| Register project | Specify the source root and entry point; return a project identity |
| Start / mount | Specify the project and adapter; return a runtime identity, status, and a preview URL once ready |
| List / inspect | Query projects, runtime instances, errors, and diagnostics |
| Stop / unmount | Release managed processes and resources while preserving source files |

The CLI should support machine-readable results and explicit exit codes. MCP operations can map to tools, while status and diagnostics may be exposed as resources, following MCP's definitions of these server concepts. [MCP server concepts](https://modelcontextprotocol.io/docs/learn/server-concepts)

Agents can initially use their existing file-editing capabilities to create pages and components. Whether dedicated generation, file-writing, or template tools are needed should be determined from actual workflows. The first [Surface skill](../../skills/surface/SKILL.md) covers discovery, creation, previewing, callback handling, and troubleshooting through the implemented CLI. Singleton interaction integration and the thin MCP adapter have passed scoped experiments. Repository/project lifecycle wrappers are separate experimental CLIs; unifying them with the core and MCP is first-server implementation work. See the [consolidated findings](../observations/findings.md).

## Returning page input to an agent

Add a session registry and an interaction delivery layer to the management service. An agent registers its existing session and reachable control endpoint, then binds a page interaction to that session. A button or form submits structured data to Surface; the backend resolves the binding and delivers the response through an agent-specific adapter.

Framework adapters manage page runtimes. Agent adapters manage delivery into agent conversations. These are separate extension points: a Svelte page should not need to know whether its response will be delivered through a CLI or an agent control API.

The proposed shared operations include registering an agent session, creating an interaction request, submitting a response, and inspecting delivery status. CLI and MCP should expose consistent semantics for these operations. The browser uses a scoped submission endpoint; it does not receive general session-management access.

The preferred delivery path steers an active agent turn or continues the same conversation with a new turn if it is idle. It does not require the agent to hold a waiting tool call open. A backend CLI invocation is one possible adapter mechanism; a native control API is another. CLI process completion alone does not establish that the agent processed the input.

See [agent interaction](../requirements/agent-interaction.md) for the proposed contract, Codex capability evidence, and unresolved delivery behavior.

## Lifecycle and observability

Give each runtime instance a distinct identity and distinguish starting, ready, failed, and stopped states. Return a valid preview only after readiness checks succeed; port conflicts and build failures need explicit outcomes.

The service should track the child processes it owns and clean them up on shutdown. After reconnecting or restarting, check actual process liveness instead of treating a saved port as a working preview. Browser runtime error collection needs a separate experiment; development server logs cannot replace browser validation.

## Access boundaries to validate

The first phase should bind to loopback by default and restrict source access to registered scopes. Management operations and page content need clear boundaries. If the management interface uses HTTP, validate request origins and authorization so page scripts cannot gain management privileges. Sharing a browser origin across projects couples storage and permissions; address this explicitly when designing shared preview URLs.

These are prototype design questions, not claims that access controls or execution isolation already exist.
