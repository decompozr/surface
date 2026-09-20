# Artifact

Enable agents in any project to create and mount local interactive pages and components through MCP or CLI with skills, receive user input back in their existing sessions, and preserve each project's dependencies and choice of frontend framework.

## Current status

This project is exploring the domain. It currently contains vision and design documents only; the server, CLI, MCP interface, and skills have not been implemented. Interfaces and directories described here are proposals, not available features.

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
- [Experiment roadmap](docs/exploration.md): small experiments, acceptance criteria, and open questions.

The suggested next step is a small experiment: create a Svelte + TypeScript page in a local project, mount it through the CLI, obtain a preview URL, change a component and observe the browser update, then stop the service while preserving the source files. Follow this with a button that sends a choice to the originating agent session and causes the agent to update the page.
