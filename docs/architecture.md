# Architecture exploration

This document records initial technical hypotheses, not implementation commitments. Gather evidence through the [experiment roadmap](exploration.md) before settling on stable interfaces.

## Preferred direction after the mounting discussion

The user clarified that the intended product should have one long-running server, namespaces, and symlink-mounted component folders. Mounting should prepare declared dependencies automatically, discover components, and compile/render them through a shared Vite instance. The per-project development-process implementation below is an earlier experiment, not the adopted target topology.

The [singleton pilot](../experiments/singleton/README.md) tests this direction separately. It currently shares one pinned Svelte compiler/runtime, uses each source's ordinary ESM dependency tree, and returns namespace-based component hosts. The existing interaction API has not yet been integrated into this host. A follow-up adds mount-scoped error UI, live catalog updates, and explicit preview-state stores; compiler/transport isolation and transparent preservation of arbitrary component locals are not established.

## Prototype stack

The first implementation uses Bun 1.4.0 and TypeScript for the service and CLI, Bun's HTTP server and test runner, Ajv for response validation, and a Codex adapter using JSON-RPC over a local Unix WebSocket. The example uses Svelte 5 and Vite 8, with TypeScript 6 to match the Svelte checking tool's supported range.

Artifact and the example have separate package manifests and `bun.lock` files. Prototype records live in an ignored `.artifact/` directory as an atomically replaced JSON file, with an exclusive lock preventing two servers from writing the same state directory. This is a single-server prototype store, not a distributed queue.

The implementation now includes an external-project registry and one supervised process group per mounted frontend. Explicit commands run in project-owned dependency contexts and return direct loopback URLs. Svelte and vanilla starters share a browser client; the reusable skill teaches the CLI workflow. MCP and broader framework adapters below remain proposals. See the [workflow guide](workflow.md) and earlier [prototype evidence](prototype.md).

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

## Source files and workspaces

Distinguish two situations:

- **Existing frontend project**: use its current entry point, configuration, and package manager, with an explicitly selected run command.
- **Adding an interface to another project**: create an ordinary, versionable workspace within the project, such as `artifacts/demo/`, containing page source files, `package.json`, and a lockfile.

The directory convention is not yet decided. Mounting should record the canonical project root, selected entry point, adapter, and dependency root. Do not assume a Git repository can contain only one mountable interface.

## Framework adapters

Vite is the first infrastructure candidate: it provides vanilla and Svelte templates, including TypeScript variants, and a programmable development server API. Choosing it as an experimental starting point is a design judgment based on these capabilities; Artifact's lifecycle management across projects and dependency boundaries still need validation. [Vite guide](https://vite.dev/guide/), [JavaScript API](https://vite.dev/guide/api-javascript)

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
- Respect existing package managers and workspace structures. Artifact and its initial example use Bun; this does not require externally mounted projects to use Bun.
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

Agents can initially use their existing file-editing capabilities to create pages and components. Whether dedicated generation, file-writing, or template tools are needed should be determined from actual workflows. The first [Artifact skill](../skills/artifact/SKILL.md) covers discovery, creation, previewing, callback handling, and troubleshooting through the implemented CLI. The next gate is singleton interaction integration; MCP follows as an interface extension. See the [consolidated findings](findings.md).

## Returning page input to an agent

Add a session registry and an interaction delivery layer to the management service. An agent registers its existing session and reachable control endpoint, then binds a page interaction to that session. A button or form submits structured data to Artifact; the backend resolves the binding and delivers the response through an agent-specific adapter.

Framework adapters manage page runtimes. Agent adapters manage delivery into agent conversations. These are separate extension points: a Svelte page should not need to know whether its response will be delivered through a CLI or an agent control API.

The proposed shared operations include registering an agent session, creating an interaction request, submitting a response, and inspecting delivery status. CLI and MCP should expose consistent semantics for these operations. The browser uses a scoped submission endpoint; it does not receive general session-management access.

The preferred delivery path steers an active agent turn or continues the same conversation with a new turn if it is idle. It does not require the agent to hold a waiting tool call open. A backend CLI invocation is one possible adapter mechanism; a native control API is another. CLI process completion alone does not establish that the agent processed the input.

See [agent interaction](agent-interaction.md) for the proposed contract, Codex capability evidence, and unresolved delivery behavior.

## Lifecycle and observability

Give each runtime instance a distinct identity and distinguish starting, ready, failed, and stopped states. Return a valid preview only after readiness checks succeed; port conflicts and build failures need explicit outcomes.

The service should track the child processes it owns and clean them up on shutdown. After reconnecting or restarting, check actual process liveness instead of treating a saved port as a working preview. Browser runtime error collection needs a separate experiment; development server logs cannot replace browser validation.

## Access boundaries to validate

The first phase should bind to loopback by default and restrict source access to registered scopes. Management operations and page content need clear boundaries. If the management interface uses HTTP, validate request origins and authorization so page scripts cannot gain management privileges. Sharing a browser origin across projects couples storage and permissions; address this explicitly when designing shared preview URLs.

These are prototype design questions, not claims that access controls or execution isolation already exist.
