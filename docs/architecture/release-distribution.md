# Release distribution

The current bundle targets macOS Apple Silicon. It contains the native Bun runtime, frozen dependencies, built Surface app, CLI and agent skill with its references. Installing a prepared bundle does not clone source, install app dependencies or compile the app. Git remains required for project/worktree identity; project-owned dependencies may need network access.

User commands belong to [SETUP.md](../../SETUP.md); agent procedures belong to the [setup reference](../../skills/surface/references/setup.md). [Installation lifecycle](installation-lifecycle.md) owns state preservation and activation invariants.

## Build contract

Commit the intended source, then build a uniquely versioned candidate:

```sh
bun scripts/release/build.ts --version 0.1.0-rc.YYYYMMDD.N --ref COMMIT --design-system-package /absolute/prepared/package
```

The builder exports the selected Git commit, installs from the frozen root Bun lockfile with dependency scripts disabled, validates the prepared design-system package against that commit's `apps/surface/design-system.lock.json`, and builds Surface. The explicit package option allows an isolated provider export without changing development links or adopting uncommitted provider work.

The output is a platform/version tarball and SHA-256 sidecar. Metadata identifies the source commit, native runtime, platform and per-file inventory. Existing versioned archives are never overwritten. The installer verifies inventory and platform before activation; modified or extra payload files are rejected.

## Acceptance and promotion

Use the [candidate acceptance procedure](../evaluations/release-candidate.md) for source checks, browser flows, installed CLI/MCP, state-preserving upgrade/rollback and rendered review. Prepared-release comments verification keeps the package immutable; demo/geometry fixtures are compiled separately and never substitute for mounted-page verification.

A private preview and a shared installation are separate targets. Freeze the tested revision and package bytes through promotion. Publishing a download, changing a selected installation or exposing a network endpoint requires the corresponding task scope; building a candidate alone performs none of them.

## Limits

Native macOS arm64 builds are currently supported. This is not a signed/notarized installer or cross-platform release matrix. Checksums detect corruption but do not authenticate a compromised distribution source. Build timestamps mean byte-for-byte reproducibility is not claimed. Fresh-user onboarding, actual provider delivery and physical-device acceptance remain distinct from isolated fixture success.
