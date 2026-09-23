# Agent interaction

## Intent and status

Surface should let a user submit a choice, form, or parameter set from a page directly into the agent session that created the interaction. The agent introduces itself to Surface, which binds page responses to that existing conversation and delivers them through an adapter.

The preferred design is direct session input: steer an active turn, or continue an idle conversation with a new turn when the agent runtime supports it. Keeping an agent blocked on a waiting tool call is not required.

This is an agreed product direction with an initial implementation. The prototype registers Codex session bindings, creates one-response interaction requests, accepts page submissions, records delivery outcomes, and lets an agent publish a result back to the page. Live active-turn steering and idle continuation have been observed. The wider contract remains exploratory; see [prototype usage and evidence](prototype.md) for verified behavior and limits.

## Interaction flow

1. An agent registers its project, existing session identity, and delivery mechanism with Surface.
2. The agent creates a page and an interaction request bound to that session.
3. The user opens the page, selects an option or edits parameters, and presses a submit button.
4. The page sends structured data to Surface's backend using its scoped interaction reference.
5. The backend validates the request binding and payload, saves the response, and resolves the registered agent adapter.
6. The adapter delivers the input to the existing conversation using the runtime's supported steering or continuation mechanism.
7. Surface records what the runtime acknowledged. The agent interprets the response and can update the page through its normal project tools.

The browser does not need to know which agent CLI or protocol is used. A page remains ordinary frontend code with an explicit submission action.

## Agent introduction and request binding

The proposed registration records:

| Field | Purpose |
| --- | --- |
| Surface session binding ID | Local reference used by Surface to identify the registration |
| Agent provider and adapter | Select the supported delivery implementation |
| Provider session or thread ID | Identify the existing conversation; use an exact ID rather than the most-recent session |
| Project identity | Associate the conversation with its source workspace |
| Control endpoint and backend credential reference | Reach the runtime that owns the session; keep credentials out of page content |
| Delivery capabilities | Describe support for active-turn steering, idle continuation, and delivery acknowledgements |

A display name may help the user recognize the agent but is not sufficient for routing. A session ID alone is also insufficient without access to the runtime that can control it.

Each interaction request binds a project, page or artifact revision, agent session binding, and expected response schema. It also records whether the request is still open. The backend checks these relationships rather than trusting a browser-supplied destination session.

The active turn ID is live state, not a permanent registration field. The adapter must obtain or track the current turn when it delivers input.

## Response data

An illustrative page submission could be:

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

The request determines the destination. The response ID identifies one submission across transport retries. Editing a selection and submitting again is a new response, subject to whether the request allows further responses.

Delivery should preserve the request and response identity alongside user data so the agent can relate the message to its original question. The exact schema and request expiry rules remain to be validated.

## CLI and backend integration

The prototype CLI exposes the shared delivery path with an explicit request and response identity:

```bash
bun run surface send \
  --request "REQUEST_ID" \
  --response-id "RESPONSE_ID" \
  --data '{"option":"B","width":120,"comment":"Use this version"}'
```

The request resolves to the registered session, so callers do not supply a second destination that could disagree with it. The CLI and page endpoint use the same validation and delivery operations. The implemented Codex adapter calls the native control API; a configured agent CLI remains another possible adapter mechanism.

The delivered message includes a `result` CLI operation scoped to the request. When the agent executes it, the backend records a separate result and the page displays it. This updates page data; it does not establish that the agent edited a component's source code.

For a CLI adapter, use a known executable with discrete arguments or stdin for payload data. Page input supplies data, not executable names or shell command strings. The agent provider and its configured adapter determine how the data reaches the session.

## Codex capability evidence

Inspected on 2026-09-20:

| Mechanism | Confirmed evidence | Validation still needed |
| --- | --- | --- |
| App Server `turn/steer` | Documented active-turn input with matching `threadId` and `expectedTurnId`; live page submission was accepted into the exact active turn and the agent published a result | Broader runtime versions and concurrent-client behavior |
| App Server `turn/start` | Documented same-thread generation; live page submission continued an idle test conversation and the agent published a result | Broader runtime versions and unloaded-session recovery |
| `codex queue --thread <id> --message <text>` | Local `codex-cli 0.154.0` help describes queuing a message for an existing session | Whether it steers immediately, queues for a later turn, or activates an idle session in the intended environment |
| `codex exec resume <session-id> <prompt>` | Local CLI help describes resuming a saved session non-interactively | Whether its execution and conversation visibility suit this integration; it is not established as live-session steering |

