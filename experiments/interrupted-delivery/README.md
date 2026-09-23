# Interrupted delivery fixture

Tests a bounded R-11/E-05 recovery gap using the real singleton HTTP service,
Store and Codex WebSocket adapter against a disposable provider-protocol fixture.
No real conversation, shared installation or existing worktree is modified.

```sh
bun experiments/interrupted-delivery/verify.ts
bun x --no-install tsc --noEmit -p experiments/interrupted-delivery/tsconfig.json
```

The harness kills only its own subprocess handle at three acknowledgement-loss
cut points: provider acceptance not recorded; acceptance recorded without
completion; completion recorded with matching fixture output. The new host must
recover the reserved response as unknown without replay. A separate reconciliation
process receives only a durable checkpoint path; it reads original identities,
provider journal and output before reporting its disposition. Only matched
completion evidence supports result publication. Unknown delivery history remains.

The harness explicitly clears its own dead host's stale lock after verifying
handle exit and matching ownership. This is not unattended service recovery.
The fixture journal is a controlled oracle; no equivalent general provider
reconciliation API or exactly-once claim is adopted. This is a fresh-process
experiment, not a fresh-agent takeover, SSE test or physical-device acceptance.
Reports and logs are retained under ignored `.decompozr/surface/interrupted-delivery/`.
