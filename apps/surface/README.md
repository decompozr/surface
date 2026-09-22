# Surface app

First implementation slice: the minimal Bun + SvelteKit app, using the exact SvelteKit, Svelte, Vite and adapter-node versions already exercised by the foundation experiment.

```sh
cd apps/surface
bun install --frozen-lockfile --ignore-scripts
bun run check
bun run dev
```

The development server uses `http://127.0.0.1:4319`. For another port, use `bun run dev --port 4320`. An occupied development port fails rather than silently selecting another one.

To build and run the standalone SvelteKit app with Bun:

```sh
bun run build
bun run start
# Or choose a different port:
PORT=4320 bun run start
```

The built server binds to loopback; its default port is 4319. Stop either process with Ctrl+C or SIGTERM.

## Routes

- `/`: a minimal server-rendered Surface page.
- `GET /health`: `{ "service": "surface", "status": "ready" }`, with caching disabled.

The health route reports only that this app can respond. The build uses SvelteKit's Node adapter, as in the verified foundation; mounted components will still require the separate shared Vite runtime in a later slice.

Mounting, backend/database resources, interactions, MCP and management operations are not wired into this slice. It creates no Surface service state. Existing runtime code, experiments, the root CLI and the shared installation remain unchanged. This development app is not a production deployment.
