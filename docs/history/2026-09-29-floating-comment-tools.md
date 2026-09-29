# Floating comment tools verification

The workbench now separates the Comments pane control from a floating two-action Comment/Screenshot toolbar. Pointer picking opens the editor directly, Add opens Comments, and position persists across reload with viewport bounds. Toolbar is hidden during composing/review to avoid overlap. The pane itself confirms Add without a covering toast.

Focused Chromium browser verification covered drag, persistence, resize, screenshot capture, toggling without persistent focus styling, automatic pane opening and two batches awaiting replies. Desktop and 390px screenshots were inspected; initial toolbar/editor and toolbar/pane overlaps were fixed and recaptured. These are emulated browser checks, not physical-device acceptance.

The full matrix migration preserves authorization, stale-turn race, lost acknowledgement, SSE, offline/reload and independent domain submission assertions. It now reflects fresh recipient inspection on each Send, collapsed delivery settings, persisted panes, two tools and 24px status bars.

During the final frozen 09e668d run, WebKit exposed a separate real reload defect: restored-pane focus scrolled AppShell horizontally (observed shell scrollLeft 302). Pointerdown reset that scroll to zero and moved Close between pointerdown and pointerup; the click landed on the heading. This is an upstream shell layout/focus defect, not a pane-state or timing-test failure. The focused mobile verifier now asserts zero shell scroll after reload and a single Close hiding the pane. Release remains gated on its fix and the final matrix.

Temporary evidence is retained only until that reload regression passes and final results replace this pending disposition.
