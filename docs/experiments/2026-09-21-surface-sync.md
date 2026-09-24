# Cross-Surface update notifications and reconnection

Status: bounded experiment passed. This is independent experimental evidence, not production readiness or adoption into the shared runtime. The existing shared installation and launcher were not updated.

## Question

After an Editor saves, can a previously loaded Comparison update automatically, recover from missed or delayed notifications, and preserve another editor's unsaved draft without breaking lazy SQLite or workspace isolation?

The [experiment](../history/retired-experiments/surface-sync.md) extends the separate multi-Surface host. All new runtime and client code stays under `experiments/surface-sync/`. A temporary pinned installation runs it with explicit state/data directories and an ephemeral port.

## Model tested

A workspace backend owner has an in-memory `{ epoch, sequence }` invalidation cursor. This cursor is not the database schema version or a domain row revision. Each new owner generation has a fresh epoch. The project-owned fixture explicitly marks a successful committed save with `invalidates: true`; only that outcome increments the cursor. Rejected input, revision conflicts and rolled-back transactions do not.

Each mounted Surface exposes its own authenticated event endpoint. A streaming fetch supplies the mount capability in a header; it receives an initial cursor, later invalidations and periodic cursor heartbeats. Events contain no domain rows. Subscriptions and heartbeats do not query the backend or allocate storage. The prototype limits each mount to 16 subscriptions and disconnects a stream with more than 64 KiB buffered output; these are experimental bounds, not a measured service operating envelope.

A view must explicitly Load or successfully Save before it opts into snapshot reads. An unopened comparison may subscribe and receive updates indefinitely without reading domain data. An opted-in clean view reads a current snapshot when notified. Duplicate/older sequence numbers are ignored. Reads run one at a time, coalesce invalidations, and discard responses superseded while in flight. Only a new stream handshake may select a different epoch; late notifications from a previous epoch are ignored.

A dirty editor preserves its draft and shows a change notice. Saving against an obsolete project row revision conflicts. Discard draft and reload is an explicit user action; there is no automatic merge of edits. The controller also checks for edits made while a read is in flight before applying its result.

Reconnection always refreshes an opted-in clean view from the current snapshot, even without a replay log or a changed cursor. The experiment uses 500 ms heartbeats, a 2 s read-stall timeout and a 250 ms subscription retry delay. Browser offline events abort the current stream. Mutations are never automatically replayed. Access rejection stops subscription retries and asks the user to reopen the view.

## Observed evidence

| Gate | Outcome |
| --- | --- |
| Lazy subscriptions | Five Chrome views subscribe across main and a linked worktree. Handshakes, heartbeats and draft edits leave the data root absent. Cross-mount subscription credentials are rejected. |
| Explicit first use, then live updates | The first save does not load unopened comparisons. After an explicit Load, the next successful save automatically updates the loaded Comparison. A dormant comparison makes zero action requests throughout later updates. |
| Draft preservation and reconciliation | A second editor loads revision 1 and creates a private draft. Another save advances the row to revision 2. The draft remains unchanged; its attempted stale save conflicts. Explicit discard/reload resolves the conflict. |
| Commit boundary | An injected SQL transaction failure rolls back and leaves the cursor unchanged. A revision conflict also leaves it unchanged. Repeated heartbeat cursors do not cause additional snapshot reads. |
| Missing updates during disconnection | Chrome's comparison context goes offline while two saves occur. Its old display stays intact offline; reconnection automatically fetches the latest saved state without manual Load or replaying intermediate events. |
| Delayed responses | A real comparison snapshot response is held while a newer save and notification arrive. The browser discards the held stale response, reads again and renders the newest title. A DOM observer confirms that the obsolete intermediate title was never rendered. |
| Workspace isolation | Main saves leave the other workspace's cursor and unused storage unchanged. A later explicit worktree save advances only its own cursor. Its dormant comparison still makes no domain reads. |
| Unmount and resource release | Unmount ends an independent HTTP event stream as well as scoped browser subscriptions. The old capability fails; remount creates a new capability with no inherited subscribers. The remaining Editor still saves successfully. Last unmount releases observed SQLite descriptors. |
| Bounded cleanup | The disposable linked worktree is retired/removed after source checks, the owned host exits, and retained SQLite passes integrity checking with the expected final row revision. Shared installation metadata and the global launcher fingerprint remain unchanged. |

The client, prior shared-ownership and existing runtime contract suites passed **15 tests / 73 assertions**. Seven new client tests cover explicit opt-in, duplicates/out-of-order notifications, delayed reads, dirty drafts including edits during a read, reconnect/generation changes, late responses after disposal, failed reads, and a notification arriving while the single active read releases its slot. Root and experiment TypeScript checks pass. The real Chrome comparison and preserved-draft screenshots were visually inspected.

Private evidence is in `.decompozr/surface/surface-sync-proof/`: the installed snapshot/source hashes, result record, owned-host logs, `live-comparison.png` and `preserved-draft.png`. No live agent input was delivered.

## Findings and limits

Chrome's offline emulation did not immediately close an already-established streaming response in the first trial. The client now reacts to the browser offline event and also detects a stalled stream rather than assuming transport failure is immediately observable. The final browser run exercised this correction.

Invalidations are hints, not durable events. No exactly-once delivery, persistent event history or general event bus is established. Cursor heartbeats can reveal a missed invalidation while connected; the browser proof covers a missing interval through actual disconnection/reconnection, while unit tests cover duplicate and out-of-order cursor hints. There is no claim that every possible transport failure was injected.

Out-of-band SQLite writes do not emit notifications. A reconnect or manual Load can read current storage, but continuously connected views require the project's declared mutation path for automatic updates. Project schemas, row revisions and transactions remain project-owned.

Host restart/remount rotates capabilities and requires reopening/re-authorizing the view. Network reconnection with the same still-valid mount is the tested automatic recovery path. Unsaved drafts remain local to the existing document; their survival across reload, unmount or crash is not promised. There is no collaborative edit merge, durable offline write queue, automatic conflict resolution or multi-process backend coordination.

All declared operations remain available to a valid mount capability; a read-only Comparison UI is not an enforced read-only role. The host runs trusted local code and shares an origin/compiler. Backend actions remain synchronous, and long-running action/close budgets, broader resource measurements and production deployment remain separate questions.

## Outcome

The experiment supports a small contract: opt-in data use, scoped invalidation hints, snapshot resynchronization and explicit draft conflicts. Keep it experimental. This evidence does not authorize updating the shared runtime or using it as production.
