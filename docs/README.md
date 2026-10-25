# Surface source documentation

`docs/` is the project source specification. Direct user and repository instructions govern authorized work; current requirements and adopted decisions guide implementation. Dated evidence describes the tested revision and does not establish acceptance of later changes. See [source workflow](source-workflow.md) for updating a contract from evidence.

## Learn the project

1. [Vision and core ideas](intent/vision.md): the capability being explored and why it matters.
2. [How Surface works](how-it-works.md): a page-to-agent walkthrough, design rationale, ownership and current limits.
3. [Components](architecture/components.md) and [package boundaries](architecture/package-boundaries.md): map the walkthrough to implementation responsibilities.
4. [Interaction requirements](requirements/agent-interaction.md) and [workspace service](architecture/workspace-service.md): the exact contracts behind the examples.
5. [Evaluations](evaluations/README.md) and [history](history/2026-10-05-navigation-and-design.md): how claims are tested and what specific experiments actually established.

The learning guide explains the design. Requirements and architecture documents remain authoritative for exact behavior; historical evidence is dated, and proposed capabilities are labeled separately.

## Start here

- Developer rules: [development policy](development.md).
- Product scope: [vision](intent/vision.md), [principles](intent/principles.md), [consumers](requirements/consumers.md).
- Adopted page direction: [typed, templated, persisted pages](requirements/template-pages.md), including explicit view state and project extensions; implementation pending.
- Installation and use: [user setup](../SETUP.md), [agent setup](../skills/surface/references/setup.md), [page authoring](../skills/surface/references/pages.md).
- Implementation: [module ownership](architecture/package-boundaries.md), [component interactions](architecture/components.md), [state and lifecycle](architecture/lifecycle.md).
- User experience: [design](design/README.md).
- Verification: [evaluation matrix](evaluations/README.md), [self-owned E2E](evaluations/self-e2e.md), [release acceptance](evaluations/release-candidate.md).

## Canonical ownership

Each subject has one source of authority. Other documents should link to that source instead of repeating its specification or installation procedure.

| Category | Owns | Main sources |
| --- | --- | --- |
| `intent/` | User value, product scope and principles | [Vision](intent/vision.md), [principles](intent/principles.md) |
| `requirements/` | Observable behavior and exclusions; explicitly labeled proposals | [Consumers](requirements/consumers.md), [runtime](requirements/runtime.md), [template pages](requirements/template-pages.md), [agent interaction](requirements/agent-interaction.md), [continuation proposal](requirements/project-continuation.md) |
| `architecture/` | Implementation ownership, state, operations and invariants | [Modules](architecture/package-boundaries.md), [components](architecture/components.md), [lifecycle](architecture/lifecycle.md), [project operations](architecture/project-operations.md), [workspace service](architecture/workspace-service.md), [installation](architecture/installation-lifecycle.md), [release distribution](architecture/release-distribution.md) |
| `design/` | Navigation, interaction states, recovery, drafts and accessibility | [Design index](design/README.md) |
| `evaluations/` | Traceability and acceptance procedures | [Evaluation index](evaluations/README.md) |
| `decisions/` | Adopted choices and their rationale | [Naming](decisions/0002-surface-name-and-local-state.md), [documentation organization](decisions/0003-source-documentation-organization.md), [current development contract](decisions/0004-current-development-contract.md) |
| `observations/` | Measured behavior and reported feedback with provenance | [Observation index](observations/README.md), [findings](observations/findings.md) |
| `experiments/` | Dated hypotheses, procedures, results and limitations | [Readiness study](experiments/2026-09-21-readiness-plan.md), [mounted comments evidence](experiments/2026-09-24-mounted-comments.md), [completed documentation trial](experiments/2026-09-23-docs-takeover.md) |
| `history/` | Concise records of completed changes and evidence retirement | [Workspace evolution](history/2026-09-24-workspace-boundaries.md), [working-data retention](history/2026-09-24-working-data-retention.md) |

Historical documents preserve the claims of their time. They are not current setup instructions or pending tasks. The completed documentation reorganization's path mapping and preservation details belong to its [migration record](experiments/docs-takeover/migration.md).
