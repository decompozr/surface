# Surface project examples

These are ordinary project-owned Svelte sources mounted by the development server. The repository's `artifact.project.json` registers this folder. `apps/surface` automatically registers the current checkout and mounts this artifact on startup, printing its preview URL.

- `src/Counter.svelte`: interactive counter and HMR-preserved draft.
- `src/Feedback.svelte`: schema-validated response and agent result display; open through an interaction request URL.
- `feedback.schema.json`: the feedback request contract.

`artifact.json` limits discovery to `src`. The existing `svelte-feedback/` example remains a separate legacy standalone app.

Automated verification copies these sources into temporary projects; it does not mutate the live mount. Dependencies and runtime state are not versioned. The host requires an explicit state directory; see `apps/surface/README.md` for startup and interaction commands.
