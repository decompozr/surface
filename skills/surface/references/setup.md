# Agent-managed checkout setup

Use this workflow when the user asks to clone/setup Surface or refresh their source installation. Resolve this skill's symlink to the checkout and read its `AGENTS.md`. Keep the checkout at a stable location: the provider link follows its files, and relative references depend on the full repository.

## Select and inspect

- Discover the current provider's configured skills directory from its environment/instructions. Pass that exact directory with `--skills-dir`; do not assume all agents use the same folder. For Codex the default is `${CODEX_HOME:-$HOME/.codex}/skills`. For another provider, obtain its actual directory instead of guessing.
- Inspect the checkout branch/status and the selected service home. Existing installations elsewhere are not automatically migrated. Use `--home` throughout for a nondefault installation.
- Git and the exact Bun version in `package.json` are prerequisites for the source workflow. Report a missing/wrong version; do not silently install an arbitrary runtime. Downloaded releases instead include Bun.

## Setup

From the clean, committed checkout:

```sh
bun scripts/agent/setup.ts setup --skills-dir /absolute/provider/skills
```

The command installs frozen root dependencies, runs checks, builds/installs the committed revision into `~/.decompozr/surface`, creates or verifies `PROVIDER_SKILLS/surface -> CHECKOUT/skills/surface`, starts the installed service and verifies health/identity. Use `--port` for an intentional alternative. The script reports the executable, URL, selected release and real link target as JSON. It never copies a skill or alters provider MCP configuration.

A running selected installation makes setup stop with guidance to use test or refresh. A file, real directory, foreign link or dangling link at the skill destination is preserved. Inspect and resolve that specific conflict with the user; do not force-replace it.

## Test

```sh
bun scripts/agent/setup.ts test --skills-dir /absolute/provider/skills
```

This checks the link and running installation, doctor output and matching app/service identity. It does not start or stop the service. Then, when the task includes user-flow acceptance, create/mount a disposable project-owned page, inspect it in a browser and test the intended interaction. Real conversation binding/delivery is a separate gate; health or MCP discovery is not proof of it. No automated submission should be presented as user intent.

For release delivery regression, build the selected commit with `scripts/release/build.ts` and run `scripts/release/verify.ts ARCHIVE --default-home` in its isolated fixture. Do not substitute that fixture for testing the user's provider discovery.

## Refresh

When the user requests an update, inspect WIP and the intended branch first. Fetch and fast-forward only the selected upstream (`git pull --ff-only` when appropriate); do not reset, discard WIP, auto-merge divergence, or switch branches implicitly. Then:

```sh
bun scripts/agent/setup.ts refresh --skills-dir /absolute/provider/skills
```

Refresh checks before stopping the selected owned service, installs HEAD, verifies the existing link and starts/tests the selected release. It preserves project data and other services. Installation failures remain visible; recovery may restart the selected release to restore availability, but is not a promised rollback of a newly activated release. Inspect the reported release/status before claiming recovery. A moved checkout or different link source requires explicit reconciliation.

The provider link is stable because it targets the checkout, not a copied skill or a version-specific installed directory. Source edits are visible through the link immediately; after refresh, have the provider reload/restart its skill discovery if required. Verify discovery separately. Avoid leaving this linked checkout on an incompatible development revision while relying on an older installed runtime.
