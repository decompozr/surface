# Comment delivery modules

`mounted.ts` integrates request-scoped comments into the production host. `delivery.ts` delegates binding, durable submission and result handling to the shared Service; `event.ts` formats compact typed events. Reply reference and endpoint helpers support the CLI without exposing callback credentials to page scripts.

The [component architecture](../../../../../../docs/architecture/components.md#mounted-comment-ownership) owns the integration contract. Follow [self-owned E2E](../../../../../../docs/evaluations/self-e2e.md) for isolated browser verification and the [Surface skill](../../../../../../skills/surface/SKILL.md#reply-to-comments) for current reply commands. The former demo endpoints live only in the test fixture overlay.
