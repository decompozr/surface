# UI evaluation gates

Status: source/verifier inventory, with the dated UI-CONTINUATION-02 browser evidence below. Original inventory baseline is `7fceefc`; newer runs identify their own baseline and WIP. These gates cover the shared shell plus an explicitly identified project page. Existing scripts use disposable fixture projects and adapters, not user intent or a live model.

For future isolated execution, use the dependencies/build required by the app and fixture scripts. `bun run --cwd apps/surface build` prepares the shell; the direct scripts below do not themselves run that build. Inspect [workspace-fixture.ts](../../apps/surface/scripts/workspace-fixture.ts) for additional fixture preparation. Record actual browser/viewport and screenshots when run; source CSS is not rendered acceptance.

## E-07: navigation and location

Covers [R-02](../requirements/consumers.md), [D-01/D-02](../design/navigation.md). Pass if home SSR includes registered ready routes, exact worktrees stay distinct, nested route/folder index and breadcrumbs resolve, the current link retains its capability and unrelated links stay clean. Fail if navigation enumerates arbitrary files, leaks credentials to another page or blurs worktree identity.

Available: `bun test tests/navigation.test.ts`; `bun apps/surface/scripts/verify-navigation.ts`; capability retention is exercised by `bun apps/surface/scripts/verify-recipients.ts`. [Tree tests](../../apps/surface/tests/navigation.test.ts) and [navigation browser script](../../apps/surface/scripts/verify-navigation.ts) encode ready-only grouping, nested pages/folders, collapse and overflow. Large/deep trees, duplicate labels, stale mounted URLs and all empty-state distinctions still need cases; no new pass is claimed.

## E-08: delivery choice

Covers [R-08/R-09/R-11](../requirements/agent-interaction.md#requirement-index), [D-03](../design/interactions.md#d-03-recipient-choice-and-submission). Open a fixture request in two tabs. Pass if active mode starts unselected, one tab's choice does not choose for the other, only explicit project submit delivers, the chosen mode matches the receipt, and a changed provider status clears intent/rejects without a saved response when preflight catches it. Check idle/notLoaded start independently. Fail on automatic steering or a selected mode being mistaken for a submission.

Available: `bun apps/surface/scripts/verify-recipients.ts`, plus E-05 service/adapter tests for additional modes. The browser fixture exercises queue and stale-state rejection, not every live provider transition. The shared panel does not universally control the project submit button; page-specific hydration/disabled behavior needs separate validation.

## E-09: recipient change

Covers [R-10](../requirements/agent-interaction.md#requirement-index), D-03/D-04. Pass if opt-in same-worktree selection requires confirmation, the URL receives the new request/token, old request closes, no delivery occurs merely from change, and submitted requests expose no takeover action. Fail on transferred response/result, cross-worktree routing or implied draft retention.

Available: `bun apps/surface/scripts/verify-recipients.ts`, `bun test tests/service.test.ts`. The browser fixture asserts one explicit successful change and no replay; authorization/locking use service checks. Unavailable/removed candidate, lost acknowledgement and unknown submitted state presentation need added shared-panel browser cases. Live directory inspection alone is not delivery evidence.

## E-10: failure and freshness presentation

Covers [D-02](../design/navigation.md#d-02-navigation-states), [D-04](../design/interactions.md#d-04-errors-uncertain-effects-and-recovery), [D-09](../design/interactions.md#d-09-freshness-and-discovery). Proposed acceptance: inject service offline, directory unavailable/empty/removed recipient, stale read, failed/unknown delivery and lost takeover acknowledgement. Pass if each is distinguishable, stale values are labeled, controls do not imply readiness, the original request/response identity survives and recovery never auto-submits. Screen-reader users must receive actionable status/error feedback.

Current evidence: panel source shows busy/alert and some mode clearing; API exposes `available`/`checkedAt` without displaying them. No comprehensive existing browser verifier covers this gate. **Open / not implemented in full:** loading/offline/empty/stale copy, directory freshness and lost-ack reconciliation UI. Passing current fixtures cannot close this gate.

## E-11: drafts and results

Covers [D-05/D-06](../design/interactions.md#d-05-draft-ownership), R-07/R-11. Name a project form's declared lifetime, then test typing through eligible HMR, compile recovery, refresh, navigation, failed submission and takeover. Pass if observed retention/reset matches its declared policy and the person is not misled; never require universal durable retention from the existing shared shell. Preserve the same response ID and payload during uncertain delivery.

Available partial evidence: `bun run verify:singleton-interactions`; [scoped HMR](../experiments/2026-09-20-scoped-hmr.md) and [live edit](../experiments/2026-09-21-live-source-edit.md) observed opted-in state under their revisions. Project-specific refresh/takeover draft acceptance remains open. For results, independently observe saved response, receipt, agent action, result publication and rendered effect; fixture publication alone does not prove model action or human acceptance. The panel is not a result viewer.

## E-12: mobile and accessibility

Covers [D-07/D-08](../design/accessibility.md). Existing `bun apps/surface/scripts/verify-navigation.ts` checks 1440×1000 desktop, 390×844 mobile drawer, Escape/toggle focus and contained wide-content overflow. `bun apps/surface/scripts/verify-recipients.ts` checks mobile document overflow at 390×844. Both scripts passed on September 23 in [UI-CONTINUATION-02](../experiments/ui-continuation/completion.md), against baseline `6dd9083` plus the recorded WIP.

The focused `bun apps/surface/scripts/verify-skip-link.ts` gate requires first-Tab discoverability, Enter focus to the unique named content region, byte-for-byte URL/document retention, content Tab continuation, drawer dismissal and contained wide content on home/nested routes at 1440×1000, 390×844 and 320×844. These checks passed in UI-CONTINUATION-02; rendered screenshots were inspected. The nested route uses a real disposable fixture capability and a rejecting delivery adapter. This closes only the bounded keyboard-bypass increment.

Proposed broader gate: keyboard-only opening/navigation/closing, focus visibility and hidden-link exclusion, screen-reader location and loading/status/error announcements, backdrop/background interaction, long labels, 320px width, 200% zoom, contrast and touch targets. Pass if the intended journey remains perceivable/operable without shell overflow or inaccessible controls. Specify the chosen drawer modality before judging focus trapping. No existing comprehensive verifier establishes these criteria; actual phone access and user acceptance remain separate from emulated viewport tests.

### Comment experiment functional-loop verifier

`bun experiments/comments/full-loop.e2e.ts` now supplies bounded browser evidence for E-11 result persistence and E-12 mobile presentation: real browser/HTTP/store/callback/SSE, with a fixture provider socket. It checks exactly-once delivery, PNG preservation, live result appearance, offline catch-up and reload. It does not close the live-agent or physical-device gates. See the [checkpoint](../experiments/2026-09-23-element-comments.md#controlled-full-loop-e2e) for scope and retained traces.
