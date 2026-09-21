# Scoped compiler errors and preview state

Status: experimental follow-up to the [singleton namespace pilot](2026-09-20-singleton-namespaces.md), September 20, 2026 (America/Toronto).

## Questions and changes

The first singleton pilot exposed two distinct issues: Vite's shared error overlay obscured unrelated namespaces, and Svelte component HMR reset local `$state` even without a document reload.

The follow-up keeps the same singleton/Vite topology. It disables the built-in global overlay and introduces a preview client that attributes compiler diagnostics to the source mount before displaying them. A successful update clears that mount's diagnostic. This isolates the error UI, not the compiler process or diagnostic transport; other clients can still receive Vite console messages/payloads. Unknown/global errors remain in shared diagnostics.

The client also provides `previewState(key, initial, version)`, a Svelte writable store held outside the component lifecycle and retained in Vite HMR data. State is scoped to the preview document and component URL. Component authors opt in and change the version when a new value shape or meaning requires a reset. Ordinary local `$state` variables are not automatically captured or migrated.

Discovery notifications now update the relevant catalog directly instead of broadcasting a full reload. Host props use a reactive store-backed props object, so changing props does not require remounting or refreshing the document. Removing an actively displayed component and unmounting still refresh the affected view; unrelated views remain intact.

## Browser evidence

`bun run verify:singleton` exercises these cases through the real Vite/Svelte pipeline:

| Scenario | Observation |
| --- | --- |
| Component markup edit | New heading appeared; opted-in counter and draft survived; original browser document marker remained. |
| CSS edit | New style appeared; interaction state survived. |
| Component addition/deletion | Catalog updated live; existing component documents and counters were unchanged. |
| Compile error in alpha | Alpha displayed its scoped error. Beta had no error panel and its button remained clickable. |
| Correction after compile error | Alpha rendered the corrected heading, removed its diagnostic, and retained counter/draft state. |
| Counter state version increment | Counter reset to its initial value; draft and document remained. |
| Host props change | Label changed reactively; counter, draft, and document remained. |
| Explicit full page refresh | Preview state reset; the other namespace's document remained unchanged. |

The existing singleton, dependency-version, mount/unmount, authorization, failed-install, and restore checks also passed. The intentional compilation failure emits expected Vite console errors during the test. TypeScript checking of the experiment passes.

Screenshots of the scoped failure and preserved state, plus the machine-readable receipt, are under ignored `.artifact/singleton-proof/`. Test servers and temporary source directories are cleaned up. No agent session is contacted.

## Limits and next questions

This demonstrates predictable preservation for explicitly registered state in the tested Svelte setup. It does not establish automatic preservation of arbitrary component internals, DOM selection/focus, effects, resources, or state from other frameworks. State is not durable across navigation or a new server/browser session. Authors must choose stable, distinct keys and an intentional version/reset policy.

Error attribution currently uses source-mount identity, not a complete per-browser dependency graph. Shared compiler failures, runtime exceptions, and process crashes need separate handling. All mounts still share one browser origin and execution trust boundary.

The earlier global-overlay/state-reset observations remain historical evidence. This follow-up changes the preview UX without claiming production isolation or a stable public SDK.

## Sources

- [Vite HMR API](https://vite.dev/guide/api-hmr): custom listeners and `import.meta.hot.data`.
- [Svelte issue 14434](https://github.com/sveltejs/svelte/issues/14434): transparent local-state preservation request. The installed Svelte 5.57.1 `internal/client/dev/hmr.js` and the browser experiment were inspected directly rather than assuming older Svelte HMR options still apply.
