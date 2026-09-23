<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { Button, ToggleButton, controlMetrics } from '@decompozr/design-system';

  // Retained compatibility adapter for existing content callers. Surface chrome
  // now imports package IconButton and ToggleButton directly.
  let { label, children, pressed, onPressedChange, variant = 'secondary', appearance = 'quiet', ...rest }:
    Omit<HTMLButtonAttributes, 'children' | 'aria-label' | 'aria-pressed'> & {
      label: string; children: Snippet; pressed?: boolean;
      onPressedChange?: (pressed: boolean) => void;
      variant?: 'primary' | 'secondary'; appearance?: 'quiet' | 'default';
    } = $props();
</script>

<span class="chrome-action" style:--chrome-icon={controlMetrics.icon}>
  {#if pressed !== undefined}
    <ToggleButton {...rest} size="compact" aria-label={label} {pressed} {onPressedChange}>{@render children()}</ToggleButton>
  {:else}
    <Button {...rest} size="compact" aria-label={label} {variant} {appearance}>{@render children()}</Button>
  {/if}
</span>

<style>
  .chrome-action { display: inline-flex; flex-shrink: 0; vertical-align: middle; }
  .chrome-action :global(svg) { width: var(--chrome-icon); height: var(--chrome-icon); pointer-events: none; }
</style>
