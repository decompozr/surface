# Mounted-page contextual comments

## Authority and baseline

Marker: `surface-mounted-comments-same-worktree-20260924`. The user requested immediate continuation in the same worktree with no agents, new worktrees, preview recipient changes, other-checkout edits, cleanup or caller archival. Documentation is English; discussion is Traditional Chinese.

Intake verified branch `wip/comments-main-integration-20260923`, HEAD `f5048de2103fb9b9ffdbd4733817a8ad46b6cc30`, and all 382 handoff manifest entries with no content/mode mismatch. Runtime thread `01a0d174-3231-7010-ade6-b8bba551d539` accepted the receipt while preserving its original fields. The extensive old-HEAD WIP intentionally includes consolidated main/PR53 changes; it is not an unmerged-change backlog. No commit, branch move, installation or publication is implied.

## Bounded question and implementation

Can the validated selection/capture/comment experience operate on an ordinary mounted project component while preserving domain behavior, exact recipient scope, explicit delivery and automatic result monitoring?

The shared `CommentWorkspace` wraps both demo content and mounted project content. Mounted pages initially interact normally. Browser drafts/capabilities are keyed by page and parent request. The request-scoped comment bridge reuses the bound conversation and existing typed comment delivery path, with separate durable batches and callback credentials. The original domain schema/response remains untouched. Comments cannot send from an unbound page. Mount identity and parent closure are revalidated after recipient inspection. Callback publication remains possible for accepted work after closure/unmount.

Component-file SHA-256, observed text, selector and frozen DOM-rendered PNG provide bounded context. The component hash does not include imported dependencies; HMR observations are marked unverified. Changed saved context retains the user's text/image instead of silently selecting a different element.

## Verification log

Evidence root: `.decompozr/surface/mounted-comments-20260924/`. Each run preserves its snapshot and artifacts.

- `run-1`: app check (0 errors/warnings), targeted comment delivery tests and build passed. All four historical demo full-loop profiles passed after extraction. The mounted fixture stopped before browser execution because its temporary path was not canonical on macOS. Corrected only fixture setup.
- `mounted-repro-2`: fixture source validation correctly rejected a missing project-owned package manifest. Added the normal pinned Svelte package/route manifest to the isolated fixture.
- `mounted-repro-3`: retained screenshot and trace reproduce a blank mounted page. Trace identifies HTTP 403 for shared compiler dependencies after the immutable source snapshot resolves dependency symlinks. Corrected runtime allow checks to use the canonical compiler dependency directory. This is a source-host integration failure, not a real-user preview observation.
- `run-2`: historical demo profiles passed; the new mounted browser assertion caught the parent-selection button's hover background overriding the required transparent label treatment. Adjusted the application selector to account for runtime-compiled design-system state specificity; no provider package edits.
- `mounted-repro-4`: both active mounted Chromium/WebKit flows passed, including screenshot, stale turn, lost acknowledgement, compact typed event, actual reply CLI, SSE, offline recovery and reload with one delivery. Inspected desktop selection and mobile result captures.
- `recipient-fragment-before`: an added regression reproduces the original domain recipient panel retaining its missing-capability error after the comments transport reconnects through a valid fragment. The failure is retained with screenshot/trace. Added fragment reconnection and generation guards to the existing recipient panel without resetting domain drafts.
- `run-3`: complete eight-profile demo/mounted matrix and both toolbar scroll regressions passed after fragment reconnection. Subsequent refinement retained ordinary mounted navigation/breadcrumbs and added an actual independent project-domain submission/result check.
- `final-matrix`: `bun run test:e2e:comments` passed app check (0 errors/warnings), 12 targeted tests, build, eight full-loop profiles and Chromium/WebKit toolbar regressions. Each mounted profile additionally submitted the project's domain form through its original client/request, published its separate result, and retained the comment reply.
- `closed-duplicate-before.log`: regression caught an accepted duplicate being mislabeled unsubmitted after parent closure. Moved closure validation to the pre-reservation guard so an already accepted identical batch returns its durable receipt without another delivery. Both guard tests then passed (32 assertions).
- `final-mounted/{idle,active}`: reran all four affected mounted profiles against a new immutable source/build snapshot after the closure guard change. All passed; each profile made exactly one comment delivery plus one separately authorized fixture domain-form delivery. No real task was contacted.
- `final-mounted/visual-settled`: both active profiles passed again with an explicit final-drawer-width wait. Inspected desktop/mobile result PNGs: ordinary navigation, 350px desktop drawer, captured element, latest draft, Switch and send action remain visible without horizontal clipping. Earlier transition-frame captures are retained as earlier evidence.

At original completion, production sources matched `final-mounted/app/` byte-for-byte. The only snapshot/current difference is the verifier's final-width screenshot wait; its executed hash is recorded in ignored `completion.json`. The final snapshot manifest SHA-256 is `0ec909e12ca977d3569cab03333758df6d22985522bc4df91dcbc6fab6ee4d5d`. Source/build snapshots retain the existing dependency links; this task did not modify their targets.

