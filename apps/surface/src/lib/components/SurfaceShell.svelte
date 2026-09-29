<script lang="ts">
  import '@decompozr/design-system/fonts.css';
  import { onMount, tick, type Snippet } from 'svelte';
  import type { NavigationNode } from '../contracts/navigation.ts';
  import { AppShell, AppHeader, IconButton, Text, SurfaceTabs } from '@decompozr/design-system';
  import NavigationTree from './NavigationTree.svelte';
  import RecipientPanel from './RecipientPanel.svelte';
  let { navigation = [], currentPath = '/', children, headerTools, viewportContent = false, panelContent, panelOpen = $bindable(false), status, statusHeight = '0px' }: {
    navigation?: NavigationNode[]; currentPath?: string; children?: Snippet; headerTools?: Snippet; viewportContent?: boolean;
    panelContent?: Snippet; panelOpen?: boolean; status?: Snippet; statusHeight?: string;
  } = $props();
  type OpenSurface = { id: string; label: string; href: string; embeddedURL: string; path: string[]; original?: boolean };
  let tabs = $state<OpenSurface[]>([]), activeTab = $state(''), embedded = $state(false), originalClosed = $state(false);
  let navigationOpen = $state(false), currentURL = $state('');
  let preferencesReady = $state(false);
  const paneKey = (pane: string) => `surface.ui.panes.${pane}`;
  $effect(() => { if (preferencesReady && !embedded) { try { localStorage.setItem(paneKey('workspaces'), JSON.stringify(navigationOpen)); } catch {} } });
  $effect(() => { if (preferencesReady && panelContent) { try { localStorage.setItem(paneKey('comments'), JSON.stringify(panelOpen)); } catch {} } });
  let pageContent = $state<HTMLDivElement>();
  const activeSurface = $derived(tabs.find(tab => tab.id === activeTab));
  const originalVisible = $derived((!activeTab && !originalClosed) || !!activeSurface?.original);
  const activePath = $derived(activeSurface ? new URL(activeSurface.href).pathname : currentPath);
  const toggle = () => { navigationOpen = !navigationOpen; };
  const skipToContent = async (event: MouseEvent) => { event.preventDefault(); navigationOpen = false; await tick(); if (originalVisible) pageContent?.focus(); else document.getElementById(`surface-frame-${activeTab}`)?.focus(); };
  const findLabel = (nodes: NavigationNode[], path: string): string | undefined => {
    for (const node of nodes) { if (node.href?.replace(/\/$/, '') === path.replace(/\/$/, '')) return node.label; const nested = findLabel(node.children, path); if (nested) return nested; }
  };
  const displayPath = (href: string, label: string) => {
    const parts = new URL(href, location.origin).pathname.split('/').filter(Boolean).slice(1).map(part => { try { return decodeURIComponent(part); } catch { return part; } });
    if (label === 'Home') parts.push(label);
    else if (parts.length) parts[parts.length - 1] = label;
    return parts;
  };
  // Keep the document URL stable: embedded surfaces own their route/capability URLs.
  // History records selection, while the mounted tab collection retains page state.
  let historySession = '';
  const recordSelection = (replace = false) => {
    if (!historySession || embedded) return;
    const state = { ...history.state, surfaceTab: { session:historySession, id:activeTab } };
    if (replace) history.replaceState(state, ''); else history.pushState(state, '');
  };
  const selectTab = (id: string) => {
    if (activeTab !== id) { activeTab = id; recordSelection(); }
    navigationOpen = false;
  };
  const openSurface = (href: string, label: string) => {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/workspace/')) return;
    url.searchParams.delete('__surface_embedded'); const cleanURL = url.href;
    if (embedded) { parent.postMessage({ type:'surface:open-tab', href:cleanURL, label }, location.origin); return; }
    const existing = tabs.find(tab => tab.href === cleanURL);
    if (existing) { selectTab(existing.id); return; }
    url.searchParams.set('__surface_embedded', '1'); const id = crypto.randomUUID();
    tabs = [...tabs, { id, label, href:cleanURL, path:displayPath(cleanURL, label), embeddedURL:url.href }]; selectTab(id);
  };
  const closeTab = (id: string) => {
    const index = tabs.findIndex(tab => tab.id === id);
    if (index < 0) return;
    if (tabs.find(tab => tab.id === id)?.original) originalClosed = true;
    tabs = tabs.filter(tab => tab.id !== id);
    if (activeTab === id) { activeTab = tabs[Math.min(index, tabs.length - 1)]?.id ?? ''; recordSelection(true); }
  };
  const tool = (action: 'select' | 'comments' | 'comment' | 'capture') => {
    const frame = document.getElementById(`surface-frame-${activeTab}`);
    if (frame instanceof HTMLIFrameElement) frame.contentWindow?.postMessage({ type:'surface:review-tool', action }, location.origin);
  };
  onMount(() => {
    currentURL = location.href;
    embedded = window.parent !== window && new URL(location.href).searchParams.get('__surface_embedded') === '1';
    try {
      if (!embedded) navigationOpen = localStorage.getItem(paneKey('workspaces')) === 'true';
      if (panelContent) panelOpen = localStorage.getItem(paneKey('comments')) === 'true';
    } catch {}
    preferencesReady = true;
    const syncPanes = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (!embedded && event.key === paneKey('workspaces')) navigationOpen = event.newValue === 'true';
      if (panelContent && event.key === paneKey('comments')) panelOpen = event.newValue === 'true';
    };
    window.addEventListener('storage', syncPanes);
    if (!embedded && currentPath.startsWith('/workspace/')) {
      const id = crypto.randomUUID(); tabs = [{ id, label:findLabel(navigation, currentPath) ?? 'Surface', href:location.href, path:displayPath(location.href, findLabel(navigation, currentPath) ?? 'Surface'), embeddedURL:'', original:true }]; activeTab = id;
    }
    if (!embedded) { historySession = crypto.randomUUID(); recordSelection(true); }
    const restoreSelection = (event: PopStateEvent) => {
      const selection = event.state?.surfaceTab;
      if (!selection || selection.session !== historySession) return;
      if (!selection.id || tabs.some(tab => tab.id === selection.id)) {
        activeTab = selection.id; navigationOpen = false;
      } else {
        // Closing is explicit: history must not resurrect a discarded page.
        recordSelection(true);
      }
    };
    window.addEventListener('popstate', restoreSelection);
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin !== location.origin || typeof event.data !== 'object' || !event.data) return;
      const data = event.data;
      if (embedded && event.source === parent && 'type' in data && data.type === 'surface:review-tool' && 'action' in data && (data.action === 'select' || data.action === 'comments' || data.action === 'comment' || data.action === 'capture')) window.dispatchEvent(new CustomEvent('surface:review-tool', { detail:data.action }));
      if (!embedded && tabs.some(tab => { const frame = document.getElementById(`surface-frame-${tab.id}`); return frame instanceof HTMLIFrameElement && frame.contentWindow === event.source; }) && 'type' in data && data.type === 'surface:open-tab' && 'href' in data && typeof data.href === 'string' && 'label' in data && typeof data.label === 'string') openSurface(data.href, data.label);
    };
    const follow = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href); if (url.origin !== location.origin || !url.pathname.startsWith('/workspace/') || url.pathname === location.pathname && url.search === location.search) return;
      event.preventDefault(); openSurface(url.href, anchor.textContent?.trim() || 'Surface');
    };
    window.addEventListener('message', receive); document.addEventListener('click', follow);
    return () => { window.removeEventListener('storage', syncPanes); window.removeEventListener('popstate', restoreSelection); window.removeEventListener('message', receive); document.removeEventListener('click', follow); };
  });
