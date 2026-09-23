# Components and ownership

Status: current architecture consolidated from adopted contracts and source at `7fceefc`; no runtime observation in this documentation pass. The earlier process topology and unadopted cross-framework hypotheses remain in [architecture exploration](../experiments/architecture-exploration.md).

```text
Project source + artifact manifest + dependency lockfiles
                |
CLI / MCP -> authenticated project operations -> workspace identity + runtime
Browser   -> shared shell + mounted CSR page -> request-scoped interaction
                |                                  |
       live Svelte/Vite compiler            Service -> exact agent adapter
                |                                  |
       project-owned optional backend       request / response / result store
```

| Component / source | Owns | Does not establish |
| --- | --- | --- |
| [Project core](../../src/core/projects.ts) and [operation contract](project-operations.md) | Manifest operations, validation, canonical identity, ordered writer ownership | Browser UI management workflows or crash-atomic multi-step transactions |
| [Workspace identity](../../src/workspaces/identity.ts) and [public host](../../src/server/surface.ts) | Shared project ledger, worktree scopes, readable mount aliases, backend context | Copied-root adoption, source merging, database merging or relocation without reconciliation |
| [Application host](../../apps/surface/server/host.ts), [shell](../../apps/surface/src/lib/components/SurfaceShell.svelte), [navigation](../../src/server/navigation.ts) | Built SvelteKit shell and registered ready-route navigation; one application listener with the live compiler | Mounted SSR or arbitrary filesystem browsing; current home is guidance and health access, not a management console |
| [Singleton foundation](../../experiments/singleton/server.ts) | Live source compilation, mount routes, dependencies, HMR and scoped diagnostics reused by the public host | Separate compiler/origin security isolation for each project |
| [Interaction service](../../src/core/service.ts), [store](../../src/core/store.ts) | Bindings, one-response requests, preflight, durable attempts/results, unsent takeover | Domain interpretation, automatic source edits or exactly-once model execution |
| [Codex adapter](../../src/adapters/codex.ts), [discovery](../../src/adapters/discovery.ts) | Exact endpoint/root/thread inspection and supported queue/steer/start; bounded read-only directory | Control of arbitrary conversations or another provider without a verified adapter |
| [Browser client](../../src/client/index.ts), [recipient panel](../../apps/surface/src/lib/components/RecipientPanel.svelte) | Scoped request calls and tab/document delivery intent; shared recipient display | General draft persistence, automatic retries, continuous provider monitoring or complete result rendering |
| [Installation manager](../../src/installation/manager.ts), [setup](../../scripts/agent/setup.ts) | Selected release/home, owned lifecycle, symlink verification and setup state | User domain schema migration, remote CLI, OS login service or provider UI discovery acceptance |
| Project backend via [backend dispatcher](../../src/server/backends.ts) | Project-defined named operations with workspace resource context; lazy storage under the accepted policy | A generic plugin protocol or adopted shared multi-view backend/sync engine |

The shell build and mounted compiler have different lifecycles: shell changes require rebuilding/restarting the selected release; supported mounted-source changes use the live compiler. Project dependencies resolve in source context while the shared Svelte compiler/runtime stays pinned. Scope and supported route syntax are in [consumer requirements](../requirements/consumers.md).

## Invariants

- Project source/definitions, temporary browser view state, durable domain data, and durable service interactions have separate owners. See [lifecycle and state](lifecycle.md).
- CLI and MCP are thin transports over shared operations. A skill teaches the workflow; it is not a second implementation or permission grant.
- Browser capabilities authorize a specific request/mount. Management credentials remain server-side/local. Shared-origin trusted pages are not isolated from one another by a security sandbox.
- A directory read, recipient selection, binding, submission, provider acknowledgement, result and human acceptance each establish different facts. [Interaction requirements](../requirements/agent-interaction.md) own these transitions.
- Core supplies runtime mechanisms; the project/person/agent supplies domain meaning and adopts outcomes. Inquiry has no special Core authority.
