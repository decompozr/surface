<script lang="ts">
  import { Button, Select, SurfaceCard, Text } from '@decompozr/design-system';
  import { onMount } from 'svelte';
  import { createSurfaceClient, type Recipient, type Interaction, type Directory, type DeliveryIntent } from '../../client/index';
  let client: ReturnType<typeof createSurfaceClient> | undefined;
  let recipient = $state<Recipient>();
  let request = $state<Interaction>();
  let directory = $state<Directory>();
  let mode = $state('');
  let selected = $state('');
  let busy = $state(true);
  let error = $state('');
  let enabled = $state(false);
  let stale = $state(true);
  let uncertainResponseId = $state('');
  let requestId = '';
  function retainRequest(next: Interaction) {
    request = next;
    if (next.response || next.result) {
      uncertainResponseId = '';
      try { sessionStorage.removeItem(`surface:uncertain:${requestId}`); } catch { /* Optional browser storage. */ }
    }
  }
  function choose() {
    if (!client || !recipient || stale || uncertainResponseId) return;
    client.configureDelivery(mode ? { mode: mode as DeliveryIntent['mode'], expectedStatus: recipient.status, expectedTurnId: recipient.turnId } : undefined);
  }
  async function refresh() {
    if (!client) return;
    busy = true; stale = true; error = ''; client.configureDelivery(); mode = '';
    // Durable submission history remains inspectable even if the recipient is unavailable.
    const [history, live] = await Promise.allSettled([client.read(), client.recipient()]);
    if (history.status === 'fulfilled') retainRequest(history.value);
    else error = `Could not check submission: ${history.reason instanceof Error ? history.reason.message : String(history.reason)}`;
    if (live.status === 'fulfilled' && history.status === 'fulfilled') {
      recipient = live.value; selected = recipient.threadId;
      try {
        directory = request?.recipientSelection && !request.response && !request.closed ? await client.directory() : undefined;
        if (directory && !directory.available) throw new Error('Recipient directory is unavailable.');
        stale = false;
        mode = !uncertainResponseId && (recipient.status === 'idle' || recipient.status === 'notLoaded') ? 'start' : '';
        choose();
      } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    } else if (live.status === 'rejected') {
      error += `${error ? ' ' : ''}Recipient status unavailable. Refresh before choosing delivery.`;
    }
    busy = false;
  }
  async function takeOver() {
    if (!client || !selected || stale || uncertainResponseId || request?.response) return;
    busy = true; error = '';
    try {
      const next = await client.takeOver(selected);
      const url = new URL(location.href); url.searchParams.set('request', next.id);
      const fragment = new URLSearchParams(url.hash.slice(1)); fragment.set('token', next.token); url.hash = fragment.toString();
      location.assign(url.href);
    } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); busy = false; }
  }
  onMount(() => {
    const url = new URL(location.href);
    if (!url.searchParams.has('request')) { busy = false; return; }
    enabled = true; requestId = url.searchParams.get('request')!;
    try { uncertainResponseId = sessionStorage.getItem(`surface:uncertain:${requestId}`) ?? ''; } catch { /* Optional browser storage. */ }
    try { client = createSurfaceClient(); void refresh(); }
    catch (cause) { error = String(cause); busy = false; }
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ requestId: string; interaction?: Interaction; error?: string; uncertain?: boolean; responseId?: string }>).detail;
      if (detail.requestId !== url.searchParams.get('request')) return;
      if (detail.interaction) { retainRequest(detail.interaction); error = ''; }
      else if (detail.error) {
        error = detail.error;
        if (detail.uncertain) { uncertainResponseId = detail.responseId ?? ''; stale = true; mode = ''; client?.configureDelivery(); }
        if (/state changed|Recipient unavailable|Confirm delivery mode/.test(detail.error)) { stale = true; mode = ''; client?.configureDelivery(); }
      }
    };
    window.addEventListener('surface:submission', update);
    return () => window.removeEventListener('surface:submission', update);
  });
</script>

{#if enabled}
  <div class="recipient"><SurfaceCard as="section" aria-label="Agent recipient" tone="subtle">
    <div class="heading"><strong>Agent recipient</strong><Button size="compact" onclick={refresh} disabled={busy}>{request?.response || uncertainResponseId ? 'Check submission' : 'Refresh recipient'}</Button></div>
    {#if recipient}<Text size="small"><code>{recipient.threadId}</code> · {stale ? 'Status needs refresh' : recipient.status === 'notLoaded' ? 'Not loaded — resumes on send' : recipient.status}</Text>{/if}
    {#if request?.result}
      <Text size="small">Result published. Delivery history remains below.</Text>
    {/if}
    {#if uncertainResponseId}
      <Text size="small" role="status">Submission outcome unconfirmed. Check the existing submission; do not resend.</Text>
      <Text size="small">Response: <span class="identifier">{uncertainResponseId}</span></Text>
    {/if}
    {#if request?.response}
      <Text size="small">Delivery: {request.response.status}{request.response.receipt ? ` · ${request.response.receipt.mode}` : ''}. {request.response.error ?? ''}</Text>
      {#if !request.result}
        <Text size="small">{request.response.status === 'accepted' ? 'Accepted by the agent runtime; waiting for a published result.' : request.response.status === 'delivering' ? 'Delivery is in progress. Check this submission; do not resend.' : request.response.status === 'unknown' ? 'Delivery outcome is unknown. Check this submission; do not resend or change recipient to bypass it.' : 'Delivery failed. Inspect the recorded error before any new action.'}</Text>
      {/if}
      <Text size="small">Response: <span class="identifier">{request.response.id}</span></Text>
    {:else if request?.closed}<Text size="small">This interaction is closed.</Text>
    {:else if recipient?.canSubmit && !uncertainResponseId}
      <Select label="Delivery mode" bind:value={mode} onchange={(event) => { mode = event.currentTarget.value; choose(); }} disabled={busy || stale}
        options={recipient.status === 'active' ? [
          { value: '', label: 'Choose how to send' },
          { value: 'queue', label: 'Queue after current turn' },
          { value: 'steer', label: 'Steer current turn' },
        ] : [{ value: 'start', label: 'Start a new turn' }]} />
      <Text size="small" tone="muted">Choose the delivery mode here, then submit the page form below.</Text>
    {/if}
    {#if directory && !request?.response && !request?.closed && !uncertainResponseId}
      <Select label="Conversation in this worktree" bind:value={selected} disabled={busy || stale} showSelectedLabel
        options={[{ value: '', label: 'Choose a recipient' }, ...directory.worktree.map(row => ({ value: row.id, label: `${row.title} · ${row.status} · ${row.id.slice(0, 8)}` }))]} />
      <Button size="compact" onclick={takeOver} disabled={busy || stale || !selected || selected === recipient?.threadId}>Confirm recipient change</Button>
      <Text size="small" tone="muted">Creates a new interaction and closes this one. Existing input is not sent or replayed; review the new page before submitting.</Text>
      {#if directory.project.length}<details><summary>Other worktrees · view only ({directory.project.length})</summary>{#each directory.project as row}<Text size="small">{row.title} · {row.workspaceId} · {row.status}</Text>{/each}</details>{/if}
    {/if}
    {#if error}<Text size="small" role="alert">{error}</Text>{/if}
  </SurfaceCard></div>
{/if}

<style>
  .identifier { overflow-wrap: anywhere; }
  .recipient { margin: 1rem; }
  .heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
  @media (max-width: 600px) { .heading { align-items: flex-start; } }
</style>
