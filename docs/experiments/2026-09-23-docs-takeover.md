# Documentation reorganization and cold continuation trial

Date: September 23, 2026. Outcome: **bounded pass after independent review** for a cooperative, repository-record-based documentation handoff. This is not evidence of abrupt-crash recovery, unattended runtime scheduling, product UI acceptance or full project autonomy.

## Objective and setup

The user requested a new worktree from main, a real task reorganizing Surface documentation, and concrete UI design docs because the existing process left too much implicit. The [task contract](docs-takeover/task.md) defines eight gates and the permitted scope.

- Baseline: main and fetched origin/main both resolved to `7fceefc5c0324440752bf914288c482bf69e44ff` before creation.
- Branch: `experiment/docs-autonomy-20260923`; worktree: `/Users/scottchu/.codex/worktrees/surface-docs-autonomy-20260923`.
- The canonical checkout, original worktree and its concurrent comments WIP were preserved. Only explicit prior reflection inputs were copied; application WIP was not imported.
- Phase A supplied the task/authority, a partial documentation entry, principles, provisional prior reflections and a separate read-only UI source audit. Its checkpoint was recorded at 12:48:03 UTC. The task was deliberately incomplete when the writer handed off.
- Phase B was a new persistent conversation, created with the Codex Conversation workflow. The exact thread was `01a0ce4f-999d-77d2-9996-92171a459736`, titled **Surface docs — cold continuation trial**. Its working directory and presence in the normal default conversation list were verified. App project grouping/worktree display mode and actual phone display were not verified.

The successor's sole initial user prompt was:

> Continue the authorized repository task from docs/experiments/docs-takeover/continuation.md in this working directory. Follow AGENTS.md. Use the repository records to reconstruct the objective and finish the task. This is a fresh continuation; no predecessor conversation is provided.

No parent conversation was forwarded. This was a well-prepared handoff: the successor had detailed repository records and ordinary global/provider instructions. It was not a test of an agent inferring an unrecorded goal from an empty repository.

## Observed continuation

The successor wrote [intake](docs-takeover/intake.md) before substantive migration. It reconstructed the objective, scope, WIP and evidence limits, then inspected current source. It corrected the earlier reflection's obsolete claim that all recipient controls remained experimental: current main already contains shared navigation and recipient controls, while the separate lab remains experimental.

It moved substantial documents into the source categories, kept compatibility section pointers and original-input hashes, added UI state/journey/recovery/accessibility contracts, and connected requirements/design to evaluation gates. It chose consumer scope instead of inventing an Inquiry product specification. It also found that CLI `send` supplies no delivery intent and documented its idle-start compatibility limit rather than inventing active-mode flags.

The actual successor turn reached completed status and produced a final report. Its [completion record](docs-takeover/completion.md) retains its own checks and independent-review boundary. The coordinator disconnected only the completed interactive client; the saved conversation remains available. No successor request for repeated user briefing, extra permissions or predecessor help occurred.

## Independent review

| Gate | Observed outcome |
| --- | --- |
| Canonical reading guide and migration map | Pass: [docs entry](../README.md) maps original top-level and implementation documents to one canonical source or historical record. |
| Real content organization and preservation | Pass: substantive content moved into categories; original sections remain reachable through compatibility pointers. All 13 migration input hashes matched the baseline/Phase A checkpoint. Historical prose preservation was checked separately from rewritten links/notices. |
| Surface-specific requirements and authority | Pass: current contracts, proposals, exclusions and historical evidence are labeled. Inquiry remains a consumer boundary. |
| Concrete UI design | Pass for source specification: hierarchy/routes, journeys, recipient/request states, errors/unknown effects, draft ownership, freshness, mobile and accessibility are explicit. Source inspection is not rendered acceptance. |
| Evaluations and observations | Pass: 13 requirement IDs, 9 design contracts and 16 evaluation gates; available checks and open cases are separate. Telemetry, reported feedback and incidents retain provenance. |
| Documentation validation and scope | Pass: repository checker, independent link/anchor/scope checker and whitespace checks. No runtime source, dependency, service or installation changes. Final counts are recorded below. |
| Fresh-session continuation | Pass for this task: one initial prompt, repository-derived intake and completed work; no additional task briefing or corrective message. |
| Independent coordinator review and feedback into source | Pass: reviewed content against source, checked preservation/scope, recorded limitations and updated source workflow/current status with this result. |

