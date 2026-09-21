<script lang="ts">
import { onMount } from 'svelte';
import { createArtifactClient } from 'virtual:artifact-client';
import { previewState } from 'virtual:artifact-preview';
const client = createArtifactClient();
const draft = previewState('draft', '', 1);
const responseId = previewState('response-id', crypto.randomUUID(), 1);
let interaction = $state<any>(null);
let failure = $state('');
async function refresh() { try { interaction = await client.read(); } catch (error) { failure = String(error); } }
async function submit() { try { interaction = await client.submit({ label: $draft }, $responseId); } catch (error) { failure = String(error); } }
onMount(() => { void refresh(); const timer = setInterval(refresh, 150); return () => clearInterval(timer); });
</script>
<main><h1>Singleton feedback</h1><label>Draft<input aria-label="Draft" bind:value={$draft}/></label>
<button disabled={!interaction || !!interaction.response || interaction.closed} onclick={submit}>Send feedback</button>
<p data-testid="status">{interaction?.response?.status ?? (interaction?.closed ? 'closed' : 'pending')}</p>
<p data-testid="result">{interaction?.result?.message ?? 'No result'}</p><p data-testid="failure">{failure}</p></main>
<style>:global(body){font-family:system-ui;background:#f5f6f0;color:#183d32;padding:32px}main{max-width:680px;margin:auto}input,button{font:inherit;margin:12px;padding:12px}</style>
