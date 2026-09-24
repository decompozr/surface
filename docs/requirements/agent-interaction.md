# Agent interaction

Status: current bounded contract reconciled against `src/core/service.ts`, `src/client/index.ts`, `src/adapters/codex.ts` and the shared recipient panel at `7fceefc` on September 23, 2026. Dated provider evidence below remains historical; no new live delivery was run. [UI states](../design/interactions.md) and [evaluations](../evaluations/runtime-eval.md) separate implementation from acceptance.

## Requirement index

| ID | Observable contract | Limit |
| --- | --- | --- |
| <a id="r-08"></a>R-08 | Bind a canonical project/root, exact existing conversation and authorized endpoint. Validate a request-scoped capability and response schema; accept one response identity and reject conflicting repeats. | Display names, latest-thread selection and management credentials in pages cannot substitute for exact routing. |
| <a id="r-09"></a>R-09 | Active recipients require explicit queue or steer; idle/notLoaded use same-thread start. Revalidate observed status/turn and mount scope before reserving/sending. | No fallback mode/session. Queue/start retain a provider race after inspection; steer uses expected turn ID. |
| <a id="r-10"></a>R-10 | Recipient discovery/takeover is opt-in and scoped to an exact worktree. Unsent takeover creates a new request/token and closes the original atomically, reusing an existing matching binding where appropriate. | Other worktrees are view-only; no response/result replay; submitted/unknown work requires reconciliation. |
| <a id="r-11"></a>R-11 | Keep response persistence, delivery acceptance, agent work and published/rendered results distinct. Preserve failed/unknown records and inspect before uncertain retry. | No exactly-once execution, general draft recovery, automatic resend or inferred human acceptance. |

## Intent and status

Surface should let a user submit a choice, form, or parameter set from a page directly into the agent session that created the interaction. The agent introduces itself to Surface, which binds page responses to that existing conversation and delivers them through an adapter.

The preferred design is explicit delivery to the existing session: let the user queue input after an active turn or steer that turn, and continue an idle conversation with a new turn when the agent runtime supports it. Keeping an agent blocked on a waiting tool call is not required.

The shared service implements Codex session bindings, one-response requests, structured submissions, delivery records, result publication and the recipient lifecycle below. Earlier live steering/idle observations are recorded in [prototype evidence](../experiments/original-prototype.md); they do not establish current queue/takeover live acceptance. Broader providers and recovery remain bounded by their own evidence.

## Interaction flow

1. An agent registers its project, existing session identity, and delivery mechanism with Surface.
2. The agent creates a page and an interaction request bound to that session.
3. The user opens the page, selects an option or edits parameters, and presses a submit button.
4. The page sends structured data to Surface's backend using its scoped interaction reference.
5. The backend validates the request binding and payload, saves the response, and resolves the registered agent adapter.
6. The adapter delivers the input to the existing conversation using the selected queue, steering, or continuation mechanism supported by the runtime.
7. Surface records what the runtime acknowledged. The agent interprets the response and can update the page through its normal project tools.

The browser does not need to know which agent CLI or protocol is used. A page remains ordinary frontend code with an explicit submission action.

## Agent introduction and request binding

Registration stores binding ID, provider thread ID, canonical project root and local control socket. The following conceptual fields explain the boundary; configurable provider/capability registries and credential-reference schemas are not implemented by this table:

| Field | Purpose |
| --- | --- |
| Surface session binding ID | Local reference used by Surface to identify the registration |
| Agent provider and adapter | Select the supported delivery implementation |
| Provider session or thread ID | Identify the existing conversation; use an exact ID rather than the most-recent session |
| Project identity | Associate the conversation with its source workspace |
| Control endpoint and backend credential reference | Reach the runtime that owns the session; keep credentials out of page content |
| Delivery capabilities | Describe support for active-turn queueing and steering, idle continuation, and delivery acknowledgements |

A display name may help the user recognize the agent but is not sufficient for routing. A session ID alone is also insufficient without access to the runtime that can control it.

Each interaction request binds a session binding, expected schema and runtime or preview scope (project/root, namespace, mount and component for mounted pages). It records open/closed state and response/result history. It does not freeze a source revision; a reproducible run must record that revision separately. The backend checks these relationships rather than trusting a browser-supplied destination session.

The active turn ID is live state, not a permanent registration field. The adapter must obtain or track the current turn when it delivers input.

## Response data

An illustrative context envelope (not the exact client API payload) could be:

```json
{
  "responseId": "response-456",
  "requestId": "review-123",
  "type": "selection.submitted",
  "data": {
    "option": "B",
    "width": 120,
    "comment": "Use this version"
  }
}
```

