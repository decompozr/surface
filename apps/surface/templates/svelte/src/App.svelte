<script lang="ts">
  import { onMount } from 'svelte';
  import { createInteractionClient } from './interactions';

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    busy = true;
    try {
      const client = createInteractionClient();
      const existing = await client.read();
      if (existing.response) {
        submitted = true;
        status = `Existing submission: ${existing.response.status}.`;
      } else {
        // Disable after sending, including uncertain transport outcomes.
        submitted = true;
        const request = await client.submit({ message }, responseId);
        status = `Submission ${request.response?.status ?? 'saved'}. Waiting for the agent result.`;
      }
      result = JSON.stringify(await client.waitForResult(), null, 2);
      status = 'Agent result received.';
    } catch (error) { status = error instanceof Error ? error.message : String(error); }
    finally { busy = false; }
  };

  let message = $state('');
  let status = $state('Ready for your input.');
  let result = $state('');
  let submitted = $state(false);
  let busy = $state(false);
  const responseId = crypto.randomUUID();
  onMount(() => {
    if (!new URL(location.href).searchParams.has('request')) {
      status = 'Preview only. Open a Surface interaction link to send data.';
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const client = createInteractionClient();
        const current = await client.read();
        if (controller.signal.aborted) return;
        if (current.response) {
          submitted = true;
          message = typeof current.response.data.message === 'string' ? current.response.data.message : '';
          status = `Existing submission: ${current.response.status}.`;
          result = JSON.stringify(current.result ?? await client.waitForResult({ signal: controller.signal }), null, 2);
          status = 'Agent result received.';
        }
      } catch (error) { if (!controller.signal.aborted) status = error instanceof Error ? error.message : String(error); }
    })();
    return () => controller.abort();
  });
</script>

<main>
  <p class="eyebrow">SURFACE / LOCAL WORKSPACE</p>
  <h1>A page for your next idea.</h1>
  <p>Edit this Svelte component, then send a message to the agent that created your interaction.</p>
  <form onsubmit={submit}>
    <label for="message">Your message</label>
    <textarea id="message" bind:value={message} required maxlength="1000" disabled={submitted}></textarea>
    <button disabled={busy || submitted}>{submitted ? 'Response submitted' : 'Send to agent'}</button>
  </form>
  <p role="status">{status}</p>
  {#if result}<pre aria-label="Agent result">{result}</pre>{/if}
</main>

<style>
  :global(body) { margin: 0; background: #f7f6f0; color: #213b31; font-family: system-ui, sans-serif; }
  main { max-width: 640px; margin: 10vh auto; padding: 24px; }
  .eyebrow { letter-spacing: .13em; font-size: .75rem; }
  h1 { font-size: clamp(2rem, 6vw, 3.4rem); line-height: 1.1; }
  p { line-height: 1.6; }
  label { display: block; margin-bottom: 8px; }
  textarea { box-sizing: border-box; width: 100%; min-height: 120px; padding: 12px; font: inherit; }
  button { margin-top: 16px; border: 0; padding: 12px 20px; background: #213b31; color: white; font: inherit; cursor: pointer; }
  button:disabled { opacity: .55; cursor: default; }
  pre { padding: 16px; background: #e7ebe3; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