Source for the App Server behavior: [official Codex App Server documentation](https://learn.chatgpt.com/docs/app-server). CLI availability evidence came from `codex --version`, `codex queue --help`, and `codex exec resume --help`; neither CLI delivery command has been exercised. The live proof used the App Server adapter and a dedicated test conversation, as recorded in [prototype evidence](prototype.md#validation-on-2026-09-20).

The Codex adapter should connect to the authorized runtime owning the target session. Starting an unrelated App Server does not by itself establish control of an already running conversation. Endpoint discovery and access are part of the experiment.

For an active turn, use its current ID with `turn/steer`. For an idle conversation, start a turn in that same thread. If state changes between inspection and delivery, reconcile current state and the delivery result before deciding whether another attempt is appropriate. Do not silently fork a thread, select the latest conversation, or create a replacement session.

These are provider-specific capabilities. Other agents need adapters with their own verified behavior; accepting MCP connections alone does not establish support for steering an existing agent conversation.

## Delivery outcomes

Distinguish a response saved by Surface, input accepted by the agent runtime, and an agent action observed afterward. A successful CLI exit or protocol acknowledgement is not proof that the agent finished the requested work.

The proposed backend retains response and attempt records so failures can be inspected. Repeated delivery of an already accepted response should not deliberately trigger another action. If a timeout leaves acceptance uncertain, report that uncertainty and reconcile it where possible instead of blindly resending. Exactly-once execution is not assumed.

Reject closed or stale requests explicitly. If the session or control endpoint is unavailable, retain the submission and expose the delivery failure; replay and retention policies remain to be decided. No automatic fallback should change the destination conversation.

## First proof

Use one Svelte page with options A and B, a width parameter, and a submit button. Deliver the selection to its originating agent session and observe the agent modify the page accordingly. Exercise both active-turn steering and idle continuation separately.

See [experiment 1B](exploration.md#experiment-1b-a-button-steers-the-originating-agent-session) for acceptance criteria. Success requires evidence of the same conversation receiving the correct data and acting on it, not merely a successful submission request.


## Contextual comment batches — experimental

The user-selected experiment collects element comments and optional frozen element images into one reviewable draft, then submits the batch in an explicit action. Preserve each comment's target, source revision and capture context; distinguish unsent edits, a transport receipt and an actual agent result. Selection and capture alone do not instruct an agent. A preview requested for another device must use the selected private browser origin, and submission must enforce that same origin.

This is an experimental interaction direction, not an adopted general chat API or a replacement for the exact-session request binding above. The [September 23 experiment](experiments/2026-09-23-element-comments.md) implements a limited playground and local fixture receiver. Adoption requires observed element capture, draft recovery and batch interaction in the intended browser, plus a separately authorized exact-recipient delivery run. HTTPS reachability or a fixture receipt does not satisfy those gates.


### September 23 review correction

User feedback refined the experiment: keep global controls compact and icon-only with accessible names, use a small icon/text connection status, hide the comment drawer until requested, and allow selection of the actual DOM element rather than a manually marked card. Generate a selector from IDs, suitable classes and structural position; a friendly label is presentation metadata, not required instrumentation. Preserve text, revision and an optional image alongside that selector. A selector is not stable identity after arbitrary DOM edits, so unmatched or changed context needs review rather than silent retargeting.

The user explicitly authorized binding manual submissions to the originating conversation. The current experiment uses a private browser capability, a server-owned exact thread/worktree/socket binding, the existing Surface interaction store and Codex adapter, and a separate result callback. Prior fixture records retain their fixture identity and are never automatically forwarded. The [v2 evidence record](experiments/2026-09-23-element-comments.md#v2-user-review-and-exact-conversation-binding) distinguishes tested delivery logic and read-only live connectivity from an observed user submission. This remains an experimental page, not a general mounted-page or chat API adoption.

The hover/selection identifier in this experiment must show the DOM selector (tag, ID, suitable classes and structural path), not the element's prose. Element text remains separate evidence in the submitted payload. Long paths should wrap rather than hide the selected target behind content-derived labels.

For this minimal review experiment, select elements directly in the workspace; do not show an element dropdown or a persistent step-by-step footer. Draft persistence remains automatic and silent on success. Show storage failures rather than a routine “saved on this browser” status.

### Comment experiment push updates (September 23)

The opt-in comment preview uses authenticated fetch-based SSE for durable batch receipts and complete results. Subscribe before taking the initial snapshot; each committed store update emits a new snapshot. Reconnection reads current state and never resubmits input. Keep the bearer capability in a header, not a stream URL. Heartbeats maintain transport liveness only. Agent availability is checked at connection time and labeled accordingly; it is not continuous agent presence or work progress. Token streaming and execution-event subscriptions remain unimplemented.

The experiment reply shorthand is `bun run reply REQUEST_PREFIX "Message"` from its bound checkout. The prefix must uniquely identify a stored request belonging to the configured conversation and project; there is no latest-request fallback. The CLI wraps text in JSON and retains the legacy callback format.
