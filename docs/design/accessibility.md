# Mobile and accessibility

Status: source-backed mechanics with bounded keyboard-bypass browser evidence from [UI-CONTINUATION-02](../experiments/ui-continuation/completion.md); broader acceptance remains unverified. Existing automated browser scripts are available, but were not run for DOCS-TAKEOVER-01. No accessibility certification or actual-phone acceptance is claimed.

## D-07: responsive behavior

[SurfaceShell](../../apps/surface/src/lib/components/SurfaceShell.svelte) uses a 280px sidebar and a 760px breakpoint. Desktop collapse is stored in sessionStorage. At or below 760px navigation becomes a drawer with a backdrop, Escape dismissal and toggle focus restoration on close. Hidden navigation is inert. The named, focusable Page content region contains horizontal overflow from wide project content. [RecipientPanel](../../apps/surface/src/lib/components/RecipientPanel.svelte) stacks labels at 600px and wraps long identity text.

These dimensions describe current code, not a frozen universal design system. [E-12](../evaluations/ui-eval.md#e-12-mobile-and-accessibility) exercises current 1440px and 390px fixture coverage separately from proposed smaller widths, zoom and physical-device checks. Private HTTPS configuration alone does not verify the mobile journey.

## D-08: accessibility criteria

| Concern | Current source mechanics | Acceptance criterion and gap |
| --- | --- | --- |
| Location | Named workspace navigation, Breadcrumb nav and `aria-current` page link | Keyboard/screen-reader user can identify exact worktree and current page. Duplicate-label announcements remain to test. |
| Navigation toggle | Button has accessible name, controls and expanded state | State announcement matches visual visibility after hydration and resize; not yet evaluated with assistive technology. |
| Hidden navigation | Inert aside when hidden | Hidden links cannot receive keyboard focus; existing fixture verifies hiding, not all keyboard sequences. |
| Drawer close | Escape/backdrop closes; close returns focus to toggle | Existing fixture checks Escape focus. Opening focus, tab order, background interaction and modal/nonmodal semantics remain undecided. Do not claim a focus trap. |
| Content | Named focusable horizontal scroll region | Wide content scrolls locally, shell does not overflow; visible focus and keyboard scrolling need manual checking. |
| Recipient input | Native select/button and labels; errors use `role="alert"` | Controls are usable without pointer input; errors associate with the attempted action. Loading and success/status announcements remain incomplete. |
| Readability and touch | Responsive wrapping; toggle is currently 34×34 CSS px | Proposed: review touch targets, contrast, focus visibility, 200% zoom and 320px reflow. No blanket WCAG conformance claim; wide intrinsic project visuals may need documented local scrolling. |
| Repeated shell | First shell link “Skip to content” becomes visible on focus and focuses the existing named Page content region; activation closes an open drawer | Required: preserve the complete URL and document while bypassing navigation, on home and mounted pages. UI-CONTINUATION-02 passed keyboard fixtures at 1440/390/320px, including open drawers, unique destination and visible focus. Assistive-technology and physical-device acceptance remain open. |

## Open decisions

Record answers with evidence before implementation/adoption: drawer focus and background interaction model; status/live-region copy and timing; navigation ordering for large/deep trees; minimum device/zoom coverage; acceptable touch targets and visual contrast; ownership of per-project draft warnings and result announcements. These are design gaps, not reasons to postpone the authorized documentation completion.
