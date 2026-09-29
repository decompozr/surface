# Installed Surface release candidate

## Product scope

The September 24 direction is to deliver the validated application as an installable product increment. Ordinary project pages own their source and domain form; Surface supplies navigation, element selection, captured comments, exact-recipient delivery and automatic result monitoring. Existing research records remain evidence and regression inputs. This gate does not add another feature experiment.

For every Surface update/release, check the design-system provider's latest committed main, build that exact revision and verify its package bytes against `apps/surface/design-system.lock.json`. Freeze that selection during verification and packaging; record actual identities in the dated candidate report, not this reusable procedure.

## Build and verification

Build a committed Surface revision with the verified provider package:

```sh
bun scripts/release/build.ts --version 0.1.0-rc.YYYYMMDD.N --ref COMMIT \
  --design-system-package /absolute/frozen-provider --out /absolute/surfaces
```

The source revision, provider pin, bundled runtime, file inventory and archive checksum identify the candidate. The provider override must match the selected Surface commit's pin and never replaces a development link. The release is a native macOS arm64 archive; signing/notarization and other platforms remain separate work.

Exercise installation and lifecycle through the shipped launcher:

```sh
bun tests/e2e/release/candidate.ts \
  --previous /absolute/previous.tar.gz \
  --candidate /absolute/candidate.tar.gz \
  --output /absolute/new-evidence-directory
```

This creates an owned isolated installation with a short path, preserves its surfaces/state, and stops only its own test service. It verifies checksums and installation without a development toolchain on PATH; project registration/mounting through the public CLI; real installed MCP listing; persisted browser drafts, project source, identity and durable comment/domain results through upgrade, rollback and candidate restoration. Chromium/WebKit comment flows use an explicit fake provider socket and the installed reply executable. No fixture is sent to a real conversation, and no existing preview recipient is changed.

Run the standard delivery and UI regression matrix against the exact package without rebuilding it:

```sh
COMMENTS_E2E_PREPARED_RELEASE=/absolute/extracted-release \
COMMENTS_E2E_OUTPUT=/absolute/new-matrix-directory \
bun run test:e2e:comments
```

Prepared-release mode checks package integrity before and after the run. It runs the delivery/guard tests and eight demo/mounted browser profiles plus toolbar, keyboard, touch and viewport checks using frozen assets. It checks/builds the fixture overlay in a disposable copy; it does not rebuild or modify the immutable production package. Run source checks against a separate source export with the same frozen dependencies; do not mutate the tested package. Installed launcher coverage is the separate lifecycle gate above.

## Evidence retention

Record source revision, provider revision/package digest, archive checksum, commands, browser/device scope, failures and resolutions in a concise dated history entry. Temporary releases, dependency trees and completed traces are disposable. Preserve user data and unresolved failure evidence under the [retention policy](../history/2026-09-24-working-data-retention.md).

Earlier candidate results are summarized in [workspace history](../history/2026-09-24-workspace-boundaries.md). A passed candidate gate is not public publication, a real-agent queue-consumption claim, or permission to replace another selected installation.
