# DecompozR design guidelines

For people and agents building interfaces with `@decompozr/design-system`. This file belongs to the installed package version in [package.json](package.json). Read the [API guide](README.md) for component props and the [review checklist](DESIGN-REVIEW.md) before delivery. Use [AGENTS.example.md](AGENTS.example.md) to connect a consuming project's agent instructions.

## Intent

Create restrained, quiet, information-rich software: 克制、安靜. Black, white and gray establish hierarchy. Approved color provides limited, meaningful emphasis. Keep useful information close without compressing text or touch targets. The interface should support an editor's repeated work, with predictable proportions and little visual noise.

Start each UI task with an actor, intent, primary action, realistic content, feedback and recovery. Preserve the consuming project's domain meaning, data ownership and workflows. This guide governs shared presentation; it does not authorize deployment, data changes or unrelated redesigns.

## Use the package first

Import existing components and tokens from `@decompozr/design-system`; import its `fonts.css` once. Use Theme for appearance, palette and accent. Give controls accessible labels and use their native form behavior. Inspect the installed README and public types before choosing props.

Do not recreate buttons, inputs, switches, checkboxes, icons or focus styles that the package already provides. Do not reach into private component selectors or override their height, padding, colors or state styling. Consumer CSS owns layout, placement and content wrapping. Request missing reusable capabilities upstream; record a reason and removal condition for any explicitly accepted local exception.

Use one scale per control role. New foundation compositions omit `size`; legacy `normal` and `compact` inputs are equivalent, not user-facing density choices. Some older navigation/composer APIs retain separate density contracts; do not assume a foundation rule changes their behavior or silently migrate an existing application.

## Color and hierarchy

- Neutral surfaces, text and separators form the main composition. Prefer spacing, aligned edges and type weight before extra cards or borders.
- Use the approved Soft Milk or Soft Milk Gray palette and selected accent through semantic roles. Do not invent hex colors or substitute brand pigments for interface roles.
- Usually emphasize one primary action per task region. Ordinary toolbar actions stay quiet. Selection, focus and meaningful feedback may use color for their own roles.
- Pair status color with words or a recognizable shape. Keep selection distinct from keyboard focus, and preserve error, disabled, readonly and loading states.
- Check the hierarchy without color, then in both light and dark appearance. Avoid decorative gradients, heavy shadows and unnecessary accent-filled panels.

## Typography and proportions

Use the package's Inter stylesheet, typography roles and relative units. Body and labels normally use 14px text on a 20px line; headings use the existing heading role. Captions support secondary metadata, not essential fields or instructions. Code uses the monospace role. Do not shrink the root font size to make more content fit.

These reference dimensions assume a 16px root. Consume `controlMetrics`, `spacing` and typography tokens rather than copying pixel values into component overrides. Wrapping content may grow.

| Role | Visible proportions | Notes |
| --- | --- | --- |
| Single-line input and select | 32px face | 20px text line, 5px vertical interior padding within 1px borders; 8px inline padding |
| Text action | 24px face | 6px inline padding; preserve the component's vertical alignment |
| Checkbox and radio | 24px face | Native choice semantics and visible focus |
| Switch | 40×24px track, 20px thumb | Use for a binary setting; checkbox for an independent choice |
| Select chevron | 16px icon box, 8px inline-end inset | The component reserves its text lane and handles RTL |
| Coarse-pointer control | At least 44px hit target | Visible field/selection proportions stay centered; native input/select text becomes 16px |

Visible faces and hit targets are different measurements. Do not enlarge the painted border to fill an invisible touch target, and do not shrink the hit target to match the painted face. Validate both in the browser.

## Spacing and mobile rhythm

Use one repeated spacing rule for each relationship:

- Label to control: `controlMetrics.labelGap` (4px layout gap).
- Related selection rows on fine pointers: `controlMetrics.selectionRowGap` (8px).
- Separate fields or settings groups: `controlMetrics.groupGap` (16px).
- On coarse pointers, related 44px selection targets need **no additional row margin**. Their centered 24px faces already leave 20px visible separation for single-line labels. Adding the desktop 8px again produces an overly loose 28px gap.

RadioGroup manages its own row spacing. When composing separate Checkbox/Switch controls, own only the outside layout, for example:

```svelte
<script lang="ts">
  import { Checkbox, Switch, controlMetrics } from '@decompozr/design-system';
  let comments = $state(true);
  let autosave = $state(true);
</script>

<fieldset style:--row-gap={controlMetrics.selectionRowGap} style:--label-gap={controlMetrics.labelGap}>
  <legend>Editing</legend>
  <div class="options">
    <Checkbox label="Include comments" bind:checked={comments} />
    <Switch label="Save changes automatically" bind:checked={autosave} />
  </div>
</fieldset>

<style>
  fieldset { min-width:0; margin:0; padding:0; border:0; }
  legend { padding:0; margin-bottom:var(--label-gap); }
  .options { display:grid; gap:var(--row-gap); }
  @media (pointer:coarse) { .options { gap:0; } }
</style>
```

This is a local-state composition example, not persistence. Long labels must wrap without clipping or overlapping targets. On phones, reflow columns or disclose secondary detail before reducing type or targets. Do not use negative margins to force desktop gaps between mobile faces.

## List, detail and toolbar composition

For a page with a list, selected detail and toolbar:

1. Keep search/filter controls next to the list they affect. Give rows aligned primary text and secondary metadata; avoid a card around every row.
2. Make selection readable through shape, text and the selection role. Show the selected item's heading and useful details in a clearly related pane.
3. Put actions next to their scope. Use Toolbar and labeled IconButton/Button controls; avoid repeating the same primary action in several regions.
4. On narrow screens, use a single content column or a list-to-detail transition with a clear return action. Preserve selection, drafts and focus when navigating back.
5. Define empty, loading, unavailable and error states. Explain what happened and offer a usable recovery action. Do not imply persistence or success until the application has evidence.

Use grayscale to establish reading order before applying approved colors. The package supplies controls and optional compositions; the consumer owns the page structure and product behavior.

## Delivery and exceptions

Follow [DESIGN-REVIEW.md](DESIGN-REVIEW.md). A passing build does not establish a balanced layout. Capture the real toolbar/settings or list/detail context, inspect the visible geometry and exercise its state changes. Report browser emulation separately from physical-device testing and human visual approval.

This is a versioned guide, not an instruction to silently upgrade a dependency. Record the installed package version and artifact identity. If this guide is vendored separately, record its source version/hash and any difference from the runtime package. When updating the package, review the matching guide and any documented consumer exceptions together.
