<script lang="ts">
  import { onMount } from 'svelte';
  type RecordView = {
    title: string; closed: boolean;
    response?: { id: string; status: string; error?: string; data: { option: string; width: number; comment: string } };
    result?: { message?: string; option?: string; width?: number; [key: string]: unknown };
  };
  let record = $state<RecordView | null>(null);
  let option = $state('A');
  let width = $state(120);
  let comment = $state('');
  let error = $state('');
  let sending = $state(false);
  let ready = $state(false);
  let requestId = '';
  let token = '';
  let responseId = '';
  let savedPayload = $state<string | undefined>(undefined);
  const locked = $derived(sending || Boolean(record?.response) || Boolean(record?.closed) || !ready);

  async function api(method = 'GET', payload?: string) {
    const response = await fetch(`/api/requests/${encodeURIComponent(requestId)}${method === 'POST' ? '/responses' : ''}`, {
      method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: payload, signal: AbortSignal.timeout(90_000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Unable to reach Artifact.');
    return data as RecordView;
  }
  onMount(() => {
    requestId = new URLSearchParams(location.search).get('request') ?? '';
    token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
    responseId = crypto.randomUUID();
    if (!requestId || !token) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const next = await api();
        if (stopped) return;
        record = next; ready = true; error = '';
        if (next.response) ({ option, width, comment } = next.response.data);
      } catch (cause) { if (!stopped) error = cause instanceof Error ? cause.message : 'Connection failed.'; }
      if (!stopped) timer = setTimeout(refresh, 1500);
    }
    void refresh();
    return () => { stopped = true; clearTimeout(timer); };
  });
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (locked) return;
    sending = true; error = '';
    // Preserve one payload and ID across an uncertain HTTP retry.
    savedPayload ??= JSON.stringify({ responseId, data: { option, width, comment } });
    try { record = await api('POST', savedPayload); }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Submission failed.'; }
    finally { sending = false; }
  }
</script>

<svelte:head><title>{record?.title ?? 'Feedback'} · Artifact</title></svelte:head>

