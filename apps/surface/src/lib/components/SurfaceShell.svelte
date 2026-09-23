<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte';
  import type { NavigationNode } from '../../../../../src/server/navigation';
  import NavigationTree from './NavigationTree.svelte';
  import RecipientPanel from './RecipientPanel.svelte';
  let { navigation = [], currentPath = '/', children }: { navigation?: NavigationNode[]; currentPath?: string; children?: Snippet } = $props();
  let collapsed = $state(false), mobile = $state(false), drawer = $state(false), currentURL = $state('');
  let toggleButton: HTMLButtonElement;
  let pageContent: HTMLDivElement;
  async function skipToContent(event: MouseEvent) {
    event.preventDefault();
    drawer = false;
    await tick();
    pageContent.focus();
  }
  function toggle() { if (mobile) drawer = !drawer; else { collapsed = !collapsed; try { sessionStorage.setItem('surface-sidebar', String(collapsed)); } catch {} } }
  function close() { drawer = false; toggleButton?.focus(); }
  function trail(nodes: NavigationNode[], parents: NavigationNode[] = []): NavigationNode[] {
    for (const node of nodes) {
      const nested = trail(node.children, [...parents, node]);
      if (nested.length) return nested;
      if (node.href?.replace(/\/$/, '') === currentPath.replace(/\/$/, '')) return [...parents, node];
    }
    return [];
  }
  const breadcrumbs = $derived(trail(navigation));
  onMount(() => {
    currentURL = location.href;
    try { collapsed = sessionStorage.getItem('surface-sidebar') === 'true'; } catch {}
    const query = matchMedia('(max-width: 760px)');
    const update = () => { mobile = query.matches; if (!mobile) drawer = false; };
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });
</script>
<svelte:window onkeydown={(event) => { if (event.key === 'Escape' && drawer) close(); }} />
<div class="surface-shell" class:collapsed class:drawer>
  <a class="skip-link" href="#surface-page-content" onclick={skipToContent}>Skip to content</a>
  <header>
    <button class="toggle" bind:this={toggleButton} onclick={toggle} aria-label="Toggle navigation" aria-controls="surface-navigation" aria-expanded={mobile ? drawer : !collapsed}>☰</button>
    <a class="brand" href="/" data-sveltekit-reload>Surface</a>
    <span class="tag">Workspace</span>
  </header>
  {#if drawer}<button class="backdrop" aria-label="Close navigation" onclick={close}></button>{/if}
  <aside id="surface-navigation" aria-label="Workspace navigation" inert={mobile ? !drawer : collapsed}>
    <p class="eyebrow">Projects & worktrees</p>
    {#if navigation.length}<NavigationTree nodes={navigation} {currentPath} {currentURL} />{:else}<p class="empty">No route pages are mounted yet.</p>{/if}
  </aside>
  <div class="content">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/" data-sveltekit-reload>Home</a>{#each breadcrumbs as node}<span aria-hidden="true">/</span>{#if node.href}<a data-sveltekit-reload href={node.href.replace(/\/$/, '') === currentPath.replace(/\/$/, '') && currentURL ? currentURL : node.href}>{node.label}</a>{:else}<span>{node.label}</span>{/if}{/each}</nav>
    <RecipientPanel />
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this horizontal scroll region.) -->
    <div id="surface-page-content" bind:this={pageContent} class="page-content" role="region" aria-label="Page content" tabindex="0">{#if children}{@render children()}{:else}<div id="surface-page"></div>{/if}</div>
  </div>
</div>
<style>
  :global(body) { margin: 0; }
  .surface-shell { min-height: 100vh; background: white; color: #334155; font: 14px/1.5 system-ui, sans-serif; display: grid; grid-template: 60px 1fr / 280px minmax(0, 1fr); }
  header { grid-column: 1 / -1; display: flex; align-items: center; gap: 14px; padding: 0 20px; border-bottom: 1px solid #e5e7eb; background: white; z-index: 30; }
  .skip-link { position: fixed; top: 8px; left: 8px; z-index: 40; transform: translateY(calc(-100% - 16px)); background: #fff; color: #1e293b; padding: 8px 14px; border: 2px solid #334155; border-radius: 4px; }
  .skip-link:focus { transform: translateY(0); outline: 3px solid #2563eb; outline-offset: 2px; }
  .page-content:focus-visible { outline: 3px solid #2563eb; outline-offset: -3px; }
  .brand { color: #334155; font-size: 19px; font-weight: 650; letter-spacing: -.04em; text-decoration: none; }
  .tag { color: #64748b; background: #f2efe8; border-radius: 5px; padding: 3px 8px; font-size: 11px; }
  .toggle { font-size: 18px; border: 1px solid #dddde4; background: white; color: #475569; border-radius: 7px; width: 34px; height: 34px; cursor: pointer; }
  aside { grid-column: 1; padding: 22px 14px; background: #f8f7f4; border-right: 1px solid #e8e5df; overflow-y: auto; }
  .eyebrow { text-transform: uppercase; letter-spacing: .1em; color: #64748b; font-size: 10px; padding: 0 9px; margin: 0 0 18px; }
  .empty { padding: 0 9px; color: #64748b; }
  .content { grid-column: 2; min-width: 0; background: white; }
  .breadcrumbs { display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #f0eef3; padding: 14px 24px; font-size: 12px; color: #64748b; }
  .breadcrumbs a { color: #64748b; text-decoration: none; } .breadcrumbs a:hover { text-decoration: underline; }
  .page-content { min-width: 0; overflow-x: auto; } .collapsed { grid-template-columns: 0 minmax(0, 1fr); } .collapsed aside { display: none; }
  .backdrop { display: none; }
  .page-content :global(.surface-folder) { padding: 32px; max-width: 780px; }
  .page-content :global(.surface-folder > p) { color: #64748b; font-size: 12px; }
  .page-content :global(.surface-folder h1) { font-size: 32px; letter-spacing: -.03em; margin: 8px 0 24px; }
  .page-content :global([data-artifact-catalog]) { list-style: none; padding: 0; display: grid; gap: 10px; }
  .page-content :global([data-artifact-catalog] a) { display: block; border: 1px solid #e4dfed; border-radius: 8px; color: #514566; background: #faf9fc; padding: 14px 18px; text-decoration: none; }
  .page-content :global([data-artifact-catalog] a:hover) { background: #f0ecf7; }
  @media(max-width: 760px) {
    .surface-shell { grid-template-columns: minmax(0, 1fr); } .content { grid-column: 1; }
    aside, .collapsed aside { display: none; } .drawer aside { display: block; position: fixed; top: 60px; bottom: 0; left: 0; width: min(280px, calc(100vw - 64px)); box-sizing: border-box; z-index: 25; box-shadow: 8px 0 24px #33415515; }
    .backdrop { display: block; position: fixed; inset: 60px 0 0; border: 0; background: #33415540; z-index: 20; }
    .breadcrumbs { padding: 12px 16px; } header { padding: 0 16px; }
  }
</style>
