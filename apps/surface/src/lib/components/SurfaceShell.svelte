<script lang="ts">
  import '@decompozr/design-system/fonts.css';
  import { onMount, tick, type Snippet } from 'svelte';
  import type { NavigationNode } from '../contracts/navigation.ts';
  import { Logo } from '@decompozr/design-system';
  import { AppShell, AppHeader, Brand, Button, Icon, Text, Breadcrumbs } from '@decompozr/design-system';
  import NavigationTree from './NavigationTree.svelte';
  import RecipientPanel from './RecipientPanel.svelte';

  const skipToContent = async (event: MouseEvent) => {
    event.preventDefault();
    navigationOpen = false;
    await tick();
    pageContent.focus();
  };

  const toggle = () => { navigationOpen = !navigationOpen; };

  const trail = (nodes: NavigationNode[], parents: NavigationNode[] = []): NavigationNode[] => {
    for (const node of nodes) {
      const nested = trail(node.children, [...parents, node]);
      if (nested.length) return nested;
      if (node.href?.replace(/\/$/, '') === currentPath.replace(/\/$/, '')) return [...parents, node];
    }
    return [];
  };

  let { navigation = [], currentPath = '/', children, headerTools, surfaceIdentity = false, viewportContent = false, showBreadcrumbs = true, panelContent, panelOpen = $bindable(false), status, statusHeight = '0px' }: {
    navigation?: NavigationNode[]; currentPath?: string; children?: Snippet; headerTools?: Snippet;
    surfaceIdentity?: boolean; viewportContent?: boolean; showBreadcrumbs?: boolean;
    panelContent?: Snippet; panelOpen?: boolean; status?: Snippet; statusHeight?: string;
  } = $props();
  let navigationOpen = $state(false), currentURL = $state('');
  let pageContent: HTMLDivElement;
  const breadcrumbs = $derived(trail(navigation));
  onMount(() => {
    currentURL = location.href;

  });
</script>
<svelte:window onkeydown={(event) => {
  const target = event.target;
  const typing = target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select, [role="textbox"]'));
  if (viewportContent && !typing && !event.isComposing && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'm') { event.preventDefault(); toggle(); }
}} />
{#snippet header()}
  <AppHeader actions={headerTools}>
    <a class="skip-link" href="#surface-page-content" onclick={skipToContent}>Skip to content</a>
    <Button appearance="quiet" size="compact" touchAppearance="compact" onclick={toggle} aria-label="Toggle navigation" title={viewportContent ? 'Toggle navigation (M)' : 'Toggle navigation'} aria-keyshortcuts={viewportContent ? 'M' : undefined} aria-controls="surface-navigation" aria-expanded={navigationOpen}>
      {#if surfaceIdentity}<Logo variant="compact" palette="slate" centerSymbol="S" label="Surface" size={38} />{:else}<Icon name="panel-left" size={16} />{/if}
    </Button>
    <Brand href="/" data-sveltekit-reload>Surface</Brand>
  </AppHeader>
{/snippet}
{#snippet navigationContent()}
  <Text size="eyebrow" tone="muted">Projects &amp; workspaces</Text>
  {#if navigation.length}<NavigationTree nodes={navigation} {currentPath} {currentURL} />{:else}<Text size="small" tone="muted">No route pages are mounted yet.</Text>{/if}
{/snippet}
<AppShell navigationMode="push" edgeSwipes {header} navigation={navigationContent} bind:navigationOpen navigationId="surface-navigation" navigationLabel="Workspace navigation" panel={panelContent} bind:panelOpen panelId="surface-comments" panelLabel="Comments and conversation" {status} {statusHeight}>
  <div class="content" class:viewport={viewportContent}>
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
