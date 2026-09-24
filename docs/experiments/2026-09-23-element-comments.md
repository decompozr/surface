# Element comments and private preview — September 23, 2026

## Question and disposition

Can users select an element, attach its image, accumulate comments and send one reviewable batch? The user requested this experiment and subsequently requested its Tailscale URL. Source direction: [contextual comment batches](../requirements/agent-interaction.md#contextual-comment-batches--experimental). Disposition: retained as experimental; browser and real-recipient acceptance remain open.

## Implementation and observations

Checkpoint: uncommitted comments WIP on HEAD `a97e34f`, in the existing linked worktree. Concurrent source-documentation edits were preserved. Bun 1.4.2, pinned Svelte 5.57.1 and html-to-image 1.11.13.

- The playground exposes six marked elements, DOM-rendered PNG capture, target/revision metadata, editable comment drafts, IndexedDB storage, JSON export and a fixture-only batch receiver. This is implemented behavior, not browser-verified behavior.
- Initial Svelte/type checks, production build, four model tests and loopback HTTP checks passed. Native browser control could not acquire a usable window; no visual or interactive acceptance was claimed.
- When the user requested a Tailscale URL, the original development process was no longer listening. A separate built preview was started with detached process lifetime and explicit loopback binding; the selected private origin is configured in both adapter-node and the experiment access policy.
- A previously unused Tailscale Serve HTTPS port forwards to that preview. Existing mappings, public exposure settings and the installed Surface service were preserved. No Funnel was enabled for the experiment.
- Five model/access tests passed. The configured HTTPS origin is allowed; a different port, HTTP variant and unrelated origin are rejected. Production build passed.
- The HTTP verifier passed through the actual private HTTPS URL from the hosting Mac: page 200, fixture batch receipt, identical receipt on repeated payload, foreign-origin rejection, real-recipient rejection, empty-batch rejection and body-size limit. Synthetic inputs never reached a real agent.

Reproduction and lifecycle: [experiment README](../../apps/surface/src/lib/server/comments/README.md). Verifiers: [model/access tests](../../apps/surface/tests/comments/model.test.ts), [HTTP verification](../../tests/e2e/comments/verify-http.ts). Ignored local `.decompozr/surface/comments-preview/preview.json` records the exact PID/origin/target; `server.log` records the process output.

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

### Main integration follow-up

The user authorized preserving this worktree and integrating main on September 23. Commit `f5daafc` preserves the complete pre-integration WIP. The merge includes main `6dd9083`, the canonical documentation structure, and the newer explicit delivery-intent preflight. The comments callback customization and store notifications remain present.

The first integration test found concurrent duplicate batches colliding with the new preflight lock. The comment bridge now shares only an identical pending batch operation, rejects concurrent changed data, and retains the core lock. An initial new fixture accidentally blocked binding rather than submission; its barrier was corrected and the abandoned test process stopped. Fresh targeted verification passed: 22 service/comment tests, 78 assertions; root type check and app Svelte/server checks passed. No fixture contacted a live adapter.

Active recipients now require explicit queue/steer intent in Core; the comment playground does not yet collect that choice. Its active submission is therefore rejected before consuming the response slot. Idle submission remains supported. This is an explicit integration limitation, not permission to restore automatic steering. Earlier live active-delivery observations describe their older revision. No installed service or preview was restarted during this reconciliation.

Broader integration regression: `bun test tests` passed 76 cases and timed out in the legacy browser fixture because this checkout lacked the feedback example build/dependencies. Installed its pinned dependencies with `bun install --frozen-lockfile --cwd examples/svelte-feedback`, built with `bun run build:ui`, and reran `bun test tests/browser.test.ts`: passed (1 test, 5 assertions). Thus all 77 core cases passed across the initial run and targeted rerun; this is not a claim that the initial full-suite run was green. No tracked dependency manifest or lockfile changed.

### Preview build replacement failure

The user observed HTTP 500 after the identity update. Logs showed the running server importing an old hashed manifest/node chunk that no longer existed in the mutable build output. The preview now runs from a separate ignored release copy under its existing state directory; subsequent application builds cannot replace those files. Preserve this release-copy launch pattern on later preview updates. Existing interaction state and Tailscale mapping were retained. HTTPS verification returned 200 for the page and both entry scripts, and authenticated SSE returned its initial snapshot. This verifies transport recovery, not browser visual acceptance.

### Duplicate shell correction

Human screenshot evidence showed the global SurfaceShell wrapping the comment experiment after a later build, adding Workspace and Home above its minimal toolbar. The root layout now bypasses the shared shell only for the exact comment experiment page (including its trailing-slash form). Other routes retain the shared shell. This restores the previously requested single-toolbar experiment layout.

### Shared header preference supersedes bypass-only correction

The user prefers the upper shared shell. The experiment now renders that shell once, supplying its review controls as a header snippet. The root bypass prevents a second shell. The compact logo uses the canonical DecompozR square viewBox, cream background, arrow-brace transform and palette, replacing only the center bars with a typographic S. The previous custom stroked S and tightly cropped monochrome mark were rejected by human feedback. Visual acceptance of this revision remains pending.

### Four-region layout

The user selected a top action toolbar, left overlay navigation, right interaction pane that consumes layout width, and a fixed transparent bottom status bar. The comment experiment opts into overlay navigation on the shared shell; other shell consumers retain their existing behavior. The right pane animates a grid column rather than covering content and remains hidden/inert when closed. Connection status moves from the toolbar to a 24px bottom bar with reserved content space. Reduced motion disables the column animation. Browser visual acceptance remains pending.

### Touch selection and responsive panel refinement

User mobile feedback rejected touch-scroll selection and immediate comment composition. Selection now requires a click without movement beyond 8px, scroll or pointer cancellation; hover outlines are mouse-only. A selection first exposes nearby screenshot/comment actions. The slate Surface logo itself toggles navigation, replacing the hamburger. Both menus animate with reduced-motion support. The right pane pushes content on desktop and overlays it at widths up to 680px, superseding the earlier all-width push behavior. Build/type and HTTP checks do not establish touch-device acceptance; real mobile scrolling and animation remain a human verification gate.

### Browser E2E checkpoint

The user explicitly requested agent-run desktop and mobile E2E validation. `bun experiments/comments/mobile-desktop.e2e.ts` now exercises desktop Chromium, touch-emulated Chromium and iPhone 13 WebKit against the private HTTPS preview with fresh isolated storage and no connection capability. Batch POSTs are blocked, so fixture comments cannot reach the real conversation. All three profiles passed selection-to-toolbar, comment creation, element screenshot, logo navigation, intermediate animation geometry, pane bounds and desktop-push/mobile-overlay assertions with no page errors. Chromium's native synthesized touch-scroll gesture moved the workspace without creating a selection or hover outline. WebKit checks tap interactions and scrolling but does not constitute a physical iPhone Safari run.

Rendered screenshot inspection found a real defect: the captured-image composer extended below the mobile viewport. The composer now has an available-height bound and internal scrolling; all three profiles passed a bottom-edge assertion after the fix. Screenshots are retained in ignored `.decompozr/surface/comments-e2e/`. Type checks and the production build also passed. Physical-device keyboard and browser-toolbar resize behavior remain unverified.

### Controlled full-loop E2E

The earlier mobile/desktop test blocked submission, leaving a functional gap. The new `experiments/comments/full-loop.e2e.ts` launches the built preview on a temporary loopback port with separate state and a local provider-protocol fixture socket. It uses the actual Codex adapter, HTTP routes, result CLI, store and SSE. Desktop Chromium and mobile WebKit passed real browser submission with element screenshot, accepted receipt, callback publication and pushed result display, offline recovery and reload persistence. Each produced exactly one fixture delivery; neither contacted the user's conversation. Reports, screenshots and replayable Playwright traces are retained under the ignored comments-full-e2e directory. This verifies the application loop across a controlled provider boundary; real model response and physical-device behavior remain separate gates.

### Remove redundant Home row

At the user request, the comment experiment hides the standalone Home breadcrumb row and its divider. Content starts directly below the 60px action header, with 24px reserved for bottom status. Other shell consumers retain breadcrumbs by default.

### Keyboard actions

The comment experiment supports Command/Control+Enter to save the current comment into the pending batch, S to toggle selection, I to toggle the interaction pane and M to toggle navigation. Single-letter actions are suppressed in editable fields and with modifier keys; composition and repeated page-action keys are ignored. Saving a comment does not implicitly send the batch to the agent. Button titles and aria-keyshortcuts expose these bindings.

### Compact live indicator and connection toasts

The status bar now contains a small radio/live icon; connected means the SSE transport is connected, not that a model is working. Its accessible name and tooltip identify transport state, and clicking shows connection details. A reusable Toast component shows dismissible, five-second messages on disconnect/reconnect without repeating every retry. E2E initially exposed that an existing stream could survive browser offline emulation and leave a stale connected icon; the offline event now aborts the transport so state updates immediately. Desktop Chromium and mobile WebKit full-loop tests passed disconnect toast, reconnect toast, result catch-up and exactly-one delivery after this correction. The preceding keyboard E2E also passed S/I/M and Command+Enter, including M while typing not opening the menu. The redundant Home row removal is deployed with these changes.

### Standalone design-system consumer installation

Installed the existing local private design-system tarball into apps/surface, preserving its source checkout. Recorded its artifact SHA-256 and source revision. Verified Toast, index and font stylesheet archive contents against the checkout dist. Imported packaged font faces and replaced the custom Toast implementation with an adapter around the package Toast. Svelte/server checks and the production build passed. Shell-wide design-system migration is not claimed.

### Linked design-system development

At the user's request, replaced the tarball dependency with Bun's registered `link:@decompozr/design-system`, resolving to the standalone local checkout. Removed the obsolete vendored archive/provenance snapshot and updated installation guidance. Vite deduplicates Svelte; Surface's Svelte patch is aligned to the design-system's 5.57.0 to avoid duplicate nominal Snippet types (the previous 5.57.1 consumer failed type checking when linked). No source changes were made in the design-system repository. Final consumer type checks and build pass. The package still exports dist: package regeneration and a consumer build remain required for the built preview. The full-loop verifier accepts COMMENTS_E2E_BUILD_DIR for checking a newly built consumer without changing the active preview release.


### Design-system chrome migration

Continued in the same worktree after the accepted handoff. The navbar, route menu, recipient panel, comment pane, selection toolbar, floating composer and status action now use the linked package's controls or visual tokens. `ChromeAction` delegates button/toggle states and touch targets to package components; its local Lucide content covers glyphs absent from the package catalogue. The package Toolbar supplies roving keyboard navigation. Route links, the native bounded textarea, recipient selects and the previously selected Slate `{S}` mark retain their application-specific contracts. See the [consumer contract](../design/README.md#design-system-ownership).

Visual review caught clipped composer actions after increasing touch targets. The composer now scrolls screenshot/text content separately and keeps its action row visible. The three-profile interaction verifier checks toolbar keyboard traversal, mode toggling, 44px coarse-pointer targets, toolbar/editor viewport bounds, visible save action, gestures, selection/capture, shortcuts and panel layout. Existing test-output paths remain the defaults; environment overrides preserve prior evidence during this run.

The first isolated preview launch incorrectly supplied an empty state directory, producing a missing-connection error. The local-only fixture was corrected by omitting live state configuration; no production state was altered. Runtime navigation separately revealed rejected design-system assets (403), initially `dist/index.js`, then version metadata. The runtime now permits the resolved published `dist` directory and exact package manifest in both request and Vite checks, deduplicates Svelte, and loads fonts with the shared shell. The navigation regression checks that the design-system source remains inaccessible (403).

Validation: root TypeScript, application Svelte/server and core TypeScript checks pass (Svelte: zero errors/warnings); production build and `git diff --check` pass. Twenty host/runtime/comment tests pass. Desktop Chromium, touch Chromium and iPhone 13 WebKit interaction checks pass; rendered desktop pane, mobile pane/composer and navigation screenshots were inspected. Real Chrome navigation passes nested page/folder links, breadcrumbs, persistent collapse, mobile drawer/Escape, scoped horizontal overflow, package font loading and asset-boundary checks. Isolated desktop/mobile full-loop checks exercise browser submission, PNG storage, fake-provider receipt, real callback CLI, SSE, offline recovery and reload with one delivery per profile.

Evidence is retained under `.decompozr/surface/chrome-migration-20260923/` (`final-interactions`, `navigation`, `verified-full-loop`; earlier attempts also retained). No design-system source edits, shared installation update, private preview restart, recipient rebinding, commit, new agent or caller archival occurred. The existing Tailscale preview still serves its prior immutable release. Human visual approval and physical-device acceptance remain pending.


### Header simplification and private preview update

User feedback identified the redundant Workspace tag and its inconsistent alignment beside Surface. Removed the tag at every viewport width and set an explicit line height for the centered product name. The shared design contract now records this simpler header. Svelte/server checks (zero errors/warnings), production build and diff whitespace checks passed.

Updated the existing private preview on port 4387 behind the unchanged Tailscale Serve URL using a new immutable release (`1790185580103693000`). A separate local-only preflight passed before replacing the verified owned listener. The old release is retained; connection.json was verified byte-for-byte unchanged. This supersedes the preceding checkpoint's statement that the preview still serves the pre-migration release. Chrome verified the live HTTPS page with only the logo and Surface name in the header. No automated comment submission, recipient rebinding, shared installation update or commit occurred.


## Full design-system component adoption

The later user request supersedes the primitive-only migration boundary above. Surface now imports package-owned AppShell/AppHeader/Brand/Logo, NavigationLinks/Breadcrumbs, SidePanel/SurfaceCard/FloatingComposer/StatusBar/SelectionOutline/Divider, Text/TextArea/Select/Slider, and review IconButton/ToggleButton/Toolbar/Badge/Toast components. The package owns component appearance and shell motion. Surface retains content arrangement, route/capability identity, collapse persistence, selection coordinates, draft state and explicit delivery. The home and generated folder catalog also use package typography/navigation. The package Logo supplies the Slate Surface S mark; the local wrapper contains no copied SVG.

Provider coordination used the user-designated task `01a0cf62-e6dd-7102-824a-e57104228529`. Its isolated checkout `/Users/scottchu/.codex/worktrees/98c9/design-system` supplied the tested dist. All 107 dist files matched tarball SHA256 `f952bab451a2d4744aad3ee49b01713b4f9abeba3ce588f035c05c18b6dad429`. Only this Surface worktree's consumer symlink was redirected; canonical checkout and global package registration were preserved. See [the consumer contract](../design/README.md#design-system-ownership) for the local-link limitation.

Final checks passed: root/app/core TypeScript and Svelte (zero errors/warnings), build, 20 targeted tests, desktop Chromium/touch Chromium/mobile WebKit comment geometry and interaction checks, shared navigation and recipient fixtures, and desktop/mobile isolated end-to-end PNG submission → provider receipt → CLI reply → SSE → offline recovery → reload. Each full-loop profile delivered exactly once. No fixture reached a real conversation. The navigation check waits for the drawer to settle before screenshot capture; the full-loop check similarly waits for the right pane to be within the viewport.

Evidence is retained under `.decompozr/surface/design-system-adoption-20260923/`, including provider-ready.json, completion.json, browser screenshots/traces and preview-update.json. The same private HTTPS experiment preview was replaced with an immutable verified build; the existing connection file remained byte-identical. Live Chrome rendering and opening the comment pane were verified after replacement. Prior releases and all WIP remain. This is still an opt-in experiment, not a shared-installation or production promotion. Physical-phone acceptance and human visual approval are not claimed.


## Mobile keyboard and transparent status follow-up

A user-provided iPhone screenshot showed the focused floating editor clipped by the browser chrome. The initial mobile emulation did not test a real software keyboard. Source inspection found layout-viewport-only positioning and no visualViewport event listeners. The transparent StatusBar also sat over an empty 24px AppShell grid row, creating an apparent solid strip.

Surface now reads visual viewport offsets/size, listens to its resize and scroll events, measures the package composer's rendered height, and clamps it within the visible area. Nested content scrolling updates the anchor without replacing the draft or stealing focus. Focused input is revealed by scrolling the editor body only. Keyboard-constrained layouts omit the optional floating notice and reduce textarea rows. The status row reserves zero layout height, allowing page content to continue underneath the transparent package footer. This uses existing package props; no design-system source or canonical linkage change was needed.

The browser coordinate distinction is documented by [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport): on-screen keyboard changes can affect the visual viewport independently of the layout viewport. This API evidence supports the coordinate/event choice; it is not device test evidence.

Checks passed: app Svelte/TypeScript with zero diagnostics, build, four geometry regressions, synthetic visual viewport resize/pan tests in Chromium and WebKit (including focused nested scroll, screenshot+long selector, retained draft and visible actions), and all three existing interaction profiles. Screenshot review and live HTTPS rendering were completed. The new tests also check footer transparency, full-height page coverage, and pointer pass-through outside the status action. Evidence: `.decompozr/surface/mobile-viewport-fix-20260923/`.

The same private experiment preview was updated to the verified immutable release, preserving connection.json byte-for-byte and retaining previous releases. Physical iPhone keyboard animation/viewport acceptance remains for user confirmation; synthetic browser events do not establish that result.

### Consolidation of the two comments work streams

User-authorized consolidation uses incoming commit `97250d71e02c6f2dd37927eedda5a214c2d7d7d1` from the clean `cd49` checkout as the source baseline, in the original same worktree. The original worktree's files and diff are preserved under `.decompozr/surface/consolidation-20260924/before.tar.gz` and `before.patch`. No other checkout or preview recipient is changed.

The newer design-system Switch, compact typed events/replies, automatic result monitoring, parent-selection label and simplified footer remain authoritative. Only missing selection-toolbar transform/frame scheduling and same-document capability reconnection are reapplied. The superseded extra queue/steer action UI is not carried forward. The self-owned E2E runner and repository rules are adapted to the new Switch and automatic-recovery behavior, with idle and active receiver profiles, lost acknowledgement, SSE/offline/reload, and stable selection-toolbar regressions. Historical active-recipient failures describe the older 8466 build, not the successfully used 8467 version.

Consolidation validation: root TypeScript, app Svelte/TypeScript (zero errors/warnings), core TypeScript, targeted delivery tests, app build, four full-loop browser cases (idle/active × Chromium/WebKit), and two toolbar scroll cases passed. The mobile rendered Switch and chat-send control were inspected. Evidence: `.decompozr/surface/consolidation-20260924/final-matrix/`. Integration remains uncommitted in the original worktree; neither live preview was replaced as part of this consolidation.
