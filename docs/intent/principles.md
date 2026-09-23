# Surface principles

Status: source principles consolidated from existing intent and experimental lessons for DOCS-TAKEOVER-01. Phase B preserves these Phase A principles and links their concrete design/evaluation contracts.

- **Projects retain ownership.** Source, dependency declarations and domain data belong to the project. Surface owns common runtime and interaction mechanisms. [Existing vision](vision.md#projects-own-content-and-domain-meaning).
- **Identity survives labels and paths.** Keep project, workspace, artifact, request and conversation identity explicit. Worktree source merge does not merge databases or transfer submitted requests. [Workspace contract](../architecture/workspace-service.md#worktree-workflow).
- **Acknowledgement is not completion.** Distinguish saved input, accepted delivery, observed action, published result, rendered result and human acceptance. Unknown effects require reconciliation. [Interaction contract](../requirements/agent-interaction.md#delivery-outcomes).
- **Temporary state has a declared lifetime.** Local drafts, HMR state, persisted domain data and service records have separate owners and recovery behavior. [HMR evidence](../experiments/2026-09-20-scoped-hmr.md).
- **Optional resources stay optional.** Registration, mounting and subscriptions must not allocate project data unless the contract requires a valid data operation. [Lazy storage policy](../architecture/installation-lifecycle.md#accepted-project-storage-policy).
- **Experiments change the source through evidence.** Preserve observations and limits, then make adoption or deferral explicit in docs. [Learning workflow](../source-workflow.md).
- **Interfaces must expose consequential choices.** A person must be able to identify the current workspace/recipient and distinguish a preview, submission and completed result. Concrete screen, state and interaction contracts are in [UI design](../design/README.md), with [evaluation gates](../evaluations/ui-eval.md).
