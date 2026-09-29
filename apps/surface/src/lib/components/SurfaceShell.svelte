<script lang="ts">
  import '@decompozr/design-system/fonts.css';
  import { onMount, tick, type Snippet } from 'svelte';
  import type { NavigationNode } from '../contracts/navigation.ts';
  import { AppShell, AppHeader, IconButton, Text, SurfaceTabs, SurfaceCard, Button, TextField } from '@decompozr/design-system';
  import NavigationTree from './NavigationTree.svelte';
  import Toast from './Toast.svelte';
  import WorkbenchPalette from './WorkbenchPalette.svelte';
  import {workbench,commands,matchCommand,restoreWorkbench,saveWorkbench,type CommandId} from '../workbench/state.svelte';
  import RecipientPanel from './RecipientPanel.svelte';
  let { navigation = [], currentPath = '/', children, headerTools, viewportContent = false, panelContent, panelOpen = $bindable(false), status, statusHeight = '0px' }: {
    navigation?: NavigationNode[]; currentPath?: string; children?: Snippet; headerTools?: Snippet; viewportContent?: boolean;
    panelContent?: Snippet; panelOpen?: boolean; status?: Snippet; statusHeight?: string;
  } = $props();
  type OpenSurface = { id: string; label: string; href: string; embeddedURL: string; path: string[]; original?: boolean };
  let tabs = $state<OpenSurface[]>([]), activeTab = $state(''), embedded = $state(false), originalClosed = $state(false);
  let navigationOpen = $state(false), currentURL = $state('');
  let preferencesReady = $state(false);
  $effect(() => { if(preferencesReady){workbench.left=navigationOpen;if(panelContent)workbench.right=panelOpen;saveWorkbench();} });
  const nextNotification=$derived(workbench.notifications.find(n=>!n.dismissed));
  const dismissNotification=()=>{if(nextNotification)nextNotification.dismissed=true;};
  $effect(()=>{if(!embedded&&nextNotification){const timer=setTimeout(dismissNotification,5000);return()=>clearTimeout(timer);}});
  let keymapOpen=$state(false);
  $effect(()=>{if(keymapOpen)void tick().then(()=>document.querySelector<HTMLButtonElement>('.settings button')?.focus());});
  let palette=$state<''|'pages'|'commands'|'notifications'>('');
  let paletteInvoker:Element|null=null;
  const pages = (nodes:NavigationNode[]):{id:string;label:string;detail:string}[] => nodes.flatMap(n=>[...(n.href?[{id:n.href,label:n.label,detail:n.href}]:[]),...pages(n.children)]);
  const dismissPalette=()=>{palette='';if(paletteInvoker instanceof HTMLElement)paletteInvoker.focus({preventScroll:true});};
  const isCommandId=(value:unknown):value is CommandId=>commands.some(command=>command.id===value);
  const knownFrame=(source:MessageEventSource|null)=>tabs.some(tab=>{const frame=document.getElementById(`surface-frame-${tab.id}`);return frame instanceof HTMLIFrameElement&&frame.contentWindow===source;});
  const execute=(id:CommandId)=>{
    if(embedded){parent.postMessage({type:'surface:command',id},location.origin);return;}
    if(id==='keymap.open'){keymapOpen=true;return;}
    if(id==='tabs.moveLeft'||id==='tabs.moveRight'){const i=tabs.findIndex(t=>t.id===activeTab),j=i+(id==='tabs.moveLeft'?-1:1);if(i>=0&&j>=0&&j<tabs.length){const next=[...tabs];[next[i],next[j]]=[next[j],next[i]];tabs=next;}return;}
    if(id==='pages.open'||id==='commands.open'||id==='notifications.open'){paletteInvoker=document.activeElement;palette=id==='pages.open'?'pages':id==='commands.open'?'commands':'notifications';}
    if(id==='pane.left.toggle')toggle();
    if(id==='pane.right.toggle'){if(originalVisible)window.dispatchEvent(new CustomEvent('surface:review-tool',{detail:'comments'}));else tool('comments');}
    if(id.startsWith('review.')){const action=id==='review.select'?'select':id==='review.comment'?'comment':'capture';if(originalVisible)window.dispatchEvent(new CustomEvent('surface:review-tool',{detail:action}));else tool(action);}
    if(id==='status.toggle')workbench.status=!workbench.status;
    if(id==='tabs.close')closeTab(activeTab);
    if(id==='tabs.next'||id==='tabs.previous'){const i=tabs.findIndex(t=>t.id===activeTab);const t=tabs[(i+(id==='tabs.next'?1:-1)+tabs.length)%tabs.length];if(t)selectTab(t.id);}
  };
  const resizePane=(event:PointerEvent,side:'left'|'right')=>{
    event.preventDefault();const start=event.clientX,width=side==='left'?workbench.leftWidth:workbench.rightWidth;
    const move=(e:PointerEvent)=>{const next=Math.max(200,Math.min(600,window.innerWidth-80,width+(e.clientX-start)*(side==='left'?1:-1)));if(side==='left')workbench.leftWidth=next;else workbench.rightWidth=next;saveWorkbench();};
    const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop,{once:true});
  };
  $effect(()=>{if(preferencesReady&&!embedded){try{sessionStorage.setItem('surface.workbench.tabs',JSON.stringify({document:location.href,tabs:tabs.map(({id,label,href,path})=>({id,label,href,path})),activeTab,originalClosed}));}catch{}}});
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
    const runCommand=(event:Event)=>{if(event instanceof CustomEvent&&isCommandId(event.detail))execute(event.detail);};
    window.addEventListener('surface:execute',runCommand);
    currentURL = location.href;
    embedded = window.parent !== window && new URL(location.href).searchParams.get('__surface_embedded') === '1';
    restoreWorkbench();navigationOpen=workbench.left;if(panelContent)panelOpen=workbench.right;preferencesReady=true;
    const syncPanes=()=>{restoreWorkbench();navigationOpen=workbench.left;if(panelContent)panelOpen=workbench.right;};
    window.addEventListener('storage',syncPanes);
    const notify=(e:Event)=>{if(e instanceof CustomEvent){if(embedded){parent.postMessage({type:'surface:notification',message:e.detail.message,tone:e.detail.tone},location.origin);return;}workbench.notifications=[...workbench.notifications,{id:crypto.randomUUID(),message:e.detail.message,tone:e.detail.tone}].slice(-100);}};
    window.addEventListener('surface:notification',notify);
    if (!embedded && currentPath.startsWith('/workspace/')) {
      const id = crypto.randomUUID(); tabs = [{ id, label:findLabel(navigation, currentPath) ?? 'Surface', href:location.href, path:displayPath(location.href, findLabel(navigation, currentPath) ?? 'Surface'), embeddedURL:'', original:true }]; activeTab = id;
    }
    if(!embedded){try{
      const saved:unknown=JSON.parse(sessionStorage.getItem('surface.workbench.tabs')||'null');
      if(saved&&typeof saved==='object'&&'document' in saved&&saved.document===location.href&&'tabs' in saved&&Array.isArray(saved.tabs)){
        const original=tabs[0];const restored:OpenSurface[]=[];
        for(const raw of saved.tabs){
          const item:unknown=raw;
          if(!item||typeof item!=='object'||!('id' in item)||typeof item.id!=='string'||!('label' in item)||typeof item.label!=='string'||!('href' in item)||typeof item.href!=='string')continue;
          const url=new URL(item.href,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith('/workspace/'))continue;
          url.searchParams.set('__surface_embedded','1');restored.push({id:item.id,label:item.label,href:item.href,path:displayPath(item.href,item.label),original:item.href===original?.href,embeddedURL:url.href});
        }
        originalClosed='originalClosed' in saved&&saved.originalClosed===true;
        if(original&&!restored.some(t=>t.original)&&!originalClosed)restored.unshift(original);
        tabs=restored;activeTab='activeTab' in saved&&typeof saved.activeTab==='string'&&tabs.some(t=>t.id===saved.activeTab)?saved.activeTab:tabs[0]?.id??'';
      }
    }catch{}}

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
      if(!embedded&&'type' in data&&data.type==='surface:notification'&&'message' in data&&typeof data.message==='string'&&knownFrame(event.source))workbench.notifications=[...workbench.notifications,{id:crypto.randomUUID(),message:data.message,tone:'info'}].slice(-100);
      if(!embedded&&'type' in data&&data.type==='surface:command'&&'id' in data&&isCommandId(data.id)&&knownFrame(event.source))execute(data.id);
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
    return () => { window.removeEventListener('surface:execute',runCommand); window.removeEventListener('surface:notification',notify); window.removeEventListener('storage', syncPanes); window.removeEventListener('popstate', restoreSelection); window.removeEventListener('message', receive); document.removeEventListener('click', follow); };
  });
