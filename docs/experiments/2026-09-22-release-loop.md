# Build → release → first use experiment

The delivery process is part of the experiment: a developer must produce a versioned artifact, and a user must start from that artifact rather than the developer checkout.

## Bounded first target

- macOS Apple Silicon, local trusted project sources, experimental prerelease.
- Bundle the exact Bun runtime, frozen dependencies, built `apps/surface` shell, CLI, MCP adapter, and agent workflow references.
- Keep installation, shared metadata, and project sources separate. No automatic database creation, global skill/MCP changes, login service, or Tailscale changes.
- Existing installations and the live development host remain untouched during verification.

## Slices and acceptance

1. Make installed Surface run `apps/surface`, retaining project/backend and lifecycle contracts.
2. Build a portable versioned archive from a committed revision, with a checksum and explicit platform/runtime metadata. Installation copies prepared files; it must not require a checkout, dependency installation, or application compilation.
3. Publish an experimental release and download its exact artifact into an isolated directory. Install, start, check health, register/mount a separate Git project, and exercise the installed agent-facing interface.
4. Stop/restart and uninstall/reinstall with state retention. Record observed results and remaining gaps, including a real originating-agent conversation round trip as distinct from fixture delivery.

A release is not production acceptance. One-platform validation is not cross-platform support. An MCP tool call is not evidence that an agent received and completed a user interaction.
