# Decision 0003: organize source contracts and evidence

Date: September 23, 2026. Status: documentation organization adopted within the user-authorized DOCS-TAKEOVER-01 successor scope; bounded [independent trial review](../experiments/2026-09-23-docs-takeover.md) passed. This records a documentation choice, not product redesign approval.

## Decision

Use `intent`, `requirements`, `architecture`, `design`, `evaluations`, `observations`, `decisions` and `experiments` under `docs/`. Keep `source-workflow.md` as governance and `docs/README.md` as the canonical reading/migration guide. Add concrete UI design because the task explicitly reports that gap. Use Surface consumer requirements instead of inventing an Inquiry specification.

Move substantive content into these categories. Keep original top-level and implementation paths as compatibility section pointers. Retain historical plans/prototype topology in experiments with explicit status notices. Preserve dated experiment/decision evidence, imported Phase A observations and original autonomy interpretation. Update relative Markdown destinations without converting historical commands, counts or receipts into new proof.

Stable R/D/E identifiers connect requirements, design and evaluations. Proposed UI/recovery criteria are marked separately from current implementation and from rendered acceptance. Findings receive explicit source dispositions. Correct obsolete current-status claims about delivered installation, private browser access and shared recipient/navigation behavior.

## Consequences and verification

Readers use one canonical source per contract and can still follow earlier paths. The [migration map](../README.md#complete-migration-map) and [input hashes](../experiments/docs-takeover/migration.md) preserve traceability. [Completion](../experiments/docs-takeover/completion.md) records actual checks, scope and remaining limits. No application changes, installation, runtime verification, commit, release or independent review is implied by this decision.
