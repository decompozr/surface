# Singleton namespace experiment

An executable experiment for the preferred direction: start one server, create a namespace, then mount component folders into it. One HTTP listener and one Vite instance serve every mount. Installation uses short-lived Bun subprocesses; no per-project development server is launched.

This does not replace the previous `artifact serve` implementation. Use the separate commands below to reproduce and compare the designs. The host now connects mounted components to the existing interaction service and exact-session adapter. MCP is not implemented. The interaction integration is an experiment; its verification outcomes are recorded separately from the earlier rendering checks.

## Run

From the Artifact checkout:

```sh
bun install --cwd experiments/singleton --frozen-lockfile
bun run singleton serve
```

The default URL is `http://127.0.0.1:4318`. Keep that terminal running. In another terminal:

```sh
bun run singleton namespace project-a
bun run singleton mount /absolute/project-a/panel --namespace project-a --name panel --project /absolute/project-a
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

1. Register the canonical source under a namespace/name and canonical project root. `--project` defaults to the source folder; pass the enclosing repository root when the agent session works there. The source must be inside that root. A registered mount name cannot silently switch source or project identity.
2. Run `bun install --ignore-scripts` in the source directory. If a Bun lockfile exists, add `--frozen-lockfile`; otherwise Bun creates one. Fail visibly on an incompatible lockfile. This modifies the source folder's `node_modules` and may create its lockfile.
3. Create `workspace/mounts/<namespace>/<name>` as a symlink to the source.
4. Recursively discover `.svelte` files in the declared component directory, ignoring hidden files, nested symlinks, `node_modules`, and `dist`.
5. Add the real source to Vite's allowed files and watcher. Compile discovered components through the existing Vite instance.
6. Return `http://127.0.0.1:4318/n/<namespace>/<name>/`, a component catalog. Each component link opens a generated host with its declared props.

The lifecycle is `registered → installing → preparing → ready`, or `failed` with an error and bounded install log. Repeating a ready mount is idempotent. To reprepare changed dependency declarations, explicitly unmount, reconcile the source lockfile as needed, and mount again. Automatic installation occurs at mount/restore time; package changes do not trigger an unattended installation loop.

Unmount removes the symlink, revokes source/preview routes, and preserves the source folder, dependencies, lockfile, and server. The namespace URL is stable when remounted under the same server origin. Adding/removing components updates discovery; editing an existing source triggers Vite HMR. Discovery events update only the affected catalog. Existing component previews keep running. Props changes update the selected host reactively. Removing the currently displayed component refreshes that view to its unavailable response.

## Connect a mounted component to an agent

The namespace organizes previews; it does not identify an agent session. Bind the exact existing session with its actual canonical working-directory root, matching the mount's `--project`. For Codex, `codex app-server daemon version` reports the local control socket. Do not select the most recent session or create a replacement conversation when the intended session is unavailable.

```sh
bun run singleton bind --project /absolute/project-a \
  --thread EXACT_THREAD_ID --socket /absolute/control.sock
bun run singleton request --binding BINDING_ID \
  --namespace project-a --name panel --component src/Panel.svelte \
  --schema-file /absolute/project-a/panel/interaction.schema.json \
  --title "Choose the next change"
```

The component must appear in the ready mount's discovery catalog. `request` returns a `previewUrl` with a request ID in the query and a per-request capability in the fragment. Open that link for interactions; the catalog's plain component link has no request credentials. Do not commit returned tokens or `.artifact` state. An omitted schema uses the earlier A/B feedback schema, so supply a schema matching a custom form.

The host provides a browser client without requiring a package dependency:

```ts
import { createArtifactClient } from 'virtual:artifact-client';

const client = createArtifactClient();
const current = await client.read(); // Restore the persisted receipt/result after reload.

// Call only from an explicit form action. Generate and retain responseId before calling.
async function submitMessage(message: string, responseId: string) {
  const latest = await client.read();
  if (latest.closed || latest.response) return latest;
  return client.submit({ message }, responseId);
}

// Display the returned response.status; "accepted" is not a completed agent action.
// After submission, waitForResult({ timeoutMs: 120_000 }) polls without resending.
```

