# Task DOCS-TAKEOVER-01

Status: Phase B successor work complete; gate 8 independent coordinator review pending. The original trial contract below is retained. English repository documents; Traditional Chinese user communication.

## User outcome

Reorganize Surface's source documentation so a person or a fresh agent can locate intent, requirements, architecture, UI design, evaluations, observations, decisions and experiments without reconstructing conversations. The user specifically reports missing UI design docs and wants concrete design contracts instead of handwaving.

User-proposed categories: `docs/intent` (vision, principles), `requirements` (inquiry, artifact-server, runtime), `architecture` (components, lifecycle, invariants), `evaluations` (inquiry-eval, runtime-eval, ui-eval), `observations` (telemetry, user-feedback, incidents), `decisions`, `experiments`. Adapt topic names to Surface's actual scope. Add `docs/design` to address the explicit UI gap. Inquiry is another possible consumer; do not invent an Inquiry product specification in this repo.

## Baseline and inputs

- Branch: `experiment/docs-autonomy-20260923`; worktree created from main `7fceefc5c0324440752bf914288c482bf69e44ff`, confirmed equal to origin/main after fetch.
- Canonical checkout and original working tree are preserved. No application changes from the original comments WIP were imported.
- Existing main docs, current application/component code, tests, verifiers and experiment READMEs supply the source evidence.
- `docs/source-workflow.md` and `docs/project-autonomy.md` were copied from the earlier reflection as provisional inputs. Their claims need reconciliation with current main. `docs/observations/2026-09-23-reflection-input.md` preserves the earlier findings as an explicitly dated input, not an adopted contract.
- Recorded historical test passes are not fresh verification. Source inspection is not rendered browser evidence.

## Authorized scope

Edit documentation and documentation navigation in this isolated worktree, including AGENTS.md, README.md, SETUP.md, and link-only changes in other Markdown guides if relocation requires them. Add a focused local documentation validation script if useful. Preserve prior records, meaning, traceability and all unrelated WIP. No application code changes, live service changes, dependency installation, real-user submissions, deployments, push/merge, cleanup of existing worktrees, or commits are needed for this trial. Do not contact other live conversations or spawn additional agents. No time/token budget is invented; report a concrete blocker if one is encountered.

## Completion gates

1. `docs/README.md` explains where each kind of information belongs, current versus historical authority, reading paths for humans/agents, and a migration map for every original top-level docs file.
2. Documents are actually organized into the adopted categories; use precise compatibility pointers where useful, not a second contradictory specification. Preserve dated experiments and decisions as evidence.
3. Requirements are specific to Surface. State supported behavior, experimental proposals, exclusions and unresolved choices. Do not treat new design proposals as already implemented.
4. UI design has an information hierarchy, screens/routes, key user journeys, interaction/state tables, empty/loading/error/offline/unknown cases, draft ownership, mobile behavior, accessibility criteria and explicit open decisions. Ground current behavior in source or recorded evidence. Illustrative wireframes are welcome; no fabricated screenshot acceptance.
5. Evaluation docs connect requirement/design identifiers to observable pass/fail criteria, available verifier commands/evidence and untested gates. Observations retain evidence provenance and distinguish telemetry, reported user feedback and incidents.
6. Internal Markdown links and anchors resolve after migration; relevant non-doc guides point to the new canonical sources. No application source or unrelated WIP changes. Run a focused documentation check and `git diff --check`.
7. A new agent, without this conversation or predecessor runtime context, resumes from repository records, preserves Phase A WIP and records its intake, decisions, checks and remaining limits.
8. Coordinator independently reviews the result and records actual interventions and trial limits, then feeds lessons into the docs source. Success does not imply crash recovery, safe automatic replay, production UI acceptance, or full project autonomy.

## Trial method

Phase A: coordinator inventories the repository, establishes this contract, writes the initial docs entry and principles, then deliberately stops while the restructuring and UI/evaluation work remain incomplete. Capture hashes of WIP and hand over ownership in `continuation.md`.

Phase B: launch one fresh visible conversation with only the worktree and continuation-record pointer. It must use repository records to finish and leave a final report. No parent conversation is forwarded. The predecessor does not edit successor-owned files while it runs.

Review: independently check content, traceability, links, diff scope and the successor's actual work. Record seeded context, what the successor reconstructed, any repairs/extra briefing, pass/fail/partial outcomes, and next experiment. A cooperative checkpoint is not an abrupt process crash.
