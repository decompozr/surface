# Shared UI design

Status: current behavior documented from source at `7fceefc`, with explicit proposed criteria for missing behavior. This pass contains no rendered-browser or device acceptance. The [Phase A audit](../experiments/docs-takeover/ui-source-audit.md) is an input; Phase B independently inspected the shell, navigation, recipient panel, client/service and verifier sources.

The shared shell should let a person locate a project/worktree/page, understand whom a submission will reach, make its delivery choice, and distinguish saved input from completed work. The project page owns domain controls and meaning. Surface owns navigation and request delivery controls. Keep this hierarchy visible even when a project's content is wide or its recipient is unavailable.

| Design contract | Source of truth | Status |
| --- | --- | --- |
| D-01, D-02: hierarchy, routes and navigation states | [Navigation](navigation.md) | Current implementation plus identified empty/stale-state gaps |
| D-03, D-04: recipient and request transitions/recovery | [Interactions](interactions.md) | Current service contract; some recovery presentation is proposed |
| D-05, D-06: draft lifetime and results | [Interactions](interactions.md#d-05-draft-ownership) | Current ownership limits; project-specific restoration/results require evaluation |
| D-07, D-08: mobile and accessibility | [Accessibility](accessibility.md) | Current source mechanics; broader acceptance criteria remain unverified/proposed |
| D-09: freshness and discovery | [Interactions](interactions.md#d-09-freshness-and-discovery) | Manual/mount refresh implemented; explicit availability/freshness presentation proposed |

## Journeys

1. **Browse:** open the selected service → choose project, exact worktree, mounted folder and route → inspect project content. No binding or submission is required. A clean navigation URL grants no request capability.
2. **Submit to the originating agent:** open the returned request URL → inspect recipient → choose queue/steer for an active turn (or start for idle/notLoaded) → complete and explicitly submit the project form → inspect delivery → observe the result/source change separately. Requirements [R-08–R-11](../requirements/agent-interaction.md#requirement-index) govern identity and uncertainty.
3. **Change an unsent recipient:** on an opted-in request, select a same-worktree candidate → confirm recipient change → open the new request/token URL → review page input again → submit deliberately. Submitted requests must be reconciled before another interaction; existing input is never replayed.
4. **Recover:** if a preflight state check rejects, refresh and review mode before a deliberate submission. If a response may have been reserved or delivered, inspect the existing request and response ID before any retry. A lost takeover acknowledgement requires original-request inspection; elapsed time does not prove the operation failed.
5. **Navigate on a phone:** open the drawer → select a route → identify workspace and recipient in content → submit/review using the same semantics. Drawer focus behavior, long labels, zoom and actual second-device access still need their own gates.

The [UI evaluations](../evaluations/ui-eval.md) give observable pass/fail criteria for each journey and show which checks exist. No new implementation, live interaction or design acceptance is authorized by recording these criteria.

### Comment experiment touch refinement

Within the opt-in comment experiment, the user-selected layout uses a logo navigation toggle, left overlay menu, desktop right push pane and mobile right overlay pane. Selection exposes nearby screenshot/comment actions before composition; touch scrolling must not select or synthesize hover. Menus animate with reduced-motion support. Agent connectivity belongs in the fixed transparent bottom status bar. The [browser checkpoint](../experiments/2026-09-23-element-comments.md#browser-e2e-checkpoint) records desktop/mobile emulation and remaining physical-device limits. This dated experiment did not adopt its shell across all mounted pages. The [September 24 bounded adoption](../requirements/agent-interaction.md#mounted-page-contextual-comments-september-24-adoption) now shares comment tools while preserving ordinary mounted navigation and initial interaction mode.

The comment preview uses a compact transport-status icon in the bottom bar, with details on activation and transient disconnect/reconnect toasts. It must not label an SSE connection as active model work. Notifications do not repeat on unchanged retry state; they are dismissible and announced politely. Desktop/mobile full-loop evidence is recorded in the comment experiment checkpoint.

### Local DecompozR package integration

Surface consumes `@decompozr/design-system` through `link:@decompozr/design-system`, registered with Bun from `~/Projects/decompozr/design-system`. This supersedes the earlier vendored tarball snapshot. The dependency is a verified filesystem symlink. On another machine, run `bun link` in the design-system checkout before installing Surface dependencies. The earlier primitive-only pass made no design-system source edits; the later additive API work is owned by the designated design-system task. Vite deduplicates Svelte to avoid separate runtimes across the link.

The package exports `dist`, so source changes require `npm run package` in the design-system checkout. During Surface development, restart the dev server if a rebuilt linked dependency is cached. The built Tailscale preview still requires a Surface rebuild and release restart; a local link does not hot-update an already-built preview.

The shared shell loads the package font-face stylesheet for both built pages and runtime-mounted pages. The Surface Toast wrapper delegates its visual and accessible notification content to the package Toast, retaining only application placement, lifetime and motion. The package exposes info/warning/error kinds; successful reconnection uses the neutral info kind instead of inventing an unsupported success variant.

The full component adoption now integrates additive APIs provided by the design-system task in its isolated checkout. This Surface worktree's consumer link points to `/Users/scottchu/.codex/worktrees/98c9/design-system`; the global Bun registration and canonical design-system checkout are unchanged. This is a local integration override: reinstalling dependencies through the existing `link:` manifest uses the globally registered package again. Provider readiness and consumer browser evidence are tracked separately in the [experiment checkpoint](../experiments/2026-09-23-element-comments.md). No package publication or shared-installation promotion is implied.

For this linked development setup, Surface uses Svelte 5.57.0 to match the design-system checkout's compiler/type package. Keep those versions aligned when updating either side; runtime deduplication alone did not resolve the nominal Snippet type mismatch.

### Surface chrome consumer contract

Surface imports the package's AppShell, AppHeader, Brand and Logo for viewport geometry and identity. The compact Slate logo specifies `centerSymbol="S"`, accessible label `Surface` and size 38. NavigationLinks renders recursive route anchors with current-page semantics; Breadcrumbs owns location presentation. The consumer retains exact route identity, current-page capability preservation and session-scoped collapse state. Ordinary Surface pages use responsive desktop navigation; the comment prototype uses an overlay menu at every viewport width.

Review controls import IconButton, ToggleButton, Toolbar and Badge directly, using the package icon catalogue. TextArea owns the native editing control while preserving the 4,000-character limit, bound element focus, value and disabled state. Recipient Select controls preserve the explicit confirmation boundary: selecting a conversation never submits existing input. Slider owns the adjustable demonstration heading control. Text, SurfaceCard, SidePanel, FloatingComposer, SelectionOutline and StatusBar own their visual treatments. The shared home and generated folder catalog use Text and NavigationLinks as well.

Surface owns application state, route data, labels, content arrangement and viewport-relative selection coordinates. It passes the 60px header and right-panel state to the package layout instead of copying drawer or panel CSS. The 24px StatusBar overlays content; AppShell reserves zero status-row height so there is no opaque empty strip beneath it. Remaining consumer CSS arranges content, constrains captured images and positions application overlays; it does not recreate component paint, control states or icons. Historical ChromeAction and token adapters remain preserved but are no longer used by shared chrome or the comment prototype.

The redundant Workspace tag is removed; the header identifies the product with its logo and Surface name. Screenshot/text content scrolls inside the package composer while actions remain visible. Shortcut semantics, manual batch submission, recipient identity and SSE behavior remain application responsibilities. The prototype remains opt-in and is not a production adoption decision. Browser verification, physical-device acceptance and human visual approval are separate evidence gates.

Runtime-mounted shells resolve the linked package to its published `dist` directory and exact `package.json` version metadata. Both the runtime request gate and Vite allow only those package assets, while the runtime deduplicates Svelte to its own compiler dependency. The navigation verifier checks mounted rendering/font loading and rejects access to the design-system source directory.

### Mobile keyboard positioning

The comment composer tracks the visible viewport's offset and dimensions on resize/scroll, in addition to nested workspace scrolling. Positioning uses the selected element's current bounds and the measured package composer height. The application clamps the whole composer to the visible area, permits its body to scroll, and keeps the focused field reachable without scrolling the outer page programmatically. In constrained height, optional notice copy is omitted from the floating footer and the textarea starts with two rows; draft data and the status text in the comment panel are retained.

The status indicator overlays the page instead of occupying a reserved grid row. Both the transparent footer background and page coverage underneath the footer are checked. Package components and package source remain unchanged. The [mobile viewport checkpoint](../experiments/2026-09-23-element-comments.md#mobile-keyboard-and-transparent-status-follow-up) separates synthetic keyboard evidence from physical-device acceptance.
