<script lang="ts">
  import { Text, NavigationLinks } from '@decompozr/design-system';
</script>
<svelte:head><title>Surface · Workspaces</title></svelte:head>
<section class="home">
  <Text size="eyebrow" tone="muted">Your workspace</Text>
  <Text as="h1" size="title">Pick up where you left off.</Text>
  <Text tone="muted">Open a mounted page from the project and worktree navigation.</Text>
  <NavigationLinks label="Service" items={[{ id: 'health', label: 'Server health', href: '/health', attributes: { 'data-sveltekit-reload': true } }]} />
</section>
<style>
  .home { max-width:760px; margin:0 auto; padding:24px 16px; display:grid; gap:12px; }
</style>
