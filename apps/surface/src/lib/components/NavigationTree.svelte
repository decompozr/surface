<script lang="ts">
  import { onMount } from 'svelte';
  import { NavigationLinks, type NavigationLink } from '@decompozr/design-system';
  import type { NavigationNode } from '../contracts/navigation.ts';

  const links = (nodes: NavigationNode[], depth = 0): NavigationLink[] => {
    return nodes.map(node => {
      const current = !!node.href && clean(node.href) === clean(currentPath);
      return { id: node.id, label: node.label, icon: node.href ? 'file-code' : depth === 0 ? 'panels-top-left' : depth === 1 ? 'git-branch' : 'folder', href: current && currentURL ? currentURL : node.href,
        current, attributes: { 'data-sveltekit-reload': true, onclick: (event) => { if (open && node.href && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); open(node.href, node.label); } } }, children: links(node.children, depth + 1) };
    });
  };

  let { nodes, currentPath = '/', currentURL = '', open }: { nodes: NavigationNode[]; currentPath?: string; currentURL?: string; open?: (href: string, label: string) => void } = $props();
  const storageKey = 'surface.navigation.collapsed.v1';
  let collapsed = $state<string[]>([]);
  const groupIds = (items: NavigationNode[]): string[] => items.flatMap(item => item.children.length ? [item.id, ...groupIds(item.children)] : []);
  const readCollapsed = (value: string | null): string[] | null => {
    if (!value) return [];
    try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) && parsed.every(id => typeof id === 'string') ? parsed : null; } catch { return null; }
  };
  let writable = true;
  const changeExpansion = (ids: string[]) => {
    const currentGroups = groupIds(nodes);
    collapsed = [...collapsed.filter(id => !currentGroups.includes(id)), ...currentGroups.filter(id => !ids.includes(id))];
    try { if (writable) localStorage.setItem(storageKey, JSON.stringify(collapsed)); } catch { /* Unavailable storage must not block navigation. */ }
  };
  onMount(() => {
    try { const stored = readCollapsed(localStorage.getItem(storageKey)); writable = stored !== null; if (stored) collapsed = stored; } catch { writable = false; }
    const sync = (event: StorageEvent) => { if (event.key === storageKey) { const stored = readCollapsed(event.newValue); writable = stored !== null; if (stored) collapsed = stored; } };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  });
  const clean = (path: string) => path.replace(/\/$/, '');
</script>
<NavigationLinks collapsible expandedIds={groupIds(nodes).filter(id => !collapsed.includes(id))} onExpandedChange={changeExpansion} typography="uniform" density="compact" touchAppearance="compact" touchDensity="compact" items={links(nodes)} label="Mounted pages" />
