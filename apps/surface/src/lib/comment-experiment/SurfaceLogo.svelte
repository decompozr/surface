<!-- Compatibility entry point: all logo geometry and palettes are package-owned. -->
<script lang="ts">
  import { Logo } from '@decompozr/design-system';
  let { variant = 'compact', palette = 'cream' }: {
    variant?: 'full' | 'compact'; palette?: 'charcoal' | 'cream' | 'sage' | 'slate';
  } = $props();
</script>
<Logo {variant} {palette} centerSymbol="S" label="Surface" size={variant === 'compact' ? 38 : undefined} />
