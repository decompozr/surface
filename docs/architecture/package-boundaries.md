# Application and module ownership

Status: adopted September 24, 2026, revised at the user's direction to remove packages without independent consumers.

The repository has two Bun workspaces under `apps/` and one root lockfile. A distinct responsibility does not by itself justify an independent package. Surface owns its internal implementation; extract a package only when concrete consumers require that boundary.

| Workspace | Responsibility | Dependencies within this repository |
| --- | --- | --- |
| `apps/surface` | SvelteKit UI, services, HTTP/MCP, mounted pages and product templates | None |
| `apps/cli` | Commands, calls to Surface, setup, installation, activation, process lifecycle and rollback | Surface public exports |

Cross-workspace imports use declared exports and `workspace:*` dependencies. Surface cannot import CLI. Installation is an internal CLI module under `src/installation`, not an independent application. The dependency graph must remain acyclic. Do not create a parallel root `packages/` tree.

## Surface modules

| Location under `apps/surface` | Purpose |
| --- | --- |
| `src/routes` | SvelteKit pages and endpoints |
| `src/lib/components` | Shared UI components |
| `src/lib/interactions` | Page-side interaction state, recipient selection, submission and results |
| `src/lib/contracts` | Surface-owned operation/navigation types and shared error definitions |
| `src/lib/server/services` | Project and interaction business rules, state and delivery orchestration |
| `src/lib/server/interactions` | Host integration for interaction endpoints |
| `src/lib/server/agent-adapters` | Agent platform transport and discovery |
| `src/lib/server/page-runtime` | Mounted-page compilation, dependency scoping, HMR and lifecycle |
| `src/lib/server/mcp` | MCP tools and the independently executed stdio entry |
| `templates` | Complete project scaffold assets |
| `src/lib/server/templates` | Local template generation and overwrite protection |

Use `createInteractionClient` from `virtual:surface-interactions` in new mounted pages. Existing `createSurfaceClient`, `createArtifactClient` and virtual module aliases remain compatible. Generated standalone projects receive `src/interactions.ts`. The root `./client` export remains a compatibility alias; new consumers use `./interactions`.

The CLI's `src/surface-api.ts` exposes its management transport. CLI and standalone stdio MCP share the Surface-owned `server/http/project-client` implementation for authenticated local requests, response validation and no-retry behavior. This narrow transport reuse does not require a separate client workspace. Browser interactions never import it or receive management credentials.

Surface's development startup calls its host's `projectOperation` directly. This uses the same service and host mutation queue as HTTP; it does not call its own API or create a second store. Stdio MCP remains an external process talking to the existing host over HTTP. It must not open another state writer.

The host composes page compilation, services and presentation internally. Browser filesystem access remains restricted to explicit UI, interaction SDK and dependency assets; server-only source and management transport are denied. Moving modules under `src/lib` does not authorize serving the entire directory.

Templates stay app-owned and can be generated with the service stopped. CLI calls the exported local operation; it does not own another template tree.

## Tests and repository tooling

App-owned unit and integration tests live in each app's `tests/`; agent adapter tests belong to Surface, and installation tests belong to CLI. Root `tests/e2e` owns cross-app browser, MCP and installed lifecycle verification. Root `tests/unit` enforces repository dependency boundaries. Root `scripts/` contains only repository-wide release and documentation tools.

Historical `experiments/` source is excluded from production workspaces, imports and default commands. Installer fallback paths intentionally support previous releases and rollback.

## Verification

Use an isolated source export, frozen workspace dependencies and the exact selected design-system package. Run types, SvelteKit checks, app/installer tests, MCP verifiers, the full comments matrix and installed upgrade/rollback acceptance. Exercise the new interaction API and preserved aliases. Verify direct service operations share shutdown admission and the management client remains inaccessible from mounted pages.

The earlier seven-workspace migration and its bounded acceptance are summarized in [history](../history/2026-09-24-workspace-boundaries.md). Those results do not validate the revised layout. Current consolidation evidence is retained under `.decompozr/surface/module-consolidation-20260924/`.

The three-app candidate passed source checks, 111 tests, actual CLI/MCP/browser flows, the immutable comments matrix and installed upgrade/rollback. See the [dated acceptance and limits](../history/2026-09-24-workspace-boundaries.md#three-app-consolidation-acceptance). Browser SDK aliases preserve older mounted projects; new fixtures exercise `virtual:surface-interactions`.
