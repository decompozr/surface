# Surface source documentation

Surface's `docs/` is the project source specification. Start here to distinguish intended behavior, implemented contracts, proposals and evidence. This organization passed the bounded [DOCS-TAKEOVER-01 continuation trial and independent review](experiments/2026-09-23-docs-takeover.md). The [source workflow](source-workflow.md) governs evidence-to-source updates.

## Authority and reading paths

Direct user and repository instructions govern authorized work. Current intent and adopted contracts below guide implementation; source inspection describes what code does, not proof that it works in a browser. Proposed design criteria are explicitly marked and do not authorize implementation. Historical experiments retain their original revision, results and limits even when superseded. An observation or passing fixture does not adopt a requirement, prove human acceptance or authorize live delivery.

- **Understand the product:** [vision](intent/vision.md) → [principles](intent/principles.md) → [consumer boundary](requirements/consumers.md) → [runtime requirements](requirements/runtime.md).
- **Install or use it:** [user setup](../SETUP.md) → [agent setup](../skills/surface/references/setup.md) → [page authoring](../skills/surface/references/pages.md) → [interaction contract](requirements/agent-interaction.md). Use the selected installation consistently.
- **Completed milestones:** [history](history/2026-09-24-workspace-boundaries.md).
- **Package ownership:** [workspace boundaries](architecture/package-boundaries.md).
- **Design or implement:** requirements → [component ownership](architecture/components.md) and [lifecycle invariants](architecture/lifecycle.md) → [UI design](design/README.md) → [evaluation matrix](evaluations/README.md) and [self-owned E2E procedure](evaluations/self-e2e.md). Inspect the relevant implementation before changing its contract.
- **Installable candidate:** [release and upgrade acceptance](evaluations/release-candidate.md).
- **Mounted-page comments:** [adopted scope](requirements/agent-interaction.md#mounted-page-contextual-comments-september-24-adoption) → [September 24 integration evidence](experiments/2026-09-24-mounted-comments.md).
- **Investigate evidence:** [observation index](observations/README.md) → [findings and dispositions](observations/findings.md#september-23-synthesis-and-disposition) → linked dated experiments and verifiers. Historical green checks do not verify today's WIP.
- **Continue this task:** [continuation](experiments/docs-takeover/continuation.md) → [task](experiments/docs-takeover/task.md) → [intake](experiments/docs-takeover/intake.md) → [completion](experiments/docs-takeover/completion.md) → [independent outcome](experiments/2026-09-23-docs-takeover.md). Check Git status; preserve WIP and the single-writer boundary. [Project continuation](requirements/project-continuation.md) distinguishes this trial from a general autonomous runtime.

## Categories and canonical sources

| Category | Owns | Start here |
| --- | --- | --- |
| `intent/` | User value, scope and principles | [Vision](intent/vision.md), [principles](intent/principles.md) |
| `requirements/` | Observable behavior, exclusions and explicitly proposed work | [Consumers](requirements/consumers.md), [runtime](requirements/runtime.md), [agent interaction](requirements/agent-interaction.md), [continuation](requirements/project-continuation.md) |
| `architecture/` | Component/state ownership, operations, lifecycle and invariants | [Components](architecture/components.md), [lifecycle](architecture/lifecycle.md), [project operations](architecture/project-operations.md), [workspace service](architecture/workspace-service.md), [installation](architecture/installation-lifecycle.md), [release distribution](architecture/release-distribution.md) |
| `design/` | Screen hierarchy, user journeys, states, recovery, drafts and accessibility | [UI contracts and gaps](design/README.md) |
| `evaluations/` | Requirement/design traceability, observable gates and evidence limits | [Evaluation index](evaluations/README.md), [runtime](evaluations/runtime-eval.md), [UI](evaluations/ui-eval.md), [consumer loop](evaluations/consumer-eval.md) |
| `observations/` | Measured telemetry, reported feedback and incidents with provenance | [Observation index](observations/README.md), [findings](observations/findings.md) |
| `decisions/` | Adopted choices and supersession, with authority | [Naming decision](decisions/0002-surface-name-and-local-state.md), [documentation organization](decisions/0003-source-documentation-organization.md) |
| `experiments/` | Dated hypotheses, procedures, results and bounded conclusions | [Original readiness plan](experiments/2026-09-21-readiness-plan.md), [current documentation trial](experiments/docs-takeover/task.md) |

Top-level `source-workflow.md` remains the governance entry. Other old top-level source paths and `implementation/` files are compatibility pointers, not parallel specifications. Executable experiment packages remain under repository-root `experiments/`; moving documentation does not promote their runtimes.

## Complete migration map

| Original source | Canonical destination | Disposition |
| --- | --- | --- |
| `vision.md` | [intent/vision.md](intent/vision.md) | Current intent; reconcile delivered installation and private browser access |
| `architecture.md` | [experiments/architecture-exploration.md](experiments/architecture-exploration.md) | Preserve historical topology/hypotheses; current ownership in [components](architecture/components.md) and [lifecycle](architecture/lifecycle.md) |
| `agent-interaction.md` | [requirements/agent-interaction.md](requirements/agent-interaction.md) | Current delivery/recipient contract; dated provider evidence remains labeled |
| `workflow.md` | [experiments/legacy-workflow.md](experiments/legacy-workflow.md) | Historical per-runtime instructions; current use in setup/page guides |
| `prototype.md` | [experiments/original-prototype.md](experiments/original-prototype.md) | Original implementation and live evidence, not current setup |
| `findings.md` | [observations/findings.md](observations/findings.md) | Preserve earlier synthesis; add current source dispositions |
| `server-readiness.md` | [experiments/first-server-readiness.md](experiments/first-server-readiness.md) | Historical milestone plan/results; current gaps in requirements and evaluations |
| `exploration.md` | [experiments/roadmap-2026-09.md](experiments/roadmap-2026-09.md) | Historical experiment roadmap; no stale next-step authority |
| `source-workflow.md` | [source-workflow.md](source-workflow.md) | Retained governance, links and authority updated |
| `project-autonomy.md` | [requirements/project-continuation.md](requirements/project-continuation.md) | Reconciled proposal/current trial; full imported text in [autonomy input](observations/2026-09-23-autonomy-input.md) |
| `implementation/01-project-core.md` | [architecture/project-operations.md](architecture/project-operations.md) | Adopted operation contract; historical verification kept |
| `implementation/02-installation-lifecycle.md` | [architecture/installation-lifecycle.md](architecture/installation-lifecycle.md) | Adopted storage/lifecycle contract and unresolved decisions |
| `implementation/03-public-entry.md` | [architecture/workspace-service.md](architecture/workspace-service.md) | Adopted commands, identity, layout and migration contract |
| `implementation/04-experimental-release.md` | [architecture/release-distribution.md](architecture/release-distribution.md) | Bounded experimental distribution contract |

The original decisions and dated experiments remain in place; only relative Markdown destinations change as needed. Phase A principles and imported observation input are retained and reconciled, not discarded. Input hashes and preservation details are in the [migration record](experiments/docs-takeover/migration.md). The [documentation decision](decisions/0003-source-documentation-organization.md) records why these categories were chosen.
