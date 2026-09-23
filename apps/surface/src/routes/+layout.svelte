<script lang="ts">
  import { page } from '$app/state';
  import SurfaceShell from '$lib/components/SurfaceShell.svelte';
  let { data, children } = $props();
</script>
{#if page.url.pathname === '/experiments/comments' || page.url.pathname === '/experiments/comments/'}
  {@render children()}
{:else}
  <SurfaceShell navigation={data.navigation} currentPath={page.url.pathname}>{@render children()}</SurfaceShell>
{/if}
