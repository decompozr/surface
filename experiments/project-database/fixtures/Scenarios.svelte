<script lang="ts">
  let { label }: { label: string } = $props();
  type Row = { id: string; title: string; angle: number; revision: number };
  let rows = $state<Row[]>([]);
  let title = $state('Camera mount');
  let angle = $state(35);
  let status = $state('Draft only. Load or save when you need stored data.');
  let loaded = $state(false);
  let pending = $state(false);
  const scope = location.pathname.split('/').filter(Boolean).slice(1, 3).join('/');
  const capability = new URLSearchParams(location.hash.slice(1)).get('db') ?? '';
  async function action(operation: string, input: unknown) {
    const response = await fetch(`/project-db/${scope}/actions`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-project-capability': capability },
      body: JSON.stringify({ operation, input }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
    return result.data;
  }
  async function load() {
    try { rows = await action('listScenarios', {}); loaded = true; status = 'Saved data loaded'; }
    catch (error) { status = String(error); }
  }
  async function save() {
    pending = true;
    try {
      const row = await action('saveScenario', { id: 'shared-id', title, angle, expectedRevision: rows.find(row => row.id === 'shared-id')?.revision ?? 0 });
      rows = [row]; loaded = true; status = 'Saved to this project';
    } catch (error) { status = String(error); }
    finally { pending = false; }
  }
</script>

<main>
  <p class="eyebrow">SURFACE · PROJECT DATA EXPERIMENT</p>
  <h1>{label} scenarios</h1>
  <p>Adjust a draft, then save it to this project’s database.</p>
  <section aria-label="Scenario editor">
    <label>Scenario name <input aria-label="Scenario name" bind:value={title} /></label>
    <label>Camera angle <input aria-label="Camera angle" type="number" min="0" max="90" bind:value={angle} /></label>
    <button onclick={save} disabled={pending}>{pending ? 'Saving…' : 'Save scenario'}</button>
    <button class="secondary" onclick={load}>{loaded ? 'Reload saved data' : 'Load saved data'}</button>
  </section>
  <p role="status">{status}</p>
  <section aria-label="Saved scenarios">
    <h2>Saved scenarios</h2>
    {#each rows as row}
      <article><h3>{row.title}</h3><p><strong>{row.angle}°</strong> · revision {row.revision}</p><small>Scenario: {row.id}</small></article>
    {:else}<p>{loaded ? 'No saved scenarios yet.' : 'Saved data has not been loaded.'}</p>{/each}
  </section>
</main>

<style>
  :global(body) { margin: 0; background: #f3f5f2; color: #213c33; font-family: system-ui, sans-serif; }
  main { max-width: 720px; margin: 48px auto; padding: 24px; }
  .eyebrow { font-size: 12px; letter-spacing: .1em; color: #52665c; }
  h1 { font-size: 36px; margin-bottom: 12px; } h2 { font-size: 20px; }
  section { background: white; border: 1px solid #dce3dc; padding: 24px; border-radius: 12px; margin-top: 24px; }
  label { display: block; margin-bottom: 18px; font-size: 14px; }
  input { display: block; width: 100%; box-sizing: border-box; margin-top: 7px; padding: 10px; border: 1px solid #aabbb1; border-radius: 6px; font: inherit; }
  button { background: #245b44; color: white; border: 0; border-radius: 6px; padding: 11px 16px; font: inherit; cursor: pointer; }
  button.secondary { color: #245b44; background: #e8f0eb; margin-left: 8px; } button:disabled { opacity: .6; }
  article { border-top: 1px solid #dce3dc; padding-top: 10px; } h3 { font-size: 18px; }
  [role='status'] { min-height: 24px; }
</style>
