# Interaction, drafts and recovery

Source-inspected at `7fceefc`: [recipient panel](../../apps/surface/src/lib/components/RecipientPanel.svelte), [browser client](../../apps/surface/src/client/index.ts), [service](../../apps/surface/src/core/service.ts), [adapter](../../apps/surface/src/adapters/codex.ts). [Agent interaction](../requirements/agent-interaction.md) is the protocol contract. Tables distinguish source behavior from proposed presentation; they do not report a live run.

## D-03: recipient choice and submission

The shared panel selects delivery semantics; the project form owns payload, validation, submit action and domain feedback. Selection alone never submits. The client shares an in-memory delivery choice by scoped request endpoint within the current document; another tab has its own choice.

| Recipient/request state | Current controls and transition | Acceptance boundary |
| --- | --- | --- |
| No request query | Panel absent | Ordinary browsing must remain usable without a binding. |
| Hydration / refresh | Panel initializes after mount; busy disables refresh/select/takeover; previous mode is cleared before fetching request and recipient | Panel does not own or universally disable the project submit button. The project must handle not-ready/rejection states; the server still enforces explicit active mode. |
| Active, open, unsent | “Choose how to send”, Queue after current turn, Steer current turn | User must choose. Steering includes observed turn; no default implicit steering. |
| Idle, open, unsent | Start a new turn is selected | Same thread only. Revalidate on submission. |
| Not loaded, open, unsent | “Not loaded — resumes on send”; start mode | Read-only discovery does not resume. Delivery resumes only the bound thread, rechecks idle state and starts without configuration overrides. |
| Unknown/unavailable recipient | `canSubmit` false; delivery select absent | Never substitute another conversation. Proposed recovery copy must distinguish inspection failure from notLoaded. |
| Recipient selection disabled | No directory/change controls | Requests must explicitly opt in at creation. |
| Recipient selection enabled | Same-worktree candidate select; explicit Confirm recipient change; other worktrees view-only | Confirmation navigates to a new request/token. Service may reuse a matching binding; it closes the old request and copies no response/result. |
| Closed without response | “This interaction is closed.” | No new submission or takeover. Project draft policy is separate. |
| Response exists | Delivery status/receipt mode/error replaces mode controls; takeover hidden | Even failed/unknown responses reserve the request. Acceptance is not completed work. |

## D-04: errors, uncertain effects and recovery

| Event | Current behavior | Recovery contract and presentation gap |
| --- | --- | --- |
| Payload fails schema | Service rejects before reserving response; client throws | Project displays validation error and retains editable input. Preservation is a project responsibility, not guaranteed by the panel. |
| Provider state changes before reservation | Service rejects; recognized submission error clears panel choice | Refresh, inspect current state and confirm again. Fixture checks no response was reserved in this case. |
| Mount disappears during asynchronous preflight | Server revalidates scope and rejects before reservation | Inspect mount/request. Do not choose another mount or thread automatically. |
| Read/refresh fails | Panel shows error with `role="alert"`; earlier recipient/directory may remain displayed | Proposed: visibly label stale data and unavailable provider; old rows are not proof of current eligibility. Server remains authoritative. |
| Adapter explicitly rejects after reservation | Saved response becomes `failed` | Inspect the exact response/attempt; do not turn this into a new request and resend as routine recovery. |
| Timeout, network failure or interrupted delivery | Recorded outcome may be `unknown`; client fetch may throw before a submission event reaches the panel | Retain response ID/payload and inspect original request. A transport exception is not proof that data was never saved. Proposed: shared clear reconciliation instructions. |
| Takeover acknowledgement lost | Original may already be closed with `replacedBy`; panel only shows error | Inspect original administratively and reconcile its successor capability. Do not retry takeover or resubmit an old draft automatically. No self-service capability recovery screen exists. |
| No result before wait deadline | Client polling throws “No result yet”; it never resends | Keep the original request identity; agent work may still be running. Delay does not authorize retry or another recipient. |

Current error strings may expose only a technical cause. Desired presentation should name the affected request, distinguish “not submitted” from “outcome unknown”, and state a safe next inspection action. This is a proposed UI improvement, not an implementation claim. Acceptance is [E-10](../evaluations/ui-eval.md#e-10-failure-and-freshness-presentation).

## D-05: draft ownership

| Data / event | Current owner and guarantee | Required project/design decision |
| --- | --- | --- |
| Unsent project form values | Project component; ordinary locals may reset on remount/HMR | Choose whether loss is acceptable. If meaningful input needs retention, explicitly implement/test its policy. |
| Opted-in preview state | Stable keys and versions in the preview helper survive eligible HMR; full refresh resets | State version changes intentionally reset only matching keys. This is not a general durable draft store. |
| Delivery mode | In-memory client choice; refresh clears it; idle/notLoaded can select start after inspection | Never restore a stale active-turn choice as authority to send. |
| Browser refresh/navigation | No shared domain draft restoration | Page links can reload the document. Proposed: announce loss or offer project-owned restore/discard where needed. |
| Recipient takeover | `location.assign` navigates to new request; no payload is copied or replayed | Current shared UI does not guarantee retaining unsent form values. Proposed: a project may carry a draft explicitly, but must bind it to the new context and require review before submission. |
| Failed submission | Service keeps saved responses; client supplies no general form draft store | Preserve response ID plus original payload on uncertainty; do not generate a replacement ID to bypass reconciliation. |
| Persisted domain data | Project backend/schema, independent of request store | Loading/saving domain data must have explicit meaning; a saved form is not a delivery acknowledgement. |

The [agent-picker lab](../../experiments/agent-picker/README.md) has separate persistence behavior. Its tab-draft evidence is not proof for this shared panel. [E-11](../evaluations/ui-eval.md#e-11-drafts-and-results) evaluates a specific project form's declared lifetime rather than claiming universal retention.

## D-06: evidence of a result

Display and evaluate these separately: local preview → saved response → adapter acceptance (including queue receipt) → observed agent work → published result → rendered change → human acceptance. The panel displays response status and receipt mode, not a complete result viewer. The page can read/poll and render result data or observe source HMR; it owns the meaning of that result. `waitForResult` polls request reads and does not resend. A published result is not cryptographic authorship evidence or proof of a source edit.

A useful result view should relate output to its request and show pending/error/unknown distinctly. That is a proposed project-page criterion unless the specific page already implements it. A user must be able to inspect the outcome before domain adoption; no transport acknowledgement substitutes for acceptance.

## D-09: freshness and discovery

The panel refreshes on initial mount and manual Refresh recipient. Submission events update its request/error; they do not continuously poll provider state, the directory or later results. The directory API includes `available` and `checkedAt`, but the current panel does not display them. An empty candidate list and unavailable provider therefore lack distinct presentation. The current thread ID may also no longer be in the returned candidate list.

Proposed criteria: show directory availability and observation age, distinguish empty from unavailable, explain removed recipients, and prevent stale mode choices from implying readiness. Choose polling ownership, cadence, visibility behavior and failure/backoff policy before adding automatic refresh. Server-side state revalidation remains required even if the UI polls. Polling never authorizes mutation or retries. [E-10](../evaluations/ui-eval.md#e-10-failure-and-freshness-presentation) is open for these states.