</script>
<svelte:window onkeydown={(event) => {
  if(event.defaultPrevented||keymapOpen)return;
  const target=event.target;
  const typing=target instanceof HTMLElement&&(target.isContentEditable||!!target.closest('input,textarea,select,[role="textbox"]'));
  if(typing&&!event.metaKey&&!event.ctrlKey&&!event.altKey)return;
  const command=matchCommand(event);
  if(command){event.preventDefault();execute(command);return;}
  if(!typing&&!event.metaKey&&!event.ctrlKey&&!event.altKey){if(event.key.toLowerCase()==='i'){event.preventDefault();execute('pane.right.toggle');}if(event.key.toLowerCase()==='m'){event.preventDefault();execute('pane.left.toggle');}}

}} />
{#snippet actions()}
  {#if activeTab && !originalVisible}
    <IconButton icon="message-square" size="compact" touchAppearance="compact" label="Open comments" onclick={() => tool('comments')} />
  {:else}{@render headerTools?.()}{/if}
{/snippet}
{#snippet header()}
  {#if !embedded}<AppHeader actions={actions} density="compact" height="36px">
    <a class="skip-link" href="#surface-page-content" onclick={skipToContent}>Skip to content</a>
    <IconButton icon="panel-left" size="compact" touchAppearance="compact" onclick={()=>execute('pane.left.toggle')} label="Toggle navigation" title="Workspaces" aria-controls="surface-navigation" aria-expanded={navigationOpen} />
    <IconButton icon="search" size="compact" touchAppearance="compact" label="Open surface" title="Open surface (⌘P)" onclick={()=>execute('pages.open')} />
    <div class="tab-strip"><SurfaceTabs items={tabs} active={activeTab} select={selectTab} close={closeTab} /></div>
  </AppHeader>{/if}
{/snippet}
{#snippet rightContent()}
 <div class="right-pane"><div class="right-body">{@render panelContent?.()}</div>
 <details class="recipient-settings"><summary>Delivery settings</summary><RecipientPanel /></details></div>
{/snippet}
{#snippet navigationContent()}
  <Text size="body">Workspaces</Text>
  {#if navigation.length}<NavigationTree nodes={navigation} currentPath={activePath} currentURL={activeSurface?.href ?? currentURL} open={openSurface} />{:else}<Text size="small" tone="muted">No route pages are mounted yet.</Text>{/if}
{/snippet}
<AppShell navigationMode="responsive" navigationWidth={`${workbench.leftWidth}px`} panelWidth={`${workbench.rightWidth}px`} edgeSwipes {header} headerHeight={embedded ? '0px' : '36px'} navigation={embedded ? undefined : navigationContent} bind:navigationOpen navigationId="surface-navigation" navigationLabel="Workspace navigation" panel={originalVisible && panelContent ? rightContent : undefined} bind:panelOpen panelId="surface-comments" panelLabel="Comments and conversation" status={originalVisible && workbench.status ? status : undefined} statusHeight={originalVisible && workbench.status ? '24px' : '0px'}>
  {#if !originalClosed}<div class="content" class:viewport={viewportContent || tabs.length > 0} hidden={!originalVisible}>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this horizontal scroll region.) -->
    <div id="surface-page-content" bind:this={pageContent} class="page-content" role="region" aria-label="Page content" tabindex="0">{#if children}{@render children()}{:else}<div id="surface-page"></div>{/if}</div>
  </div>{/if}
  {#if originalClosed && !tabs.length}<div class="empty"><Text>Open a surface from Workspaces.</Text></div>{/if}
  {#each tabs.filter(tab => !tab.original) as tab (tab.id)}
    <iframe id={`surface-frame-${tab.id}`} class="surface-frame" title={tab.label} src={tab.embeddedURL} hidden={activeTab !== tab.id}></iframe>
  {/each}
</AppShell>
{#if navigationOpen && !embedded}<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (Resizable separators support keyboard arrows.) -->
<div role="separator" aria-label="Resize Workspaces" aria-orientation="vertical" aria-valuenow={workbench.leftWidth} tabindex="0" class="resize" style:left={`${workbench.leftWidth-3}px`} onpointerdown={e=>resizePane(e,'left')} onkeydown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();workbench.leftWidth=Math.max(200,Math.min(600,workbench.leftWidth+(e.key==='ArrowRight'?10:-10)));}}}></div>{/if}
{#if panelOpen && originalVisible}<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (Resizable separators support keyboard arrows.) -->
<div role="separator" aria-label="Resize Comments" aria-orientation="vertical" aria-valuenow={workbench.rightWidth} tabindex="0" class="resize" style:right={`${workbench.rightWidth-3}px`} onpointerdown={e=>resizePane(e,'right')} onkeydown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();workbench.rightWidth=Math.max(200,Math.min(600,workbench.rightWidth+(e.key==='ArrowLeft'?10:-10)));}}}></div>{/if}
{#if palette}<WorkbenchPalette title={palette==='pages'?'Open surface':palette==='commands'?'Run command':'Notifications'} items={palette==='pages'?pages(navigation):palette==='commands'?commands.map(c=>({id:c.id,label:c.label,detail:workbench.keymap[c.id]??c.key})):workbench.notifications.map(n=>({id:n.id,label:n.message,detail:n.tone}))} close={dismissPalette} choose={id=>{const mode=palette;dismissPalette();if(mode==='pages')openSurface(id,pages(navigation).find(p=>p.id===id)?.label??'Surface');else if(mode==='commands'&&isCommandId(id))execute(id);}} />{/if}
{#if !embedded&&nextNotification}<Toast message={nextNotification.message} tone={nextNotification.tone==='warning'?'warning':nextNotification.tone==='success'?'success':'info'} dismiss={dismissNotification}/>{/if}
{#if keymapOpen}<div class="settings" role="dialog" aria-label="Keyboard shortcuts" aria-modal="true" tabindex="-1" onkeydown={e=>{if(e.key==='Escape'){keymapOpen=false;dismissPalette();}if(e.key==='Tab'){const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button,input'));const index=controls.indexOf(document.activeElement as HTMLElement);e.preventDefault();controls[(index+(e.shiftKey?-1:1)+controls.length)%controls.length]?.focus();}}}><SurfaceCard padding="16px"><Button size="compact" onclick={()=>keymapOpen=false}>Close</Button><h2>Keyboard shortcuts</h2><p>Use Mod, Shift, Alt and a key, such as Mod+Shift+p. Blank disables a shortcut.</p>{#each commands as c}<TextField size="compact" label={c.label} aria-label={c.label+' shortcut'} value={workbench.keymap[c.id]??c.key} onchange={e=>{const value=e.currentTarget.value.trim();if(value&&!/^(?:(?:Mod|Shift|Alt)\+)*[A-Za-z0-9]+$/.test(value)){e.currentTarget.setCustomValidity('Use Mod, Shift, Alt and a key');e.currentTarget.reportValidity();return;}if(commands.some(other=>other.id!==c.id&&(workbench.keymap[other.id]??other.key)===value&&value)){e.currentTarget.setCustomValidity('This shortcut is already assigned');e.currentTarget.reportValidity();return;}e.currentTarget.setCustomValidity('');workbench.keymap={...workbench.keymap,[c.id]:value};saveWorkbench();}}/>{/each}<Button size="compact" onclick={()=>{workbench.keymap={};saveWorkbench();}}>Reset shortcuts</Button></SurfaceCard></div>{/if}
<style>
.settings{position:fixed;z-index:1001;inset:50px max(12px,calc((100vw - 640px)/2));overflow:auto}
  :global(body) { margin:0; }
  .skip-link { position:fixed; top:8px; left:8px; z-index:60; transform:translateY(calc(-100% - 16px)); background:#fff; color:#1e293b; padding:8px 14px; border:2px solid #334155; border-radius:4px; }
  .skip-link:focus { transform:translateY(0); outline:3px solid #2563eb; outline-offset:2px; }
  .page-content:focus-visible { outline:3px solid #2563eb; outline-offset:-3px; }
  .tab-strip { flex:1; min-width:0; height:36px; display:flex; }
  .surface-frame { display:block; width:100%; height:100%; border:0; background:white; }
  [hidden] { display:none !important; }
  .right-pane{height:100%;display:flex;flex-direction:column;min-height:0}.right-body{flex:1;min-height:0}.recipient-settings{font:12px/1.4 system-ui;border-top:1px solid #ddd;padding:6px 12px;max-height:50%;overflow:auto;flex-shrink:0}
  .resize{position:fixed;top:36px;bottom:24px;width:6px;cursor:col-resize;z-index:70;touch-action:none}.resize:focus-visible{outline:2px solid #45604b}.resize:hover{background:#7c897966}
  .empty { padding:1rem; }
  .content { min-width:0; }
  .viewport { height:100%; display:flex; flex-direction:column; }
  .page-content { min-width:0; overflow-x:auto; }
  .viewport .page-content { flex:1; min-height:0; }
</style>
