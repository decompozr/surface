import { colorShades, feedbackColors, focusColors, radius, spacing } from '@decompozr/design-system';

// Surface owns layout; the linked design system owns the chrome's visual tokens.
const tokens = {
  surface: colorShades.neutral.white,
  ink: colorShades.neutral.charcoal,
  muted: colorShades.neutral.secondary,
  subtle: colorShades.stone.pale,
  line: colorShades.neutral.soft,
  edge: colorShades.neutral.edge,
  selected: colorShades.sage.pale,
  hover: colorShades.sage.hover,
  strong: colorShades.sage.deep,
  focus: focusColors.outline,
  warning: feedbackColors.warning.foreground,
  'radius-control': radius.control,
  'radius-surface': radius.surface,
  'radius-full': radius.full,
  ...Object.fromEntries(Object.entries(spacing).map(([step, value]) => [`space-${step}`, value])),
};
export const chromeTheme = Object.entries(tokens).map(([name, value]) => `--surface-${name}:${value}`).join(';');
