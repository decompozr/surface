# Agent-created local pages

Status: earlier per-project-process exploration. For the preferred singleton/namespace direction, use the separate [singleton experiment](../experiments/singleton/README.md). This workflow still describes the existing `artifact` CLI. These steps reproduce an experiment; successful checks do not freeze the architecture or establish production readiness.

Artifact now mounts trusted external frontend projects and connects their pages to an exact existing agent conversation. The service and CLI use Bun; a mounted project retains its own package manager, source files, dependencies, and lockfile. Svelte and vanilla HTML/TypeScript starters are included. This earlier entry point has no MCP adapter; the later [singleton MCP experiment](../experiments/mcp/README.md) supplies that interface for the preferred host.

## Install the local CLI and skill

From this checkout:

```sh
bun install --frozen-lockfile
bun link
artifact --help
```

`bun link` registers the checkout and its `artifact` executable in Bun's bin directory. If that directory is not on your PATH, use `bun /absolute/path/to/artifact/src/cli/index.ts` in place of `artifact`.

The reusable skill is [skills/artifact/SKILL.md](../skills/artifact/SKILL.md). Link it into your agent's skill directory; keep the link attached to this checkout so references and templates remain available. For Codex, when that name is not already installed:

```sh
ln -s /absolute/path/to/artifact/skills/artifact ~/.codex/skills/artifact
```

Do not overwrite an existing skill. New agent sessions can discover the installed skill; an already running session can read its exact path. No API key is needed by the Artifact server. Live agent delivery uses the existing local agent runtime and its existing authentication.

## Start the service

```sh
artifact serve
```

This foreground process manages the API on `127.0.0.1:4317`. Keep its terminal running. `artifact doctor` reports service availability without displaying the management token. `--state-dir /absolute/path` selects an independent service's records and must be passed consistently to all commands. `--port` changes the API port.

The default state directory remains this checkout's `.decompozr/artifact`, including when calling the globally linked CLI from another project. It contains private local records and must not be committed. There is one writer per state directory. This release does not install an OS service or promise background persistence after the terminal is closed.

The bundled A/B demo is still available with `artifact serve --dev` after installing its dependencies. External mounts do not need that demo or its build.

## Create an independent workspace

Assuming an existing repository at `/path/to/project`:

```sh
artifact init --directory /path/to/project/artifacts/demo --framework svelte
cd /path/to/project/artifacts/demo
bun install
bun run check
bun run build
```

`--framework vanilla` creates a plain HTML/TypeScript starter. Initialization refuses nonempty directories and does not install dependencies. Install explicitly in the selected directory and retain the resulting lockfile. Existing applications can skip initialization and use their current scripts and package manager.

The starter includes a message form, a copied browser client, and `interaction.schema.json`. Edit these as ordinary project files. The copied client has no runtime dependency on the Artifact checkout; copy a newer version explicitly when needed.

## Register and mount

```sh
artifact register \
  --project /path/to/project \
  --directory /path/to/project/artifacts/demo \
  --command-json '["bun","run","dev","--","--host","127.0.0.1","--port","{port}","--strictPort"]'
artifact mount --runtime RUNTIME_ID
artifact runtime --runtime RUNTIME_ID
artifact logs --runtime RUNTIME_ID
```

Use IDs from actual command output. Registration records canonical paths and an argument array; it neither installs dependencies nor executes code. Mount launches the selected command in that directory. The runtime directory must be inside its registered project. Multiple frontends can be registered under one project root.

Artifact allocates a loopback port, substitutes `{port}` in arguments, and sets `ARTIFACT_PORT`. Commands must bind to that port and fail if occupied. Commands are executed without an implicit shell. Existing npm/pnpm/Yarn projects can use their own executable and dev script. Custom commands are an integration mechanism, not a claim of universal framework support.

Readiness requires an HTTP success at `/`. A ready response includes the direct preview URL. Compilation/type checking, browser behavior, and agent connectivity still need their own checks. Logs are bounded to the most recent 64 KiB per runtime and are lost on service restart.

