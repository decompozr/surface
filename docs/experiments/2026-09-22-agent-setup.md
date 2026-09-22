# Agent-managed setup, test and refresh

The checkout now provides `AGENTS.md` and `scripts/agent/setup.ts` so an agent can inspect a clone and operate a selected installation without inventing the sequence. The updated Surface skill routes setup/refresh tasks to `references/setup.md`.

The provider skills directory is explicit. Its `surface` entry is a symlink to the checkout's complete `skills/surface` directory. Re-running setup/refresh checks the target; it does not copy instructions or overwrite real directories, foreign links or broken links. Different providers can use the same source via separate explicit destinations. Provider discovery/reloading remains a separate observation.

A fresh local Git clone initially exposed missing compiler dependencies during typechecking. Setup now prepares the root, compiler, MCP and app dependency sets with frozen lockfiles before checks.

Verified in an isolated home and provider directory: committed-source setup, built app health, read-only test, and refresh restarting the selected service while preserving the skill's source target. Source and installed commit identity are checked; stale installations are reported. Unit checks cover idempotence, live source changes through the link and conflict preservation. Root TypeScript and the skill validator passed. The existing Codex skill link already targeted this canonical checkout and was preserved.

The source workflow requires the exact Bun version plus Git. It is distinct from the downloaded bundle's bundled-runtime path. No global MCP configuration, default installation migration, live agent submission, Tailscale or login-service change is performed. The fixture host is stopped after verification.