Read before enabling submission. Do not send on page load, resend after reload, or generate a new ID to retry an uncertain delivery. One request accepts one submission. The client polls for a result without resubmitting. Use `previewState` below for unsent drafts and retained response IDs across component HMR; durable request status comes from `read()`, not from that preview-session store. Copy [preview.d.ts](preview.d.ts) for both virtual modules' TypeScript declarations.

The bound agent receives the actual submitted data and an absolute callback command using this singleton CLI and state directory. It continues or is steered within that existing conversation, performs the work, and publishes an actual result:

```sh
bun run singleton result --request REQUEST_ID --data '{"message":"Updated the heading"}'
bun run singleton inspect --request REQUEST_ID
bun run singleton requests
```

`list` lists mounts; `requests` lists interactions. `send --request ID --response-id ID --data JSON` submits from an authorized CLI and is useful for explicit tests. It does not establish that a person clicked the page. Browser request capabilities authorize scoped reads/submissions only; `result`, `close`, enumeration, and mounting require management authorization.

The browser client uses `/api/n/<namespace>/<name>/requests/<id>`. The server checks the request token, recorded mount, canonical project/source identity, and component availability. Changing only a request ID or mount path does not grant access to another interaction. This prevents accidental cross-mount routing; trusted previews still share one browser origin, compiler, and WebSocket. It is not a security sandbox for hostile page scripts. Never expose the management token to a component.

### Interaction lifecycle

- A failed or unknown delivery remains inspectable. Do not blindly retry: reconcile the exact session first. Service interruption during delivery restores that request as `unknown` rather than resending it.
- `close --request ID` blocks a new submission. It preserves history, does not cancel a running agent turn, and still permits an administrator to publish the outcome of an already submitted request. Polling stops on a closed request without a result.
- Unmount blocks page reads and new submissions, preserves request records, and does not cancel delivery already in flight. Administrative `inspect`, `result`, and `close` remain available.
- Remounting the original source/project and restoring the selected component restores page access. Replacing the source under the same mount name is rejected. A full service restart retains requests and restores registered mounts; use the current server origin if its port changes.

Receipt persistence, adapter acceptance, agent completion, result publication, browser display, and personal user acceptance are separate observations. The session must be able to contact the local service for the CLI callback; Artifact does not alter its permissions. Local links work only on the host computer; remote/mobile access is outside this pilot.

## Dependency and framework boundary

`resolve.preserveSymlinks: false` lets Vite resolve mounted source to its real location. Ordinary ESM imports then resolve against that source's dependency tree. The experiment observes nanoid 4.0.2 and 5.1.5 executing from two different `node_modules` trees at the same time.

The Svelte compiler/plugin/runtime is shared and pinned to 5.57.1. The host supplies that runtime to generated component entries, so mounted package manifests must declare that exact version. This does not demonstrate independent Svelte compiler versions, arbitrary per-project Vite configs, SvelteKit, SSR, or arbitrary frameworks.

Dependency discovery/prebundling is disabled for this pilot, and the dependency case uses browser-ready ESM. CommonJS packages need another experiment. npm/pnpm/Yarn lockfiles are rejected rather than silently converted. Lifecycle scripts are not run, so dependencies needing install-time native builds need an explicit future contract.

The host compiles for development and the browser renders the result. It does not produce deployment bundles or establish successful type checking; those require separate operations.

## Compiler errors and HMR state

The built-in global Vite error overlay is disabled. A preview client displays compiler errors whose source belongs to that mount, keeps the last successful rendering visible, and clears its error after a successful update. Other mounts remain usable. This is UI isolation: Vite still shares the compiler process and WebSocket transport, so console messages and diagnostic payloads can reach other clients. It is not crash, confidentiality, or browser-origin isolation. Unattributed/shared-infrastructure errors remain in Vite diagnostics rather than being falsely assigned to one mount.