## Bind and request

Bind the exact originating agent session; its working directory must match `--project`, not necessarily the nested frontend directory. For Codex, the installed `codex app-server daemon version` command reports the local control socket.

```sh
artifact bind --project /path/to/project \
  --thread EXACT_THREAD_ID --socket /absolute/path/to/control.sock
artifact request --binding BINDING_ID --runtime RUNTIME_ID \
  --schema-file /path/to/project/artifacts/demo/interaction.schema.json \
  --title "Share your next change"
```

Use the returned interaction `previewUrl` for the form. A raw runtime URL has no request capability. Optional `--preview-path /some/page` selects a nested page without a query or fragment. Runtime and binding must share a project root. Create a fresh interaction link after remounting because ports may change.

The link includes a request token and API origin in its fragment. Only the mounted origin associated with that request may use cross-origin reads/submissions. Browser code cannot manage runtimes, enumerate requests, or publish results with that request token. Artifact does not supply a sandbox for untrusted project code; project scripts run with the local user's privileges.

## Browser contract

```ts
import { createArtifactClient } from './artifact-client';
const client = createArtifactClient(); // Reads the returned URL.
const current = await client.read();
if (!current.response) {
  const responseId = crypto.randomUUID();
  const receipt = await client.submit({ message: 'Use a larger heading' }, responseId);
  // Display receipt.response.status; acceptance is not completion.
}
const result = await client.waitForResult({ timeoutMs: 120_000 });
```

The request schema validates the submitted JSON object. `--schema-file` exposes custom schemas through the CLI; without it the old A/B example schema remains the default. A request accepts one submission. Retain the response ID and data on a transport failure; inspect existing state instead of blindly retrying with a new ID. Client polling never resends data. An unknown outcome requires reconciliation against the exact agent session.

The agent receives the submitted data and an absolute callback CLI command with the correct state directory. It publishes an actual outcome:

```sh
artifact result --request REQUEST_ID --data '{"message":"Updated the heading"}'
artifact inspect --request REQUEST_ID
```

Result data is arbitrary JSON-object data interpreted by the page. No automatic source editing is performed by Artifact. The agent edits source using its normal tools, checks the browser, and separately reports completion. Its execution environment must permit contacting the local API; Artifact never changes that environment's permissions.

## Stop, recover, and inspect

```sh
artifact runtimes
artifact stop --runtime RUNTIME_ID
artifact mount --runtime RUNTIME_ID
```

Stopping removes the owned process group and preserves source, dependencies, and registration. Each process group has a supervisor watching its connection to the manager. Normal service shutdown and manager termination clean up attached child processes. A malicious command that detaches into another group is outside this trusted-code lifecycle contract.

After restart, registrations remain, while runtime status is `stopped`; saved URLs are never assumed live. Explicitly mount the desired runtime. If an unclean exit leaves `server.lock`, inspect its PID and confirm the process is gone before removing that specific lock. The server does not automatically kill a process based on a saved PID.

Loopback links work on the host computer only. Phone/remote access, browser origin sandboxing, Windows runtime supervision, and framework-specific SSR adapters remain future work. Component-only hosting and MCP are implemented separately in the later singleton experiments; they are not features of this earlier process-based CLI.

## Verification

```sh
bun run check
bun run check:ui
bun run build:ui
bun test tests
bun run verify:external
```

`verify:external` explicitly installs the pinned starters into temporary projects outside the checkout, checks/builds both, opens Chrome, verifies custom submissions and CLI-published results, and checks stopping/restarting. Svelte hot updates and compile-error recovery are observed in the browser. The test uses a clearly identified fixture adapter and never sends a model message. Screenshots and a receipt are saved under ignored `.decompozr/artifact/verification/`; temporary projects and managed processes are cleaned up.

Earlier live Codex steering/idle-continuation evidence is recorded separately in [prototype evidence](prototype.md). Neither automated input nor fixture publication establishes personal user acceptance.
