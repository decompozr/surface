<script lang="ts">
  import { Toast as DesignSystemToast } from '@decompozr/design-system';
  let { message, tone = 'info', inline = false, dismiss }: { message: string; tone?: 'info' | 'success' | 'warning'; inline?: boolean; dismiss: () => void } = $props();
</script>
<div class="placement" class:inline>
  <DesignSystemToast {message} kind={tone === 'warning' ? 'warning' : 'info'} onDismiss={dismiss} />
</div>
<style>
  .placement { position: fixed; bottom: 56px; right: 16px; z-index: 100; width: min(360px, calc(100vw - 32px)); animation: appear 160ms ease-out; }
  .placement.inline { position: static; width: auto; animation: none; }
  @keyframes appear { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @media(prefers-reduced-motion:reduce) { .placement { animation: none; } }
</style>
