# Two Surfaces sharing one lazy workspace backend

Status: bounded experiment passed. This is experimental evidence only, not production readiness or adoption into the ordinary Surface runtime. The user explicitly reserved that distinction after the public-entry work.

## Question and scope

Can an Editor Surface and a Comparison Surface in the same project/worktree share project data without duplicating a backend, eagerly allocating SQLite, or closing resources still needed by the other Surface?

The [prototype](../history/retired-experiments/multi-surface.md) uses two separate artifact source directories and one declared project backend. It inherits the existing Git workspace identity and trusted local Svelte host. A temporary pinned installation runs the experimental host; neither the current shared installation nor the normal CLI's runtime behavior is changed.

## Ownership hypothesis

- One backend factory instance belongs to a `(project ID, workspace ID)` pair while at least one backend-enabled mount remains.
- Each mount receives a distinct capability and retains its own revocable action endpoint. Sharing storage does not share tokens.
- Factory construction remains inert. Only a validated data operation opens SQLite; draft edits, registration, mounting and non-data operations do not.
- Serialized ownership transitions prevent concurrent opens from creating duplicate factories. Removing a member revokes its admission immediately. Remaining members retain the existing backend.
- The last member closes the backend. A failed close retains ownership and blocks new joins until explicit retry succeeds; repeated closes cannot close a later generation.
- Canonical root, storage context and declaration must agree when joining an owner. Changed backend entry source requires a host restart to avoid loading cached code under a new source identity.

This is a process-local ownership prototype. The shared close queue has no execution budget or cancellation protocol. Backend actions remain synchronous. Trusted backend code is responsible for respecting the supplied storage path and for keeping its factory inert.

## Observed results

| Gate | Evidence |
| --- | --- |
| No eager SQLite | Four mounts across main and a linked worktree; Chrome draft edits, invalid Save payload, wrong-scope capability and non-data operation all leave the data root absent. Each workspace reports one inert factory. |
| Two views, one store | Chrome saves Near view and Wide view in the Editor. Comparison remains unloaded until explicit Load, then renders both rows. Both mounts report one acquired backend instance and one acquisition; `lsof` observes actual SQLite descriptors. |
| Independent mount retirement | Editor unmount leaves Comparison usable. After Editor rejoins, Comparison unmount leaves Editor able to save another scenario. No intermediate close occurs. |
| Capability and revision boundaries | Unmounted endpoints reject access; remount issues a new capability and refuses the old one. A stale editor receives `revision_conflict`, preserving saved data. |
| Last-member cleanup | Final unmount releases all observed database/WAL/SHM descriptors and retains the database file. A new mount cohort reports a second factory and exactly one previous close, but zero acquisitions until explicit Load. |
| Worktree isolation | A linked worktree initially reads an empty store, then saves a different value under the same row ID. Main rows stay unchanged. Cross-workspace tokens fail. Closing that worktree leaves main's store open. |
| Restart and retained data | Two main mounts restore through a second host with one unopened backend. Explicit Load returns all three saved main scenarios. Both main and worktree databases pass SQLite integrity checks after shutdown. |
| Isolation of the experiment | Both successful-run hosts exit. The disposable linked worktree is retired and removed after source checks. Hashes of the existing shared installation's active release, settings, state, run files, installed launcher and global CLI link are unchanged. |

The ownership and existing contract suites pass **8 tests / 50 assertions**. These include concurrent mount acquisition, repeated/concurrent close, injected last-close failure and explicit retry, changed code/context rejection, plus the normal runtime's unchanged single-mount guard. Root and experiment TypeScript checks pass. Chrome screenshots were visually inspected.

Private evidence lives in `.decompozr/surface/multi-surface-proof/`. Its source manifest identifies the pinned temporary release and source hashes; screenshots show the real Editor and Comparison. No live agent delivery was used. Failed trial fixtures remain available for diagnosis; the successful fixture's worktree was removed and its main/data retained.

## Boundaries learned

Comparison refresh is explicit Load, not a subscription or automatic cross-view update. The project defines row IDs, revisions and domain operations; Surface does not synthesize a universal application state model.

Unmount invalidates a preview document and capability. Reopening a remounted artifact requires a fresh document and the new capability. The verifier initially attempted hash-only navigation on the old document, which retained its unmounted state; it now exercises a full new navigation. Transparent remount recovery and durable unsaved drafts are not established.

The scenario editor intentionally reports stale revision conflicts; an interactive reconciliation flow is outside this test. Separate mounts use non-overlapping source folders, as required by the existing compiler host. All project-declared operations remain available to each valid mount capability: the Comparison UI exposes only reading, but there is no enforced read-only role. Shared origin and trusted backend execution are not a security sandbox.

Backend edits, including changes in imported dependencies, require restart. The experiment detects direct entry-file changes; it does not implement backend dependency hot reload. Sharing asynchronous long-running work, handling a stuck close, compiler operating budgets, general database merging/promotion, and automatic retention cleanup remain unanswered.

## Outcome

The evidence supports sharing one lazy backend across multiple mounted Surfaces within a workspace while keeping mount admission and neighboring workspace data separate. Keep this implementation under `experiments/multi-surface/`; adoption into the public runtime requires a separate decision. Nothing in this result authorizes production use or updating the existing shared installation.
