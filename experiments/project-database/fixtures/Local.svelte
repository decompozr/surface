<script lang="ts">
  let count = $state(0);
</script>
<main>
  <h1>Local interface</h1>
  <p>This project has no backend or database.</p>
  <button onclick={() => count++}>Count {count}</button>
</main>
<style>
  :global(body) { font-family: system-ui, sans-serif; margin: 48px; background: #f3f5f2; color: #213c33; }
  button { padding: 12px 20px; font: inherit; }
</style>
