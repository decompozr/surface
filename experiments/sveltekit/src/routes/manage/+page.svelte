<script lang="ts">
  let { data } = $props();
</script>
<svelte:head><title>Surface · SvelteKit foundation</title></svelte:head>
<main>
  <p class="eyebrow">Surface experiment</p>
  <h1>SvelteKit singleton foundation</h1>
  <p>One local host. Project-owned Svelte components.</p>
  <p>Mount and interaction changes use the authenticated Surface CLI. This view contains no management credentials.</p>
  <section aria-label="Mounted components">
    {#each data.mounts as mount}
      <article data-testid="mount">
        <h2>{mount.namespace}/{mount.name}</h2>
        <p data-testid="mount-status">{mount.status}</p>
        {#if mount.status === 'ready'}<a href={`/n/${mount.namespace}/${mount.name}/`} data-sveltekit-reload>Open component catalog</a>{/if}
        <p>{mount.components.length} discovered components</p>
      </article>
    {:else}<p data-testid="empty">No component folders mounted.</p>{/each}
  </section>
  <a href="/kit-api/status" data-sveltekit-reload>Inspect status API</a>
</main>
<style>
  :global(body) { margin: 0; background: #f4f7fb; color: #183142; font-family: system-ui, sans-serif; }
  main { max-width: 880px; margin: 48px auto; padding: 0 24px; }
  h1 { font-size: clamp(2rem, 5vw, 3rem); letter-spacing: -.04em; }
  .eyebrow { color: #456273; text-transform: uppercase; letter-spacing: .12em; font-size: .8rem; }
  section { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin: 32px 0; }
  article { background: white; border: 1px solid #d7e0e7; border-radius: 12px; padding: 20px; }
  h2 { font-size: 1.2rem; } a { color: #136b71; }
</style>
