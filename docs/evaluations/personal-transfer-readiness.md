# Personal demo: remaining transfer work

Status: presentation documents updated; the repository is **not yet sanitized for public transfer**. This record is an inventory, not authorization to transfer, change visibility, rewrite history, rename runtime contracts or redistribute private dependencies.

## Completed scope

The README is a minimal project entry point. The existing product vision owns the detailed core ideas. The README, setup guide, product vision and consumer requirement have no organizational brand references. Public setup examples explicitly select a neutral home using the existing `--home` option; the runtime default and existing installations have not changed. No personal repository URL or public download is invented.

The README structure was informed by the project introductions and installation/documentation entry points in [uv](https://github.com/astral-sh/uv/blob/main/README.md), [FastAPI](https://github.com/fastapi/fastapi/blob/master/README.md) and [Astro](https://github.com/withastro/astro/blob/main/README.md). Their feature claims, badges and branding were not copied.

## Remaining items

| Area | Representative files or location | Work before a public transfer |
| --- | --- | --- |
| Package identities and imports | `package.json`, `bun.lock`, `apps/cli/package.json`, `apps/surface/package.json`, app sources and tests | Decide neutral package identities and update owned producers, consumers, exports and lockfiles together. Verify builds and integrations. |
| Runtime defaults and private local state | `apps/cli/src/installation/paths.ts`, agent skill and setup references | Decide the default-home policy. Preserve existing installations and user data; do not silently migrate or merely edit executable guidance. |
| Private design-system dependency and branding | `apps/surface/design-system.lock.json`, `design/vendor/design-system.tgz`, `design/vendor/design-system.lock.json` | Decide redistribution and branding boundaries. Inspect archive contents, fonts, logos, metadata and license notices; validate the exact replacement package. A text search does not sanitize an archive. |
| Immutable provider guide snapshots | `docs/design/system/`, `docs/design/system-adoption.md` | Preserve honest provenance. Replace through an explicitly selected neutral provider artifact and matching guide hashes rather than silently rewriting snapshots. |
| Architecture and historical records | `docs/architecture/`, `docs/history/`, `docs/experiments/`, `docs/decisions/` | Review organization names, old repository links, absolute machine paths, private service hostnames and experimental evidence. Preserve useful technical knowledge while deciding what belongs in a public source export. |
| Agent and repository tooling | `docs/development.md`, `skills/`, `scripts/`, `.gitignore`, test fixtures | Reconcile organization-specific instructions, paths and package assumptions with any future runtime changes. |
| Git and hosting metadata | Existing commits, branches, tags, remotes, PRs, release assets and repository settings | Transferring ownership does not erase history or old URLs. Choose a separate history/publication strategy before exposing the repository. None of these were changed here. |

## Verification boundary

The targeted public documents were checked for case-insensitive brand matches; Markdown destinations, anchors, traceability and whitespace checks passed. Remaining references were inspected by tracked filename and category. This is not a secret scan, a full binary-assets review, a license audit or a history rewrite. No release, runtime installation, skill deployment or live-service change is needed for this presentation-only scope.
