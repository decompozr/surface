import { expect, test } from 'bun:test';
import { navigationTree, type NavigationMount } from './navigation.ts';
test('navigation uses registered ready mounts and preserves worktree identity and nested folder indexes', () => {
  const mounts: NavigationMount[] = [
    { namespace: 'main', name: 'ui', source: '/repo/ui', projectRoot: '/repo', status: 'ready', publicPath: '/workspace/project/main/ui', pages: { '': 'routes/+page.svelte', 'review/detail': 'routes/review/detail/+page.svelte' } },
    { namespace: 'branch', name: 'ui', source: '/branch/ui', projectRoot: '/branch', status: 'ready', publicPath: '/workspace/project/branch/ui', pages: { '': 'routes/+page.svelte' } },
    { namespace: 'secret', name: 'ui', source: '/unregistered/ui', projectRoot: '/unregistered', status: 'ready', publicPath: '/unregistered', pages: { '': '+page.svelte' } },
  ];
  const tree = navigationTree(mounts, { projects: [{ id: 'project', commonDir: '/repo/.git', workspaces: [{ id: 'main-id', root: '/repo', branch: 'main', status: 'active' }, { id: 'branch-id', root: '/branch', branch: 'feature', status: 'active' }] }] });
  expect(tree[0]!.children.map(item => item.id)).toEqual(['main-id', 'branch-id']);
  expect(tree[0]!.children[0]!.children[0]!.children[1]).toMatchObject({ label: 'review', href: '/workspace/project/main/ui/review', children: [{ label: 'detail', href: '/workspace/project/main/ui/review/detail' }] });
  expect(JSON.stringify(tree)).not.toContain('unregistered');
  mounts[0]!.status = 'unmounted';
  expect(navigationTree(mounts, { projects: [{ id: 'project', commonDir: '/repo/.git', workspaces: [{ id: 'main-id', root: '/repo', branch: 'main', status: 'active' }] }] })).toEqual([]);
});
