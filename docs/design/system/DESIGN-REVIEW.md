# Consumer design review checklist

Use with [DESIGN.md](DESIGN.md) from the same package version. Record results in the consuming project's existing `docs/` location. This checklist supplements the project's tests and agent instructions; it does not replace them or authorize additional work.

## Before implementation

- Name the actor, task, primary action, realistic content, feedback and recovery.
- Record the installed design-system version and exact artifact/source identity. If guidance is vendored, record that version separately.
- Identify existing public components and tokens. Record any missing capability or accepted exception before introducing a replacement.

## Rendered review

- [ ] Black/white/gray establish hierarchy; every accent has a purpose. Light and dark states remain readable.
- [ ] Related controls share proportions and alignment. Fields have room around text; buttons do not gain arbitrary padding.
- [ ] Measure painted faces as well as hit targets. Checkbox/switch/radio rows use 8px desktop separation, or no added mobile margin around their 44px targets (20px visible separation at a 16px root for single-line labels).
- [ ] Labels and field/group gaps follow the guide. Dropdown arrows have consistent inset; long text does not overlap them.
- [ ] Inspect desktop and 320–430px phone widths with coarse-pointer behavior, plus enlarged text (for example a 24px root). No clipped labels, overlapping targets or accidental horizontal page scrolling.
- [ ] Exercise realistic dense content, long/unbroken names, mixed scripts and empty results. Reflow or disclose secondary content before shrinking text.
- [ ] For list/detail pages, selection, action scope and the return path remain clear. Preserve drafts and restore useful focus across transitions.

## Interaction and engineering

- [ ] Keyboard navigation, visible focus, accessible names and native form behavior remain intact.
- [ ] Tap the outer parts of mobile targets and near adjacent-row boundaries; only the intended control activates.
- [ ] Check applicable selected, mixed, loading, invalid, readonly and disabled states. Submit/reset/cancel and recovery work as the product promises.
- [ ] Meaning does not rely on color alone. Respect reduced motion; do not add animation without a task purpose.
- [ ] Run the consumer's relevant type/build/test checks against the installed package, not a different source checkout.
- [ ] Inspect captured screenshots after interaction and layout have settled. A screenshot file or an HTTP 200 alone is not a passed design review.

## Compact result record

```text
Task / user story:
Runtime package version and artifact:
Guidance version/source (if separate):
Changed page/component and source revision:
Browser, viewport, root size, pointer mode and appearance:
Scenarios exercised and screenshots:
Engineering: Passed / Failed / Incomplete, with evidence
Visual self-review: findings and corrections
Human acceptance: Pending / Approved within stated scope / Changes requested
Exceptions, limitations and remaining work:
```

Do not claim physical Safari/iPhone, assistive-technology or human acceptance from desktop emulation. Do not claim another application adopted a release merely because a package was published.
