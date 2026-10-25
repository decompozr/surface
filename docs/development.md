# Development policy

This document preserves the detailed repository rules linked from the short agent entry. Paths in code spans are relative to the repository root. Read only the sections relevant to the task; current specifications are indexed in [the documentation](README.md).

Read `SETUP.md` for user installation and `skills/surface/references/setup.md` for the agent-managed source workflow.

When asked to setup this clone, select a prepared release with `./bin/setup --release /absolute/release.json --skills-dir PROVIDER_SKILLS_DIRECTORY`. Discover the actual provider directory; do not copy skills. Keep its `surface` entry as a symlink to this checkout's `skills/surface` directory. Preserve existing directories and foreign/broken links. Setup configures and installs the selected prepared bytes without building source. A repeat run may reuse the saved release selection: reuse a matching running release, start a stopped matching release, or install a different explicitly selected release. `./bin/test` is read-only. Explicit `--home`/`--port` selection is supported.

Repository lifecycle commands have separate roles: `./bin/build` creates a complete candidate archive from a selected committed revision; `./bin/release` validates that existing archive and its matching trusted acceptance receipt, then promotes identical bytes locally; `./bin/setup` consumes `release.json` for package installation and service/skill configuration. Release performs no rebuild, repack, install or upload. See `docs/architecture/release-distribution.md` and `docs/evaluations/release-candidate.md` for mandatory gates. The runtime CLI owns prepared installation and service/project/interaction lifecycle, not source release production.

The checkout tooling requires Git and a compatible Bun patch version (currently `>=1.4.0 <1.5.0`). Setup verifies its selected artifact independently of checkout HEAD and permits documentation-only changes; canonical skill-tree and runtime CLI compatibility is checked explicitly (setup tooling is excluded). Saved selection verifies installed bytes without depending on the original download. Preserve user changes and never commit, reset, switch branches or pull solely to make setup pass without task authorization. An update request permits inspecting/fetching and a fast-forward of the intended upstream; divergence requires reconciliation. Build/export and acceptance remain explicit steps before choosing a new release.

Use the selected installation consistently. Keep project-owned source, service metadata and optional database data separate. Do not replace an existing service/home implicitly. Never send a fixture interaction into a real user conversation. Setup health, provider discovery, browser interaction and agent delivery are separate acceptance checks.

Repository documentation is English. Preserve the canonical checkout and existing worktrees. For shell searches use `/opt/homebrew/bin/rg` when available; otherwise report its absence before selecting another tool.

Always update the design system when updating or preparing a Surface release. Check the provider repository's latest committed `main`, build that exact revision, update `apps/surface/design-system.lock.json`, and validate Surface against those package bytes. Do not silently reuse a stale development link or adopt unrelated uncommitted provider work. Preserve existing provider checkouts and links; an isolated source export plus the candidate builder's `--design-system-package` option supports this. Freeze the selected revision for the verification/release run so the tested and shipped bytes match.

Every UI/UX change must complete the automatic visual and interaction audit gate in `docs/source-workflow.md`: inspect rendered phone/desktop states, fix findings, and inspect again before delivery. E2E success alone is not UX acceptance.

## Self-owned E2E verification

For interaction or UI bug fixes, follow `docs/evaluations/self-e2e.md`. Reproduce the reported conditions before claiming the cause, add a failing regression where feasible, and run the relevant integrated browser flow yourself before asking the user to retry. A type check, build, unit test or HTTP health check is not E2E evidence. For comment delivery, use `bun run test:e2e:comments`: cover missing/invalid/fragment-updated authorization, idle and active recipients with explicit queue/steer, changed active turns, lost-acknowledgement recovery, SSE, offline recovery and reload without duplicate delivery. Match the user's conditions instead of relying only on a happy-path idle fixture.

Keep E2E providers and storage isolated; never send fixture messages to real tasks or alter preview recipients. Build and test immutable snapshots, preserve user drafts, inspect rendered evidence for visual changes, and record the exact tested build, scenarios, failures, results and device limitations. Update the relevant docs and evidence records when findings change the implementation or verification contract. Physical-device acceptance is separate; do not shift automatable verification to the user.

