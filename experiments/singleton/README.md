# Singleton namespace experiment

An executable experiment for the preferred direction: start one server, create a namespace, then mount component folders into it. One HTTP listener and one Vite instance serve every mount. Installation uses short-lived Bun subprocesses; no per-project development server is launched.

This does not replace the previous `artifact serve` implementation. Use the separate commands below to reproduce and compare the designs. The existing agent callback API and MCP are not wired into this experimental host yet.

## Run

From the Artifact checkout:

```sh
bun install --cwd experiments/singleton --frozen-lockfile
bun run singleton serve
```

The default URL is `http://127.0.0.1:4318`. Keep that terminal running. In another terminal:

```sh
bun run singleton namespace project-a
bun run singleton mount /absolute/project-a/panel --namespace project-a --name panel
bun run singleton list
bun run singleton unmount --namespace project-a --name panel
```

All commands accept `--state-dir /absolute/path`; `serve` also accepts `--port`. The default experimental state is `.artifact/singleton` in this checkout. A lock rejects a second writer. Ctrl+C stops the singleton. Registrations are restored when it starts again, except mounts explicitly unmounted.

## Source folder contract

The source folder needs ordinary files, not a running Vite application:

```text
panel/
├── package.json
├── artifact.json
└── src/
    ├── Counter.svelte
    └── another/Detail.svelte
```

Example `package.json`:

```json
{
  "name": "panel",
  "private": true,
  "type": "module",
  "dependencies": {
    "svelte": "5.57.1",
    "nanoid": "5.1.5"
  }
}
```

Example `artifact.json`:

```json
{
  "framework": "svelte",
  "components": "src",
  "props": {
    "src/Counter.svelte": { "label": "Project A" }
  }
}
```

Example `src/Counter.svelte`:

```svelte
<script lang="ts">
  let { label = 'Counter' } = $props();
  let count = $state(0);
</script>
<h1>{label}</h1>
<button onclick={() => count++}>Count {count}</button>
```

`artifact.json` can be omitted to use `framework: svelte`, `components: src`, and empty props. Package declarations are required; the server does not infer dependencies from arbitrary imports. Props must be JSON-serializable; custom context providers and framework-specific application configuration are outside this experiment.

## Mount lifecycle

1. Register the canonical source under a namespace/name.
2. Run `bun install --ignore-scripts` in the source directory. If a Bun lockfile exists, add `--frozen-lockfile`; otherwise Bun creates one. Fail visibly on an incompatible lockfile. This modifies the source folder's `node_modules` and may create its lockfile.
3. Create `workspace/mounts/<namespace>/<name>` as a symlink to the source.
4. Recursively discover `.svelte` files in the declared component directory, ignoring hidden files, nested symlinks, `node_modules`, and `dist`.
5. Add the real source to Vite's allowed files and watcher. Compile discovered components through the existing Vite instance.
6. Return `http://127.0.0.1:4318/n/<namespace>/<name>/`, a component catalog. Each component link opens a generated host with its declared props.

The lifecycle is `registered → installing → preparing → ready`, or `failed` with an error and bounded install log. Repeating a ready mount is idempotent. To reprepare changed dependency declarations, explicitly unmount, reconcile the source lockfile as needed, and mount again. Automatic installation occurs at mount/restore time; package changes do not trigger an unattended installation loop.

Unmount removes the symlink, revokes source/preview routes, and preserves the source folder, dependencies, lockfile, and server. The namespace URL is stable when remounted under the same server origin. Adding/removing components updates discovery; editing an existing source triggers Vite HMR. Manifest/discovery changes currently reload connected preview pages.

## Dependency and framework boundary

`resolve.preserveSymlinks: false` lets Vite resolve mounted source to its real location. Ordinary ESM imports then resolve against that source's dependency tree. The experiment observes nanoid 4.0.2 and 5.1.5 executing from two different `node_modules` trees at the same time.

The Svelte compiler/plugin/runtime is shared and pinned to 5.57.1. The host supplies that runtime to generated component entries, so mounted package manifests must declare that exact version. This does not demonstrate independent Svelte compiler versions, arbitrary per-project Vite configs, SvelteKit, SSR, or arbitrary frameworks.

Dependency discovery/prebundling is disabled for this pilot, and the dependency case uses browser-ready ESM. CommonJS packages need another experiment. npm/pnpm/Yarn lockfiles are rejected rather than silently converted. Lifecycle scripts are not run, so dependencies needing install-time native builds need an explicit future contract.

The host compiles for development and the browser renders the result. It does not produce deployment bundles or establish successful type checking; those require separate operations.

## Observed tradeoffs

- Source HMR retained the browser document but reset the Svelte component's local counter state.
- A compile error in one namespace displayed Vite's shared error overlay in another namespace. The other component remained rendered; its interaction was checked after recovery. Error UX is not isolated.
- Namespace paths organize mounts; they are not browser-origin security boundaries. All previews are trusted local code on one origin.
- Component discovery changes currently broadcast a full reload. Targeted discovery notifications/error routing are follow-up design work.

## Reproduce the experiment

Requires the root development dependencies and installed Chrome:

```sh
bun install --frozen-lockfile
bun install --cwd experiments/singleton --frozen-lockfile
bun run --cwd experiments/singleton check
bun run verify:singleton
```

The script creates two clean temporary source folders with no `node_modules`, starts the singleton, creates two namespaces, and mounts the folders through the CLI. It verifies generated hosts/props, two real dependency versions, actual browser interaction, source HMR, component discovery, error recovery, unmount/remount, and registration restoration after an explicit server restart. It also checks management authorization, singleton locking, mount-name binding, and failed installation visibility.

The same server PID, same Vite object, and one HTTP listener are checked across mount/unmount/remount. Screenshots and the observed module URLs are written to ignored `.artifact/singleton-proof/`. Temporary servers and source folders are cleaned up. No model turn or user choice is simulated by this rendering experiment.

## Sources

The experiment uses Vite's [middleware API](https://vite.dev/guide/api-javascript), [symlink resolution setting](https://vite.dev/config/shared-options#resolve-preservesymlinks), and [file access/watch configuration](https://vite.dev/config/server-options). These documents explain mechanisms; the local browser experiment supplies the evidence for this topology.