Root TypeScript, runtime TypeScript, production application-boundary test (125 assertions) and diff whitespace checks passed. The repository-wide documentation checker still reports 16 old broken links/anchors; all 16 references also occur in merged baseline `c155280299189e6ea403dca1edc5272e1086a373`, and none points from the newly added integration record. Full output is retained in `docs-check.txt`. They are not silently presented as a passing documentation gate.

## Source disposition and limits

Adopted within the user's bounded request: [interaction requirements](../requirements/agent-interaction.md#mounted-page-contextual-comments-september-24-adoption), [component ownership](../architecture/components.md#mounted-comment-ownership), [page guide](../../skills/surface/references/pages.md#contextual-comments-on-mounted-pages), and [self-owned E2E](../evaluations/self-e2e.md#ordinary-mounted-pages).

Isolated provider fixtures do not prove live queue consumption, deployment, physical iPhone keyboard/compositor behavior or arbitrary content capture fidelity. The old 8466 preview and other owner's 8467 preview remain unchanged. No test sends input to a real conversation. Existing WIP, dependency links, archives and handoff records are retained.


## Integration follow-up against PR54

The user requested continuation after the original completion. Main had advanced to `327de2f100d2d0548668e90b9e6fa8b890c5b2e5` (PR54). Reconciled the shared component with its compact selection strip, short labels, semantic control selection, reserved status row, manual-history scrolling and automatic UX gate. The current worktree branch, HEAD and original index remain unchanged; a separate Git index describes only the increment over that main revision. The full pre-reconciliation source archive remains at `.decompozr/surface/mounted-comments-integration-20260924/before.tar.gz`.

Follow-up evidence root: `.decompozr/surface/mounted-comments-integration-20260924/`.

- `matrix-1`: all demo profiles and mounted idle profiles passed. The active mobile fixture's selected-parent strip covered the adjacent heading's click point. The verifier now uses the visible Clear selection action before selecting that heading; no forced click or production hit-testing bypass.
- `keyboard-before`: reproduced loss of direction-key navigation in the upstream compact strip. Restored roving keyboard focus locally without changing the shared design-system checkout. `keyboard-after` passed desktop focus checks; its immediate mobile capture geometry assertion sampled before the ResizeObserver adjustment.
- `audit-settled`: all three desktop/touch interaction profiles passed after waiting for final measured editor bounds. The legacy viewport verifier still assumed an overlay status bar; updated it for the adopted reserved 44px row. `viewport-reserved` exposed another obsolete geometry assumption: a 50px anchor scroll remained bottom-clamped. The verifier now moves the anchor 120px, far enough to observe anchored movement. `viewport-scroll` passed Chromium and WebKit keyboard resize/pan, focused scrolling and draft retention.
- `narrow-audit`: mounted active desktop/mobile flows passed. Inspection of the 320px review capture found Added to draft covering Send; the short editor capture also included a drawer transition. Retire that confirmation on entering review/editing, keep transport notices in normal review flow, and suppress transient overlays while editing. The verifier now waits for drawer closure before constrained-height capture and asserts the stale confirmation is absent.

- `final-matrix`: all eight delivery profiles and seven interaction/geometry profiles passed. Visual review then found the repositioned connection toast still covered the stale-turn error text. Moved review notifications into the scrollable conversation flow; editor notifications remain non-overlaying and connection state remains visible in the status row. This additional visual finding required another build and run.

Final verification: `final-matrix-2` passed app check (0 errors/warnings), 12 delivery/guard tests, production build, all eight demo/mounted delivery profiles, two toolbar profiles, three interaction profiles and two synthetic viewport profiles. Root/runtime TypeScript and the application-boundary test (125 assertions) passed. `empty-audit` additionally captured desktop/mobile empty review and inline connection details against this same build.

Inspected final rendered selection, capture, stale-turn error, waiting, result/latest-draft, 320px review, 390×400 editor and empty states. Short labels, focus navigation, 44px actions, draft visibility, scrollable history and reserved status space remain coherent. Inline notices no longer cover the stale-turn explanation, Switch or Send; the constrained editor has no notification/drawer overlap. No scoped visual finding remains open. Existing source files and original index are retained.

Final production/verifier source files match `final-matrix-2/release/app/` byte-for-byte. The snapshot manifest digest is `3af57f515783cf2826479ec0bd2cd0a27f43418251b4dee2f68ce3f67dd3a22c`; detailed verification is in ignored `source-match.json` and `completion.json`. The documentation checker still reports the same 16 pre-existing broken references; no new reference failure was introduced. Earlier snapshots and failures remain available; none is represented as the final build. Physical-device keyboard behavior remains unverified. No preview recipient, installation or dependency checkout is changed.
