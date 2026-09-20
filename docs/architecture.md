# Architecture exploration

This document records initial technical hypotheses, not implementation commitments. Gather evidence through the [experiment roadmap](exploration.md) before settling on stable interfaces.

## Suggested initial structure

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

Start by exploring one management service with a separate runtime process per project. The management service handles lifecycle and discovery; projects retain their own development servers, module resolution, and framework environments.

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
- Respect existing package managers and workspace structures; the default package manager for new standalone workspaces remains undecided.
- Dependency installation is an explicit operation that reports its target directory and result. It must not be implicit in registration or mounting.
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

Agents can initially use their existing file-editing capabilities to create pages and components. Whether dedicated generation, file-writing, or template tools are needed should be determined from actual workflows. Write skills after the operation contracts stabilize, covering discovery, creation, previewing, and troubleshooting.

## Lifecycle and observability

Give each runtime instance a distinct identity and distinguish starting, ready, failed, and stopped states. Return a valid preview only after readiness checks succeed; port conflicts and build failures need explicit outcomes.

The service should track the child processes it owns and clean them up on shutdown. After reconnecting or restarting, check actual process liveness instead of treating a saved port as a working preview. Browser runtime error collection needs a separate experiment; development server logs cannot replace browser validation.

## Access boundaries to validate

The first phase should bind to loopback by default and restrict source access to registered scopes. Management operations and page content need clear boundaries. If the management interface uses HTTP, validate request origins and authorization so page scripts cannot gain management privileges. Sharing a browser origin across projects couples storage and permissions; address this explicitly when designing shared preview URLs.

These are prototype design questions, not claims that access controls or execution isolation already exist.
