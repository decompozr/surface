<script lang="ts">
  import { onMount } from 'svelte';
  import { createSurfaceClient, type Interaction } from 'virtual:surface-client';
  import { selection } from '../selection';

  type Payload = { experiment: string; title: string; density: string };
  let client: ReturnType<typeof createSurfaceClient>;
  let record = $state<Interaction>();
  let title = $state('我的 Surface 完整流程');
  let density = $state('comfortable');
  let ready = $state(false);
  let busy = $state(false);
  let attempted = $state(false);
  let error = $state('');
  let requestId = $state('');
  let responseId = $state('');
  let storageKey = '';
  const locked = $derived(!ready || busy || attempted || Boolean(record?.response) || Boolean(record?.closed));

  async function inspect() {
    if (!client) return;
    try {
      record = await client.read();
      ready = true;
      if (record?.response) {
        title = String(record.response.data.title);
        density = String(record.response.data.density);
        responseId = record.response.id;
        error = '';
      }
    } catch (cause) {
      ready = false;
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  onMount(() => {
    const url = new URL(location.href);
    requestId = url.searchParams.get('request') ?? '';
    if (!requestId) return;
    storageKey = `surface:integrated-loop:${requestId}`;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const pending = JSON.parse(saved);
        responseId = pending.responseId;
        title = pending.data.title;
        density = pending.data.density;
        attempted = true;
      }
      client = createSurfaceClient();
    } catch (cause) {
      error = String(cause);
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await inspect();
      if (!stopped) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (locked || !title.trim()) return;
    busy = true;
    error = '';
    try {
      // Read exact recipient before the explicit action. The shared recipient
      // panel owns the user's mode choice; the server revalidates that choice.
      const recipient = await client.recipient();
      if (!recipient.canSubmit) throw new Error('接收者目前無法接收，請先更新上方接收者狀態。');
      const data: Payload = { experiment: 'INTEGRATED-LOOP-03', title: title.trim(), density };
      responseId = crypto.randomUUID();
      sessionStorage.setItem(storageKey, JSON.stringify({ responseId, data }));
      attempted = true;
      record = await client.submit(data, responseId);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally { busy = false; }
  }
</script>

<svelte:head><title>Surface 完整流程驗證</title></svelte:head>

<div class="loop-page">
  <header>
    <p class="eyebrow">SURFACE · INTEGRATED-LOOP-03</p>
    <h1>從你的選擇，到實際改變。</h1>
    <p>送出卡片標題與閱讀密度，Agent 會修改這張卡片的原始碼，檢查後將結果回傳到本頁。</p>
  </header>
  <div class="columns">
    <section aria-labelledby="input-heading">
      <h2 id="input-heading">1. 提出修改</h2>
      <p>先在上方確認接收者與傳送方式，再送出一次。</p>
      <form onsubmit={submit}>
        <fieldset disabled={locked}>
          <label for="card-title">卡片標題</label>
          <input id="card-title" bind:value={title} required maxlength="60" />
          <label for="density">閱讀密度</label>
          <select id="density" bind:value={density}>
            <option value="comfortable">寬鬆 — 更多留白</option>
            <option value="compact">精簡 — 較少留白</option>
          </select>
        </fieldset>
        <button type="submit" disabled={locked || !title.trim()}>{busy ? '正在送出…' : attempted || record?.response ? '已送出，等待結果' : '送出修改給本對話'}</button>
      </form>
      {#if !requestId}<p>請開啟 Agent 提供的私人互動連結，才能送出修改。</p>{/if}
      {#if error}<p role="alert" class="error">{error}</p>{/if}
      {#if attempted && !record?.response}
        <p role="status">已保留這次提交的識別碼。請檢查原請求；本頁不會自動重送。</p>
        <button type="button" onclick={inspect}>只檢查提交狀態</button>
      {/if}
    </section>
    <section aria-labelledby="output-heading">
      <h2 id="output-heading">2. 查看原始碼的實際結果</h2>
      <article class:compact={selection.density === 'compact'} data-testid="source-card">
        <p class="eyebrow">{selection.applied ? '已由 AGENT 套用' : '尚未套用'}</p>
        <h3>{selection.title}</h3>
        <p>輸入欄位的變更不會直接改變這張卡片；它呈現 Agent 修改後的原始碼。</p>
        <span>閱讀密度：{selection.density === 'compact' ? '精簡' : '寬鬆'}</span>
      </article>
      <div class="status" aria-live="polite">
        {#if record?.result}
          <strong>Agent 已回傳結果</strong><p>{String(record.result.message ?? '')}</p>
          <p>請檢查標題與留白是否符合你的選擇，再回到對話告訴我「通過」或指出問題。</p>
        {:else if record?.response}
          <strong>{record.response.status === 'accepted' ? '已送達，等待 Agent 完成' : record.response.status === 'delivering' ? '傳送中' : '傳送結果需要確認'}</strong>
          <p>{record.response.error ?? '本頁會自動讀取結果，不會重送你的輸入。'}</p>
        {:else}<p>等待你的提交。</p>{/if}
      </div>
    </section>
  </div>
  <details><summary>本次驗證識別</summary><p>請求：{requestId || '未綁定'}</p><p>提交：{responseId || '尚未提交'}</p></details>
</div>

<style>
  .loop-page{max-width:1040px;margin:auto;padding:clamp(20px,4vw,48px);font:16px/1.65 system-ui,sans-serif;color:#25334a}
  header{max-width:700px;margin-bottom:32px}h1{font-size:clamp(26px,4vw,38px);line-height:1.3;margin:12px 0}h2{font-size:19px;margin:0 0 12px}h3{font-size:25px;line-height:1.4;overflow-wrap:anywhere;margin:12px 0}
  .eyebrow{font-size:11px;letter-spacing:.12em;color:#56647a}.columns{display:grid;grid-template-columns:1fr 1fr;gap:32px}section{min-width:0}fieldset{border:0;padding:0;margin:0;min-width:0}
  label{display:block;font-weight:600;margin:20px 0 8px}input,select,button{box-sizing:border-box;max-width:100%;width:100%;min-height:44px;font:inherit;border-radius:8px;padding:10px 12px}input,select{background:white;border:1px solid #9ca9bd;color:inherit}
  button{margin-top:20px;border:1px solid #263b60;background:#263b60;color:white;cursor:pointer}button:disabled{opacity:.55;cursor:default}input:focus-visible,select:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid #477ec7;outline-offset:3px}
  article{padding:32px;background:#edf2f8;border:1px solid #c8d5e6;border-radius:12px}article.compact{padding:16px}article.compact p{margin:8px 0}article span{font-size:13px;color:#4e5f79}.status{margin-top:24px;padding:16px;border-left:3px solid #7c96bc;background:#f7f9fc}
  .error{color:#a32525;overflow-wrap:anywhere}details{margin-top:32px;font-size:12px;color:#56647a;overflow-wrap:anywhere}summary{cursor:pointer}
  @media(max-width:720px){.columns{grid-template-columns:1fr;gap:32px}}
</style>
