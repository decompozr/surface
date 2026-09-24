# Agent-owned end-to-end verification

This procedure was requested on September 23, 2026 after the comments experiment passed an idle-provider fixture but failed when the actual receiving task was active. Agents own reproducible browser verification before asking a user to retry. This does not replace separately identified physical-device or human acceptance gates.

## Required workflow

1. Inspect the existing worktree, selected preview release and relevant source contract. Preserve WIP, recipient, service state and credentials. Never rebuild a directory served by a running preview.
2. Reproduce the reported journey against the affected immutable build in a disposable service with a fake provider. Save the failed assertion, UI state, screenshot and trace. Match relevant conditions: authentication, recipient activity, existing draft/batch, viewport and reload. If exact reproduction is unavailable, state that limitation instead of declaring the cause proven.
3. Add a regression that fails for the observed behavior, fix it and run the relevant integrated browser matrix. Unit tests, type checks, build success and HTTP 200 are separate checks, not substitutes for a user clicking through the flow.
4. Inspect screenshots when layout matters. Assert user-visible outcomes, error/recovery states, durable state and provider call counts; do not merely assert that internal functions ran.
5. Within existing preview-update authorization, publish a new immutable snapshot only after tests pass, preserving the selected endpoint and recipient. Test the exact snapshot or record its identity with the tested build. Keep fixtures away from real conversations and do not reset user drafts.
6. Record commands, revision plus WIP, snapshot, browsers, scenarios, results, artifacts and limitations. Update the relevant source/evaluation and dated experiment. Report what was observed and what remains unverified. Ask the user only for information or physical-device evidence that the available environment cannot establish.

## Comments experiment: one command

From the repository root with the existing dependencies and Playwright Chromium/WebKit engines installed:

```sh
bun run test:e2e:comments
```

This invokes `scripts/test-comments-e2e.ts`. It runs the app check, targeted delivery tests and build, copies the build into a fresh immutable test snapshot, and runs the browser matrix plus toolbar scroll regressions against disposable loopback services and an isolated Unix-socket provider fixture. It does not start, stop, rebind or submit to the user's preview. A failing step exits nonzero. Evidence defaults to `.decompozr/surface/comments-e2e/<timestamp>/`; set `COMMENTS_E2E_OUTPUT` to a new directory to choose another destination. Do not reuse an existing snapshot directory.

Playwright is the browser automation framework (`@playwright/test`); these verifiers are executable Bun scripts using its browser engines and assertions, not a conventional `playwright test` configuration. If engines are absent, install the pinned project's engines with `bunx playwright install chromium webkit`; do not upgrade dependencies or modify shared registration to make a test pass.

### Required delivery matrix

Each row runs in desktop Chromium and iPhone-sized WebKit. Mobile emulation is not a physical iPhone.

| Scenario | Required observation |
| --- | --- |
| Missing, invalid, then valid capability | Sending remains disabled before authorization; changing only the URL fragment enables sending without a document reload or loss of the saved comment/capture |
| Idle receiver | Explicit send starts the bound task once |
| Active receiver | No delivery until the user chooses queue or steer; desktop exercises steer, mobile exercises queue; queue is labeled Queued rather than completed work |
| Active turn changes before confirmation | The previous choice sends nothing; the user must confirm against the newly observed turn |
| POST acknowledgement lost | Backend accepts once, automatic read-only monitoring reconciles the retained batch, and no manual retry button or second POST is needed |
| Full return loop | Capture is a PNG saved for the provider; actual reply CLI publishes a result; browser receives it over SSE |
| Offline and reload | Reconnection reads durable results; reload retains them; exactly one fixture provider delivery occurred for the batch |

The delivery unit suite also verifies duplicate requests, stale turn rejection, recipient mismatch and uncertain outcomes. The consolidated UI retains the newer design-system Switch (on means Steer, off means Queue), compact typed events and automatic result monitoring. It does not restore the superseded delivery-choice buttons or manual check action. A queue receipt is acceptance into a queue, not evidence that a real agent consumed it.

### Reproduce a specific immutable release

The lower-level verifier accepts the directory containing `build/index.js` and uses new isolated state regardless of the build's original preview:

```sh
COMMENTS_E2E_BUILD_DIR=/absolute/immutable/release \
COMMENTS_E2E_OUTPUT=/absolute/new/evidence-directory \
COMMENTS_E2E_ACTIVE=1 \
bun apps/surface/comments/full-loop.e2e.ts
```

Use `COMMENTS_E2E_ACTIVE=0` for idle. Both modes include lost-acknowledgement recovery. An old broken build is expected to fail the current acceptance assertions. The script retains screenshots/traces and reports the tested release; it never uses the real preview connection file as its receiver.

Other focused regressions are `apps/surface/comments/mobile-desktop.e2e.ts`, `viewport.e2e.ts` and `toolbar-scroll.e2e.ts`. They require an isolated loopback origin via `COMMENTS_E2E_ORIGIN`; inspect their setup and assertions before use. Run those relevant to a changed layout, viewport or selection behavior. Synthetic visual-viewport tests do not establish native keyboard behavior, and transform assertions do not establish physical-device frame timing.

## Evidence boundaries

The fake provider exercises the real browser, HTTP routes, persistence, adapter protocol, reply CLI and SSE. It cannot establish that a real Codex task consumes a queued input, that the user's phone shares browser storage with a link, or that iOS keyboard/compositor behavior matches emulation. Observe live transport read-only where appropriate; reserve real submissions for the user's explicitly authorized interaction. Do not describe fixture success as live-user acceptance.
