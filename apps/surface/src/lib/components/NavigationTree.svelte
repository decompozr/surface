<script lang="ts">
  import { NavigationLinks, type NavigationLink } from '@decompozr/design-system';
  import type { NavigationNode } from '../contracts/navigation.ts';

  const links = (nodes: NavigationNode[]): NavigationLink[] => {
    return nodes.map(node => {
      const current = !!node.href && clean(node.href) === clean(currentPath);
      return { id: node.id, label: node.label, href: current && currentURL ? currentURL : node.href,
        current, attributes: { 'data-sveltekit-reload': true }, children: links(node.children) };
    });
  };

  let { nodes, currentPath = '/', currentURL = '' }: { nodes: NavigationNode[]; currentPath?: string; currentURL?: string } = $props();
  const clean = (path: string) => path.replace(/\/$/, '');
</script>
<NavigationLinks density="compact" items={links(nodes)} label="Mounted pages" />
