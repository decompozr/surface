# Documentation as project source

Surface's `docs/` is the source specification for the project: its intent, adopted behavior, boundaries, and acceptance criteria. Implementation and experiments test and realize that specification. Experiments must feed their findings back into it so the next agent can continue from the repository, without reconstructing the project's decisions from conversations.

This policy follows the September 23, 2026 project direction. It does not make every sentence under `docs/` a requirement: historical evidence, interpretations, proposals, and adopted contracts have different authority.

## Sources and authority

| Record | Purpose | Authority |
| --- | --- | --- |
| [Vision](vision.md) | Outcome, scope, ownership and product principles | Current product intent |
| [Architecture](architecture.md), `implementation/`, `decisions/` | Adopted behavior and its technical boundaries; proposals explicitly labeled | Source specification for implementation |
| [Findings](findings.md), `experiments/` | Observations, interpretation, failures and evidence limits | Evidence for decisions; a passing experiment does not adopt itself |
| [Project autonomy](project-autonomy.md), [readiness](server-readiness.md), [exploration](exploration.md) | Current gaps, priorities and completion gates; historical plans explicitly labeled | Planning context, with proposed work distinguished from adopted scope |
| Code, tests and reproducible verifiers | Executable behavior and checks | Evidence of what the implementation does; differences from the specification must be reconciled |
| Ignored local receipts, logs and screenshots | Detailed evidence with machine/session context | Supporting observations, never the only record of a consequential decision |

Direct user instructions and applicable repository instructions still govern the work. A historical record must not override a newer adopted contract. When code and docs disagree, record the discrepancy and resolve whether the implementation is wrong, the specification has changed, or the evidence is insufficient. Do not silently rewrite intended behavior to match an accidental implementation.

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

Update the relevant source section and the [findings map](findings.md#september-23-synthesis-and-disposition) together. Preserve the old experiment's observations and add a follow-up pointer rather than rewriting its history. Update current progress statements that the result supersedes. A source change should explain the behavior it requires and its acceptance criterion, not merely list code that was added.

## Completion checklist

An experiment is closed when its question has a bounded answer, its evidence and limits are recorded, and its lesson has a linked source disposition. An inconclusive or failed run can satisfy this rule; it must name the unresolved question or rejected approach. A hypothesis with code but no observed run remains unverified work.

A product increment is complete only for its stated scope. Record separately: source adopted, code implemented, relevant checks passed at a specified revision, installed behavior observed, and user acceptance where needed. A historical green run cannot establish that today's WIP, a different release, or another environment passes.

Keep records sufficient for continuation: objective, source links, current revision/WIP, completed gates, unresolved work and next permitted action. A future agent should be able to tell whether it should implement, verify, reconcile, or wait for a genuinely missing decision. Do not require it to infer progress from a test count or a merged branch.
