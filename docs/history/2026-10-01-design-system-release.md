# October 1, 2026 design-system release

This release adopts the latest committed design-system main selected on October 1 and captures the adopted [template-page direction](../requirements/template-pages.md). Typed, templated, persisted pages remain product direction, not delivered runtime functionality. No public release or Git push was performed.

## Identity

- Surface source: `7fbeb867a197c0b45f1a632bd6ec20d74ecd8b07`.
- Design-system source: `f4be55aa2a50952038436968ba29ba255c9e09c4`; exact isolated export, frozen npm install, package build, and 136-file identity `7c01b7e9fa563a7c3a47e01279ffcc2c80496f6063da2317802b7db08c3230fe`.
- Local candidate: `surface-0.1.0-rc.20261001.2-darwin-arm64.tar.gz`; SHA-256 `03a5c0545bec0864ae4187fbcb1c0e6785303609b2ecb8ce4e98b30c71f840d0`; bundled Bun 1.4.2.
- Lifecycle baseline: Surface `c93fef5232603f19e81b5b7b2004569498c3b330`, provider `1820dbcea6723609ac9191890337537e57ebc13c`, rebuilt against its committed 128-file package digest `5ee7efa0e6dfc1eb8fd955c7e370afce4a0452f95dff48ad8cdc1f55d376682b`.

## Verification and resolved findings

A separate source checkout with the same immutable provider package passed root/app type checks (zero Svelte errors or warnings), build, and 108 tests with 1,011 assertions. Documentation link and traceability checks passed. The final package passed the complete prepared-release comments matrix: demo and mounted pages, idle/active recipients, Chromium desktop and WebKit iPhone 13 emulation, authorization guards, changed active turns, explicit queue/steer, lost acknowledgement, SSE, offline recovery, reload, and no duplicate delivery. Theme persistence/system changes, embedded viewport, toolbar pointer/keyboard/touch, scrolling and constrained-height draft checks also passed.

The release bundle verifier used an isolated default home and system-only PATH, verifying shipped runtime/CLI/MCP, restart, uninstall/reinstall and source/registry preservation. The candidate lifecycle verifier exercised baseline → candidate → rollback → candidate, preserving browser draft, source, workspace identity, and durable comment/domain results; installed previous-idle and candidate idle/active browser profiles were separately exercised.

Failures discovered during preparation and their disposition:

- Node/npm were absent. Official Node 26.7.0/npm 11.19 was staged temporarily; the archive digest was verified against the official distribution manifest. Existing provider checkout and global tool configuration were preserved.
- A development symlink resolved distinct provider/consumer Svelte `Snippet` symbols. Validation switched to the immutable materialized package layout used by releases, where the consumer owns peer resolution; no type suppression or provider change was needed.
- The lifecycle verifier used retired comment-selection controls. It now uses the current Comment tools toolbar and target selection.
- The lifecycle verifier closed an already restored-open comments panel. It now checks current panel visibility before opening it, preserving all draft/storage/source assertions.
- A navigation screenshot captured a narrow animation frame. The verifier now waits for full open width and position before capture.

Rendered final-package phone and desktop states were inspected, including actual home, mounted page, navigation open/closed, light/dark theme, focused tab/close controls, and constrained-height comment editor. The navigation fix was recaptured and inspected. Generated phone content was inspected separately with the restored comments panel closed. Pointer/touch close and keyboard focus were exercised. No actionable scoped visual regression remained.

## Installation and limits

The standard home `/Users/scottchu/.decompozr/surface` was absent before promotion. Its shipped installer installed the verified archive; canonical `./bin/setup --skills-dir /Users/scottchu/.codex/skills --home /Users/scottchu/.decompozr/surface` reused that exact release and started it at `http://127.0.0.1:4319`. Full installed bundle inventory and provider digest were rechecked unchanged. The canonical skill symlink points to this checkout. Read-only `./bin/test` passed; actual installed desktop/phone home and navigation smoke checks passed without browser errors.

This history is an explicit uncommitted documentation follow-up. Checkout HEAD and installed source both remain `7fbeb867a197c0b45f1a632bd6ec20d74ecd8b07`; no runtime change follows verification. The next setup must reconcile this documentation change because setup requires a clean tree. Committing it alone would also make the strict installed-HEAD comparison differ until a later authorized update.

Verification used isolated provider protocol fixtures and storage. It did not send messages to a real conversation or change preview recipients. Physical devices, second-device access, native provider discovery/reload, and live-agent delivery were not established by these checks. The initial noninteractive installation selected local access; the follow-up below enabled private Tailscale access. The checked-in [release acceptance procedure](../evaluations/release-candidate.md) and [archive promotion workflow](../../skills/surface/references/setup.md#promoting-a-verified-archive) own the reusable process.

After review, disposable provider/source exports, baseline/candidate archives, isolated installations, temporary browser/toolchain downloads, logs, screenshots and traces were retired after checking process references. The standard running installation, its state, and the canonical skill link were retained. Canonical setup dependencies remain available; the task-created temporary provider link was replaced with the exact verified package bytes, with no temporary or dangling links. This concise record retains identities, failures, resolutions and limits in place of raw completed evidence.

## Private Tailscale follow-up

The user requested the missing Tailscale URL and required it to be an allowed host. Saved setup had `access.enabled=false`; Tailscale was connected. The same canonical setup command with `--tailscale on` selected private `https://mac-mini.duckbill-ionian.ts.net:8463` → `http://127.0.0.1:4319`. Existing Serve port 8460 for the design-system catalog was preserved, and Funnel was not enabled. Only the selected Surface service restarted to apply the exact browser origin; source, release and provider identities stayed unchanged. This history was temporarily preserved outside the checkout and restored byte-for-byte around setup, with no Git commit or source switch.

Read-only `./bin/test` passed with the saved mapping. Live exact Host/Origin requests to `/health` and `/@vite/client` returned 200; unrelated Host and unrelated Origin each returned 403; unauthenticated `/api/mounts` remained 401. The runtime derives Vite `allowedHosts` from the single configured hostname, without a wildcard. Chromium loaded the actual HTTPS home with normal certificate verification, exercised navigation and loaded the served Vite client, which connected to `wss://mac-mini.duckbill-ionian.ts.net:8463` without page errors. The rendered home was inspected. No fixture page or conversation was added to the empty standard installation; these checks establish the compiler's HTTPS/WebSocket path, not a mounted-page edit over a second device. Second-device/physical-device access remains unverified. Temporary browser downloads and completed verification evidence were retired after checking active references.
