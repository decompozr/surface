# Surface application

Surface owns the SvelteKit shell, business services, interactions, comments, agent adapters, MCP, templates and mounted-page compiler. These are internal modules of this app; see [module ownership](../../docs/architecture/package-boundaries.md) and [component architecture](../../docs/architecture/components.md).

## Development

Prepare the linked design-system package and frozen root dependencies using the [source workflow](../../docs/source-workflow.md). From the repository root:

```sh
bun run --cwd apps/surface check
bun run --cwd apps/surface dev --state-dir /absolute/isolated-development-state --port 0
```

`dev` builds the SvelteKit shell and starts the combined local host. Shell changes require rebuilding; supported project-source edits use the live compiler. The host registers this checkout's project-owned `examples/` and reports its preview URL. It uses one listener and one Vite instance, and does not update the shared installation.

Use the reported loopback URL on the host. For another device, follow [private browser access](../../skills/surface/references/pages.md#remote-browser-access). Stop the owned development host after verification. Keep source, service state and optional domain data separate.

## Verification

Root `bun run test` builds the shell and runs app/CLI/repository regressions. The [E2E procedure](../../docs/evaluations/self-e2e.md) owns browser interaction checks; [candidate acceptance](../../docs/evaluations/release-candidate.md) owns installed delivery. An app build or HTTP health response alone does not prove either.

Fixture-only pages live under `tests/fixtures`; production routes do not include experimental endpoints. User installation instructions belong to [SETUP.md](../../SETUP.md).
