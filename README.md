# Surface

Surface gives humans and agents a shared, extensible interactive environment for representing, manipulating, and simulating systems.

Projects own their interactive content and domain meaning. Surface provides the common runtime and interaction mechanisms so people can manipulate a representation and projects or agents can receive structured input and continue the work. Surface operates independently of DecompozR, which can use it as one producer and consumer among others.

Web is the first implementation path. v0 focuses on a local Svelte loop: create project-owned source, mount and run it, interact in a browser, return structured input to the bound agent conversation, and update the result or interface. Graph, CAD, simulation, native representations, and a general capability protocol remain future directions rather than v0 requirements. See the [product vision](docs/vision.md) for the long-term goal, architecture boundaries, and v0 commitment.

## Current status

This project is exploring the domain. Its executable code is an experimental implementation for testing design hypotheses; the architecture, API, storage model, and packaging are not finalized product commitments. The first local prototype includes a Bun server and CLI, a Svelte feedback page, and a Codex adapter that delivers page responses to an existing conversation. Active-turn steering and idle continuation have been exercised against a local Codex session.

Two experimental runtime paths currently coexist: the earlier CLI mounts external Svelte or vanilla projects through separate development processes; the preferred singleton pilot hosts discovered Svelte components through one Vite instance and now connects their forms to the existing interaction service. Automated fixture checks and separate live Codex idle/active round trips passed. The September 21 experiments now cover a real MCP adapter, scoped CommonJS prebundles, a built SvelteKit management shell, live agent source edits, bounded resource measurements, pinned repository installation, and project-owned artifact management. See the [server implementation readiness review](docs/server-readiness.md) for the proposed first-server scope and remaining limits. Remote access and additional frameworks remain deferred.

## Local state directory