A separate read-only reviewer flagged an inherited sentence implying result publication automatically displays in the page. Before any correction was sent, the successor's own final review changed it to require the project page to read and render the result. No coordinator content patch was needed for that finding. The report preserves this observation rather than counting it as an extra instruction to the successor.

## Interventions and limits

One coordinator launch error occurred before the conversation existed: a heredoc consumed stdin, so interactive Codex refused a non-terminal input. The coordinator verified the intended cwd still had zero conversations, corrected the PTY launch, and created exactly one successor. This was orchestration setup repair, not a second trial or repeated task submission. Creating/naming/verifying the conversation and recording final review are coordinator actions; autonomous self-launch was not tested.

During Phase B, the coordinator inspected output read-only and prepared independent checks; it did not edit successor-owned documents or send task hints. There were zero extra user briefings and zero corrective messages to the successor. After completion the coordinator added this experiment result and updated current status/source references. At trial completion, all task changes were uncommitted for review; no push, merge, deployment or installation update had occurred. The user subsequently authorized PR creation, merge, and cleanup of the completed experiment conversation and worktree. This integration is separate from the cold-continuation trial.

The task was intentionally scoped and had a cooperative checkpoint, available source evidence, detailed acceptance gates and a single writer. There was no injected crash during a mutation, conflicting writer, lost delivery acknowledgement, exhausted budget, automatic restart, or repeated long-running trial. The useful UI spec is not proof of UI usability or accessibility. External links and old private browser/session receipts were not freshly verified.

## Lessons and source disposition

1. **The continuation record was sufficient for one real handoff.** Preserve objective, baseline, WIP, authority, completed gates, pending effects and next action. Incorporated as a bounded precedent in the [source workflow](../source-workflow.md#continuation-evidence).
2. **Source authority needs navigation and status, not just more documents.** Separating current requirements/design from historical experiments let the successor correct stale progress without erasing observations. Incorporated in [Decision 0003](../decisions/0003-source-documentation-organization.md) and [findings](../observations/findings.md#september-23-synthesis-and-disposition).
3. **UI behavior can be made reviewable before implementing it.** Concrete states and pass/fail gates exposed real gaps in freshness, unknown-outcome guidance, draft lifetime and accessibility. These remain explicitly proposed/open design work; this trial does not implement or validate them.
4. **Passing document checks is necessary but insufficient.** Independent source review and the separation of published versus displayed results remain important. Identifier coverage checks references, not the truth or completeness of each requirement.

The smallest next continuation experiment is an isolated task interrupted after a fixture operation is accepted but before its result is recorded. A fresh session should inspect retained identity/evidence and continue without duplicate effects. That is a proposed next gate, not an action performed or authorized by this documentation trial.

## Final verification

After coordinator source updates:

- `python3 scripts/check-docs.py`: pass, 93 Markdown files and 696 local destinations/anchors; 32 external references skipped. Coverage: 13 requirements, 9 design contracts, 16 evaluation gates.
- An independently prepared link/anchor/scope checker: pass, the same 696 local references and no unexpected non-documentation changes (the authorized documentation checker is the only non-Markdown change).
- `git diff --check` and a changed/untracked text whitespace/newline scan: pass.
- Independent preservation check: six historical bodies match baseline after excluding rewritten link destinations and the added history notice; all 13 recorded migration input hashes match; 64 changed/new files stay within scope.
- Exact successor conversation identity/cwd/default-list verification: pass; intake and completed final reply were inspected separately. The completed interactive client exited with code 0. Grouping/display mode and actual phone visibility remain unverified.

The successor's earlier 92-file / 678-reference run remains its own checkpoint in [completion](docs-takeover/completion.md). Private baseline, Phase A hashes, thread/list receipts, independent check and final source inventory are retained under ignored `.decompozr/surface/docs-takeover/`. The versioned task, migration and outcome records carry the non-private conclusions. No runtime/browser/installation checks were rerun.
