# Agent interaction

## Intent and status

Artifact should let a user submit a choice, form, or parameter set from a page directly into the agent session that created the interaction. The agent introduces itself to Artifact, which binds page responses to that existing conversation and delivers them through an adapter.

The preferred design is direct session input: steer an active turn, or continue an idle conversation with a new turn when the agent runtime supports it. Keeping an agent blocked on a waiting tool call is not required.

This is an agreed product direction with a proposed technical contract. No Artifact session registry, response endpoint, CLI command, or agent adapter has been implemented. Codex documentation and local CLI help have been inspected; end-to-end delivery has not been tested.

## Interaction flow

1. An agent registers its project, existing session identity, and delivery mechanism with Artifact.
2. The agent creates a page and an interaction request bound to that session.
3. The user opens the page, selects an option or edits parameters, and presses a submit button.
4. The page sends structured data to Artifact's backend using its scoped interaction reference.
5. The backend validates the request binding and payload, saves the response, and resolves the registered agent adapter.
6. The adapter delivers the input to the existing conversation using the runtime's supported steering or continuation mechanism.
7. Artifact records what the runtime acknowledged. The agent interprets the response and can update the page through its normal project tools.

The browser does not need to know which agent CLI or protocol is used. A page remains ordinary frontend code with an explicit submission action.

## Agent introduction and request binding

The proposed registration records:

| Field | Purpose |
| --- | --- |
| Artifact session binding ID | Local reference used by Artifact to identify the registration |
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

A possible Artifact CLI shape is shown below. This command is a proposal and does not exist yet:

```bash
artifact agent send \
  --session <binding-id> \
  --request <request-id> \
  --data '{"option":"B","width":120}'
```

The CLI would use the same validation and delivery operations as the page submission endpoint. Its explicit session must match the request binding. The backend can invoke a configured agent CLI, or call a native control API directly; it need not launch Artifact's own CLI for every click.

For a CLI adapter, use a known executable with discrete arguments or stdin for payload data. Page input supplies data, not executable names or shell command strings. The agent provider and its configured adapter determine how the data reaches the session.

## Codex capability evidence

Inspected on 2026-09-20:

| Mechanism | Confirmed evidence | Validation still needed |
| --- | --- | --- |
| App Server `turn/steer` | Official documentation describes appending input to an active turn using `threadId` and matching `expectedTurnId`; it fails when no turn is active | Delivery into the actual runtime owning a registered Artifact session |
| App Server `turn/start` | Official documentation describes starting generation in a specified thread; `thread/resume` reopens an existing thread when needed | Continuing an idle registered conversation and observing its response |
| `codex queue --thread <id> --message <text>` | Local `codex-cli 0.154.0` help describes queuing a message for an existing session | Whether it steers immediately, queues for a later turn, or activates an idle session in the intended environment |
| `codex exec resume <session-id> <prompt>` | Local CLI help describes resuming a saved session non-interactively | Whether its execution and conversation visibility suit this integration; it is not established as live-session steering |

Source for the App Server behavior: [official Codex App Server documentation](https://learn.chatgpt.com/docs/app-server). Local CLI evidence came from `codex --version`, `codex queue --help`, and `codex exec resume --help`; no message was sent during that inspection.

The Codex adapter should connect to the authorized runtime owning the target session. Starting an unrelated App Server does not by itself establish control of an already running conversation. Endpoint discovery and access are part of the experiment.

For an active turn, use its current ID with `turn/steer`. For an idle conversation, start a turn in that same thread. If state changes between inspection and delivery, reconcile current state and the delivery result before deciding whether another attempt is appropriate. Do not silently fork a thread, select the latest conversation, or create a replacement session.

These are provider-specific capabilities. Other agents need adapters with their own verified behavior; accepting MCP connections alone does not establish support for steering an existing agent conversation.

## Delivery outcomes

Distinguish a response saved by Artifact, input accepted by the agent runtime, and an agent action observed afterward. A successful CLI exit or protocol acknowledgement is not proof that the agent finished the requested work.

The proposed backend retains response and attempt records so failures can be inspected. Repeated delivery of an already accepted response should not deliberately trigger another action. If a timeout leaves acceptance uncertain, report that uncertainty and reconcile it where possible instead of blindly resending. Exactly-once execution is not assumed.

Reject closed or stale requests explicitly. If the session or control endpoint is unavailable, retain the submission and expose the delivery failure; replay and retention policies remain to be decided. No automatic fallback should change the destination conversation.

## First proof

Use one Svelte page with options A and B, a width parameter, and a submit button. Deliver the selection to its originating agent session and observe the agent modify the page accordingly. Exercise both active-turn steering and idle continuation separately.

See [experiment 1B](exploration.md#experiment-1b-a-button-steers-the-originating-agent-session) for acceptance criteria. Success requires evidence of the same conversation receiving the correct data and acting on it, not merely a successful submission request.
