# Agent-managed checkout setup

Use this workflow when the user asks to clone/setup Surface or refresh their installation through a stable checkout. Resolve this skill's symlink to the checkout and read its `AGENTS.md`. Keep the checkout at a stable location: the provider link follows its files, and relative references depend on the full repository.

## Select and inspect

- Discover the current provider's configured skills directory from its environment/instructions. Pass that exact directory with `--skills-dir`; do not assume all agents use the same folder. For Codex the default is `${CODEX_HOME:-$HOME/.codex}/skills`. Claude Code uses `~/.claude/skills` ([official skills documentation](https://code.claude.com/docs/en/skills)); other locations can use `--skills-dir`.
- Inspect checkout branch/status, the selected `release.json` and service home. Existing installations elsewhere are not automatically migrated. Use `--home` throughout for a nondefault installation.
- Git and a compatible Bun patch version (currently `>=1.4.0 <1.5.0`) are prerequisites for checkout tooling. Report a missing/wrong version; do not silently install an arbitrary runtime. Downloaded releases instead include Bun.
- Setup consumes an existing prepared archive. It does not export source, install application dependencies or compile Surface. Fresh setup requires `--release /absolute/release-directory/release.json`; subsequent runs validate the saved archive digest and bundle identity against installed bytes for that home, without requiring the original downloaded archive. Build and accepted local promotion are separate repository operations described in [release distribution](../../../docs/architecture/release-distribution.md).

For each Surface update/release, adopt the design-system provider's latest committed `main`. Resolve and record that commit, build it with frozen dependencies, update the Surface pin, and validate the consumer before producing a candidate. Keep the selected provider revision fixed throughout validation. Preserve existing development links and provider WIP: use a separate source export with `./bin/build --design-system-package /absolute/prepared/package`. The package must match the selected committed Surface pin. Prepared releases already contain these frozen bytes and need no provider checkout at setup time.

The short `./bin/*` entry points are executable Bun TypeScript scripts, not compiled binaries. Interactive setup uses Clack prompts with progress steps and a completion card; its frozen prompt dependencies come from the verified package without installing source dependencies. Noninteractive callers keep structured output. Setup presents Codex, Claude Code and custom-directory choices with ↑/↓ navigation, Space toggling, Enter confirmation, and Esc/Ctrl+C cancellation. The ❯ cursor and ● detection markers, with ■/□ checkboxes use Unicode, with no icon font required. It detects provider home directories and preselects saved choices or all detected providers. Multiple providers can be checked together. Test reuses the saved directories; setup preselects them. `--provider codex|claude` or `--skills-dir PATH` bypasses the menu. Noninteractive callers need an explicit provider selection when none are detected. Flags can be repeated to select multiple destinations. The selected home and symlink are printed before setup.

## Setup

From the stable checkout:

```sh
./bin/setup --release /absolute/release-directory/release.json \
  --skills-dir /absolute/provider/skills
```

Setup validates the selection, archive checksum, bundle inventory/platform and linked skill compatibility before changing the selected service. It delegates installation to the shipped prepared-package installer, creates or verifies `PROVIDER_SKILLS/surface -> CHECKOUT/skills/surface`, starts the selected installed service and verifies health/identity. Use `--port` for an intentional alternative. It reports the executable, URL, selected release and real link target. It never copies a skill or alters provider MCP configuration.

Repeating setup against the same running package verifies health and all selected skill links without rebuilding or restarting. New provider links can be added on a repeat run. A stopped matching package is started without rebuilding. A different explicitly selected release is installed and started; an explicit port change restarts only the selected service. A file, real directory, foreign link or dangling link at the skill destination is preserved. Inspect and resolve that specific conflict with the user; do not force-replace it.

The artifact, not checkout HEAD, defines the installed revision. Documentation-only edits and unrelated HEAD advancement do not by themselves block setup or test. Compatibility requires an exact match for the full `skills/surface` tree and runtime CLI source, excluding `apps/cli/src/installation/setup` tooling. Setup configuration/tooling may change; other incompatible skill or runtime CLI changes require explicit reconciliation rather than silently relinking, copying or switching Git revisions.

## Test

```sh
./bin/test --skills-dir /absolute/provider/skills
```

This checks the selected artifact, compatible checkout skill/link and running installation, doctor output and matching app/service identity. It does not build, install, start or stop the service. Then, when the task includes user-flow acceptance, create/mount a disposable project-owned page, inspect it in a browser and test the intended interaction. Real conversation binding/delivery is a separate gate; health or MCP discovery is not proof of it. No automated submission should be presented as user intent.

For release delivery regression, use `./bin/build` for a candidate and run `bun tests/e2e/release/bundle.ts ARCHIVE --default-home` in its isolated fixture. Complete the full [release acceptance](../../../docs/evaluations/release-candidate.md) before promotion; do not substitute that fixture for testing the user's provider discovery.

## Update with setup

When the user requests an update, inspect WIP and the intended branch first. Fetch and fast-forward only the selected upstream (`git pull --ff-only` when appropriate); do not reset, discard WIP, auto-merge divergence, or switch branches implicitly. Updating the checkout does not automatically select or build a runtime release.

### Promoting a verified archive

Build a candidate with the frozen provider package, complete all mandatory acceptance gates, and promote those exact bytes with `./bin/release --archive ARCHIVE --acceptance RECEIPT --out DIRECTORY`. Then select its published descriptor:

```sh
./bin/setup --release /absolute/release-directory/release.json \
  --skills-dir /absolute/provider/skills --home /absolute/selected-home
./bin/test --skills-dir /absolute/provider/skills --home /absolute/selected-home
```

Setup verifies before stopping the selected owned service, installs the prepared package and starts/tests it. It preserves project data and other services. Installation failures remain visible; recovery may restart the selected release to restore availability, but is not a promised rollback of a newly activated release. Inspect reported selection/status before claiming recovery. A moved checkout or different link source requires explicit reconciliation.

The provider link remains stable because it targets the checkout, not a copied skill or version-specific installed directory. Have the provider reload/restart skill discovery if required and verify discovery separately. Keep canonical skill contents compatible with the selected archive. Selection validation can therefore tolerate source HEAD changes without weakening the skill/runtime CLI contract. Older saved setup configuration without an artifact identity may reuse a verified compatible installed bundle; this does not establish that a trusted release acceptance receipt exists.

## Private Tailscale access

Checkout setup detects a connected Tailscale and preselects private HTTPS on first interactive use. Saved choices are reused; noninteractive first setup stays local unless `--tailscale on` is explicit. Use `./bin/setup --tailscale on|off` to change the selection. Setup manages only its recorded Serve mapping, configures the accepted browser origin, and prints the HTTPS URL. It does not enable Funnel. See [remote browser verification](pages.md#remote-browser-access); provider discovery and real conversation delivery remain separate checks.
