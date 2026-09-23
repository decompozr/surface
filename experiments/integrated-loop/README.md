# Integrated loop validation page

Bounded project-owned page for [INTEGRATED-LOOP-03](../../docs/experiments/2026-09-23-integrated-loop.md).
The Traditional Chinese form requests a title and density change. `selection.ts`
is the agent-owned output; editing form fields alone does not update it.

From this directory, install with `bun install --frozen-lockfile` and check with
`bun x --no-install svelte-check --tsconfig ./tsconfig.json`.

From the repository root, run `bun experiments/integrated-loop/verify-preview.ts`
for the existing request stored in ignored
`.decompozr/surface/integrated-loop/request.json`. This check blocks all browser
mutations, never submits to the real conversation and leaves screenshots in the
same ignored directory. It verifies initial editing isolation before application,
or the source-backed result after application. Human submission/acceptance and
result publication remain separate gates.
After publication, `bun experiments/integrated-loop/verify-preview.ts --expect-result`
also checks the exact message in ignored `result.json`; preparation, applied and
result screenshots/reports use separate names.

If delivery fails or is unknown, preserve the saved response ID and payload,
inspect the original request and do not invent a replacement ID. The page locks
after an attempt and never retries automatically. A new request is a distinct
user interaction, not a recovery shortcut.
