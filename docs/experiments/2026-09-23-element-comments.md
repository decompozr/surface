# Element comments and private preview — September 23, 2026

## Question and disposition

Can users select an element, attach its image, accumulate comments and send one reviewable batch? The user requested this experiment and subsequently requested its Tailscale URL. Source direction: [contextual comment batches](../agent-interaction.md#contextual-comment-batches--experimental). Disposition: retained as experimental; browser and real-recipient acceptance remain open.

## Implementation and observations

Checkpoint: uncommitted comments WIP on HEAD `a97e34f`, in the existing linked worktree. Concurrent source-documentation edits were preserved. Bun 1.4.2, pinned Svelte 5.57.1 and html-to-image 1.11.13.

- The playground exposes six marked elements, DOM-rendered PNG capture, target/revision metadata, editable comment drafts, IndexedDB storage, JSON export and a fixture-only batch receiver. This is implemented behavior, not browser-verified behavior.
- Initial Svelte/type checks, production build, four model tests and loopback HTTP checks passed. Native browser control could not acquire a usable window; no visual or interactive acceptance was claimed.
- When the user requested a Tailscale URL, the original development process was no longer listening. A separate built preview was started with detached process lifetime and explicit loopback binding; the selected private origin is configured in both adapter-node and the experiment access policy.
- A previously unused Tailscale Serve HTTPS port forwards to that preview. Existing mappings, public exposure settings and the installed Surface service were preserved. No Funnel was enabled for the experiment.
- Five model/access tests passed. The configured HTTPS origin is allowed; a different port, HTTP variant and unrelated origin are rejected. Production build passed.
- The HTTP verifier passed through the actual private HTTPS URL from the hosting Mac: page 200, fixture batch receipt, identical receipt on repeated payload, foreign-origin rejection, real-recipient rejection, empty-batch rejection and body-size limit. Synthetic inputs never reached a real agent.

Reproduction and lifecycle: [experiment README](../../experiments/comments/README.md). Verifiers: [model/access tests](../../experiments/comments/model.test.ts), [HTTP verification](../../experiments/comments/verify-http.ts). Ignored local `.decompozr/surface/comments-preview/preview.json` records the exact PID/origin/target; `server.log` records the process output.

## Limits and next gate

A DOM rendering is not native screen capture; frames, video, WebGL, overlapping content and arbitrary pages are outside this experiment. Local IndexedDB storage is scoped to the browser and origin, so loopback drafts do not automatically appear at the HTTPS origin. The receiver is stateless and fixture-only; its acknowledgement does not establish agent receipt or completion. The detached preview has no reboot/autostart guarantee.

The remaining human gate is to use the private URL on the intended device: select an element, inspect its capture, add two comments, reload after saving, and send the batch. Record the result and any loss of context or state. Actual conversation binding/delivery requires a separate integration and observation. No general shell adoption follows from this reachability check.


## V2 user review and exact conversation binding

The user supplied browser screenshots and reported that the header was too large, the comments pane should be hidden by default, and the small eyebrow text could not be selected. The screenshots also show one manually submitted fixture comment; this establishes user interaction with the original fixture UI, not real agent delivery or screenshot fidelity. The user then explicitly authorized manual submissions to the current conversation and clarified that DOM paths/IDs/classes should locate targets without naming every element.

Implemented corrections on the same uncommitted worktree:

- A 44 px header with accessible Lucide icon buttons and compact connection status. The comments pane is a slide-in overlay, closed initially; it no longer reserves workspace width.
- Direct DOM hit selection within the workspace, generated selectors (ID, non-generated classes and structural position), derived labels and optional parent selection. The sample no longer requires `data-comment-target` tags. A floating composer keeps input near the selection. Closing it retains the draft.
- Same browser/origin IndexedDB history is preserved, including the original fixture records. Inline element image rendering now supplies explicit dimensions and normalizes the root margin/display.
- A private fragment capability authorizes live submission/read access. Server-only configuration holds the verified thread/worktree/socket and a separate callback credential. The browser cannot select another destination or publish agent results.
- The existing Service/Store and CodexAdapter deliver batches. PNGs are stored under the experiment's private state directory; agent input receives image paths and capture metadata rather than large base64 text. The normal result callback publishes a separate response visible in the panel.
- A stored batch response identity suppresses duplicate adapter delivery, including after restart. Unknown outcomes are retained and never automatically replayed. Pending work can be inspected without selecting a replacement conversation.

Fresh observations: Svelte/type check passed with zero errors/warnings; production build passed; nine tests passed (34 assertions). New fake-adapter cases cover concurrent duplicate requests, restart, payload mismatch, uncertain acknowledgement, exact-recipient checks, screenshot persistence and separate result publication. No fixture called a real adapter.

Read-only live inspection verified the exact current thread and canonical worktree through the existing Codex 0.155.1 control socket. Through Tailscale HTTPS, the updated page returned 200, the initial HTML omitted the drawer, authorized status returned that exact active thread, and missing capability returned 401. The fixture HTTP verifier still passed. No synthetic live message was sent. Official transport reference: [Codex App Server](https://learn.chatgpt.com/docs/app-server); the implementation reuses the repository adapter rather than introducing another provider transport.

Visual/browser automation remains unavailable through the provided browser-control tool. The new layout, fine-grained selection, inline captures, reload recovery and actual user-to-agent/result loop require the user's browser observation. This is configured live connectivity and tested fixture logic, not a claim that a live user submission has completed. DOM identity across changed source, cross-origin frames, Shadow DOM, multi-tab edits and general mounted-page integration remain outside this iteration.


### First live user comment and selector-label correction

At 2026-09-23T12:51:02Z the user submitted batch `d10880ae-8437-483a-910e-b9638dfaf68e`, request `b66e6e8a-0f51-4520-945e-39fb9615c3ec`, asking that hover/selected labels show HTML paths, IDs and classes rather than content. This exact payload arrived in the originating conversation; the stored response is accepted. This is live user-to-agent delivery evidence, superseding the earlier read-only-only boundary for this one submission. No image was attached, so it does not validate screenshot delivery.

The scoped correction uses the DOM selector for hover and selected-editor labels, includes tag/ID/classes at ID anchors, wraps long paths, and retains text separately. Type/Svelte check and build are the validation gates for this correction; actual rendered appearance still needs browser observation. The callback for this request records the agent's completed change; a stored callback alone does not prove the browser displayed it.


### Minimal chrome follow-up

The user requested removal of the element dropdown and bottom “Select → Capture → Comment → Send together” text, and questioned the persistent browser-save status. Removed the dropdown, footer and routine save text; retained automatic IndexedDB draft saving, visible save failures and the existing export icon. This is a scoped presentation correction, not a change to storage or delivery semantics. Direct selection and the existing keyboard handling remain; a replacement keyboard element-discovery UI is outside this change.

Validation for this follow-up: Svelte/type check passed with zero errors/warnings, production build passed, and the restarted private preview returned HTTP 200. Browser-rendered acceptance remains separate.

### SSE follow-up

User authorized replacing the six-second browser result poll with push. The preview now subscribes to committed store writes, streams authenticated snapshots and transport heartbeats, and reconnects with a fresh snapshot. Slow readers are disconnected instead of accumulating unbounded output. JSON remains the durable result representation. Agent status is explicitly a connection-time check, not a claim of ongoing work.

Validation: 17 comment/core tests passed; Svelte and server type checks and the production build passed. Store observer tests verify notification after a write and removal on disconnect. Live HTTPS acceptance checks cover authentication, snapshot and heartbeat without submitting fixture input to the real conversation. Browser rendering and disconnect/reconnect UX still require human validation; no browser visual acceptance is claimed.

### Surface identity trial

The user requested the DecompozR design-system logo adapted to {S}. The comment preview preserves the arrow-brace SVG geometry from the canonical DecompozR apps/design-system/src/lib/Logo.svelte, replaces its equals mark with a vector S, and uses a compact charcoal mark instead of the Surface wordmark and green decorative period. This is a preview identity trial, not adoption across all Surface pages. Browser visual acceptance remains pending.
