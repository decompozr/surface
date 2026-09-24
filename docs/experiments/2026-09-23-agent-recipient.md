# Agent discovery, recipient selection and takeover

Status: bounded experiments with separate live read-only discovery and fixture-backed lifecycle evidence. Source checkpoints: `25b7944` (picker), `30f3bad` / `0d2a736` (directory and app import correction), and `dea65c1` (lifecycle), integrated through `a97e34f`. This record preserves the completed experiment; it does not claim a new run. The lab routes and duplicate workflow were retired during the September 24 production review. Their source remains in Git at `087b043622fc6ad2044d22c8cc73b531dccfab90`. Discovery regression tests now live under `apps/surface/tests/agent-adapters`; current recipient behavior is tested against the production Service.

## Question and observations

Can a page identify the intended agent, retain its draft when that agent disappears, and make a change of recipient explicit without duplicating submitted work?

The parent server load provides a project-scoped directory with workspace grouping. Each tab retains its own choice and draft. Unavailable directory status and a missing recipient disable submission while retaining the draft; neither causes automatic fallback. Live read-only discovery paginates the actual provider directory, verifies Git project/worktree membership, and preserves `notLoaded` separately from idle. It found the actual current Surface conversation as active on September 23 without resuming or messaging it.

The separate lifecycle lab uses the real Store and Service with a fake adapter. It validates recipients before consuming the response slot and serializes operations per request. Explicit takeover of an unsent request creates a new request/capability and closes the old request. It does not copy a submission. Accepted or uncertain submitted work must be reconciled before takeover. Seeing another worktree in the directory does not remove the existing delivery requirement that the bound project root match the conversation's cwd.

Recorded validation: 11 directory/lifecycle/service tests with 42 assertions; app check with zero errors/warnings; browser checks for independent tabs, reload, offline/deleted recipients, retained drafts, explicit takeover, accepted/result and unknown outcomes; and live parent-load rendering of the actual directory. Browser testing found and fixed a hydration race by disabling inputs until persisted tab state restores.

## Reproduction and boundary

The retired lab used `verify.ts` and `verify-lifecycle.ts` browser scripts. The development lab requires an explicit experiment flag and loopback access. Fixture lifecycle endpoints are disabled in live-directory mode. Do not send fixture input into a real user task or delete a real conversation to simulate loss.

No production binding controls, authenticated shared-shell directory, live takeover, cross-worktree delivery, or automatic project handoff is established. Production adoption still needs scoped directory access, submit-time identity validation and a deliberate user-driven end-to-end interaction. Existing submitted requests must retain their original identity through any future ownership transition.

## Source disposition

Keep the implementation experimental. Carry its evidence into [findings](../observations/findings.md#september-23-synthesis-and-disposition) and the proposed [project autonomy contracts](../requirements/project-continuation.md#proposed-continuation-contract). The lesson is explicit ownership and reconciliation, not permission to reroute a request to whichever agent is available.
