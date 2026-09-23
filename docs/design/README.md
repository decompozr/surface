# Shared UI design

Status: current behavior documented from source at `7fceefc`, with explicit proposed criteria for missing behavior. This pass contains no rendered-browser or device acceptance. The [Phase A audit](../experiments/docs-takeover/ui-source-audit.md) is an input; Phase B independently inspected the shell, navigation, recipient panel, client/service and verifier sources.

The shared shell should let a person locate a project/worktree/page, understand whom a submission will reach, make its delivery choice, and distinguish saved input from completed work. The project page owns domain controls and meaning. Surface owns navigation and request delivery controls. Keep this hierarchy visible even when a project's content is wide or its recipient is unavailable.

| Design contract | Source of truth | Status |
| --- | --- | --- |
| D-01, D-02: hierarchy, routes and navigation states | [Navigation](navigation.md) | Current implementation plus identified empty/stale-state gaps |
| D-03, D-04: recipient and request transitions/recovery | [Interactions](interactions.md) | Current service contract; some recovery presentation is proposed |
| D-05, D-06: draft lifetime and results | [Interactions](interactions.md#d-05-draft-ownership) | Current ownership limits; project-specific restoration/results require evaluation |
| D-07, D-08: mobile and accessibility | [Accessibility](accessibility.md) | Current source mechanics; broader acceptance criteria remain unverified/proposed |
| D-09: freshness and discovery | [Interactions](interactions.md#d-09-freshness-and-discovery) | Manual/mount refresh implemented; explicit availability/freshness presentation proposed |

## Journeys

1. **Browse:** open the selected service → choose project, exact worktree, mounted folder and route → inspect project content. No binding or submission is required. A clean navigation URL grants no request capability.
2. **Submit to the originating agent:** open the returned request URL → inspect recipient → choose queue/steer for an active turn (or start for idle/notLoaded) → complete and explicitly submit the project form → inspect delivery → observe the result/source change separately. Requirements [R-08–R-11](../requirements/agent-interaction.md#requirement-index) govern identity and uncertainty.
3. **Change an unsent recipient:** on an opted-in request, select a same-worktree candidate → confirm recipient change → open the new request/token URL → review page input again → submit deliberately. Submitted requests must be reconciled before another interaction; existing input is never replayed.
4. **Recover:** if a preflight state check rejects, refresh and review mode before a deliberate submission. If a response may have been reserved or delivered, inspect the existing request and response ID before any retry. A lost takeover acknowledgement requires original-request inspection; elapsed time does not prove the operation failed.
5. **Navigate on a phone:** open the drawer → select a route → identify workspace and recipient in content → submit/review using the same semantics. Drawer focus behavior, long labels, zoom and actual second-device access still need their own gates.

The [UI evaluations](../evaluations/ui-eval.md) give observable pass/fail criteria for each journey and show which checks exist. No new implementation, live interaction or design acceptance is authorized by recording these criteria.
