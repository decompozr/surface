# October 5 local release preparation

The local update selects design-system main `c0863d99015cfd6b039755f2f2fb94ce5ee47aa7`, verified against its remote main. An isolated committed-source export was installed with the frozen npm lock using npm 11.19 under Bun 1.4.2; packaging and provider checks passed with no Svelte errors or warnings. No provider checkout or development link was changed.

The package contains 149 files with digest `7027dcee051e89272c40bbd935cc6dd99add12a2165886f5d288023ffcee668f`. Surface type checking, Svelte checking and 126 tests / 1,135 assertions passed against these bytes. The previously unavailable provider commit is now an ancestor of remote main.

## Accepted and installed release

PR #68 merged as `6181cd3a9f2a2cefc0173a4e6ed70c2d5ef136d3`. Candidate `0.1.0-rc.20261005.1` was built from that remote main commit, with archive SHA-256 `a97a68ea25d663f122c8369a244bc1b8de48a6429df79a8263e1c4727b28b738`. Remote main was checked again before promotion/installation. Main source checks repeated successfully: 126 tests / 1,135 assertions, type/Svelte checks, MCP/project-access verifiers and documentation validation.

The exact archive passed the complete prepared-release comments matrix (eight Chromium/WebKit demo/mounted idle/active profiles, authorization/delivery guards, lost acknowledgement, reconnect/reload, theme, toolbar, touch and constrained keyboard/viewport coverage), default-home bundle lifecycle, and installed upgrade/rollback/restoration. Five durable records, browser draft, project source and workspace identity survived the transitions. The previous baseline was repacked from the installed immutable payload for fixture transport; its new container digest does not represent the original download.

Rendered desktop/phone navigation, empty comments, reply/draft, constrained composer, dark/light shell, generated page and home were inspected. The generated-page fixture retained an open comments panel, so supplemental captures with it closed were inspected. No scoped visual findings remain. Physical devices, native assistive technology, provider skill rediscovery and real conversation delivery were not tested. All interaction submissions used isolated fake providers. Verification was self-checking in this run.

`bin/release` promoted identical bytes with the exact acceptance receipt. The prepared setup verifier passed rejection, reuse and saved-selection scenarios. Standard `bin/setup` initially encountered a stale control socket from the stopped old service. The public `surface recover` command verified dead ownership and retained a recovery record before setup was retried successfully. `bin/test` then passed against the installed payload and canonical skill link.

The standard home remains `~/.decompozr/surface`, local port 4319 and private Tailscale URL `https://mac-mini.duckbill-ionian.ts.net:8463`. Live HTTPS browser rendering/navigation passed without page errors. Health and the exact allowed host returned 200; unrelated host and origin returned 403. Other Tailscale mappings were preserved. The live home has no mounted route pages; deployment does not create user projects.

## Evidence retirement

The first browser attempts stopped because the matching Playwright browsers were absent; task-local browsers were downloaded and both full suites rerun successfully. Temporary provider exports, browser downloads, fixture installations, archives, screenshots and logs are disposable after this report is remotely preserved and their processes are stopped. The standard installation, prior installed release, user state and recovery record are retained. Saved setup verifies installed package bytes without requiring the original temporary download.
