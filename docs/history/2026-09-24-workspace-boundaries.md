# September 24 workspace boundary iterations

The initial consolidation moved production behavior out of experiments. PR 55 integrated mounted comments; PR 56 added installed candidate acceptance. A subsequent draft PR 57 separated CLI and installer, but also introduced four library workspaces without sufficient independent consumers. The user rejected that extra packaging and selected three apps with Surface-owned internal modules instead. The current contract is [application and module ownership](../architecture/package-boundaries.md).

## Earlier verified candidate

Candidate `83bab1636854be835e44f6ca188a85791b54ce07` passed 12 delivery guards, eight browser profiles, seven viewport/interaction audits, installed CLI/MCP, upgrade, rollback and restoration. The final source follow-up `9627390510e0d2afa6b1f6ce8a77cd8105ce05c2` passed 110 tests. It relocated tests and adjusted documentation/setup paths; runtime bytes matched the candidate. This is historical acceptance, not evidence for later edits.

The browser run exposed Bun workspace canonical dependency paths outside local `node_modules`. The fix permits exact Svelte, esm-env, clsx and Vite browser assets without exposing the repository. Snapshot verification also needed generated SvelteKit configuration. These constraints remain relevant after consolidation.

Detailed failures, snapshots, archives, screenshots and completion metadata remain under `.decompozr/surface/package-boundaries-20260924/`. They have not been deleted. Existing previews, provider links and intentional old-HEAD WIP were preserved. Physical devices and real agent delivery were not part of the fixture acceptance.

## Completed work records

Keep current behavior in requirements and architecture documents. Summarize completed milestones in `docs/history` with source revisions, results, limits and evidence pointers. Keep ongoing receipts and bulky logs/builds/screenshots in `.decompozr/surface`; do not copy entire generated trees into documentation. Before removing retained evidence, check active continuation records and references. This summary does not authorize deletion of still-referenced evidence or user WIP.
