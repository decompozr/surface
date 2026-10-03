# Release distribution

The bundle targets macOS Apple Silicon. It contains the native Bun runtime, frozen dependencies, built Surface app, CLI and agent skill with its references. Installing a prepared bundle does not clone source, install app dependencies or compile the app. Git remains required for project/worktree identity; project-owned dependencies may need network access.

Repository commands separate candidate production, accepted local promotion and installation. The runtime CLI owns service, project, interaction and prepared-install lifecycle operations; it does not produce releases. User commands belong to [SETUP.md](../../SETUP.md); agent procedures belong to the [setup reference](../../skills/surface/references/setup.md). [Installation lifecycle](installation-lifecycle.md) owns state preservation and activation invariants.

## Build contract

Select the intended committed source, then build a uniquely versioned candidate:

```sh
./bin/build --version 0.1.0-rc.YYYYMMDD.N --ref COMMIT \
  --design-system-package /absolute/prepared/package --out /absolute/candidates
```

The builder exports the selected Git commit, installs from the frozen root Bun lockfile with dependency scripts disabled, validates the prepared design-system package against that commit's `apps/surface/design-system.lock.json`, and builds Surface. The explicit package option allows an isolated provider export without changing development links or adopting uncommitted provider work. Building a candidate neither promotes it nor changes an installation.

The output is a complete platform/version tarball and SHA-256 sidecar. Metadata identifies the source commit, native runtime, platform, provider commit/package digest and per-file inventory. Existing versioned archives are never overwritten. The installer verifies inventory and platform before activation; modified or extra payload files are rejected.

## Acceptance and local promotion

Use the [candidate acceptance procedure](../evaluations/release-candidate.md) for source checks, the full comments browser matrix, installed CLI/MCP and state-preserving lifecycle, and rendered phone/desktop review. Prepared-release comments verification keeps the package immutable; demo/geometry fixtures are compiled separately and never substitute for mounted-page verification.

```sh
./bin/release --archive /absolute/candidate.tar.gz \
  --acceptance /absolute/acceptance.json --out /absolute/release-directory
```

Release validates the existing archive, checksum, inventory and provider identity, then requires a matching trusted acceptance receipt covering every required gate. The receipt records trusted operator observations; it is not cryptographic proof that checks ran. Promotion copies the exact accepted archive and checksum into `OUT/releases/ARCHIVE_SHA256/` and atomically publishes `OUT/release.json` last. The selection records a confined relative archive path (`releases/ARCHIVE_SHA256/BASENAME`), checksum and bundle metadata, so the release directory can move intact. The validated operator receipt is retained beside the archive as `acceptance.json`. Conflicting destinations fail while preserving the previous selection; repeating the same selection is idempotent.

Release never rebuilds, repacks, installs or uploads. Setup consumes the published selection via `./bin/setup --release /absolute/release-directory/release.json`; it delegates prepared-package installation and configures the selected service and checkout skill links. Setup validates selection and artifact bytes; it trusts `release.json` supplied by the release workflow and does not revalidate the sibling acceptance receipt or rerun its gates. A private preview and a shared installation remain separate targets. Freeze the tested source/provider/archive identities through promotion and setup. Publishing a download, changing a selected installation or exposing a network endpoint requires the corresponding task scope.

## Limits

Native macOS arm64 builds are currently supported. This is not a signed/notarized installer or cross-platform release matrix. Checksums detect corruption but do not authenticate a compromised distribution source. Build timestamps mean byte-for-byte reproducibility is not claimed. Fresh-user onboarding, actual provider delivery and physical-device acceptance remain distinct from isolated fixture success.
