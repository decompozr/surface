<script lang="ts">
  import { previewState } from 'virtual:surface-preview';
  const count = previewState('counter', 0, 1);
  const draft = previewState('draft', '', 1);
</script>

<main>
  <p>Surface development fixture</p>
  <h1>Shared runtime counter</h1>
  <label>Draft <input bind:value={$draft} /></label>
  <button onclick={() => $count++}>Count {$count}</button>
</main>

<style>
  :global(body) { margin: 0; font-family: system-ui; background: #f7f6f0; color: #213b31; }
  main { max-width: 640px; margin: 10vh auto; padding: 24px; }
  label { display: block; margin-block: 24px; }
  input, button { padding: 12px; font: inherit; }
  button { background: #213b31; color: white; border: 0; border-radius: 6px; }
</style>
