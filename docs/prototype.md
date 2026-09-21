# Local interaction prototype

This document records the original bundled prototype and its live-agent evidence. External mounting and the reusable client/skill are now available; see [the current workflow](workflow.md). Historical limitations below refer to that original proof.

The prototype proves one focused loop: a Svelte page submits structured feedback, Surface delivers it to an existing Codex conversation, and that agent publishes a result which appears on the page.

## Stack and layout

- Bun 1.4.0 runs the TypeScript backend, CLI, and tests.
- The Svelte 5 / Vite 8 example has its own dependencies and lockfile.
- TypeScript 6 is used because the installed Svelte checking tool requires additional integration for TypeScript 7.
- Ajv validates submitted data against the interaction's JSON schema.
- The Codex adapter connects over an existing local Unix WebSocket with compression disabled. It does not start, stop, or reconfigure the shared Codex daemon.
- Local records use JSON with atomic replacement and a single-server lock. `.decompozr/surface/` is excluded from Git.

```text
src/core/          Interaction records, validation, delivery orchestration
src/server/        Local HTTP API and built preview serving
src/cli/           Management, submission, and result commands
src/adapters/      Codex session delivery and JSON-RPC transport
examples/svelte-feedback/  Independent Svelte example package
tests/             Core, adapter, transport, HTTP, CLI, and browser checks
```

## Install and start

Run from the repository root:

```bash
bun install --frozen-lockfile
bun install --cwd examples/svelte-feedback --frozen-lockfile
bun run dev --dev
```

The API binds to `127.0.0.1:4317`; the managed Vite example uses `127.0.0.1:5173`. Use `--port` and `--ui-port` to choose other ports. The Vite server proxies `/api` to the Bun service. Ctrl+C stops the service and its managed preview process.

For a built preview served directly by Bun:

```bash
bun run build:ui
bun run dev
```

Open `http://127.0.0.1:4317` for the landing page, or use a request's returned preview URL to interact with an agent.

## Bind a conversation and create a request

Use an existing Codex conversation whose working directory matches the project. `codex app-server daemon version` reports the current control socket path without changing daemon configuration. Supply the exact thread ID; Surface never selects the latest conversation automatically.

```bash
bun run surface bind \
  --project "$PWD" \
  --thread "YOUR_THREAD_ID" \
  --socket "/absolute/path/to/app-server-control.sock"

bun run surface request \
  --binding "BINDING_ID_FROM_BIND" \
  --title "Choose the next direction."
```

Open the returned `previewUrl`. Its fragment contains a capability for that one interaction. The page can read and submit that request but cannot register sessions or publish agent results. Keep the link private.

The built-in request schema accepts option A or B, an integer width from 80 to 240, and a comment up to 1,000 characters. The backend supports a supplied JSON schema through its management API, but the bundled page and CLI request command currently use this fixed example form.

## Submit and inspect

The browser and CLI use the same submission operation:

```bash
bun run surface send \
  --request "REQUEST_ID" \
  --response-id "UNIQUE_RESPONSE_ID" \
  --data '{"option":"B","width":160,"comment":"Use this version"}'

bun run surface inspect --request "REQUEST_ID"
bun run surface list
```

Each request accepts one response. Repeating the same response ID and data reads the existing outcome without sending again. A changed response or another response ID is rejected once a submission exists. Create a new request for the next interaction.

The adapter checks the exact thread and project. An active session uses `turn/steer` with the active turn ID. An idle session uses `turn/start` in the same thread. Unloaded-thread reopening is implemented and covered by a protocol fixture; it has not yet been proved against a live unloaded conversation. No delivery failure creates a replacement conversation.

## Publish an agent result

The message delivered to the agent includes the absolute CLI path and request identity. The agent can publish a result using:

```bash
bun run surface result \
  --request "REQUEST_ID" \
  --data '{"message":"Confirmed option B at width 160.","option":"B","width":160}'
```

The CLI contacts the local API. The agent's execution environment must permit that connection; a workspace sandbox with networking disabled may receive the steering message successfully but be unable to publish its result. Surface does not change an existing session's permissions. The live proof used a dedicated workspace-scoped test session with networking enabled.

The page displays published result data separately from delivery acceptance. The service does not independently authenticate which local process invoked the management CLI, so a published result is not a cryptographic attestation of agent authorship. The live proof verified the actual command in the test conversation.

## Persistence and delivery limits

By default, `.decompozr/surface/` belongs to this Surface checkout, even when the CLI is invoked from another working directory. `--state-dir` chooses a separate state directory. The service includes that directory in the callback CLI command it sends to the agent.

The state file contains session bindings, requests, scoped request capabilities, submitted data, receipts, and results. The connection file contains the local management token. Files are private to the local account and must not be committed.

Outcomes distinguish `delivering`, `accepted`, `failed`, and `unknown`. An interrupted delivery becomes `unknown` after restart. A timeout after a send is not automatically retried; inspect the target session to reconcile it. Accepted delivery does not mean the agent has completed its work.

An exclusive `server.lock` prevents concurrent writers. If the process is forcibly killed, inspect the PID in that file and confirm the process is gone before manually removing that specific stale lock. Do not remove a live server's lock.

At the original proof checkpoint, the prototype had no response replay queue, expiry scheduler, general project mounting, browser-origin sandbox, MCP interface, or automatic source-code generation. That proof used trusted local code and one bundled preview. External mounting has since been added as a separate experiment. Unix socket integration has only been tested on this macOS environment with Codex CLI/App Server 0.154.0.

## Validation on 2026-09-20

- Core and adapter tests exercise exact-thread routing, active steering, idle continuation, unloaded-thread protocol handling, rejection on project mismatch, and conservative timeout handling.
- HTTP and persistence tests cover request-scoped access, invalid origins and hosts, concurrent duplicate submissions, schema validation, closed requests, restart recovery, exclusive state locking, and CLI visibility of service state.
- A real Chromium browser exercises the built Svelte page against the real Bun service with a clearly identified test adapter. It submits B / 180, checks repeat submission is disabled, and observes a separately published result. Desktop and 390 px mobile layouts were inspected.
- A dedicated conversation named **Artifact interaction proof** was created and verified in the default local Codex thread list. It acknowledged the bounded test instructions.
- Live active-turn delivery sent A / 200 from the browser into the exact already-running turn. The same agent invoked the result CLI; the browser displayed its confirmation.
- The initial idle run reached the correct thread but its callback failed because the test session lacked local network access. After configuring networking for that test session, the callback succeeded. A fresh idle interaction was then used to verify the complete path without a callback retry.

The original live-proof receipts, thread and turn identities, and screenshots were retained under ignored `.artifact/live-proof/` and `.artifact/screenshots/`. New verification output uses `.decompozr/surface/` as recorded in [Decision 0002](decisions/0002-surface-name-and-local-state.md). These local records are evidence from this machine, not portable fixtures or claims of phone visibility.

## Checks

```bash
bun run check
bun run check:ui
bun run build:ui
bun test tests
```

The browser check currently uses the installed Google Chrome channel. It never starts a model turn; its adapter is a test fixture. Live agent experiments are manual and separate from the automated test suite.
