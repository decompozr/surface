# Progress and the path to project autonomy

> Preserved imported interpretation at `a97e34f`; not the current progress contract. See [reconciled continuation requirements](../requirements/project-continuation.md). Absent earlier-worktree records are not evidence of implementation in this checkout.

Reviewed September 23, 2026 against repository HEAD `a97e34f` and the existing uncommitted comments prototype. This is a synthesis of recorded evidence and a proposed next work sequence, not a new runtime verification or authorization to deploy it.

The requested goal is for an agent to carry Surface forward from its source documentation with minimal repeated coordination by the user. That requires a reliable loop for selecting work, preserving context, executing, checking results, learning, and recovering. The current evidence establishes many operations inside that loop; it does not establish autonomous ownership of the whole project.

## What progress establishes

| Area | Current evidence | Remaining gap |
| --- | --- | --- |
| Useful human/agent loop | [Exact-session interaction](../experiments/2026-09-20-singleton-interactions.md) and [live source edit](../experiments/2026-09-21-live-source-edit.md) separately observed delivery, agent action, callback and browser change | One bounded edit does not establish repeated autonomous work or completion of an arbitrary objective |
| Project continuity | [Public workspace contract](../architecture/workspace-service.md) preserves source, worktree identity, interaction history and optional data | Runtime identity is not a durable record of the project's objective, priorities, decisions and next action |
| Installation and entry points | [Release proof](../experiments/2026-09-22-release-loop.md), [setup proof](../experiments/2026-09-22-agent-setup.md), CLI/MCP and current setup instructions | Fresh-user discovery and a real installed end-to-end user/agent loop still require their own observations |
| Multiple views and updates | [Shared backend](../experiments/2026-09-21-multi-surface.md) and [synchronization](../experiments/2026-09-21-surface-sync.md) passed bounded experiments | Still deliberately separate from the public runtime; production adoption and scheduling limits are unresolved |
| Choosing a recipient and taking over | [Recipient lab](../../experiments/agent-picker/README.md) combines a real read-only directory with separate fixture-backed delivery lifecycle tests | No adopted live picker/binding flow or user-driven live takeover; cross-worktree visibility is not delivery compatibility |
| Contextual comments | September 23 follow-up (earlier `2026-09-23-element-comments.md` record; absent from this checkout) records a v2 WIP playground, nine model/access/delivery tests, private HTTPS verification and read-only exact-conversation connectivity | User screenshots establish interaction with the v1 fixture; v2 browser capture, draft recovery and actual agent delivery/result remain unverified; the experimental UI is not adopted |
| Verification | Numerous deterministic, browser, transport, installed-release and separate live-session verifiers | No repository-wide unattended orchestration or `.github` CI configuration was found at this checkpoint; historical pass counts do not cover current WIP |
| Operational recovery | Ownership checks, retained callbacks, conservative `unknown` outcomes, retirement guards and bounded cleanup evidence | No demonstrated full-task restart/resume, unattended reconciliation, supported long-running resource budget or cancellation contract |

## What is missing in the way we make progress

The experiments have generally been careful about evidence boundaries. The weaker part is consolidation. At the start of this review, some source pages still described installation as the next milestone after later implementation records reported it delivered. Recent recipient experiments lived in their package README without a corresponding source-doc synthesis. This documentation pass reconciles those status pointers and adds the recipient source record. The concurrently changing comments WIP remains outside the verified synthesis. These are concrete examples of project knowledge being distributed across artifacts that a successor must manually reconcile.

A second gap is acceptance across the assembled product. A successful development-host interaction, a successful downloadable installation, and a real directory read do not jointly prove that a first-time user can install the current product, select the intended conversation, send a meaningful request, receive a verified edit, and continue after interruption. That path needs its own acceptance run.

A third gap is outcome selection. The record contains many successful technical gates, but does not yet define a durable, prioritized queue tied to the user's desired outcomes. Without it, each experiment can suggest another experiment while nobody can determine that the current product objective is complete. A next step should resolve a named product gap, not merely exercise another available capability.

The [source workflow](../source-workflow.md) addresses the documentation feedback rule now. It does not implement a scheduler, project controller, or automatic evidence evaluation.

## Contracts needed for autonomous continuation

