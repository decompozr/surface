# Lifecycle, state and recovery invariants

Status: current contracts; broader operational recovery remains bounded by [runtime requirements](../requirements/runtime.md). Use [workspace service](workspace-service.md) for commands and migration, [installation lifecycle](installation-lifecycle.md) for lazy storage and [interaction requirements](../requirements/agent-interaction.md) for delivery.

| State/resource | Owner and lifetime | Transition and recovery boundary |
| --- | --- | --- |
| Source, manifests, locks and dependencies | Project Git worktree | Unmount/archive/uninstall preserve them. Git merge transfers source only. |
| Workspace identity and mount metadata | Selected shared service / Git workspace markers | Verify actual readiness after restart; retired history retains its original identity. A saved path/PID is not proof of current ownership. |
| Release payload and callback executable | Selected installation | Activation checks compatibility. Unresolved callback work blocks destructive release removal. Code rollback does not roll back domain data. |
| Optional project database | Project schema in persistent workspace data context | Inert backend construction; first valid storage operation acquires, unmount/stop releases, subsequent demand reopens. A mounted-but-unused project creates no database. |
| Temporary form draft / preview state | Project page / explicit preview helper | Component state may reset; opted-in keys/versions survive eligible HMR only. Refresh and takeover navigation have no universal preservation contract. [Draft design](../design/interactions.md#d-05-draft-ownership). |
| Delivery intent | Browser client in-memory map keyed by request endpoint | Current document/tab scope; refresh clears choice and re-inspects. Active recipient requires another explicit choice. Not a durable user instruction. |
| Request / response / result | Service interaction store | Closed/unmounted requests retain records; no automatic resend. Interrupted delivering records become unknown. Result publication is separate from acceptance and source modification. |

## Operation boundaries

Mount readiness, successful browser rendering and successful delivery are separate gates. Mount failure may leave an inspectable record. Archive is ordered unmount then manifest update; if the latter fails, a stopped runtime may still have an active definition. Inspect both records before repeating an operation.

Submission preflight locks the request against close/takeover, checks provider state, then revalidates mount scope before reserving the response. The adapter rechecks before writing input. Queue/start still have a provider race after inspection because their provider operations have no atomic expected-status condition. Steering uses the expected active turn ID. No failure changes mode or destination automatically.

Unsent takeover changes binding as needed and atomically replaces request identity/token while closing the original. No response/result is copied; a lost acknowledgement must be reconciled using the original request's `replacedBy` and administrative inspection. A binding may be reused if the exact root/socket/thread already exists; a new request and token are still required.

Unmount/close/archive do not cancel an agent turn. Shutdown drains admitted bounded operations, not the agent's entire future work. Workspace retirement retains histories/data and blocks unresolved accepted/delivering/unknown work without results. None of these operations implies a source merge, arbitrary data migration or permission to contact another conversation.

## Unresolved envelope

Short resource experiments are not indefinite uptime guarantees. General schema transitions, power-loss guarantees, workload/duration budgets, compiler recreation, arbitrary draft recovery and full-task crash continuation need separate evidence. Current [project continuation](../requirements/project-continuation.md) tests a cooperative handoff, not automatic replay or a persistent worker.
