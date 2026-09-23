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

`dev` builds the SvelteKit shell, then starts the combined host. The shell uses its built handler rather than a second development server. Rebuild/restart after shell changes; the component compiler is a live Vite middleware instance. The project-owned counter example below exercises mounting and component HMR.

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

`server/host.ts` is deliberately a thin bridge to `experiments/singleton/server.ts`; this slice does not relocate or duplicate that implementation. Existing project/interaction endpoints are inherited, but these slices validate server/compiler topology, lifecycle, fixed component mounting, workspace identity and the structured interaction loop. Backend integration and management UI controls remain later slices. No live agent callback is sent during verification.

## Verify

```sh
bun run check
bun run test
```

`test` builds the shell and checks same-instance readiness, SSR, the Vite client endpoint, exactly one TCP listener, state/port conflicts, repeated stop and restart. Listener inspection currently uses macOS `lsof`. Tests use temporary state and ephemeral ports.

The root CLI, existing experiments and shared installation are unchanged. This is a development implementation slice, not a production deployment.

## Mount this project's examples

The source lives at root `examples/` in this Git project. `dev` and `start` automatically register this checkout and mount that source before reporting readiness. The returned startup JSON includes `previewUrl`. `artifact.project.json` records it as a project-owned Surface. The app does not contain a separate copy of the example pages. From the repository root, with this app running:

```sh
bun src/cli/index.ts project register --state-dir /tmp/surface-app-development
bun src/cli/index.ts project list --state-dir /tmp/surface-app-development
bun src/cli/index.ts project mount --artifact ARTIFACT_UUID --state-dir /tmp/surface-app-development
```

Use the artifact ID returned by `list`. Open the mounted preview URL and select `routes/counter/+page.svelte`. Counter and draft state survive component HMR through explicit `previewState` stores. The source has a pinned Svelte dependency and frozen Bun lockfile; installation scripts are disabled during mount preparation.

`routes/feedback/+page.svelte` requires an interaction request URL with a capability, as described below. A plain catalog link does not bind it to an agent conversation.

To unmount, use `project unmount --artifact ARTIFACT_UUID` with the same state selection. Unmount revokes future preview/source requests and preserves source; it does not erase code already loaded into an open browser document.

`bun run verify:fixture` (from `apps/surface`) copies the project-owned examples to a disposable directory and verifies Chrome interaction, HMR and unmount. Tests never edit or unmount the project's live example source. The examples are tracked; service state, credentials and installed dependencies remain ignored.

## Project and workspace identity

Project operations at `/api/v1/projects/operations` now use the existing Git workspace resolver. Main and linked worktrees share the project UUID but receive distinct stable workspace IDs and namespaces. The shared state holds one workspace ledger; a small marker in each Git administrative directory identifies the worktree. No per-worktree `.decompozr/surface` or database is created.

Use the existing public CLI with `SURFACE_STATE_DIR` pointing to this app's explicit state directory. From a Git project root with a Surface project manifest:

```sh
SURFACE_STATE_DIR=/tmp/surface-app-development bun /absolute/path/to/surface/src/cli/index.ts project register
SURFACE_STATE_DIR=/tmp/surface-app-development bun /absolute/path/to/surface/src/cli/index.ts project mount --artifact ARTIFACT_UUID
```

`--data-root PATH` selects the external location reserved for future workspace data; its default is `project-data` beside the state directory. The choice is persisted, but the directory and SQLite files are not allocated by registration or mounting. Changing it or adopting legacy single-root bindings requires explicit migration. Branch renames and detached HEAD preserve identity; independent clones with copied project UUIDs are rejected.

Run `bun run verify:workspaces` to exercise two disposable real Git worktrees, namespace isolation, clone conflict, restart and data-root guards. Existing user worktrees are never involved.

## Structured agent interaction

The host forwards an optional typed `AgentAdapter` to the existing interaction service. The normal entry point uses the existing Codex adapter; automated checks inject a fixture adapter and never contact a live conversation. A request binds a mounted component to an exact project root and conversation, validates submitted JSON against its schema, and lets the bound agent publish a result back to the page.

The project-owned examples include `routes/feedback/+page.svelte` and `feedback.schema.json`. For an explicitly selected conversation, use the existing development CLI (from the repository root):

