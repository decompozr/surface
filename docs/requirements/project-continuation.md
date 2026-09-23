# Project continuation and remaining autonomy gaps

Status: proposed project-operation contracts, with completed bounded documentation/UI continuation trials and independent reviews. Later live-loop and interruption fixtures are separately scoped below. Originally reconciled September 23, 2026 at `7fceefc` from the [preserved earlier reflection](../observations/2026-09-23-autonomy-input.md), current source, and [DOCS-TAKEOVER-01](../experiments/docs-takeover/task.md). This does not implement an agent scheduler or authorize a new product backlog.

## Current evidence and corrections

Shared project/workspace identity, installed lifecycle and exact-session request records provide mechanisms for continuation. Shared navigation and recipient controls are now implemented; the earlier reflection's blanket “experimental picker only” assessment is stale. Current queue and takeover fixture sources do not establish a user-driven live takeover. The separate recipient lab remains experimental.

The comments worktree reconciliation preserved the [comment prototype and its evidence](../experiments/2026-09-23-element-comments.md) and [recipient experiment record](../experiments/2026-09-23-agent-recipient.md). Their presence does not adopt a comments feature into the public runtime or establish browser acceptance. The [retained reflection input](../observations/2026-09-23-reflection-input.md) remains historical.

The [completed trial](../experiments/2026-09-23-docs-takeover.md) observed a fresh successor completing the documentation task from durable records without additional briefing; independent review passed. This supports one cooperative handoff with a prepared checkpoint and single writer. Crash recovery, automatic replay, long-running scheduling and full autonomy remain untested.

The authorized [UI-CONTINUATION-02](../experiments/ui-continuation/task.md) adds a planned interruption after implementation and before browser acceptance. Its successor recorded [intake](../experiments/ui-continuation/intake.md), corrected a fixture-context error, and completed browser/check/source reconciliation in [completion](../experiments/ui-continuation/completion.md). [Independent coordinator review](../experiments/ui-continuation/review.md) passed after one verifier readiness correction; no crash or uncertain external mutation was tested.

## Proposed continuation contract

<a id="r-13"></a>**R-13 — Repository-based continuation (proposed general contract; adopted only as this trial's task protocol).** A fresh agent must reconstruct the same bounded objective and next permitted action from versioned/task records, preserve WIP and evidence, and distinguish attempted, accepted, completed and unknown effects. It must not need the user to repeat a recorded brief. Evaluate using [E-14](../evaluations/consumer-eval.md#e-14-cooperative-continuation).

| Record | Must expose | Failure condition |
| --- | --- | --- |
| Objective | Outcome, source revision, completion gates, exclusions, actual authorization and any explicitly set resource limits | Invented scope/budget or an unbounded list of experiments replaces the desired outcome |
| Progress | Task/worktree identity, WIP, last checked step, pending effects and next action | Historical green evidence is represented as today's verification |
| Ownership | Active writer, transfer boundary and successor authority | Stale predecessor edits or concurrent writers corrupt the checkpoint |
| Verification | Which observable gate is supported by which revision/environment, fixture/live/human evidence | A receipt or merged source is treated as end-user acceptance |
| Recovery | Inspect-before-retry rules, unknown effects, retained IDs and necessary escalation context | Another recipient or response ID is used to bypass uncertainty |
| Learning | Finding, disposition, changed source/evaluation and superseded interpretation | A completed experiment leaves current source/progress stale |

## Next permitted work and open questions

DOCS-TAKEOVER-01 completed its documentation scope and gate 8 independent review. UI-CONTINUATION-02 and independent review are complete; local baseline `4b629b8` includes its PR #45 merge. Do not repeat the completed task or infer deployment or general autonomy from it. The trial records the actual preparation, interventions and limits.


[INTEGRATED-LOOP-03](../experiments/2026-09-23-integrated-loop.md) subsequently recorded intentional user input, exact queued delivery, source change, checks and rendered result on one identified installed runtime/page snapshot. Human acceptance remains unrecorded. Existing comments/SSE coverage must be considered before proposing another loop test.

[INTERRUPTED-DELIVERY-04](../experiments/2026-09-23-interrupted-delivery.md) then killed an owned sender at three acknowledgement-loss points and used a fresh process to distinguish missing evidence, acceptance without completion and matched completed output. No input replay occurred. Explicit harness lock recovery and fixture provider evidence remain limitations. This does not test a fresh agent independently recovering an arbitrary task, and the general R-13 contract remains proposed. Scheduling, cancellation, workload/duration limits, data-loss policy and durable task ownership remain unresolved.

Within existing authorized scope, routine choices and reversible work should proceed without repeated approval. Ask only for genuinely missing decisions or authority. Surface Core remains responsible for runtime/exchange, while project outcome selection and orchestration belong to the project or an external controller.

The subsequent [UI integration](../experiments/2026-09-23-ui-integration.md) combines the preserved comments/design-system work with overlay scroll locking. The common recipient panel now exposes read-only submission inspection, retained response identity after a lost browser acknowledgement, and independent durable-result visibility during provider failure. This addresses a bounded recovery UI gap; it does not adopt a general autonomous recovery scheduler.
