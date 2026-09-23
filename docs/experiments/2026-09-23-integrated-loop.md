# INTEGRATED-LOOP-03: one live user-to-source-to-result journey

Status: real queued user submission, agent source change, callback publication
and browser-rendered result verified. Human acceptance remains unrecorded. This
is bounded incremental evidence, not a new SSE milestone or blanket E-16 pass.

## Scope and ownership

The user authorized starting the next proposed roadmap increment after checking
the other agent for overlap. This bounded experiment exercises
[E-16](../evaluations/consumer-eval.md#e-16-integrated-user-and-agent-loop).
The user will choose a card title and density; the originating agent will change
the project-owned `selection.ts`, validate the rendered output and publish a result.
Form editing alone must not change the source-backed card.

On September 23, the app task inventory and the other worktree's current intake
showed task `01a0cefa-cf02-7be3-923b-4b9d34870416` working on design-system
adoption and application consolidation. Its changes include shared shell,
navigation, recipient, comments and core source relocation. Its private preview
uses port 4387 / private HTTPS 8466. Task tools reported it active but did not
return recent message bodies; scope was cross-checked against its adoption intake
and actual Git diff. This was inspection, not a negotiated ownership acknowledgement.

This experiment owns only `experiments/integrated-loop/`, this dated record and
its own artifact entry in `artifact.project.json` on branch
`experiment/integrated-loop-20260923`, worktree
`/Users/scottchu/.codex/worktrees/cd49/surface`. It does not edit the other
worktree, shared runtime/UI, design-system package or shared evaluation/findings
documents during concurrent work. Reconcile source dispositions after ownership
is clear. No additional agent was created.

## Baselines and acceptance gates

- Checkout baseline: `4b629b8` (includes merged UI-CONTINUATION-02).
- Selected installed service: commit `7fceefc5c0324440752bf914288c482bf69e44ff`,
  release `7fceefc5c0324440752bf914288c482bf69e44ff-surface`.
- Service instance: `b6f5b5af-f4eb-4f54-877d-12e2b77f195b`; loopback
  `http://127.0.0.1:49790`; private HTTPS
  `https://mac-mini.duckbill-ionian.ts.net:8464`.
- Originating task: `01a0ceaa-b935-79c1-affa-d5bd9a5938f0`; binding
  `64b72cd8-cf82-4caf-812f-4ac42a9f13f8`, validated by the installed CLI.

The installed release is older than the checkout. This run combines that exact
runtime with the recorded project-page source snapshot; it does not establish
installed acceptance of PR #45 or the other agent's WIP. Do not upgrade/restart
the shared service for this experiment. Do not change recipient or send automated
fixture data into a real conversation.

1. Record mount/request identity and source hashes; keep capabilities ignored.
2. Inspect desktop/mobile rendering and prove editing/loading does not submit.
3. Have the user explicitly submit the bounded schema through the browser.
4. Inspect the original saved response and exact delivery receipt.
5. Change `selection.ts` from that input, preserving response provenance; run
   relevant checks and inspect the actual rendered source output.
6. Publish the result using the exact callback; inspect result rendering.
7. Record the user's pass/fail separately. Preserve any failed or unknown result;
   inspect before retrying and never generate a new ID to bypass uncertainty.

The page stores the response ID and payload in sessionStorage before submission,
locks after an attempt, and only reads state afterward. A saved attempt with no
server response requires inspection; it is not automatically replayed. Queue and
steer remain explicit choices in the existing recipient panel. One request
accepts one submission. User acceptance can be returned in this conversation.

## Preparation evidence

On September 23, 2026 at 18:07 UTC, `bun experiments/integrated-loop/verify-preview.ts`
passed against the returned loopback request URL. At 18:09 UTC it passed again
against the configured private HTTPS service in headless Chrome at
1440, 390 and 320 CSS pixels. All non-GET/HEAD requests were blocked by the
verifier; zero writes were attempted and zero page errors occurred. It verified
hydrated controls, unchanged source output after editing the form, reload without
submission and no document horizontal overflow. Desktop and 320px screenshots
were visually inspected: readable labels, stacked narrow layout and contained
controls. This is host-side browser evidence, not physical-phone acceptance.
The request endpoint returned a loopback URL even though mount metadata returned
HTTPS. The HTTPS interaction URL uses the service's verified `browserOrigin`,
preserving the returned path, query and capability fragment. Both URLs remain in
the ignored request record; no origin configuration was changed.

`bun x --no-install svelte-check --tsconfig ./tsconfig.json` from the experiment
directory passed with zero errors/warnings. `git diff --check` passed. A subsequent
CLI inspection confirmed the request has neither a response nor a result.

- Workspace: `5d124a70-e808-42f0-bd5f-202d7a27eea2`.
- Artifact: `3736cdae-896b-4518-829b-f9b89425202a`.
- Request: `207d5feb-e285-4b1a-885a-f1db9d552509`.
- Returned clean path: `/workspace/surface/surface/integrated-loop/`.
- Initial page SHA-256: `c87133f9d7f7c24a3cff9cc054f85c73e214ea540ec00ebcf260a32e8e35f652`.
- Initial selection SHA-256: `b7b4582729dbedccca8983f471d88bd937d7d4cf0d1ce76a8fd9e8c260ee3c2e`.
- Lockfile SHA-256: `a1a2a498971e388e7c54f05d0f772b59403d95ed29d772b15e155184dd2b5007`.

The exact private request URL, screenshots and browser report are retained under
ignored `.decompozr/surface/integrated-loop/`. No capability is versioned. The mount
remains available for the user; no background verifier process remains.

## Submission continuation protocol (completed below)

The user's subsequent iPhone observation identified background scrolling behind
the shared navigation overlay. See the [scoped fix and verification](2026-09-23-drawer-scroll.md).
That follow-up authorizes a minimal shell patch in this worktree, superseding the
original page-only scope for that correction. It does not supply a form response.

Inspect the exact request above and preserve its original response ID. Validate
the submitted schema and update only this experiment's `selection.ts` with the
title, density, `applied: true` and original response ID. Run the Svelte check and
read-only browser verifier; visually inspect the resulting card. Use the exact
result callback supplied by Surface, then observe result rendering and record
source hashes, receipt/mode, checks, outcome and user acceptance here. Record
failures without replay. Shared specification/findings reconciliation remains a
follow-up after the other writer's overlapping documentation scope is clear.

## Live submission and completed result

The user submitted response `68b3a001-5020-4167-a7fa-0fc8362f0deb` at
`2026-09-23T20:38:47.050Z`, choosing title `我的 Surface 完整流程` and density
`comfortable`. Inspection of the exact original request confirmed those values,
an accepted `queue` delivery and queued submission ID
`01a0cffe-0816-7112-b9d9-5321a51527b3`. The expected active turn was
`01a0cffd-928f-79b2-85ff-080c57680d0d`; the actual message subsequently arrived
in the originating task. No replacement response/request or automated submission
was used. The installed release and service instance matched the original baseline.

The agent changed only the experiment's source selection for the requested card:
title, applied marker and original response ID. Comfortable density was already
the initial density and remains so; no changed-density claim is made. The final
selection SHA-256 is
`404938572c4c877caed48d63395cfac7a0d689808617a316f84b6c005ff3b4f3`.
The page source SHA-256 remains the recorded initial value.

Svelte checking passed with zero errors/warnings. The read-only verifier passed
at 20:43 UTC for source output and at 20:44 UTC with `--expect-result` for the
published callback. Both covered 1440/390/320px through configured private HTTPS,
the actual title, comfortable 32px card padding, disabled submitted controls,
retained response ID, zero page errors, zero attempted browser writes and no
horizontal document overflow. The 390px applied/result screenshots were visually
inspected. These are browser/device-emulation observations, not physical-phone
acceptance or proof that the user's already-open tab processed HMR.

The exact supplied release CLI/state/request callback published the real result.
Subsequent administrative inspection confirmed the original response and stored
result; browser checks observed the exact published message. Reports/screenshots
are preserved separately as `applied-*` and `result-*` under the ignored evidence
directory. Shared installation and the separate drawer fix were not deployed.

## Correction to roadmap interpretation

The user asked whether this had already been tested with SSE. Cross-checking the
other worktree's `docs/experiments/2026-09-23-element-comments.md` confirmed:

- Its controlled full-loop E2E already covers browser submission, screenshot
  storage, the real adapter/CLI/store around a fixture provider, SSE result
  display, offline/reconnect/reload and one delivery, on desktop/mobile profiles.
- It separately records a real user comment arriving in its originating task
  and a callback after an actual source correction. A callback alone was not
  treated as browser-display acceptance.

The initial roadmap recommendation did not adequately account for this concurrent
evidence. This generic mounted-page run still uses polling and does not extend or
validate SSE. Its limited added evidence is one real queued submission followed
by source application and observed callback rendering on the selected installed
runtime. Do not repeat it as a new general loop/SSE milestone or ask the user to
repeat established transport tests. Consolidate existing evidence and remaining
gaps before selecting further roadmap work. Human acceptance remains unrecorded;
the user's question does not imply acceptance. No additional live test is started.
