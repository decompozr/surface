# Live agent source edit and HMR — 2026-09-21

Status: passed one bounded live source-edit experiment. This extends the earlier singleton result round trips with a real agent changing the mounted component's source while its originating page stays open.

## Acceptance gate

An automated browser submits a structured request to change a one-column Svelte layout into two equal columns. The exact existing agent conversation must receive it, edit only the authorized source file, and invoke the supplied result CLI. The original browser must display the source change through HMR while preserving an unrelated opted-in draft and its document identity. A second mounted page must retain its document and remain clickable.

Submission is automation, not a personal choice made by the user. Message acceptance, source mutation, agent callback, and browser rendering are separate observations.

## Observed result

The existing dedicated proof conversation's canonical working directory matched the intended project. Its initial runtime state was `notLoaded`, so the existing adapter resumed that same conversation and used `turn/start`. No new conversation was created; no session permission was changed. This run did not test active-turn steering, which has separate earlier evidence.

The accepted turn performed these observable actions:

1. Read the exact authorized `Layout.svelte` file under the project's ignored `.artifact/live-edit-proof/source/src/` folder.
2. Ran a successful Python edit that replaced only `grid-template-columns:1fr;` with `grid-template-columns:repeat(2,minmax(0,1fr));`. The command verified the exact byte replacement.
3. Ran the actual singleton `result` CLI with the request identity, two-column result, source path, and confirmation message. The command exited with code zero.

Independent browser assertions then established:

- Computed CSS changed from one grid column to two.
- The source file's hash changed, and its component script remained unchanged.
- The originating page's document marker remained intact.
- The unsent `previewState` draft retained its full value.
- The other namespace's document marker remained intact and its counter advanced from one to two after the edit.
- The originating browser displayed the published result.

The exact receipt turn was read after completion. Its file-writing command and successful callback command were inspected, and the before/after browser screenshots were visually reviewed. A returned receipt or agent message alone was not treated as proof of editing or rendering.

## Reproduction

The script requires explicit live invocation and an existing session identity:

```sh
bun experiments/singleton/verify-live-edit.ts \
  --live \
  --project /absolute/existing/project \
  --thread EXACT_EXISTING_THREAD_ID \
  --socket /absolute/existing/control.sock
```

Before submission it checks the thread identity, canonical working directory, and idle/unloaded status twice. It refuses to overwrite an existing saved request receipt, preventing an accidental rerun from silently sending another live request. An active or unavailable target requires reconciliation rather than selection of another conversation.

The source fixtures live under the specified project's ignored `.artifact/live-edit-proof/`; the test's singleton state and receipts are separate, under the experiment checkout's ignored `.artifact/live-source-edit/`. The script stops only its own browser and singleton server. It leaves the proof source and receipt records available for review and never restarts the shared Codex daemon.

Evidence files include `request.json`, `turn.json`, `result.json`, `before.png`, and `after.png`. Capability-bearing receipts and session details remain ignored rather than committed.

The exact-session lifecycle follows the [official Codex App Server documentation](https://learn.chatgpt.com/docs/app-server), with the repository's existing local Unix WebSocket adapter providing the transport.

## Boundary

This is one real CSS source edit on the tested local Codex/Svelte/Bun setup. It does not prove arbitrary code migration, transparent preservation of component-local state, cross-provider session control, production deployment, or security isolation between same-origin pages. The preserved draft explicitly opted into `previewState`; durable request/result records and ephemeral HMR state remain different mechanisms.
