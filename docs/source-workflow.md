# Documentation as project source

Surface's `docs/` is the source specification for the project: its intent, adopted behavior, boundaries, and acceptance criteria. Implementation and experiments test and realize that specification. Experiments must feed their findings back into it so the next agent can continue from the repository, without reconstructing the project's decisions from conversations.

This policy follows the September 23, 2026 project direction. It does not make every sentence under `docs/` a requirement: historical evidence, interpretations, proposals, and adopted contracts have different authority.

## Sources and authority

| Record | Purpose | Authority |
| --- | --- | --- |
| `intent/` | Outcome, scope, ownership and principles | Current product intent |
| `requirements/`, `architecture/`, `decisions/` | Adopted behavior, invariants and choices; proposals explicitly labeled | Source specification for implementation, within recorded status/scope |
| `design/` | Journeys, states, ownership and presentation criteria | Source-backed current behavior plus explicit proposed/unverified criteria; not automatic redesign adoption |
| `evaluations/` | Observable pass/fail gates and traceability | Defines what a claim requires; available verifier does not equal passing result |
| `observations/`, `experiments/` | Measurements, reported feedback, incidents, interpretation and evidence limits | Evidence for decisions; a passing experiment does not adopt itself |
| [Project continuation](requirements/project-continuation.md) and task records | Current objective, ownership, authority and gaps | Planning/task context; historical plans and future proposals do not override the active task |
| Code, tests and reproducible verifiers | Executable behavior and checks | Evidence of implementation; differences from the specification must be reconciled |
| Ignored receipts, logs and screenshots | Detailed machine/session context | Supporting observations, never the only record of a consequential decision |

Direct user instructions and applicable repository instructions still govern the work. Use [docs/README.md](README.md) for the canonical reading paths and migration map. A historical record must not override a newer adopted contract. When code and docs disagree, record the discrepancy and resolve whether the implementation is wrong, the specification has changed, or the evidence is insufficient. Do not silently rewrite intended behavior to match an accidental implementation.

## Close the learning loop

```text
Source intent and open question
  -> Small experiment with a falsifiable acceptance gate
  -> Observed result and limits
  -> Interpretation and disposition
  -> Reviewable source-specification change
  -> Implementation and relevant validation
  -> Updated progress and next question
```

Before an experiment, identify the source section or unresolved decision it tests. After it, record what actually happened, including failures and excluded cases. Link the executable verifier, source revision, environment and retained evidence. Label fixture input, live-agent action and human acceptance separately.

Give each consequential finding a disposition: incorporated into an existing contract, proposed for adoption, retained as experimental, rejected, superseded, or unresolved. Incorporation within authorized scope can proceed without another approval round. An experiment does not expand authorization to deploy, contact a real conversation, or alter the user's installation.

Update the relevant source section and the [findings map](observations/findings.md#september-23-synthesis-and-disposition) together. Preserve the old experiment's observations and add a follow-up pointer rather than rewriting its history. Update current progress statements that the result supersedes. A source change should explain the behavior it requires and its acceptance criterion, not merely list code that was added.

## Completion checklist

An experiment is closed when its question has a bounded answer, its evidence and limits are recorded, and its lesson has a linked source disposition. An inconclusive or failed run can satisfy this rule; it must name the unresolved question or rejected approach. A hypothesis with code but no observed run remains unverified work.

A product increment is complete only for its stated scope. Record separately: source adopted, code implemented, relevant checks passed at a specified revision, installed behavior observed, and user acceptance where needed. A historical green run cannot establish that today's WIP, a different release, or another environment passes.

Keep records sufficient for continuation: objective, source links, current revision/WIP, completed gates, unresolved work and next permitted action. A future agent should be able to tell whether it should implement, verify, reconcile, or wait for a genuinely missing decision. Do not require it to infer progress from a test count or a merged branch.

## Continuation evidence

[DOCS-TAKEOVER-01](experiments/2026-09-23-docs-takeover.md) demonstrated one fresh-session continuation using a repository checkpoint, with independent review. For a similar handoff, record the exact source baseline and WIP, objective and acceptance gates, existing authority, evidence limits, active writer, pending effects and next action. Ask the successor to record its reconstruction before substantive edits. Keep predecessor input, successor completion and independent review separate; update current status when review finishes so another session does not repeat completed work.

This is a bounded working method, not proof of automatic recovery after a crash or uncertain mutation. Those cases need their own fixture experiments and reconciliation evidence.

## UI/UX completion gate

Every UI/UX change automatically requires a visual and interaction audit before delivery. Functional/E2E success is necessary where relevant but never substitutes for judging the rendered experience. Capture the affected flow at phone and desktop sizes, inspect hierarchy, spacing, overlap, readable labels, touch targets, focus, scrolling, empty/error/waiting states and keyboard-constrained space. Fix findings, then capture and inspect the changed states again. Repeat until the scoped issues are resolved; report remaining limits honestly. Preserve screenshots and a brief findings/disposition record. Do not advance unrelated feature work while a requested audit is unfinished.

Visual acceptance must compare the actual shipped routes against the existing approved design, not only a test-only component page. For shell changes, inspect the service home, a normal mounted page, navigation open/closed and the comment editor with keyboard-constrained space on phone and desktop. Verify the same brand mark, compact hierarchy, intentional content start position and pointer-versus-keyboard focus appearance. Record functional and visual outcomes separately: passing target-size, overflow or interaction assertions does not establish acceptable density or spacing. An unexplained missing brand, large spacer or heavy persistent touch-focus treatment is a finding to resolve before delivery.
