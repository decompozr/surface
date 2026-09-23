# Mobile drawer background scroll correction

Status: source fix and isolated browser regression passed; not installed in the
shared service. Physical iPhone confirmation remains pending.

## Observation and adopted behavior

During INTEGRATED-LOOP-03, the user supplied an iPhone screenshot of the open
navigation overlay and reported that the background could still scroll. The
selected installed runtime remains `7fceefc`; the fix is based on checkout
`4b629b8` plus the changes below. The existing shell had a fixed backdrop and
sidebar but no document scroll lock.

The user's request adopts the narrow scrolling requirement in
[D-08](../design/accessibility.md#d-08-accessibility-criteria): freeze background
scrolling while the mobile overlay is open; allow long navigation to scroll
internally; restore the previous position when it closes. This does not adopt a
focus trap, change keyboard navigation policy or establish general modality.

## Change and ownership

`apps/surface/src/lib/components/page-scroll-lock.ts` preserves document offsets
and the individual inline CSS properties it owns, fixes the body for mobile
Safari behavior, and restores them on release. The shell acquires the lock only
for an open mobile drawer and uses Svelte effect cleanup for closing, desktop
resize and disposal. The backdrop disables touch panning; the navigation contains
overscroll while retaining its own scroll area.

The user's follow-up expands this task beyond the original page-only experiment
scope. Only this worktree's shell is patched; the other agent's worktree remains
untouched. A read-only inspection confirmed its newer shell delegates navigation
to the design system's AppShell. This fix must be reconciled with that owner at
integration rather than overwriting its shell. App task snapshot tooling was
unavailable on this turn, so no acknowledgement from that agent is claimed.
The separate `accessibility.md` source change and this dated record preserve the
requirement; the concurrently edited findings map is not changed by this patch.

## Verification and limits

- Production app build passed.
- App Svelte and TypeScript checks passed, zero Svelte errors/warnings.
- `bun apps/surface/scripts/verify-drawer-scroll.ts` passed in Chrome with mobile
  emulation and in desktop WebKit at a 390px viewport: background frozen at a
  nonzero original offset, sidebar wheel scrolling, no chaining at its boundary,
  Escape/backdrop restoration, restoration of preexisting inline styles and
  smooth-scroll settings, and desktop resize releasing the lock. Chrome also
  exercised a CDP touch drag on the backdrop. This is not physical iOS evidence.
- Existing `verify-navigation.ts` and `verify-skip-link.ts` passed, including
  keyboard skip closing an open drawer at 390/320px and exact URL retention.
- `git diff --check` passed. The WebKit open-drawer screenshot was inspected.

Initial attempts exposed two preparation errors: the helper was first outside
the mounted compiler's permitted shared-component directory and was moved inside
that directory without relaxing filesystem access; Playwright cannot dispatch
wheel input in mobile WebKit, so WebKit coverage explicitly uses a narrow desktop
viewport. A TypeScript verifier annotation was also corrected. These failed
attempts are not passing evidence.

The verifier creates disposable project/service state and performs no real-agent
binding or submission. Its hosts/browsers are stopped afterward. Screenshots live
under ignored `.decompozr/surface/screenshots/drawer-scroll/`.

## Delivery boundary and next step

The user's existing HTTPS link still runs the earlier installed shared release.
Neither that service nor the other agent's private preview was replaced. Integrate
the scrolling contract with the ongoing AppShell migration, publish an authorized
release through the normal setup workflow, then verify the user's physical phone.
INTEGRATED-LOOP-03 still awaits its original intentional form submission; this
reported shell defect is not counted as the form's saved response or acceptance.
