<script lang="ts">
  import { page } from '$app/state';
  import SurfaceShell from '$lib/components/SurfaceShell.svelte';
  let { data, children } = $props();
</script>
<SurfaceShell navigation={data.navigation} currentPath={page.url.pathname}>{@render children()}</SurfaceShell>