</script>
<svelte:window onkeydown={(event) => {
  const target = event.target;
  const typing = target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select, [role="textbox"]'));
  if (!embedded && !typing && !originalVisible && !event.isComposing && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && ['c','s'].includes(event.key.toLowerCase())) { event.preventDefault(); tool(event.key.toLowerCase() === 'c' ? 'comment' : 'capture'); }
  if (!embedded && !typing && !event.isComposing && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'm') { event.preventDefault(); toggle(); }
}} />
{#snippet actions()}
  {#if activeTab && !originalVisible}
    <IconButton icon="mouse-pointer-2" size="compact" touchAppearance="compact" label="Select and comment" onclick={() => tool('select')} />
    <IconButton icon="message-square" size="compact" touchAppearance="compact" label="Open comments" onclick={() => tool('comments')} />
  {:else}{@render headerTools?.()}{/if}
{/snippet}
{#snippet header()}
  {#if !embedded}<AppHeader actions={actions} density="compact" height="36px">
    <a class="skip-link" href="#surface-page-content" onclick={skipToContent}>Skip to content</a>
    <IconButton icon="panel-left" size="compact" touchAppearance="compact" onclick={toggle} label="Toggle navigation" title="Workspaces" aria-controls="surface-navigation" aria-expanded={navigationOpen} />
    <div class="tab-strip"><SurfaceTabs items={tabs} active={activeTab} select={selectTab} close={closeTab} /></div>
  </AppHeader>{/if}
{/snippet}
{#snippet navigationContent()}
  <Text size="body">Workspaces</Text>
  {#if navigation.length}<NavigationTree nodes={navigation} currentPath={activePath} currentURL={activeSurface?.href ?? currentURL} open={openSurface} />{:else}<Text size="small" tone="muted">No route pages are mounted yet.</Text>{/if}
{/snippet}
<AppShell navigationMode="push" edgeSwipes {header} headerHeight={embedded ? '0px' : '36px'} navigation={embedded ? undefined : navigationContent} bind:navigationOpen navigationId="surface-navigation" navigationLabel="Workspace navigation" panel={originalVisible ? panelContent : undefined} bind:panelOpen panelId="surface-comments" panelLabel="Comments and conversation" status={originalVisible ? status : undefined} statusHeight={originalVisible ? statusHeight : '0px'}>
  {#if !originalClosed}<div class="content" class:viewport={viewportContent || tabs.length > 0} hidden={!originalVisible}>
    <RecipientPanel />
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this horizontal scroll region.) -->
    <div id="surface-page-content" bind:this={pageContent} class="page-content" role="region" aria-label="Page content" tabindex="0">{#if children}{@render children()}{:else}<div id="surface-page"></div>{/if}</div>
  </div>{/if}
  {#if originalClosed && !tabs.length}<div class="empty"><Text>Open a surface from Workspaces.</Text></div>{/if}
  {#each tabs.filter(tab => !tab.original) as tab (tab.id)}
    <iframe id={`surface-frame-${tab.id}`} class="surface-frame" title={tab.label} src={tab.embeddedURL} hidden={activeTab !== tab.id}></iframe>
  {/each}
</AppShell>
<style>
  :global(body) { margin:0; }
  .skip-link { position:fixed; top:8px; left:8px; z-index:60; transform:translateY(calc(-100% - 16px)); background:#fff; color:#1e293b; padding:8px 14px; border:2px solid #334155; border-radius:4px; }
  .skip-link:focus { transform:translateY(0); outline:3px solid #2563eb; outline-offset:2px; }
  .page-content:focus-visible { outline:3px solid #2563eb; outline-offset:-3px; }
  .tab-strip { flex:1; min-width:0; height:36px; display:flex; }
  .surface-frame { display:block; width:100%; height:100%; border:0; background:white; }
  [hidden] { display:none !important; }
  .empty { padding:1rem; }
  .content { min-width:0; }
  .viewport { height:100%; display:flex; flex-direction:column; }
  .page-content { min-width:0; overflow-x:auto; }
  .viewport .page-content { flex:1; min-height:0; }
</style>