<main>
  <header><a class="wordmark" href="/">artifact<span> / </span>feedback</a><span class="local">LOCAL WORKSPACE</span></header>
  <section class="intro">
    <p class="eyebrow">A conversation you can interact with</p>
    <h1>{record?.title ?? 'Shape the next step.'}</h1>
    <p>Choose a direction. Adjust the details. Send it back to the agent working with you.</p>
  </section>
  {#if !ready && !error}
    <div class="notice">Open the private preview link returned by <code>artifact request</code> to connect this page to an agent session.</div>
  {/if}
  <div class="workspace">
    <form onsubmit={submit}>
      <fieldset disabled={locked || Boolean(savedPayload)}>
        <legend>01 / Choose a direction</legend>
        <div class="choices">
          {#each ['A', 'B'] as choice}
            <label class:selected={option === choice}>
              <input type="radio" name="option" value={choice} bind:group={option} />
              <strong>Option {choice}</strong><span>{choice === 'A' ? 'Soft corners. Open space.' : 'Sharp edges. Clear structure.'}</span>
            </label>
          {/each}
        </div>
        <label class="field" for="width">02 / Width <output>{width} px</output></label>
        <input id="width" type="range" min="80" max="240" step="1" bind:value={width} />
        <label class="field" for="comment">03 / Anything to add?</label>
        <textarea id="comment" bind:value={comment} maxlength="1000" placeholder="Tell your agent what matters…" rows="3"></textarea>
      </fieldset>
      <button type="submit" disabled={locked}>{sending ? 'Sending…' : record?.response ? 'Response submitted' : savedPayload ? 'Check submission again' : 'Send to agent →'}</button>
      {#if record?.closed && !record?.response}<p>This request is closed.</p>{/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </form>
    <aside>
      <div class="preview-label">YOUR SELECTION</div>
      <div class="preview"><div class="shape" class:square={option === 'B'} style:width={`${width}px`}><span>{option}</span></div></div>
      <div class="delivery" aria-live="polite">
        {#if record?.result}
          <p class="eyebrow">Result published to this page</p>
          <h2>{record.result.message ?? 'The agent returned a result.'}</h2>
          <div class="result-meta">
            {#if typeof record.result.option === 'string'}<span>Option {record.result.option}</span>{/if}
            {#if typeof record.result.width === 'number'}<span>{record.result.width} px</span>{/if}
          </div>
        {:else if record?.response}
          <p class="eyebrow">Delivery status</p>
          <h2>{record.response.status === 'accepted' ? 'Accepted by the agent runtime.' : record.response.status === 'delivering' ? 'Sending to your agent…' : record.response.status === 'unknown' ? 'Delivery needs checking.' : 'Delivery failed.'}</h2>
          <p>{record.response.error ?? 'Your submission is saved. A returned result will appear here when published.'}</p>
        {:else}
          <p class="eyebrow">Keep the conversation moving</p>
          <h2>Your choice goes back to the same agent session.</h2>
          <p>Its response will appear here when the agent publishes a result.</p>
        {/if}
      </div>
    </aside>
  </div>
  <footer>Built with Svelte. Connected through Artifact.</footer>
</main>

<style>
  :global(*){box-sizing:border-box} :global(body){margin:0;background:#f6f5f0;color:#222c27;font-family:Inter,ui-sans-serif,system-ui,sans-serif} :global(button),:global(input),:global(textarea){font:inherit}
  main{max-width:1100px;margin:auto;padding:36px 40px}header{display:flex;justify-content:space-between;align-items:center;padding-bottom:28px;border-bottom:1px solid #d7dcd4}.wordmark{font-size:21px;font-weight:650;text-decoration:none;color:inherit}.wordmark span{color:#90a08f}.local,.eyebrow,.preview-label{font-size:11px;font-weight:650;letter-spacing:.14em;text-transform:uppercase;color:#596c5b}
  .intro{padding:48px 0 32px}.intro h1{font-size:clamp(34px,5vw,54px);letter-spacing:-.04em;line-height:1.1;margin:16px 0}.intro>p:last-child{font-size:16px;line-height:1.6;max-width:540px;color:#58645d}.workspace{display:grid;grid-template-columns:1fr 1fr;gap:40px}.notice{padding:18px;background:#e7ecdf;border-radius:10px;margin-bottom:24px;font-size:14px;line-height:1.6}
  form{background:white;border:1px solid #dfe3da;padding:28px;border-radius:16px}fieldset{border:0;margin:0;padding:0;min-width:0}legend,.field{font-size:13px;font-weight:650;margin-bottom:14px}.choices{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:28px}.choices label{position:relative;padding:18px 14px;border:1px solid #d7ddd4;border-radius:10px;cursor:pointer}.choices label.selected{border-color:#496b45;background:#f0f5e9}.choices input{accent-color:#496b45;margin:0 0 12px}.choices strong,.choices span{display:block}.choices span{font-size:12px;line-height:1.5;color:#657160;margin-top:8px}.field{display:flex;justify-content:space-between;margin-top:25px}output{font-weight:400;color:#607459}input[type=range]{width:100%;accent-color:#496b45}textarea{width:100%;resize:vertical;border:1px solid #cdd5c8;border-radius:8px;padding:12px;font-size:14px;line-height:1.5;background:#fcfcf9}button{width:100%;margin-top:24px;border:0;border-radius:8px;padding:14px;background:#31512e;color:white;cursor:pointer;font-weight:600}button:disabled{opacity:.55;cursor:default}:global(:focus-visible){outline:3px solid #8fab64;outline-offset:4px}
  aside{display:flex;flex-direction:column}.preview-label{padding:12px 0}.preview{min-height:245px;display:grid;place-items:center;background:#e8eddf;border-radius:16px;background-image:radial-gradient(#c4cfb9 1px,transparent 1px);background-size:16px 16px}.shape{height:140px;max-width:100%;border-radius:40px;background:#d2e590;display:grid;place-items:center;box-shadow:0 15px 35px #52614025;transition:width .2s,border-radius .2s}.shape.square{border-radius:5px;background:#aec5dc}.shape span{font-size:46px;font-weight:500;color:#30412a}.delivery{padding:26px 0}.delivery h2{font-size:21px;font-weight:550;line-height:1.4;letter-spacing:-.02em}.delivery>p:last-child{font-size:14px;color:#58645d;line-height:1.6}.result-meta{display:flex;gap:10px;flex-wrap:wrap}.result-meta span{padding:7px 12px;border:1px solid #cdd5c8;border-radius:6px;font-size:13px}.error{color:#99372d;font-size:14px}footer{margin-top:38px;padding-top:20px;border-top:1px solid #d7dcd4;font-size:12px;color:#6d796b}
  @media(max-width:700px){main{padding:24px 20px}.local{display:none}.intro{padding:30px 0 20px}.workspace{grid-template-columns:1fr;gap:20px}form{padding:22px}.preview{min-height:210px}}
</style>
