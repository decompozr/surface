# September 24 production-readiness review

Scope: independently review docs, apps and repository tooling in the existing worktree; retire completed experiments, preserve user data, stop old services and prepare a verified candidate. Shared installation promotion remains conditional on a main-based preview review.

## Findings and changes

| Track | Findings resolved |
| --- | --- |
| Docs | Removed duplicate setup instructions, completed-task continuation prompts, stale module paths, compatibility claims and design chronology from current contracts. Added a current mounted-page dependency contract. Dated evidence stays historical. |
| Apps | Removed dead supervisor and duplicate recipient workflow; moved fixture routes outside the production app; named production comment modules by purpose. The delivery service accepts message formatting without depending on CLI paths. Current comment replies use explicit destinations, no redirects, bounded waits and one shared result validator. |
| Repository | Retired root experiment programs and redundant manifests/locks; promoted useful identity, database and interruption regressions into maintained tests. Corrected installed verification to current route pages, froze provider bytes and cleaned disposable test builds on exit. Removed the retired example artifact entry. |
| User data | Unknown browser comment-state versions previously became empty state and could be overwritten. A failing browser regression reproduced it. Unsupported reads now preserve existing bytes and disable persistence with a visible notice. |
| Source setup | Bun changes public bin entries to executable. The tracked CLI mode was non-executable, leaving a fresh setup dirty and blocking repeat setup. Tracking the executable bit fixed the reproduced failure; repeat setup and read-only test passed with clean source. |

## Verification and identities

The application candidate `9acf5f866bc1d1bf0adf9030d8f400d8cce11065` used provider main `dfe319f5cb581245da9f71673c7223891275e6cc`, independently exported and rebuilt. Its 118-file package digest is `b7fbf1b89a9a2294bf7d94c618d7d88c5f9242d53b36421c62bd1bde7aaef743`. The existing provider checkout/link was preserved.

Archive `surface-0.1.0-rc.20260924.12-darwin-arm64.tar.gz` had SHA-256 `b27a30da49f77f7a7454cd48dc7500c0e2bf031e6af98e883cda7d44c8eb1a20`. Upgrade/rollback used baseline `d2813d22789deae2d6080ef4baab7b39540f5072`.

- Root/app checks passed; Svelte reported zero errors/warnings. Default suite: 105 tests, 987 assertions.
- Actual CLI/MCP/browser project operations passed, including HMR, archive/restore, neighboring mounts and restart. Interrupted delivery passed before acceptance, accepted without acknowledgement and completed without acknowledgement; no automatic replay.
- Installed lifecycle verified launcher survival after source relocation/session teardown, workspace identity, lazy SQLite, retirement, restart and uninstall/reinstall with no owned hosts left running.
- Candidate upgrade/rollback preserved five durable interaction stores, project source, workspace identity and browser draft. Bundled launcher/runtime, real MCP listing and generated route template rendered on desktop/phone.
- The immutable packaged comments matrix passed idle/active × Chromium/WebKit for fixture and ordinary mounted pages, plus toolbar, desktop/touch, viewport and keyboard checks. Fixture build and production build were explicitly separate. Package integrity was checked before and after.
- Unknown storage version failed against the old implementation and passed on the fix. Settled desktop/mobile screenshots confirmed visible notices and preserved data. Updated example guide rendered on both browser profiles.
- Documentation links, anchors and R/D/E coverage passed. Repository definition checks found and removed the retired integrated-loop source reference.

Follow-ups after the application candidate change only the CLI executable bit, app README and root example manifest. Their source-setup and definition checks are recorded above. A preview must be built from the actual merged main revision, not relabeled from this candidate.

## Disposition and limits

The four old Surface instances were stopped; unrelated applications and existing user records were preserved. Completed working artifacts previously occupied about 11.3 GiB; cleanup reclaimed 11.24 GiB without creating another archive. Final test payloads remain disposable under the [retention policy](2026-09-24-working-data-retention.md).

This establishes a bounded local macOS arm64 candidate. Physical-device acceptance, fresh-user provider discovery, real-agent queue consumption, signed/notarized distribution and indefinite uptime are not inferred from isolated tests. The next user gate is an isolated preview from merged main; shared remains stopped until that preview is accepted.