The product and server are named **Surface**; singleton describes the architecture. The repository is [decompozr/surface](https://github.com/decompozr/surface), the package is `@decompozr/surface`, and the CLI is `surface`. See [Decision 0002](docs/decisions/0002-surface-name-and-local-state.md) for the rename, path scope, and compatibility.

Checkout defaults now live under `.decompozr/surface/`: the earlier prototype uses that root, the singleton/`surface project`/MCP use its `singleton/` subdirectory, and the Kit wrapper uses `sveltekit/`. Verification outputs also use this base. Explicit `--state-dir` values and lifecycle installation homes are unchanged.

Older `.artifact/` and `.decompozr/artifact/` data remains ignored by Git and is not automatically moved or merged by the application. Decision 0002 records any explicit checkout/state relocation separately. To inspect or continue using old state, explicitly pass its absolute path with `--state-dir`. Stored mount paths and callback commands can contain absolute paths, so moving a populated state directory needs deliberate reconciliation. Historical experiment records retain the original evidence paths; new runs use the new base.

## First implementation increment

Project operations now have a shared core under `src/core`, an authenticated singleton API, a `surface project` CLI, and eight corresponding MCP tools. Project definitions, canonical identity, archive/restore, and runtime status flow through the same service. See the [milestone contract and usage](docs/implementation/01-project-core.md). The runtime host and installer are still being consolidated; this increment does not complete all server milestones.

## Current exploration: one server with namespaces

The preferred direction is now one singleton server with namespace-scoped symlink mounts, automatic project dependency preparation, component discovery, and a shared Vite instance. The [singleton experiment](experiments/singleton/README.md) is a separate executable pilot; it reuses the existing interaction core and agent adapter while keeping a separate CLI entry point from the earlier implementation. See the [mounting record](docs/experiments/2026-09-20-singleton-namespaces.md) and [integrated interaction evidence](docs/experiments/2026-09-20-singleton-interactions.md) for observed results and limits.

## Earlier experiment: independent project runtimes

From this checkout, run `bun install --frozen-lockfile` and `bun link`, then start `surface serve`. Follow the [workflow guide](docs/workflow.md) to create or register a frontend, mount it, and bind an exact agent session. The [Surface skill](skills/surface/SKILL.md) teaches this end-to-end workflow.

## Run the bundled prototype

Requires Bun 1.4.0 and a running local Codex App Server for live agent delivery.

```bash
bun install --frozen-lockfile
bun install --cwd examples/svelte-feedback --frozen-lockfile
bun run dev --dev
```

This starts the API on `http://127.0.0.1:4317` and the Svelte preview on `http://127.0.0.1:5173`. In another terminal, bind an exact Codex thread and create an interaction:

```bash
bun run surface bind \
  --project "$PWD" \
  --thread "YOUR_THREAD_ID" \
  --socket "/absolute/path/to/app-server-control.sock"

bun run surface request --binding "BINDING_ID" --title "Choose a direction"
```

Open the returned `previewUrl`, choose A or B, adjust the width, and submit. Surface delivers the data to the bound conversation; that agent can publish its result back through the CLI. The preview link grants access to this interaction, so keep it private. The target session needs permission to contact the local API when publishing a result.

Use `bun run surface --help` for commands. Stop the development server with Ctrl+C; source files and local interaction records remain intact.

## The v0 interaction loop

When an agent needs to present an idea, validate an interaction, explain data, or build a small tool, it should be able to create real frontend source files in the current project and give the user a local page they can open, modify, and iterate on.

Surface's first delivery target provides reusable runtime and interaction infrastructure across projects and agents:

1. Start or connect to a local Surface service.
2. Register a project directory and select or create a project-owned Svelte component source.
3. Have the agent create the interactive content and declare its supported project dependencies.
4. Mount the project and obtain a preview URL.
5. Let the user inspect it in a browser and submit choices or data back to the registered agent session, which can continue working and update the page.
6. Stop the preview or unmount the project, preserving the source files for future work.

The project or experience defines whether an interaction previews a value, proposes a change, or requests an action. Surface routes that input and reports delivery outcomes; it does not become the authority for the project's domain data.

## Web implementation target

| Area | Goal |
| --- | --- |
| Web foundations | Support HTML, CSS, JavaScript, and TypeScript |
| Framework choice | Focus current experiments on Svelte; defer additional frameworks |
| Project dependencies | Give each project its own dependency declarations, lockfile, and resolution context |
| Pages and components | Render client-side Svelte component experiences in browser hosts with props, styles, and context; arbitrary mounted applications and SSR are outside v0 |
| Agent access | Share core capabilities between MCP and CLI, with skills describing the workflow |
| Two-way interaction | Route button clicks, form submissions, and selected parameters back to the existing agent session |
| Local experience | Return usable preview URLs, reflect source changes, and expose status and error diagnostics |
| Source ownership | Keep artifacts as ordinary project files that can be versioned in Git and maintained independently |

The current implementation target focuses on Svelte + TypeScript. Additional frameworks and non-Web capabilities are deferred. The seven [readiness experiments](docs/experiments/2026-09-21-readiness-plan.md) are complete within their stated boundaries. They support the Bun, built SvelteKit shell, and single live Vite compiler foundation. Milestone 1 shared project operations are implemented; the next milestone is supported installation and lifecycle for this loop. The experimental runtime and packaging still need consolidation and explicit supported contracts.

## Documentation

- [Worktree workspace experiment](docs/experiments/2026-09-21-workspaces.md): one shared service, worktree namespaces, lazy isolated data, and source merge/cleanup with retained history.

- [First-server contract experiments](docs/experiments/2026-09-21-server-contract.md): installed launcher, explicit schema compatibility/restore, and optional backend declarations with lazy SQLite through installed lifecycle operations.

- [Project-owned SQLite experiment](docs/experiments/2026-09-21-project-database.md): optional project databases acquired on demand, named backend operations, browser persistence, and lifecycle/failure evidence; not yet a supported backend API.
- [Installation/lifecycle contract](docs/implementation/02-installation-lifecycle.md): accepted lazy project-storage policy, lifecycle requirements, and remaining implementation decisions.
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
