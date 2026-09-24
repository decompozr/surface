# Phase A UI source audit

Recorded September 23, 2026 by a separate read-only audit agent. Source inspection only; no browser, tests, servers or real conversations run. Baseline: main `7fceefc`. This is an input to the successor, not an adopted UI redesign.

## Current implementation facts

- `apps/surface/src/lib/components/SurfaceShell.svelte` and the root SvelteKit layout compose shared navigation, breadcrumbs, recipient controls and project content. `RecipientPanel.svelte` activates on request URLs. Earlier blanket claims that recipient controls are experimental are stale for this baseline.
- `src/server/navigation.ts` builds project > exact worktree > mounted folder > route navigation from active workspaces and ready route mounts. It is not arbitrary filesystem browsing. `NavigationTree.svelte` preserves query/fragment only for the current page; unrelated page links are clean browsing routes.
- `skills/surface/references/pages.md` distinguishes read-only route pages from request URLs. Project forms own domain data; the shared panel selects delivery semantics. The current home is navigation guidance and health access, not a full management GUI.
- `RecipientPanel.svelte`, `src/client/index.ts` and `src/core/service.ts` have independent recipient and delivery states. Active recipients require queue/steer selection; idle/notLoaded use start. Refresh clears old intent. Submission events update response state; a recorded response is not a completed agent result.
- Recipient selection is opt-in at request creation. Only exact-worktree candidates can receive a new request. Explicit takeover creates a new binding/request/token and closes the old unsent request. Submitted or unknown work cannot be taken over. Other worktrees are view-only. Lost takeover acknowledgement needs reconciliation.
- Current shell source uses a 280px desktop sidebar, sessionStorage collapse, <=760px drawer, Escape/backdrop close, toggle focus restoration and inert hidden navigation. Content has a named focusable horizontal scroll region; recipient labels stack at <=600px. These source values describe implementation, not a universal new design system or accessibility certification.

## Proposed design gaps to make explicit

- Loading, unavailable/offline, empty directory, removed recipient, stale state and recovery copy. Directory availability/checkedAt are not currently surfaced by the shared panel.
- Refresh/polling ownership: current panel reacts to mount/manual refresh/submission events; it does not continuously observe provider or result state.
- Draft lifetime across HMR, refresh, navigation, takeover and failed submission. No replay does not imply arbitrary form preservation.
- Keyboard focus on drawer opening/navigation, background interaction, skip navigation, status announcements, zoom, contrast, target sizes and device coverage.
- Deep/long trees, ordering/labels, unavailable mounts and duplicate labels.
- Visible difference among saved input, queue/adapter acceptance, observed work, published result and human acceptance.
- Failure/unknown reconciliation and lost takeover acknowledgement guidance.

## Evidence references

`tests/e2e/surface/verify-navigation.ts` encodes navigation/SSR, folder/breadcrumb, collapse, 1440px and 390px cases, Escape focus and contained overflow. `tests/e2e/surface/verify-recipients.ts` encodes capability retention, queue, per-tab mode choice, explicit takeover/no replay, stale-state rejection and mobile overflow with a fake adapter. These commands were inspected, not run for this audit.

`experiments/agent-picker/README.md` describes a separate gated lab. Its historical tab draft persistence and cross-worktree selection are not contracts of the shared panel. Preserve the distinction when reorganizing evidence.
