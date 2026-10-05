# Separate build, release selection and setup

Implemented the accepted [release distribution](../architecture/release-distribution.md) and [installation lifecycle](../architecture/installation-lifecycle.md) changes. `bin/build` creates the complete candidate, including installer and Bun. `bin/release` checks an explicit acceptance receipt and selects existing immutable bytes; it does not run the acceptance gates or rebuild. `bin/setup --release` invokes the packaged installer, configures the selected home/provider links/access, and subsequently verifies the installed selection without needing the download. Runtime CLI retains prepared installation and service operations; its source-build path is removed. Python documentation checking remains separate.

Selection metadata, archive paths, inventories, bundled runtime/provider and lifecycle metadata are validated before installation. Invalid explicit selections cannot fall back. Checkout skill references and runtime CLI content must match; unrelated documentation and setup tooling may change. Repeat setup preserves a matching running process. Legacy saved configuration can reuse a compatible verified installed package without inventing an acceptance receipt. Source dependencies are not installed by setup; packaged prompt dependencies work with Bun auto-install disabled.

## Verification identity

Canonical Git HEAD stayed `7fbeb867a197c0b45f1a632bd6ec20d74ecd8b07`; implementation remains uncommitted. The final isolated source snapshot was `09c97b63a047559e19732cd95ee35b4aadc93a05`. Its native macOS arm64/Bun 1.4.2 candidate was `0.1.0-rc.20261001.5`, archive SHA-256 `84c17a9484eca6b2f51024b12f3371db01f01342350422e06a715d08f9c89359`.

The provider's committed local `main` was frozen at `525a099524b1fc659a2e97ead2c2df4d4fb897fa`; observed `origin/main` was still `f4be55aa2a50952038436968ba29ba255c9e09c4`. An isolated source export, verified temporary official Node runtime and frozen npm dependencies produced 138 package files, digest `95fb27a47e0bc2e1f2c1604af4df970d03a2c442503da27cbfecfbe85d711531`. Provider checkout and development links were preserved.

The previous installed rc.2 immutable payload was verified and repacked solely as the lifecycle fixture baseline, SHA-256 `0fbe4cbd27552dae46c4c618730b7dd88c6bdb8d4e255ad02a7e59fbc4c28d85`. No mutable service state was copied.

## Results and corrections

- Separate exact-provider source checks passed: TypeScript, Svelte (zero errors/warnings), 126 tests/1,135 assertions including repository tooling, MCP and project-access browser/HMR checks.
- Final prepared archive passed default-home installation, installed public CLI/MCP/browser/storage verification, and previous→candidate→rollback→candidate acceptance retaining five durable records, draft and workspace identity.
- Full prepared comments matrix passed eight demo/mounted idle/active Chromium/WebKit profiles plus theme, fullscreen, toolbar, keyboard, touch and viewport checks. Package integrity was unchanged.
- Phone/desktop rendered inspection passed with no unresolved in-scope findings, including supplemental service home/navigation and unobscured generated form. Mid-animation or drawer-occluded captures were excluded and replaced by settled evidence.
- Setup passed without source dependencies: packaged prompt API with auto-install disabled; docs-only edits and repeat/test with unchanged PID; malformed checksum, skill and lifecycle candidates rejected before stop; missing-download reuse; legacy configuration; stopped resume with saved endpoint.
- After those gates, actual `bin/release` preserved the exact candidate digest; setup from its promoted descriptor in a fresh isolated home matched the selected inventory, repeated without restart, and passed read-only `bin/test`.

Initial browser launches lacked pinned headless engines; installing them in a task-only cache resolved this prerequisite. The malformed-bundle setup fixture initially copied symlinks incorrectly. The external verifier then added only `verbatimSymlinks: true`; its type check and complete rerun passed against the unchanged rc.5 archive. That corrected verifier differs from the bundled snapshot's test file; no production bytes were rebuilt for this test-only correction. Independent source, rendered and final promotion review passed.

No physical-device, native assistive-technology, actual provider discovery or live-agent delivery acceptance is claimed. Tailscale ownership/configuration is covered by isolated fixtures, not live route changes in this task. No canonical commit, publication or production installation occurred. The existing rc.2 service and private URL were preserved. Completed temporary snapshots, packages, fixtures, browser cache and raw evidence are retired after review; the earlier pending release history is preserved separately.
