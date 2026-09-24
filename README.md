# Surface

Surface gives humans and agents a shared interactive environment. Projects own their source, content and domain meaning; Surface hosts their pages, routes structured input to the exact agent conversation, and returns results to the browser.

The current implementation is a local Svelte runtime for trusted Git projects and worktrees. It provides a SvelteKit shell, mounted client-rendered route pages, contextual element selection/screenshots/comments, explicit recipient and Queue/Steer controls, CLI/MCP operations, optional project storage and installation lifecycle. Mounted SSR, arbitrary application hosting, untrusted-code isolation and multi-user public hosting are outside the current contract.

## Use Surface

- [Setup](SETUP.md): installation, service selection and updates.
- [Surface skill](skills/surface/SKILL.md): agent-managed setup, project pages, exact conversation binding and replies.
- [Source documentation](docs/README.md): product intent, current contracts, design and verification.

Private Tailscale browser access is supported by source setup. Browser access, provider connectivity, delivery acknowledgement and completed agent work are separate acceptance checks. A tested local candidate is not a signed/notarized general-availability release.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/surface` | SvelteKit UI, business services, interactions, comments, MCP, agent adapters, page runtime and templates |
| `apps/cli` | Commands, installation and service lifecycle |
| `tests/e2e` | Cross-app browser, MCP and installed lifecycle verification |
| `tests/fixtures` | Isolated test projects and fixture-only app overlays |
| `tests/unit` | Repository boundaries and shared fixture regression tests |
| `scripts` | Repository-wide release and documentation tooling |
| `docs` | Current specifications plus dated evidence and concise history |

Each app owns its tests. There are two Bun workspaces and one frozen root lockfile; [module ownership](docs/architecture/package-boundaries.md) defines dependency direction. Completed experiment source is retained in Git, with context in `docs/experiments` and `docs/history`.

For development and release verification, follow [source workflow](docs/source-workflow.md), [self-owned E2E](docs/evaluations/self-e2e.md) and [release acceptance](docs/evaluations/release-candidate.md). The design-system package must be built from its selected committed revision and match Surface's package pin. A development symlink alone does not establish release reproducibility or UI acceptance.
