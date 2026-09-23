# Project continuation and remaining autonomy gaps

Status: proposed project-operation contracts, with one completed bounded documentation trial and independent review. Reconciled September 23, 2026 at `7fceefc` from the [preserved earlier reflection](../observations/2026-09-23-autonomy-input.md), current source, and [DOCS-TAKEOVER-01](../experiments/docs-takeover/task.md). This does not implement an agent scheduler or authorize a new product backlog.

## Current evidence and corrections

Shared project/workspace identity, installed lifecycle and exact-session request records provide mechanisms for continuation. Shared navigation and recipient controls are now implemented; the earlier reflection's blanket “experimental picker only” assessment is stale. Current queue and takeover fixture sources do not establish a user-driven live takeover. The separate recipient lab remains experimental.

The earlier reflection refers to comments WIP and two September 23 source records absent from this checkout. Their [retained input](../observations/2026-09-23-reflection-input.md) is evidence of a prior interpretation, not current implementation or verified browser behavior. No comments feature is adopted by this task.

The [completed trial](../experiments/2026-09-23-docs-takeover.md) observed a fresh successor completing the documentation task from durable records without additional briefing; independent review passed. This supports one cooperative handoff with a prepared checkpoint and single writer. Crash recovery, automatic replay, long-running scheduling and full autonomy remain untested.

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

This worktree has completed the requested documentation scope and gate 8 independent review. Changes remain uncommitted for review; do not repeat the completed task or treat completion as authorization to integrate/deploy. The trial records the actual preparation, interventions and limits.

A later integrated-loop experiment could separately observe intentional user input, exact delivery, source change, checks, rendered result and updated progress at one revision. A subsequent fixture could interrupt accepted work and test reconciliation before a fresh session continues. These are proposed next experiments, not authorization to run them now. Scheduling, cancellation, workload/duration limits, data-loss policy and durable task ownership remain unresolved.

Within existing authorized scope, routine choices and reversible work should proceed without repeated approval. Ask only for genuinely missing decisions or authority. Surface Core remains responsible for runtime/exchange, while project outcome selection and orchestration belong to the project or an external controller.
