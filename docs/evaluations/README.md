# Evaluation and evidence guide

Requirements describe observable behavior. Design records its presentation and known gaps. Evaluations state how to falsify a claim and which evidence exists. Available code is not a passing run. All commands below are reproduction references; DOCS-TAKEOVER-01 ran only the documentation checks recorded in its [completion](../experiments/docs-takeover/completion.md).

| Contract | Gate | Evidence boundary |
| --- | --- | --- |
| R-01, R-02: independent consumer and route pages | [E-15/E-16 consumer loop](consumer-eval.md#e-15-consumer-boundary) and [E-07 navigation](ui-eval.md#e-07-navigation-and-location) | Generic fixture, live agent and human acceptance are separate |
| R-03, R-04: identities and shared operations | [E-01](runtime-eval.md#e-01-identities-and-shared-operations) | Deterministic/integration checks; not arbitrary relocation |
| R-05: lifecycle | [E-02](runtime-eval.md#e-02-installation-and-lifecycle) | Pinned installed revisions and bounded schema cases |
| R-06: lazy storage | [E-03](runtime-eval.md#e-03-lazy-project-storage) | Explicit operations and lifecycle handles, not generic schema migration |
| R-07: dependencies and HMR | [E-04](runtime-eval.md#e-04-dependencies-diagnostics-and-hmr) | Supported source dependencies and opted-in drafts |
| R-08, R-09, R-11: request/delivery/results | [E-05](runtime-eval.md#e-05-exact-delivery-and-uncertainty), [E-08](ui-eval.md#e-08-delivery-choice) | Fixture RPC/browser versus separately observed live work |
| R-10: recipient change | [E-06](runtime-eval.md#e-06-unsent-takeover), [E-09](ui-eval.md#e-09-recipient-change) | Exact-worktree opt-in and no replay, not general project takeover |
| R-12: setup | [E-13](runtime-eval.md#e-13-source-setup-and-private-access) | Health/link/mapping checks do not prove provider discovery or phone use |
| R-13: continuation | [E-14](consumer-eval.md#e-14-cooperative-continuation) | [One cooperative handoff and independent review passed](../experiments/2026-09-23-docs-takeover.md); broader recovery remains open |
| D-01, D-02 | [E-07](ui-eval.md#e-07-navigation-and-location) | Hierarchy/location and clean links |
| D-03, D-04, D-09 | [E-08–E-10](ui-eval.md#e-08-delivery-choice) | Current transitions versus missing recovery/freshness presentation |
| D-05, D-06 | [E-11](ui-eval.md#e-11-drafts-and-results) | Declared per-page state lifetime and observed outcome |
| D-07, D-08 | [E-12](ui-eval.md#e-12-mobile-and-accessibility) | Viewport fixtures versus assistive technology/device acceptance |

## Recording a run

Record source revision plus relevant WIP/snapshot, selected service/release identity, environment/runtime/browser, exact command, fixture or real participant, expected and observed outcome, retained receipt and failure limits. A result can be pass, fail, inconclusive or not run. “Implemented” and “has a verifier” are not result statuses. Historical counts remain attached to their original experiment, not summed as current coverage.

Verifiers can build/install dependencies, start disposable services, edit fixture sources and launch Chrome. Read each script and run only within the task's authority. They must not target the user's installation or a live conversation as a fixture. The current documentation task authorizes no such runtime work. For future UI reproduction, prepare frozen root/app/fixture dependencies and build the shell as required by the linked verifier; invoke a dedicated disposable environment.

An experiment closes with a bounded answer and source disposition, including failed/inconclusive outcomes. A product journey additionally needs the appropriate integrated and human acceptance evidence. See the [source workflow](../source-workflow.md).
