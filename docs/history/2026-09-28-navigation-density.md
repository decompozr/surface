# Actual compact navigation and warm brand palette

The phone report after `bf9f6b9fa40eb5dfdd1d841fd89b8adc328a48b9` showed that compact paint had not fixed actual list spacing. An isolated production build reproduced 44px link heights and cadence. The new navigation regression failed with `44 !== 32` before the provider change.

Surface adopts design-system main `ddb49c0ae23ec904915086b8a039fb1a1182531e` ([issue #12](https://github.com/decompozr/design-system/issues/12), PR #13) through `NavigationLinks touchDensity="compact"`. Single-line touch rows are actually 32px, without overlapping hit regions or additional leaf spacing. Typography/hierarchy and compact paint keep their separate public settings. Toolbar touch targets retain their existing size. No Surface private-selector override was added.

The existing compact Surface mark now uses the public `cream` palette: warm neutral background, deep green-gray brackets and sage center. Rendered cream, charcoal and sage alternatives were compared against the previous slate palette. Mark geometry and size are unchanged.

## Verification

Tested an isolated source export of the baseline plus this change, with the provider built from its exact committed tree and frozen dependencies. Surface's package identity is `ee62c2e944cb19ccd22be6a73a470e3563cbfd69f46498cd7d702468a8b6d723` (122 files).

- Root type check; Surface Svelte/server checks: pass, zero Svelte errors/warnings.
- Module suite: 105 tests, 989 assertions, no failures.
- Integrated navigation: SSR hierarchy, page/folder routes, Escape/focus, overflow, home/counter content start, touch activation, actual 32px heights/cadence and non-overlapping hit regions pass.
- Full isolated comments matrix: desktop Chromium and mobile WebKit, mounted and fixture pages, idle/active delivery, authorization changes, stale turns, queue/steer, lost acknowledgement, automatic monitoring/SSE, offline/reload and exactly-once delivery pass. Selection/scroll tracking, edge gestures, constrained-height editing and viewport regressions pass.
- Visual audit separately inspected rendered desktop and phone navigation, root home, ordinary mounted counter, mounted navigation and constrained-height comment editor. The dense list closes the reported leaf-spacing gap; the warm mark appears consistently on home and mounted pages. Touch opening focuses the pane rather than painting a heavy Home focus rectangle.
- Documentation and diff checks pass.

These source results do not claim physical iPhone keyboard, Safari edge-gesture or assistive-technology acceptance. Release installation is a separate integrity/packaged-E2E gate. Keep selected preview state, recipient and drafts intact. Disposable source/build/evidence output is retired after the release gate; concise results remain here rather than retaining every trace or dependency tree.
