# Artifact

Enable agents in any project to create and mount local interactive pages and components through MCP or CLI with skills, receive user input back in their existing sessions, and preserve each project's dependencies and choice of frontend framework.

## Current status

This project is exploring the domain. Its executable code is an experimental implementation for testing design hypotheses; the architecture, API, storage model, and packaging are not finalized product commitments. The first local prototype includes a Bun server and CLI, a Svelte feedback page, and a Codex adapter that delivers page responses to an existing conversation. Active-turn steering and idle continuation have been exercised against a local Codex session.

Two experimental runtime paths currently coexist: the earlier CLI mounts external Svelte or vanilla projects through separate development processes; the preferred singleton pilot hosts discovered Svelte components through one Vite instance and now connects their forms to the existing interaction service. Automated fixture checks and separate live Codex idle/active round trips passed. The September 21 experiments now cover a real MCP adapter, scoped CommonJS prebundles, a built SvelteKit management shell, live agent source edits, bounded resource measurements, pinned repository installation, and project-owned artifact management. See the [server implementation readiness review](docs/server-readiness.md) for the proposed first-server scope and remaining limits. Remote access and additional frameworks remain deferred.

## Local state directory

The server is named **Artifact**; singleton describes its architecture. See [Decision 0001](docs/decisions/0001-artifact-name-and-local-state.md) for naming, path scope, and compatibility.

Checkout defaults now live under `.decompozr/artifact/`: the earlier prototype uses that root, the singleton/`artifact project`/MCP use its `singleton/` subdirectory, and the Kit wrapper uses `sveltekit/`. Verification outputs also use this base. Explicit `--state-dir` values and lifecycle installation homes are unchanged.

Existing `.artifact/` data is retained and remains ignored by Git; it is not automatically moved or merged. To inspect or continue using old state, explicitly pass its absolute path with `--state-dir`. Stored mount paths and callback commands can contain absolute paths, so moving a populated state directory needs deliberate reconciliation. Historical experiment records retain the original evidence paths; new runs use the new base.

## First implementation increment

Project operations now have a shared core under `src/core`, an authenticated singleton API, an `artifact project` CLI, and eight corresponding MCP tools. Project definitions, canonical identity, archive/restore, and runtime status flow through the same service. See the [milestone contract and usage](docs/implementation/01-project-core.md). The runtime host and installer are still being consolidated; this increment does not complete all server milestones.

## Current exploration: one server with namespaces

The preferred direction is now one singleton server with namespace-scoped symlink mounts, automatic project dependency preparation, component discovery, and a shared Vite instance. The [singleton experiment](experiments/singleton/README.md) is a separate executable pilot; it reuses the existing interaction core and agent adapter while keeping a separate CLI entry point from the earlier implementation. See the [mounting record](docs/experiments/2026-09-20-singleton-namespaces.md) and [integrated interaction evidence](docs/experiments/2026-09-20-singleton-interactions.md) for observed results and limits.

## Earlier experiment: independent project runtimes

From this checkout, run `bun install --frozen-lockfile` and `bun link`, then start `artifact serve`. Follow the [workflow guide](docs/workflow.md) to create or register a frontend, mount it, and bind an exact agent session. The [Artifact skill](skills/artifact/SKILL.md) teaches this end-to-end workflow.

## Run the bundled prototype

Requires Bun 1.4.0 and a running local Codex App Server for live agent delivery.

```bash
bun install --frozen-lockfile
bun install --cwd examples/svelte-feedback --frozen-lockfile
bun run dev --dev
```

This starts the API on `http://127.0.0.1:4317` and the Svelte preview on `http://127.0.0.1:5173`. In another terminal, bind an exact Codex thread and create an interaction:

```bash
bun run artifact bind \
  --project "$PWD" \
  --thread "YOUR_THREAD_ID" \
  --socket "/absolute/path/to/app-server-control.sock"

bun run artifact request --binding "BINDING_ID" --title "Choose a direction"
```

