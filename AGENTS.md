# Surface repository agent entry

Treat `docs/` as the project source specification. Read `docs/README.md` and `docs/source-workflow.md` for documentation authority and evidence-to-source updates. The completed documentation continuation trial is recorded under `docs/experiments/docs-takeover/`.

Read `SETUP.md` for user installation and `skills/surface/references/setup.md` for the agent-managed source workflow.

When asked to setup this clone, use `./bin/setup --skills-dir PROVIDER_SKILLS_DIRECTORY`. Discover the actual provider directory; do not copy skills. Keep its `surface` entry as a symlink to this checkout's `skills/surface` directory. Preserve existing directories and foreign/broken links. Use `./bin/setup` for both installation and updates: it reuses a matching running release, starts a stopped matching release, and installs the checkout revision when different. `./bin/test` is read-only; `./bin/refresh` is a compatibility alias for setup. Explicit `--home`/`--port` selection is supported.

The source workflow requires Git and a compatible Bun patch version (currently `>=1.4.0 <1.5.0`). It installs committed HEAD; preserve user changes and never commit, reset, switch branches or pull solely to make an installer pass without task authorization. An update request permits inspecting/fetching and a fast-forward of the intended upstream; divergence requires reconciliation.

Use the selected installation consistently. Keep project-owned source, service metadata and optional database data separate. Do not replace an existing service/home implicitly. Never send a fixture interaction into a real user conversation. Setup health, provider discovery, browser interaction and agent delivery are separate acceptance checks.

Repository documentation is English. Preserve the canonical checkout and existing worktrees. For shell searches use `/opt/homebrew/bin/rg` when available; otherwise report its absence before selecting another tool.

Always update the design system when updating or preparing a Surface release. Check the provider repository's latest committed `main`, build that exact revision, update `apps/surface/design-system.lock.json`, and validate Surface against those package bytes. Do not silently reuse a stale development link or adopt unrelated uncommitted provider work. Preserve existing provider checkouts and links; an isolated source export plus the release builder's `--design-system-package` option supports this. Freeze the selected revision for the verification/release run so the tested and shipped bytes match.

Every UI/UX change must complete the automatic visual and interaction audit gate in `docs/source-workflow.md`: inspect rendered phone/desktop states, fix findings, and inspect again before delivery. E2E success alone is not UX acceptance.

## Self-owned E2E verification

For interaction or UI bug fixes, follow `docs/evaluations/self-e2e.md`. Reproduce the reported conditions before claiming the cause, add a failing regression where feasible, and run the relevant integrated browser flow yourself before asking the user to retry. A type check, build, unit test or HTTP health check is not E2E evidence. For comment delivery, use `bun run test:e2e:comments`: cover missing/invalid/fragment-updated authorization, idle and active recipients with explicit queue/steer, changed active turns, lost-acknowledgement recovery, SSE, offline recovery and reload without duplicate delivery. Match the user's conditions instead of relying only on a happy-path idle fixture.

Keep E2E providers and storage isolated; never send fixture messages to real tasks or alter preview recipients. Build and test immutable snapshots, preserve user drafts, inspect rendered evidence for visual changes, and record the exact tested build, scenarios, failures, results and device limitations. Update the relevant docs and evidence records when findings change the implementation or verification contract. Physical-device acceptance is separate; do not shift automatable verification to the user.

## JavaScript and TypeScript style

Prefer arrow functions for new or modified JavaScript and TypeScript functions, including callbacks and exported functions. Do not use the `function` keyword unless a specific semantic or API requirement calls for it, such as declaration hoisting, overload declarations, generators, or dynamic `this` binding. Keep exceptions narrowly scoped and explain the reason when it is not obvious from the code. Do not rewrite unrelated existing functions solely for style consistency.

## Package ownership

Follow `docs/architecture/package-boundaries.md`. Use only the Surface and CLI workspaces under `apps/`; do not split internal modules into packages without concrete independent consumers. Surface owns interactions, contracts, services, agent adapters, page runtime, MCP and templates. Use declared exports across apps and keep the dependency graph acyclic. Surface must not import CLI. Installation and lifecycle implementation belongs in `apps/cli/src/installation`, with no independent installer package. Use the root frozen Bun workspace lockfile. Root scripts are repository-wide tooling only; integrated verifiers belong in `tests/e2e`.
