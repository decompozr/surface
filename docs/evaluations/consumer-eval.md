# Consumer loop and continuation evaluations

## E-14: cooperative continuation

Covers [R-13](../requirements/project-continuation.md#r-13). DOCS-TAKEOVER-01 uses a fresh session with repository path and continuation pointer, no predecessor conversation. Pass for the successor scope if it reconstructs objective/authority, preserves WIP and evidence, fills the actual UI/evaluation gap, runs meaningful doc checks and records remaining limits without repeated briefing or unauthorized effects. Fail if the task is redefined, source evidence is invented, unrelated files/services change, or proposed UI is reported as implemented.

Evidence: [task](../experiments/docs-takeover/task.md), [intake](../experiments/docs-takeover/intake.md), [migration](../experiments/docs-takeover/migration.md), [completion](../experiments/docs-takeover/completion.md) and the final worktree diff. [Coordinator gate 8](../experiments/2026-09-23-docs-takeover.md#independent-review) passed its independent scope, content, intervention and preservation checks. A successor report is not independent review. Abrupt crash recovery, duplicate-effect reconciliation and indefinite autonomous work were not tested.

UI-CONTINUATION-02 additionally exercised a planned pause after UI implementation and before browser acceptance. A fresh-context subagent reconstructed the scope from repository records, repaired fixture context, completed browser checks and updated source. [Independent review](../experiments/ui-continuation/review.md) then caught and corrected a verifier readiness race. This is a bounded cooperative pass with one post-completion coordinator correction, not a zero-intervention or abrupt-crash result.

## E-15: consumer boundary

Covers [R-01/R-02](../requirements/consumers.md). Use a disposable Git project with project-owned route source and declared schema; mount without a DecompozR service or request binding for read-only use. Pass if it renders through returned routes, source/dependencies remain project-owned and Core makes no domain judgment. Add a separate scoped request for submission; clean browsing alone must not imply permission to send.

Available fixture sources: [workspace fixture](../../apps/surface/scripts/workspace-fixture.ts), [navigation verifier](../../apps/surface/scripts/verify-navigation.ts), [interaction verifier](../../apps/surface/scripts/verify-interactions.ts), [public installed verifier](../../scripts/verify-surface.ts). Commands: `bun apps/surface/scripts/verify-navigation.ts`, `bun run --cwd apps/surface verify:interactions`, `bun run verify:surface`, after appropriate isolated preparation. Not executed in this documentation task.

There is no Inquiry-specific acceptance run or adopted Inquiry data/product spec here. A later consumer must supply domain criteria from its own source documents rather than treating these generic fixtures as a domain result.

## E-16: integrated user and agent loop

Covers R-01/R-02/R-08/R-11 and D-05/D-06. Proposed complete journey: identify one release/workspace/page, observe intentional user input, verify exact recipient/mode and saved payload, observe actual agent work and relevant checks, inspect result/source rendering, and record the user's acceptance or unresolved concern. Fail if separate historical install, delivery and screenshot runs are combined into a claim about a single unobserved journey.

Historical [singleton live interaction](../experiments/2026-09-20-singleton-interactions.md), [live source edit](../experiments/2026-09-21-live-source-edit.md) and [release loop](../experiments/2026-09-22-release-loop.md) establish narrower facts. Fresh-user onboarding, current live queue/takeover, device use and full assembled-product acceptance remain open. This gate requires explicit authority for any real conversation or installation effects; it is not a command to perform them during this documentation trial.
