# Element comments experiment

A reviewable, opt-in experiment for the proposed Surface global layout: shared workspace on the left, comments and a batch conversation on the right. This is not an adopted shell or a live agent integration.

## Run

From the repository root, install the existing pinned dependencies:

```sh
bun install --frozen-lockfile --ignore-scripts
bun install --cwd apps/surface/runtime --frozen-lockfile --ignore-scripts
bun install --cwd apps/surface --frozen-lockfile --ignore-scripts
cd apps/surface
SURFACE_COMMENTS_EXPERIMENT=1 bun --bun vite dev --host 127.0.0.1 --port 4387 --strictPort
```

Open `http://127.0.0.1:4387/experiments/comments`. This uses a dedicated development server; it does not install a release, mount a project, change the shared service, or bind a real conversation. The experiment page and receipt endpoint are opt-in. They allow loopback plus one explicitly configured HTTPS origin through `SURFACE_COMMENTS_ORIGIN`.

## Human review

1. Select the heading or a card in comment mode. The dropdown provides keyboard access to the same targets. Escape leaves comment mode and enables the sample page's controls.
2. Capture the selected element, inspect the preview, enter a comment, and add it to the draft. Capture-only and text-only comments are both supported.
3. Add another comment. Edit or remove it before sending. Changing selection automatically adds an unfinished comment to the draft rather than discarding it.
4. Wait for `Saved on this browser`, reload, and check that the draft, images, and unfinished composer remain.
5. Send the comments together. One HTTP request carries the comments, target metadata, frozen PNGs, page path, revision, and batch identity to a local fixture. Its receipt is explicitly distinct from a real agent reply.
6. Turn off comment mode and change the heading size. Previously captured images should stay unchanged. Capture the updated heading to compare.
7. Export JSON to inspect the complete conversation, including PNG data and delivery receipts.

Questions for the user: Is the selected scope clear? Does the capture show enough context? Is collecting and sending a batch easier than sending individual comments?

## Original v1 boundaries (historical; see v2 below)

