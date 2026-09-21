# SvelteKit singleton foundation experiment

A built SvelteKit application shell and the existing runtime component compiler share one Bun process, one HTTP listener, and one live Vite middleware instance. The Kit shell supplies `/manage`, a server-rendered mount overview, and `/kit-api/status`, a read-only JSON view. Existing authenticated singleton APIs and CLI commands retain all mutations and agent interactions.

This is a tested foundation candidate, not an adopted production architecture. Mounted components remain client-rendered through the existing generated entries. The Kit build does not bundle those future mounts, and this experiment does not establish SSR for mounted code or support for entire mounted SvelteKit applications.

## Install and run

From the checkout:

```sh
bun install --frozen-lockfile
bun install --cwd experiments/singleton --frozen-lockfile --ignore-scripts
bun install --cwd experiments/sveltekit --frozen-lockfile --ignore-scripts
bun run --cwd experiments/sveltekit check
bun run --cwd experiments/sveltekit build
bun experiments/sveltekit/server.ts --state-dir /absolute/local-state --port 4319
```

Open `http://127.0.0.1:4319/manage`. Keep the foreground terminal running; Ctrl+C uses the singleton shutdown path. Use the existing CLI with the same state directory:

```sh
bun run singleton namespace project-a --state-dir /absolute/local-state
bun run singleton mount /absolute/project/panel --project /absolute/project \
  --namespace project-a --name panel --state-dir /absolute/local-state
```

Follow the [singleton guide](../singleton/README.md) for source requirements, binding, requests, callbacks, and unmounting. Source edits continue through Vite HMR. Management-shell source edits require rebuilding the Kit application and restarting its wrapper. Opening `build/index.js` directly starts the adapter's separate default server and does not provide this integrated runtime; use `server.ts` above.

The page/API expose namespace, mount name, status, and component-relative paths. They do not expose source roots, request or management tokens, binding/session IDs, or socket paths. This view does not authorize mutations: the core API still requires its management credential. Host/origin checks apply before the Kit handler. All pages remain trusted local code under a shared browser origin.

## Verify

Requires Chrome and the build above:

```sh
bun experiments/sveltekit/verify.ts
```

The script creates temporary project-owned source folders and mounts them after the Kit shell starts. It checks actual browser execution of two nanoid versions, opted-in draft retention through HMR/error recovery, an independently usable second namespace, fixture delivery through the existing interaction core, actual result CLI publication, reload restoration, scoped authorization, sanitized Kit views, unmount/remount, and the single listener/Vite topology. Malformed registry data deliberately produces a diagnostic rather than a false healthy empty view.

The fixture adapter does not contact a model session. Evidence is written to ignored `.artifact/sveltekit-proof/`; temporary services, sources, and the fixture socket are cleaned up. An unmounted view may display its unavailable response. Reload after remounting: revisiting an identical capability-fragment URL can perform only a same-document navigation instead of requesting fresh content.

See the [experiment record](../../docs/experiments/2026-09-21-sveltekit-foundation.md) for observations, boundaries, and the foundation recommendation.
