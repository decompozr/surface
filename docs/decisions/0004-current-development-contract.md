# Current development contract only

Status: adopted September 24, 2026 by explicit user direction.

Surface is still under local development. Historical experiments do not create an indefinite compatibility obligation. Maintain one current public CLI, installation layout, workspace host and browser interaction API. Update owned callers, tests and current documentation together when these change. Add compatibility only for an identified external consumer with an explicit support decision and retirement plan.

Removed in this increment: per-runtime CLI/server/process manager, the internal singleton CLI, retired installer host modes and path probing, the refresh command alias, browser client naming aliases, runner environment aliases, unused UI adapters, example response-schema defaults, old workspace migration commands and documentation redirect files. Historical installer experiments remain available at their recorded Git revisions. Current low-level compiler tests use a test-only controller; application callbacks use the public CLI.

Project page authoring requires route-based Svelte sources. Local `surface init` generates that current structure; standalone per-runtime Svelte/vanilla launch scaffolds are retired. Browser interactions use `createInteractionClient` from `virtual:surface-interactions` (or the generated local interaction module). Every request supplies its page-owned response schema.

Data preservation is independent of code compatibility. Retain ownership checks, schema validation, uncertain-delivery reconciliation, duplicate suppression, crash recovery and deliberate release selection. Unsupported persisted formats are refused without overwriting the original files. Any necessary migration is a separately scoped data operation, not a permanent runtime fallback. Existing installations and preview recipients are not modified by this source cleanup.

Historical evidence remains dated in `docs/experiments` and `docs/history`; Git preserves removed source. New verification must exercise the current contract, not add aliases merely to keep earlier fixtures green.
