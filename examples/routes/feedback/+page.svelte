<script lang="ts">
  import { onMount } from 'svelte';
  import { createInteractionClient } from 'virtual:surface-interactions';
  import { previewState } from 'virtual:surface-preview';

  const refresh = async () => {
    try { interaction = await client.read(); failure = ''; }
    catch (error) { failure = String(error); }
  };

  const submit = async () => {
    submitting = true;
    try { interaction = await client.submit({ label: $draft }, $responseId); failure = ''; }
    catch (error) { failure = String(error); }
    finally { submitting = false; }
  };

  const client = createInteractionClient();
  const draft = previewState('feedback-draft', '', 1);
  const responseId = previewState('feedback-response-id', crypto.randomUUID(), 1);
  let interaction = $state<{ closed: boolean; response?: { status: string }; result?: { message?: string } } | null>(null);
  let failure = $state('');
  let submitting = $state(false);
  onMount(() => {
    void refresh();
    const timer = setInterval(refresh, 500);
    return () => clearInterval(timer);
  });
</script>

<main>
  <h1>Surface feedback</h1>
  <label>Feedback <input bind:value={$draft} /></label>
  <button disabled={!interaction || submitting || !!interaction.response || interaction.closed} onclick={submit}>Send feedback</button>
  <p role="status">{interaction?.response?.status ?? (interaction?.closed ? 'closed' : 'pending')}</p>
  <p data-testid="result">{interaction?.result?.message ?? 'No result yet'}</p>
  {#if failure}<p role="alert">{failure}</p>{/if}
</main>

<style>
  :global(body) { margin: 0; font-family: system-ui; background: #f7f6f0; color: #213b31; }
  main { max-width: 640px; margin: 10vh auto; padding: 24px; }
  label { display: block; margin-block: 24px; }
  input, button { padding: 12px; font: inherit; }
</style>
