# Artifact

Enable agents in any project to create and mount local interactive pages and components through MCP or CLI with skills, receive user input back in their existing sessions, and preserve each project's dependencies and choice of frontend framework.

## Current status

This project is exploring the domain. The first local prototype includes a Bun server and CLI, a Svelte feedback page, and a Codex adapter that delivers page responses to an existing conversation. Active-turn steering and idle continuation have been exercised against a local Codex session.

The prototype runs one bundled example. General project mounting, multiple framework runtimes, MCP tools, and reusable skills remain future work. See [prototype usage and evidence](docs/prototype.md) for the exact supported scope.

## Run the prototype

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
| Framework choice | Validate Svelte first, then explore other JS frontend frameworks |
| Project dependencies | Give each project its own dependency declarations, lockfile, and resolution context |
| Pages and components | Run complete pages and provide component preview entries with props, styles, and context |
| Agent access | Share core capabilities between MCP and CLI, with skills describing the workflow |
| Two-way interaction | Route button clicks, form submissions, and selected parameters back to the existing agent session |
| Local experience | Return usable preview URLs, reflect source changes, and expose status and error diagnostics |
| Source ownership | Keep artifacts as ordinary project files that can be versioned in Git and maintained independently |

Supporting any JS frontend framework is a long-term exploration goal. The suggested starting point is plain HTML/JS and Svelte + TypeScript, validating integration boundaries one at a time.

## Documentation

- [Product vision](docs/vision.md): user value, core concepts, and design principles.
- [Architecture exploration](docs/architecture.md): initial proposals for the service, project runtimes, interfaces, and dependency boundaries.
- [Agent interaction](docs/agent-interaction.md): session registration, page responses, and delivery through agent adapters.
- [Prototype usage and evidence](docs/prototype.md): setup, implemented behavior, validation, and limits.
- [Experiment roadmap](docs/exploration.md): small experiments, acceptance criteria, and open questions.

The next expansion is to mount an independently located project with its own dependencies, using the working page-to-agent loop as a foundation.