| Missing contract | What it must make explicit | Acceptance evidence |
| --- | --- | --- |
| Objective and priority | Desired outcome, source revision, completion criteria, dependencies, exclusions, authorized scope and resource/time budget | A fresh agent selects the same next necessary action from repository records without asking the user to repeat the brief |
| Durable task progress | Stable task identity, owner, relevant source/worktree, WIP, last verified step, pending external effects, evidence and next action | Interrupt work between steps; resume from records while preserving WIP and distinguishing attempted, accepted and completed operations |
| Ownership transfer | Which agent may write; how a successor receives the task and remaining authority; how conflicting writers are prevented | A successor completes the original task without stale-owner writes, copied submissions or accidental recipient substitution |
| Verification and completion | Which checks establish each acceptance criterion, source/release identity, fixture versus live evidence, and what requires human observation | Run appropriate checks on the integrated revision; detect a deliberately incomplete or stale result rather than declaring success from an acknowledgement |
| Failure reconciliation | Inspect-before-retry rules, bounded retries where safe, treatment of uncertain effects, stop conditions and escalation context | Interrupt after acceptance but before a result; recover without duplicate work or falsely declaring the effect absent |
| Operating limits | Runtime/resource budgets, deadlines, cancellation semantics, cleanup ownership and state-loss behavior | A representative longer run reaches its declared limits, stops or recovers visibly, and preserves records and user data |
| Learning and adoption | Evidence-to-source traceability, disposition, changed acceptance criteria and superseded decisions | A completed experiment updates the relevant source contract and progress, and a new session follows that updated contract |

These are proposed project-operation contracts. They do not require a generic agent framework or new database first. Begin with small versioned records and the existing CLI, skill, verifiers and Git workflow. Automate the parts that repeated use demonstrates are stable.

## Responsibility and authority

Within the task already authorized, an agent can inspect and preserve WIP, select routine implementation details, edit source/docs, run isolated checks, diagnose failures and prepare a reviewable result. It should carry this work to completion rather than repeatedly ask for permission to continue.

The project must also record standing decisions about outcomes, acceptable tradeoffs and which external actions are authorized. Existing authorization carries forward; the agent should ask only when a material decision or authority is genuinely missing. Unknown delivery cannot be resolved by treating elapsed time as approval or by selecting a different conversation.

The user's desired delegation does not by itself demonstrate that a persistent worker will keep running after a conversation ends. A controller with reliable scheduling, ownership, checkpoints and recovery would be a separate implementation. Project orchestration belongs to the project or an external agent controller; Surface Core supplies interaction and runtime mechanisms, consistent with the [vision](../intent/vision.md). Useful autonomy should not depend on moving domain judgment into Core.

## Proposed next sequence

1. **Establish one continuation record for a useful outcome.** Record its source contract, finish condition, existing authority, evidence requirements, selected workspace/installation, current WIP and next action. Keep one active priority. This documentation pass supplies the learning policy and gap assessment; it does not invent a product backlog or completion budget on the user's behalf.
2. **Prove one integrated project loop.** Select one meaningful page change using the adopted interface. Observe an intentional user request, exact-recipient delivery, the source change, relevant checks, browser rendering and updated docs/progress on one identified revision. Reuse existing authorization; use a dedicated fixture for failure injection. Do not combine old runs into a new acceptance claim.
3. **Interrupt and resume that same task.** Preserve a draft before submission; exercise an unavailable recipient; interrupt after fixture acceptance but before result publication; let a fresh session reconstruct the next action from the continuation record. Preserve submitted request identity and reconcile before any successor action. Record every manual intervention and its cause.
4. **Automate repeated coordination.** From those failures, implement only the missing checkpoint, verification, scheduling or recovery behavior. Adopt shared backends, sync or recipient controls only when needed for the chosen outcome and after their contracts are updated.
5. **Broaden the operating envelope.** Once the loop repeats reliably, establish explicit workload and duration targets, measure resource use, test installed recovery and define release/rollback policy under the applicable authority.

The first takeover trial passes when a fresh session completes the same bounded objective from repository records, with no repeated user briefing, no duplicate submission or unintended mutation, traceable checks at the final revision, and source docs updated with the result. When it cannot safely continue, it must leave a precise blocked reason, preserved work and the smallest missing decision. That is an observable step toward full automation; a percentage-complete estimate would not be supported by the current evidence.