```sh
bun experiments/singleton/cli.ts bind --project /absolute/project-root --thread EXACT_THREAD_ID --socket /absolute/control.sock --state-dir /tmp/surface-app-development
bun experiments/singleton/cli.ts request --binding BINDING_ID --namespace WORKSPACE_NAMESPACE --name MOUNT_NAME --component routes/feedback/+page.svelte --title 'Choose a label' --schema-file examples/feedback.schema.json --state-dir /tmp/surface-app-development
```

Open the returned `previewUrl`. Opening or editing the form sends no agent message; pressing **Send feedback** submits `{ "label": "..." }`. The request capability cannot publish agent results or cross workspace namespaces. The agent receives the request/response identity and an explicit result command targeting this state directory:

```sh
bun experiments/singleton/cli.ts result --request REQUEST_ID --data '{"message":"Reviewed choice"}' --state-dir /tmp/surface-app-development
```

These are trusted local components sharing one origin, not a hostile-code sandbox. An accepted response means transport delivery was accepted, not that the agent completed the task. A delivery marked `unknown` remains uncertain and is not automatically resent. Duplicate submissions with the same response identity and data do not deliver twice. Unmount revokes browser access while preserving the original interaction record; restart preserves results without replaying responses.

Run `bun run verify:interactions` for the real Chrome form-to-fixture-adapter-to-result loop. It also checks schema rejection, cross-workspace rejection, result publication authorization, duplicate suppression, closed requests, uncertain delivery, restart and unmount. Test state, Git worktrees, sockets and browser processes are disposable.

The four agreed foundation slices are now represented here: shared host/compiler, a mounted HMR fixture, project/workspace identity, and structured interaction. This remains a development integration using the existing runtime bridge, not production adoption or a shared-installation upgrade.

## Tailnet browser access

For access through an existing Tailscale network, start the development host with an explicit HTTPS browser origin:

```sh
bun run start --state-dir /absolute/development-state --browser-origin https://HOST.ts.net:8463
tailscale serve --bg --https=8463 http://127.0.0.1:4319
```

Choose an unused Serve port. This is a tailnet-only mapping, not a public Funnel. The runtime accepts the exact configured browser host/origin alongside loopback; Vite allows that hostname and HMR uses the browser's secure WebSocket connection. The management connection file remains loopback-only and management APIs still require their token. Existing mounts and request URLs can be opened by replacing the loopback origin with the configured HTTPS origin, retaining the path, query and fragment.

To remove this mapping only: `tailscale serve --https=8463 off`. Other Serve/Funnel routes are unaffected. This does not install an auto-start system service.

## Readable mounted page routes

The app exposes `/workspace/{project-name}/{worktree-name}/{mounted-folder}/{page}`. For this checkout, `/workspace/surface/main/examples/counter` renders `examples/routes/counter/+page.svelte`; `/workspace/surface/main/examples/` lists the available pages. No component filename query is needed.

Project names and folder names become lowercase URL slugs. The primary checkout is `main`; linked worktrees use their folder name. The alias is captured on first mount and persisted with the internal UUID binding, so branch switches and restarts do not rename URLs. Collisions are rejected, including aliases reserved by unmounted records. Explicit alias renaming is not yet implemented.

The source manifest declares `"components": "routes", "routes": "routes"`. Static nested paths and a root `+page.svelte` are supported. This is mounted Svelte page discovery, not full SvelteKit routing: layouts, dynamic parameters, server load functions and form actions are not implemented. Legacy `/n/` component previews remain available for existing clients. Interaction URLs use the readable page path plus request identity/capability; the internal API remains UUID-scoped.


## Shared workspace shell

`src/routes/+layout.server.ts` receives the registered route tree from the host, and `SurfaceShell.svelte` renders it for both the SvelteKit home and mounted pages. `src/server/navigation.ts` derives project/worktree/folder/page nodes only from the service ledger and ready route mounts. Folder indexes do not expose raw filesystem contents. The shell uses a white background with slate, sand, and lavender accents, desktop collapse, a mobile drawer, and breadcrumbs.

Run `bun apps/surface/scripts/verify-navigation.ts` from the repository root after building this app for parent SSR, worktree separation, nested folder/page routes, desktop and mobile behavior. `verify-recipients.ts` exercises the common interaction UI with fixture adapters. Browser screenshots remain in ignored `.decompozr/surface/screenshots`. Health, provider directory inspection, fixture delivery, installation identity, and actual user delivery are separate evidence.