## JavaScript and TypeScript style

Prefer arrow functions for new or modified JavaScript and TypeScript functions, including callbacks and exported functions. Do not use the `function` keyword unless a specific semantic or API requirement calls for it, such as declaration hoisting, overload declarations, generators, or dynamic `this` binding. Keep exceptions narrowly scoped and explain the reason when it is not obvious from the code. Do not rewrite unrelated existing functions solely for style consistency.

## Type safety and interface contracts

Treat type safety and clear typed interfaces as core design requirements, not optional polish. Define explicit contracts for public APIs, component props, module boundaries, events, requests and results. Reuse the owning module's canonical types instead of duplicating shapes across consumers; keep straightforward local inference where it remains clear.

Validate external or persisted data at runtime before treating it as a trusted type. Use `unknown` at untrusted boundaries and narrow it through validation. Prefer discriminated unions for distinct states and event variants so invalid combinations are difficult to represent and consumers handle variants explicitly.

Do not use `any`, unchecked type assertions, non-null assertions or compiler suppressions merely to silence errors. Resolve the underlying contract or narrowing problem; narrowly document unavoidable interop exceptions. Update owned producers, consumers and relevant checks together when a contract changes. Strong typing does not justify extra packages, generic frameworks or interfaces without a concrete purpose.

## Package ownership

Follow `docs/architecture/package-boundaries.md`. Use only the Surface and CLI workspaces under `apps/`; do not split internal modules into packages without concrete independent consumers. Surface owns interactions, contracts, services, agent adapters, page runtime, MCP and templates. Use declared exports across apps and keep the dependency graph acyclic. Surface must not import CLI. Installation and lifecycle implementation belongs in `apps/cli/src/installation`, with no independent installer package. Use the root frozen Bun workspace lockfile. Root scripts are repository-wide tooling only; integrated verifiers belong in `tests/e2e`.

## Design-system consumption

Before UI work, read the pinned provider [design guide](design/system/DESIGN.md) and [review checklist](design/system/DESIGN-REVIEW.md), then [Surface applicability and provenance](design/system-adoption.md). These exact package-document snapshots make the shared rules available to agents without network or dependency-resolution assumptions. The guide pin is separate from `apps/surface/design-system.lock.json`; check both before relying on a component capability. Keep shared presentation in the provider and Surface behavior in `docs/design/`. Complete the checklist and Surface's existing rendered/interaction audit before delivery; report engineering, visual review and human acceptance separately.

Use design-system primitives and their public APIs for shared UI appearance and interaction behavior. Do not create replacement primitives or override internal component selectors for visual density, icons, colors, borders, shadows or interaction states. Keep Surface CSS focused on product-specific layout and positioning where needed. Check existing APIs first; when a capability is missing, submit a concrete upstream design-system request and adopt its committed implementation instead of adding a local workaround. Any unavoidable local exception must state its reason and removal condition.

## Test placement

Colocate module tests beside their implementation as `<module>.test.ts`; do not create app-level test directories. Follow [test ownership](architecture/package-boundaries.md#tests-and-repository-tooling) for cross-app E2E, fixtures and repository checks.

## Development compatibility policy

Support the current source layout and public API only. When renaming or moving code, update all owned callers, tests and current documentation together. Do not add compatibility aliases, historical path probing, retired host modes or old command dispatch solely to keep an earlier experiment working. Compatibility requires a concrete external consumer and an explicit support decision. Preserve user data: reject unsupported formats without overwriting them; any required migration is a separately scoped, explicit operation. Keep historical evidence as dated documentation or Git history, not as production runtime branches.

## Working-data retention

Keep concise completed history in `docs/history`, not permanent copies of every verification run. After recording results, tested revisions, failures and limits, remove disposable source exports, dependency trees, builds, release archives, test installations, logs, screenshots and traces. Keep raw evidence only for a specific unresolved issue with a stated retention reason and exit condition. Check active process/task references first; preserve runtime state, user drafts, interactions and selected preview releases. Never create nested `.decompozr/.decompozr` output or replace cleanup with another bulk archive.
