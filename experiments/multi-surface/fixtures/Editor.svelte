<script lang="ts">
  type Row = { id: string; title: string; angle: number; revision: number };
  let rows = $state<Row[]>([]), id = $state('near'), title = $state('Near view'), angle = $state(35);
  let status = $state('Unsaved draft'), pending = $state(false);
  const scope = location.pathname.split('/').filter(Boolean).slice(1, 3).join('/');
  const token = new URLSearchParams(location.hash.slice(1)).get('db') ?? '';
  async function save() {
    pending = true;
    try {
      const response = await fetch(`/project-db/${scope}/actions`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-project-capability': token }, body: JSON.stringify({ operation: 'saveScenario', input: { id, title, angle, expectedRevision: rows.find(row => row.id === id)?.revision ?? 0 } }) });
      const result = await response.json();
      if (!result.ok) throw new Error(result.code);
      rows = [...rows.filter(row => row.id !== id), result.data]; status = `Saved ${result.data.title} · revision ${result.data.revision}`;
    } catch (error) { status = String(error); }
    finally { pending = false; }
  }
</script>
<main>
  <p class="eyebrow">SURFACE EXPERIMENT · EDITOR</p><h1>Plan a scenario</h1>
  <p>Try an angle, then save the scenario for comparison.</p>
  <section>
    <label>Scenario ID <input bind:value={id} /></label>
    <label>Scenario name <input bind:value={title} /></label>
    <label>Camera angle <input type="number" min="0" max="90" bind:value={angle} /></label>
    <button onclick={save} disabled={pending}>Save scenario</button>
  </section>
  <p role="status">{status}</p>
  <p>Open the comparison view and select Load scenarios to see saved changes.</p>
</main>
<style>
  :global(body){margin:0;background:#f3f5f2;color:#213c33;font-family:system-ui,sans-serif}main{max-width:640px;margin:40px auto;padding:24px}.eyebrow{font-size:12px;letter-spacing:.1em}h1{font-size:36px}section{background:white;border:1px solid #dce3dc;border-radius:12px;padding:24px;margin-top:24px}label{display:block;margin-bottom:18px}input{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:10px;font:inherit;border:1px solid #aabbb1;border-radius:6px}button{background:#245b44;color:white;border:0;border-radius:6px;padding:12px 18px;font:inherit}button:disabled{opacity:.6}[role=status]{min-height:24px}
</style>