- Only the six marked elements in this same-document playground are selectable. General mounted-page instrumentation, arbitrary nested targeting, parent selection, and manual crop adjustment are future experiments.
- Screenshots use pinned `html-to-image` 1.11.13 to render the selected DOM element, then crop to its visible viewport/scroll-container rectangle. This is a DOM-rendered PNG, not native browser screen capture. Annotation overlays are outside the captured element. Background color is resolved from the element's ancestors.
- Cross-origin frames/assets, video, WebGL, overlapping siblings, sticky occlusion, arbitrary transforms, custom web fonts, and pixel-perfect rendering are not validated. Transparent/overlapping layers may differ from the actual screen. The fixture uses system fonts and local content. See the [library's capture contract and limitations](https://github.com/bubkoo/html-to-image).
- The selection's label, selector, text, revision, capture time, rectangle, and image dimensions are preserved. The revision identifies the fixture source, not an automatic content hash or a guarantee that the selector will survive later edits.
- IndexedDB retains drafts and conversation history on this browser/origin. One active tab is supported; concurrent tabs, migration, storage recovery, cross-device access, and indefinite retention are not implemented. Storage failure is visible; JSON export is available.
- Pending batches are saved before transport. Reload does not automatically resend. Explicit retry retains the batch identity and payload. The stateless fixture returns a deterministic receipt; this does not establish real adapter exactly-once delivery or durable server storage.
- Limits: 20 comments per batch, 4,000 text characters per comment, 1.5 million PNG data-URL characters per image, and 8 MB request body. Very large DOM captures are rejected before rendering.
- Mobile uses a stacked workspace and comment panel. Desktop and mobile browser acceptance must be recorded separately from compilation and HTTP checks.

## Verification

```sh
bun run --cwd apps/surface check
bun run --cwd apps/surface build
bun test apps/surface/comments/model.test.ts
# With the dedicated experiment dev server running:
bun apps/surface/comments/verify-http.ts
```

The HTTP verification uses only synthetic fixture data. It checks the page, batch receipt, repeat receipt, origin rejection, recipient rejection, empty batch rejection, and body size limit. It never contacts an agent.

Initial verification: type/Svelte checks passed with zero errors/warnings; production build passed; four model tests and the HTTP verification passed. Interactive browser and screenshot acceptance are pending; the available browser control could not acquire a window. No real agent delivery has been attempted or verified.


## Private Tailscale review follow-up

The September 23 user request authorized private Tailscale access to this experiment. A built adapter-node preview now runs separately from the shared installation, bound to loopback, with `ORIGIN` and `SURFACE_COMMENTS_ORIGIN` set to the selected private HTTPS origin. Tailscale Serve forwards an unused HTTPS port to this preview. No Funnel mapping was created or changed. Existing mappings and the shared Surface service were preserved.

Run the built preview with `HOST=127.0.0.1 PORT=4387 ORIGIN=YOUR_HTTPS_ORIGIN SURFACE_COMMENTS_ORIGIN=YOUR_HTTPS_ORIGIN SURFACE_COMMENTS_EXPERIMENT=1 BODY_SIZE_LIMIT=8M bun build/index.js` from `apps/surface` after building. Use a verified unused Serve port; inspect existing mappings before configuring it. Machine-specific PID, origin and target are recorded in ignored `.decompozr/surface/comments-preview/preview.json`, alongside `server.log`. This detached review process has no login or reboot startup registration. Retire only its verified PID and unchanged owned Serve mapping when review ends.

The original development process was no longer listening when the user requested a remote URL. The follow-up verified HTTPS page access and all HTTP verifier cases through the private origin from the hosting Mac. Five model/access tests and a production build passed. Another device's browser rendering, screenshot fidelity and human acceptance remain unverified. See the [source evidence record](../../docs/experiments/2026-09-23-element-comments.md).


## V2 review and live connection

The current source uses direct DOM selection, a compact icon toolbar, a default-hidden overlay drawer and a floating comment composer. IDs/classes/structural paths locate targets; manually naming or tagging each element is unnecessary. Existing browser drafts and fixture history remain intact.

The user authorized manual submissions to the originating conversation. `SURFACE_COMMENTS_STATE_DIR` selects a separate private experiment directory containing `connection.json` (exact canonical project root, existing thread/socket, display label, private browser token, separate callback token, HTTPS origin and result CLI path). No live configuration is committed. The preview uses a single writer; do not run a second process against this directory. The callback CLI talks to the owning server instead of opening the store itself.

Open the private link with `#connect=TOKEN` to enable live interaction. A distinct query version forces a full navigation when upgrading from v1. The token is retained in session storage for that browser tab. Sending is disabled until read-only inspection confirms the configured conversation is available. Existing fixture submissions are not replayed or relabeled. Browser credentials cannot invoke the agent-result endpoint. The private link grants access to this experiment's conversation, so share it only with the intended user.

`delivery.ts` wraps the existing Surface Service/Store/CodexAdapter. Each batch becomes one request; duplicate payloads keep their response identity, and unknown outcomes remain explicit. PNG files are stored under the private state directory and referenced in the delivered data. The agent publishes its result using `result.ts` and the callback command in the delivered message. The UI polls for receipt/result updates without resending.

Run `bun test apps/surface/comments` for all nine model/access and fake-adapter tests. The HTTP verifier still sends only `local-fixture` payloads even when the private live connection is configured. Never change it to submit fixtures to a real thread. Detailed status and remaining human gates are recorded in [the v2 source record](../../docs/experiments/2026-09-23-element-comments.md#v2-user-review-and-exact-conversation-binding).

## Push results and short replies

The opt-in preview now uses authenticated SSE snapshots instead of the six-second result poll. Reconnect restores current durable results without resending comments. Transport heartbeats are not agent presence; agent availability is checked only when connecting. Browser visual and reconnection acceptance remains pending.

From this checkout, reply with `bun run reply REQUEST_PREFIX "Updated the layout."`. The helper checks unique request identity and the configured conversation/project, then publishes JSON. Existing long callback commands remain supported.

Preview launches must copy the completed adapter build into a separate release directory before starting it. Do not serve directly from apps/surface/build while rebuilding: running manifests can reference removed hashed chunks. Keep the existing state directory and private connection configuration when switching releases.

## Desktop and mobile browser verification

Run `bun apps/surface/comments/mobile-desktop.e2e.ts` with the installed Playwright Chromium and WebKit browsers. Set `COMMENTS_E2E_ORIGIN` to override the preview origin. The verifier uses fresh browser contexts without the private connection token and blocks batch POSTs. It checks native synthesized touch scrolling in Chromium, WebKit mobile taps, intermediate animation geometry, local comment/capture actions and pane/composer bounds. Screenshots are saved under the ignored comments-e2e state folder. This is browser emulation, not physical-device keyboard or browser chrome acceptance.

## Full functional loop

Run `bun apps/surface/comments/full-loop.e2e.ts`. This starts a temporary loopback preview using the recorded immutable release, separate storage and an isolated Unix-socket provider-protocol fixture. Desktop Chromium and mobile WebKit really click send with a captured PNG. The harness verifies provider delivery, saved screenshot bytes, the result CLI callback, browser SSE rendering without refresh, offline recovery and reload persistence, with exactly one delivery per submission. No real provider socket or conversation is used. It shuts down its test server afterward and retains a report, screenshots and Playwright traces under `.decompozr/surface/comments-full-e2e/`. The temporary state path is recorded in the report.

Inspect a replay with `bunx playwright show-trace .decompozr/surface/comments-full-e2e/mobile-trace.zip`. The trace includes browser actions, DOM snapshots and network activity; its synthetic capability belongs only to the stopped fixture. This is a real application functional loop with a controlled provider boundary, not proof of model execution, real conversation delivery or physical-phone behavior. Live-recipient acceptance is a separate explicitly selected test.


## By-the-way delivery

Live comment batches default to the visible “By the way” preference: Steer for a checked active turn, Start for an idle/not-loaded recipient. “After the current task” uses Queue when active. Every batch freezes the observed status/turn and preference; state changes reject without sending, restore the draft and require explicit refresh/send. Lost acknowledgements retain the batch, and “Check submission” performs a GET without replay.

The delivered preference asks the agent to acknowledge briefly, preserve the original task and decide whether to continue it, address the feedback now or defer it. New preference-bearing batches supply an exact JSON callback command. Publish `stage: "acknowledged"` with a message and optional `next: "continue-original" | "address-now" | "later"`, then `stage: "completed"` with the actual outcome. Legacy text-only replies remain supported. Delivered/Queued labels are transport receipts; only an authenticated agent callback displays “Agent acknowledged”. This requests agent behavior; it does not guarantee response timing or an autonomous scheduler.

The full-loop verifier now covers an active-turn change, draft retention, explicit refresh, desktop default Steer/mobile Queue, loss of the browser POST acknowledgement, GET-only inspection, acknowledgement followed by completion, offline SSE recovery and reload. Set `COMMENTS_E2E_BUILD_DIR` to an isolated completed app build when testing new source. Provider messages remain fixture-only.