The request determines the destination. The response ID identifies one submission across transport retries. The current contract allows one response per request. A deliberate later interaction needs a new request after the prior outcome is reconciled; it must not bypass an uncertain delivery.

Delivery should preserve the request and response identity alongside user data so the agent can relate the message to its original question. The caller supplies a validated JSON response schema; the compatibility default is the original feedback schema. Requests allow one response, with explicit close rather than a general expiry/retention policy. The illustrative `requestId` and `type` above are context fields; the current submit envelope is `{ responseId, data, delivery? }`, with request identity in the endpoint.

## CLI and backend integration

The CLI exposes the shared delivery path with an explicit request and response identity:

```bash
bun run surface send \
  --request "REQUEST_ID" \
  --response-id "RESPONSE_ID" \
  --data '{"option":"B","width":120,"comment":"Use this version"}'
```

At this baseline, [the public CLI send command](../../apps/surface/src/cli/index.ts) sends response ID and data without a delivery intent. The example therefore uses the compatibility idle-start path; active recipients reject it. Active queue/steer selection is available through the request page/browser client. CLI delivery-intent flags are not implemented.

The request resolves to the registered session, so callers do not supply a second destination that could disagree with it. The CLI and page endpoint use the same validation and delivery operations. The implemented Codex adapter calls the native control API; a configured agent CLI remains another possible adapter mechanism.

The delivered message includes a `result` CLI operation scoped to the request. When the agent executes it, the backend records a separate result; a project page that reads and renders results can display it. This updates page data; it does not establish that the agent edited a component's source code.

For a CLI adapter, use a known executable with discrete arguments or stdin for payload data. Page input supplies data, not executable names or shell command strings. The agent provider and its configured adapter determine how the data reaches the session.

## Codex capability evidence

Inspected on 2026-09-20:

| Mechanism | Confirmed evidence | Validation still needed |
| --- | --- | --- |
| App Server `turn/steer` | Documented active-turn input with matching `threadId` and `expectedTurnId`; live page submission was accepted into the exact active turn and the agent published a result | Broader runtime versions and concurrent-client behavior |
| App Server `turn/start` | Documented same-thread generation; live page submission continued an idle test conversation and the agent published a result | Broader runtime versions and unloaded-session recovery |
| `codex queue --thread <id> --message <text>` | Local `codex-cli 0.154.0` help describes queuing a message for an existing session | Whether it steers immediately, queues for a later turn, or activates an idle session in the intended environment |
| `codex exec resume <session-id> <prompt>` | Local CLI help describes resuming a saved session non-interactively | Whether its execution and conversation visibility suit this integration; it is not established as live-session steering |

