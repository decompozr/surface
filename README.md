# Surface

**Bring the work out of the chat. Keep the agent in the loop.**

Surface is a personal hobby experiment in giving AI conversations an independent, interactive workspace. An agent can turn an idea into a page, visualization or small tool. You can use it, point to a specific element, and send feedback to the same agent conversation that already has the context.

The question behind the project is simple: what happens when the useful things an agent creates can live alongside your project, instead of being confined to one chat interface?

## What I am exploring

- **Externalized knowledge and tools.** Make an explanation, comparison or working idea something you can open, inspect and interact with.
- **The same agent, with the same context.** Bind a page to the exact conversation that created it. Page feedback returns there, and the agent's response comes back to the page.
- **Provider-independent architecture.** Keep page hosting and interaction contracts separate from provider adapters. The goal is to work across agent providers; each integration still needs its own implementation and verification.
- **Git-versioned work.** Keep page source, manifests and dependency lockfiles in the project so they can be reviewed, compared, reverted and merged. Credentials and private runtime data stay outside Git.
- **Multiple worktrees.** Let parallel branches have their own workspace identities, mounted pages and conversation bindings while sharing one local service.
- **Private access across devices.** Optionally use Tailscale Serve to open the same workspace from another device on your tailnet.

## A typical interaction

1. Discuss an idea with your agent.
2. Have it create and mount a project-owned page using the Surface skill or CLI/MCP tools.
3. Open the page, try the controls, select an element or capture a detail, and write feedback.
4. Explicitly send that feedback to the bound conversation. If the agent is busy, choose whether to queue it or steer the active turn.
5. Continue with the agent's reply and the revised page.

A read-only page needs no conversation binding. Agent delivery is an explicit connection to a particular conversation, not an automatic broadcast to any available agent.

## Where it is today

The current implementation hosts trusted, project-owned Svelte route pages in a shared local service. It includes workspace navigation, element selection and screenshots, contextual comments, structured interactions, conversation binding, CLI/MCP operations, and optional project storage.

Page source stays in your project: mounting makes it available through Surface; it does not import the files into a document store. The service requires Git-root projects and keeps each worktree's identity separate.

**The next direction is typed, templated, persisted pages** with explicit content and view state: editable documents, visualizations and small components that humans and agents can keep improving. This is an adopted direction, not a claim that a general persistent document editor already exists. See the [page requirements](docs/requirements/template-pages.md).

This is experimental software. Mounted code is trusted local code, not a sandbox. Arbitrary application hosting, mounted SSR and public multi-user hosting are outside the current scope.

## Try it

- [Setup](SETUP.md) — prepared installation, service selection and optional Tailscale access.
- [Surface skill](skills/surface/SKILL.md) — creating pages, mounting projects, binding the exact conversation and replying to feedback.
- [Source documentation](docs/README.md) — intent, architecture, design and acceptance criteria.

Repository lifecycle commands have separate jobs: `bin/build` creates a candidate, `bin/release` promotes the accepted package unchanged, and `bin/setup` installs that prepared release. Browser access, provider connectivity and completed agent work are verified separately.

## Inside the repository

| Path | Purpose |
| --- | --- |
| `apps/surface` | Page runtime, UI, interactions, agent adapters, MCP and templates |
| `apps/cli` | Commands, prepared installation and service lifecycle |
| `design` | Mounted pages for reviewing the actual Surface interface |
| `examples` | Example project-owned pages |
| `tests/e2e` | Integrated browser, MCP and installed lifecycle verification |
| `tests/fixtures` | Isolated projects and test-only app overlays |
| `scripts` | Repository-wide release and documentation tooling |
| `docs` | Product intent, current contracts and dated experiment results |

Module tests live beside their source. Development follows the [source workflow](docs/source-workflow.md), [package boundaries](docs/architecture/package-boundaries.md), [self-owned E2E checks](docs/evaluations/self-e2e.md), and [release acceptance](docs/evaluations/release-candidate.md).
