<script lang="ts">
  import NavigationTree from './NavigationTree.svelte';
  import type { NavigationNode } from '../../../../../src/server/navigation';
  let { nodes, currentPath = '/', currentURL = '' }: { nodes: NavigationNode[]; currentPath?: string; currentURL?: string } = $props();
  const clean = (path: string) => path.replace(/\/$/, '');
</script>
<ul>
  {#each nodes as node (node.id)}
    <li>
      {#if node.href}<a data-sveltekit-reload href={clean(node.href) === clean(currentPath) && currentURL ? currentURL : node.href} aria-current={clean(node.href) === clean(currentPath) ? 'page' : undefined}>{node.label}</a>
      {:else}<span>{node.label}</span>{/if}
      {#if node.children.length}<NavigationTree nodes={node.children} {currentPath} {currentURL} />{/if}
    </li>
  {/each}
</ul>
<style>
  ul { list-style: none; padding: 0; margin: 4px 0; } li { margin: 3px 0; }
  li :global(ul) { padding-left: 13px; margin-left: 9px; border-left: 1px solid #e2e0e7; }
  a, span { display: block; padding: 7px 9px; border-radius: 6px; overflow-wrap: anywhere; font-size: 13px; line-height: 1.4; }
  span { font-weight: 600; color: #475569; } a { color: #475569; text-decoration: none; }
  a:hover { background: #efede8; } a[aria-current] { color: #514566; background: #eae5f2; font-weight: 600; }
</style>
