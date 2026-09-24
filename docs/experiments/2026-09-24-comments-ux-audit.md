# Comment UI audit and repair

Scope: selection, parent navigation, comment editing/review, delivery controls and connection status. This follows the user's request for multiple audit/fix iterations before further feature work.

## Iterations and disposition

1. Captured the current private preview at 390x844 in Chrome. Confirmed a multi-line implementation selector, a second floating action strip over content, and status actions with no reserved layout space.
2. Captured the candidate after repairs. Replaced implementation paths with readable labels (full selector retained), selected semantic controls rather than internal spans, combined selection actions into one strip, and reserved a separate status row. Review and local-only draft flow were usable. Found small targets and insufficient editor clearance.
3. Inspected 320x568 review and 390x400 constrained-height editing. Enlarged key targets to 44px, kept editor above the status area, removed redundant success prose from the footer, and preserved manual reading during content updates. Actual parent activation exposed a higher-specificity shared hover style still applying a gray background.
4. Fixed the contextual hover/active override and inspected parent activation and keyboard Tab focus. DOM measurements confirmed a transparent background, white icon and 44x44 target. Visible keyboard focus remained. Desktop review exposed empty Continue draft and residual selection controls; both were removed.
5. Recaptured desktop 1280x900 and phone-size 390x844 review after the final corrections. Confirmed a clean Switch/Send row, separate status row, no empty-draft action and no selection overlay while reviewing.

## Evidence and limits

Current-run screenshots are retained locally under `.decompozr/surface/ux-audit/`: 01-before, 02-selection, 02-draft, 03-narrow-draft, 03-short-editor, 03-selection, 04-selection, 04-focus, 04-desktop, 05-desktop and 05-mobile PNGs. Each screenshot was visually inspected during the run. Local drafts were not sent to the real conversation. The candidate used its own state directory; existing live records were preserved.

TypeScript/Svelte checks, production build and 39 focused tests passed. The browser audit used Chrome through the supported computer-use interface because the in-app browser was unavailable. The short viewport tests available space, not an actual iOS keyboard. Physical iPhone/Safari acceptance and full screen-reader/WCAG compliance remain unverified. Earlier WebKit E2E results do not certify this new revision.

Disposition: requirements updated in agent-interaction.md; automatic iterative UI/UX audit is now a source-workflow completion gate referenced from AGENTS.md.
