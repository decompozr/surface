# Findings and next experiment

Consolidated on September 20, 2026 (America/Toronto). Evidence checkpoint: `c6abf5f`. This records executable experiments and the user's intended direction, not a finalized production architecture. The detailed experiment records remain the source for each observation.

## Intended direction

Start or connect to one local singleton server, create a namespace for a project or problem, then mount ordinary source folders through symlinks. Mounting should prepare declared project dependencies, discover components, and render them through shared compilation infrastructure. Sources, manifests, and lockfiles stay project-owned. Agents should perform this workflow through CLI plus skills, with MCP exposing the same operations later.

A page should send structured input back to the agent session that created its interaction. The adapter should steer an active turn or continue the same idle conversation. It must not silently create a replacement conversation or choose whichever session was most recently active.

These are the intended product behaviors. Bun, shared Vite, pinned Svelte, local JSON storage, command names, and the current preview-state helper are experimental implementation choices. Framework-neutral support remains a goal; it is not established by the Svelte pilot.

## Evidence map

| Checkpoint | What was observed | Boundary |
| --- | --- | --- |
| `79f72bd`: [original interaction prototype](prototype.md#validation-on-2026-09-20) | Browser input reached an exact live Codex conversation through active steering and idle continuation. The agent ran the result CLI and the browser displayed the result. | Bundled Svelte page, local macOS and Codex 0.154.0; not the singleton host. |
| `88b80c5`: [external projects](experiments/2026-09-20-external-projects.md) | External Svelte/vanilla forms, custom schemas, CLI result publication, reload restoration, lifecycle cleanup, and an independent agent following the skill. | These new runs used a fixture adapter. Each frontend had its own development process. |
| `181243c`: [singleton namespaces](experiments/2026-09-20-singleton-namespaces.md) | One server and Vite instance hosted symlinked components in two namespaces, installed missing dependencies, executed two nanoid versions, and restored mounts after restart. | Svelte 5.57.1 and browser-ready ESM; no agent delivery in this pilot. |
| `c6abf5f`: [scoped errors and HMR](experiments/2026-09-20-scoped-hmr.md) | Mount-scoped error UI, a usable neighboring preview during failure, live catalog/props updates, and explicit counter/draft state retention through edits and error recovery. | UI isolation and opt-in state preservation; no compiler-process or browser-origin isolation. |

Two executable paths currently coexist. The root `artifact` CLI implements the earlier external-process and interaction workflow. `bun run singleton` runs the separate preferred-topology experiment. They are not yet one integrated product. The skill points to the singleton pilot when that topology is requested; its complete interaction workflow still follows the earlier CLI.

## What we learned

### Mounting requires a host layer

A symlink supplies source indirection, not a complete frontend runtime. Artifact still needs canonical source identity, registration, dependency preparation, discovery, generated entries, props, diagnostics, and lifecycle management. Vite supplies transformation, module resolution, watching, and HMR.

The singleton generated working component hosts without a source project `index.html` or development command. Generated JavaScript entries must use an appropriate module identity: an early `.svelte` suffix made the plugin parse host JavaScript as component source; `.entry.js` fixed that failure.

Unmounting revoked the mount's preview/source routes and removed its symlink while keeping sources, dependencies, and the shared server. Remounting retained the namespace URL under the same origin. Restart restored registered mounts from saved definitions. These observations do not establish an OS-managed background service or stable URLs across changed origins.

### Project dependency resolution is feasible within a defined boundary

Realpath resolution (`preserveSymlinks: false`) let mounted source load nanoid 4.0.2 and 5.1.5 from separate project-owned `node_modules` trees. Browser checks executed both implementations and recorded module URLs. Merely installing two projects would not have established this.

The shared Svelte compiler/plugin/runtime remains pinned; independent Svelte versions and per-project Vite configurations are unproved. Dependency prebundling is disabled in the pilot. CommonJS, native installation requirements, monorepo resolution, other frameworks, SvelteKit, and SSR need separate experiments.

Automatic preparation uses declared manifests, not guessed imports. It runs Bun with lifecycle scripts disabled, freezes an existing Bun lockfile, and creates one when absent. Non-Bun lockfiles are rejected. Dependency edits currently require explicit reconciliation and remounting; they do not trigger an unattended install loop. A failed installation is a visible mount outcome and did not stop healthy previews.

### HMR and state preservation are different properties

A document can survive HMR while component-local state resets. That happened with ordinary Svelte `$state` in the initial singleton run. The follow-up keeps important state outside the component lifecycle through `previewState(key, initial, version)` and Vite HMR data.

Opted-in counters and drafts survived markup/CSS changes, compiler-error recovery, and reactive host-prop updates. Catalog additions/removals did not reload existing previews. Bumping one state key's version reset only that key; a full page refresh reset the preview session. Authors choose stable keys and compatibility versions. Arbitrary local state, focus, selection, effects, and resources are not automatically preserved or migrated.

The initial shared Vite overlay obscured other namespaces. The follow-up attributes errors to mounts and displays a scoped panel while retaining the last successful rendering. The neighboring preview remained clickable during the error. This is a UX improvement: the compiler, WebSocket, diagnostic transport, and browser origin remain shared. Runtime exceptions, compiler crashes, and untrusted-code isolation require different treatment.

### Delivery, completion, and user acceptance need separate evidence

The live adapter used the existing Codex App Server Unix WebSocket, with compression disabled. It exercised `turn/steer` and same-thread `turn/start`; `codex queue` help inspection did not establish that command's steering or activation behavior. The shared Codex daemon was not restarted or reconfigured.

A saved submission, runtime acceptance, observed agent action, published result, browser display, and personal user acceptance are different outcomes. The screenshot confirmation for option B at width 160 came from an automated browser test, not a choice made by the user. It was valid test evidence, not personal approval.

The first idle callback failed because the target agent session could receive input but could not contact the local API. A dedicated test session with appropriate networking subsequently completed the loop. Message delivery does not establish callback reachability; Artifact does not change a session's permissions.

Repeated submissions with the same response ID and data are deduplicated. Conflicting repeats are rejected. Ambiguous transport outcomes remain visible as unknown instead of triggering blind retries. This does not promise exactly-once agent execution. Result publication through a local credential is also not cryptographic proof of model authorship; the live proof separately observed the actual agent command.

### CLI, skills, and MCP have distinct roles

The CLI makes operations executable and inspectable. The skill teaches agents how to create sources, mount them, bind an exact session, interpret receipts, publish results, and recover from failures. An independent agent completed that workflow with a fixture binding, supporting basic usability without claiming another live model-delivery proof.

MCP can expose the same core operations for discovery and invocation. It does not itself wake an agent; the runtime-specific delivery adapter does that. Integrate the preferred singleton workflow before duplicating its interface in MCP.

### Rendering and lifecycle checks need direct observations

HTTP readiness alone does not establish successful compilation, browser behavior, type checking, or production builds. The external experiment separately checked both starters and browser interactions; its automated suite checkpoint was 25 tests and 78 assertions. The singleton follow-up passed its own TypeScript check and browser verification.

The earlier process supervisor covered normal stop, stop/remount ordering, and manager-crash cleanup. Those observations belong to that topology, not an untested singleton crash-recovery guarantee. All experiments assume trusted local source. Namespace names organize mounts; they are not security boundaries.

## Next: one singleton-to-agent round trip

The next experiment should connect the existing interaction core and adapter to the singleton host. Preserve the known session and delivery semantics while validating the changed mounting and browser-origin model.

Acceptance criteria:

1. Start one server, create two namespaces, and mount an external Svelte component folder with automatic dependency preparation. Retain the singleton process/Vite checks.
2. Bind one interaction to its canonical project, namespace, mount, and exact existing agent session. Define how a mounted subfolder maps to the agent's project root; do not equate namespace text with project identity.
3. Submit a custom form from that component. Persist the data and expose distinct delivery/result states. A different mount must not gain management access or retrieve another interaction merely by changing identifiers. Test request authorization explicitly; shared-origin pages remain trusted and are not security sandboxes.
4. First use a fixture adapter for repeatable browser/API regression checks, then record separate live active-turn and idle-conversation runs. Verify the agent's actual result CLI invocation and display its returned data in the originating page. No replacement conversation is created.
5. Keep unsent opted-in draft state through an ordinary HMR edit. Reload a submitted page and restore its persisted interaction status/result without submitting again. Do not confuse durable request records with ephemeral preview state.
6. Exercise duplicate submission, unavailable session, uncertain delivery, closed request, and unmounted page outcomes. Establish whether closing/unmounting cancels, preserves, or blocks pending interaction access rather than inheriting an accidental behavior.
7. Keep the second namespace interactive throughout local compile failure and request processing. Record any shared infrastructure limitations.
8. Update CLI usage and the skill around the actual integrated workflow. Retain reproducible checks and distinguish automated inputs from user choices.

After that gate, validate CommonJS/prebundling and framework boundaries, then add a thin MCP interface with CLI/MCP interoperability tests. Background-service packaging, durable preview-state policy, remote access, and broader isolation remain later design work. Do not collapse these into a claim of production readiness.

## Reproduction and evidence retention

- [Singleton commands and verification](../experiments/singleton/README.md#reproduce-the-experiment): install root/experiment dependencies, run the experiment type check and `bun run verify:singleton`.
- [External workflow](workflow.md): earlier CLI/skill setup and `bun run verify:external`.
- [Original live proof](prototype.md): exact-session setup, delivery limits, and recorded live outcomes. Automated fixture suites do not contact a model session.

Versioned scripts and experiment records make the observations reviewable. Local screenshots, receipts, and diagnostic logs remain in ignored `.artifact/` directories; they are not portable public evidence. This consolidation records the existing checkpoints and does not claim a fresh runtime verification run.