Source for the App Server behavior: [official Codex App Server documentation](https://learn.chatgpt.com/docs/app-server). CLI availability evidence came from `codex --version`, `codex queue --help`, and `codex exec resume --help`; neither CLI delivery command has been exercised. The live proof used the App Server adapter and a dedicated test conversation, as recorded in [prototype evidence](../experiments/original-prototype.md#validation-on-2026-09-20).

The Codex adapter should connect to the authorized runtime owning the target session. Starting an unrelated App Server does not by itself establish control of an already running conversation. Endpoint discovery and access are part of the experiment.

For an active turn, require the user to select queue or steer. Queue uses `thread/queue/add`; steering uses the observed turn ID with `turn/steer`. For an idle conversation, start a turn in that same thread. If state changes between inspection and delivery, reconcile current state and the delivery result before deciding whether another attempt is appropriate. Do not silently fork a thread, select the latest conversation, or create a replacement session.

These are provider-specific capabilities. Other agents need adapters with their own verified behavior; accepting MCP connections alone does not establish support for steering an existing agent conversation.

## Delivery outcomes

Distinguish a response saved by Surface, input accepted by the agent runtime, and an agent action observed afterward. A successful CLI exit or protocol acknowledgement is not proof that the agent finished the requested work.

The backend persists a reserved response as delivering, then records accepted/failed/unknown and its receipt/error; restart changes interrupted delivery to unknown so it can be inspected. Repeated delivery of an already accepted response should not deliberately trigger another action. If a timeout leaves acceptance uncertain, report that uncertainty and reconcile it where possible instead of blindly resending. Exactly-once execution is not assumed.

Reject closed or stale requests explicitly. Unavailable recipient or stale state detected in preflight rejects before saving a response. Failures after reservation retain the response as failed/unknown; a client transport failure must be inspected because reservation may already have happened. General retention/expiry policy remains unresolved. No automatic fallback should change the destination conversation.

## First proof

Historical proof procedure: use one Svelte page with options A and B, a width parameter, and a submit button. Deliver the selection to its originating agent session and observe the agent modify the page accordingly. Exercise both active-turn steering and idle continuation separately.

See [experiment 1B](../experiments/roadmap-2026-09.md#experiment-1b-a-button-steers-the-originating-agent-session) for acceptance criteria. Success requires evidence of the same conversation receiving the correct data and acting on it, not merely a successful submission request.


## Explicit delivery intent

The client can read `recipient()` and submit with `{ mode, expectedStatus, expectedTurnId }` as its third argument. Active recipients require an explicit `queue` or `steer` selection. `queue` calls `thread/queue/add` with a stable response ID as `clientUserMessageId`; its receipt stores `queuedSubmissionId`. `steer` calls `turn/steer` with the observed active turn ID. Idle recipients use `start`; an unloaded thread is resumed without configuration overrides and must then be idle. No error falls back to a different delivery mode. Duplicate reconciliation includes the delivery intent, and unknown outcomes are never automatically resent.

Protocol evidence: generated experimental TypeScript from local `codex-cli 0.155.1` on 2026-09-23 (`ThreadQueueAddParams`, `ThreadQueueAddResponse`, `QueuedSubmission`, `TurnSteerParams`, `TurnStartParams`). The official [remote engineering guide](https://developers.openai.com/blog/mastering-codex-remote-for-engineering) describes queue as waiting for the current response and steer as mid-turn guidance. Adapter tests use fixture RPCs only.

The adapter rejects observed status/turn changes before writing input. The current provider schema has no atomic expected-status condition on thread/queue/add or turn/start: an external state change after the final read remains a provider race. Surface cannot claim atomic compare-and-send for those methods. `turn/steer` does have `expectedTurnId`. Legacy submissions without intent may start an idle thread but cannot implicitly steer an active thread. A failed or unknown recorded submission stays reserved for reconciliation.


## Shared recipient lifecycle

Mounted interaction pages show the common recipient panel. It reads current provider state after hydration, offers both active-turn modes, and keeps delivery selection local to the browser tab. The submission transport shares that choice with the page form. Refresh clears the old choice; a state change requires explicit review again. The adapter and service both revalidate before writing input, and the server revalidates the mount after asynchronous inspection.

Recipient discovery and takeover require `recipientSelection: true` at request creation (`surface request --allow-recipient-selection`). A request capability can then read the bounded provider directory for the registered Git project. Only candidates from the exact canonical worktree can be selected. The server supplies the original socket and root; neither is accepted from the browser. Discovery never resumes threads. `notLoaded` is distinct from an unavailable provider.

Takeover uses `POST .../requests/ID/takeover` with `{ threadId }`. The shared service serializes preflight against submit/close/takeover and atomically creates a new request/token and, if needed, a binding while closing the old request. Submitted requests, including unknown outcomes, cannot be taken over. No response or result is copied. A lost takeover response requires inspection of `replacedBy` and administrative reconciliation, not an automatic replay. Default-list visibility does not grant cross-worktree delivery.

Available fixture verifier (not run by this documentation task): `bun apps/surface/scripts/verify-recipients.ts` uses a real mounted browser page and fixture adapter for queue, independent tabs, explicit recipient change, no replay, stale-state rejection, and desktop/mobile layout. It never sends input to a real conversation.


## Inspecting uncertain delivery

The shared recipient panel distinguishes delivery in progress, runtime acceptance awaiting a result, failed/unknown delivery and an explicitly published result. “Check submission” reads the same request and never sends another response, changes recipient or invents a retry ID. A missing browser acknowledgement retains the submitted response ID in the current tab's session storage when available, including across reload. A successful durable read resolves that local uncertainty only when a response or result is recorded; absence of a record alone does not prove that an in-flight submission had no effect.

Request history and provider inspection are independent. A provider outage must not hide a durable result. Refresh invalidates delivery choices immediately, and stale recipient/directory controls remain disabled until their reads succeed. Existing server preflight and reservation rules remain authoritative; this UI does not reconcile arbitrary provider journals or guarantee exactly-once external effects.

Browser fixture evidence: `verify-recipients.ts` drops an acknowledgement after one provider acceptance, reads the original record, publishes a fixture result while provider inspection fails, and reloads without a second POST or provider delivery. It also checks stale choices remain disabled until refreshed.

## Contextual comment batches — experimental

The user-selected experiment collects element comments and optional frozen element images into one reviewable draft, then submits the batch in an explicit action. Preserve each comment's target, source revision and capture context; distinguish unsent edits, a transport receipt and an actual agent result. Selection and capture alone do not instruct an agent. A preview requested for another device must use the selected private browser origin, and submission must enforce that same origin.

This is an experimental interaction direction, not an adopted general chat API or a replacement for the exact-session request binding above. The [September 23 experiment](../experiments/2026-09-23-element-comments.md) implements a limited playground and local fixture receiver. Adoption requires observed element capture, draft recovery and batch interaction in the intended browser, plus a separately authorized exact-recipient delivery run. HTTPS reachability or a fixture receipt does not satisfy those gates.


### September 23 review correction

User feedback refined the experiment: keep global controls compact and icon-only with accessible names, use a small icon/text connection status, hide the comment drawer until requested, and allow selection of the actual DOM element rather than a manually marked card. Generate a selector from IDs, suitable classes and structural position; a friendly label is presentation metadata, not required instrumentation. Preserve text, revision and an optional image alongside that selector. A selector is not stable identity after arbitrary DOM edits, so unmatched or changed context needs review rather than silent retargeting.

The user explicitly authorized binding manual submissions to the originating conversation. The current experiment uses a private browser capability, a server-owned exact thread/worktree/socket binding, the existing Surface interaction store and Codex adapter, and a separate result callback. Prior fixture records retain their fixture identity and are never automatically forwarded. The [v2 evidence record](../experiments/2026-09-23-element-comments.md#v2-user-review-and-exact-conversation-binding) distinguishes tested delivery logic and read-only live connectivity from an observed user submission. This remains an experimental page, not a general mounted-page or chat API adoption.

The hover/selection identifier in this experiment must show the DOM selector (tag, ID, suitable classes and structural path), not the element's prose. Element text remains separate evidence in the submitted payload. Long paths should wrap rather than hide the selected target behind content-derived labels.

For this minimal review experiment, select elements directly in the workspace; do not show an element dropdown or a persistent step-by-step footer. Draft persistence remains automatic and silent on success. Show storage failures rather than a routine “saved on this browser” status.

### Comment experiment push updates (September 23)

The opt-in comment preview uses authenticated fetch-based SSE for durable batch receipts and complete results. Subscribe before taking the initial snapshot; each committed store update emits a new snapshot. Reconnection reads current state and never resubmits input. Keep the bearer capability in a header, not a stream URL. Heartbeats maintain transport liveness only. Agent availability is checked at connection time and labeled accordingly; it is not continuous agent presence or work progress. Token streaming and execution-event subscriptions remain unimplemented.

The experiment reply shorthand is `bun run reply REQUEST_PREFIX "Message"` from its bound checkout. The prefix must uniquely identify a stored request belonging to the configured conversation and project; there is no latest-request fallback. The CLI wraps text in JSON and retains the legacy callback format.

After integration with main `6dd9083`, identical concurrent comment submissions share the pending bridge operation; a changed payload is rejected. Core preflight remains authoritative. The comment playground currently supplies no explicit delivery intent, so only an idle recipient can accept its submission; an active recipient is rejected with its draft unsent until the page supports an explicit queue/steer choice. Earlier live evidence belongs to the earlier revision. See the [integration evidence](../experiments/2026-09-23-element-comments.md#main-integration-follow-up).

### Typed comments and concise replies

Comment delivery uses the design-system Switch: on is Steer (default), off is Queue. For an idle/not-loaded recipient use Start. Preserve observed status/turn preflight, exact batch identity, draft retention on stale rejection and no automatic replay.

Deliver a minimal `surface.comments` JSON event containing requestId and comments (selector, text, optional imagePath). Include replyTo only for a non-default state directory. Full context remains in durable storage, accessible on demand. Do not embed handling prose, repeated reply commands or mandatory acknowledgement instructions. Reply behavior belongs in the Surface skill: match the user's language, give one concise result for a simple test, and use interim acknowledgement only when useful. Existing callback commands and recorded submissions remain compatible.

Use SSE snapshots and automatic reconnection to monitor results. Show a spinner while an accepted submission awaits a reply (including an optional interim acknowledgement); remove the manual Check submission button. Failed or unknown delivery must remain truthful and must never trigger a resend. Transport acceptance is not an agent reply.

Selection navigation belongs inside the existing green element label beside its selector, before opening the comment editor. Do not duplicate that label in the lower action toolbar. Use an Enter-style send icon for chat submission. The user's mobile feedback supersedes the earlier native selector, ToggleGroup and mandatory two-stage reply design.

Opening comment review must reveal the latest draft at the bottom, including when history already exists. Keep delivery Switch and Send on one compact row. Recipient refresh belongs beside connection status, outside the composer. Remove the experiment JSON export action from the normal comment interface and reserve space so status controls cannot overlap Send.
