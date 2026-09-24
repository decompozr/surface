<script lang="ts">
  import '@decompozr/design-system/fonts.css';
  import { onMount, tick, type Snippet } from 'svelte';
  import type { NavigationNode } from '@decompozr/surface-contracts/navigation';
  import SurfaceLogo from '../comment-experiment/SurfaceLogo.svelte';
  import { AppShell, AppHeader, Brand, Button, Icon, Text, Breadcrumbs } from '@decompozr/design-system';
  import NavigationTree from './NavigationTree.svelte';
  import RecipientPanel from './RecipientPanel.svelte';
  let { navigation = [], currentPath = '/', children, headerTools, surfaceIdentity = false, overlayNavigation = false, showBreadcrumbs = true, panelContent, panelOpen = $bindable(false), status, statusHeight = '0px' }: {
    navigation?: NavigationNode[]; currentPath?: string; children?: Snippet; headerTools?: Snippet;
    surfaceIdentity?: boolean; overlayNavigation?: boolean; showBreadcrumbs?: boolean;
    panelContent?: Snippet; panelOpen?: boolean; status?: Snippet; statusHeight?: string;
  } = $props();
  let navigationOpen = $state(false), currentURL = $state(''), mobile = $state(false), collapsed = $state(false);
  let pageContent: HTMLDivElement;
  async function skipToContent(event: MouseEvent) {
    event.preventDefault();
    navigationOpen = false;
    await tick();
    pageContent.focus();
  }
  function toggle() { navigationOpen = !navigationOpen; if (!overlayNavigation && !mobile) { collapsed = !navigationOpen; try { sessionStorage.setItem('surface-sidebar', String(collapsed)); } catch {} } }
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
    const update = () => { mobile = query.matches; if (!overlayNavigation) navigationOpen = mobile ? false : !collapsed; };
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });
</script>
<svelte:window onkeydown={(event) => {
  const target = event.target;
  const typing = target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select, [role="textbox"]'));
  if (overlayNavigation && !typing && !event.isComposing && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'm') { event.preventDefault(); toggle(); }
}} />
{#snippet header()}
  <AppHeader actions={headerTools}>
    <a class="skip-link" href="#surface-page-content" onclick={skipToContent}>Skip to content</a>
    <Button appearance="quiet" size="compact" onclick={toggle} aria-label="Toggle navigation" title={overlayNavigation ? 'Toggle navigation (M)' : 'Toggle navigation'} aria-keyshortcuts={overlayNavigation ? 'M' : undefined} aria-controls="surface-navigation" aria-expanded={navigationOpen}>
      {#if surfaceIdentity}<SurfaceLogo palette="slate" />{:else}<Icon name="panel-left" />{/if}
    </Button>
    <Brand href="/" data-sveltekit-reload>Surface</Brand>
  </AppHeader>
{/snippet}
{#snippet navigationContent()}
  <Text size="eyebrow" tone="muted">Projects &amp; worktrees</Text>
  {#if navigation.length}<NavigationTree nodes={navigation} {currentPath} {currentURL} />{:else}<Text size="small" tone="muted">No route pages are mounted yet.</Text>{/if}
{/snippet}
<AppShell navigationMode={overlayNavigation ? 'overlay' : 'responsive'} {header} navigation={navigationContent} bind:navigationOpen navigationId="surface-navigation" navigationLabel="Workspace navigation" panel={panelContent} bind:panelOpen panelId="surface-comments" panelLabel="Comments and conversation" {status} {statusHeight}>
  <div class="content" class:viewport={overlayNavigation}>
    {#if showBreadcrumbs}<Breadcrumbs items={[
      { label: 'Home', href: '/', current: currentPath === '/', attributes: { 'data-sveltekit-reload': true } },
      ...breadcrumbs.map(node => ({ label: node.label,
        href: node.href?.replace(/\/$/, '') === currentPath.replace(/\/$/, '') && currentURL ? currentURL : node.href,
        current: node.href?.replace(/\/$/, '') === currentPath.replace(/\/$/, ''),
        attributes: { 'data-sveltekit-reload': true } })),
    ]} />{/if}
    <RecipientPanel />
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this horizontal scroll region.) -->
    <div id="surface-page-content" bind:this={pageContent} class="page-content" role="region" aria-label="Page content" tabindex="0">{#if children}{@render children()}{:else}<div id="surface-page"></div>{/if}</div>
  </div>
</AppShell>
<style>
  :global(body) { margin:0; }
  .skip-link { position:fixed; top:8px; left:8px; z-index:60; transform:translateY(calc(-100% - 16px)); background:#fff; color:#1e293b; padding:8px 14px; border:2px solid #334155; border-radius:4px; }
  .skip-link:focus { transform:translateY(0); outline:3px solid #2563eb; outline-offset:2px; }
  .page-content:focus-visible { outline:3px solid #2563eb; outline-offset:-3px; }
  .content { min-width:0; }
  .viewport { height:100%; display:flex; flex-direction:column; }
  .page-content { min-width:0; overflow-x:auto; }
  .viewport .page-content { flex:1; min-height:0; }
</style>
