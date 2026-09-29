# Mounted-page runtime

The public host mounts trusted project-owned Svelte route source under one shared Vite compiler and HTTP listener. [Page authoring](../../skills/surface/references/pages.md) owns manifest examples and mount commands; [project operations](project-operations.md) owns identity and admission.

## Source and dependencies

A source directory owns `package.json`, a Bun lockfile and `surface.json`. The manifest declares Svelte, a contained component directory and a routes directory. Static lowercase route segments ending in `+page.svelte` become readable pages. Optional `props` maps source-relative component paths to JSON props. Hidden folders, `node_modules`, `dist` and symbolic-link entries are excluded from component discovery. Mounted SvelteKit layouts, load functions, actions, SSR and dynamic route parameters are unsupported.

The compiler/runtime is shared. Mounted sources must declare the exact Svelte version used by `apps/surface/package.json` (currently 5.57.1). Other dependencies resolve from their source directory. Mount preparation runs Bun with lifecycle scripts disabled; existing Bun locks are frozen. npm, pnpm and Yarn lockfiles are rejected rather than replaced. A dependency-install failure remains a mount diagnostic and must not silently rewrite an existing lock.

Browser-ready ESM works directly. Explicit `prebundle` package entries in `surface.json` enable source-scoped JavaScript CommonJS/mixed bundles. Entries must resolve inside the source dependency tree and emit one JavaScript bundle. Node builtins, native modules, emitted assets and general dynamic require are outside this contract. Bundles are prepared on mount/remount, not automatically after dependency edits.

## Compilation and browser state

The runtime compiles mounted source for browser development; it does not produce deployment bundles or prove TypeScript correctness. Shell changes require a Surface rebuild, while supported mounted-source edits use HMR.

Mount-scoped compiler diagnostics retain the last successful rendering and clear after recovery. Shared compiler/transport failures do not have process or confidentiality isolation. Unbounded source churn and indefinite uptime are not established operating guarantees.

Component HMR can reconstruct local state. `previewState` from `virtual:surface-preview` retains explicitly keyed values within that preview document, with caller-selected compatibility versions. Full navigation resets that session state. Copy the [virtual module declarations](../../apps/surface/src/lib/server/page-runtime/preview.d.ts) into the project's included declarations. General draft restoration is project-owned; comment persistence is Surface-owned.

`virtual:surface-interactions` exposes the request-scoped page client. The [interaction requirements](../requirements/agent-interaction.md) own submission identity, delivery modes and result semantics. The runtime denies browser access to service source and management credentials; trusted pages still share an origin and are not a sandbox for hostile code.

## Evidence

Current compiler/browser regressions live in `tests/e2e/runtime`; CLI/MCP integration and mounted comments add their own gates. The [original runtime study](../experiments/legacy-page-runtime.md) retains dated mechanisms and measurements, not current commands or additional compatibility guarantees.
