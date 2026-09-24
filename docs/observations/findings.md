# Consolidated findings

Current commands and defaults in this document use Surface after [Decision 0002](../decisions/0002-surface-name-and-local-state.md). Earlier checkpoints and experiment records retain their original Artifact names, commands, and evidence paths; renaming does not constitute a new verification run.

Historical synthesis updated September 21, 2026 (America/Toronto), including the completed seven-track readiness exploration. September 23 source dispositions below supersede its present-tense progress claims. See the [implementation recommendation](../experiments/first-server-readiness.md). Earlier rendering/state checkpoint: `c6abf5f`. This records executable experiments and the user's intended direction, not a finalized production architecture. The detailed experiment records remain the source for each observation.

## September 23 synthesis and disposition

Reconciled at source baseline `7fceefc` for DOCS-TAKEOVER-01. This is a review of records and current code, not a fresh runtime run. Current requirements and design live in their categories; the September 20–21 narrative below remains historical evidence.

| Evidence / finding | Disposition | Current source and remaining limit |
| --- | --- | --- |
| [Original prototype](../experiments/original-prototype.md), [singleton interaction](../experiments/2026-09-20-singleton-interactions.md), [live source edit](../experiments/2026-09-21-live-source-edit.md): exact identity and distinct outcome stages | Incorporated | [Interaction requirements](../requirements/agent-interaction.md), [D-06](../design/interactions.md#d-06-evidence-of-a-result). Earlier live runs do not prove current queue/takeover or human acceptance. |
| [Namespaces](../experiments/2026-09-20-singleton-namespaces.md), [dependencies](../experiments/2026-09-21-dependencies.md), [Kit foundation](../experiments/2026-09-21-sveltekit-foundation.md): symlinks need a host and browser execution matters | Incorporated within bounded Svelte topology | [Components](../architecture/components.md), [R-02/R-07](../requirements/runtime.md). Arbitrary mounted apps/SSR/frameworks excluded. |
| [Scoped HMR](../experiments/2026-09-20-scoped-hmr.md): source updates and draft retention differ | Incorporated | [D-05](../design/interactions.md#d-05-draft-ownership), [E-11](../evaluations/ui-eval.md#e-11-drafts-and-results). No universal refresh/takeover draft persistence. |
| [Project operations](../architecture/project-operations.md#verification-record), [workspaces](../experiments/2026-09-21-workspaces.md): identity/operations share authority across transports | Incorporated | [Project operations](../architecture/project-operations.md), [workspace service](../architecture/workspace-service.md). Source merging does not merge data or transfer requests. |
| [Installation](../experiments/2026-09-21-installation.md), [server contract](../experiments/2026-09-21-server-contract.md), [database](../experiments/2026-09-21-project-database.md): separate releases/state/data and acquire storage lazily | Incorporated bounded contracts | [Lifecycle](../architecture/lifecycle.md), [lazy storage](../architecture/installation-lifecycle.md). General store migrations remain unresolved. |
| [Release](../experiments/2026-09-22-release-loop.md), [setup](../experiments/2026-09-22-agent-setup.md): installation and user discovery need separate evidence | Incorporated | [R-12](../requirements/runtime.md), [E-13](../evaluations/runtime-eval.md#e-13-source-setup-and-private-access). Installation is delivered; fresh-user assembled-loop acceptance remains open. |
| [Resource telemetry](../experiments/2026-09-21-lifecycle-resources.md): released resources do not mean evicted compiler metadata | Correction retained; operating policy unresolved | [Runtime gaps](../requirements/runtime.md#open-work-and-excluded-claims), [E-04](../evaluations/runtime-eval.md#e-04-dependencies-diagnostics-and-hmr). No indefinite uptime claim. |
| [Multiple views](../experiments/2026-09-21-multi-surface.md) and [synchronization](../experiments/2026-09-21-surface-sync.md) | Retained as experimental | No ordinary-runtime adoption. Shared backend lifetime, invalidation/snapshot handling and dirty-draft reconciliation need an adoption decision. |
| Current [navigation](../../apps/surface/src/server/navigation.ts), [recipient panel](../../apps/surface/src/lib/components/RecipientPanel.svelte) and [service](../../apps/surface/src/core/service.ts) | Current adopted behavior documented; older “all picker controls experimental” claim superseded | [R-09/R-10](../requirements/agent-interaction.md#requirement-index), [design](../design/README.md). New fixture sources are available; this pass ran no browser/live validation. The [separate picker lab](../../experiments/agent-picker/README.md) remains experimental. |
| Current [CLI send](../../apps/surface/src/cli/index.ts) passes response ID/data without delivery intent | Documented transport limitation | [CLI interaction boundary](../requirements/agent-interaction.md#cli-and-backend-integration): idle compatibility path only; active queue/steer requires the request page/client. No CLI flags or code fix invented. |
| Earlier comments work and absent September 23 source records mentioned in [reflection input](2026-09-23-reflection-input.md) | Unresolved / retained as prior interpretation | No implementation import, invented source record or comments adoption. |
| Missing UI docs and fragmented current/historical progress, recorded in [trial task](../experiments/docs-takeover/task.md) | Documentation organization incorporated; bounded trial and independent review passed | [Decision 0003](../decisions/0003-source-documentation-organization.md), [UI/evaluation contracts](../design/README.md), [completion](../experiments/docs-takeover/completion.md), [independent outcome](../experiments/2026-09-23-docs-takeover.md). One prepared cooperative handoff is not full autonomy. |

### UI-CONTINUATION-02 follow-up

[Phase B completion](../experiments/ui-continuation/completion.md) records the keyboard-bypass implementation and actual Chrome fixture acceptance at 1440/390/320px. Disposition: incorporated into [D-08](../design/accessibility.md#d-08-accessibility-criteria) and the bounded [E-12](../evaluations/ui-eval.md#e-12-mobile-and-accessibility) skip gate. The first run exposed an invalid fabricated request in the verifier; it was corrected to a disposable request with its real query/fragment, without changing runtime authorization. Navigation and recipient regressions passed. Broader accessibility and human/device acceptance remain open.

The successor reconstructed scope from repository records and completed Phase B after a planned interruption. This supports another bounded cooperative continuation; [independent coordinator review](../experiments/ui-continuation/review.md) passed after finding and correcting a verifier readiness race. It does not establish crash recovery or automatic scheduling.

## Historical synthesis boundary

The sections below retain the original observations and checkpoint-level conclusions, including statements that the public entry or remote access was future work at that time. Use the current dispositions above for present behavior. No old pass count was refreshed by this reorganization.

## Intended direction

Start or connect to one local singleton server, create a namespace for a project or problem, then mount ordinary source folders through symlinks. Mounting should prepare declared project dependencies, discover components, and render them through shared compilation infrastructure. Sources, manifests, and lockfiles stay project-owned. Agents should perform this workflow through CLI plus skills, with a thin MCP adapter exposing the same singleton operations.

A page should send structured input back to the agent session that created its interaction. The adapter should steer an active turn or continue the same idle conversation. It must not silently create a replacement conversation or choose whichever session was most recently active.

These are the intended product behaviors. Bun, shared Vite, pinned Svelte, local JSON storage, command names, and the current preview-state helper are experimental implementation choices. Framework-neutral support remains a long-term goal; it is not established by the Svelte pilot. On September 21, the user narrowed current experiments to Svelte, deferred adding a second framework, and proposed trying SvelteKit as the singleton application foundation.

## Evidence map

| Checkpoint | What was observed | Boundary |
| --- | --- | --- |
| `79f72bd`: [original interaction prototype](../experiments/original-prototype.md#validation-on-2026-09-20) | Browser input reached an exact live Codex conversation through active steering and idle continuation. The agent ran the result CLI and the browser displayed the result. | Bundled Svelte page, local macOS and Codex 0.154.0; not the singleton host. |
| `88b80c5`: [external projects](../experiments/2026-09-20-external-projects.md) | External Svelte/vanilla forms, custom schemas, CLI result publication, reload restoration, lifecycle cleanup, and an independent agent following the skill. | These new runs used a fixture adapter. Each frontend had its own development process. |
| `181243c`: [singleton namespaces](../experiments/2026-09-20-singleton-namespaces.md) | One server and Vite instance hosted symlinked components in two namespaces, installed missing dependencies, executed two nanoid versions, and restored mounts after restart. | Svelte 5.57.1 and browser-ready ESM; no agent delivery in this pilot. |
| `c6abf5f`: [scoped errors and HMR](../experiments/2026-09-20-scoped-hmr.md) | Mount-scoped error UI, a usable neighboring preview during failure, live catalog/props updates, and explicit counter/draft state retention through edits and error recovery. | UI isolation and opt-in state preservation; no compiler-process or browser-origin isolation. |

Two executable paths currently coexist. The root `surface` CLI implements the earlier external-process and interaction workflow. `bun run singleton` runs the separate preferred-topology experiment. The singleton now reuses the interaction core and Codex adapter, while the two CLI entry points remain separate experiments. The skill now teaches the integrated singleton interaction workflow as well as identifying the earlier process-based path.

## What we learned

### Mounting requires a host layer

A symlink supplies source indirection, not a complete frontend runtime. Surface still needs canonical source identity, registration, dependency preparation, discovery, generated entries, props, diagnostics, and lifecycle management. Vite supplies transformation, module resolution, watching, and HMR.

The singleton generated working component hosts without a source project `index.html` or development command. Generated JavaScript entries must use an appropriate module identity: an early `.svelte` suffix made the plugin parse host JavaScript as component source; `.entry.js` fixed that failure.

Unmounting revoked the mount's preview/source routes and removed its symlink while keeping sources, dependencies, and the shared server. Remounting retained the namespace URL under the same origin. Restart restored registered mounts from saved definitions. These observations do not establish an OS-managed background service or stable URLs across changed origins.

### Project dependency resolution is feasible within a defined boundary

Realpath resolution (`preserveSymlinks: false`) let mounted source load nanoid 4.0.2 and 5.1.5 from separate project-owned `node_modules` trees. Browser checks executed both implementations and recorded module URLs. Merely installing two projects would not have established this.

The shared Svelte compiler/plugin/runtime remains pinned; independent Svelte versions and per-project Vite configurations are unproved. Automatic dependency optimization remains disabled. A follow-up implements explicit source-scoped JavaScript prebundles, executes distinct lodash versions, and verifies mixed ESM/CommonJS entries. Native installation requirements, general monorepo resolution, other frameworks, arbitrary mounted SvelteKit applications, and mounted SSR remain unsupported or unproved. The built SvelteKit management shell is separately verified.

Automatic preparation uses declared manifests, not guessed imports. It runs Bun with lifecycle scripts disabled, freezes an existing Bun lockfile, and creates one when absent. Non-Bun lockfiles are rejected. Dependency edits currently require explicit reconciliation and remounting; they do not trigger an unattended install loop. A failed installation is a visible mount outcome and did not stop healthy previews.

### HMR and state preservation are different properties

A document can survive HMR while component-local state resets. That happened with ordinary Svelte `$state` in the initial singleton run. The follow-up keeps important state outside the component lifecycle through `previewState(key, initial, version)` and Vite HMR data.

Opted-in counters and drafts survived markup/CSS changes, compiler-error recovery, and reactive host-prop updates. Catalog additions/removals did not reload existing previews. Bumping one state key's version reset only that key; a full page refresh reset the preview session. Authors choose stable keys and compatibility versions. Arbitrary local state, focus, selection, effects, and resources are not automatically preserved or migrated.

The initial shared Vite overlay obscured other namespaces. The follow-up attributes errors to mounts and displays a scoped panel while retaining the last successful rendering. The neighboring preview remained clickable during the error. This is a UX improvement: the compiler, WebSocket, diagnostic transport, and browser origin remain shared. Runtime exceptions, compiler crashes, and untrusted-code isolation require different treatment.

### Delivery, completion, and user acceptance need separate evidence

The live adapter used the existing Codex App Server Unix WebSocket, with compression disabled. It exercised `turn/steer` and same-thread `turn/start`; `codex queue` help inspection did not establish that command's steering or activation behavior. The shared Codex daemon was not restarted or reconfigured.

A saved submission, runtime acceptance, observed agent action, published result, browser display, and personal user acceptance are different outcomes. The screenshot confirmation for option B at width 160 came from an automated browser test, not a choice made by the user. It was valid test evidence, not personal approval.

The first idle callback failed because the target agent session could receive input but could not contact the local API. A dedicated test session with appropriate networking subsequently completed the loop. Message delivery does not establish callback reachability; Surface does not change a session's permissions.

Repeated submissions with the same response ID and data are deduplicated. Conflicting repeats are rejected. Ambiguous transport outcomes remain visible as unknown instead of triggering blind retries. This does not promise exactly-once agent execution. Result publication through a local credential is also not cryptographic proof of model authorship; the live proof separately observed the actual agent command.

### CLI, skills, and MCP have distinct roles

The CLI makes operations executable and inspectable. The skill teaches agents how to create sources, mount them, bind an exact session, interpret receipts, publish results, and recover from failures. An independent agent completed that workflow with a fixture binding, supporting basic usability without claiming another live model-delivery proof.

MCP can expose the same core operations for discovery and invocation. It does not itself wake an agent; the runtime-specific delivery adapter does that. The stdio MCP experiment now wraps these operations and passes real SDK client/CLI interoperability, including restart discovery and truthful unknown outcomes. It connects to an existing service; it does not start one. Installation additionally verifies the installed MCP dependencies and entry point against the installed host.

### Rendering and lifecycle checks need direct observations

HTTP readiness alone does not establish successful compilation, browser behavior, type checking, or production builds. The external experiment separately checked both starters and browser interactions; its automated suite checkpoint was 25 tests and 78 assertions. The singleton follow-up passed its own TypeScript check and browser verification.

The earlier process supervisor covered normal stop, stop/remount ordering, and manager-crash cleanup. Those observations belong to that topology, not an untested singleton crash-recovery guarantee. All experiments assume trusted local source. Namespace names organize mounts; they are not security boundaries.

## Completed gate: one singleton-to-agent round trip

The [integration experiment](../experiments/2026-09-20-singleton-interactions.md) completed this scoped gate: fixture/browser checks passed, and separate live idle and active runs returned actual agent CLI results to the singleton page. The acceptance criteria below record the gate; they do not establish general support across agent runtimes.

Acceptance criteria:

1. Start one server, create two namespaces, and mount an external Svelte component folder with automatic dependency preparation. Retain the singleton process/Vite checks.
2. Bind one interaction to its canonical project, namespace, mount, and exact existing agent session. Define how a mounted subfolder maps to the agent's project root; do not equate namespace text with project identity.
3. Submit a custom form from that component. Persist the data and expose distinct delivery/result states. A different mount must not gain management access or retrieve another interaction merely by changing identifiers. Test request authorization explicitly; shared-origin pages remain trusted and are not security sandboxes.
4. First use a fixture adapter for repeatable browser/API regression checks, then record separate live active-turn and idle-conversation runs. Verify the agent's actual result CLI invocation and display its returned data in the originating page. No replacement conversation is created.
5. Keep unsent opted-in draft state through an ordinary HMR edit. Reload a submitted page and restore its persisted interaction status/result without submitting again. Do not confuse durable request records with ephemeral preview state.
6. Exercise duplicate submission, unavailable session, uncertain delivery, closed request, and unmounted page outcomes. Establish whether closing/unmounting cancels, preserves, or blocks pending interaction access rather than inheriting an accidental behavior.
7. Keep the second namespace interactive throughout local compile failure and request processing. Record any shared infrastructure limitations.
8. Update CLI usage and the skill around the actual integrated workflow. Retain reproducible checks and distinguish automated inputs from user choices.

The September 21 follow-ups completed these bounded experiments, plus repository installation and project artifact management. The [readiness review](../experiments/first-server-readiness.md) maps each result and proposes the first server implementation sequence. A three-minute resource run is not long-duration stability evidence. OS service integration, durable preview-state policy, remote access, and broader isolation remain later work; completing experiments does not mean the production server has been built.

## Integration follow-up lessons

The joined workflow retains canonical project identity separately from namespace labels. A nested source folder must identify its owning project root with `mount --project`; the binding must match that root. Each request also records its mount and component, and page capabilities use a mount-scoped API path. A request token cannot authorize management or another request by changing an ID; shared-origin scripts remain within the same trust boundary.

Unmounting revokes page access and new submissions while preserving receipts and ongoing agent work. Administrative inspection and result publication remain available for reconciliation. Remounting the same identity/component restores page access. Closing blocks new submissions and preserves historical records; neither close nor unmount cancels an agent turn.

Review found two asynchronous admission issues: unmount needed to change status before awaiting watcher cleanup, and shutdown needed to drain binding inspection as well as delivery before releasing the state lock. The fixes and regression checks prevent late writes and post-unmount submissions. CLI option forwarding also now preserves a state directory supplied before the command.

The original live proof used a bundled page. The follow-up reused the exact dedicated conversation and observed singleton browser input, idle continuation or exact-turn steering, the agent's successful result CLI command, browser display, and reload restoration. Automated inputs remain explicitly labeled; this is not personal user approval.

## September 21 follow-up lessons

The [dependency experiment](../experiments/2026-09-21-dependencies.md) reproduced a browser failure that compilation readiness alone missed. Explicit JavaScript-only bundles preserve source-specific versions, with unsupported asset output and Node builtins rejected; native module compatibility remains outside the tested contract. It also found that a non-HTML Vite full-reload path refreshed unrelated previews; a mount-scoped custom event corrected that behavior.

The [SvelteKit experiment](../experiments/2026-09-21-sveltekit-foundation.md) combines a prebuilt management shell with the live compiler in one process/listener. Management SSR does not imply mounted-component SSR. The [live source-edit experiment](../experiments/2026-09-21-live-source-edit.md) separately observed the exact agent changing a layout from one column to two, a successful callback, and retained document/draft state.

The [resource experiment](../experiments/2026-09-21-lifecycle-resources.md) found and fixed active watcher/filesystem access retained after an initial compile failure. Across 30 cycles over 180.115 seconds, repeated identities stabilized and all owned descendants exited; distinct sources retained Vite/Chokidar metadata. Unbounded source churn needs a resource budget and restart/recreation policy, not unsupported deletion of compiler internals.

[Repository lifecycle](../experiments/2026-09-21-installation.md) now separates pinned release payloads from durable state and project-owned files. Authenticated ownership controls stop; saved PID liveness alone never authorizes killing. Upgrade retains callback executables; uninstall refuses unresolved callbacks. Rollback is proven for equal-schema commits, not schema migration.

[Project management](../experiments/2026-09-21-project-artifacts.md) separates UUID identity from labels and paths. A project manifest owns artifact definitions, while a server-local ledger binds IDs to canonical roots. Both project and ledger writer locks are necessary. Archive/restore preserves source and dependencies; relocation and crash-atomic multi-step reconciliation remain explicit design work.

## Reproduction and evidence retention

- [Singleton commands and verification](../../apps/surface/runtime/README.md#reproduce-the-experiment): install root/experiment dependencies, run the experiment type check and `bun run verify:singleton`.
- [Singleton interaction verification](../experiments/2026-09-20-singleton-interactions.md): `bun run verify:singleton-interactions`, using deterministic fixtures separately from live-session checks.
- [External workflow](../experiments/legacy-workflow.md): earlier CLI/skill setup and `bun run verify:external`.
- [Original live proof](../experiments/original-prototype.md): exact-session setup, delivery limits, and recorded live outcomes. Automated fixture suites do not contact a model session.

Versioned scripts and experiment records make the observations reviewable. New local screenshots, receipts, and diagnostic logs use ignored `.decompozr/surface/` directories; earlier runs used `.artifact/` or `.decompozr/artifact/`. These records are not portable public evidence. The earlier consolidation recorded existing checkpoints. The linked integration follow-up records the subsequent fresh core, singleton, fixture/browser, review, and live-session checks separately.


## Comments worktree reconciliation — September 23

The current comments prototype was preserved in commit `f5daafc` before integrating main `6dd9083`. The [comment experiment](../experiments/2026-09-23-element-comments.md) retains its live user-submission evidence, private-preview changes, fixture checks and unverified browser acceptance. Its experimental interaction contract is retained in [agent interaction](../requirements/agent-interaction.md#contextual-comment-batches--experimental). The [earlier recipient experiment](../experiments/2026-09-23-agent-recipient.md) remains historical evidence; current recipient behavior follows the canonical requirements. This reconciliation does not adopt the comment playground as a public runtime feature.

### Application consolidation

The user requested completing the move into apps/surface. Root production source/tests/templates and the adopted singleton/MCP/comment modules moved into the application, with imports, command paths, setup/release tooling and source links updated. The application boundary test passes. Core, host/runtime/comment tests, desktop/mobile navigation and isolated full-loop browser checks are the acceptance gates. Existing shared installation and unrelated working-tree changes are preserved. See [ownership](../architecture/components.md#surface-application-ownership-september-23-consolidation).

Final consolidation validation passed: 78 core tests and 20 host/runtime/comment tests; root, application core and Svelte checks; production build; real browser navigation; MCP transport and project lifecycle verification; isolated desktop/mobile full-loop comment delivery and SSE replies; and three-profile interaction checks (desktop Chromium, touch Chromium, mobile WebKit). No fixture was sent to a real conversation. The private preview was restarted from an immutable build snapshot. No commit or shared installation update was performed. Physical-device acceptance remains separate.


### Design-system chrome consumer

Disposition: incorporated in the [chrome consumer contract](../design/README.md#surface-chrome-consumer-contract). Surface now consumes real package controls and shared visual tokens across its navbar, route navigation, recipient panel and comment chrome, preserving project content and submission semantics. Browser review led to a bounded composer layout fix so expanded touch controls remain visible. A mounted-page regression exposed missing runtime asset permissions; published package assets and exact version metadata are now allowed while design-system source files remain denied.

Type checks, build, twenty host/runtime/comment tests, three-profile comment interaction checks, Chrome navigation and isolated desktop/mobile delivery/SSE recovery passed. Screenshots were inspected. See the [dated checkpoint](../experiments/2026-09-23-element-comments.md#design-system-chrome-migration) for limits and evidence. This is source/WIP validation; the existing private preview and recipient remain unchanged, and physical-device/human acceptance is separate.


Follow-up: user feedback removed the redundant Workspace tag from the header. The current private preview now serves the migrated chrome and simplified header from an immutable release; live HTTPS rendering was inspected in Chrome. The connection/recipient is unchanged. See [preview update](../experiments/2026-09-23-element-comments.md#header-simplification-and-private-preview-update).


### By-the-way comment preference — September 23

The user selected immediate Steer as conversational input: acknowledge promptly, retain the original task and let the agent state its processing order. Queue remains an alternative. This is adopted for the comment experiment in [agent interaction](../requirements/agent-interaction.md#by-the-way-comments-user-selected-follow-up). Transport delivery, agent acknowledgement and completed output remain separate. Browser/provider-fixture evidence is recorded in [the follow-up](../experiments/2026-09-23-by-the-way-comments.md); model behavior and physical-device acceptance are separate gates.
