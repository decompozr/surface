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
  function choose() {
    if (!client || !recipient) return;
    client.configureDelivery(mode ? { mode: mode as DeliveryIntent['mode'], expectedStatus: recipient.status, expectedTurnId: recipient.turnId } : undefined);
  }
  async function refresh() {
    if (!client) return;
    busy = true; error = ''; client.configureDelivery(); mode = '';
    try {
      [request, recipient] = await Promise.all([client.read(), client.recipient()]);
      if (request.recipientSelection) directory = await client.directory();
      selected = recipient.threadId;
      mode = recipient.status === 'idle' || recipient.status === 'notLoaded' ? 'start' : '';
      choose();
    } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    finally { busy = false; }
  }
  async function takeOver() {
    if (!client || !selected) return;
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
    enabled = true;
    try { client = createSurfaceClient(); void refresh(); }
    catch (cause) { error = String(cause); busy = false; }
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ requestId: string; interaction?: Interaction; error?: string }>).detail;
      if (detail.requestId !== url.searchParams.get('request')) return;
      if (detail.interaction) { request = detail.interaction; error = ''; }
      else if (detail.error) {
        error = detail.error;
        if (/state changed|Recipient unavailable|Confirm delivery mode/.test(detail.error)) { mode = ''; client?.configureDelivery(); }
      }
    };
    window.addEventListener('surface:submission', update);
    return () => window.removeEventListener('surface:submission', update);
  });
</script>

{#if enabled}
  <div class="recipient"><SurfaceCard as="section" aria-label="Agent recipient" tone="subtle">
    <div class="heading"><strong>Agent recipient</strong><Button size="compact" onclick={refresh} disabled={busy}>Refresh recipient</Button></div>
    {#if recipient}<Text size="small"><code>{recipient.threadId}</code> · {recipient.status === 'notLoaded' ? 'Not loaded — resumes on send' : recipient.status}</Text>{/if}
    {#if request?.response}
      <Text size="small">Delivery: {request.response.status}{request.response.receipt ? ` · ${request.response.receipt.mode}` : ''}. {request.response.error ?? ''}</Text>
    {:else if request?.closed}<Text size="small">This interaction is closed.</Text>
    {:else if recipient?.canSubmit}
      <Select label="Delivery mode" bind:value={mode} onchange={(event) => { mode = event.currentTarget.value; choose(); }} disabled={busy}
        options={recipient.status === 'active' ? [
          { value: '', label: 'Choose how to send' },
          { value: 'queue', label: 'Queue after current turn' },
          { value: 'steer', label: 'Steer current turn' },
        ] : [{ value: 'start', label: 'Start a new turn' }]} />
      <Text size="small" tone="muted">Choose the delivery mode here, then submit the page form below.</Text>
    {/if}
    {#if directory && !request?.response && !request?.closed}
      <Select label="Conversation in this worktree" bind:value={selected} disabled={busy} showSelectedLabel
        options={[{ value: '', label: 'Choose a recipient' }, ...directory.worktree.map(row => ({ value: row.id, label: `${row.title} · ${row.status} · ${row.id.slice(0, 8)}` }))]} />
      <Button size="compact" onclick={takeOver} disabled={busy || !selected || selected === recipient?.threadId}>Confirm recipient change</Button>
      <Text size="small" tone="muted">Creates a new interaction and closes this one. Existing input is not sent or replayed; review the new page before submitting.</Text>
      {#if directory.project.length}<details><summary>Other worktrees · view only ({directory.project.length})</summary>{#each directory.project as row}<Text size="small">{row.title} · {row.workspaceId} · {row.status}</Text>{/each}</details>{/if}
    {/if}
    {#if error}<Text size="small" role="alert">{error}</Text>{/if}
  </SurfaceCard></div>
{/if}

<style>
  .recipient { margin: 1rem; }
  .heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
  @media (max-width: 600px) { .heading { align-items: flex-start; } }
</style>
