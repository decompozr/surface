# Singleton namespaces and symlink mounts

Status: exploratory evidence, not a finalized production design. Run on September 20, 2026 (America/Toronto).

A subsequent [scoped-error and preview-state experiment](2026-09-20-scoped-hmr.md) addresses the error overlay and state-retention limitations observed below. The later [interaction integration](2026-09-20-singleton-interactions.md) connects this host to agent callbacks. This record preserves the original observations.

## Design question

Can the intended workflow use one long-running server, namespaces, and symlinked source folders, with automatic dependency preparation and component rendering through one Vite instance?

This follows the user's clarification after the earlier per-project-process experiment. That earlier topology remains available for comparison; the singleton is the preferred direction to investigate.

## Experiment

The [executable pilot](legacy-page-runtime.md) runs one Bun process with one Node-compatible HTTP listener and one Vite middleware instance. Installation spawns short-lived Bun package-manager processes, but mounting never starts another project development server.

Two temporary source folders declare Svelte 5.57.1 and different nanoid versions: 4.0.2 and 5.1.5. Neither begins with `node_modules` or a lockfile. Each has an `artifact.json` component-directory/props declaration and a TypeScript Svelte counter. The server is started first; the CLI then creates `design` and `analysis` namespaces and mounts each folder under the same local name, `controls`.

The server automatically installs declared dependencies, creates project-owned Bun lockfiles, creates namespace symlinks, discovers component files, compiles them through Vite, and returns a component catalog and generated preview hosts.

## Observations

| Question | Observed outcome |
| --- | --- |
| Can mounts be added after the server starts? | Both folders became ready through `registered → installing → preparing → ready`. |
| Are mounts actual symlinks? | Filesystem checks verified each link points to its registered canonical source. |
| Can one Vite use separate dependency versions? | Chrome rendered 4.0.2 and 5.1.5 from the respective package metadata and executed both nanoid implementations. Browser module requests pointed to each source's own `node_modules/nanoid`. |
| Can the host render a standalone component? | Generated entries passed declared props and rendered working Svelte counters without a project `index.html` or dev-server command. |
| Does editing the original source work? | Updating a file behind its mount changed the browser heading through HMR without reloading the document. The local counter reset to zero. |
| Are newly added/deleted components discovered? | The catalog and generated hosts reflected additions/deletions without a server restart. |
| Does a compile failure stay within a namespace? | No. Vite's error overlay appeared in the other namespace as well. Its component remained rendered; interaction worked after the error was corrected. |
| Does unmount stop the server? | No. The symlink was removed, preview/source requests were rejected, and the other mount remained available. Source and dependencies remained intact. |
| Does remount retain the URL? | Yes, under the same namespace/name and server origin. The original server PID and Vite object remained unchanged, with no separate Vite HTTP listener. |
| Can registrations survive an explicit singleton restart? | Both active registrations were restored using existing frozen lockfiles. |
| Are basic failure outcomes visible? | Unauthenticated management, unexpected origins, duplicate singleton state writers, and silent source changes under an existing name were rejected. An invalid lockfile produced a failed mount with logs while healthy previews remained available. |

An early generated host used a virtual module ID ending in `.svelte`; the Svelte plugin tried to compile its JavaScript as component source. Giving generated hosts a `.entry.js` suffix resolved this. This is one reason an explicit host/plugin layer is needed around symlink discovery.

## What is established

The central singleton workflow is feasible for the tested Svelte/ESM setup. Artifact manages namespaces, installation, discovery, and generated hosts; Vite supplies transformation, module resolution, and HMR. Merely creating links would not implement those management operations.

The implementation is versioned under `experiments/singleton`. Reproduce it with `bun run verify:singleton` after installing that experiment's dependencies. TypeScript checking also passes. Local screenshots and the browser module-request receipt are retained under ignored `.artifact/singleton-proof/`; the temporary test sources and server are cleaned up.

## What remains open

- The Svelte compiler/plugin/runtime is shared and pinned. Different Svelte versions, per-project Vite plugin/config combinations, and other frameworks are not established.
- Only a browser-ready ESM dependency case is exercised. CommonJS prebundling needs a separate resolution/isolation experiment.
- All namespaces share one browser origin. They organize projects but are not trust boundaries.
- Vite errors and component-discovery reloads can affect other open namespaces. Targeted diagnostics and refresh behavior should be the next experiment.
- Installation is Bun-only, skips lifecycle scripts, and preserves existing lockfiles with frozen installation. Native build scripts and other package managers need an explicit contract.
- Compilation is for development previews, not a production deployment build. Browser success is separate from source type checking.
- This pilot does not yet integrate the existing request/result/agent adapter layer or MCP. No model session was contacted in this experiment.

These outcomes justify continuing the singleton direction without freezing its storage format, API, dependency policy, or plugin design.
