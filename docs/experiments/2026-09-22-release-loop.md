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

## Observed outcome — 2026-09-22

Published [v0.1.0-experiment.20260922](https://github.com/decompozr/surface/releases/tag/v0.1.0-experiment.20260922), targeting source commit `16a4e9d7a630e9dff08cff23030a6839564ea826`.

- Artifact: `surface-0.1.0-experiment.20260922-darwin-arm64.tar.gz`, approximately 84 MB.
- SHA-256: `860c267821012fe36c6600230544a81e87f95dd61554bafe294db2d1d1132485`.
- Re-downloaded both assets from GitHub, verified the checksum, and ran `bun scripts/release/verify.ts /absolute/download/archive.tar.gz`.
- Installation and lifecycle commands ran with system-only PATH, using the bundled Bun. The extracted directory was moved after installation; the installed entry continued working from a different project.
- The installed current app served health and a separate Git project's readable page. Chrome rendered the counter and a real click changed Count 0 to Count 1.
- The real installed stdio MCP adapter listed the same project/workspace as the CLI. This is tool integration evidence, not live agent delivery.
- Restart and uninstall/reinstall retained project source and workspace identity. Unused project database directories remained absent.
- Separately upgraded an isolated installation from the private `4b3c277` candidate to published `16a4e9d`, started it with the retained workspace, then rolled back and started the older candidate. Both have the same schema; this is not evidence of cross-schema migration.
- All experiment hosts were stopped. The existing shared installation, development host/Tailscale mapping, canonical checkout and pre-existing worktrees were preserved.

Checks: root TypeScript, app Svelte/TypeScript, app host tests (3/31 assertions), release inventory tests (2/6 assertions), and the installed workspace/backend regression. Private machine paths and fixture state are retained under ignored `.decompozr/surface/release-proof/result.json`; they are not part of the release or public evidence.

## Next human experiment

Ask a first-time user to download this prerelease and use its setup instructions without developer intervention. Have their agent create a useful project-owned page, bind the exact originating conversation, receive a deliberate user submission, and publish a result back to the page. Record every undocumented prerequisite or manual recovery. Do not treat a fixture submission as the user's intent.

Outstanding product work includes agent discovery/configuration UX, a friendlier installation/setup experience, service/autostart choices, release signing/notarization, more platforms, and future schema migration gates. This first release deliberately provides explicit CLI management instead of claiming these are complete.
