# Install Surface on your Mac

This experimental release supports **Apple Silicon Macs** (`uname -m` prints `arm64`). It includes Bun and the built application. You do not need to clone or build Surface. Git is required for the projects you register; check `git --version` first. Internet access may be needed when mounting a project's dependencies.

## Clone and let your agent set it up

You can clone this repository into a stable directory and tell your agent: “Read AGENTS.md, set up Surface, link its skill into your configured provider skills directory, and test it.” The source workflow needs Git and Bun at a compatible patch version (currently `>=1.4.0 <1.5.0`).

```sh
git clone https://github.com/decompozr/surface.git
cd surface
./bin/setup
```

Run `./bin/setup` again after updating the checkout or stopping the service. It reuses a matching running version without restarting, starts a matching stopped version without rebuilding, and updates a different installed version after checks pass. An explicit port change restarts only the selected service. `./bin/test` verifies without making changes. Setup opens a compact Clack wizard with an arrow-key Codex / Claude Code / custom-directory menu, progress steps, and a readable completion card instead of raw JSON in a terminal. On a fresh clone it first prepares its pinned prompt dependencies. Noninteractive runs keep the structured output. Use ↑/↓ to move, Space to toggle, Enter to confirm, and Esc or Ctrl+C to cancel. The ❯ cursor marks selection and ● marks detected providers; ■/□ show checked/unchecked choices. Saved choices or all detected providers are preselected; use Space to change the checked options and Enter to confirm them together. Override with `--provider codex`, `--provider claude`, or `--skills-dir /absolute/provider/skills`. Repeat --provider or --skills-dir for multiple destinations. Noninteractive runs reuse saved choices or all detected providers. The successful selections are saved for subsequent commands. See [agent setup](skills/surface/references/setup.md) for provider discovery, update behavior and acceptance gates. Skills are **symlinked to the checkout, never copied**. Keep that checkout in place.

## Private access with Tailscale (source setup)

The current source UI depends on the private design-system package. Before source setup, build and link the provider revision recorded in `apps/surface/design-system.lock.json`; see [agent setup prerequisites](skills/surface/references/setup.md). Installation checks and freezes the package contents into each release. Downloaded bundles already include the package.

On first interactive setup, Surface detects Tailscale and preselects private HTTPS access when it is connected. Confirm the selection, or choose local access. The help option explains installation/sign-in and continues locally. If Tailscale is disconnected, open it and connect before selecting remote access. Surface does not install Tailscale or change its account/network settings.

Setup remembers the selection per installation home. Use `./bin/setup --tailscale on` or `--tailscale off` to change it. Noninteractive first runs default to local access unless explicitly enabled; subsequent setup runs reuse the saved choice. Completion shows both local and Tailscale URLs. `./bin/test` verifies the saved mapping without changing it; reachability from another device must be checked separately.

Surface uses [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve), never Funnel. It selects an unused HTTPS port starting at 8463 and remembers ownership and the loopback target. Repeated runs leave matching mappings alone; setup updates the target if the local port changes. Conflicting mappings and public endpoints are preserved and reported. Turning access off removes only the recorded, unchanged Surface mapping. Tailscale permissions and HTTPS certificate setup may require action in Tailscale; errors are reported without claiming remote access succeeded. The local service can remain running if remote configuration fails.

## Download and install

Download the `.tar.gz` and `.tar.gz.sha256` assets from [this release](https://github.com/decompozr/surface/releases/tag/v0.1.0-experiment.20260922.2) into the same directory. In Terminal:

```sh
cd "$HOME/Downloads"
shasum -a 256 -c surface-0.1.0-experiment.20260922.2-darwin-arm64.tar.gz.sha256
tar -xzf surface-0.1.0-experiment.20260922.2-darwin-arm64.tar.gz
./surface-0.1.0-experiment.20260922.2-darwin-arm64/install
"$HOME/.decompozr/surface/bin/surface" start
"$HOME/.decompozr/surface/bin/surface" status
```

Continue only if the checksum reports OK. Open the origin returned by start/status (normally `http://127.0.0.1:4319`). This is your laptop's service, separate from any service on another machine. The application opens a runtime status page; your project pages appear after mounting.

An existing host on port 4319 causes a visible conflict; choose `start --port 4321` for a separate service. If you already have a Surface installation elsewhere, use its exact launcher/home to manage it. This installer does not migrate or delete it.

No shell profile or login service is changed. The absolute command above works in any directory. Optionally run `export PATH="$HOME/.decompozr/surface/bin:$PATH"` in your terminal session for the shorter `surface` command. You can remove the extracted download after installation.

## Use it with your agent

In a Git project's agent conversation, say:

> Use my installed Surface at `~/.decompozr/surface/bin/surface`. Check its status. Find the active release in `~/.decompozr/surface/active.json` and read `~/.decompozr/surface/releases/<release>/skills/surface/SKILL.md`. Create a small interactive comparison in this project, register and mount it, and give me its URL. Before submitting anything back to this conversation, verify the exact originating conversation and connection details.

The agent keeps source files in your project. Registration and mounts use the shared service; worktrees get separate identities. SQLite stays absent unless the project actually needs it. A rendered preview alone does not imply that agent delivery is configured.

For an MCP-capable agent host, use the absolute executable path `/Users/YOUR_NAME/.decompozr/surface/bin/surface` as the command and `["mcp"]` as its arguments. Do not put a literal `~` in configurations that do not expand it. MCP configuration is host-specific and is not installed automatically.

For new project pages, follow the [route-based page guide](skills/surface/references/pages.md): declare `routes` and use `+page.svelte` files for readable `/workspace/...` URLs. Read-only pages need no interaction binding; submitting to an agent requires a separate request URL.

## Manage it

```sh
"$HOME/.decompozr/surface/bin/surface" doctor
"$HOME/.decompozr/surface/bin/surface" workspace list
"$HOME/.decompozr/surface/bin/surface" requests
"$HOME/.decompozr/surface/bin/surface" stop
"$HOME/.decompozr/surface/bin/surface" start
```

Logs are at `~/.decompozr/surface/run/host.log`. Stop before running a newer release's installer against the same home. `uninstall` removes application releases while retaining service metadata and project data; it requires the service to be stopped and unresolved callbacks to be reconciled. Project source files are not removed.

This prerelease is unsigned/unnotarized. The downloaded installer does not configure Tailscale exposure, auto-start, agent configuration or global skill installation. Source setup separately offers the private Serve and provider-symlink workflow described above. See the [release contract](docs/architecture/release-distribution.md) for the build/release contract and current limits.
