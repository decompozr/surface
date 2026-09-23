<script lang="ts">
  import { onMount, tick } from 'svelte';
  import SurfaceLogo from '$lib/comment-experiment/SurfaceLogo.svelte';
  import { fly } from 'svelte/transition';
  import { MessageSquare, MousePointer2, X, Camera, ArrowUp, Pencil, Trash2, Download, ChevronUp, CircleDot, Unplug } from 'lucide-svelte';
  import { describeTarget, resolveTarget } from '$lib/comment-experiment/selection';
  import { captureElement } from '$lib/comment-experiment/capture';
  import { emptyState, readState, writeState, REVISION, type Target, type Comment, type Batch } from '$lib/comment-experiment/model';
  let { data } = $props();
  let review = $state(emptyState());
  let connectionKey = $state(''), agentAvailable = $state(false), agentStatus = $state('Checking…');
  let streamConnected = $state(false);
  let ready = $state(false), mode = $state(true), panel = $state(false), busy = $state(false), sending = $state(false);
  let notice = $state(''), storageError = $state('');
  let selected = $state<HTMLElement | null>(null), hovered = $state<HTMLElement | null>(null);
  let box = $state<{ x: number; y: number; width: number; height: number } | null>(null);
  let workspace = $state<HTMLElement>(null!);
  let composer = $state<HTMLTextAreaElement>();
  let fontSize = $state(42), compact = $state(false);
  let persistQueue: Promise<void> = Promise.resolve();
  const pending = $derived(review.batches.some(b => b.status === 'pending' || b.status === 'unknown'));
  const locked = $derived(busy || sending || !ready);
  let editorOpen = $state(false);
  let editorPosition = $state({ x: 16, y: 100 });
  let reducedMotion = $state(false);
  function metadata(el: HTMLElement): Target { return describeTarget(el, workspace); }
  function closeEditor() { editorOpen = false; hovered = null; updateBox(); }
  async function togglePanel() {
    panel = !panel;
    if (panel) editorOpen = false;
    await tick();
  }
  function updateEditor() {
    if (!selected || !editorOpen) return;
    const r = selected.getBoundingClientRect();
    const width = Math.min(310, innerWidth - 24);
    editorPosition = {
      x: Math.max(12, Math.min(r.left, innerWidth - width - 12)),
      y: Math.max(56, Math.min(r.bottom + 10, innerHeight - 330)),
    };
  }
  function updateBox() {
    updateEditor();
    const el = hovered ?? selected;
    if (!mode || !el?.isConnected || !workspace) { box = null; return; }
    const r = el.getBoundingClientRect(), w = workspace.getBoundingClientRect();
    const x = Math.max(r.left, w.left, 0), y = Math.max(r.top, w.top, 0);
    const right = Math.min(r.right, w.right, innerWidth), bottom = Math.min(r.bottom, w.bottom, innerHeight);
    box = right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
  }
  function targetFrom(event: Event) {
    const raw = event.target instanceof Element ? event.target : null;
    const el = raw instanceof HTMLElement ? raw : raw?.closest<HTMLElement>('button, a, p, section');
    return el && el !== workspace && workspace?.contains(el) && !['BR', 'SCRIPT', 'STYLE'].includes(el.tagName) ? el : null;
  }
  async function select(el: HTMLElement) {
    if (locked) return;
    const target = metadata(el);
    if (review.draft.target?.id !== target.id && (review.draft.text.trim() || review.draft.capture) && !addComment(false)) return;
    if (review.draft.target?.id !== target.id) review.draft = { target, text: '' };
    selected = el; hovered = null; editorOpen = true; panel = false; notice = ''; updateBox();
    await tick(); composer?.focus({ preventScroll: true });
  }
  function addComment(clearNotice = true) {
    const d = review.draft;
    if (!d.target || (!d.text.trim() && !d.capture)) return false;
    if (!d.editing && review.comments.length >= 20) { notice = 'Send the current 20 comments before adding more.'; return false; }
    const comment: Comment = { id: d.editing ?? crypto.randomUUID(), target: d.target, text: d.text.trim(), ...(d.capture ? { capture: d.capture } : {}) };
    if (d.editing) review.comments = review.comments.map(c => c.id === d.editing ? comment : c);
    else review.comments.push(comment);
    review.draft = { target: null, text: '' }; selected = null; hovered = null; editorOpen = false; updateBox();
    if (clearNotice) notice = 'Added to your draft. Nothing has been sent.';
    return true;
  }
  async function capture() {
    if (!selected || locked) return;
    busy = true; notice = ''; const el = selected;
    try { const image = await captureElement(el); review.draft = { ...review.draft, target: metadata(el), capture: image }; notice = 'Element captured. Review the image before adding your comment.'; }
    catch (error) { notice = error instanceof Error ? error.message : 'Capture failed. Your comment is retained.'; }
    finally { busy = false; }
  }
  async function edit(comment: Comment) {
    if (locked) return;
    if ((review.draft.text.trim() || review.draft.capture) && !addComment(false)) return;
    review.draft = { target: structuredClone($state.snapshot(comment.target)), text: comment.text, capture: comment.capture, editing: comment.id };
    selected = resolveTarget(comment.target, workspace); mode = true; panel = false; editorOpen = true;
    selected?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); updateBox();
    await tick(); composer?.focus({ preventScroll: true });
  }
  async function flush() { await persistQueue; await writeState($state.snapshot(review)); }
  async function send() {
    if (locked || (data.live && !agentAvailable) || pending || review.draft.text.trim() || review.draft.capture || !review.comments.length) return;
    const batch: Batch = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), page: location.pathname, revision: REVISION, recipient: data.recipient as Batch['recipient'], comments: $state.snapshot(review.comments), status: 'pending' };
    if (JSON.stringify(batch).length > 7_500_000) { notice = 'This batch is too large. Remove a screenshot before sending.'; return; }
    review.batches.push(batch); review.comments = []; review.draft = { target: null, text: '' }; selected = null; updateBox(); await deliver(batch.id);
  }
  async function deliver(id: string) {
    const batch = review.batches.find(b => b.id === id); if (!batch || sending) return;
    sending = true; notice = '';
    try {
      await flush();
      const response = await fetch('/experiments/comments/batch', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${connectionKey}` }, body: JSON.stringify(batch), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`The batch was not accepted (${response.status}).`);
      const result = await response.json();
      if (result.batchId !== id || result.destination !== batch.recipient) throw new Error('Unexpected delivery receipt.');
      const stored = review.batches.find(b => b.id === id)!;
      stored.status = batch.recipient === 'local-fixture' ? 'accepted' : result.status === 'delivering' ? 'pending' : result.status;
      stored.receipt = result.receipt; stored.requestId = result.requestId; stored.error = result.error; stored.result = result.result;
      await flush();
      notice = batch.recipient === 'local-fixture' ? 'Local test received. No agent contacted.' : stored.status === 'accepted' ? 'Delivered to this conversation. Waiting for the agent’s result.' : 'Delivery is not confirmed. Your batch is retained.';
    } catch (error) { notice = `${error instanceof Error ? error.message : 'Delivery could not be confirmed.'} The batch is retained; retry uses the same identity.`; }
    finally { sending = false; }
  }
  async function watchUpdates(signal: AbortSignal) {
    if (!data.live || !connectionKey) return;
    while (!signal.aborted) {
      try {
        const check = await fetch('/experiments/comments/batch', { headers: { authorization: `Bearer ${connectionKey}` }, signal });
        if (!check.ok) throw new Error('Connection unavailable');
        const status = await check.json();
        agentAvailable = status.available && status.recipient === data.recipient;
        agentStatus = agentAvailable ? 'Agent verified at connection' : 'Agent unavailable';
        const response = await fetch('/experiments/comments/events', { headers: { authorization: `Bearer ${connectionKey}` }, signal });
        if (!response.ok || !response.body) throw new Error('Stream unavailable');
        streamConnected = true;
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        try {
          while (!signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            let boundary: number;
            while ((boundary = buffer.indexOf('\n\n')) >= 0) {
              const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
              const line = event.split('\n').find(line => line.startsWith('data: '));
              if (!line) continue;
              const snapshot = JSON.parse(line.slice(6));
              for (const batch of review.batches.filter(b => b.recipient === data.recipient)) {
                const result = snapshot.batches.find((item: { batchId: string; destination: string }) => item.batchId === batch.id && item.destination === batch.recipient);
                if (!result) continue;
                batch.status = result.status === 'delivering' ? 'pending' : result.status;
                batch.receipt = result.receipt; batch.requestId = result.requestId;
                batch.error = result.error; if (result.result) batch.result = result.result;
              }
            }
          }
        } finally { await reader.cancel().catch(() => {}); }
      } catch { /* Reconnect reads a fresh durable snapshot; never resubmit. */ }
      streamConnected = false; agentAvailable = false; agentStatus = 'Agent not verified';
      if (!signal.aborted) await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
        const timer = setTimeout(finish, 2000); signal.addEventListener('abort', finish, { once: true });
      });
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify($state.snapshot(review), null, 2)], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = 'surface-comment-experiment.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $effect(() => {
    if (!ready) return;
    const snapshot = $state.snapshot(review);
    persistQueue = persistQueue.catch(() => {}).then(() => writeState(snapshot)).then(() => { storageError = ''; }, () => { storageError = 'Could not save — export before leaving'; });
  });
  onMount(() => {
    let active = true;
    const updates = new AbortController();
    try {
      connectionKey = new URLSearchParams(location.hash.slice(1)).get('connect') ?? sessionStorage.getItem('surface-comments-connection') ?? '';
      if (connectionKey) sessionStorage.setItem('surface-comments-connection', connectionKey);
    } catch { /* The private link still works when session storage is unavailable. */ }
    agentStatus = data.live ? (connectionKey ? 'Checking…' : 'Open connection link') : 'Local test';
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    readState().then(saved => { if (!active) return; review = saved; ready = true; if (saved.draft.target) selected = resolveTarget(saved.draft.target, workspace); updateBox(); void watchUpdates(updates.signal); })
      .catch(() => { if (active) { ready = true; notice = 'Browser storage could not be opened. Export your work before leaving.'; void watchUpdates(updates.signal); } });
    const press = (event: PointerEvent) => { if (mode && event.target instanceof HTMLInputElement && workspace.contains(event.target)) { event.preventDefault(); event.stopPropagation(); void select(event.target); } };
    const click = (event: MouseEvent) => { if (!mode) return; const el = targetFrom(event); if (!el) return; event.preventDefault(); event.stopPropagation(); void select(el); };
    const move = (event: PointerEvent) => { hovered = mode && !busy ? targetFrom(event) : null; updateBox(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (editorOpen) closeEditor(); else if (panel) panel = false; else mode = false; hovered = null; updateBox(); }
      if (mode && (event.key === 'Enter' || event.key === ' ') && targetFrom(event)) { event.preventDefault(); event.stopPropagation(); void select(targetFrom(event)!); }
    };
    window.addEventListener('pointerdown', press, true); window.addEventListener('click', click, true); window.addEventListener('pointermove', move); window.addEventListener('keydown', key, true); window.addEventListener('resize', updateBox); window.addEventListener('scroll', updateBox, true);
    return () => { active = false; updates.abort(); window.removeEventListener('pointerdown', press, true); window.removeEventListener('click', click, true); window.removeEventListener('pointermove', move); window.removeEventListener('keydown', key, true); window.removeEventListener('resize', updateBox); window.removeEventListener('scroll', updateBox, true); };
  });
</script>
<svelte:head><title>Surface · Comment experiment</title></svelte:head>
<div class="shell" class:panel-open={panel}>
  <header>
    <div class="identity"><SurfaceLogo /><span class="breadcrumb">Layout study</span></div>
    <nav aria-label="Review tools">
      <span class="connection-status" title={data.live ? `${data.label} · ${data.recipient.replace("codex:", "")}` : "Local fixture only"}>{#if agentAvailable}<CircleDot size={12} strokeWidth={1.5} />{:else}<Unplug size={12} strokeWidth={1.5} />{/if}{streamConnected ? `Live · ${agentStatus}` : data.live && connectionKey ? `Reconnecting · ${agentStatus}` : agentStatus}</span>
      <button class="icon-button" class:active={mode} aria-label={mode ? 'Leave comment mode' : 'Select and comment'} title={mode ? 'Leave comment mode (Esc)' : 'Select and comment'} aria-pressed={mode} disabled={locked} onclick={() => { mode = !mode; hovered = null; if (!mode) editorOpen = false; updateBox(); }}><MousePointer2 size={16} strokeWidth={1.6} /></button>
      <button class="icon-button comments-toggle" aria-label={`Open comments (${review.comments.length} drafts)`} title="Comments" aria-expanded={panel} onclick={togglePanel}><MessageSquare size={16} strokeWidth={1.6} />{#if review.comments.length}<b class="badge">{review.comments.length}</b>{/if}</button>
    </nav>
  </header>
  <main id="comment-workspace" class:selecting={mode} bind:this={workspace} aria-label="Shared workspace">
    <div class="workspace-meta"><span>SHARED WORKSPACE</span><span>Study 01 / Global layout</span></div>
    <p class="instruction">{mode ? 'Select an element to leave a comment. Press Esc to interact with the page.' : 'Explore the page. Turn on comment mode whenever something needs feedback.'}</p>
    <article class="study" class:compact>
      <p class="eyebrow">A little room to think</p>
      <h1 id="headline" style:font-size={`${fontSize}px`}>Make space for<br />the work that matters.</h1>
      <p id="description" class="intro">A shared space to explore an idea, see it take shape, and leave precise feedback for your agent.</p>
      <div id="controls" class="controls"><label>Heading size <input aria-label="Heading size" type="range" min="28" max="54" bind:value={fontSize} /><span>{fontSize}px</span></label><button aria-pressed={compact} onclick={() => compact = !compact}>{compact ? 'Comfortable spacing' : 'Compact spacing'}</button></div>
      <div class="options">
        <section id="option-a" class="option recommended"><div class="option-top"><span>01</span><span class="tag">Current direction</span></div><h2>Workspace first</h2><p>Keep the idea in view. Collect comments beside it, then send them together when you are ready.</p><div class="option-footer">Content takes the lead</div></section>
        <section id="option-b" class="option"><div class="option-top"><span>02</span><span class="tag neutral">Alternative</span></div><h2>Conversation first</h2><p>Start with the exchange. Open a shared workspace when there is something worth exploring together.</p><div class="option-footer">Dialogue takes the lead</div></section>
      </div>
      <div id="decision" class="decision"><strong>What would you simplify?</strong><p>Select a heading, card, or control and show your agent.</p></div>
    </article>
  </main>
  {#if panel}<aside aria-label="Comments and conversation" transition:fly={{ x: 32, duration: reducedMotion ? 0 : 180 }}>
    <div class="panel-heading"><h2>Comments <span class="count">{review.comments.length}</span></h2><button class="icon-button" aria-label="Close comments" title="Close comments" onclick={() => panel = false}><X size={16} /></button></div>
    <div class="recipient">{#if agentAvailable}<CircleDot size={12} />{:else}<Unplug size={12} />{/if}<span>{data.live ? data.label : "Local test only"}</span></div>
    <div class="conversation">
      {#if !review.comments.length && !review.batches.length}<div class="empty"><p>No comments yet. Select an element to start.</p></div>{/if}
      {#each review.batches as batch (batch.id)}<section class="batch" aria-label="Submitted batch"><div class="batch-label"><strong>You · {batch.comments.length} comments</strong><span>{batch.recipient === 'local-fixture' ? 'Local test' : batch.result ? 'Agent replied' : batch.status === 'accepted' ? 'Delivered' : batch.status === 'failed' ? 'Not delivered' : 'Unconfirmed'}</span></div>
        {#each batch.comments as comment}<div class="sent-comment"><strong>{comment.target.label}</strong>{#if comment.capture}<a href={comment.capture.png} download={`${comment.target.id}.png`} aria-label={`Download screenshot of ${comment.target.label}`}><img src={comment.capture.png} alt={`Captured ${comment.target.label}`} /></a>{/if}<p>{comment.text}</p></div>{/each}
        {#if batch.recipient === 'local-fixture' && batch.status === 'accepted'}<p class="fixture-reply">Local test only. This was not sent to an agent.</p>{:else if batch.result}<p class="agent-reply">{batch.result.message}</p>{:else if batch.status === 'pending'}<button disabled={sending} onclick={() => deliver(batch.id)}>Check / retry same batch</button>{:else if batch.status === 'unknown' || batch.status === 'failed'}<p class="notice">{batch.error ?? 'Delivery needs reconciliation. Nothing is resent automatically.'}</p>{/if}
      </section>{/each}
      {#if review.comments.length}<div class="draft-label">DRAFT · NOT SENT</div>{/if}
      {#each review.comments as comment, i (comment.id)}<article class="comment-card"><div class="comment-heading"><span class="number">{i + 1}</span><strong>{comment.target.label}</strong></div>{#if comment.capture}<a href={comment.capture.png} download={`${comment.target.id}.png`} aria-label={`Download screenshot of ${comment.target.label}`}><img src={comment.capture.png} alt={`Captured ${comment.target.label}`} /></a><small class="image-meta">{comment.capture.width} × {comment.capture.height} · frozen capture</small>{/if}<p>{comment.text}</p><div class="card-actions"><button class="icon-button" aria-label={`Edit comment ${i + 1}`} title="Edit comment" disabled={locked || review.draft.editing === comment.id} onclick={() => edit(comment)}><Pencil size={13} /></button><button class="icon-button" aria-label={`Remove comment ${i + 1}`} title="Remove comment" disabled={locked || review.draft.editing === comment.id} onclick={() => review.comments = review.comments.filter(c => c.id !== comment.id)}><Trash2 size={13} /></button></div></article>{/each}
    </div>
    <div class="composer">
      {#if review.draft.target}<button class="resume-draft" onclick={() => { panel = false; editorOpen = true; selected = resolveTarget(review.draft.target, workspace); selected?.scrollIntoView({ block: 'nearest' }); updateBox(); tick().then(() => composer?.focus()); }}>Continue draft: {review.draft.target.label}</button>{/if}
      <p class="notice" role="status">{notice}</p>
      {#if data.live && !connectionKey}<p class="hint">Open the private connection link to enable sending.</p>{/if}
      {#if review.draft.text.trim() || review.draft.capture}<p class="hint">Add this comment to the draft before sending the batch.</p>{/if}
      <button class="send-button icon-button" aria-label={`Send ${review.comments.length} comments together`} title={`Send ${review.comments.length} comments together`} disabled={locked || (data.live && !agentAvailable) || pending || !review.comments.length || !!review.draft.text.trim() || !!review.draft.capture} onclick={send}><ArrowUp size={16} /></button>
      <div class="export-actions">{#if storageError}<span role="alert">{storageError}</span>{/if}<button class="icon-button" aria-label="Export conversation JSON" title="Export conversation" disabled={!ready} onclick={download}><Download size={14} /></button></div>
    </div>
  </aside>{/if}
</div>
{#if editorOpen && review.draft.target}
  <section class="floating-composer" aria-label="Comment on selected element" style:left={`${editorPosition.x}px`} style:top={`${editorPosition.y}px`}>
    <div class="selected-title"><strong title={review.draft.target.selector}>{review.draft.target.selector}</strong><button class="icon-button" aria-label="Close comment editor" title="Close (draft retained)" disabled={locked} onclick={closeEditor}><X size={14} /></button></div>
    {#if review.draft.capture}<img class="capture-preview" src={review.draft.capture.png} alt="Selected element screenshot preview" />{/if}
    <label class="sr-only" for="comment">Comment on selected element</label><textarea bind:this={composer} id="comment" bind:value={review.draft.text} maxlength="4000" disabled={locked} placeholder="Leave a comment…"></textarea>
    <div class="editor-actions">
      <button class="icon-button" aria-label={review.draft.capture ? 'Retake element screenshot' : 'Capture element screenshot'} title={busy ? 'Capturing…' : 'Capture selected element'} disabled={locked || !selected} onclick={capture}><Camera size={16} /></button>
      {#if selected?.parentElement && selected.parentElement !== workspace}<button class="icon-button" aria-label="Select parent element" title="Select parent element" disabled={locked} onclick={() => { const parent = selected?.parentElement; if (parent && workspace.contains(parent) && parent !== workspace) { selected = parent; review.draft = { ...review.draft, target: metadata(parent), capture: undefined }; hovered = null; updateBox(); } }}><ChevronUp size={16} /></button>{/if}
      {#if review.draft.capture}<button class="icon-button" aria-label="Remove screenshot" title="Remove screenshot" disabled={locked} onclick={() => review.draft.capture = undefined}><Trash2 size={14} /></button>{/if}
      <span class="editor-status">{busy ? 'Capturing…' : 'Draft'}</span>
      <button class="icon-button primary" aria-label={review.draft.editing ? 'Save comment' : 'Add comment to draft'} title={review.draft.editing ? 'Save comment' : 'Add to draft'} disabled={locked || (!review.draft.text.trim() && !review.draft.capture)} onclick={() => addComment()}><ArrowUp size={16} /></button>
    </div>
    {#if notice}<p class="notice" role="status">{notice}</p>{/if}
  </section>
{/if}
{#if box}<div class="selection-outline" class:hovering={!!hovered && hovered !== selected} style:left={`${box.x}px`} style:top={`${box.y}px`} style:width={`${box.width}px`} style:height={`${box.height}px`}><span style:max-width={`${Math.max(120, Math.min(640, innerWidth - box.x - 12))}px`}>{(hovered ?? selected) ? metadata((hovered ?? selected)!).selector : ""}</span></div>{/if}
<style>
:global(*){box-sizing:border-box}
:global(body){margin:0;background:#f7f8f6;color:#25382f;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px}
:global(button),:global(textarea),:global(select),:global(input){font:inherit}
:global(button){cursor:pointer}
:global(button:disabled){opacity:.45;cursor:default}
:global(:focus-visible){outline:3px solid #3f8067;outline-offset:4px}
button{border:1px solid #d6ded7;background:white;color:#30483b;padding:9px 12px;border-radius:7px}
button:hover:enabled{background:#eff4ef}
p{line-height:1.65}
.shell{height:100dvh;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:68px minmax(0,1fr)}
.shell.panel-open{grid-template-columns:minmax(0,1fr) 370px}
header{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 28px;border-bottom:1px solid #dfe5df;background:#fff}
.identity,nav{display:flex;align-items:center;gap:12px}
.identity>span:first-of-type{color:#c4cec6;margin:0 5px}
nav .active{background:#e7f0e8;border-color:#bdd1c1}
.count{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:50%;background:#eaf0e9;font-size:12px;font-weight:500}

main{position:relative;min-width:0;overflow:auto;padding:26px 38px 18px}
.workspace-meta{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.1em;color:#7b877e}
.workspace-meta span:last-child{letter-spacing:0}
.instruction{font-size:12px;color:#637768;margin:22px 0 30px}
.study{max-width:820px;margin:0 auto}
.eyebrow{font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#728373;margin:0 0 12px}
h1{line-height:1.1;letter-spacing:-.045em;font-weight:550;margin:0 0 20px;max-width:650px}
.intro{font-size:15px;color:#6d7d71;max-width:530px;margin:0 0 26px}
.controls{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 0;margin-bottom:22px;border-top:1px solid #e1e7df;border-bottom:1px solid #e1e7df}
.controls label{display:flex;align-items:center;gap:12px;font-size:12px}
.controls input{width:100px;accent-color:#4c7759}
.controls label span{color:#6a796c}
.controls button{font-size:11px;padding:7px 9px;background:transparent}
.options{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.option{padding:25px;background:#fff;border:1px solid #dce3d9;border-radius:10px}
.recommended{background:#edf2e9;border-color:#d1ddc9}
.option-top{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#6b7f62}
.tag{font-size:9px;background:#dce7d5;padding:5px 7px;border-radius:4px}
.tag.neutral{background:#f0f2ed;color:#7c8577}
.option h2{font-size:21px;letter-spacing:-.5px;font-weight:550;margin:29px 0 12px}
.option p{color:#72816d;font-size:13px;margin:0 0 28px}
.option-footer{font-size:11px;color:#53674b;border-top:1px solid #dce4d7;padding-top:15px}
.decision{margin-top:25px;padding:20px 0}
.decision strong{font-weight:550}
.decision p{font-size:12px;color:#7a867a;margin:6px 0 0}
.compact .option{padding:16px}
.compact .option h2{margin-top:15px}
.compact .option p{margin-bottom:16px}

aside{border-left:1px solid #dfe5df;background:#fff;min-height:0;display:flex;flex-direction:column}
.panel-heading{display:flex;justify-content:space-between;align-items:center;padding:25px 23px 17px}
.panel-heading h2{font-size:23px;letter-spacing:-.7px;font-weight:550;margin:0}
.recipient{display:flex;gap:10px;align-items:center;padding:12px 15px;background:#f6f8f4;margin:0 20px 16px;border:1px solid #e5eadd;border-radius:7px}
.conversation{flex:1;min-height:80px;overflow:auto;padding:0 20px 18px;overscroll-behavior:contain}
.empty{padding:32px 13px 20px}
.empty p{font-size:12px;color:#738066;margin:0}
.draft-label{font-size:9px;letter-spacing:.12em;color:#718060;margin:12px 0}
.comment-card{padding:13px;border:1px solid #dfe5da;border-radius:8px;margin-bottom:12px}
.comment-heading{display:flex;gap:8px;align-items:center;font-size:11px}
.number{font-size:10px;color:#6b8160;background:#eef3e8;width:19px;height:19px;border-radius:50%;display:grid;place-items:center}
.comment-heading strong{font-weight:550}
.comment-card img,.sent-comment img{display:block;max-width:100%;max-height:150px;object-fit:contain;object-position:left top;border:1px solid #e4e8df;border-radius:4px;margin-top:12px}
.image-meta{display:block;color:#758269;font-size:9px;margin:5px 0}
.comment-card p,.sent-comment p{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0}
.card-actions{display:flex;gap:12px}
.composer{border-top:1px solid #e3e8df;padding:16px 20px 12px;background:#fff;max-height:65%;overflow:auto}
.selected-title{display:flex;gap:8px;align-items:center;font-size:11px;margin-bottom:13px}
.selected-title strong{font-weight:500;flex:1}
.capture-preview{display:block;max-width:100%;max-height:130px;object-fit:contain;object-position:left top;margin:12px 0;border:1px solid #dce4d6;border-radius:4px}
textarea{width:100%;min-height:84px;resize:vertical;border:1px solid #dbe3d5;border-radius:7px;padding:12px;font-size:12px;line-height:1.5;color:#35472f;background:#fafbf8;margin-top:12px}
.send-button{display:block;width:100%;background:#344e3d;color:#fff;border-color:#344e3d;font-size:12px;padding:12px}
.send-button:hover:enabled{background:#233e2d}
.notice{font-size:11px;color:#526a45;margin:10px 0}
.notice:empty{margin:14px 0}
.hint{font-size:10px;color:#677958}
.export-actions{display:flex;justify-content:flex-end;gap:8px;align-items:center;margin-top:10px;color:#718263;font-size:9px}
.batch{padding:13px;background:#f3f6ef;border-radius:8px;margin:12px 0 20px}
.batch-label{display:flex;justify-content:space-between;gap:10px;font-size:10px}
.batch-label span{color:#738568}
.sent-comment{margin-top:15px;font-size:11px}
.fixture-reply{font-size:10px;color:#637853;border-top:1px solid #dce4d4;margin:16px 0 0;padding-top:10px}
.selection-outline{position:fixed;pointer-events:none;z-index:20;border:2px solid #598467;border-radius:3px}
.selection-outline.hovering{border-style:dashed}
.selection-outline>span{position:absolute;left:-2px;top:-22px;background:#598467;color:#fff;font-size:10px;line-height:20px;padding:0 7px;border-radius:3px 3px 0 0;white-space:nowrap}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}


.shell,.shell.panel-open{grid-template-columns:minmax(0,1fr);grid-template-rows:44px minmax(0,1fr);height:100dvh;overflow:hidden}

header{padding:0 16px;gap:10px}
.identity{gap:12px}
.identity .breadcrumb{font-size:11px;color:#7a847c;margin:0}
.identity>span:first-of-type{margin:0;color:#7a847c}
nav{gap:6px}
.connection-status{display:flex;align-items:center;gap:5px;font-size:10px;color:#7e867c;margin-right:7px}
.icon-button{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:0;background:transparent;border-radius:5px;flex-shrink:0}
.icon-button :global(svg){pointer-events:none}
.comments-toggle{position:relative}
.badge{position:absolute;top:-2px;right:-3px;display:grid;place-items:center;font-size:8px;font-weight:500;min-width:13px;height:13px;border-radius:7px;background:#344e3d;color:white}
.study{max-width:820px}
.workspace-meta{font-size:9px}
.instruction{font-size:11px;margin:18px 0 26px}
main{padding:24px 38px}
.selecting :global(*){cursor:crosshair}

aside{position:fixed;z-index:40;top:44px;right:0;bottom:0;width:min(350px,100vw);box-shadow:-12px 0 36px #24372d12;border-left:1px solid #e1e7de}
.panel-heading{padding:12px 16px}
.panel-heading h2{font-size:15px;letter-spacing:-.3px}
.panel-heading .count{margin-left:6px;font-size:10px;width:18px;min-width:18px;height:18px}
.recipient{margin:0 16px 12px;padding:0;border:0;background:none;gap:5px;font-size:10px;color:#7a8473}
.conversation{padding:0 16px 12px}
.composer{padding:12px 16px;max-height:45%}
.empty{padding:16px 0}
.empty p{font-size:12px}
.send-button{width:32px;height:32px;margin:8px 0 0 auto;background:#344e3d}
.export-actions{margin-top:5px}
.card-actions{justify-content:flex-end;gap:4px}
.card-actions .icon-button{padding:0}
.resume-draft{font-size:11px;margin-bottom:10px;width:100%;text-align:left}
.floating-composer{position:fixed;z-index:30;width:min(310px,calc(100vw - 24px));max-height:calc(100dvh - 68px);overflow:auto;border:1px solid #d5dfd1;border-radius:9px;padding:12px;background:white;box-shadow:0 10px 36px #203a2520}
.floating-composer .selected-title{margin-bottom:3px;font-size:10px}
.floating-composer .selected-title strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.floating-composer textarea{margin-top:4px;min-height:72px;max-height:170px;border:0;background:white;padding:5px 0;resize:vertical}
.floating-composer textarea:focus-visible{outline:0}
.floating-composer:focus-within{border-color:#6b8c70}
.editor-actions{display:flex;align-items:center;gap:3px;border-top:1px solid #edf0e8;padding-top:7px}
.editor-status{flex:1;text-align:right;font-size:10px;color:#85917d;margin-right:8px}
.primary{background:#344e3d;color:white}
.primary:hover:enabled{background:#284332}
.floating-composer .capture-preview{max-height:110px;margin:5px 0}
.selection-outline{z-index:20}
.selection-outline>span{max-width:250px;overflow:hidden;text-overflow:ellipsis;font-size:9px}
.notice{font-size:10px}

@media(max-width:680px){header{padding:0 10px}
.identity .breadcrumb{display:none}
.connection-status{font-size:9px;margin-right:2px}
.icon-button{width:32px;height:32px}
main{padding:20px}
.workspace-meta span:last-child{display:none}
.options{grid-template-columns:1fr}
.controls{align-items:flex-start;flex-direction:column}
.option{padding:20px}
.instruction{margin:14px 0 22px}
.selection-outline>span{top:0;left:0}
aside{width:min(350px,100vw)}
}

.agent-reply{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;border-top:1px solid #dce4d4;padding-top:12px}
.selection-outline>span{top:auto;bottom:100%;width:max-content;white-space:normal;overflow-wrap:anywhere;overflow:visible;text-overflow:clip;font-family:ui-monospace,monospace;line-height:1.5;padding:3px 7px}
.floating-composer .selected-title strong{white-space:normal;overflow-wrap:anywhere;max-height:72px;overflow:auto;font-family:ui-monospace,monospace;font-weight:400}
</style>