Open the returned `previewUrl`, choose A or B, adjust the width, and submit. Artifact delivers the data to the bound conversation; that agent can publish its result back through the CLI. The preview link grants access to this interaction, so keep it private. The target session needs permission to contact the local API when publishing a result.

Use `bun run artifact --help` for commands. Stop the development server with Ctrl+C; source files and local interaction records remain intact.

## What we want to explore

When an agent needs to present an idea, validate an interaction, explain data, or build a small tool, it should be able to create real frontend source files in the current project and give the user a local page they can open, modify, and iterate on.

Artifact aims to provide reusable runtime and preview infrastructure for this workflow across projects and agents:

1. Start or connect to a local Artifact service.
2. Register a project directory and select an existing frontend application or create a separate workspace for pages.
3. Have the agent create pages, components, and the required project dependencies.
4. Mount the project and obtain a preview URL.
5. Let the user inspect it in a browser and submit choices or data back to the registered agent session, which can continue working and update the page.
6. Stop the preview or unmount the project, preserving the source files for future work.

## Target capabilities

| Area | Goal |
| --- | --- |
| Web foundations | Support HTML, CSS, JavaScript, and TypeScript |
| Framework choice | Focus current experiments on Svelte; defer additional frameworks |
| Project dependencies | Give each project its own dependency declarations, lockfile, and resolution context |
| Pages and components | Run complete pages and provide component preview entries with props, styles, and context |
| Agent access | Share core capabilities between MCP and CLI, with skills describing the workflow |
| Two-way interaction | Route button clicks, form submissions, and selected parameters back to the existing agent session |
| Local experience | Return usable preview URLs, reflect source changes, and expose status and error diagnostics |
| Source ownership | Keep artifacts as ordinary project files that can be versioned in Git and maintained independently |

The current exploration focuses on Svelte + TypeScript. Additional frameworks are deferred; the broader framework-neutral vision remains a long-term possibility. The seven [readiness experiments](docs/experiments/2026-09-21-readiness-plan.md) are complete within their stated boundaries. They support starting implementation with Bun, a built SvelteKit management shell, and one live Vite compiler for Svelte component previews. This is an implementation recommendation; the experimental commands, manifests, storage, and packaging still need a unified server contract.

## Documentation

- [Server readiness and implementation sequence](docs/server-readiness.md): seven experiment outcomes, proposed scope, operational limits, and the next build milestones.
- [Consolidated findings](docs/findings.md): lessons and evidence boundaries.
- [Repository installation and lifecycle](experiments/lifecycle/README.md): isolated pinned releases, start/stop/restart, rollback, recovery, and non-destructive uninstall.
- [Project artifact management](experiments/projects/README.md): project-owned identities, registration, mounting, and archive/restore.
- [MCP adapter](experiments/mcp/README.md): existing-singleton stdio access and CLI interoperability.
- [SvelteKit foundation](experiments/sveltekit/README.md): build and run the experimental management shell.
- [External-project workflow](docs/workflow.md): CLI setup, scaffolding, mounting, custom interactions, skill installation, and verification.
- [Product vision](docs/vision.md): user value, core concepts, and design principles.
- [Architecture exploration](docs/architecture.md): initial proposals for the service, project runtimes, interfaces, and dependency boundaries.
- [Agent interaction](docs/agent-interaction.md): session registration, page responses, and delivery through agent adapters.
- [Prototype usage and evidence](docs/prototype.md): setup, implemented behavior, validation, and limits.
- [Experiment roadmap](docs/exploration.md): small experiments, acceptance criteria, and open questions.

The singleton now has scoped compiler-error UI, live catalog updates, and opt-in state preservation across HMR; see the [follow-up evidence](docs/experiments/2026-09-20-scoped-hmr.md). The follow-ups also observed a real agent edit with draft retention and MCP/CLI interoperability. Repeated source reuse stabilized measured resources; continuously introducing new sources retained compiler metadata. The first server needs a resource budget and an explicit restart/recreation policy before promising indefinite operation.
