# INTERRUPTED-DELIVERY-04: reconcile a killed sender without replay

Status: bounded fixture passed on September 23, 2026. Source behavior is unchanged;
this adds evidence for R-11/E-05, not an adopted autonomous recovery implementation.

## Question and prior coverage

After the completed live queued interaction in [INTEGRATED-LOOP-03](2026-09-23-integrated-loop.md),
the user authorized continuing. The prior comments SSE loop already verifies
submission, pushed results, reconnect/reload and deduplication around a fixture
provider. Existing `tests/service.test.ts` verifies unknown retention and seeds
a delivering record to simulate restart. `experiments/lifecycle/verify.ts`
separately kills an owned host and exercises conservative stale-owner recovery.

This experiment combines a real sender-process interruption with a real pending
adapter call: what can a new process conclude when the provider's effect may
precede the missing acknowledgement? It tests the existing
[R-11 delivery/result distinction](../requirements/agent-interaction.md#requirement-index)
and [E-05 uncertainty gate](../evaluations/runtime-eval.md#e-05-exact-delivery-and-uncertainty).
It does not repeat browser/SSE acceptance or claim a fresh-agent handoff.

## Method and authority

The harness starts the actual singleton HTTP host, Store, Service and Codex
Unix-WebSocket adapter in an owned subprocess with temporary state and source.
A provider-protocol fixture receives only synthetic input. It deliberately
withholds the queue acknowledgement at three explicit cut points. Once Surface
has persisted `delivering`, the harness sends SIGKILL to the exact subprocess
handle it launched and awaits its exit. It verifies the matching stale lock and
dead PID before removing only that fixture's lock/connection files. This manual
harness intervention is recorded; no unattended recovery is claimed.

The host restarts normally and restores its mount. Identical submissions return
the existing record, changed response IDs and takeover attempts reject, and no
second provider mutation call is permitted. A separate reconciliation process
receives only the durable fixture directory. It reads the checkpoint, original
request/recipient/payload identity, provider journal and any completed output.
It emits a disposition without submitting or publishing. Only matching completion
evidence supports a subsequent explicit result callback by the harness.

No real conversation, shared service, provider permission, other agent worktree
or design-system source was changed. No new agent was created. The provider
journal is a controlled fixture oracle, not a generally available Codex API.

## Observed outcomes

Final run: `2026-09-23T20:49:54.979Z`, macOS arm64, Bun 1.4.2, baseline `4b629b8`
plus the three experiment scripts. All six owned host processes exited, all
temporary sources/state and provider sockets were cleaned, and no fixture input
reached a real task.

| Cut point | Fresh-process conclusion | Result publication | Provider mutation calls |
| --- | --- | --- | --- |
| Queue message received; no acceptance record | Unknown; no evidence supports retry or completion | None | 1 |
| Acceptance recorded; no completion | Unknown delivery; provider accepted but work is unresolved | None | 1 |
| Matching output and completion recorded; reply withheld | Completion supported by exact identity/payload and output hash | One explicit callback | 1 |

All three requests retained the original response ID/data/intent and recovered
as `unknown`. In the completed case, publication added a result without rewriting
the historical unknown delivery status or inventing a lost queue receipt.
Acceptance alone never became completion. One observed mutation call does not
establish exactly-once execution for a real provider.

Commands passed:

```sh
bun x --no-install tsc --noEmit -p experiments/interrupted-delivery/tsconfig.json
bun experiments/interrupted-delivery/verify.ts
git diff --check
```

An initial verifier expected HTTP 201 for mounting; the actual documented handler
returns 200, and the assertion was corrected. A subsequent run exposed a readiness
race: `connection.json` appears before intended mount restoration finishes. The
fixture host now writes its own ready marker only after `startSingleton` returns,
and the harness matches that marker to the newly launched PID. No runtime checks
were bypassed and no fixed readiness sleep was introduced. Failed logs were kept.

Final evidence: ignored
`.decompozr/surface/interrupted-delivery/2026-09-23T20-49-53.407Z/summary.json`,
per-case reports and owned host logs. Reproduction source:
[verifier](../../tests/e2e/interrupted-delivery/verify.ts),
[host](../../tests/e2e/interrupted-delivery/host.ts),
[reconciler](../../tests/e2e/interrupted-delivery/reconcile.ts).

| Source | SHA-256 |
| --- | --- |
| `host.ts` | `e139e64e6e32def433e1dd9bc77e48508de39ab17c97e29d8136f50465f525b0` |
| `reconcile.ts` | `f586a6053b3fc7d37cafa3c47c146f24600c7a1fc95cf954e0910c10e5490b76` |
| `verify.ts` | `66b084d3b957e4230735dab3ce93ae0e7f91429789d5f9ac663b969896e127dd` |
| Existing `src/core/store.ts` | `b40b25cc6d7b4cba28628b4951c32eb25ea294f051bcff10f5c39e2ae1e7c05d` |
| Existing `src/core/service.ts` | `542083ab8a946e822c234bc8316f432638f6711f81c0f7d54852d6aaf78fd783` |
| Existing `src/adapters/codex.ts` | `caec9c84348b9918d8d692c7d700488ffc071e0cc5dd680986785a3b6f510e70` |

## Disposition and remaining gap

- Retain R-11's existing no-blind-retry and acceptance/result separation; no core
  implementation correction was required by this experiment.
- Add bounded fresh-process evidence to the evaluation/continuation indexes.
- Preserve recovery ownership and mount-readiness findings as fixture-operating
  evidence, not automatic service recovery or a new runtime readiness contract.
- Do not promote the fixture's provider journal into a generic reconciliation
  algorithm. Missing evidence remains unresolved; arbitrary task effects, real
  provider inspection and fresh-agent judgement still require separate evidence.
- No power-loss/fsync durability, shared installation recovery, browser/SSE UX,
  scheduler, exactly-once execution or physical-device acceptance is established.

The other agent still owns a modified `docs/observations/findings.md`; its file
was left untouched to avoid the user's requested overlap. These explicit
dispositions are ready to merge into that shared map when ownership is reconciled.
The next UI increment should present unknown/accepted/completed separately and
offer inspection without replay, in the ongoing design-system shell's ownership.
This experiment does not authorize an additional live submission or UI redesign.
