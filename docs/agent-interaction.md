# Agent interaction

## Intent and status

Surface should let a user submit a choice, form, or parameter set from a page directly into the agent session that created the interaction. The agent introduces itself to Surface, which binds page responses to that existing conversation and delivers them through an adapter.

The preferred design is explicit delivery to the existing session: let the user queue input after an active turn or steer that turn, and continue an idle conversation with a new turn when the agent runtime supports it. Keeping an agent blocked on a waiting tool call is not required.

This is an agreed product direction with an initial implementation. The prototype registers Codex session bindings, creates one-response interaction requests, accepts page submissions, records delivery outcomes, and lets an agent publish a result back to the page. Live active-turn steering and idle continuation have been observed. The wider contract remains exploratory; see [prototype usage and evidence](prototype.md) for verified behavior and limits.

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

The proposed registration records:

| Field | Purpose |
| --- | --- |
| Surface session binding ID | Local reference used by Surface to identify the registration |
| Agent provider and adapter | Select the supported delivery implementation |
| Provider session or thread ID | Identify the existing conversation; use an exact ID rather than the most-recent session |
| Project identity | Associate the conversation with its source workspace |
| Control endpoint and backend credential reference | Reach the runtime that owns the session; keep credentials out of page content |
| Delivery capabilities | Describe support for active-turn queueing and steering, idle continuation, and delivery acknowledgements |

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

For an active turn, require the user to select queue or steer. Queue uses `thread/queue/add`; steering uses the observed turn ID with `turn/steer`. For an idle conversation, start a turn in that same thread. If state changes between inspection and delivery, reconcile current state and the delivery result before deciding whether another attempt is appropriate. Do not silently fork a thread, select the latest conversation, or create a replacement session.

These are provider-specific capabilities. Other agents need adapters with their own verified behavior; accepting MCP connections alone does not establish support for steering an existing agent conversation.

## Delivery outcomes

Distinguish a response saved by Surface, input accepted by the agent runtime, and an agent action observed afterward. A successful CLI exit or protocol acknowledgement is not proof that the agent finished the requested work.

The proposed backend retains response and attempt records so failures can be inspected. Repeated delivery of an already accepted response should not deliberately trigger another action. If a timeout leaves acceptance uncertain, report that uncertainty and reconcile it where possible instead of blindly resending. Exactly-once execution is not assumed.

Reject closed or stale requests explicitly. If the session or control endpoint is unavailable, retain the submission and expose the delivery failure; replay and retention policies remain to be decided. No automatic fallback should change the destination conversation.

## First proof

Use one Svelte page with options A and B, a width parameter, and a submit button. Deliver the selection to its originating agent session and observe the agent modify the page accordingly. Exercise both active-turn steering and idle continuation separately.

See [experiment 1B](exploration.md#experiment-1b-a-button-steers-the-originating-agent-session) for acceptance criteria. Success requires evidence of the same conversation receiving the correct data and acting on it, not merely a successful submission request.


## Explicit delivery intent

The client can read `recipient()` and submit with `{ mode, expectedStatus, expectedTurnId }` as its third argument. Active recipients require an explicit `queue` or `steer` selection. `queue` calls `thread/queue/add` with a stable response ID as `clientUserMessageId`; its receipt stores `queuedSubmissionId`. `steer` calls `turn/steer` with the observed active turn ID. Idle recipients use `start`; an unloaded thread is resumed without configuration overrides and must then be idle. No error falls back to a different delivery mode. Duplicate reconciliation includes the delivery intent, and unknown outcomes are never automatically resent.

Protocol evidence: generated experimental TypeScript from local `codex-cli 0.155.1` on 2026-09-23 (`ThreadQueueAddParams`, `ThreadQueueAddResponse`, `QueuedSubmission`, `TurnSteerParams`, `TurnStartParams`). The official [remote engineering guide](https://developers.openai.com/blog/mastering-codex-remote-for-engineering) describes queue as waiting for the current response and steer as mid-turn guidance. Adapter tests use fixture RPCs only.

The adapter rejects observed status/turn changes before writing input. The current provider schema has no atomic expected-status condition on thread/queue/add or turn/start: an external state change after the final read remains a provider race. Surface cannot claim atomic compare-and-send for those methods. `turn/steer` does have `expectedTurnId`. Legacy submissions without intent may start an idle thread but cannot implicitly steer an active thread. A failed or unknown recorded submission stays reserved for reconciliation.


## Shared recipient lifecycle

Mounted interaction pages show the common recipient panel. It reads current provider state after hydration, offers both active-turn modes, and keeps delivery selection local to the browser tab. The submission transport shares that choice with the page form. Refresh clears the old choice; a state change requires explicit review again. The adapter and service both revalidate before writing input, and the server revalidates the mount after asynchronous inspection.

Recipient discovery and takeover require `recipientSelection: true` at request creation (`surface request --allow-recipient-selection`). A request capability can then read the bounded provider directory for the registered Git project. Only candidates from the exact canonical worktree can be selected. The server supplies the original socket and root; neither is accepted from the browser. Discovery never resumes threads. `notLoaded` is distinct from an unavailable provider.

Takeover uses `POST .../requests/ID/takeover` with `{ threadId }`. The shared service serializes preflight against submit/close/takeover and atomically creates the new binding/request/token while closing the old request. Submitted requests, including unknown outcomes, cannot be taken over. No response or result is copied. A lost takeover response requires inspection of `replacedBy` and administrative reconciliation, not an automatic replay. Default-list visibility does not grant cross-worktree delivery.

Validation: `bun apps/surface/scripts/verify-recipients.ts` uses a real mounted browser page and fixture adapter for queue, independent tabs, explicit recipient change, no replay, stale-state rejection, and desktop/mobile layout. It never sends input to a real conversation.
