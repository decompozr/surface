# Independent review — UI-CONTINUATION-02

September 23, 2026. Status: bounded implementation and cooperative continuation pass after one coordinator verifier correction. PR preparation is authorized by the user's request to run the proposed experiment through reviewable delivery; merging or deployment is not part of this trial.

## Protocol and interventions

The coordinator created the task record in an isolated worktree from main `6dd9083`. Phase A ran as `/root/ui_phase_a` with no inherited conversation history and stopped after implementation/checkpoint, before browser acceptance. Phase B ran as `/root/ui_phase_b` with no inherited conversation history, receiving only the worktree, AGENTS.md and task/checkpoint pointers. These are fresh-context subagents, not separate desktop-visible conversations or a demonstrated provider-session restart. The checkpoint and intake preserve their separate reconstructions.

No implementation hints, task corrections or additional user briefing were sent to either phase. Phase B independently corrected its invalid fixture request and incomplete capability context. After Phase B relinquished writing, coordinator review made one verifier correction described below. Do not report this as a completely intervention-free end-to-end result. The user asked whether layout was changing; the scope remained the keyboard affordance and focus behavior, with no header/sidebar/content rearrangement or comments-page redesign.

## Independent verification and discovered failure

Source review confirms a narrow shell change: first keyboard link, focus outline, existing region target, URL-preserving focus, and drawer dismissal. Existing placement, navigation and delivery behavior are unchanged by this increment. Phase B supplied passing build, type/Svelte, navigation and recipient verifier evidence; its original report remains historical, not rewritten.

The coordinator's first independent focused browser run failed waiting for first-Tab focus on the nested route. The desktop `aria-expanded=true` predicate already exists in SSR and did not establish client readiness; initial client navigation could still reset focus. The verifier now also waits for the hydrated Refresh recipient control to become enabled before keyboard input. This is a condition-based fixture readiness check, not a fixed sleep, forced focus, weakened assertion or runtime change. The corrected focused verifier passed two independent consecutive runs at all three widths. App Svelte/server checks were rerun for the changed verifier. Full E-12 remains open.

The coordinator inspected actual desktop and 320px rendered screenshots, including the focused link over an open drawer and focused content after activation. The final nested fixture carries a valid disposable capability; its idle recipient controls render. The home capability error is deliberate out-of-scope interaction context and is not claimed as successful home authorization. Screenshots remain ignored local evidence; the committed verifier reproduces them without a model connection.

## Learning dispositions

| Finding | Disposition |
| --- | --- |
| A fresh agent can finish this small implemented UI increment from records | Bounded evidence added to R-13/E-14; not general project takeover |
| Exact fixture identity and complete URL context are required even for UI tests | Keep the real disposable request and rejecting adapter; do not bypass runtime authorization |
| A passing verifier run can hide a readiness race | Preserve the failed independent run; assert actual hydrated readiness; retain separate review |
| Environment prerequisites are part of continuation | Phase A records pinned dependencies, failed checks, successful preparation and absence of pending processes |
| Source records must distinguish implementation, browser evidence and adoption | D-08 and E-12 updated; broader accessibility, user acceptance and installed release remain separate |

This was a planned cooperative pause with a sole writer at each stage. There was no killed writer, unknown delivery effect, automatic rollback, scheduler, device validation or live user-to-agent transaction. The next autonomy gap is reconciling an interrupted or uncertain effect from durable state before retry, not adding more simultaneous writers. A future experiment needs its own bounded fixture and authorization.

## Current state

Implementation, browser evidence, source updates and independent review are complete. The coordinator will commit the reviewable increment and publish its PR. Do not repeat Phase A or B. No runtime installation was changed, no fixture reached a real conversation, and no background fixture process is left by the completed verifiers. The comments WIP reconciliation occurred separately in its original worktree and is not included in this PR or counted as autonomous successor work.

Final reviewed source SHA-256:

- `apps/surface/src/lib/components/SurfaceShell.svelte`: `9d64d73325d75f6e9566c5c635dd7469f1d06a2e17dc2fdb7c6cabcc5365a380`
- `tests/e2e/surface/verify-skip-link.ts`: `78e1107e889c124a65bf78416060ad76fac6c5e6a14a604bcfec648d80eda4d6`

Final documentation check passed: 98 Markdown files, 712 local references, 13 requirements, 9 design contracts and 16 evaluation gates. `git diff --check` passed.
