# Experimental binary distribution

The first downloadable artifact targets **macOS Apple Silicon**. It bundles Bun, frozen dependencies and the built `apps/surface` application. Installation does not clone the repository, install application dependencies, or compile the application. Git is still required for project/worktree identity; mounted project dependencies may require network access.

## Developer: build and release

Commit the intended source, then run:

```sh
bun scripts/release/build.ts --version 0.1.0-experiment.20260922.2 --ref COMMIT
```

When the development link contains unrelated work or an older provider, build the pinned design-system commit in a separate source export and pass `--design-system-package /absolute/prepared/package`. The builder still checks its exact content against the selected Surface commit's `apps/surface/design-system.lock.json`; this option does not bypass the pin or replace the development link. Downloaded bundles own these verified bytes.

The build exports only the selected Git commit, prepares frozen dependencies with dependency scripts disabled, builds the app, and packages the native runtime. `dist/` receives a platform/version tarball and SHA-256 sidecar. Release metadata identifies the source commit, exact runtime and file inventory. Publish the archive and checksum as assets of an explicitly experimental GitHub prerelease pointing at that same commit. An existing archive is never overwritten.

This is not yet a signed/notarized installer or a cross-platform release matrix. Checksums detect corruption; they do not independently authenticate a compromised download source. Native builds are required. Build timestamps mean byte-for-byte reproducibility is not claimed.

## User: download, install and start

Download the [first experimental release](https://github.com/decompozr/surface/releases/tag/v0.1.0-experiment.20260922.2) archive and its `.sha256` file from the same release. In the download directory:

```sh
shasum -a 256 -c surface-0.1.0-experiment.20260922.2-darwin-arm64.tar.gz.sha256
tar -xzf surface-0.1.0-experiment.20260922.2-darwin-arm64.tar.gz
./surface-0.1.0-experiment.20260922.2-darwin-arm64/install
"$HOME/.decompozr/surface/bin/surface" start
"$HOME/.decompozr/surface/bin/surface" status
```

Use the origin returned by start/status to open the application. The default installation home is `~/.decompozr/surface` and the default port is 4319. Use `--home` consistently and a different `--port` when testing alongside another installation. Existing installations in Application Support/XDG are not moved or adopted automatically; continue using their launcher or explicit `--home` until a migration is planned. The installer reports the actual executable path. No shell profile, MCP host, agent skill, login item or network exposure is configured automatically. The home path must fit the current Unix socket limit (control socket path at most 100 characters).

Installation checks platform/runtime and every packaged file before copying into a versioned release directory. The executable uses the bundled runtime and remembers its installation home, so it works from an unrelated cwd. The download folder can be removed after successful installation.

## Agent use and management

Give your agent the absolute installed `bin/surface` path and the installed release's `skills/surface/SKILL.md`. The release path is returned by installation as `releases/<release>` under the selected home. The skill and relative references are included; do not copy the skill file away from its references. To configure an MCP host, use that executable as the command with arguments `["mcp"]`. This does not itself bind or wake an agent conversation.

From a separate Git project, the agent creates project-owned Svelte source, then uses `project init`, `register`, `add`, `mount` and the returned preview URL. See [the project command guide](workspace-service.md) and the bundled skill for exact session binding and structured request/result steps. The installed service starts with its status shell; it does not silently register its own installation directory as a user project.

Use `status`, `doctor`, `workspace list`, `project list`, `requests`, `stop`, and `restart` through the installed executable. Host logs are in `<home>/run/host.log`. Unmount individual artifacts without stopping other projects. Source and optional project data remain separate from release files.

To upgrade, stop the service and run the new download's `install --home SAME_HOME`. Existing schema compatibility checks apply before activation. Previous releases remain available to `rollback --release ID`. `uninstall` requires a stopped service, removes release payloads, and preserves service state, project data and lifecycle tooling. Reinstall from a downloaded bundle; unresolved agent callbacks block removal of their release executables.

The first experiment validates local fixture operations. A fresh user's real agent configuration, real conversation delivery, and human onboarding acceptance are separate evidence gates.

## Current candidate acceptance

Use the [installed candidate gate](../evaluations/release-candidate.md) for current application delivery, including the latest committed design-system pin, packaged browser verification and state-preserving upgrade/rollback. Earlier downloadable experiments retain their historical status; candidate preparation does not publish a release or alter a selected user installation.
