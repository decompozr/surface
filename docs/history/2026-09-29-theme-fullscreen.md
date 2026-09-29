# Theme and content-only fullscreen — September 29, 2026

Scope: persistent Light/Dark/System workbench themes, Surface-owned document canvas and browser theme hint, and toolbar fullscreen with one Exit control. Custom mounted content retains its authored colors; no filter or inversion is applied. Image Composer's Library scopes cream to its content root, while its Research page globally sets body cream; the new public document-root Theme boundary keeps such styles from coloring the host canvas.

Provider main `1820dbcea6723609ac9191890337537e57ebc13c` adds the public Theme API, dark semantic roles and fullscreen icons. Surface pins package SHA-256 `5ee7efa0e6dfc1eb8fd955c7e370afce4a0452f95dff48ad8cdc1f55d376682b` (128 files). A provider visual audit found the normal composer shadow reused the text role and glowed in dark mode; it now uses the existing floating elevation.

Focused Chromium and WebKit phone tests passed theme persistence, System media changes, and authored cream content remaining distinct from the dark document canvas. Direct fullscreen tests passed Exit/Escape, preserved drafts/preferences, and subsequent annotation actions. Fullscreen is transient: neither panes nor their widths/status settings are overwritten. The parent shell synchronizes fullscreen into known same-origin secondary frames.

Final immutable layout gate and installed audit are recorded below after completion. This scope does not alter delivery transport; fixture queue checks run without real conversation sends. Native Safari browser tint and physical iPhone keyboard rendering are not established by browser emulation.

Verification iterations: a secondary fullscreen assertion incorrectly expected 844px instead of the measured iPhone-emulation viewport height of 664px; the corrected assertion requires exact measured viewport fill. A Commands search hint containing “Theme” shadowed a mounted page named theme; the entry now uses only its Commands label and a direction indicator, and the touch path is exercised in the integrated theme test.

The integrated geometry gate also identified an old two-action toolbar wrapping assertion; ArrowLeft from Comment now correctly focuses the third Fullscreen action. The assertion was updated; provider roving focus behavior was unchanged.

Final immutable layout gate passed on September 29: snapshot manifest SHA-256 `ca1c0a04b7fd53e9c05e3080f7fd265e7acf6ed5789cda2175936424ab002136`. Scope includes both engines for theme, embedded keyboard/fullscreen, toolbar movement, and viewport handling; desktop Chromium, touch Chromium and phone WebKit interaction flows also passed. Settled phone/desktop dark navigation and secondary fullscreen screenshots were inspected. Build/type checks passed with the exact pinned provider.
