# Agent-interface refinement — September 25, 2026

## Changes and ownership

Applied the primary-source reference comparison in the [design contract](../design/README.md#agent-interface-references-september-25). Workspace labels now show source directory names without Git branch metadata. Mounted folders group pages without duplicating the Home destination. Comments omit arbitrary request titles and empty send/footer controls. Draft sending uses the public quiet arrow IconButton; explicit refresh reports success or failure through Toasts.

Adopted design-system main `12f669a1d9b218b3a0bc5d118dc208bd8c071418` from an isolated source export. Built package identity: 120 files, SHA-256 `1f4d142eab7e46923b42181181538e2bbf3e078fa2c7c4000d8aa97a566d1946`. The provider development checkout/link was preserved. Public floating Toolbar, compact-touch IconButton/ToggleButton, SelectionOutline elevation, StatusIndicator, compact NavigationLinks and Spinner replace Surface's local toolbar paint, primitive selectors, spinner, token wrapper and duplicated roving keyboard handler. Surface retains positioning, selection metadata, delivery semantics and persistence.

## Source verification

Frozen source-snapshot matrix passed: production and fixture builds/type checks; idle/active × desktop Chromium/iPhone WebKit for both fixture and ordinary mounted pages; selection/capture, toolbar scroll tracking, roving keys, touch targets, synthetic keyboard viewport changes, missing/invalid/fragment-updated authorization, stale active turns, queue/steer, lost acknowledgement, automatic result monitoring, offline recovery and reload without duplicate delivery. Snapshot inventory SHA-256: `8bc563e1097094dda83564cebf406be86d6500732542272eee2d1465c304d778`. Added explicit refresh-success/failure Toast and touch-hover regression coverage. Source tests passed (105 tests, 989 assertions), root type checking and documentation checks passed.

The first adoption matrix reached the viewport test but failed its obsolete requirement that Surface override StatusBar's background to white. Removed that implementation-specific assertion; verified the actual 44px reserved row, its viewport bounds and absence of project-content hit interception instead. Both browser viewport flows then passed. Earlier navigation checks were corrected for current directory labels, denied-or-absent provider source, actual mounted scroll ownership and animation-complete screenshots; desktop and phone-size navigation passed.

Rendered desktop/phone selection, navigation, comments, draft sending and refresh feedback were inspected. Snapshot capture waits for panel animation bounds; an intermediate animation frame is not layout acceptance. Additional final-package verification and installation identity are recorded in the selected private installation's immutable release manifest and the active review receipt. This source record does not by itself claim deployment.

## Limits and retention

Browser emulation and synthetic keyboard events do not establish physical iPhone/Safari keyboard behavior or screen-reader acceptance. Fixture delivery is separate from the user's real Codex recipient. Preserve the private-preview endpoint, bindings, interactions and drafts; shared installation remains stopped pending acceptance. Keep only concise verification summaries and selected unresolved-issue images while preparing the final package; retire temporary exports, builds, dependencies and traces after the final installation audit.
