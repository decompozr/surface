# Installed Surface release candidate

## Product scope

The September 24 direction is to deliver the validated application as an installable product increment. Ordinary project pages own their source and domain form; Surface supplies navigation, element selection, captured comments, exact-recipient delivery and automatic result monitoring. Existing research records remain evidence and regression inputs. This gate does not add another feature experiment.

The standing user policy is to update the design system for every Surface update/release. The provider selected for this candidate is committed main `4f59f8a426d8546b9c81a9db0d29a008196a206a`. Its independently rebuilt 118-file package has content digest `b7fbf1b89a9a2294bf7d94c618d7d88c5f9242d53b36421c62bd1bde7aaef743`. Freeze that selection while validating and packaging; do not mix moving development output with release evidence.

## Build and verification

Build a committed Surface revision with the verified provider package:

```sh
bun scripts/release/build.ts --version 0.1.0-rc.YYYYMMDD.N --ref COMMIT \
  --design-system-package /absolute/frozen-provider --out /absolute/artifacts
```

The source revision, provider pin, bundled runtime, file inventory and archive checksum identify the candidate. The provider override must match the selected Surface commit's pin and never replaces a development link. The release is a native macOS arm64 archive; signing/notarization and other platforms remain separate work.

Exercise installation and lifecycle through the shipped launcher:

```sh
bun scripts/release/verify-candidate.ts \
  --previous /absolute/previous.tar.gz \
  --candidate /absolute/candidate.tar.gz \
  --output /absolute/new-evidence-directory
```

This creates an owned isolated installation with a short path, preserves its artifacts/state, and stops only its own test service. It verifies checksums and installation without a development toolchain on PATH; project registration/mounting through the public CLI; real installed MCP listing; persisted browser drafts, project source, identity and durable comment/domain results through upgrade, rollback and candidate restoration. Chromium/WebKit comment flows use an explicit fake provider socket and the installed reply executable. No fixture is sent to a real conversation, and no existing preview recipient is changed.

Run the standard delivery and UI regression matrix against the exact package without rebuilding it:

```sh
COMMENTS_E2E_PREPARED_RELEASE=/absolute/extracted-release \
COMMENTS_E2E_OUTPUT=/absolute/new-matrix-directory \
bun run test:e2e:comments
```

Prepared-release mode checks package integrity before and after the run. It runs the delivery/guard tests and eight demo/mounted browser profiles plus toolbar, keyboard, touch and viewport checks using frozen assets. It does not run a source rebuild or type check inside the immutable release. Run source checks against a separate source export with the same frozen dependencies; do not mutate the tested package. Installed launcher coverage is the separate lifecycle gate above.

## September 24 evidence and disposition

Retained evidence: `.decompozr/surface/production-candidate-20260924/`.

- Initial packaging correctly rejected the existing linked development package because its bytes did not match the committed pin. Added an explicit provider-package input and a regression proving that it retains both pin enforcement and the original development link. No provider checkout was edited.
- Rebuilt the formerly pinned provider to establish the merged application baseline, then rebuilt the user's updated provider from committed main and adopted its pin.
- `installed-1` completed upgrade/rollback checks, then caught duplicate fixture project names claiming the same readable route. The fixture now uses unique project names and stops its owned service even when setup fails. The product's conflict guard remains intact.
- `installed-2` passed the bundled CLI/MCP and lifecycle gates, plus previous-version idle and candidate idle/active desktop/mobile comment flows. Five durable interaction stores, project source and the browser draft survived activation changes. Source export checking against the new package reported zero Svelte errors/warnings.
- Desktop/mobile result, narrow review and constrained editor captures were inspected with the updated provider. New control density and type styles preserve visible actions, readable status and separate scroll areas. Physical-device behavior is not inferred from browser emulation.
- The first packaged matrix passed all eight delivery profiles, then exposed a toolbar verifier assumption: the more compact heading reaches the legitimate header clamp before a 60-pixel scroll finishes. The verifier now selects the lower description anchor to retain its full unclamped movement assertion. The focused Chromium/WebKit toolbar, desktop/touch/mobile interaction and keyboard-viewport checks passed; their rendered captures were inspected. No product positioning rule was weakened.

Final artifact identity, checksums, exact source revision, test reports and source-to-package comparison are recorded in the ignored completion receipt and each archive's `surface-release.json`. Earlier candidates and failures remain historical evidence. A passed candidate gate is not public publication, a real-agent queue-consumption claim, or authorization to replace another installation.
