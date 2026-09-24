# Workspace package boundaries

Status: adopted September 24, 2026, correcting the earlier all-in-one application consolidation at the user's direction.

Surface is a SvelteKit application. Moving production code out of experiments did not justify putting every executable and infrastructure module inside that application. The repository uses explicit Bun workspaces and one root lockfile. Package separation does not require separate publication or services.

| Workspace | Responsibility | Dependency direction |
| --- | --- | --- |
| `apps/surface` | SvelteKit routes/UI; projects, workspaces, interactions, comments, backend ownership and MCP tools under `src/lib/server`; product templates | Shared packages; never CLI or installer imports |
| `apps/cli` | Arguments/output, local commands and service transport | Surface public server exports, client SDK and installer |
| `apps/installer` | Setup/provider discovery, installation, release activation, owned process lifecycle and rollback | Infrastructure dependencies; no CLI/app module imports |
| `packages/client` | Browser request SDK and local authenticated management client | Contracts |
| `packages/contracts` | Shared operation types, navigation data and protocol error identity | No application dependencies |
| `packages/agent-adapters` | Provider transport, exact-recipient delivery and stateless Git discovery | No application dependencies |
| `packages/page-runtime` | Mounted-page compiler, dependency scoping, HMR and mount lifecycle | Contracts; application services and presentation enter through explicit ports |

Cross-workspace imports use declared package exports and `workspace:*` dependencies. Shared packages cannot import an app. The production dependency graph must be acyclic; tests enforce both direction and declared dependencies. The app exposes local server operations for maintenance commands that must work while the HTTP service is stopped.

## SvelteKit ownership

`src/routes` owns pages and HTTP endpoints. `src/lib/components` owns shared UI. `src/lib/server` owns server-only business modules, including MCP. The small `src/server.ts` development entry composes the app host; it is not a second business implementation. The custom host integrates the built SvelteKit handler with the live page compiler on one listener.

The page-runtime package receives interaction/project handlers and presentation assets from `src/lib/server/host/runtime.ts`. It must not find the app's components or import its stores through relative filesystem paths. The app owns the generated shared-shell module. Package-local compiler dependencies are resolved in the runtime package.

Templates live directly under `apps/surface/templates`. `src/lib/server/templates/index.ts` owns generation and refuses to overwrite a nonempty destination. The CLI calls that exported local operation; scaffolding does not require starting the HTTP service. The CLI does not own a duplicate template tree or generation policy.

## Repository tooling and historical evidence

Root `scripts/` contains only repository-wide release building and documentation checking. Setup belongs to the installer. Integrated browser, release and protocol verifiers live under `tests/e2e`; workspace dependency checks live under `tests/unit`. App/package unit tests may import test helpers without changing production dependency direction.

`experiments/` retains historical research source. It is not a workspace, a default product entry or a production import dependency. Historical release paths in the installer are deliberate compatibility lookups, so an existing installation can roll back without rewriting its files or state. Removing historical research is a separate archival decision, not a prerequisite for package boundaries.

## Verification contract

Run source and SvelteKit checks with the frozen workspace dependencies and selected design-system package. Run the workspace dependency tests, core/host tests, full isolated comments E2E and installed upgrade/rollback gate. Verify CLI scaffolding works without a running service and preserves refusal to overwrite existing files. Package installation must use the root frozen lockfile; old release layouts remain supported for rollback. Preserve current worktrees, provider development links, real preview recipients and interaction records.

Detailed source snapshots, failures and observed results for this migration are retained under `.decompozr/surface/package-boundaries-20260924/`. A successful source check is not installed or browser acceptance.

## Migration findings

The initial workspace browser run exposed canonical dependency paths outside the page-runtime package's local `node_modules` under Bun's workspace linker. The runtime now explicitly permits the resolved Svelte, esm-env, clsx and Vite browser assets, while retaining denial of app server-only modules and the management SDK. Do not solve dependency hoisting by allowing the entire repository or workspace dependency store.

The source E2E snapshot also retains generated SvelteKit TypeScript configuration, required when the copied app's source is compiled for mounted pages. The release builder and immutable prepared-package gate remain the installed acceptance path. Root, app and runtime pin the same Svelte patch where their types meet, avoiding incompatible Snippet identities.

## Observed acceptance

The native macOS arm64 candidate at `83bab1636854be835e44f6ca188a85791b54ce07` passed the immutable-package comments matrix (12 guard tests, eight complete browser profiles and seven interaction/viewport audits), installed CLI/MCP and previous-to-candidate upgrade/rollback/restoration. Local app-owned template generation worked with the service stopped. Five durable stores, project source and browser drafts survived the version changes. Desktop and phone-emulated result, constrained editor and upgraded-draft captures were inspected.

The final source-only follow-up assigns installer/adapter tests to their owning packages, updates the setup verifier's test paths, and repairs documentation references. Source checks and all 110 core/package tests pass on that final layout. The application, page runtime, SDK, adapters, template operation and installed launcher/runner are unchanged from the tested candidate. Evidence records distinguish the candidate commit from the final review commit. No live recipient or existing installation was changed; physical-device acceptance remains separate. Two historical by-the-way-comment links still point to a pre-existing missing requirement anchor.
