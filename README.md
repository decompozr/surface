# Surface

Surface gives humans and agents a shared, extensible interactive environment for representing, manipulating, and simulating systems.

Projects own their interactive content and domain meaning. Surface provides the common runtime and interaction mechanisms so people can manipulate a representation and projects or agents can receive structured input and continue the work. Surface operates independently of DecompozR, which can use it as one producer and consumer among others.

Web is the first implementation path. v0 focuses on a local Svelte loop: create project-owned source, mount and run it, interact in a browser, return structured input to the bound agent conversation, and update the result or interface. Graph, CAD, simulation, native representations, and a general capability protocol remain future directions rather than v0 requirements. See the [product vision](docs/vision.md) for the long-term goal, architecture boundaries, and v0 commitment.

## Current status

This project is exploring the domain. Its executable code is an experimental implementation for testing design hypotheses; the architecture, API, storage model, and packaging are not finalized product commitments. The first local prototype includes a Bun server and CLI, a Svelte feedback page, and a Codex adapter that delivers page responses to an existing conversation. Active-turn steering and idle continuation have been exercised against a local Codex session.

Two experimental runtime paths currently coexist: the earlier CLI mounts external Svelte or vanilla projects through separate development processes; the preferred singleton pilot hosts discovered Svelte components through one Vite instance and now connects their forms to the existing interaction service. Automated fixture checks and separate live Codex idle/active round trips passed. The September 21 experiments now cover a real MCP adapter, scoped CommonJS prebundles, a built SvelteKit management shell, live agent source edits, bounded resource measurements, pinned repository installation, and project-owned artifact management. See the [server implementation readiness review](docs/server-readiness.md) for the proposed first-server scope and remaining limits. Remote access and additional frameworks remain deferred.

## Shared local service

The public `surface` entry point now installs and operates one shared service for Git projects and linked worktrees. See the [public entry guide](docs/implementation/03-public-entry.md) for the complete command, storage and migration contract.

```sh
bun install --frozen-lockfile
bun link
surface install --repo "$PWD" --ref HEAD
surface start
surface status
```

From a project/worktree, use `surface project init` if its manifest is absent, then `register`, `add --source ui --name Controls`, `list`, and `mount --artifact ID`. Source folders must already exist. The CLI infers the containing Git root; explicit `--project` is also supported. `surface workspace current` identifies the workspace, and `surface mcp` exposes the same project operations over stdio.

Default installation/state selection is shared across cwd: macOS Application Support or Linux XDG data home, with `--home`/`SURFACE_HOME` overrides. Client `--state-dir`/`SURFACE_STATE_DIR` can select an existing service. The default port is 4319. Worktrees do not receive duplicate service state; optional SQLite stays lazy in a persistent project/workspace data location outside disposable source.

`surface workspace retire` preserves data and history, blocks unfinished accepted work, and leaves Git merge/removal explicit. `surface workspace migrate` provides a reviewed, backed-up transition for legacy single-root registrations while preserving original namespaces and interaction records. Existing data requires explicit project-owned storage mapping; databases are not automatically copied or merged.

The earlier per-runtime prototype is available through `surface legacy`. Historical experiment entry points and checkout-local `.decompozr/surface` evidence remain; installing the shared service does not move them. Use their explicit state directories when continuing old work. The [Surface skill](skills/surface/SKILL.md) describes the public interaction workflow.

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

The current implementation target focuses on Svelte + TypeScript. Additional frameworks and non-Web capabilities are deferred. The seven [readiness experiments](docs/experiments/2026-09-21-readiness-plan.md) are complete within their stated boundaries. They support the Bun, built SvelteKit shell, and single live Vite compiler foundation. Shared project operations, the installed public entry and workspace lifecycle are implemented for this bounded local loop. Broader service-store migrations, compiler operating budgets and further internal runtime consolidation remain.

## Documentation

- [Public Surface entry](docs/implementation/03-public-entry.md): shared installation, cwd-based workspace commands, MCP, retirement and explicit legacy migration.

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
