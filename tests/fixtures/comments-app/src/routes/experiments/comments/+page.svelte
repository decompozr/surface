<script lang="ts">
  import { Text, Slider, ToggleButton, SurfaceCard, Tag } from '@decompozr/design-system';
  import CommentWorkspace from '$lib/components/CommentWorkspace.svelte';
  let { data } = $props();
  let fontSize = $state(42), compact = $state(false);
</script>
<svelte:head><title>Surface · Comment experiment</title></svelte:head>
<CommentWorkspace {data} currentPath="/experiments/comments" endpoint="/experiments/comments" storageKey="conversation" revision="comment-playground-v2">
{#snippet children(mode: boolean)}
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
{/snippet}
</CommentWorkspace>
<style>
.workspace-meta, .option-top, .controls { display:flex; align-items:center; gap:.5rem; }
.workspace-meta, .option-top { justify-content:space-between; }
:global(.instruction) { margin:18px 0 26px; }
.study { max-width:820px; margin:0 auto; }
.study :global(h1) { max-width:650px; margin:12px 0 20px; }
.study :global(.intro) { max-width:530px; margin-bottom:26px; }
.controls { justify-content:space-between; gap:16px; margin:22px 0; }
.options { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
.option-top { margin-bottom:24px; }
.options :global(h2) { margin-bottom:12px; }
.option-footer { margin-top:24px; }
.decision { margin-top:25px; padding:20px 0; }
@media(max-width:680px) { .workspace-meta :global(:last-child) { display:none; } .options { grid-template-columns:1fr; } .controls { align-items:flex-start; flex-direction:column; } }
</style>
