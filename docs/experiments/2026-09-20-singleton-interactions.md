# Singleton component-to-agent interaction experiment

Date: September 20, 2026 (America/Toronto).

Status: the deterministic fixture/browser integration suite, lifecycle race regressions, and separate live idle/active callbacks passed. The implementation remains an experiment, not production delivery.

## Question

Can the preferred singleton host preserve the original exact-session interaction semantics while serving independently mounted Svelte components, retaining useful HMR state, and keeping neighboring previews usable?

The earlier [live interaction proof](original-prototype.md) and [singleton rendering experiment](2026-09-20-singleton-namespaces.md) established separate parts. They did not establish this integrated path.

## Integration under test

One singleton serves mount management, interaction management, generated component previews, and Vite's development module/HMR traffic. It reuses the existing durable interaction service and Codex adapter. It does not launch a frontend development process per mount or create an agent conversation when delivery fails.

A mount records its canonical source and canonical project root. `mount --project` selects the root; omitted `--project` defaults to the source. Nested component folders must name the agent session's repository root explicitly. The source must remain inside that project, and an existing namespace/mount name cannot silently switch identities.

A request records namespace, mount name, source, project root, and selected component. Its binding must match the same project root. A ready discovered component receives a request-specific preview URL and uses `createArtifactClient` from `virtual:artifact-client`. CLI request management is available through the separate singleton entry point; the installed root `artifact` CLI retains the older topology.

The interaction API uses per-request capabilities on namespace/mount-scoped routes. Request enumeration, binding, mount management, result publication, and closing require management authorization. A request token cannot authorize a different request merely by changing IDs. This is routing/authorization behavior for trusted local previews, not isolation between hostile same-origin scripts.

## Lifecycle contract

| Event | Expected behavior |
| --- | --- |
| Component HMR | Opted-in `previewState` retains unsent drafts; ordinary local state is not guaranteed. |
| Browser reload after submission | `read()` restores durable response/result without resubmission; preview-session stores reset. |
| Same response ID and same payload repeated | Return the existing receipt; do not deliver again. |
| Conflicting repeat or second submission | Reject without a second agent delivery. |
| Failed/unknown delivery | Preserve the outcome for inspection; do not retry automatically. |
| Service interruption during delivery | Restore the pending record as `unknown`; require reconciliation. |
| Close | Block a new submission; preserve history and already running work; allow an administrative result for a submitted request. |
| Unmount | Block page reads/new submissions; retain records and in-flight delivery; keep administrative inspection/result/close available. |
| Remount original identity/component | Restore page access to the existing interaction under the current origin. |
| Local compiler error | Show the mount-scoped diagnostic and retain neighboring preview interactivity; shared compiler/process limitations remain. |

Closing and unmounting are not cancellation protocols. Result publication remains separate from observing that the browser displayed the result. Fixture and automated inputs are not personal user choices.

## Verification evidence

### Deterministic fixture and browser run

The final run of `bun run verify:singleton-interactions` passed using an explicitly deterministic adapter. It created two namespaces, mounted a nested source under its canonical project root, and exercised the reusable [interaction fixture](../../tests/e2e/runtime/fixtures/InteractionForm.svelte) in Chrome.

Observed outcomes:

- An unsent opted-in draft survived an HMR edit. A deliberate Alpha compile error was scoped to its preview while Beta remained able to submit. Correcting Alpha restored the form, and an actual CLI publication appeared in the browser.
- An exact repeat returned the existing receipt without another delivery. Changed data with the same ID and a new submission ID were rejected. Reload restored the receipt/result without resending.
- Wrong mount scope, wrong request token, and attempts to use a request capability for management, result publication, or closing were denied.
- Unmount blocked page access, administrative inspection/publication remained available, and remount restored the original interaction. A closed request blocked a new submission. Failed and unknown fixture outcomes did not cause automatic retries.
- An explicit server restart restored the persisted result in the browser.

Screenshots (`roundtrip-alpha.png`, `independent-beta.png`, and `restored-result.png`) and `result.json` observations are retained locally in ignored `.artifact/singleton-interaction-proof/`. The Alpha result screenshot was also visually inspected. This run did not contact a model session and does not represent a personal user choice.

### Live exact-session callbacks

A separate run reused the existing dedicated Artifact interaction-proof conversation and its matching canonical working directory. It did not create a replacement thread or infer the destination from recent activity.

| Case | Receipt and observed action | Browser observation |
| --- | --- | --- |
| Idle conversation | The adapter returned `start` for the bound thread. An actual `commandExecution` ran the supplied singleton result CLI and exited 0, publishing `singleton-idle-verified`. | Chrome displayed the returned result; reload restored it without resubmission. |
| Active turn | The adapter returned `steer`, matching the deliberately prepared active turn in that same thread. An actual `commandExecution` ran the supplied singleton result CLI and exited 0, publishing `singleton-active-verified`. | Chrome displayed the returned result; reload restored it without resubmission. |

A neighboring namespace stayed clickable in both cases, using the same Vite middleware instance. Private receipts and `idle-result.png` / `active-result.png` screenshots are retained in ignored `.artifact/singleton-live/`. The test server was stopped in cleanup. These were automated browser submissions, not selections made by the user. The evidence separately covers adapter acceptance, observed agent command execution, persisted results, and rendered display; result authorization alone does not attest model authorship.

### Review findings and lifecycle regression checks

Review identified lifecycle windows that needed explicit treatment. Unmount now revokes admission before awaiting watcher cleanup. Binding and delivery operations are tracked and drained before shutdown releases the single-writer lock. Concurrent stop calls share that same completion promise. The CLI forwards interaction arguments correctly when options precede the command, including the state directory.

The final fixture run observed that a response body begun before unmount but completed afterward returned 409 without delivery. During a deliberately pending delivery, graceful shutdown retained the state lock until the operation finished; the accepted receipt survived restart. Independent review also exercised binding-operation draining, delayed request creation/new binding rejection with 503 after shutdown began, absence of late writes after the lock was released, and both CLI option orders.

Validation passed:

- Root TypeScript check and the root suite: 25 tests / 78 assertions.
- Singleton TypeScript check and the original `bun run verify:singleton` browser suite.
- Final `bun run verify:singleton-interactions` fixture/browser and race suite.
- `bun run test:singleton`: 3 tests / 22 assertions for binding drain, concurrent stop calls, delayed-body rejection, and CLI argument ordering.
- Skill frontmatter validation and local documentation-link checks.

Graceful draining does not establish crash-safe delivery completion. An abrupt stop during an unresolved delivery still restores that record as `unknown` for reconciliation; no automatic retry or exactly-once agent execution guarantee is implied.

## Reproduce and inspect

The [singleton guide](legacy-page-runtime.md#connect-a-mounted-component-to-an-agent) documents mounting, binding, request creation, client imports, administrative inspection/publication, and lifecycle semantics. The [Artifact skill](../../skills/surface/SKILL.md) routes agents to this workflow and keeps the older per-process workflow separately discoverable.

Keep private interaction links, request capabilities, session receipts, logs, and screenshots in ignored `.artifact/` evidence folders. Version the scripts and summary observations, not private state.
