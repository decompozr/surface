# Installed Surface release candidate

## Product scope

The September 24 direction is to deliver the validated application as an installable product increment. Ordinary project pages own their source and domain form; Surface supplies navigation, element selection, captured comments, exact-recipient delivery and automatic result monitoring. Existing research records remain evidence and regression inputs. This gate does not add another feature experiment.

For every Surface update/release, check the design-system provider's latest committed main, build that exact revision and verify its package bytes against `apps/surface/design-system.lock.json`. Freeze that selection during verification and packaging; record actual identities in the dated candidate report, not this reusable procedure.

## Build and verification

Build a committed Surface revision with the verified provider package:

```sh
./bin/build --version 0.1.0-rc.YYYYMMDD.N --ref COMMIT \
  --design-system-package /absolute/frozen-provider --out /absolute/surfaces
```

The source revision, provider pin, bundled runtime, file inventory and archive checksum identify the candidate. The provider override must match the selected Surface commit's pin and never replaces a development link. The release is a native macOS arm64 archive; signing/notarization and other platforms remain separate work.

In a separate source export of that revision with the same frozen dependencies/provider package, run the repository type check, Surface check, app/CLI tests and existing MCP/project-access verifiers:

```sh
bun run check
bun run --cwd apps/surface check
bun run test
bun run verify:mcp
bun run verify:project-access
```

These establish the source gate only. They do not replace packaged browser, installed lifecycle or visual acceptance.

Exercise installation and lifecycle through the shipped launcher:

```sh
bun tests/e2e/release/candidate.ts \
  --previous /absolute/previous.tar.gz \
  --candidate /absolute/candidate.tar.gz \
  --output /absolute/new-evidence-directory
```

This creates an owned isolated installation with a short path, preserves its surfaces/state, and stops only its own test service. It verifies checksums and installation without a development toolchain on PATH; project registration/mounting through the public CLI; real installed MCP listing; persisted browser drafts, project source, identity and durable comment/domain results through upgrade, rollback and candidate restoration. Chromium/WebKit comment flows use an explicit fake provider socket and the installed reply executable. No fixture is sent to a real conversation, and no existing preview recipient is changed.

Create the retained draft through the current Comment tools toolbar. On reopening, inspect whether the comments panel is already open before toggling it: retained panel state must not turn the verification action into a close. Capture navigation only after its open width and position settle, so screenshots represent the usable state rather than an animation frame.

Run the standard delivery and UI regression matrix against the exact package without rebuilding it:

```sh
COMMENTS_E2E_PREPARED_RELEASE=/absolute/extracted-release \
COMMENTS_E2E_OUTPUT=/absolute/new-matrix-directory \
bun run test:e2e:comments
```

Prepared-release mode checks package integrity before and after the run. It runs the delivery/guard tests and eight demo/mounted browser profiles plus toolbar, keyboard, touch and viewport checks using frozen assets. It checks/builds the fixture overlay in a disposable copy; it does not rebuild or modify the immutable production package. Run source checks against a separate source export with the same frozen dependencies; do not mutate the tested package. Installed launcher coverage is the separate lifecycle gate above.

## Required acceptance receipt

After all required verification and rendered inspection finish, record a trusted acceptance receipt for the exact archive. `./bin/release` validates this contract; it does not execute the gates or authenticate the author's observations.

```json
{
  "format": 1,
  "sha256": "ARCHIVE_SHA256",
  "commit": "SURFACE_COMMIT",
  "provider": {
    "commit": "PROVIDER_COMMIT",
    "packageSha256": "PROVIDER_PACKAGE_SHA256"
  },
  "gates": {
    "source": { "status": "pass" },
    "comments": { "status": "pass" },
    "lifecycle": { "status": "pass" },
    "visual": { "status": "pass", "phone": true, "desktop": true, "findingsResolved": true }
  }
}
```

Use actual full commit IDs and SHA-256 digests. Source checks must use the selected revision and frozen provider bytes; comments must cover the full delivery/UI matrix; lifecycle must cover the installed CLI/MCP and state-preserving upgrade/rollback acceptance above. Visual acceptance requires inspecting affected shipped routes at phone and desktop sizes, resolving findings and inspecting again under the [automatic audit gate](../source-workflow.md#uiux-completion-gate). For a bounded remaining device limitation, visual may be `limited` only with both inspected size flags and `findingsResolved` true and a nonempty `limitation` explanation for remaining device/accessibility verification constraints. Known in-scope UI findings must be resolved. This never substitutes for rendered inspection or allows a failed functional gate. Record actual physical-device limitations separately.

Promote the accepted bytes with `./bin/release --archive ARCHIVE --acceptance RECEIPT --out DIRECTORY`, then select `DIRECTORY/release.json` for setup. Local promotion produces no new package bytes and grants no installation or publication authorization. A failed, missing, mismatched or unexecuted required gate cannot be recorded as passing.

## Evidence retention

Record source revision, provider revision/package digest, archive checksum, commands, browser/device scope, failures and resolutions in a concise dated history entry. Temporary releases, dependency trees and completed traces are disposable. Preserve user data and unresolved failure evidence under the [retention policy](../history/2026-09-24-working-data-retention.md).

Earlier candidate results are summarized in [workspace history](../history/2026-09-24-workspace-boundaries.md). A passed candidate gate is not public publication, a real-agent queue-consumption claim, or permission to replace another selected installation.
