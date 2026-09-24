<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { colorShades, Badge, Button, Switch, Toolbar, ToggleButton, Tag, IconButton, TextArea, Slider, Icon, Text, SurfaceCard, SidePanel, FloatingComposer, StatusBar, SelectionOutline, Divider } from '@decompozr/design-system';
  import Toast from '$lib/components/Toast.svelte';
  import SurfaceShell from '$lib/components/SurfaceShell.svelte';
  import { composerPlacement, readViewport } from '$lib/comment-experiment/viewport';
  import { describeTarget, resolveTarget } from '$lib/comment-experiment/selection';
  import { captureElement } from '$lib/comment-experiment/capture';
  import { emptyState, readState, writeState, REVISION, type Target, type Comment, type Batch } from '$lib/comment-experiment/model';
  let { data } = $props();
  let review = $state(emptyState());
  let connectionKey = $state(''), agentAvailable = $state(false), agentStatus = $state('Checking…');
  let streamConnected = $state(false);
  let steer = $state(true);
  let recipientObservation = $state<{ status: 'active' | 'idle' | 'notLoaded'; turnId?: string }>();
  let inspecting = $state(false);
  let inspection = 0;
  async function refreshRecipient(signal?: AbortSignal) {
    const generation = ++inspection;
    inspecting = true; recipientObservation = undefined; agentAvailable = false;
    try {
      const response = await fetch('/experiments/comments/batch', { headers: { authorization: `Bearer ${connectionKey}` }, signal: signal ?? AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Recipient unavailable');
      const status = await response.json();
      if (generation !== inspection) return;
      if (!status.available || status.recipient !== data.recipient || !['active', 'idle', 'notLoaded'].includes(status.status) || (status.status === 'active' && !status.turnId)) throw new Error('Recipient unavailable');
      recipientObservation = { status: status.status, turnId: status.turnId };
      agentAvailable = true; agentStatus = `Agent ${status.status} when checked`;
    } catch {
      if (generation === inspection) { agentAvailable = false; agentStatus = 'Agent needs refresh'; }
    } finally { if (generation === inspection) inspecting = false; }
  }
  function receive(batch: Batch, result: any) {
    batch.status = result.status === 'delivering' ? 'pending' : result.status;
    batch.receipt = result.receipt; batch.requestId = result.requestId;
    batch.deliveryMode = result.deliveryMode; batch.queuedSubmissionId = result.queuedSubmissionId;
    batch.error = result.error;
    if (result.result) batch.result = result.result;
  }
  let toast = $state<{ message: string; tone: 'info' | 'success' | 'warning' } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let liveAbort: AbortController | undefined;
  let connectionPhase: 'initial' | 'connected' | 'disconnected' = 'initial';
  function notify(message: string, tone: 'info' | 'success' | 'warning') {
    clearTimeout(toastTimer); toast = { message, tone };
    toastTimer = setTimeout(() => { toast = null; }, 5000);
  }
  let ready = $state(false), mode = $state(true), panel = $state(false), busy = $state(false), sending = $state(false);
  let notice = $state(''), storageError = $state('');
  let selected = $state<HTMLElement | null>(null), hovered = $state<HTMLElement | null>(null);
  let box = $state<{ x: number; y: number; width: number; height: number } | null>(null);
  let selectionBox = $state<typeof box>(null);
  let toolsPosition = $state({ x: 12, y: 64 });
  let selectionToolsWidth = $state(340), selectionToolsHeight = $state(44);
  let workspace = $state<HTMLElement>(null!);
  let composer = $state<HTMLTextAreaElement>();
  let fontSize = $state(42), compact = $state(false);
  let persistQueue: Promise<void> = Promise.resolve();
  const pending = $derived(review.batches.some(b => b.status === 'pending' || b.status === 'unknown'));
  const locked = $derived(busy || sending || !ready);
  let editorOpen = $state(false);
  let editorPosition = $state({ x: 16, y: 100, width: 310, maxHeight: 400 });
  let visibleViewport = $state({ x: 0, y: 0, width: 390, height: 844 });
  let editorElement: HTMLElement | undefined;
  let measuredEditorHeight = 280;
  let positionFrame = 0;
  const compactEditor = $derived(visibleViewport.height < 460);
  function schedulePosition() {
    if (positionFrame) return;
    positionFrame = requestAnimationFrame(() => { positionFrame = 0; updateBox(); });
  }
  function measureEditor(host: HTMLElement) {
    // The application wrapper observes the rendered component without overriding
    // any package-owned styles or depending on private component class names.
    editorElement = host.firstElementChild as HTMLElement;
    const observer = new ResizeObserver(() => {
      measuredEditorHeight = editorElement?.getBoundingClientRect().height || 280;
      schedulePosition();
    });
    observer.observe(editorElement);
    schedulePosition();
    return { destroy() { observer.disconnect(); editorElement = undefined; measuredEditorHeight = 280; } };
  }
  function revealFocusedInput() {
    if (!composer || document.activeElement !== composer || !editorElement) return;
    for (let parent = composer.parentElement; parent && parent !== editorElement; parent = parent.parentElement) {
      if (parent.scrollHeight <= parent.clientHeight || !/auto|scroll/.test(getComputedStyle(parent).overflowY)) continue;
      const field = composer.getBoundingClientRect(), area = parent.getBoundingClientRect();
      if (field.bottom > area.bottom) parent.scrollTop += field.bottom - area.bottom + 4;
      else if (field.top < area.top) parent.scrollTop -= area.top - field.top + 4;
      break;
    }
  }
  function metadata(el: HTMLElement): Target { return describeTarget(el, workspace); }
  function closeEditor() { editorOpen = false; hovered = null; updateBox(); }
  let reviewScroller: HTMLElement | undefined;
  function followLatest(node: HTMLElement) {
    const body = node.parentElement!;
    reviewScroller = body;
    let following = true;
    const onScroll = () => { following = body.scrollHeight - body.clientHeight - body.scrollTop < 48; };
    const scroll = () => { if (following) body.scrollTop = body.scrollHeight; };
    const resize = new ResizeObserver(scroll);
    resize.observe(node);
    body.addEventListener('scroll', onScroll, { passive: true });
    void tick().then(scroll);
    return { destroy() { resize.disconnect(); body.removeEventListener('scroll', onScroll); reviewScroller = undefined; } };
  }
  $effect(() => {
    if (panel) void tick().then(() => { if (reviewScroller) reviewScroller.scrollTop = reviewScroller.scrollHeight; });
  });
  async function togglePanel() {
    panel = !panel;
    if (panel) editorOpen = false;
    await tick();
  }
  function updateEditor() {
    if (!editorOpen) return;
    const anchor = selected?.getBoundingClientRect() ?? { left: editorPosition.x, bottom: editorPosition.y - 10 };
    editorPosition = composerPlacement({ ...visibleViewport, height: Math.min(visibleViewport.height, Math.max(1, window.innerHeight - 44 - visibleViewport.y)) }, anchor, measuredEditorHeight, workspace?.getBoundingClientRect().top ?? 60);
  }
  function updateBox() {
    visibleViewport = readViewport(window);
    updateEditor();
    if (!mode || !workspace) { box = null; selectionBox = null; return; }
    const w = workspace.getBoundingClientRect();
    function clipped(el: HTMLElement | null) {
      if (!el?.isConnected) return null;
      const r = el.getBoundingClientRect();
      const x = Math.max(r.left, w.left, visibleViewport.x), y = Math.max(r.top, w.top, visibleViewport.y);
      const right = Math.min(r.right, w.right, visibleViewport.x + visibleViewport.width), bottom = Math.min(r.bottom, w.bottom, visibleViewport.y + visibleViewport.height);
      return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
    }
    selectionBox = clipped(selected);
    box = hovered && hovered !== selected ? clipped(hovered) : selectionBox;
    if (selectionBox) {
      toolsPosition = {
        x: Math.max(visibleViewport.x + 12, Math.min(selectionBox.x, visibleViewport.x + visibleViewport.width - selectionToolsWidth - 12)),
        y: Math.max(visibleViewport.y + 12, w.top + 4, Math.min(selectionBox.y - selectionToolsHeight, visibleViewport.y + visibleViewport.height - selectionToolsHeight - 32)),
      };
    }
  }
  $effect(() => { selectionToolsWidth; selectionToolsHeight; schedulePosition(); });

  function targetFrom(event: Event) {
    const raw = event.target instanceof Element ? event.target : null;
    const el = raw?.closest<HTMLElement>('button, a, input, select, textarea, [role="button"]') ?? (raw instanceof HTMLElement ? raw : raw?.closest<HTMLElement>('p, section'));
    return el && el !== workspace && workspace?.contains(el) && !['BR', 'SCRIPT', 'STYLE'].includes(el.tagName) ? el : null;
  }
  async function select(el: HTMLElement) {
    if (locked) return;
    const target = metadata(el);
    if (review.draft.target?.id !== target.id && (review.draft.text.trim() || review.draft.capture) && !addComment(false)) return;
    if (review.draft.target?.id !== target.id) review.draft = { target, text: '' };
    selected = el; hovered = null; editorOpen = false; notice = ''; updateBox();
  }
  async function openComment() { editorOpen = true; updateBox(); await tick(); composer?.focus({ preventScroll: true }); }
  function addComment(clearNotice = true) {
    const d = review.draft;
    if (!d.target || (!d.text.trim() && !d.capture)) return false;
    if (!d.editing && review.comments.length >= 20) { notice = 'Send the current 20 comments before adding more.'; return false; }
    const comment: Comment = { id: d.editing ?? crypto.randomUUID(), target: d.target, text: d.text.trim(), ...(d.capture ? { capture: d.capture } : {}) };
    if (d.editing) review.comments = review.comments.map(c => c.id === d.editing ? comment : c);
    else review.comments.push(comment);
    review.draft = { target: null, text: '' }; selected = null; hovered = null; editorOpen = false; updateBox();
    if (clearNotice) { notice = ''; notify('Added to draft', 'success'); }
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
    if (locked || (data.live && (!agentAvailable || !recipientObservation || inspecting)) || pending || review.draft.text.trim() || review.draft.capture || !review.comments.length) return;
    const batch: Batch = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), page: location.pathname, revision: REVISION, recipient: data.recipient as Batch['recipient'], comments: $state.snapshot(review.comments), ...(data.live && recipientObservation ? { delivery: { mode: recipientObservation.status === 'active' ? (steer ? 'steer' as const : 'queue' as const) : 'start' as const, expectedStatus: recipientObservation.status, expectedTurnId: recipientObservation.turnId } } : {}), status: 'pending' };
    if (JSON.stringify(batch).length > 7_500_000) { notice = 'This batch is too large. Remove a screenshot before sending.'; return; }
    review.batches.push(batch); review.comments = []; review.draft = { target: null, text: '' }; selected = null; updateBox(); await deliver(batch.id);
  }
  async function deliver(id: string) {
    const batch = review.batches.find(b => b.id === id); if (!batch || sending) return;
    sending = true; notice = '';
    try {
      await flush();
      const response = await fetch('/experiments/comments/batch', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${connectionKey}` }, body: JSON.stringify(batch), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409 && result.notSubmitted === true) {
          review.batches = review.batches.filter(item => item.id !== id);
          review.comments = [...batch.comments, ...review.comments];
          ++inspection; recipientObservation = undefined; agentAvailable = false; inspecting = false;
          notice = `${result.message} Comments remain unsent. Refresh the agent, review the choice, then send again.`;
          await flush(); return;
        }
        throw new Error(result.message ?? `Submission could not be confirmed (${response.status}).`);
      }
      if (result.batchId !== id || result.destination !== batch.recipient) throw new Error('Unexpected delivery receipt.');
      const stored = review.batches.find(b => b.id === id)!;
      receive(stored, batch.recipient === 'local-fixture' ? { ...result, status: 'accepted' } : result);
      await flush();
      notice = batch.recipient === 'local-fixture' ? 'Local test received. No agent contacted.' : stored.status === 'accepted' ? stored.deliveryMode === 'queue' ? 'Queued for this conversation. Waiting for reply.' : 'Delivered to this conversation. Waiting for reply.' : 'Delivery is not confirmed. Your batch is retained.';
    } catch (error) {
      const stored = review.batches.find(item => item.id === id);
      notice = stored?.status === 'accepted' || stored?.result
        ? 'Submission confirmed through live updates. Nothing was resent.'
        : `${error instanceof Error ? error.message : 'Delivery could not be confirmed.'} The batch is retained. Status updates automatically.`;
    }
    finally { sending = false; }
  }
  async function watchUpdates(signal: AbortSignal) {
    if (!data.live || !connectionKey) return;
    while (!signal.aborted) {
      liveAbort = new AbortController();
      const transportSignal = AbortSignal.any([signal, liveAbort.signal]);
      try {
        await refreshRecipient(transportSignal);
        const response = await fetch('/experiments/comments/events', { headers: { authorization: `Bearer ${connectionKey}` }, signal: transportSignal });
        if (!response.ok || !response.body) throw new Error('Stream unavailable');
        streamConnected = true;
        if (connectionPhase === 'disconnected') notify('Live updates reconnected.', 'success');
        if (!agentAvailable && connectionPhase !== 'connected') notify('Live updates connected. Agent is unavailable.', 'warning');
        connectionPhase = 'connected';
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
                receive(batch, result);
              }
            }
          }
        } finally { await reader.cancel().catch(() => {}); }
      } catch { /* Reconnect reads a fresh durable snapshot; never resubmit. */ }
      streamConnected = false; recipientObservation = undefined; agentAvailable = false; agentStatus = 'Agent not verified';
      if (!signal.aborted && connectionPhase !== 'disconnected') { notify('Connection lost. Reconnecting…', 'warning'); connectionPhase = 'disconnected'; }
      if (!signal.aborted) await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
        const timer = setTimeout(finish, 2000); signal.addEventListener('abort', finish, { once: true });
      });
    }
  }
  $effect(() => {
    if (!ready) return;
    const snapshot = $state.snapshot(review);
    persistQueue = persistQueue.catch(() => {}).then(() => writeState(snapshot)).then(() => { storageError = ''; }, () => { storageError = 'Could not save comments. Keep this page open.'; });
  });
  onMount(() => {
    let active = true;
    let updates = new AbortController();
    let updatesTask: Promise<void> = Promise.resolve();
    const viewport = window.visualViewport;
    let revealFrame = 0;
    const viewportChange = () => {
      schedulePosition();
      cancelAnimationFrame(revealFrame);
      revealFrame = requestAnimationFrame(() => { void tick().then(revealFocusedInput); });
    };
    viewport?.addEventListener('resize', viewportChange);
    viewport?.addEventListener('scroll', viewportChange);
    window.addEventListener('focusin', viewportChange);
    updateBox();
    const offline = () => { liveAbort?.abort(); };
    window.addEventListener('offline', offline);
    const connect = () => {
      let key = new URLSearchParams(location.hash.slice(1)).get('connect') ?? '';
      try { key ||= sessionStorage.getItem('surface-comments-connection') ?? ''; } catch { /* Fragment works without storage. */ }
      if (key === connectionKey) return;
      updates.abort();
      const next = new AbortController();
      updates = next;
      connectionKey = key;
      agentAvailable = false;
      agentStatus = key ? 'Checking…' : 'Open connection link';
      try { if (key) sessionStorage.setItem('surface-comments-connection', key); } catch { /* Keep the in-memory capability. */ }
      // Serialize stream replacement so an old reader cannot clear the new connection state.
      if (ready) updatesTask = updatesTask.then(() => {
        if (active && !next.signal.aborted) return watchUpdates(next.signal);
      });
    };
    connect();
    window.addEventListener('hashchange', connect);
    agentStatus = data.live ? (connectionKey ? 'Checking…' : 'Open connection link') : 'Local test';
    const workspaceSize = new ResizeObserver(schedulePosition);
    workspaceSize.observe(workspace);
    readState().then(saved => { if (!active) return; review = saved; ready = true; if (saved.draft.target) selected = resolveTarget(saved.draft.target, workspace); updateBox(); updatesTask = watchUpdates(updates.signal); })
      .catch(() => { if (active) { ready = true; notice = 'Browser storage could not be opened. Keep this page open.'; updatesTask = watchUpdates(updates.signal); } });
    let gesture: { x: number; y: number; moved: boolean } | null = null;
    let suppressClick = false;
    const press = (event: PointerEvent) => {
      gesture = targetFrom(event) ? { x: event.clientX, y: event.clientY, moved: false } : null;
      suppressClick = false;
    };
    const cancel = () => { if (gesture) gesture.moved = true; suppressClick = true; hovered = null; updateBox(); };
    const scroll = () => { if (gesture) gesture.moved = true; hovered = null; schedulePosition(); };
    const release = () => { suppressClick = !!gesture?.moved; };
    const click = (event: MouseEvent) => {
      if (!mode) return;
      const el = targetFrom(event); if (!el) return;
      event.preventDefault(); event.stopPropagation();
      if (suppressClick || gesture?.moved) { gesture = null; return; }
      gesture = null; void select(el);
    };
    const move = (event: PointerEvent) => {
      if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.moved = true;
      hovered = event.pointerType === 'mouse' && !event.buttons && mode && !busy ? targetFrom(event) : null;
      schedulePosition();
    };
    const key = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat) return;
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && editorOpen) {
        event.preventDefault(); if (!locked) addComment(); return;
      }
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select, [role="textbox"]'));
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key.toLowerCase() === 's' && !locked) { event.preventDefault(); mode = !mode; hovered = null; if (!mode) editorOpen = false; updateBox(); return; }
        if (event.key.toLowerCase() === 'i') { event.preventDefault(); void togglePanel(); return; }
      }
      if (event.key === 'Escape') {
        if (editorOpen) { event.preventDefault(); closeEditor(); }
        else if (panel || document.querySelector('[aria-controls="surface-navigation"]')?.getAttribute('aria-expanded') === 'true') return;
        else mode = false;
        hovered = null; updateBox();
      }
      if (mode && (event.key === 'Enter' || event.key === ' ') && targetFrom(event)) { event.preventDefault(); event.stopPropagation(); void select(targetFrom(event)!); }
    };
    window.addEventListener('pointerdown', press, true); window.addEventListener('click', click, true); window.addEventListener('pointermove', move); window.addEventListener('keydown', key, true); window.addEventListener('resize', viewportChange); window.addEventListener('scroll', scroll, true); window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', cancel, true);
    return () => { active = false; window.removeEventListener('hashchange', connect); cancelAnimationFrame(positionFrame); cancelAnimationFrame(revealFrame); viewport?.removeEventListener('resize', viewportChange); viewport?.removeEventListener('scroll', viewportChange); window.removeEventListener('focusin', viewportChange); clearTimeout(toastTimer); updates.abort(); window.removeEventListener('offline', offline); workspaceSize.disconnect(); window.removeEventListener('pointerdown', press, true); window.removeEventListener('click', click, true); window.removeEventListener('pointermove', move); window.removeEventListener('keydown', key, true); window.removeEventListener('resize', viewportChange); window.removeEventListener('scroll', scroll, true); window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', cancel, true); };
  });
</script>
<svelte:head><title>Surface · Comment experiment</title></svelte:head>
{#snippet headerTools()}
    <Toolbar label="Review tools">

      <ToggleButton size="compact" icon="mouse-pointer-2" label={mode ? 'Leave comment mode' : 'Select and comment'} aria-keyshortcuts="S" title={mode ? 'Leave comment mode (S / Esc)' : 'Select and comment (S)'} pressed={mode} disabled={locked} onPressedChange={(value) => { mode = value; hovered = null; if (!mode) editorOpen = false; updateBox(); }} />
      <IconButton size="compact" icon="message-square" label={`Open comments (${review.comments.length} drafts)`} title="Comments (I)" aria-keyshortcuts="I" aria-expanded={panel} aria-controls="surface-comments" onclick={togglePanel}>{#snippet badge()}{#if review.comments.length}<Badge tone="sage">{review.comments.length}</Badge>{/if}{/snippet}</IconButton>
    </Toolbar>
{/snippet}
{#snippet commentPanel()}
<SidePanel label="Comment review">
{#snippet header()}
    <div class="panel-heading"><Text as="h2" size="body">Comments <Badge>{review.comments.length}</Badge></Text><IconButton size="compact" icon="close" label="Close comments" title="Close comments" onclick={() => panel = false} /></div>
    <div class="recipient">{#if agentAvailable}<Icon name="circle-dot" />{:else}<Icon name="unplug" />{/if}<Text as="span" size="small" tone="muted">{data.live ? data.label : "Local test only"}</Text></div>
{/snippet}
    <div class="conversation" use:followLatest>
      {#if !review.comments.length && !review.batches.length}<div class="empty"><Text size="small">No comments yet. Select an element to start.</Text></div>{/if}
      {#each review.batches as batch (batch.id)}<SurfaceCard as="section" class="batch" tone="subtle" aria-label="Submitted batch"><div class="batch-label"><strong>You · {batch.comments.length} comments</strong><span>{batch.recipient === 'local-fixture' ? 'Local test' : batch.result ? batch.result.stage === 'acknowledged' ? 'Agent acknowledged' : 'Agent replied' : batch.status === 'accepted' ? batch.deliveryMode === 'queue' ? 'Queued' : 'Delivered' : batch.status === 'failed' ? 'Not delivered' : 'Unconfirmed'}</span></div>
        {#each batch.comments as comment}<div class="sent-comment"><strong>{comment.target.label}</strong>{#if comment.capture}<a href={comment.capture.png} download={`${comment.target.id}.png`} aria-label={`Download screenshot of ${comment.target.label}`}><img src={comment.capture.png} alt={`Captured ${comment.target.label}`} /></a>{/if}<Text size="small">{comment.text}</Text></div>{/each}
        {#if batch.recipient === 'local-fixture' && batch.status === 'accepted'}<Divider /><Text size="small" class="fixture-reply">Local test only. This was not sent to an agent.</Text>{:else if batch.result}<Divider /><Text size="small" class="agent-reply">{batch.result.message}</Text>{#if batch.result.stage === 'acknowledged' && batch.result.next}<Text size="small" tone="muted">{batch.result.next === 'continue-original' ? 'Continuing the original task' : batch.result.next === 'address-now' ? 'Addressing this now' : 'Handling this later'}</Text>{/if}{:else if batch.status === 'accepted'}{:else if batch.status === 'pending'}<Text size="small">Submission unconfirmed. Nothing is resent automatically.</Text>{#if batch.recipient === 'local-fixture'}<Button size="compact" disabled={sending} onclick={() => deliver(batch.id)}>Retry local test</Button>{/if}{:else if batch.status === 'unknown' || batch.status === 'failed'}<Text size="small" class="notice">{batch.error ?? 'Delivery needs reconciliation. Nothing is resent automatically.'}</Text>{/if}
        {#if batch.recipient !== 'local-fixture' && (batch.status === 'accepted' || batch.status === 'pending') && (!batch.result || batch.result.stage === 'acknowledged')}<div class="reply-wait" role="status"><span class="reply-spinner" aria-hidden="true"></span>{streamConnected ? 'Waiting for reply…' : 'Reconnecting…'}</div>{/if}
      </SurfaceCard>{/each}
      {#if review.comments.length}<Text size="eyebrow" tone="muted">Draft · not sent</Text>{/if}
      {#each review.comments as comment, i (comment.id)}<SurfaceCard as="article" class="comment-card"><div class="comment-heading"><Badge>{i + 1}</Badge><strong>{comment.target.label}</strong></div>{#if comment.capture}<a href={comment.capture.png} download={`${comment.target.id}.png`} aria-label={`Download screenshot of ${comment.target.label}`}><img src={comment.capture.png} alt={`Captured ${comment.target.label}`} /></a><Text as="span" size="small" tone="muted" class="image-meta">{comment.capture.width} × {comment.capture.height} · frozen capture</Text>{/if}<Text size="small">{comment.text}</Text><div class="card-actions"><IconButton size="compact" icon="pencil" label={`Edit comment ${i + 1}`} title="Edit comment" disabled={locked || review.draft.editing === comment.id} onclick={() => edit(comment)} /><IconButton size="compact" icon="trash-2" label={`Remove comment ${i + 1}`} title="Remove comment" disabled={locked || review.draft.editing === comment.id} onclick={() => review.comments = review.comments.filter(c => c.id !== comment.id)} /></div></SurfaceCard>{/each}
    </div>
{#snippet footer()}
    <div class="composer">
      {#if review.draft.target && (review.draft.text.trim() || review.draft.capture)}<Button size="compact" onclick={() => { panel = false; editorOpen = true; selected = resolveTarget(review.draft.target, workspace); selected?.scrollIntoView({ block: 'nearest' }); updateBox(); tick().then(() => composer?.focus()); }}>Continue draft: {review.draft.target.label}</Button>{/if}
      {#if notice}<Text size="small" class="notice" role="status">{notice}</Text>{/if}
      {#if data.live && !connectionKey}<Text size="small" class="hint">Open the private connection link to enable sending.</Text>{/if}
      {#if review.draft.text.trim() || review.draft.capture}<Text size="small" class="hint">Add this comment to the draft before sending the batch.</Text>{/if}
      <div class="delivery-actions">
      {#if data.live && review.comments.length}
        <Switch label={steer ? 'Steer' : 'Queue'} aria-label="Steer delivery" bind:checked={steer} disabled={locked || pending} />
      {/if}
      <div class="send-action"><Button size="compact" variant="primary" appearance="default" aria-label={`Send ${review.comments.length} comments together`} title={`Send ${review.comments.length} comments together`} disabled={locked || (data.live && (!agentAvailable || !recipientObservation || inspecting)) || pending || !review.comments.length || !!review.draft.text.trim() || !!review.draft.capture} onclick={send} ><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4v7a4 4 0 0 1-4 4H4m5-5-5 5 5 5" /></svg></Button></div>
      </div>
      {#if storageError}<span role="alert">{storageError}</span>{/if}
    </div>
{/snippet}
</SidePanel>
{/snippet}
{#snippet connectionStatus()}
<div class="connection-bar"><StatusBar label="Connection status" height="44px">
  {#if data.live && connectionKey}<Button size="compact" appearance="quiet" disabled={locked || inspecting} onclick={() => refreshRecipient()}>Refresh agent</Button>{/if}
  <span class="connection-summary">{streamConnected ? agentAvailable ? 'Connected' : 'Agent unavailable' : 'Reconnecting…'}</span><span class="live-indicator"><IconButton size="compact" icon="radio" label={streamConnected ? 'Live updates connected' : 'Live updates disconnected'} title={streamConnected ? 'Live updates connected' : connectionKey ? 'Reconnecting' : 'Open the private connection link'} onclick={() => notify(streamConnected ? `Live updates connected. ${agentStatus}.` : connectionKey ? 'Disconnected. Reconnecting automatically.' : 'Open the private connection link to connect.', streamConnected ? 'info' : 'warning')} /></span>
</StatusBar></div>
{/snippet}
<SurfaceShell panelContent={commentPanel} bind:panelOpen={panel} status={connectionStatus} statusHeight="44px" navigation={data.navigation} currentPath="/experiments/comments" {headerTools} surfaceIdentity overlayNavigation showBreadcrumbs={false}>
  <section id="comment-workspace" class:selecting={mode} bind:this={workspace} aria-label="Shared workspace">
    <div class="workspace-meta"><Text as="span" size="eyebrow" tone="muted">Shared workspace</Text><Text as="span" size="small" tone="muted">Study 01 / Global layout</Text></div>
    <Text size="small" class="instruction">{mode ? 'Select an element to leave a comment. Press Esc to interact with the page.' : 'Explore the page. Turn on comment mode whenever something needs feedback.'}</Text>
    <article class="study" class:compact>
      <Text size="eyebrow" class="eyebrow">A little room to think</Text>
      <Text as="h1" size="title" id="headline" style={`font-size:${fontSize}px`}>Make space for<br />the work that matters.</Text>
      <Text size="small" id="description" class="intro">A shared space to explore an idea, see it take shape, and leave precise feedback for your agent.</Text>
      <div id="controls" class="controls"><Slider label="Heading size" min={28} max={54} step={1} bind:value={fontSize} valueSuffix="px" /><ToggleButton size="compact" bind:pressed={compact}>{compact ? 'Comfortable spacing' : 'Compact spacing'}</ToggleButton></div>
      <div class="options">
        <SurfaceCard as="section" id="option-a" class="option" selected padding={compact ? "1rem" : "1.5rem"}><div class="option-top"><span>01</span><Tag label="Current direction" tone="sage" /></div><Text as="h2" size="heading">Workspace first</Text><Text size="small">Keep the idea in view. Collect comments beside it, then send them together when you are ready.</Text><div class="option-footer"><Text size="small" tone="muted">Content takes the lead</Text></div></SurfaceCard>
        <SurfaceCard as="section" id="option-b" class="option" padding={compact ? "1rem" : "1.5rem"}><div class="option-top"><span>02</span><Tag label="Alternative" /></div><Text as="h2" size="heading">Conversation first</Text><Text size="small">Start with the exchange. Open a shared workspace when there is something worth exploring together.</Text><div class="option-footer"><Text size="small" tone="muted">Dialogue takes the lead</Text></div></SurfaceCard>
      </div>
      <div id="decision" class="decision"><strong>What would you simplify?</strong><Text size="small">Select a heading, card, or control and show your agent.</Text></div>
    </article>
  </section>

{#if editorOpen && review.draft.target}
  <div class="editor-anchor" use:measureEditor>
  <FloatingComposer label="Comment on selected element" x={editorPosition.x} y={editorPosition.y} width={`${editorPosition.width}px`} maxHeight={`${editorPosition.maxHeight}px`}>
{#snippet header()}
    <div class="selected-title"><strong title={review.draft.target?.selector}>{review.draft.target?.label}</strong><IconButton size="compact" icon="close" label="Close comment editor" title="Close (draft retained)" disabled={locked} onclick={closeEditor} /></div>
{/snippet}
    <div class="editor-body">
    {#if review.draft.capture}<img class="capture-preview" src={review.draft.capture.png} alt="Selected element screenshot preview" />{/if}
    <TextArea label="Comment on selected element" labelHidden bind:element={composer} id="comment" bind:value={review.draft.text} maxlength={4000} rows={compactEditor ? 2 : 3} maxHeight={compactEditor ? "90px" : "170px"} disabled={locked} placeholder="Leave a comment…" />
    </div>
{#snippet actions()}
    <div class="editor-actions">
      <IconButton size="compact" icon="camera" label={review.draft.capture ? 'Retake element screenshot' : 'Capture element screenshot'} title={busy ? 'Capturing…' : 'Capture selected element'} disabled={locked || !selected} onclick={capture} />

      {#if review.draft.capture}<IconButton size="compact" icon="trash-2" label="Remove screenshot" title="Remove screenshot" disabled={locked} onclick={() => review.draft.capture = undefined} />{/if}
      <span class="editor-status">{busy ? 'Capturing…' : ''}</span>
      <IconButton size="compact" icon="check" variant="primary" appearance="default" label={review.draft.editing ? 'Save comment' : 'Add comment to draft'} aria-keyshortcuts="Meta+Enter Control+Enter" title={review.draft.editing ? 'Save comment (⌘/Ctrl + Enter)' : 'Add comment (⌘/Ctrl + Enter)'} disabled={locked || (!review.draft.text.trim() && !review.draft.capture)} onclick={() => addComment()} />
    </div>
{/snippet}
{#snippet footer()}{#if notice && !compactEditor}<Text size="small" role="status">{notice}</Text>{/if}{/snippet}
  </FloatingComposer>
  </div>
{/if}
{#if box && !panel}<div class="selection-outline"><SelectionOutline {...box} state={hovered && hovered !== selected ? 'hover' : 'selected'} /></div>{/if}
{#if mode && selected && !editorOpen && !panel}
  <div class="element-label selection-tools" role="toolbar" aria-label="Selected element actions" class:offscreen={!selectionBox} inert={!selectionBox} aria-hidden={!selectionBox} bind:clientWidth={selectionToolsWidth} bind:clientHeight={selectionToolsHeight} style:--tools-x={`${toolsPosition.x}px`} style:--tools-y={`${toolsPosition.y}px`} style:--label-background={colorShades.sage.base} style:--label-color={colorShades.neutral.white}>
    {#if selected}
{#if selected?.parentElement && selected.parentElement !== workspace}<IconButton size="compact" icon="chevron-up" label="Select parent element" title="Select parent element" disabled={locked} onclick={() => { const parent = selected?.parentElement; if (parent && workspace.contains(parent) && parent !== workspace) { selected = parent; review.draft = { ...review.draft, target: metadata(parent), capture: undefined }; hovered = null; updateBox(); } }} />{/if}
    {/if}
    <span class="element-name" title={selected ? metadata(selected!).selector : ''}>{selected ? metadata(selected!).label : ''}</span>
    {#if selected}
    <IconButton size="compact" icon="camera" label="Capture selected element" title="Screenshot" disabled={locked} onclick={async () => { await capture(); editorOpen = true; updateBox(); }} />
    <IconButton size="compact" icon="message-square" label="Comment on selected element" title="Comment" disabled={locked} onclick={openComment} />
    <IconButton size="compact" icon="close" label="Clear selection" title="Clear selection" disabled={locked} onclick={() => { selected = null; hovered = null; updateBox(); }} />
    {/if}
  </div>
{/if}

{#if toast}<Toast message={toast.message} tone={toast.tone} dismiss={() => { toast = null; clearTimeout(toastTimer); }} />{/if}
</SurfaceShell>
<style>
:global(body) { margin:0; }
#comment-workspace { box-sizing:border-box; height:100%; min-width:0; overflow:auto; padding:24px 38px; }
#comment-workspace :global(*) { box-sizing:border-box; }
.workspace-meta, .option-top, .controls, .panel-heading, .recipient, .comment-heading, .batch-label, .card-actions, .send-action, .selected-title, .editor-actions { display:flex; align-items:center; gap:.5rem; }
.workspace-meta, .option-top, .panel-heading, .batch-label { justify-content:space-between; }
#comment-workspace :global(.instruction) { margin:18px 0 26px; }
.study { max-width:820px; margin:0 auto; }
.study :global(h1) { max-width:650px; margin:12px 0 20px; }
.study :global(.intro) { max-width:530px; margin-bottom:26px; }
.controls { justify-content:space-between; gap:16px; margin:22px 0; }
.options { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
.option-top { margin-bottom:24px; }
.options :global(h2) { margin-bottom:12px; }
.option-footer { margin-top:24px; }
.decision { margin-top:25px; padding:20px 0; }
.selecting :global(*) { cursor:crosshair; }
#comment-workspace.selecting { touch-action:pan-x pan-y pinch-zoom; }
.recipient { margin-top:.75rem; overflow-wrap:anywhere; }
.conversation { display:grid; gap:.75rem; }
.comment-heading { overflow-wrap:anywhere; }
.comment-heading strong { min-width:0; }
.conversation :global(p) { white-space:pre-wrap; overflow-wrap:anywhere; margin:.75rem 0; }
.conversation img, .capture-preview { display:block; max-width:100%; max-height:150px; object-fit:contain; object-position:left top; margin-top:.75rem; }
.conversation :global(.image-meta) { display:block; margin:.25rem 0; }
.card-actions, .send-action { justify-content:flex-end; }
.send-action { margin-left:auto; }
.delivery-actions :global(button.dz-button), .card-actions :global(button.dz-button), .editor-actions :global(button.dz-button) { min-width:44px; min-height:44px; }
.delivery-actions { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
.composer { padding-bottom:0; }
.composer :global(p) { margin:.5rem 0; overflow-wrap:anywhere; }
.batch-label { flex-wrap:wrap; }
.sent-comment { margin-top:1rem; overflow-wrap:anywhere; }
.selected-title { width:100%; }
.selected-title strong { flex:1; min-width:0; max-height:48px; overflow:auto; overflow-wrap:anywhere; }
.editor-anchor { display:contents; }
.editor-body { display:grid; gap:.5rem; }
.capture-preview { max-height:110px; }
.editor-actions { width:100%; }
.editor-status { flex:1; text-align:right; }



@media(max-width:680px) {
  #comment-workspace { padding:20px; }
  .workspace-meta :global(:last-child) { display:none; }
  .options { grid-template-columns:1fr; }
  .controls { align-items:flex-start; flex-direction:column; }
}

.reply-wait { display:flex; align-items:center; gap:.5rem; font-size:.875rem; padding-top:.75rem; }
.reply-spinner { width:14px; height:14px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:reply-spin .8s linear infinite; }
.element-label { position:fixed; top:0; left:0; z-index:61; display:flex; align-items:center; width:min(340px, calc(100vw - 24px)); box-sizing:border-box; transform:translate3d(var(--tools-x),var(--tools-y),0); will-change:transform; border-radius:.1875rem .1875rem 0 0; background:var(--label-background); color:var(--label-color); padding:0 .4375rem; }
.selection-tools.offscreen { visibility:hidden; pointer-events:none; }
.element-label .element-name { min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:.75rem/1.5 ui-monospace,monospace; }
.element-label :global(button.dz-button), .element-label :global(button.dz-button:hover), .element-label :global(button.dz-button:active) { color:var(--label-color) !important; background:transparent !important; border-color:transparent !important; }
.element-label :global(.icon-button) { flex-shrink:0; }
.element-label :global(button.dz-button) { min-width:44px; min-height:44px; padding:0; }
.connection-bar :global(footer) { background:white; border-top:1px solid #E7EBE7; align-items:center; }
.connection-bar :global(button.dz-button) { font-size:.75rem; padding:.25rem .5rem; min-height:44px; }
.connection-summary { font-size:.75rem; color:#59615C; }
@keyframes reply-spin { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce) { .reply-spinner { animation:none; } }
</style>
