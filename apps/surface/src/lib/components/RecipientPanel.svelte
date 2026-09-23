<script lang="ts">
  import { onMount } from 'svelte';
  import { createSurfaceClient, type Recipient, type Interaction, type Directory, type DeliveryIntent } from '../../../../../src/client/index';
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
  });
</script>

{#if enabled}
  <section class="recipient" aria-label="Agent recipient">
    <div class="heading"><strong>Agent recipient</strong><button type="button" onclick={refresh} disabled={busy}>Refresh recipient</button></div>
    {#if recipient}<p><code>{recipient.threadId}</code> · {recipient.status === 'notLoaded' ? 'Not loaded — resumes on send' : recipient.status}</p>{/if}
    {#if request?.response}
      <p>Delivery: {request.response.status}{request.response.receipt ? ` · ${request.response.receipt.mode}` : ''}. {request.response.error ?? ''}</p>
    {:else if request?.closed}<p>This interaction is closed.</p>
    {:else if recipient?.canSubmit}
      <label>Delivery mode
        <select bind:value={mode} onchange={(event) => { mode = event.currentTarget.value; choose(); }} disabled={busy}>
          {#if recipient.status === 'active'}<option value="">Choose how to send</option><option value="queue">Queue after current turn</option><option value="steer">Steer current turn</option>
          {:else}<option value="start">Start a new turn</option>{/if}
        </select>
      </label>
      <p class="hint">Choose the delivery mode here, then submit the page form below.</p>
    {/if}
    {#if directory && !request?.response && !request?.closed}
      <label>Conversation in this worktree
        <select bind:value={selected} disabled={busy}>
          <option value="">Choose a recipient</option>
          {#each directory.worktree as row}<option value={row.id}>{row.title} · {row.status} · {row.id.slice(0, 8)}</option>{/each}
        </select>
      </label>
      <button type="button" onclick={takeOver} disabled={busy || !selected || selected === recipient?.threadId}>Confirm recipient change</button>
      <p class="hint">Creates a new interaction and closes this one. Existing input is not sent or replayed; review the new page before submitting.</p>
      {#if directory.project.length}<details><summary>Other worktrees · view only ({directory.project.length})</summary>{#each directory.project as row}<p>{row.title} · {row.workspaceId} · {row.status}</p>{/each}</details>{/if}
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
  </section>
{/if}

<style>
  .recipient { font: 14px/1.5 system-ui, sans-serif; color: #334155; background: #f5f3fa; border: 1px solid #e4dfed; border-radius: 12px; padding: 16px; margin: 16px; }
  .heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  p { margin: 8px 0; overflow-wrap: anywhere; } code { font-size: 12px; }
  label { display: inline-flex; flex-direction: column; gap: 5px; margin: 8px 12px 8px 0; }
  select, button { font: inherit; padding: 8px 12px; border: 1px solid #c9c3d5; border-radius: 7px; background: white; color: #334155; max-width: 100%; }
  button { cursor: pointer; } button:disabled { opacity: .5; cursor: default; } .hint { color: #64748b; font-size: 12px; }
  @media (max-width: 600px) { label { display: flex; margin-right: 0; } .heading { align-items: flex-start; } }
</style>
