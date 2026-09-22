<script lang="ts">
  type Row = { id: string; title: string; angle: number; revision: number };
  let rows = $state<Row[]>([]), loaded = $state(false), pending = $state(false);
  let status = $state('Saved scenarios have not been loaded.');
  const scope = location.pathname.split('/').filter(Boolean).slice(1, 3).join('/');
  const token = new URLSearchParams(location.hash.slice(1)).get('db') ?? '';
  async function load() {
    pending = true;
    try {
      const response = await fetch(`/project-db/${scope}/actions`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-project-capability': token }, body: JSON.stringify({ operation: 'listScenarios', input: {} }) });
      const result = await response.json();
      if (!result.ok) throw new Error(result.code);
      rows = result.data; loaded = true; status = `Loaded ${rows.length} scenarios`;
    } catch (error) { status = String(error); }
    finally { pending = false; }
  }
</script>
<main>
  <p class="eyebrow">SURFACE EXPERIMENT · COMPARISON</p><h1>Compare scenarios</h1>
  <p>Load the latest saved scenarios when you are ready to compare.</p>
  <button onclick={load} disabled={pending}>Load scenarios</button>
  <p role="status">{status}</p>
  <section aria-label="Scenario comparison">
    {#if rows.length}
      <table><thead><tr><th>Scenario</th><th>Camera angle</th><th>Revision</th></tr></thead>
        <tbody>{#each rows as row}<tr><td>{row.title}</td><td>{row.angle}°</td><td>{row.revision}</td></tr>{/each}</tbody>
      </table>
    {:else}<p>{loaded ? 'No saved scenarios yet.' : 'Save a scenario in the editor, then load it here.'}</p>{/if}
  </section>
</main>
<style>
  :global(body){margin:0;background:#f3f5f2;color:#213c33;font-family:system-ui,sans-serif}main{max-width:740px;margin:40px auto;padding:24px}.eyebrow{font-size:12px;letter-spacing:.1em}h1{font-size:36px}section{background:white;border:1px solid #dce3dc;border-radius:12px;padding:24px;margin-top:24px;overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:16px 12px;border-bottom:1px solid #dce3dc}th{font-size:13px}button{background:#245b44;color:white;border:0;border-radius:6px;padding:12px 18px;font:inherit}button:disabled{opacity:.6}[role=status]{min-height:24px}
</style>
