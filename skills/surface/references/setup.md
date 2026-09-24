# Agent-managed checkout setup

Use this workflow when the user asks to clone/setup Surface or refresh their source installation. Resolve this skill's symlink to the checkout and read its `AGENTS.md`. Keep the checkout at a stable location: the provider link follows its files, and relative references depend on the full repository.

## Select and inspect

- Discover the current provider's configured skills directory from its environment/instructions. Pass that exact directory with `--skills-dir`; do not assume all agents use the same folder. For Codex the default is `${CODEX_HOME:-$HOME/.codex}/skills`. Claude Code uses `~/.claude/skills` ([official skills documentation](https://code.claude.com/docs/en/skills)); other locations can use `--skills-dir`.
- Inspect the checkout branch/status and the selected service home. Existing installations elsewhere are not automatically migrated. Use `--home` throughout for a nondefault installation.
- Git and a compatible Bun patch version (currently `>=1.4.0 <1.5.0`) are prerequisites for the source workflow. Report a missing/wrong version; do not silently install an arbitrary runtime. Downloaded releases instead include Bun.
- Source builds also need the private `@decompozr/design-system` provider at the commit in `apps/surface/design-system.lock.json`. Build that provider with its frozen dependencies and `npm run package`, register its local package with `bun link`, and link it into `apps/surface`. Development stays linked. Installation verifies the committed content hash and copies the package into the unpublished release; a mismatch stops installation. Prepared downloads contain these pinned bytes and need no provider checkout. Preserve existing provider worktrees and links when choosing the build source.

The user's standing update policy is to adopt the latest committed design-system `main` for each Surface update/release. Resolve and record that commit, build it with frozen dependencies, update the Surface pin, and validate the consumer before preparing the release. Keep the selected provider revision fixed throughout that validation. If the existing development link belongs to other WIP, preserve it: use a separate source export and `scripts/release/build.ts --design-system-package /absolute/prepared/package`. This option still requires the exact committed pin; it does not authorize editing another checkout or bypassing verification. Downloaded release consumers receive the frozen validated package without needing the provider repository.

The short `./bin/*` entry points are executable Bun TypeScript scripts, not compiled binaries. Interactive setup uses Clack prompts with progress steps and a completion card; its frozen UI dependencies are bootstrapped on a fresh clone. Noninteractive callers keep structured output. Setup presents Codex, Claude Code and custom-directory choices with ↑/↓ navigation, Space toggling, Enter confirmation, and Esc/Ctrl+C cancellation. The ❯ cursor and ● detection markers, with ■/□ checkboxes use Unicode, with no icon font required. It detects provider home directories and preselects saved choices or all detected providers. Multiple providers can be checked together. Test reuses the saved directories; setup preselects them. `--provider codex|claude` or `--skills-dir PATH` bypasses the menu. Noninteractive callers need an explicit selection when no providers are detected. Flags can be repeated to select multiple destinations. The selected home and symlink are printed before setup.

## Setup

From the clean, committed checkout:

```sh
./bin/setup --skills-dir /absolute/provider/skills
```

The command installs frozen root dependencies, runs checks, builds/installs the committed revision into `~/.decompozr/surface`, creates or verifies `PROVIDER_SKILLS/surface -> CHECKOUT/skills/surface`, starts the installed service and verifies health/identity. Use `--port` for an intentional alternative. The script reports the executable, URL, selected release and real link target as JSON. It never copies a skill or alters provider MCP configuration.

Repeating setup against the same running version verifies health and all selected skill links without rebuilding or restarting. New provider links can be added on a repeat run. A stopped matching version is started without rebuilding. A different version is installed after checks pass, then started. An explicit port change restarts the selected service without rebuilding. `refresh` is a compatibility alias for setup. A file, real directory, foreign link or dangling link at the skill destination is preserved. Inspect and resolve that specific conflict with the user; do not force-replace it.

## Test

```sh
./bin/test --skills-dir /absolute/provider/skills
```

This checks the link and running installation, doctor output and matching app/service identity. It does not start or stop the service. Then, when the task includes user-flow acceptance, create/mount a disposable project-owned page, inspect it in a browser and test the intended interaction. Real conversation binding/delivery is a separate gate; health or MCP discovery is not proof of it. No automated submission should be presented as user intent.

For release delivery regression, build the selected commit with `scripts/release/build.ts` and run `tests/e2e/release/bundle.ts ARCHIVE --default-home` in its isolated fixture. Do not substitute that fixture for testing the user's provider discovery.

## Update with setup

When the user requests an update, inspect WIP and the intended branch first. Fetch and fast-forward only the selected upstream (`git pull --ff-only` when appropriate); do not reset, discard WIP, auto-merge divergence, or switch branches implicitly. Then:

```sh
./bin/setup --skills-dir /absolute/provider/skills
```

Setup checks before stopping the selected owned service, installs HEAD, verifies the existing link and starts/tests the selected release. It preserves project data and other services. Installation failures remain visible; recovery may restart the selected release to restore availability, but is not a promised rollback of a newly activated release. Inspect the reported release/status before claiming recovery. A moved checkout or different link source requires explicit reconciliation.

The provider link is stable because it targets the checkout, not a copied skill or a version-specific installed directory. Source edits are visible through the link immediately; after setup updates the installation, have the provider reload/restart its skill discovery if required. Verify discovery separately. Avoid leaving this linked checkout on an incompatible development revision while relying on an older installed runtime.

## Private Tailscale access

Source setup detects a connected Tailscale and preselects private HTTPS on first interactive use. Saved choices are reused; noninteractive first setup stays local unless `--tailscale on` is explicit. Use `./bin/setup --tailscale on|off` to change the selection. Setup manages only its recorded Serve mapping, configures the accepted browser origin, and prints the HTTPS URL. It does not enable Funnel. See [remote browser verification](pages.md#remote-browser-access); provider discovery and real conversation delivery remain separate checks.
