# Surface

Surface gives humans and agents a shared, extensible interactive environment for representing, manipulating, and simulating systems.

Projects own their interactive content and domain meaning. Surface provides the common runtime and interaction mechanisms so people can manipulate a representation and projects or agents can receive structured input and continue the work. Surface operates independently of DecompozR, which can use it as one producer and consumer among others.

Web is the first implementation path. v0 focuses on a local Svelte loop: create project-owned source, mount and run it, interact in a browser, return structured input to the bound agent conversation, and update the result or interface. Graph, CAD, simulation, native representations, and a general capability protocol remain future directions rather than v0 requirements. See the [product vision](docs/intent/vision.md) for the long-term goal, architecture boundaries, and v0 commitment.

## Current status

Surface has a bounded experimental implementation: one shared service for Git projects/worktrees, a built SvelteKit shell, mounted client-rendered Svelte route pages, CLI/MCP project operations, optional lazy project storage, installation lifecycle, navigation and explicit recipient/delivery controls. These contracts remain limited to trusted local code and the supported compiler/dependency boundary.

Source setup can configure private Tailscale browser access. It does not establish remote CLI management or agent connectivity. Earlier per-runtime hosting and isolated backend/synchronization pilots remain historical or experimental. See the [source documentation guide](docs/README.md) for current requirements, concrete UI design, evidence and untested gates. Historical fixture/live results do not jointly establish fresh-user acceptance or indefinite reliability.

## Experimental download

Start with the [laptop setup guide](SETUP.md): download, install into `~/.decompozr/surface`, start, connect your agent, and manage the service.

The build-to-release experiment now packages the current app, Bun runtime and frozen dependencies for macOS Apple Silicon. See the [release and installation guide](docs/architecture/release-distribution.md) for building a versioned artifact, installing it without a checkout, agent setup and lifecycle commands. This remains an experimental prerelease path.

## Shared local service

The public `surface` entry point now installs and operates one shared service for Git projects and linked worktrees. See the [public entry guide](docs/architecture/workspace-service.md) for the complete command, storage and migration contract.

```sh
bun install --frozen-lockfile
bun link
surface install --repo "$PWD" --ref HEAD
surface start
surface status
```

From a project/worktree, use `surface project init` if its manifest is absent, then `register`, `add --source ui --name Controls`, `list`, and `mount --artifact ID`. Source folders must already exist. The CLI infers the containing Git root; explicit `--project` is also supported. `surface workspace current` identifies the workspace, and `surface mcp` exposes the same project operations over stdio.

Default installation/state selection is shared across cwd: `~/.decompozr/surface` on macOS and Linux, with `--home`/`SURFACE_HOME` overrides. Client `--state-dir`/`SURFACE_STATE_DIR` can select an existing service. The default port is 4319. Worktrees do not receive duplicate service state; optional SQLite stays lazy in a persistent project/workspace data location outside disposable source.

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

Start with the [source documentation guide](docs/README.md) for authority, reading paths and the complete migration map.

- [Vision and principles](docs/intent/vision.md): purpose, ownership and bounded scope.
- [Requirements](docs/requirements/runtime.md): observable runtime contracts and exclusions.
- [Architecture](docs/architecture/components.md): component ownership, lifecycle and detailed operation contracts.
- [UI design](docs/design/README.md): navigation, recipient journeys, state/recovery tables, drafts, mobile behavior and accessibility gaps.
- [Evaluations](docs/evaluations/README.md): traceable pass/fail criteria and available verification.
- [Observations](docs/observations/README.md): historical measurements, reported feedback, incidents and source dispositions.
- [Documentation workflow](docs/source-workflow.md): how experiments update the source specification.

The shared UI groups registered route pages by project/worktree. Interaction pages offer explicit queue/steer choices and opt-in same-worktree recipient changes. See the [delivery contract](docs/requirements/agent-interaction.md#explicit-delivery-intent) for provider race limits and the distinction between fixture checks and actual user delivery.

The isolated [element-comments experiment](docs/experiments/2026-09-23-element-comments.md) and its [local runner](apps/surface/src/lib/server/comments/README.md) remain work in progress, separate from the public UI.

## Application development layout

Production source, core tests, scaffold templates, shared runtime, MCP and the comment bridge are owned by `apps/surface/`. Run `bun run --cwd apps/surface check`, `bun run --cwd apps/surface check:core` and `bun run --cwd apps/surface test`. Root commands remain convenience entrypoints; root `src/`, `tests/` and `templates/` no longer exist. See [component ownership](docs/architecture/components.md#surface-application-ownership-september-23-consolidation).
