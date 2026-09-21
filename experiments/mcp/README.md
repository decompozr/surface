# Singleton MCP interoperability experiment

A thin stdio MCP adapter connects to the **existing** singleton HTTP service. It does not start Vite, create another singleton, keep a second registry, or implement a second delivery adapter.

## Run

From the repository root, install the root and singleton dependencies as described in [the singleton experiment](../singleton/README.md), then:

```sh
bun install --cwd experiments/mcp --frozen-lockfile
bun run --cwd experiments/mcp check
bun run --cwd experiments/mcp verify
```

To use the adapter with an MCP host, start the singleton separately and configure the host to launch:

```sh
bun /absolute/artifact/experiments/mcp/server.ts --state-dir /absolute/singleton-state
```

The state directory must match the running singleton. Use absolute executable/script paths in host configuration. No host configuration is installed by this experiment. The default state directory is this checkout's `.artifact/singleton`.

The adapter reads `connection.json` for each call, validates a loopback HTTP origin, and uses the management token locally. Restarting the singleton can change its port and token without restarting the MCP connection. Missing service state yields an error; it does not implicitly start a service.

## Tools

| Tool | Operation |
| --- | --- |
| `artifact_health` | Read existing singleton health |
| `artifact_namespace` | Create a namespace |
| `artifact_mount` | Mount an absolute source folder, optionally with an explicit canonical project root |
| `artifact_list` | List `mounts` (default) or `requests` |
| `artifact_unmount` | Unmount, retaining sources and saved interactions |
| `artifact_bind` | Bind an exact existing session using project root, thread ID, and Unix socket |
| `artifact_request` | Create a component interaction with optional JSON schema |
| `artifact_inspect` | Read persisted interaction state |
| `artifact_send` | Submit JSON with a caller-retained response ID |
| `artifact_result` | Publish result JSON |
| `artifact_close` | Close an interaction to new submissions |

Each tool advertises strict input and structured output schemas. Successful results contain `ok`, `status`, `httpStatus`, and `data`. HTTP rejection includes its status and error. Mount preparation failure and failed/unknown delivery are `isError: true` even when HTTP returned 200. SDK input-validation failures use the SDK's error result and do not enter the adapter handler.

A transport failure during a mutation returns `status: "unknown"`; the server may already have performed the operation. Inspect the saved request or mount before retrying. The adapter never retries mutations. Accepted delivery is not agent completion, and publishing a result is not proof of model authorship.

Request creation intentionally returns a private `previewUrl` containing the browser capability in its fragment. It omits the redundant raw `token` property. Inspect/list do not reproduce capabilities. The adapter never returns the management credential. An MCP host connected here has management privileges; tool annotations and namespaces are not access-control boundaries.

## Evidence

[Experiment record](../../docs/experiments/2026-09-21-mcp.md). `verify.ts` starts an isolated singleton and real SDK stdio client, exercises both interface directions with fixture agent delivery, restarts the singleton, and cleans up its temporary project and service. It does not contact a live agent. Summary evidence is written under ignored `.artifact/mcp-proof/`.
