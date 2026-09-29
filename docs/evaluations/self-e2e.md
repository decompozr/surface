# Agent-owned end-to-end verification

This procedure was requested on September 23, 2026 after the comments experiment passed an idle-provider fixture but failed when the actual receiving task was active. Agents own reproducible browser verification before asking a user to retry. This does not replace separately identified physical-device or human acceptance gates.

## Required workflow

1. Inspect the existing worktree, selected preview release and relevant source contract. Preserve WIP, recipient, service state and credentials. Never rebuild a directory served by a running preview.
2. Reproduce the reported journey against the affected immutable build in a disposable service with a fake provider. Save the failed assertion, UI state, screenshot and trace. Match relevant conditions: authentication, recipient activity, existing draft/batch, viewport and reload. If exact reproduction is unavailable, state that limitation instead of declaring the cause proven.
3. Add a regression that fails for the observed behavior, fix it and run the relevant integrated browser matrix. Unit tests, type checks, build success and HTTP 200 are separate checks, not substitutes for a user clicking through the flow.
4. Inspect screenshots when layout matters. Assert user-visible outcomes, error/recovery states, durable state and provider call counts; do not merely assert that internal functions ran.
5. Within existing preview-update authorization, publish a new immutable snapshot only after tests pass, preserving the selected endpoint and recipient. Test the exact snapshot or record its identity with the tested build. Keep fixtures away from real conversations and do not reset user drafts.
6. Record commands, revision plus WIP, snapshot, browsers, scenarios, results, surfaces and limitations. Update the relevant source/evaluation and dated experiment. Report what was observed and what remains unverified. Ask the user only for information or physical-device evidence that the available environment cannot establish.

## Comments verification: one command

From the repository root with the existing dependencies and Playwright Chromium/WebKit engines installed:

```sh
bun run test:e2e:comments
```

This invokes `tests/e2e/comments/run.ts`. It checks and builds a disposable production source snapshot, then builds a separate snapshot with the overlay in `tests/fixtures/comments-app`. Mounted-page tests use the untouched production build; selection/capture geometry and demo delivery tests use the fixture build. Both use isolated loopback services and a Unix-socket provider fixture. It does not start, stop, rebind or submit to the user's preview. A failing step exits nonzero. Builds and copied dependencies are removed on exit. Screenshots, traces, source inventories and reports default to `.decompozr/surface/comments-e2e/<timestamp>/`; use `COMMENTS_E2E_OUTPUT` to select a new output directory and summarize/retire completed evidence under the repository retention policy.

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

The lower-level fixture verifier requires an explicitly provided test build containing the comments overlay and `build/index.js`. It uses new isolated state:

```sh
COMMENTS_E2E_BUILD_DIR=/absolute/immutable/fixture-app \
COMMENTS_E2E_OUTPUT=/absolute/new/evidence-directory \
COMMENTS_E2E_ACTIVE=1 \
bun tests/e2e/comments/full-loop.e2e.ts
```

Use `COMMENTS_E2E_ACTIVE=0` for idle. Both modes include lost-acknowledgement recovery. An old broken build is expected to fail the current acceptance assertions. The script retains screenshots/traces and reports the tested release; it never uses the real preview connection file as its receiver.

Other focused regressions are `tests/e2e/comments/mobile-desktop.e2e.ts`, `viewport.e2e.ts` and `toolbar-scroll.e2e.ts`. They require an isolated loopback origin via `COMMENTS_E2E_ORIGIN`; inspect their setup and assertions before use. Run those relevant to a changed layout, viewport or selection behavior. Synthetic visual-viewport tests do not establish native keyboard behavior, and transform assertions do not establish physical-device frame timing.

## Evidence boundaries

The fake provider exercises the real browser, HTTP routes, persistence, adapter protocol, reply CLI and SSE. It cannot establish that a real Codex task consumes a queued input, that the user's phone shares browser storage with a link, or that iOS keyboard/compositor behavior matches emulation. Observe live transport read-only where appropriate; reserve real submissions for the user's explicitly authorized interaction. Do not describe fixture success as live-user acceptance.

## Ordinary mounted pages

The same command freezes the production app host, compiler and comment sources into a separate test snapshot and runs `tests/e2e/comments/mounted.e2e.ts` in idle/active × Chromium/WebKit profiles. It creates a separate temporary Git fixture project (no linked worktree), local service/storage and provider socket. The mounted fixture owns ordinary Svelte content and a domain request schema; it does not import a comment component.

In addition to the existing matrix, verify normal project controls before selection, selection of controls through nested presentation spans, 320px review and 400px-high editing, per-page/request draft separation, request-token isolation, browser-token rejection at the reply endpoint, and preservation of the original domain response/schema. Retain screenshots/traces and the snapshot file-hash manifest. The runtime compiler and the built shell are both part of the tested snapshot; a built experimental page alone cannot verify mounted behavior.

The interaction audit covers roving keyboard focus with ArrowLeft/Right and Home/End, 44px toolbar targets and actual 32px compact navigation rows without overlapping hit regions, independent navigation/review scrolling, capture/editor bounds and transient feedback that leaves actions reachable. Wait for image layout and measured placement to settle before recording geometry. A status row is reserved space even where its background does not intercept pointer events.


## Installed candidate gate

Run the mounted verifier against an explicitly isolated installation to cover the actual bundled launcher/runtime and frozen design-system assets. Set `COMMENTS_E2E_INSTALLED_HOME` to a stopped test home containing `e2e-fixture.json` with `{"purpose":"isolated-release-verification"}` and set `COMMENTS_E2E_APP_DIR` to its active release's `apps/surface`. This mode starts/stops only that marked installation, uses its launcher with a system-only PATH to register/mount/bind/request, and invokes its bundled runtime for replies. It never selects the default installation. Run both idle and active modes in new evidence directories. The normal source-snapshot mode remains available.

Test upgrade/rollback separately from browser delivery: preserve a registered project, its identity, draft/request/result records and project data through stopped activation changes. A successful package build does not prove the installed flow. Retain the exact archive/checksum, source commit and provider pin; a release candidate is not a signed or notarized general-availability release.

`COMMENTS_E2E_PREPARED_RELEASE=/absolute/extracted-release bun run test:e2e:comments` verifies a packaged release with integrity checks before and after the matrix. It skips rebuilding that immutable package, uses it directly for mounted tests, and compiles the test-only overlay in a disposable copy for fixture tests. Source checking with the same frozen dependencies and installed lifecycle acceptance are separate [candidate gates](release-candidate.md).
