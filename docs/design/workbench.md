# Surface workbench

The workbench owns layout preferences, command dispatch, keyboard mappings, tab navigation and session restoration, and notification history. The design system owns reusable visual controls. Mounted pages retain domain data and comment delivery state.

Buttons, keyboard shortcuts and the command palette call the same named actions. Embedded pages forward workbench commands to the outer shell; only known same-origin frames are accepted. Review actions route back to the active page. Plain-letter shortcuts never run while typing. Escape and submit actions remain scoped to their editor.

Left and right panes are independently visible and resizable by pointer or separator arrow keys. Browser-local preferences persist visibility, widths, status visibility and shortcut overrides across reload; storage synchronization shares preferences across open documents. Tab order and active tab restore for the same document in session storage. Page DOM/drafts survive switching but arbitrary page drafts do not survive reload. Capability URLs remain session-scoped and are never written to global preferences.

Quick Open searches mounted route labels and paths. The command palette searches available actions, including pane toggles, status visibility, tab movement, notifications and shortcut settings. This does not claim full-text filesystem search. Host-reserved shortcuts may be intercepted by the browser; the Open surface button and commands are alternative entry points.

Default modifier shortcuts: Mod+P opens surfaces, Mod+Shift+P opens commands, Mod+B toggles Workspaces, Mod+Alt+B toggles Comments, Alt+Left/Right moves between tabs, Mod+Shift+W closes a Surface tab. V/C/S select/comment/capture; I/M remain convenience aliases for comments/workspaces. Keyboard mappings can be edited and reset from Keyboard shortcuts. Duplicate assignments are rejected.

The status bar reserves 24px. Recipient details live under Delivery settings in the comments pane, not above page content. Notification history is available through Show notifications. Focus restoration is separate from pane visibility and selection mode.

Acceptance: desktop and phone Quick Open, commands from embedded content, independent pane toggles and resizing, reload recovery, status geometry, tab order/close/history, typing guards, palette focus and dismissal, stale recipient handling and multiple queued comment batches. No fixture submissions go to real conversations.

Embedded tabs intersect their local visible viewport with the same-origin ancestor viewports, translated through each frame rectangle. Keyboard resize and panning in the outer document must reposition the active tab's composer and mobile toolbar even when the iframe's own viewport has not resized. Observe ancestor viewport/scroll changes and release listeners with the component; do not infer keyboard clearance from the iframe layout height alone.

## Theme and content-only fullscreen

The workbench stores a Light, Dark or System preference in its global preferences; System is the default and follows operating-system changes. The command palette exposes all three choices. Mouse and touch users open the header search, choose Commands, then choose Theme: Light, Theme: Dark or Theme: System. The design system owns semantic colors through its public Theme boundary. Surface owns the document canvas, native color scheme and theme-color hint, including phone safe-area surroundings. Mounted content must keep its own authored backgrounds scoped to its content root. Custom content is not inverted or automatically redesigned; it may adopt the design system's public semantic variables to follow the workbench theme.

Fullscreen is a transient presentation mode, not a saved pane setting. Its toolbar action hides the header, tabs, navigation, Comments pane, status and annotation controls without losing page state, pane widths or drafts. Only the floating Exit fullscreen control remains. Escape restores the previous layout, including from a secondary embedded tab. This is viewport content fullscreen and does not depend on the browser native Fullscreen API.
