# DecompozR design system

Private, domain-agnostic Svelte 5 components for quiet, dense software interfaces. Soft Milk and Soft Milk Gray paired light/dark semantics with soft-white light surfaces, neutral charcoal dark surfaces and five pastel accents, matte treatments, Inter and the Circular Join DecompozR Labs identity. This repository owns the library, catalog and Storybook; application meaning stays in the consumer.

The package is `@decompozr/design-system`, private, versioned at `0.2.0`. Distribution is an exact `.tgz` attached to a private GitHub release, not an npm registry release. `package.json` is the version authority; identify candidates by SHA-256 as well as version.

Current design intent and source ownership: [current design contract](https://github.com/decompozr/design-system/blob/v0.2.0/docs/design-current.md).

## Design guidance for consuming projects and agents

Read [DESIGN.md](DESIGN.md) for shared visual and composition rules and [DESIGN-REVIEW.md](DESIGN-REVIEW.md) before delivery. Both ship with this package. Add the short section from [AGENTS.example.md](AGENTS.example.md) to your project's AGENTS.md so agents know to read the installed version. Installing components alone does not configure an agent or certify a page.

## Build and install locally

```sh
npm ci
npm run check
npm pack
shasum -a 256 release/decompozr-design-system-0.2.0.tgz
```

`npm pack` rebuilds `dist/` and TypeScript declarations, then writes the archive to `release/` through the repository `.npmrc`. Generated `.tgz` files remain ignored by Git. Install the resulting file in a Svelte 5 consumer using its package manager:

```sh
npm install /absolute/path/to/design-system/release/decompozr-design-system-0.2.0.tgz
```

Use a hash-named copy for successive local candidates to avoid ambiguous caching; released version artifacts are immutable. Retain the file, hash and consumer lockfile. Rebuild and reinstall after source changes; existing consumers are not automatically updated. See [local consumer and Surface installation](https://github.com/decompozr/design-system/blob/v0.2.0/docs/local-consumer-installation.md) for host-specific steps.

```svelte
<script lang="ts">
  import '@decompozr/design-system/fonts.css';
  import { TextField, Select, Button, spacing } from '@decompozr/design-system';
  let name = $state('notes.md');
  let format = $state('plain');
</script>

<form style:display="grid" style:gap={spacing[4]}
  onsubmit={(event) => event.preventDefault()}>
  <TextField label="File name" name="name" bind:value={name} required />
  <Select label="Format" name="format" bind:value={format}
    options={[{ value: 'plain', label: 'Plain text' }]} />
  <Button type="submit">Apply</Button>
</form>
```

Import `fonts.css` once. Components do not require catalog CSS, SvelteKit aliases or global resets. Edit `src/lib`, never generated `dist` or installed copies. The font stylesheet adds the bundled font face without styling global elements.

## Visual grammar

| Foundation | Current contract |
| --- | --- |
| Color | Soft Milk paired light/dark roles feed `semanticColors`; use surface/text/border/interactive/selected/focus/status roles in components |
| Type | body 14/20, bodyCompact 13/18, label 14/20 medium, labelCompact 13/18 medium, caption 12/16, heading 16/24 semibold, code 14/20, codeCompact 13/18 |
| Control scale | fixed 2rem input/select faces and 1.5rem action/selection faces, .875rem/1.25rem labels; coarse-pointer targets at least 2.75rem without enlarging visible chrome; touch input/select text 1rem |
| Rhythm | 2px micro-step, 4px label/support, 8px related controls, 16px groups; larger steps remain available |
| Borders | 1px; quiet separators and stronger control boundaries have distinct semantic roles |
| Radius | control 4px, surface 6px; full radius reserved for circles/switch geometry |
| Focus | shared 2px contrast-aware outline, 2px theme-surface separation; preserve forced-color visibility |
| Elevation | one restrained floating shadow; ordinary content needs none |

Pixel equivalents assume a 16px root. Geometry/type use rem and unitless leading, so user text preferences remain effective. Do not force the root font size or shrink interaction targets to achieve density. `typographyStyle(role)` applies a role to consumer-owned semantic HTML. Prefer spacing, typography and separators over extra cards.

`Text` accepts `variant`, semantic `as`, string `text` or a children snippet, `tone` and native attributes. Legacy size aliases remain: body→body, small→bodyCompact, heading/title→heading, eyebrow→caption; variant takes precedence. Code roles use the platform monospace stack.

### Identity and icons

`Logo` renders the selected archive 07 Circular Join identity. `variant="full"` includes outlined LABS lettering; `variant="compact"` is the symbol and detached underscore. `size` accepts numeric CSS pixels or a CSS length; `label` provides the accessible name. Artwork uses a single ink and transparent background. The default `soft-milk` palette follows the host appearance; white, milk-green, cream, charcoal, sage and slate foreground options remain supported.

`optical="auto"` selects an opened central channel and increased cursor clearance for numeric compact sizes below 48px. CSS-length or implicit sizes require `optical="small"` explicitly when rendered below 48px. Full lockups remain standard. Use a visible DecompozR name beside small marks; 16px is a utility context, not evidence of recognition. Full LABS lockups should start at 160px. Standalone `icon-small-*.svg` exports provide the same optical geometry; resizing a standard SVG does not change its construction.

The optional `centerSymbol` compatibility input explicitly retains the previous curly-brace implementation. Legacy geometry exports remain available for historical studies. Previous artwork is archived under `/branding/legacy-identity/`; all 28 retained drafts are at `/branding/retained-drafts/`. The new geometry authority is `circularJoinGeometry.ts`; Inter outlines retain their package license. See [adoption and validation](https://github.com/decompozr/design-system/blob/v0.2.0/docs/circular-join-adoption.md).

## Shipped components

| Family | Components |
| --- | --- |
| Identity/type | Logo, Icon, Text |
| Actions | Button, IconButton, ToggleButton, Spinner |
| Forms | TextField, TextArea, FieldLabel, Select, Slider, Checkbox, Switch, RadioGroup |
| Document editing | MarkdownEditor |
| Composite controls | Toolbar, ToggleGroup |
| Overlays | Tooltip, Menu |
| Supporting content | Badge, Tag, Toast, ToastRegion, StatusIndicator |
| Hierarchical data | Tree |
| Theme boundary | Theme |
| Generic separator | Divider |
| Existing optional compositions | AppHeader, Brand, NavigationLinks, Breadcrumbs, AppShell, SidePanel, SurfaceCard, FloatingComposer, StatusBar, SelectionOutline, SurfaceTabs, DragHandle |

The 40 exported components are not a complete IDE widget inventory. SurfaceTabs provides controlled open-content tabs; Tree provides single-selection hierarchy; MarkdownEditor provides lossless block editing and reorder; data-grid behaviors and public Dialog/Popover primitives are not implemented. Existing optional compositions remain compatible with their [separate contract](https://github.com/decompozr/design-system/blob/v0.2.0/docs/surface-consumer-api.md); their layout is not a required application architecture. The catalog drawer and verification dialog are examples, not public components.

`Tree` accepts stable `TreeItem` data, an accessible `label`, bindable `selectedId` and `expandedIds`; consumers own the hierarchy and persistence. See the [keyboard, expansion and update contract](https://github.com/decompozr/design-system/blob/v0.2.0/docs/design-system-tree.md).

`MarkdownEditor` accepts an accessible `label` and bindable Markdown `value`, with `onchange`, `readOnly`, `disabled` and `size`. It edits and moves individual blocks while preserving untouched source; saving belongs to the consumer. See the [block editing and lossless-source contract](https://github.com/decompozr/design-system/blob/v0.2.0/docs/design-system-markdown-editor.md).

AppShell supports opt-in mobile edge gestures with `edgeSwipes={true}` alongside all navigation modes, including width-preserving `push`. Existing buttons and bound state remain authoritative. See the [gesture API, exclusions and Safari limits](https://github.com/decompozr/design-system/blob/v0.2.0/docs/edge-swipes.md).

For actual 32px coarse-pointer rows, add `touchDensity="compact"`; see [touch row density and its target-size tradeoff](https://github.com/decompozr/design-system/blob/v0.2.0/docs/touch-navigation-density.md). Defaults remain unchanged.

Use `NavigationLinks density="compact" touchAppearance="compact"` for quiet mobile link faces inside 44px targets, and `FloatingComposer density="compact"` for tighter section spacing. AppShell pointer opening focuses its named pane; keyboard opening and subsequent Tab retain visible focus. See [compact mobile adoption and verification](https://github.com/decompozr/design-system/blob/v0.2.0/docs/compact-mobile.md).

### Actions and selection

Button defaults to `type="button"`; use submit explicitly. Button, IconButton and ToggleButton share one control scale. Text-bearing actions use .375rem inline padding; field content retains .5rem. Loading keeps content/geometry stable, exposes busy/disabled semantics, suppresses activation and may retain focus. Reduced motion keeps the spinner recognizable without animation. Icon-only actions require names; tooltips are supplemental descriptions.

Checkbox, Switch and RadioGroup retain native form semantics. Checkbox supports mixed state; Switch represents a setting and ToggleButton a pressed action. Legacy size inputs do not change these meanings or geometry. Numeric/null legacy input sizes on Checkbox/Switch/Slider remain accepted.

ToggleGroup supports single/multiple selection, optional empty selection, disabled choices and the shared control scale. Arrows move focus; Enter/Space selects. Toolbar supplies one roving tab stop across its actions and nested groups; it owns navigation rather than creating nested keyboard traps. Overflow may scroll rather than making targets unreadably small.

### Text and native controls

Foundational controls use fixed proportions by role. Omit `size`; the legacy `normal` and `compact` values are deprecated, identical aliases. See [field proportions](https://github.com/decompozr/design-system/blob/v0.2.0/docs/foundation-field-rhythm.md); Button `touchAppearance` also retains only one visible scale. Labels, values and adjacent actions align. Coarse-pointer editable fields/selects use at least 1rem text.

TextField supports text/email/search, leading icons, trailing actions, `bind:value`, `bind:element` and hidden labels. TextArea keeps native rows plus optional maxHeight/resize. Both forward native attributes/events (autocomplete, inputmode, pattern, maxlength, form, class/style, data/ARIA attributes and callbacks). Use `pattern={'[a-z]{3,8}'}` in Svelte to preserve literal quantifier braces. Class/style target the native element.

`readOnly` and native `readonly` are accepted, with readOnly taking precedence. Readonly values remain focusable/selectable and form-submittable; disabled values are omitted. Native disabled fieldsets also determine disabled appearance. Caller aria-describedby is combined with hint/error descriptions; an error adds explicit text, a critical border and aria-invalid=true, otherwise caller aria-invalid is preserved.

Select retains its native popup, option disabling, bind:element, optional selected-label help and error state. Slider retains native range artwork, min/max/step, value binding, suffix and optional output. Neither has native readonly semantics. Browser-native control rendering may differ across platforms.

### Overlays and feedback

Menu uses ordered `MenuItem` actions with stable IDs, disabled state and optional separators. The legacy `compact` flag is a compatibility alias; trigger and items use the shared scale. Arrow/Home/End navigation, typeahead, Escape return and native Tab/Shift-Tab continuation remain separate from selection. Outside interaction preserves the destination's focus. If live data removes/disables the focused item, focus moves to a remaining action or the menu surface; empty menus still support Escape and Tab.

Menu and Tooltip use a shared private manual-popover lifecycle to escape transformed/clipped ancestors while remaining in their original DOM ancestry, including native dialogs. Placement tracks only while open and respects viewport bounds. The legacy same-node body fallback covers ordinary document contexts, not arbitrary native-modal stacking. Static specimens stay inline. Tooltip supports focus/hover, pointer travel into its surface and Escape dismissal; essential instructions stay visible.

Badge is a passive caption/count, with a 20px minimum at 16px root and optional full accessible label. Tag uses bodyCompact, wraps long labels and retains a named 44px dismissal target. Neither announces changes automatically.

Toast uses label/bodyCompact roles and a 44px dismiss target; title, message, children and actions are optional. Supply announcement text for meaningful children-only updates. Real notifications announce politely by default; urgent opts into alert semantics, while announce=false is appropriate for static examples. Consumers own dismissal and focus continuation. ToastRegion retains history, scroll position and explicit latest-follow behavior; it does not own application notification state.

## Develop, validate and integrate

Read [repository contributor instructions](https://github.com/decompozr/design-system/blob/v0.2.0/AGENTS.md), [design intent](https://github.com/decompozr/design-system/blob/v0.2.0/docs/design-system.md) and [component contracts](https://github.com/decompozr/design-system/blob/v0.2.0/docs/design-system-components.md). Later selected source sections supersede earlier historical choices. The README describes current consumption, not the full decision history.

All changes—including docs—use a dedicated branch/worktree, update adopted source before behavior changes, pass validation there, then merge to main. Preserve unrelated work and provenance. An isolated checkout is preferable when main serves the catalog:

```sh
git worktree add ../design-system-change -b change/my-update main
cd ../design-system-change
npm ci
npm run dev
# In another terminal, if needed:
npm run storybook
```

Catalog development defaults to localhost:5173; Storybook to localhost:6006. Use the locked dependencies and a compatible Node runtime (the existing toolchain was built with Node 26.7/npm 11.19).

For package changes:

```sh
npm run check
npm run build
npm run build-storybook
npm pack
node scripts/verify-consumer.mjs ./release/decompozr-design-system-0.2.0.tgz
git diff --check
```

The consumer runner installs a hash-named copy into a fresh temporary plain-Svelte project, runs check/build and prints its path/hash. Run `npm run preview` there for browser checks on localhost:56464. It imports public package exports/fonts only. The explicit `?legacy-overlays` fixture mode disables native popover methods for fallback verification; it never changes the package or normal consumer mode.

Inspect meaningful keyboard/focus/disabled/form behavior and desktop, narrow, enlarged-root and coarse-pointer presentation. Record exact package identity, results and limits. Review the diff, commit on the change branch, reconcile any new main changes there and revalidate affected content before merging. Push and managed-service refresh are separate operations. [Readiness assessment](https://github.com/decompozr/design-system/blob/v0.2.0/docs/professional-readiness.md) and [validation summary](https://github.com/decompozr/design-system/blob/v0.2.0/docs/validation/README.md) preserve accepted outcomes and immutable historical evidence. Keep new raw execution logs, machine traces and generated screenshots outside Git; retain concise results, artifact identity and limits in authoritative docs.

## Managed catalog lifecycle

Never overwrite a serving managed build. The lifecycle guard enforces this. Build in an isolated checkout or stop the owned instance first:

```sh
npm run daemon -- status
npm run daemon -- stop
npm run build
npm run daemon -- start
npm run daemon -- status
```

`build/` is the catalog, `storybook-static/` the Storybook output and `dist/` the library. They and tarballs are ignored. The daemon uses current-session macOS launchd and loopback port 56460; logs/restart are available through `npm run daemon -- logs` and `-- restart`. Start/restart do not build. Status reports the actual checkout, PID, health and proxy independently.

Private Tailscale HTTPS configuration and ownership rules are in [app lifecycle](https://github.com/decompozr/design-system/blob/v0.2.0/docs/app-lifecycle.md). Stop retains the owned proxy mapping; never replace unrelated routes. Storybook is a separate local development tool. Packaging alone neither refreshes the catalog nor installs a consumer.

## Compact selection, status and navigation

Use the additive [compact chrome APIs and Surface recipe](https://github.com/decompozr/design-system/blob/v0.2.0/docs/compact-chrome.md) for a neutral floating Toolbar, thin selected outline, compact phone visuals with 44px native targets, semantic StatusIndicator and a guide-free hierarchy. Refresh is a packaged semantic icon. Consumers do not need internal CSS selectors or duplicate roving keyboard logic.

## Width-preserving navigation

Use `AppShell navigationMode="push"` when navigation should slide in and displace the page without compressing its width or changing line breaks. Desktop and phone behavior, focus/scroll handling and the Surface migration recipe are documented in [push navigation](https://github.com/decompozr/design-system/blob/v0.2.0/docs/push-navigation.md). Overlay and responsive modes retain their existing contracts.

## Design studies

[Mobile composition concepts (2026-09-29)](https://github.com/decompozr/design-system/blob/v0.2.0/docs/design-studies/mobile-compositions-20260929/README.md) preserves three visual alternatives and their original references. These are historical concept references; the current catalog implements floating, bottom-sheet and split compositions with shared content and adopted Soft Milk styling.

## Transparent identity assets

`Logo palette="white"` is the white utility form for dark hosts. All exported artwork uses one ink and no background rectangle. Full, icon and optical SVGs keep the existing export paths for both Soft Milk palettes and both appearances, such as `logo-soft-milk-light.svg` and `icon-small-soft-milk-gray-dark.svg`. The legacy palette names now select an ink recipe for Circular Join; their original colored artwork is retained in the archive. `softBrandRoles` and older multi-role color exports remain compatible for consumers and historical studies. Interface colors and feedback semantics are unchanged.

## Soft Milk themes

```svelte
<script>
  import { Theme, Button, Logo } from '@decompozr/design-system';
</script>
<Theme mode="system" palette="soft-milk-gray" accent="pink" documentRoot>
  <Logo />
  <Button variant="primary">Save</Button>
  <Theme mode="dark"><Button variant="primary">Inherited palette and accent</Button></Theme>
</Theme>
```

`palette` accepts `soft-milk` (default) or `soft-milk-gray`; `accent` accepts `sky` (default), `pink`, `mint`, `apricot`, `yellow`. Nested Theme boundaries inherit palette/accent when omitted; appearance keeps its existing explicit/system semantics. `themeStyle(mode, palette, accent)` and `themeColors(palette, accent)` expose the same interface roles for non-Theme consumers. `palettes` exports the exact approved pigments. `semanticColors.actionText` is #3B3F42 in both appearances; `textInverse` remains for inverse surfaces. Use the new action roles instead of pairing pastel fills with inverse text. Light focus and control borders use deeper supporting colors for legibility.

The catalog and Storybook expose the same choices. Catalog preferences persist locally when storage is available. Palette adoption updates this package; already installed consumer applications retain their pinned package until updated separately. See [adoption and verification](https://github.com/decompozr/design-system/blob/v0.2.0/docs/soft-milk-adoption.md).
