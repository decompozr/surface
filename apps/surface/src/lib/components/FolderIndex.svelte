<script lang="ts">
  import { onMount } from 'svelte';
  import { NavigationLinks, Text, type NavigationLink } from '@decompozr/design-system';
  let { title, initialEntries }: { title: string; initialEntries: NavigationLink[] } = $props();
  let updates = $state<NavigationLink[] | undefined>();
  const entries = $derived(updates ?? initialEntries);
  onMount(() => {
    const update = (event: Event) => { updates = (event as CustomEvent<NavigationLink[]>).detail; };
    window.addEventListener('surface-catalog', update);
    return () => window.removeEventListener('surface-catalog', update);
  });
</script>
<section class="folder">
  <Text size="eyebrow" tone="muted">Pages in this folder</Text>
  <Text as="h1" size="title">{title}</Text>
  <div data-surface-catalog><NavigationLinks label="Pages in this folder" items={entries} /></div>
</section>
<style>
  .folder { padding:32px; max-width:780px; display:grid; gap:24px; }
</style>
