# Surface app

Current slice: the built SvelteKit app and the existing live component compiler share one local server, one Vite instance and one HTTP listener. Versions remain pinned to the verified Bun/SvelteKit foundation.

## Prepare and run

This is currently a repository integration, not a standalone installed package. From the repository root, prepare the app and the runtime it reuses:

```sh
bun install --frozen-lockfile --ignore-scripts
bun install --cwd experiments/singleton --frozen-lockfile --ignore-scripts
bun install --cwd apps/surface --frozen-lockfile --ignore-scripts
cd apps/surface
bun run check
bun run dev --state-dir /tmp/surface-app-development
```

`dev` builds the SvelteKit shell, then starts the combined host. The shell uses its built handler rather than a second development server. Rebuild/restart after shell changes; the component compiler is a live Vite middleware instance. The fixed counter fixture below exercises mounting and component HMR.

To start an already-built app:

```sh
bun run build
bun run start --state-dir /tmp/surface-app-development
# Or choose a different port:
bun run start --state-dir /tmp/surface-app-development --port 4320
```

The host binds to `127.0.0.1`, default port 4319 (`--port` overrides `PORT`). An occupied port fails without fallback. `--port 0` selects an ephemeral test port. The state directory is required explicitly; this entry point does not select or update the existing shared Surface installation. Use a dedicated development state directory.

Startup prints the actual origin, PID and instance ID. Ctrl+C/SIGTERM stops the compiler/listener and releases the state lock. Runtime metadata and cache remain in the selected directory for reuse. No project database is allocated by this setup.

## Routes and ownership

- `/` and `/_app/*`: the built SvelteKit page and its assets.
- `GET /health`: the SvelteKit route reports `service`, `status` and the runtime's PID, instance ID and compiler identity. It returns 503 when invoked without runtime context.
- `/api/health` and the compiler middleware: owned by the existing singleton runtime on the same listener.

The host injects only public readiness metadata into SvelteKit locals. It does not expose the management token or state path. The original runtime retains its host/origin checks, management authorization and operation endpoints.

`server/host.ts` is deliberately a thin bridge to `experiments/singleton/server.ts`; this slice does not relocate or duplicate that implementation. Existing project/interaction endpoints are inherited, but these slices validate server/compiler topology, lifecycle and one fixed component mount. Workspace registration, backend integration, interaction workflows and management UI controls remain later slices. No live agent callback is sent during verification.

## Verify

```sh
bun run check
bun run test
```

`test` builds the shell and checks same-instance readiness, SSR, the Vite client endpoint, exactly one TCP listener, state/port conflicts, repeated stop and restart. Listener inspection currently uses macOS `lsof`. Tests use temporary state and ephemeral ports.

The root CLI, existing experiments and shared installation are unchanged. This is a development implementation slice, not a production deployment.

## Mount the fixed fixture

With the app running and from the repository root, use the existing development CLI against the same explicit state directory:

```sh
bun experiments/singleton/cli.ts namespace fixture --state-dir /tmp/surface-app-development
bun experiments/singleton/cli.ts mount apps/surface/fixtures/counter --namespace fixture --name counter --state-dir /tmp/surface-app-development
```

Open the returned `previewUrl`, then select `src/Counter.svelte`. Increment the counter and enter a draft. Editing the component heading should update the open page without reloading it; `previewState` explicitly preserves the counter and draft across component replacement. The fixture has a pinned Svelte dependency and frozen Bun lockfile. Mount preparation installs dependencies with lifecycle scripts disabled.

```sh
bun experiments/singleton/cli.ts unmount --namespace fixture --name counter --state-dir /tmp/surface-app-development
```

Unmount revokes future preview and source requests and removes the mount symlink, while retaining the project source. It does not erase code already loaded into an open browser document.

From `apps/surface`, run `bun run verify:fixture` for the automated Chrome check (requires local Google Chrome and root dependencies). It mounts a temporary fixture copy on an ephemeral port, verifies interaction and HMR with retained state, then checks unmount revocation and continued SvelteKit health. The browser, host and temporary directory are cleaned up afterward. No shared installation or agent conversation is contacted.
