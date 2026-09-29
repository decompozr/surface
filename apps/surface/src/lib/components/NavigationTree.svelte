<script lang="ts">
  import { NavigationLinks, type NavigationLink } from '@decompozr/design-system';
  import type { NavigationNode } from '../contracts/navigation.ts';

  const links = (nodes: NavigationNode[], depth = 0): NavigationLink[] => {
    return nodes.map(node => {
      const current = !!node.href && clean(node.href) === clean(currentPath);
      return { id: node.id, label: node.label, icon: node.href ? 'file' : depth < 2 ? 'panels-top-left' : 'folder', href: current && currentURL ? currentURL : node.href,
        current, attributes: { 'data-sveltekit-reload': true, onclick: (event) => { if (open && node.href && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); open(node.href, node.label); } } }, children: links(node.children, depth + 1) };
    });
  };

  let { nodes, currentPath = '/', currentURL = '', open }: { nodes: NavigationNode[]; currentPath?: string; currentURL?: string; open?: (href: string, label: string) => void } = $props();
  const clean = (path: string) => path.replace(/\/$/, '');
</script>
<NavigationLinks typography="uniform" density="compact" touchAppearance="compact" touchDensity="compact" items={links(nodes)} label="Mounted pages" />