Svelte 5 component HMR reconstructs local component state in this tested version. The host does not rewrite arbitrary `$state` variables or promise transparent preservation. Opt important interaction state into the preview-session store:

```svelte
<script lang="ts">
  import { previewState } from 'virtual:artifact-preview';
  const count = previewState('counter', 0, 1);
  const draft = previewState('draft', '', 1);
</script>
<input aria-label="Draft" bind:value={$draft} />
<button onclick={() => $count++}>Count {$count}</button>
```

Copy [preview.d.ts](preview.d.ts) into the mounted project's included declarations for TypeScript/editor support. Keys are scoped to the browser document's namespace/mount/component URL. Multiple instances in the same preview must choose distinct keys when their state should be independent.

The helper uses a module-level store registry, retained in `import.meta.hot.data`. It preserves opted-in state across component/template edits, CSS updates, compiler-error recovery, and reactive host-prop updates. No localStorage or server persistence is implied. Bumping a key's version replaces that store with its supplied initial value; it does not reset other keys. This explicit version is the component author's compatibility decision, not automatic schema inference.

A full document refresh/navigation starts a new preview session. Removing an active component, unmounting, or Vite's unsupported-update/server-restart fallback can require a refresh. Additional component discovery and ordinary host-prop changes do not force one.

Verified in Chrome: incremented counter and entered draft survived component edits, CSS edits, a failed compile followed by correction, and props changes. A different namespace remained clickable during the compile error and retained its document. The catalog updated live without refreshing either component preview. An explicit state-version change reset only the counter; a manual page refresh reset the entire preview session.

## Reproduce the experiment

Requires the root development dependencies and installed Chrome:

```sh
bun install --frozen-lockfile
bun install --cwd experiments/singleton --frozen-lockfile
bun run --cwd experiments/singleton check
bun run verify:singleton
```

The script creates two clean temporary source folders with no `node_modules`, starts the singleton, creates two namespaces, and mounts the folders through the CLI. It verifies generated hosts/props, two real dependency versions, actual browser interaction, source HMR, component discovery, error recovery, unmount/remount, and registration restoration after an explicit server restart. It also checks management authorization, singleton locking, mount-name binding, and failed installation visibility.

The same server PID, same Vite object, and one HTTP listener are checked across mount/unmount/remount. Screenshots and the observed module URLs are written to ignored `.artifact/singleton-proof/`. Temporary servers and source folders are cleaned up. This rendering verification does not contact a model session or represent a personal user choice.

The separate interaction regression command is:

```sh
bun run verify:singleton-interactions
bun run test:singleton
```

It uses a deterministic adapter and the reusable [interaction form fixture](fixtures/InteractionForm.svelte), with two namespaces, HMR/error recovery, scoped request authorization, deduplication, unavailable/closed/unmounted outcomes, and restart restoration. It stores local evidence in ignored `.artifact/singleton-interaction-proof/`. See the [interaction experiment record](../../docs/experiments/2026-09-20-singleton-interactions.md) for its verification status and the separate live idle/active callback observations. Running the deterministic command does not contact a live model session.

## Sources

The experiment uses Vite's [middleware API](https://vite.dev/guide/api-javascript), [symlink resolution setting](https://vite.dev/config/shared-options#resolve-preservesymlinks), [file access/watch configuration](https://vite.dev/config/server-options), and [HMR events/data](https://vite.dev/guide/api-hmr). Svelte tracks transparent local-state preservation in [issue 14434](https://github.com/sveltejs/svelte/issues/14434); the experiment also inspects the installed 5.57.1 runtime and tests actual behavior. These documents explain mechanisms; the local browser experiment supplies the evidence for this topology.
