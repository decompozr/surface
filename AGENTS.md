# Surface repository agent entry

Read `SETUP.md` for user installation and `skills/surface/references/setup.md` for the agent-managed source workflow.

When asked to setup this clone, use `./bin/setup --skills-dir PROVIDER_SKILLS_DIRECTORY`. Discover the actual provider directory; do not copy skills. Keep its `surface` entry as a symlink to this checkout's `skills/surface` directory. Preserve existing directories and foreign/broken links. The command supports `test` and `refresh`, plus explicit `--home`/`--port` selection.

The source workflow requires Git and a compatible Bun patch version (currently `>=1.4.0 <1.5.0`). It installs committed HEAD; preserve user changes and never commit, reset, switch branches or pull solely to make an installer pass without task authorization. An update request permits inspecting/fetching and a fast-forward of the intended upstream; divergence requires reconciliation.

Use the selected installation consistently. Keep project-owned source, service metadata and optional database data separate. Do not replace an existing service/home implicitly. Never send a fixture interaction into a real user conversation. Setup health, provider discovery, browser interaction and agent delivery are separate acceptance checks.

Repository documentation is English. Preserve the canonical checkout and existing worktrees. For shell searches use `/opt/homebrew/bin/rg` when available; otherwise report its absence before selecting another tool.
